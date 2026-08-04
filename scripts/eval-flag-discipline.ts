/* Flag-discipline re-check, 2026-08-04: does reasoning-off hold on TODAY's
   model? Re-runs the July-29 A/B's question over real rated dishes. Baseline =
   stored diet flags (derived when reasoning-on still worked, several
   tripwire-verified). Plus objective canaries: the A/B's own cited failures. */
import { supabaseAdmin } from '../src/lib/supabase/server';
import {
  ENRICH_SYSTEM, sanitizeDietFlags, sanitizeIngredients, sanitizeCookingMethod,
  dietSuspicion,
} from '../src/lib/menuScan';
import { callClaude, parseJsonResponse } from '../src/lib/openrouter';

const THINK_BUDGET = (() => {
  const i = process.argv.indexOf('--think-budget');
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

async function enrichOff(name: string, name_zh: string | null, cuisine: string) {
  const zh = name_zh && name_zh !== name ? ` / ${name_zh}` : '';
  const userText = `${name}${zh} — cuisine: ${cuisine}`;
  const t0 = Date.now();
  const text = await callClaude(ENRICH_SYSTEM, userText, {
    maxTokens: THINK_BUDGET > 0 ? THINK_BUDGET + 300 : 260, timeoutMs: 40_000, expectJson: true,
    ...(process.argv.includes('--reasoning-off') ? { reasoning: 'off' as const }
      : THINK_BUDGET > 0 ? { reasoning: { max_tokens: THINK_BUDGET } } : {}),
  });
  const parsed = parseJsonResponse<any>(text);
  return {
    ms: Date.now() - t0,
    ok: !!parsed,
    diet: parsed ? sanitizeDietFlags(parsed.d) : [],
    ingredients: parsed ? sanitizeIngredients?.(parsed.i) ?? [] : [],
    method: parsed ? sanitizeCookingMethod(parsed.m) : null,
  };
}

const setEq = (a: string[], b: string[]) =>
  [...a].sort().join(',') === [...b].sort().join(',');

async function main() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('dishes')
    .select('name, name_zh, cuisine, diet, ingredients, ratings!inner(dish_id)')
    .not('diet', 'is', null);
  const seen = new Set<string>();
  const rows = (data ?? []).filter((r: any) => {
    const k = r.name_zh || r.name;
    if (seen.has(k)) return false;
    seen.add(k);
    return (r.diet ?? []).length > 0;
  });
  // soy-seasoned + seafood names first (the A/B's failure modes), then fill
  const pri = (r: any) => {
    const n = `${r.name} ${r.name_zh ?? ''}`.toLowerCase();
    if (/豉油|照燒|teriyaki|滷|叉燒|油雞/.test(n)) return 0;
    if (/蝦|蟹|蠔|魚|鰻|貝|shrimp|crab|oyster|fish|eel|scallop|clam/.test(n)) return 1;
    return 2;
  };
  rows.sort((a: any, b: any) => pri(a) - pri(b));
  const sample = rows.slice(0, 22);

  let identical = 0, lostProtein = 0, soyAdded = 0, failed = 0, tripwire = 0;
  const times: number[] = [];
  const diffs: string[] = [];
  for (const r of sample as any[]) {
    const out = await enrichOff(r.name, r.name_zh, r.cuisine || 'unknown');
    if (!out.ok) { failed++; diffs.push(`FAILED CALL: ${r.name_zh || r.name}`); continue; }
    times.push(out.ms);
    const stored: string[] = r.diet ?? [];
    if (setEq(out.diet, stored)) identical++;
    else {
      const missing = stored.filter(f => !(out.diet as string[]).includes(f));
      const extra = out.diet.filter((f: string) => !stored.includes(f));
      if (missing.some((f: string) => ['seafood', 'shellfish', 'beef', 'pork', 'chicken', 'duck_goose', 'egg'].includes(f))) lostProtein++;
      if (extra.includes('soy')) soyAdded++;
      diffs.push(`${r.name_zh || r.name}: stored[${stored}] off[${out.diet}] (missing:[${missing}] extra:[${extra}])`);
    }
    // would production's own safety net have caught the miss?
    if (dietSuspicion(r.name, r.name_zh ?? null, out.diet, out.ingredients)) tripwire++;
  }

  console.log(`\n=== baseline-identity over ${sample.length} rated dishes ===`);
  console.log(`identical flag sets: ${identical}/${sample.length - failed}   failed calls: ${failed}`);
  console.log(`lost a protein/allergen flag: ${lostProtein}   spurious soy added: ${soyAdded}`);
  console.log(`tripwire would fire (production retry safety net): ${tripwire}`);
  const s = times.sort((a, b) => a - b);
  console.log(`latency p50 ${s[Math.floor(s.length / 2)]}ms  max ${s[s.length - 1]}ms`);
  console.log(`\n--- diffs ---`); diffs.forEach(d => console.log('  ' + d));

  console.log(`\n=== objective canaries (the July A/B's cited failures) ===`);
  const canaries = [
    { name: 'Kaki fry', name_zh: 'カキフライ', cuisine: 'japanese', must: ['shellfish'], mustNot: [] },
    { name: 'Soy sauce chicken', name_zh: '豉油雞', cuisine: 'cantonese', must: ['chicken'], mustNot: ['soy'] },
    { name: 'Teriyaki chicken', name_zh: '照燒雞', cuisine: 'japanese', must: ['chicken'], mustNot: ['soy'] },
    { name: 'Mapo tofu', name_zh: '麻婆豆腐', cuisine: 'sichuan', must: ['soy'], mustNot: [] },
  ];
  for (const c of canaries) {
    const out = await enrichOff(c.name, c.name_zh, c.cuisine);
    const passMust = c.must.every(f => out.diet.includes(f as any));
    const passNot = c.mustNot.every(f => !out.diet.includes(f as any));
    console.log(`  ${passMust && passNot ? 'PASS' : 'FAIL'} ${c.name_zh}: [${out.diet}] (must:[${c.must}] mustNot:[${c.mustNot}]) ${out.ms}ms`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
