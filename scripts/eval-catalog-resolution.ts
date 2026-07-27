/**
 * R&D Phase 1: does CATALOG RESOLUTION replace candidate generation?
 *
 * Phase 0 (docs/rnd/cross-venue-dish-phase0.md) proved pairwise adjudication
 * works (100% on held-out pairs, zero false merges) but left the real risk
 * unsolved: finding the pairs to ask about. N² adjudication is unaffordable,
 * and a string prefilter provably cannot surface the hardest true pair
 * (絲襪奶茶 / 港式奶茶 share ZERO characters).
 *
 * The proposal under test: skip retrieval entirely. Resolve each dish ONCE
 * against a canonical catalog; two dishes are the same iff they land on the
 * same id. O(N) classification instead of O(N²) matching, and no prefilter to
 * defeat.
 *
 * THREE MEASUREMENTS:
 *   1. COVERAGE   — what share of the LIVE corpus resolves to a catalog entry.
 *                   Low coverage = the catalog approach starves.
 *   2. PAIR AGREEMENT — on the SAME held-out pairs Phase 0 used, does routing
 *                   both sides through the catalog reproduce the verdicts?
 *                   This is the real test: it needs no retrieval at all.
 *   3. FALSE MERGES — two genuinely different dishes landing on one id. The
 *                   dangerous error; permanent history fusion.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/eval-catalog-resolution.ts
 */
import { createClient } from '@supabase/supabase-js';
import { callClaude, parseJsonResponse } from '../src/lib/openrouter';
import { CATALOG } from './hk-dish-catalog';
import { CASES } from './eval-cross-venue-dish';

const SYSTEM = `You map a dish name to an entry in a fixed catalog of common Hong Kong dishes.

The name may be Traditional Chinese, English, Japanese, a romanisation, a vision
model's guess, or carry qualifiers a catalog entry does not: 招牌/特色/精選 (house
special), 例牌/大/細 (portion), 日式/港式/星洲 (regional style), 生滾/白灼 (standard
method), 鮮/水晶/滑 (flourishes). Strip those and map to the underlying dish.

Map to the SAME entry when the plate is the same dish:
- a different language or romanisation of it
- a marketing, portion, style, method, or freshness qualifier on it
- a common misspelling of it

Map to DIFFERENT entries when the plate changes — a different protein, a
different carb vehicle, a different preparation, or a named dish vs the generic
category it belongs to.

Answer "none" when no entry is the same dish. "none" is CORRECT and expected for
anything the catalog does not cover — do NOT stretch to the nearest entry. A wrong
mapping permanently fuses two different dishes' rating histories; an honest "none"
costs nothing.

Respond with ONLY a JSON array, no prose, no fences, one object per input IN ORDER:
[{"i": <index>, "id": "<catalog id>" | "none", "confidence": 0.0-1.0}]`;

const catalogBlock = CATALOG.map(e => `${e.id} | ${e.zh} | ${e.en}`).join('\n');

type Resolution = { i: number; id: string; confidence: number };

/** Reasoning model: small batches, high ceiling (see Phase 0 script). */
const BATCH = 8;

async function resolve(names: string[]): Promise<Map<number, Resolution>> {
  const out = new Map<number, Resolution>();
  for (let start = 0; start < names.length; start += BATCH) {
    const slice = names.slice(start, start + BATCH);
    const user = [
      'CATALOG (id | 中文 | English):',
      catalogBlock,
      '',
      'Dish names to map:',
      ...slice.map((n, k) => `${start + k}. ${n}`),
    ].join('\n');
    const raw = await callClaude(SYSTEM, user, { maxTokens: 6000, expectJson: true });
    const parsed = parseJsonResponse<Resolution[]>(raw);
    if (!Array.isArray(parsed)) {
      console.error(`  batch @${start} unusable — unscored`);
      continue;
    }
    for (const r of parsed) if (r && typeof r.i === 'number') out.set(r.i, r);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return out;
}

const VALID = new Set(CATALOG.map(e => e.id));

(async () => {
  // ── 1. COVERAGE on the live corpus ─────────────────────────────────────
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: dishes } = await db.from('dishes').select('name, name_zh');
  const corpus = (dishes ?? []).map(d => [d.name_zh, d.name].filter(Boolean).join(' / '));

  console.log(`\n═══ 1. COVERAGE — ${corpus.length} live dishes vs ${CATALOG.length}-entry catalog ═══`);
  const covRes = await resolve(corpus);
  let mapped = 0, none = 0, invalid = 0;
  const unmapped: string[] = [];
  corpus.forEach((n, i) => {
    const r = covRes.get(i);
    if (!r) return;
    if (r.id === 'none') { none++; unmapped.push(n); }
    else if (!VALID.has(r.id)) { invalid++; unmapped.push(`${n}  [INVALID id ${r.id}]`); }
    else mapped++;
  });
  const scored = mapped + none + invalid;
  console.log(`  mapped to a catalog entry : ${mapped}/${scored}  (${((mapped / scored) * 100).toFixed(1)}%)`);
  console.log(`  honest "none"             : ${none}`);
  if (invalid) console.log(`  INVALID ids (hallucinated): ${invalid}`);
  if (unmapped.length) {
    console.log('  ── not covered (catalog gaps) ──');
    unmapped.forEach(u => console.log(`    ${u}`));
  }

  // ── 2 & 3. PAIR AGREEMENT + FALSE MERGES, no retrieval involved ────────
  console.log(`\n═══ 2. PAIR AGREEMENT — ${CASES.length} held-out pairs, routed through the catalog ═══`);
  const sides = CASES.flatMap(c => [c.a, c.b]);
  const pairRes = await resolve(sides);

  let correct = 0, falseMerge = 0, missedMerge = 0, undecidable = 0;
  const notes: string[] = [];

  CASES.forEach((c, i) => {
    const ra = pairRes.get(i * 2), rb = pairRes.get(i * 2 + 1);
    if (!ra || !rb) { undecidable++; return; }
    // A pair where either side is uncovered cannot be judged same/different by
    // the catalog at all — that is a COVERAGE failure, not a wrong answer.
    if (ra.id === 'none' || rb.id === 'none') {
      undecidable++;
      notes.push(`  uncovered   "${c.a}" (${ra.id}) / "${c.b}" (${rb.id}) — ${c.probes}`);
      return;
    }
    const catalogSaysSame = ra.id === rb.id;
    if (catalogSaysSame === c.same) correct++;
    else if (catalogSaysSame && !c.same) {
      falseMerge++;
      notes.push(`  FALSE MERGE "${c.a}" = "${c.b}"  both -> ${ra.id} — ${c.probes}`);
    } else {
      missedMerge++;
      notes.push(`  missed      "${c.a}" (${ra.id}) / "${c.b}" (${rb.id}) — ${c.probes}`);
    }
  });

  const decided = correct + falseMerge + missedMerge;
  console.log(`  decided by catalog : ${decided}/${CASES.length}`);
  console.log(`  correct            : ${correct}/${decided}  (${decided ? ((correct / decided) * 100).toFixed(1) : '0'}%)`);
  console.log(`  FALSE MERGES       : ${falseMerge}   <- the dangerous error`);
  console.log(`  missed merges      : ${missedMerge}   (harmless)`);
  console.log(`  undecidable        : ${undecidable}   (a coverage gap, not a wrong answer)`);
  if (notes.length) { console.log('  ── detail ──'); notes.forEach(n => console.log(n)); }

  console.log('\n═══ VERDICT ═══');
  console.log(`  Catalog covers ${((mapped / scored) * 100).toFixed(1)}% of the live corpus.`);
  console.log(`  Where it decides, it is ${decided ? ((correct / decided) * 100).toFixed(1) : '0'}% correct with ${falseMerge} false merges.`);
  console.log(`  Phase 0 pairwise baseline was 100% with 0 false merges — but needed the pairs handed to it.`);
})();
