// Self-calibrating rating scale — does centring a person's ratings on THEIR OWN
// neutral point produce a better taste vector than taking the raw score?
//
// The problem (owner, 2026-07-24): "Everyone's scale is different. To me 一般般
// is nothing to remember about... but when you want to ENJOY a meal for
// pleasure, it's negative." Hardcoding a new value for 一般般 would just bake
// one person's scale into everyone's palate. The algorithm should tune itself
// to the user's own rating behaviour instead.
//
// Live evidence for why it matters: 56% of this person's 41 ratings are the
// SAME value (0.35 幾好食), and 86% are positive. Because updateTaste multiplies
// by the raw score, every dim a dish teaches drifts positive — the engine
// learns "you like everything", which is exactly the opposite of a
// discriminating palate.
//
// Method: replay the real history through the REAL shipped updateTaste both
// ways, then score both vectors on pairwise ranking accuracy — does the vector
// order dishes the way the person actually rated them? Same ground-truth metric
// as scripts/simulate-duels.ts and simulate-seal-bands.ts.
// Both fixtures are real user data and are NOT committed (this repo is public).
// Build them first:
//   set -a; . ./.env.local; set +a
//   SIM_USER_ID=<uuid> npx tsx scripts/build-rating-fixture.ts
//   SIM_USER_ID=<uuid> npx tsx scripts/build-seal-fixture.ts
//   npx tsx scripts/simulate-scale-calibration.ts
import {
  DIMS, emptyTaste, updateTaste, bumpEvidence, updateCuisineAffinity, contentScore,
  neutralCenter,
  type TasteVector, type EvidenceMap, type DishVector,
} from '../src/lib/taste';
import { directionOf, outcomeOf } from '../src/lib/seal';
import {
  confidenceInputsFrom, evidenceConfidence, confidenceTier, exportUnlocked,
} from '../src/lib/tasteExport';
import history from './rating-history.json';
import sealRows from './seal-rows.json';

type Row = { s: number; c: string | null; a: DishVector };
const H = history as unknown as Row[];

type SealRow = { actual_score: number; cuisine: string | null; attributes: DishVector };
const SEALS = (sealRows as unknown as SealRow[]).filter(s => typeof s.actual_score === 'number');

// neutralCenter is imported from the SHIPPED engine, not reimplemented here — a
// simulation that tunes a private copy of the formula proves nothing about what
// actually runs in production.

/** Replay the whole history. `centred` switches between the shipped behaviour
 * (raw score) and scoring relative to the person's running neutral point. */
function replay(centred: boolean) {
  let taste: TasteVector = emptyTaste();
  let evidence: EvidenceMap = {};
  let affinity: Record<string, number> = {};
  const seen: number[] = [];
  const centersUsed: number[] = [];
  for (const r of H) {
    // Centre from history BEFORE this rating — no peeking at the value being learned.
    const centre = centred ? neutralCenter(seen) : 0;
    centersUsed.push(centre);
    const effective = r.s - centre;
    taste = updateTaste(taste, evidence, r.a, effective);
    evidence = bumpEvidence(evidence, r.a);
    affinity = updateCuisineAffinity(affinity, r.c, effective);
    seen.push(r.s);
  }
  return { taste, evidence, affinity, centersUsed };
}

function pairwiseAccuracy(taste: TasteVector, affinity: Record<string, number>, within: boolean) {
  let correct = 0, total = 0;
  for (let i = 0; i < H.length; i++) {
    for (let j = i + 1; j < H.length; j++) {
      if (H[i].s === H[j].s) continue;
      if (within && H[i].c !== H[j].c) continue;
      const si = contentScore(taste, H[i].a, affinity, H[i].c);
      const sj = contentScore(taste, H[j].a, affinity, H[j].c);
      if (Math.sign(si - sj) === Math.sign(H[i].s - H[j].s)) correct++;
      total++;
    }
  }
  return { acc: total ? (100 * correct) / total : 0, n: total };
}

const now = replay(false);
const cal = replay(true);

console.log('Self-calibrating rating scale — replayed over 41 real ratings');
console.log('='.repeat(66));

const scores = H.map(r => r.s);
const sorted = [...scores].sort((a, b) => a - b);
console.log(`\nThis palate's rating behaviour:`);
console.log(`   median ${sorted[Math.floor(sorted.length / 2)]}  mean ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)}`);
console.log(`   share positive: ${((100 * scores.filter(s => s > 0).length) / scores.length).toFixed(1)}%`);
console.log(`   final learned centre: ${cal.centersUsed[cal.centersUsed.length - 1].toFixed(4)}`);

console.log(`\nWhat each flick TEACHES, once calibrated (centre ${cal.centersUsed[cal.centersUsed.length - 1].toFixed(3)}):`);
const c = cal.centersUsed[cal.centersUsed.length - 1];
for (const [label, v] of [['掃晒', 1], ['好鍾意', 0.6], ['幾好食', 0.35], ['一般般', 0.1], ['唔啱我', -0.5], ['唔會再食', -0.9]] as const) {
  const eff = v - c;
  console.log(`   ${label.padEnd(9)} ${String(v).padStart(5)}  ->  ${eff >= 0 ? '+' : ''}${eff.toFixed(3)}  ${eff > 0.02 ? 'positive' : eff < -0.02 ? 'NEGATIVE' : 'neutral'}`);
}

console.log(`\nHow polarised the learned palate is (|value| per taught dim):`);
for (const [label, r] of [['current', now], ['calibrated', cal]] as const) {
  const vals = DIMS.map(d => r.taste[d] ?? 0);
  const pos = vals.filter(v => v > 0.15).length, neg = vals.filter(v => v < -0.15).length;
  const mean = vals.reduce((a, b) => a + Math.abs(b), 0) / vals.length;
  console.log(`   ${label.padEnd(11)} clear likes ${pos}  clear dislikes ${neg}  mean |strength| ${mean.toFixed(3)}`);
}

console.log(`\nDoes it predict this person's real ratings better?`);
for (const [label, within] of [['ALL pairs', false], ['WITHIN-CUISINE', true]] as const) {
  const a = pairwiseAccuracy(now.taste, now.affinity, within);
  const b = pairwiseAccuracy(cal.taste, cal.affinity, within);
  const d = b.acc - a.acc;
  console.log(`   ${label.padEnd(15)} (n=${String(a.n).padStart(3)})  current ${a.acc.toFixed(1)}%  ->  calibrated ${b.acc.toFixed(1)}%   (${d >= 0 ? '+' : ''}${d.toFixed(1)}pp)`);
}

// ── Blast radius ──────────────────────────────────────────────────────────────
// Centring shrinks BOTH the vector and cuisine affinity toward zero, and both
// feed contentScore — which is what the seal bands and the export gate read. The
// divisor fix in this same batch was wrong as first specified and only the
// blast-radius check caught it, so anything downstream of contentScore gets
// checked here before shipping, not after.

console.log(`\nSEAL BANDS — does centring re-close the band the divisor fix just opened?`);
// Same honest limit as scripts/simulate-seal-bands.ts: the seal-time profile was
// never stored, so both columns score all 36 seals against one END-STATE profile.
// That makes this a faithful profile-vs-profile comparison, NOT a replay of what
// would have been predicted at the time.
// The third column is the candidate FIX, not a variant of the engine: a vector
// trained on centred scores predicts how far from YOUR OWN NORMAL a dish lands,
// so mapping it back onto the flick scale the seal is judged against means adding
// your normal back. That is the exact inverse of the learning transform — not a
// refitted band edge, which on 36 seals from one palate would be overfitting.
const CENTRE = cal.centersUsed[cal.centersUsed.length - 1];
for (const [label, r, offset] of [
  ['current', now, 0], ['calibrated', cal, 0], ['calibrated+centre', cal, CENTRE],
] as const) {
  const calls: Record<string, number> = { love: 0, like: 0, meh: 0, dislike: 0 };
  const reachable: Record<string, { called: number; real: number }> = {};
  let hit = 0, near = 0, miss = 0;
  for (const s of SEALS) {
    const raw = contentScore(r.taste, s.attributes, r.affinity, s.cuisine) + offset;
    const predicted = directionOf(raw);
    const actual = directionOf(s.actual_score); // RAW flick — the seal judges the flick
    calls[predicted]++;
    reachable[actual] ??= { called: 0, real: 0 };
    reachable[actual].real++;
    if (predicted === actual) reachable[actual].called++;
    const o = outcomeOf(predicted, actual);
    if (o === 'hit') hit++; else if (o === 'near') near++; else miss++;
  }
  console.log(`   ${label.padEnd(11)} hit ${String(hit).padStart(2)}  near ${String(near).padStart(2)}  miss ${String(miss).padStart(2)}   ` +
    `calls: ${(['love', 'like', 'meh', 'dislike'] as const).map(d => `${d} ${calls[d]}`).join(' · ')}`);
  console.log(`   ${' '.repeat(11)} correctly called, by real band: ` +
    (['love', 'like', 'meh', 'dislike'] as const)
      .filter(d => reachable[d]).map(d => `${d} ${reachable[d].called}/${reachable[d].real}`).join(' · '));
  // The band edges sit at -0.15 / 0.15 / 0.5. If the whole predicted distribution
  // is narrower than one band, NO offset can fix the banding — it just slides a
  // constant from one band to another, and a constant is not a prediction.
  const raws = SEALS.map(s => contentScore(r.taste, s.attributes, r.affinity, s.cuisine) + offset).sort((a, b) => a - b);
  console.log(`   ${' '.repeat(11)} predicted_raw spread: min ${raws[0].toFixed(3)}  ` +
    `median ${raws[Math.floor(raws.length / 2)].toFixed(3)}  max ${raws[raws.length - 1].toFixed(3)}  ` +
    `(width ${(raws[raws.length - 1] - raws[0]).toFixed(3)} vs band width 0.35)`);
}

console.log(`\nEXPORT GATE — centring pulls affinity toward 0, and the export counts`);
console.log(`cuisines with affinity > 0. Does anyone lose ground they already had?`);
for (const [label, r] of [['current', now], ['calibrated', cal]] as const) {
  const ci = confidenceInputsFrom(r.taste, r.affinity, H.length);
  const conf = evidenceConfidence(ci);
  const cuisines = Object.entries(r.affinity).filter(([, v]) => v > 0).map(([c]) => c);
  console.log(`   ${label.padEnd(11)} dims ${String(ci.exploredDimCount).padStart(2)}/18  cuisines>0 ${String(ci.distinctCuisines).padStart(2)}/${Object.keys(r.affinity).length}  ` +
    `confidence ${conf.toFixed(3)} (${confidenceTier(conf)})  unlocked ${exportUnlocked(conf) ? 'YES' : 'no'}`);
  console.log(`   ${' '.repeat(11)} exported cuisines: ${cuisines.join(', ') || '(none)'}`);
}
console.log();
