/**
 * One-time backfill: resolve every live dish with no canonical_dish_id yet.
 *
 * Idempotent and re-runnable: only touches rows where canonical_dish_id IS
 * NULL, which also means honest-"none" dishes get retried on a later run —
 * exactly what catalog growth wants (a new entry picks up its old misses).
 *
 * Runs the FULL production pipeline per dish (resolveCanonicalDishId:
 * resolve -> category exclusion -> structural veto), not a shortcut, so the
 * backfilled ids are precisely what enrichment would have produced.
 *
 * RUN (after generate-catalog-structures.ts has landed real structures):
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/backfill-canonical-dishes.ts
 */
import { createClient } from '@supabase/supabase-js';
import { resolveCanonicalDishId, dishLabel } from '../src/lib/dishCanonical';
import { CATALOG_BY_ID } from '../src/lib/hkDishCatalog';

(async () => {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: dishes, error } = await db
    .from('dishes')
    .select('id, name, name_zh, restaurant_id')
    .is('canonical_dish_id', null);
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Resolving ${dishes!.length} unresolved dishes (full pipeline, sequential — expect ~10s each)…`);
  const groups = new Map<string, string[]>();
  let mapped = 0, none = 0;

  for (const d of dishes!) {
    const label = dishLabel(d.name, d.name_zh);
    const id = await resolveCanonicalDishId(label);
    if (id) {
      const { error: upErr } = await db.from('dishes').update({ canonical_dish_id: id }).eq('id', d.id);
      if (upErr) { console.error(`  write failed for ${d.id}: ${upErr.message}`); continue; }
      mapped++;
      const list = groups.get(id) ?? [];
      list.push(`${label}${d.restaurant_id ? '' : ' (no venue)'}`);
      groups.set(id, list);
      console.log(`  ✓ ${label}  ->  ${id}`);
    } else {
      none++;
      console.log(`  · ${label}  ->  none`);
    }
  }

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  mapped: ${mapped}   honest none: ${none}`);
  console.log(`\n── groups with 2+ dishes (the cross-venue joins this build exists for — eyeball for false merges) ──`);
  for (const [id, members] of groups) {
    if (members.length < 2) continue;
    const e = CATALOG_BY_ID.get(id);
    console.log(`  ${id} (${e?.zh}):`);
    members.forEach(m => console.log(`     - ${m}`));
  }
})();
