/**
 * R&D: the owner's structural hypothesis (2026-07-27).
 *
 * Claim: a Chinese dish name decomposes as
 *     [key ingredient] + [cooking method] + [base/carb]
 * with two consequences worth testing separately:
 *
 *   A. TASTE — preference is readable from those slots ("lots of 炒 likes = into
 *      that method; beef over pork; rice over noodles"). The engine models
 *      METHOD already (6 of 18 dims) but has NO protein and NO base axis, and
 *      `ingredients` is extracted during enrichment then discarded (there is no
 *      ingredients column on `dishes`). So the signal is computed and dropped.
 *
 *   B. IDENTITY — two dishes are the same only if all three slots match. If so,
 *      a slot conflict can VETO a catalog merge, and an empty ingredient slot
 *      (炒飯 = [?] + 炒 + 飯) identifies a generic CATEGORY structurally instead
 *      of via a hand-maintained blocklist.
 *
 * This script tests both, and also tests the honest limit: many HK names are
 * NOT compositional (絲襪奶茶, 西多士, 菠蘿油, 楊枝甘露, 老婆餅), so `parseable`
 * is measured rather than assumed.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/eval-dish-decomposition.ts
 */
import { createClient } from '@supabase/supabase-js';
import { callClaude, parseJsonResponse } from '../src/lib/openrouter';
import { CASES } from './eval-cross-venue-dish';

const PROTEINS = ['beef', 'pork', 'chicken', 'duck_goose', 'fish', 'shellfish', 'egg', 'tofu_veg', 'mixed', 'none'] as const;
const METHODS = ['stir_fried', 'deep_fried', 'steamed', 'braised', 'roasted', 'grilled', 'boiled_soup', 'raw', 'baked', 'none'] as const;
const BASES = ['rice', 'noodle', 'congee', 'bread', 'pasta', 'dumpling_skin', 'none'] as const;

const SYSTEM = `You decompose a dish name into three slots. Hong Kong / Cantonese context.

  protein  — the KEY ingredient: ${PROTEINS.join(' | ')}
  method   — how it is cooked:   ${METHODS.join(' | ')}
  base     — the carb vehicle:   ${BASES.join(' | ')}

Rules:
- Read HK carb shorthand: 米=rice vermicelli(noodle), 河=flat rice noodle(noodle),
  意=spaghetti(pasta), 通=macaroni(pasta), 丁=instant noodle(noodle). 飯=rice,
  粥=congee, 麵/粉=noodle, 包=bread.
- "none" is a real answer. A dish with no carb (燒鵝) has base "none". A dish whose
  key ingredient is unspecified (炒飯 — just "fried rice") has protein "none".
- "mixed" only for genuinely assorted items (拼盤, 車仔麵).
- 炒 = stir_fried. 炸 = deep_fried. 蒸 = steamed. 燜/炆/滷 = braised. 燒/烤 = roasted.

ALSO return "parseable": true only if the name TRANSPARENTLY names its parts.
Set it false for idiomatic or poetic names whose parts cannot be read off the
string — 絲襪奶茶, 西多士, 菠蘿油, 楊枝甘露, 老婆餅, 螞蟻上樹, 佛跳牆 — even if you
happen to know the dish. This measures how far structure alone can carry.

Respond with ONLY a JSON array, no prose, no fences, one object per input IN ORDER:
[{"i": <index>, "protein": "...", "method": "...", "base": "...", "parseable": true|false}]`;

type Parse = { i: number; protein: string; method: string; base: string; parseable: boolean };

/** 16000, not 6000: qwen3.7-plus is a REASONING model and this enum-heavy prompt
 *  exhausted a 6k budget before emitting content — every batch came back
 *  unparseable. Measured: 6000 -> null, 16000 -> clean JSON. */
// BATCH=2 measured, not guessed: at 6 nearly every batch exhausted the budget
// before emitting content (all 3 callClaude retries failed); at 3 it parsed
// cleanly in isolation. Reasoning cost scales with items per call, so keep it
// small — this task has no cross-item dependency, so batching buys only
// round-trips.
const BATCH = 2;
const MAX_TOKENS = 16000;

async function parseNames(names: string[]): Promise<Map<number, Parse>> {
  const out = new Map<number, Parse>();
  for (let s = 0; s < names.length; s += BATCH) {
    const slice = names.slice(s, s + BATCH);
    const user = slice.map((n, k) => `${s + k}. ${n}`).join('\n');
    const raw = await callClaude(SYSTEM, `Dish names:\n${user}`, { maxTokens: MAX_TOKENS, expectJson: true });
    const parsed = parseJsonResponse<Parse[]>(raw);
    if (!Array.isArray(parsed)) { console.error(`  batch @${s} unusable`); continue; }
    for (const p of parsed) if (p && typeof p.i === 'number') out.set(p.i, p);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return out;
}

/** Mean + n per slot value, so a category with 2 ratings can't masquerade as a finding. */
function report(label: string, rows: { key: string; score: number }[]) {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    if (!by.has(r.key)) by.set(r.key, []);
    by.get(r.key)!.push(r.score);
  }
  const stats = Array.from(by.entries())
    .map(([k, xs]) => ({ k, n: xs.length, mean: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.mean - a.mean);
  console.log(`\n  ── ${label} ──`);
  for (const s of stats) {
    const flag = s.n < 5 ? '  ⚠ too few to mean anything' : '';
    const bar = '█'.repeat(Math.max(0, Math.round((s.mean + 1) * 10)));
    console.log(`    ${s.k.padEnd(14)} n=${String(s.n).padStart(3)}  mean=${s.mean.toFixed(3).padStart(7)}  ${bar}${flag}`);
  }
  const solid = stats.filter(s => s.n >= 5);
  if (solid.length >= 2) {
    const spread = solid[0].mean - solid[solid.length - 1].mean;
    console.log(`    spread across categories with n>=5: ${spread.toFixed(3)}`);
  }
}

(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (process.env.SECTION !== 'B') {
  // ══ SECTION A — is protein/base preference visible in the real ratings? ══
  const { data: rated } = await db
    .from('ratings')
    .select('score, dishes!inner(name_zh, name)')
    .not('score', 'is', null);

  const rows = (rated ?? []).map(r => {
    const d = r.dishes as unknown as { name_zh: string | null; name: string | null };
    return { label: [d.name_zh, d.name].filter(Boolean).join(' / '), score: Number(r.score) };
  }).filter(r => r.label);

  console.log(`\n═══ SECTION A — protein / method / base preference over ${rows.length} real ratings ═══`);
  const parses = await parseNames(rows.map(r => r.label));

  const proteinRows: { key: string; score: number }[] = [];
  const methodRows: { key: string; score: number }[] = [];
  const baseRows: { key: string; score: number }[] = [];
  let parseableCount = 0;

  rows.forEach((r, i) => {
    const p = parses.get(i);
    if (!p) return;
    if (p.parseable) parseableCount++;
    if (p.protein && p.protein !== 'none') proteinRows.push({ key: p.protein, score: r.score });
    if (p.method && p.method !== 'none') methodRows.push({ key: p.method, score: r.score });
    if (p.base && p.base !== 'none') baseRows.push({ key: p.base, score: r.score });
  });

  console.log(`\n  transparently compositional names: ${parseableCount}/${parses.size}  (${((parseableCount / Math.max(1, parses.size)) * 100).toFixed(0)}%)`);
  report('PROTEIN — mean rating', proteinRows);
  report('METHOD  — mean rating (engine already models this)', methodRows);
  report('BASE    — mean rating', baseRows);
  console.log('\n  NOTE: one palate, ~50 ratings. Read spreads as "worth pursuing / not",');
  console.log('  never as an established preference. n<5 categories are noise.');
  }

  // ══ SECTION B — can a slot conflict VETO a wrong merge? ══
  console.log(`\n═══ SECTION B — structural veto on the ${CASES.length} held-out identity pairs ═══`);
  const sides = CASES.flatMap(c => [c.a, c.b]);
  const sideParses = await parseNames(sides);

  let vetoCorrect = 0, vetoWrong = 0, noVeto = 0, unparseable = 0;
  const wrongVetoes: string[] = [];
  const goodVetoes: string[] = [];

  CASES.forEach((c, i) => {
    const a = sideParses.get(i * 2), b = sideParses.get(i * 2 + 1);
    if (!a || !b) return;
    if (!a.parseable || !b.parseable) { unparseable++; return; }
    const conflict = a.protein !== b.protein || a.method !== b.method || a.base !== b.base;
    if (!conflict) { noVeto++; return; }
    if (!c.same) { vetoCorrect++; goodVetoes.push(`  ✓ vetoed "${c.a}" = "${c.b}"  [${a.protein}/${a.method}/${a.base}] vs [${b.protein}/${b.method}/${b.base}]`); }
    else { vetoWrong++; wrongVetoes.push(`  ✗ WOULD BLOCK A TRUE MATCH "${c.a}" = "${c.b}"  [${a.protein}/${a.method}/${a.base}] vs [${b.protein}/${b.method}/${b.base}]`); }
  });

  console.log(`  pairs where both sides parse   : ${vetoCorrect + vetoWrong + noVeto}`);
  console.log(`  at least one side unparseable  : ${unparseable}  (structure cannot judge these)`);
  console.log(`  slot conflict, correctly blocks: ${vetoCorrect}`);
  console.log(`  slot conflict, WRONGLY blocks  : ${vetoWrong}   <- the cost of the veto`);
  console.log(`  no conflict (veto stays silent): ${noVeto}`);
  if (goodVetoes.length) { console.log('  ── correct vetoes ──'); goodVetoes.forEach(l => console.log(l)); }
  if (wrongVetoes.length) { console.log('  ── WRONG vetoes ──'); wrongVetoes.forEach(l => console.log(l)); }
})();
