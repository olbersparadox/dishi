/**
 * Builds a user's REAL palate export doc from live data, exactly as
 * TasteFormCard assembles it — shared by the probe harness (probe-export.ts)
 * and the manual-cell dump (dump-export-doc.ts).
 *
 * Shared rather than copied because the subtleties here are the kind that fail
 * SILENTLY: reading `handle` without checking `username_set_at` yields an
 * anonymous doc, and a dropped companions query yields a doc missing a section.
 * Either produces a different document under test while looking like it worked,
 * so there must be exactly one copy of this logic to get right.
 *
 * NOTE it deliberately does NOT hit /api/taste/export. That POST is the real
 * export event and advances the delta baseline (TasteFormCard's copyDoc); a
 * measurement run must not move the version the user sees. Version is read
 * straight off the profile instead.
 */
import { createClient } from '@supabase/supabase-js';
import {
  extractTasteSections, buildTastePrompt,
  type ExportDish, type ExportCompanions,
} from '../src/lib/tasteExport';
import { companionStats, type CompanionEdgeView } from '../src/lib/companions';
import { dict, cuisineLabel } from '../src/lib/i18n-dict';

export type BuiltDoc = {
  doc: string;
  ratingCount: number;
  username: string | null;
  version: number | undefined;
};

export async function buildExportDoc(userId: string): Promise<BuiltDoc> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [pRes, rRes, uRes, eRes] = await Promise.all([
    db.from('taste_profiles').select('vector, cuisine_affinity, rating_count, profile_version').eq('user_id', userId).maybeSingle(),
    db.from('ratings').select('score, dishes(id, name, name_zh, cuisine, source, eaten_at, restaurants(name))').eq('user_id', userId),
    // The canonical username is `handle`; `username_set_at` is what CLAIMED
    // means (every legacy row already has an auto-derived handle, so a
    // non-empty name proves nothing — /api/buddy gates on the same column).
    // Getting this wrong silently produces an anonymous doc, which is a
    // different document under test.
    db.from('profiles').select('handle, username_set_at').eq('id', userId).maybeSingle(),
    db.from('companion_edges').select('user_a, user_b, dish_id, table_session_id, picked_at').or(`user_a.eq.${userId},user_b.eq.${userId}`),
  ]);
  // Every query is checked, including the ones whose absence would degrade
  // quietly rather than crash: a failed profiles lookup would just anonymise
  // the doc, and a failed edges lookup would just drop the companions section.
  // Both change what is under test, so neither may pass silently.
  const failed = [pRes.error, rRes.error, uRes.error, eRes.error].find(Boolean);
  if (failed) throw new Error(failed.message);
  if (!pRes.data) throw new Error('user has no taste profile');

  const edges = (eRes.data ?? []) as any[];
  const sharedDishIds = new Set(edges.map(e => e.dish_id));

  const dishes: ExportDish[] = (rRes.data ?? []).flatMap((r: any) => {
    const d = r.dishes;
    if (!d) return [];
    return [{
      name: d.name, name_zh: d.name_zh, score: r.score,
      restaurant: d.restaurants?.name ?? null,
      eaten_at: d.eaten_at ?? null, source: d.source ?? null,
      shared: sharedDishIds.has(d.id),
    }];
  });

  // Companions layer, same derivation and same hard privacy line as the export
  // route: display names only, everyone else counted anonymously.
  let companions: ExportCompanions = { named: [], unnamedCount: 0 };
  if (edges.length) {
    const cuisineById = new Map((rRes.data ?? []).flatMap((r: any) => r.dishes ? [[r.dishes.id, r.dishes.cuisine ?? null] as const] : []));
    const views: CompanionEdgeView[] = edges.map(e => ({
      other: e.user_a === userId ? e.user_b : e.user_a,
      dish_id: e.dish_id, table_session_id: e.table_session_id, picked_at: e.picked_at,
      cuisine: cuisineById.get(e.dish_id) ?? null,
    }));
    const stats = companionStats(views);
    const { data: profs } = await db.from('profiles').select('id, display_name').in('id', stats.map(s => s.userId));
    const nameById = new Map((profs ?? []).map(p => [p.id, (p.display_name as string | null)?.trim() || null]));
    const named = stats.filter(s => nameById.get(s.userId)).map(s => ({
      name: nameById.get(s.userId)!, mealCount: s.mealCount, dishCount: s.dishCount, cuisines: s.cuisines,
    }));
    companions = { named, unnamedCount: stats.length - named.length };
  }

  const profile = pRes.data;
  const sections = extractTasteSections(
    {
      vector: (profile.vector ?? {}) as Record<string, number>,
      affinity: (profile.cuisine_affinity ?? {}) as Record<string, number>,
      ratingCount: profile.rating_count ?? 0,
      dishes,
    },
    // The doc is English-only by design (tasteExport.ts header), so the labels
    // are read straight off the shipped dictionary's en side — the same strings
    // t() would return, without pulling a React-side helper into a script.
    dim => dict[`dim.${dim}`]?.en ?? dim,
    c => cuisineLabel(c, 'en'),
  );

  const username = uRes.data?.username_set_at ? (uRes.data.handle as string) : null;
  const version = profile.profile_version ?? undefined;
  return {
    doc: buildTastePrompt(sections, { version, name: username, companions }),
    ratingCount: profile.rating_count ?? 0,
    username,
    version,
  };
}
