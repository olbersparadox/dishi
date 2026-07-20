/**
 * One-off, MANUAL backfill for HK carb-shorthand integrity (backlog item #4c). NOT a
 * cron — run it once by hand after the fix deploys, then forget it.
 *
 * What it does: runs the `carbSuspicion` tripwire the live scan/enrich path now uses
 * over already-stored rows, and re-enriches ONLY the suspicious subset. That bound
 * matters — re-enriching every dish would be an unbounded LLM bill; the tripwire is
 * exactly how we spend tokens only where a carb looks misread (the 炆米→炆飯 rows).
 * Prints before/after so the run is auditable.
 *
 * SCOPE — what this DOES and DOES NOT fix. The `dishes` table stores name/name_zh/
 * cuisine/attributes/cooking_method/heaviness/diet — NOT ingredients. So:
 *   • carbSuspicion runs on names alone (the English name is its rice/noodle signal,
 *     see the fn) — it catches rows where the noodle shorthand SURVIVED in one name
 *     but the other says rice. A row where BOTH names were corrupted is unrecoverable
 *     mechanically (the shorthand is simply gone) and is reported, not touched.
 *   • --apply re-derives and writes the enrichment fields dishes stores (diet /
 *     cooking_method / heaviness), now grounded by the shorthand glossary + carb
 *     re-ask. It deliberately does NOT auto-rewrite the NAME or re-score the ATTRIBUTE
 *     VECTOR: a wrong name must be re-authored (a translate/vision call + the human
 *     authority ladder), and the vector can only be honestly re-scored AFTER the name
 *     is right. Those rows are printed as "name looks wrong — review" for a human /
 *     the follow-up slice, never silently changed.
 *
 * RUN:
 *   Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPENROUTER_API_KEY
 *   are in the environment (e.g. `set -a; source .env.local; set +a`), then:
 *     npx tsx scripts/backfill-carb-shorthand.ts            # dry run: report only
 *     npx tsx scripts/backfill-carb-shorthand.ts --apply    # write corrected enrichment
 */
import { supabaseAdmin } from '../src/lib/supabase/server';
import { carbSuspicion, enrichOneDish } from '../src/lib/menuScan';

const APPLY = process.argv.includes('--apply');

type DishRow = {
  id: string; name: string | null; name_zh: string | null; cuisine: string | null;
  diet: string[] | null; cooking_method: string | null; heaviness: string | null;
};

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required — re-enrichment needs a real model call.');
  }
  const admin = supabaseAdmin();

  // No persisted ingredients, so the tripwire runs on names alone — its English-name
  // fallback (see carbSuspicion) is precisely the signal that survives on stored rows.
  const { data, error } = await admin
    .from('dishes')
    .select('id, name, name_zh, cuisine, diet, cooking_method, heaviness');
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];

  const suspicious = rows.filter(r => carbSuspicion(r.name, r.name_zh, []));
  console.log(`dishes scanned: ${rows.length}`);
  console.log(`suspicious (carb tripwire fired): ${suspicious.length}`);
  if (!APPLY) {
    for (const r of suspicious) {
      console.log(`  would re-enrich: ${r.name_zh || r.name}  (en: "${r.name}") — diet: [${(r.diet ?? []).join(', ')}]`);
    }
    console.log('\nDRY RUN — re-run with --apply to write corrected enrichment.');
    console.log('NOTE: a wrong NAME / attribute VECTOR is NOT auto-fixed (needs name re-author first) — review those by hand.');
    return;
  }

  let changed = 0;
  for (const r of suspicious) {
    // Prefer the Chinese name as the seed: the shorthand lives there, and the enrich
    // prompt's glossary + the carb re-ask now expand it (米→米粉) before deriving.
    const seed = r.name_zh || r.name;
    if (!seed) continue;
    const enriched = await enrichOneDish({ name: seed, name_zh: r.name_zh, cuisine: r.cuisine || 'unknown' });
    const before = `${(r.diet ?? []).join(',')}|${r.cooking_method ?? ''}|${r.heaviness ?? ''}`;
    const after = `${enriched.diet.join(',')}|${enriched.cooking_method ?? ''}|${enriched.heaviness ?? ''}`;
    if (before === after) { console.log(`  unchanged: ${r.name_zh || r.name} — review name "${r.name}" by hand`); continue; }
    const { error: upErr } = await admin.from('dishes').update({
      diet: enriched.diet, cooking_method: enriched.cooking_method, heaviness: enriched.heaviness,
    }).eq('id', r.id);
    if (upErr) { console.error(`  FAILED ${r.id}: ${upErr.message}`); continue; }
    changed++;
    console.log(`  fixed ${r.name_zh || r.name}: [${before}] -> [${after}]  (name "${r.name}" still needs review)`);
  }
  console.log(`\nrows with corrected enrichment: ${changed} / ${suspicious.length} suspicious`);
}

main().catch(e => { console.error(e); process.exit(1); });
