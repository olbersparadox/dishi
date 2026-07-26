// Seal bands, take two: can a PER-USER band scheme survive the calibrated scale?
//
// The problem (docs/rnd/seal-band-calibration.md §11): the self-calibrating
// rating scale shrank contentScore's spread to ~0.26, which is narrower than a
// single band of directionOf's fixed edges (-0.15/0.15/0.5, so 0.35 wide). Fixed
// absolute thresholds cannot carve a distribution thinner than one band — every
// prediction collapses into whichever band the range happens to sit in. Hits fell
// 17 -> 5. Adding a constant offset back only slides the collapse to a different
// band (36/36 called `like`).
//
// The candidate fix: stop asking "what absolute score is this?" and ask "where
// does this dish sit in YOUR range?" — the same self-calibrating principle
// already applied to the rating scale, one layer up.
//
// METHOD — quantile mapping, not fitted edges. At seal time we know two
// distributions for this person: what the engine PREDICTS across the dishes they
// have rated, and what they ACTUALLY flick. Map a raw prediction to its
// percentile in the first, then read the flick value at that same percentile in
// the second, then band THAT with the existing directionOf. Nothing is fitted to
// the seal outcomes — the mapping is determined entirely by the two
// distributions, so it cannot overfit the 36 rows the way a hand-picked edge
// would (§9c's objection to tuning `dislike` on two points).
//
// THE BAR THIS MUST CLEAR — read before believing any hit count. A seal that
// always says the same thing scores well when one band dominates: on this palate
// 20 of 36 real outcomes are `like`, so a constant "like" predictor gets 20 hits
// while making no claim at all. §11 already caught that trap once. So the
// baseline here is not the broken engine, it is the CONSTANT predictor, and a
// scheme only earns its place by beating it while actually spreading its calls.
//
// Run: npx tsx scripts/simulate-seal-percentile-bands.ts
// Needs scripts/rating-history.json (gitignored real data — build it first with
// scripts/build-rating-fixture.ts; see simulate-scale-calibration.ts's header).
import {
  emptyTaste, updateTaste, bumpEvidence, updateCuisineAffinity, contentScore,
  neutralCenter,
  type TasteVector, type EvidenceMap, type DishVector,
} from '../src/lib/taste';
import { directionOf, outcomeOf, type Direction } from '../src/lib/seal';
import history from './rating-history.json';
import sealRows from './seal-rows.json';

type Row = { s: number; c: string | null; a: DishVector };
const H = history as unknown as Row[];
type SealRow = { actual_score: number; cuisine: string | null; attributes: DishVector };
const SEALS = (sealRows as unknown as SealRow[]).filter(s => typeof s.actual_score === 'number');

const BANDS: Direction[] = ['dislike', 'meh', 'like', 'love'];

// ── the engine, replayed exactly as it ships ──────────────────────────────────
/** Replay the real history through the REAL shipped functions (calibration on,
 * which is what production runs now) to get the profile the seal would use. */
function replayProfile() {
  let taste: TasteVector = emptyTaste();
  let evidence: EvidenceMap = {};
  let affinity: Record<string, number> = {};
  const seen: number[] = [];
  for (const r of H) {
    const learned = r.s - neutralCenter(seen);
    taste = updateTaste(taste, evidence, r.a, learned);
    evidence = bumpEvidence(evidence, r.a);
    affinity = updateCuisineAffinity(affinity, r.c, learned);
    seen.push(r.s);
  }
  return { taste, affinity };
}

// ── quantile machinery ────────────────────────────────────────────────────────
/** Where `x` sits inside `dist`, as a 0..1 fraction. Midpoint rule on ties so a
 * value equal to several others lands in the middle of them rather than at an
 * arbitrary end. */
function percentileOf(x: number, dist: number[]): number {
  if (!dist.length) return 0.5;
  let below = 0, equal = 0;
  for (const v of dist) { if (v < x) below++; else if (v === x) equal++; }
  return (below + equal / 2) / dist.length;
}

/** The value at fraction `p` of `sorted`, linearly interpolated. */
function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, p * (sorted.length - 1)));
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Map a raw prediction onto the person's own flick scale, then band it.
 * predictedDist: what the engine scores across dishes this person has rated.
 * actualDist:    what this person actually flicks.
 */
function bandByQuantile(raw: number, predictedDist: number[], actualSorted: number[]): Direction {
  return directionOf(quantile(actualSorted, percentileOf(raw, predictedDist)));
}

// ── scoring a scheme ──────────────────────────────────────────────────────────
type Scheme = { label: string; call: (raw: number) => Direction };

function score(scheme: Scheme, raws: number[], actuals: Direction[]) {
  let hit = 0, near = 0, miss = 0;
  const calls: Record<string, number> = { love: 0, like: 0, meh: 0, dislike: 0 };
  const byBand: Record<string, { called: number; real: number }> = {};
  raws.forEach((raw, i) => {
    const predicted = scheme.call(raw);
    const actual = actuals[i];
    calls[predicted]++;
    byBand[actual] ??= { called: 0, real: 0 };
    byBand[actual].real++;
    if (predicted === actual) byBand[actual].called++;
    const o = outcomeOf(predicted, actual);
    if (o === 'hit') hit++; else if (o === 'near') near++; else miss++;
  });
  const distinct = BANDS.filter(b => calls[b] > 0).length;
  return { hit, near, miss, calls, byBand, distinct };
}

function report(name: string, s: ReturnType<typeof score>, n: number) {
  console.log(`  ${name.padEnd(26)} hit ${String(s.hit).padStart(2)}/${n} (${((100 * s.hit) / n).toFixed(0).padStart(2)}%)  near ${String(s.near).padStart(2)}  miss ${String(s.miss).padStart(2)}   bands used ${s.distinct}/4`);
  console.log(`  ${' '.repeat(26)} calls: ${BANDS.map(b => `${b} ${s.calls[b]}`).join(' · ')}`);
  console.log(`  ${' '.repeat(26)} correct by real band: ${BANDS.filter(b => s.byBand[b]).map(b => `${b} ${s.byBand[b].called}/${s.byBand[b].real}`).join(' · ')}`);
}

// ── the real palate ───────────────────────────────────────────────────────────
const { taste, affinity } = replayProfile();

// What the engine predicts across the dishes this person has RATED. This is the
// distribution the percentile is taken against, and it is computable at seal
// time from data already on hand — no stored state, no migration, and it can
// never drift out of sync with the scoring version, because it is recomputed
// from the live profile every time.
const predictedDist = H.map(r => contentScore(taste, r.a, affinity, r.c));
const actualSorted = [...H.map(r => r.s)].sort((a, b) => a - b);

const raws = SEALS.map(s => contentScore(taste, s.attributes, affinity, s.cuisine));
const actuals = SEALS.map(s => directionOf(s.actual_score));
const N = SEALS.length;

// The band that would win by always guessing it — the honest floor.
const tally: Record<string, number> = {};
for (const a of actuals) tally[a] = (tally[a] ?? 0) + 1;
const modal = BANDS.reduce((best, b) => (tally[b] ?? 0) > (tally[best] ?? 0) ? b : best, BANDS[0]);

console.log('Seal bands under the calibrated scale — 36 real seals');
console.log('='.repeat(72));
console.log(`\nWhat actually happened: ${BANDS.map(b => `${b} ${tally[b] ?? 0}`).join(' · ')}`);
console.log(`Predicted-score spread: ${Math.min(...raws).toFixed(3)} → ${Math.max(...raws).toFixed(3)} (width ${(Math.max(...raws) - Math.min(...raws)).toFixed(3)}; one fixed band is 0.35 wide)`);

console.log(`\nSCHEMES`);
report('fixed edges (shipped)', score({ label: '', call: directionOf }, raws, actuals), N);
report(`constant "${modal}" (baseline)`, score({ label: '', call: () => modal }, raws, actuals), N);
report('quantile-mapped (per-user)', score({ label: '', call: r => bandByQuantile(r, predictedDist, actualSorted) }, raws, actuals), N);

// ── does it generalise across rating BEHAVIOURS? ──────────────────────────────
// The one question more testers would have answered, answered by simulation
// instead: re-label this palate's flicks onto other rating styles, keeping the
// ORDER (so the engine's real discriminating power is preserved) and changing
// only how the person expresses it. If quantile mapping only works for a
// 95%-positive rater, it is not a general fix.
console.log(`\nGENERALISATION — same dishes, same engine, different rating STYLES`);
console.log(`(actual flicks re-expressed on each archetype's scale, order preserved)`);

const FLICKS = [-0.9, -0.5, 0.1, 0.35, 0.6, 1.0];
const ARCHETYPES: { name: string; weights: number[] }[] = [
  // how often this style uses each flick, lowest → highest
  { name: 'generous (real)', weights: [1, 1, 2, 20, 8, 4] },
  { name: 'harsh', weights: [4, 8, 14, 6, 3, 1] },
  { name: 'discriminating', weights: [3, 5, 7, 8, 7, 6] },
  { name: 'one-note', weights: [0, 1, 2, 30, 2, 1] },
];

for (const arch of ARCHETYPES) {
  // Build the archetype's flick pool, then assign flicks to seals BY RANK of the
  // real outcome — a dish this person really liked more still gets the higher
  // flick, so only the expression changes, never the underlying preference.
  const pool: number[] = [];
  arch.weights.forEach((w, i) => { for (let k = 0; k < w; k++) pool.push(FLICKS[i]); });
  pool.sort((a, b) => a - b);

  const order = SEALS.map((s, i) => ({ i, v: s.actual_score })).sort((a, b) => a.v - b.v);
  const archActual: Direction[] = new Array(N);
  order.forEach((o, rank) => {
    archActual[o.i] = directionOf(pool[Math.min(pool.length - 1, Math.round((rank / Math.max(1, N - 1)) * (pool.length - 1)))]);
  });

  // The archetype's own rating history, same re-expression, for its distributions.
  const histOrder = H.map((r, i) => ({ i, v: r.s })).sort((a, b) => a.v - b.v);
  const archScores = new Array<number>(H.length);
  histOrder.forEach((o, rank) => {
    archScores[o.i] = pool[Math.min(pool.length - 1, Math.round((rank / Math.max(1, H.length - 1)) * (pool.length - 1)))];
  });
  const archActualSorted = [...archScores].sort((a, b) => a - b);

  const t: Record<string, number> = {};
  for (const a of archActual) t[a] = (t[a] ?? 0) + 1;
  const archModal = BANDS.reduce((best, b) => (t[b] ?? 0) > (t[best] ?? 0) ? b : best, BANDS[0]);

  const fixed = score({ label: '', call: directionOf }, raws, archActual);
  const constant = score({ label: '', call: () => archModal }, raws, archActual);
  const quant = score({ label: '', call: r => bandByQuantile(r, predictedDist, archActualSorted) }, raws, archActual);

  const verdict = quant.hit > constant.hit ? 'BEATS baseline' : quant.hit === constant.hit ? 'ties baseline' : 'LOSES to baseline';
  console.log(`\n  ${arch.name}  (real bands: ${BANDS.map(b => `${b} ${t[b] ?? 0}`).join(' · ')})`);
  console.log(`     fixed ${String(fixed.hit).padStart(2)}/${N} (${fixed.distinct} bands)   constant-${archModal} ${String(constant.hit).padStart(2)}/${N}   quantile ${String(quant.hit).padStart(2)}/${N} (${quant.distinct} bands)   → ${verdict}`);
}

// ── how much history does the mapping actually need? ──────────────────────────
// Quantile mapping reads two distributions, so it is only as good as the history
// behind them. This decides the warm-up gate: below it, fall back to the fixed
// edges (which are wrong but at least stable), above it use the person's own
// range. Sweep the amount of history available and watch where it stabilises.
console.log(`WARM-UP — hits when only the first k ratings are available to the mapping`);
console.log(`  (SEAL_GATE is 5, so a seal can exist from k=5 onward)`);
console.log(`   k    quantile   vs constant   bands used`);
for (const k of [5, 8, 10, 12, 15, 20, 25, 30, H.length]) {
  const hist = H.slice(0, k);
  const pDist = hist.map(r => contentScore(taste, r.a, affinity, r.c));
  const aSorted = [...hist.map(r => r.s)].sort((a, b) => a - b);
  const q = score({ label: '', call: r => bandByQuantile(r, pDist, aSorted) }, raws, actuals);
  const delta = q.hit - 20; // 20 = constant-"like" baseline on this palate
  console.log(`  ${String(k).padStart(2)}     ${String(q.hit).padStart(2)}/${N}       ${delta >= 0 ? '+' : ''}${delta}         ${q.distinct}/4`);
}

console.log();
