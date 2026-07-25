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
// The fixture is real user data and is NOT committed (this repo is public).
// Build it first:
//   set -a; . ./.env.local; set +a
//   SIM_USER_ID=<uuid> npx tsx scripts/build-rating-fixture.ts
//   npx tsx scripts/simulate-scale-calibration.ts
import {
  DIMS, emptyTaste, updateTaste, bumpEvidence, updateCuisineAffinity, contentScore,
  type TasteVector, type EvidenceMap, type DishVector,
} from '../src/lib/taste';
import history from './rating-history.json';

type Row = { s: number; c: string | null; a: DishVector };
const H = history as unknown as Row[];

/** The person's own neutral point, shrunk toward a prior so a brand-new profile
 * behaves exactly as today and calibration only kicks in as evidence arrives.
 * Median, not mean: one furious −0.9 shouldn't move where "ordinary" sits. */
const PRIOR_CENTER = 0;
function centerAfter(scores: number[], k = 5): number {
  if (!scores.length) return PRIOR_CENTER;
  const s = [...scores].sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return (k * PRIOR_CENTER + s.length * mid) / (k + s.length);
}

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
    const centre = centred ? centerAfter(seen) : 0;
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
console.log();
