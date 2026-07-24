import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { DIMS } from '@/lib/taste';
import { computeExportDelta, confidenceInputsFrom, type ExportCompanions } from '@/lib/tasteExport';
import { companionStats, type CompanionEdgeView } from '@/lib/companions';
import { versionForProfile, ratchetVersion } from '@/lib/version';
import { isPersona } from '@/lib/persona';

// 同檯 companions layer (Table Mode item 4): honest aggregates from this
// person's real companion edges, computed server-side so the client (and the
// export prompt it builds) receives display names only — the hard privacy
// line. Admin client per the standing RLS pattern, scoped to edges the
// authenticated user is a party to. Best-effort: an aggregation failure
// must not block the export itself. Shared by POST (the real export) and GET
// (the read-only preview below).
async function companionsView(
  userId: string,
  prior: Record<string, number> | null,
  lastExportAt: string | null,
): Promise<{ companions: ExportCompanions; newCompanions: string[] }> {
  let companions: ExportCompanions = { named: [], unnamedCount: 0 };
  let newCompanions: string[] = [];
  try {
    const admin = supabaseAdmin();
    const { data: edges } = await admin
      .from('companion_edges')
      .select('user_a, user_b, dish_id, table_session_id, picked_at')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    if (edges && edges.length) {
      const dishIds = Array.from(new Set(edges.map(e => e.dish_id)));
      const { data: dishRows } = await admin
        .from('dishes').select('id, cuisine').in('id', dishIds);
      const cuisineById = new Map((dishRows ?? []).map(d => [d.id, d.cuisine as string | null]));

      const views: CompanionEdgeView[] = edges.map(e => ({
        other: e.user_a === userId ? e.user_b : e.user_a,
        dish_id: e.dish_id,
        table_session_id: e.table_session_id,
        picked_at: e.picked_at,
        cuisine: cuisineById.get(e.dish_id) ?? null,
      }));
      const stats = companionStats(views);

      const { data: profiles } = await admin
        .from('profiles').select('id, display_name').in('id', stats.map(s => s.userId));
      const displayNameById = new Map((profiles ?? []).map(p => [p.id, (p.display_name as string | null)?.trim() || null]));

      const named = stats
        .filter(s => displayNameById.get(s.userId))
        .map(s => ({
          name: displayNameById.get(s.userId)!,
          mealCount: s.mealCount, dishCount: s.dishCount, cuisines: s.cuisines,
        }));
      companions = { named, unnamedCount: stats.length - named.length };

      // Export-versioning delta: a companion is "new since the last export"
      // when their EARLIEST shared pick postdates it — derivable from
      // picked_at + last_export_at with zero extra storage. Named only (the
      // same privacy line); first export has no baseline, so no delta.
      if (prior && lastExportAt) {
        newCompanions = stats
          .filter(s => displayNameById.get(s.userId) && s.firstSharedAt > lastExportAt)
          .map(s => displayNameById.get(s.userId)!);
      }
    }
  } catch (e) {
    console.error('export companions aggregation failed', e);
  }
  return { companions, newCompanions };
}

// The export's version stamp IS the dishi version (the version ladder, item 1's
// unification): a v2 unlock generates the v2 export with deltas since the last
// one — no separate per-export counter to drift. Ratcheted against the stored
// unlock history; min 1 because a locked profile can't reach either handler's
// caller at all.
function versionFor(profile: { vector: unknown; cuisine_affinity: unknown; rating_count: number | null; version_unlocked: number | null }): number {
  const live = versionForProfile(
    confidenceInputsFrom(
      (profile.vector ?? {}) as Record<string, number>,
      (profile.cuisine_affinity ?? {}) as Record<string, number>,
      profile.rating_count ?? 0,
    ),
  );
  return Math.max(1, ratchetVersion(profile.version_unlocked ?? 0, live.version));
}

/**
 * GET — read-only preview of what the NEXT export would say about itself: the
 * version stamp, the dims that moved since the last export, and any new table
 * companions. Powers the Taste tab's recurring "what's new in v{N}" line
 * (§5 + the versioning-deltas open thread) WITHOUT committing anything: the
 * delta baseline (last_export_vector/last_export_at) and the stored persona
 * belong to the real export event, which is POST's alone.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('vector, cuisine_affinity, rating_count, version_unlocked, last_export_vector, last_export_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No taste profile yet.' }, { status: 404 });

  const vector = (profile.vector ?? {}) as Record<string, number>;
  const prior = (profile.last_export_vector ?? null) as Record<string, number> | null;
  const { newCompanions } = await companionsView(user.id, prior, profile.last_export_at as string | null);

  return NextResponse.json({
    profile_version: versionFor(profile),
    delta: computeExportDelta(vector, prior, DIMS),
    is_first_export: !prior,
    new_companions: newCompanions,
  });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // The chosen voice, if the client is committing one on this export. Validated; an
  // absent/invalid persona leaves the stored choice untouched.
  const body = await req.json().catch(() => ({}));
  const persona = isPersona(body?.persona) ? body.persona : null;

  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('vector, cuisine_affinity, rating_count, version_unlocked, profile_version, last_export_vector, last_export_at, persona')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No taste profile yet.' }, { status: 404 });

  const vector = (profile.vector ?? {}) as Record<string, number>;
  const prior = (profile.last_export_vector ?? null) as Record<string, number> | null;
  const delta = computeExportDelta(vector, prior, DIMS);
  const { companions, newCompanions } = await companionsView(user.id, prior, profile.last_export_at as string | null);
  const version = versionFor(profile);

  const { error } = await supabase.from('taste_profiles').update({
    profile_version: version,
    last_export_vector: vector,
    last_export_at: new Date().toISOString(),
    ...(persona ? { persona } : {}),
  }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    profile_version: version, delta, is_first_export: !prior,
    persona: persona ?? profile.persona ?? 'spoon',
    companions, new_companions: newCompanions,
  });
}
