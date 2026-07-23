/**
 * One-off, MANUAL backfill for diet-flag integrity (docs/specs/diet-flag-integrity.md,
 * item 5). NOT a cron — run it once by hand after the fix deploys, then forget it.
 *
 * What it does: runs the same `dietSuspicion` tripwire the live scan path now uses
 * over already-stored rows, and re-enriches ONLY the suspicious subset. That bound
 * matters — re-enriching every dish would be an unbounded LLM bill for no reason;
 * the tripwire is exactly how we spend tokens only where a flag looks wrong (the
 * 雞扎-shaped rows). Prints before/after counts so the run is auditable.
 *
 * SCOPE NOTE — restaurant_menu_items: in the live schema that table carries NO diet
 * column (it stores name/price/attributes only), so there are no stored flags there
 * to re-check or fix. It is intentionally skipped. If diet flags are ever added to
 * restaurant_menu_items, extend this script to cover them the same way.
 *
 * RUN:
 *   Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPENROUTER_API_KEY
 *   are in the environment (e.g. `set -a; source .env.local; set +a`), then:
 *     npx tsx scripts/backfill-diet-flags.ts            # dry run: report only
 *     npx tsx scripts/backfill-diet-flags.ts --apply    # actually write corrected flags
 */
import { supabaseAdmin } from '../src/lib/supabase/server';
import { dietSuspicion, enrichOneDish } from '../src/lib/menuScan';

const APPLY = process.argv.includes('--apply');

type DishRow = { id: string; name: string | null; name_zh: string | null; cuisine: string | null; diet: string[] | null };

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required — re-enrichment needs a real model call.');
  }
  const admin = supabaseAdmin();

  // Stored dishes have name/name_zh/diet but no persisted ingredients, so the
  // tripwire runs on names + flags alone — which is precisely the signal that
  // caught 雞扎 (protein in the name, absurd flags, nothing backing them).
  const { data, error } = await admin
    .from('dishes')
    .select('id, name, name_zh, cuisine, diet');
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];

  const suspicious = rows.filter(r => dietSuspicion(r.name, r.name_zh, r.diet ?? [], []));
  console.log(`dishes scanned: ${rows.length}`);
  console.log(`suspicious (tripwire fired): ${suspicious.length}`);
  if (!APPLY) {
    for (const r of suspicious) {
      console.log(`  would re-enrich: ${r.name_zh || r.name} — current diet: [${(r.diet ?? []).join(', ')}]`);
    }
    console.log('\nDRY RUN — re-run with --apply to write corrected flags.');
    return;
  }

  let changed = 0;
  for (const r of suspicious) {
    const seed = r.name_zh || r.name;
    if (!seed) continue;
    // enrichOneDish carries the tripwire re-ask internally, so the correction is
    // grounded the same way a fresh scan is — recipe first, flags derived from it.
    const enriched = await enrichOneDish({ name: seed, name_zh: r.name_zh, cuisine: r.cuisine || 'unknown' });
    // A flaked model call comes back as EMPTY_ENRICHMENT (enrichOneDish returns it
    // when the response doesn't parse) — that is a FAILED CALL, not a verdict, and
    // writing its empty diet would wipe real flags (observed live 2026-07-23: 腸粉
    // [seafood,egg,dairy] -> [] on an "OpenRouter returned non-JSON" flake). A real
    // enrichment essentially always carries a hook/method/ingredients; skip anything
    // that looks like the empty shape rather than trusting it.
    const looksFlaked = enriched.diet.length === 0 && !enriched.hook && !enriched.cooking_method && enriched.ingredients.length === 0;
    if (looksFlaked) { console.log(`  SKIPPED (model call failed, not a verdict): ${seed}`); continue; }
    // Order-insensitive: flags are a SET — [a,b] -> [b,a] is not a correction, and
    // writing it just churns the row (observed on the 2026-07-23 second pass).
    const before = [...(r.diet ?? [])].sort().join(',');
    const after = [...enriched.diet].sort().join(',');
    if (before === after) continue;
    const { error: upErr } = await admin.from('dishes').update({ diet: enriched.diet }).eq('id', r.id);
    if (upErr) { console.error(`  FAILED ${r.id}: ${upErr.message}`); continue; }
    changed++;
    console.log(`  fixed ${r.name_zh || r.name}: [${before}] -> [${after}]`);
  }
  console.log(`\nrows with corrected flags: ${changed} / ${suspicious.length} suspicious`);
}

main().catch(e => { console.error(e); process.exit(1); });
