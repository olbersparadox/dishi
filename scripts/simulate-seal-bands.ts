// Seal band calibration — what each proposed option actually DOES to the real
// sealed history. Analysis only: this script changes nothing, it just replays
// the 36 real seals under each option so the choice is between outcomes rather
// than abstractions. See docs/rnd/seal-band-calibration.md for the diagnosis.
//
// Run: npx tsx scripts/simulate-seal-bands.ts
//
// HONEST LIMIT, read before trusting option (d)'s numbers: the taste vector and
// cuisine affinity AT SEAL TIME were never stored — only the resulting
// predicted_raw was. So (d) is recomputed against the CURRENT profile, which
// means it is a faithful comparison of formula-vs-formula under one fixed
// profile, NOT a replay of what would have been predicted back then. The
// reconstruction check below reports how closely the current-formula recompute
// reproduces each stored predicted_raw; where that drift is large (early, thin-
// profile rows) treat (d)'s per-row verdict as indicative, not exact.
import { DIMS, contentScore, type TasteVector, type DishVector } from '../src/lib/taste';
import { directionOf, outcomeOf, type Direction, type Outcome } from '../src/lib/seal';
import rows from './seal-rows.json';

// Live profile snapshot (owner account, 2026-07-24) — the only profile that has
// ever produced a seal.
const VECTOR: TasteVector = {
  raw: 0.711, rich: 0.3189856053876584, sour: -0.298, baked: 0.04444613934442576,
  chewy: 0.15713555591988546, fresh: 0.15538635355826078, fried: 0.04166666666666666,
  salty: 0.3534714204409596, spicy: 0.06333333333333334, sweet: -0.40639904571047175,
  umami: 0.8181614320584866, bitter: 0.027195118043269503, creamy: -0.08053273987181861,
  crispy: -0.040151937217285036, tender: 0.9215844629492492, braised: 0.6133809523809525,
  grilled: -0.026138158609291626, steamed: 0.5307892472005158,
};
const AFFINITY: Record<string, number> = {
  indian: -0.18, chinese: 0.16, italian: 0.07, sichuan: 0.07,
  western: 0.19, american: -0.1, japanese: 1, cantonese: 1,
};

type Row = {
  predicted_raw: number; actual_score: number; outcome: string;
  predicted_direction: string; engine_rating_count: number;
  cuisine: string | null; attributes: DishVector;
};
const DATA = rows as Row[];

/** contentScore with the divisor fixed: divide by the dims the dish ACTUALLY
 * reports, not by all 18. Floor of 4 so a 1-attribute dish can't be amplified
 * into a confident verdict off almost no evidence. */
function contentScoreFixed(taste: TasteVector, dish: DishVector, aff: Record<string, number>, cuisine?: string | null): number {
  let s = 0, present = 0;
  for (const dim of DIMS) {
    if (!(dim in dish)) continue;
    s += (taste[dim] ?? 0) * (dish[dim] - 0.5) * 2;
    present++;
  }
  s /= Math.max(4, present);
  if (cuisine) s += 0.3 * (aff[cuisine.toLowerCase()] ?? 0);
  return s;
}

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};

function report(label: string, predicted: Direction[], note = '') {
  const actual = DATA.map(r => directionOf(r.actual_score));
  const outcomes = predicted.map((p, i) => outcomeOf(p, actual[i]));
  const count = (xs: string[], v: string) => xs.filter(x => x === v).length;
  const bands: Direction[] = ['love', 'like', 'meh', 'dislike'];
  const n = DATA.length;

  console.log(`\n── ${label} ${note}`);
  console.log(`   predicted bands : ${bands.map(b => `${b} ${count(predicted, b)}`).join(' · ')}`);
  const unreachable = bands.filter(b => count(predicted, b) === 0);
  console.log(`   unreachable     : ${unreachable.length ? unreachable.join(', ') : 'none — all four bands used'}`);
  const outs: Outcome[] = ['hit', 'near', 'miss'];
  console.log(`   outcomes        : ${outs.map(o => `${o} ${count(outcomes, o)} (${pct(count(outcomes, o), n)})`).join(' · ')}`);
}

console.log('Seal band simulation — 36 real seals, owner account');
console.log('='.repeat(64));

const actualBands = DATA.map(r => directionOf(r.actual_score));
console.log(`\nACTUAL flick bands (what the person really said):`);
console.log(`   ${(['love', 'like', 'meh', 'dislike'] as Direction[])
  .map(b => `${b} ${actualBands.filter(x => x === b).length}`).join(' · ')}`);

// ── Reconstruction check — how much can we trust option (d)'s recompute? ──
const recomputed = DATA.map(r => contentScore(VECTOR, r.attributes, AFFINITY, r.cuisine));
const drift = recomputed.map((v, i) => Math.abs(v - DATA[i].predicted_raw));
console.log(`\nReconstruction drift (current formula, current profile vs stored predicted_raw):`);
console.log(`   median ${q(drift, 0.5).toFixed(4)} · p90 ${q(drift, 0.9).toFixed(4)} · max ${Math.max(...drift).toFixed(4)}`);
console.log(`   (drift is the cost of the profile having moved since each seal was written)`);

// ── Current behaviour ──
report('CURRENT (live today)', DATA.map(r => directionOf(r.predicted_raw)));

// ── (a) Fitted quantile edges on predicted_raw ──
const raws = DATA.map(r => r.predicted_raw);
const share = (b: Direction) => actualBands.filter(x => x === b).length / DATA.length;
const loveEdge = q(raws, 1 - share('love'));
const likeEdge = q(raws, 1 - share('love') - share('like'));
const mehEdge = q(raws, share('dislike'));
const bandA = (v: number): Direction =>
  v >= loveEdge ? 'love' : v >= likeEdge ? 'like' : v >= mehEdge ? 'meh' : 'dislike';
report('(a) FITTED EDGES on predicted_raw',
  raws.map(bandA),
  `\n   edges: love ≥ ${loveEdge.toFixed(4)} · like ≥ ${likeEdge.toFixed(4)} · meh ≥ ${mehEdge.toFixed(4)}`);

// ── (b) Normalize onto the flick scale, keep existing edges ──
const maxRaw = Math.max(...raws);
report('(b) NORMALIZED (raw / observed max), existing edges',
  raws.map(v => directionOf(v / maxRaw)),
  `\n   divisor: ${maxRaw.toFixed(4)} (the largest predicted_raw ever recorded)`);

// ── (c) Per-user adaptive quantile bands ──
report('(c) PER-USER quantile bands',
  raws.map(bandA),
  '\n   identical to (a) here: sealed_predictions contains exactly ONE user,\n   so "this user\'s quantiles" and "the global quantiles" are the same numbers');

// ── (d) Fix the divisor, keep existing edges ──
const fixed = DATA.map(r => contentScoreFixed(VECTOR, r.attributes, AFFINITY, r.cuisine));
report('(d) FIXED DIVISOR (÷ present dims, floor 4), existing edges',
  fixed.map(directionOf),
  `\n   range: ${Math.min(...fixed).toFixed(4)} … ${Math.max(...fixed).toFixed(4)}` +
  `  (was ${Math.min(...raws).toFixed(4)} … ${maxRaw.toFixed(4)})`);

// ── Where the dimension term actually sits under each formula ──
const dimNow = DATA.map(r => contentScore(VECTOR, r.attributes, {}, null));
const dimFixed = DATA.map(r => contentScoreFixed(VECTOR, r.attributes, {}, null));
console.log(`\n── Dimension term alone (cuisine bonus excluded)`);
console.log(`   current : ${Math.min(...dimNow).toFixed(4)} … ${Math.max(...dimNow).toFixed(4)}  mean ${(dimNow.reduce((a, b) => a + b, 0) / dimNow.length).toFixed(4)}`);
console.log(`   fixed   : ${Math.min(...dimFixed).toFixed(4)} … ${Math.max(...dimFixed).toFixed(4)}  mean ${(dimFixed.reduce((a, b) => a + b, 0) / dimFixed.length).toFixed(4)}`);
console.log(`   -> the cuisine bonus is 0.3 x affinity; compare that against the above`);
console.log(`      to see which term is actually deciding the verdict.\n`);

// ── The question that actually matters: when the person LOVED it, did the
// engine say so? That's the band the current formula can never reach, and the
// reason 24 of 36 outcomes are a lukewarm 'near'.
function recall(label: string, predicted: Direction[]) {
  const bands: Direction[] = ['love', 'like', 'meh', 'dislike'];
  console.log(`\n── recall by ACTUAL band — ${label}`);
  for (const b of bands) {
    const idx = DATA.map((r, i) => [directionOf(r.actual_score), i] as const).filter(([a]) => a === b).map(([, i]) => i);
    if (!idx.length) continue;
    const got = idx.filter(i => predicted[i] === b).length;
    console.log(`   actually ${b.padEnd(8)} n=${String(idx.length).padStart(2)}  called correctly: ${got}/${idx.length} (${pct(got, idx.length)})`);
  }
}
recall('CURRENT', DATA.map(r => directionOf(r.predicted_raw)));
recall('(a)/(c) fitted edges', raws.map(bandA));
recall('(b) normalized', raws.map(v => directionOf(v / maxRaw)));
recall('(d) fixed divisor', fixed.map(directionOf));
