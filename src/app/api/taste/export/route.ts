import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { DIMS } from '@/lib/taste';
import { computeExportDelta, confidenceInputsFrom } from '@/lib/tasteExport';
import { versionForProfile, ratchetVersion } from '@/lib/version';
import { isPersona } from '@/lib/persona';

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
    .select('vector, cuisine_affinity, rating_count, version_unlocked, profile_version, last_export_vector, persona')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No taste profile yet.' }, { status: 404 });

  const vector = (profile.vector ?? {}) as Record<string, number>;
  const prior = (profile.last_export_vector ?? null) as Record<string, number> | null;
  const delta = computeExportDelta(vector, prior, DIMS);

  // The export's version stamp IS the dishi version (the version ladder, item 1's
  // unification): a v2 unlock generates the v2 export with deltas since the last one
  // — no separate per-export counter to drift. Ratcheted against the stored unlock
  // history; min 1 because a locked profile can't reach this route's caller at all.
  const live = versionForProfile(
    confidenceInputsFrom(vector, profile.cuisine_affinity ?? {}, profile.rating_count ?? 0),
  );
  const version = Math.max(1, ratchetVersion(profile.version_unlocked ?? 0, live.version));

  const { error } = await supabase.from('taste_profiles').update({
    profile_version: version,
    last_export_vector: vector,
    last_export_at: new Date().toISOString(),
    ...(persona ? { persona } : {}),
  }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    profile_version: version, delta, is_first_export: !prior,
    persona: persona ?? profile.persona ?? 'honest',
  });
}
