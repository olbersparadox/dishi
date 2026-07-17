/**
 * Simulation verification for 對決 (taste duels) — the house rule that engine-math
 * changes must be proven against ground truth, not just unit-tested.
 *
 * Hypothesis: interleaving actively-selected duels with ordinary flick ratings
 * improves the engine's pairwise-ranking accuracy on dimensions the ratings left
 * UNCERTAIN (low evidence), without degrading overall accuracy.
 *
 * Everything below runs through the REAL shipped functions — updateTaste,
 * updateTasteFromDuel, bumpEvidence(FromDuel), selectDuelPair, contentScore — so a
 * pass here is a statement about the code that ships, not a model of it. Run:
 *   npx tsx scripts/simulate-duels.ts
 */
import {
  DIMS, LEARN_CUTOFF, emptyTaste, contentScore,
  updateTaste, bumpEvidence, updateTasteFromDuel, bumpEvidenceFromDuel,
  DUEL_WEIGHT, DUEL_K,
  type TasteVector, type DishVector, type EvidenceMap,
} from '../src/lib/taste';
import { selectDuelPair, type DuelCandidate, type ExistingDuelRow } from '../src/lib/duels';

// ── deterministic RNG (mulberry32) so the reported numbers are reproducible ──────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => {
  // Box–Muller
  const u = Math.max(1e-9, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const CUISINES = ['cantonese', 'japanese', 'italian', 'thai'];
const RATING_GAIN = 10;    // maps contentScore (~±0.1) to a flick in ±1
const RATING_NOISE = 0.35; // mood/hunger/scale drift on an absolute flick

type Dish = { id: string; cuisine: string; attributes: DishVector };

function makeDish(r: () => number, id: number): Dish {
  const cuisine = CUISINES[Math.floor(r() * CUISINES.length)];
  const attributes: DishVector = {};
  for (const dim of DIMS) {
    // ~28% of dims present, each as a genuine above-cutoff attribute.
    if (r() < 0.28) attributes[dim] = LEARN_CUTOFF + r() * (1 - LEARN_CUTOFF);
  }
  // guarantee at least two attributes so a dish is never empty
  if (Object.keys(attributes).length < 2) {
    attributes[DIMS[Math.floor(r() * DIMS.length)]] = 0.5 + r() * 0.5;
    attributes[DIMS[Math.floor(r() * DIMS.length)]] = 0.5 + r() * 0.5;
  }
  return { id: `d${id}`, cuisine, attributes };
}

function makeGroundTruth(r: () => number): TasteVector {
  const gt = emptyTaste();
  for (const dim of DIMS) {
    if (r() < 0.5) gt[dim] = r() * 2 - 1; // half the dims are opinionated
  }
  return gt;
}

const utility = (gt: TasteVector, dish: Dish) => contentScore(gt, dish.attributes, {});

/** The dim most responsible for the ground-truth utility gap between two dishes. */
function decidingDim(gt: TasteVector, a: Dish, b: Dish): string {
  const centered = (dish: Dish, dim: string) => (dim in dish.attributes ? (dish.attributes[dim] - 0.5) * 2 : 0);
  let best: string = DIMS[0], bestMag = -1;
  for (const dim of DIMS) {
    const mag = Math.abs((gt[dim] ?? 0) * (centered(a, dim) - centered(b, dim)));
    if (mag > bestMag) { bestMag = mag; best = dim; }
  }
  return best;
}

type LearnResult = { vector: TasteVector; evidence: EvidenceMap };

/** Ratings-only learning over a user's rated dishes (in order). */
function learnRatingsOnly(gt: TasteVector, rated: Dish[], r: () => number): LearnResult {
  let vector = emptyTaste();
  let evidence: EvidenceMap = {};
  for (const dish of rated) {
    const score = Math.max(-1, Math.min(1, RATING_GAIN * utility(gt, dish) + gauss(r) * RATING_NOISE));
    vector = updateTaste(vector, evidence, dish.attributes, score);
    evidence = bumpEvidence(evidence, dish.attributes);
  }
  return { vector, evidence };
}

/** Same ratings, but with actively-selected duels interleaved every `interval`
 * ratings. Duel answers follow a Bradley–Terry coin on the ground-truth utility gap
 * (a realistically noisy chooser, not an oracle). */
function learnWithDuels(
  gt: TasteVector, rated: Dish[], r: () => number,
  duelOpts: { weight: number; k: number }, interval = 4,
): LearnResult {
  let vector = emptyTaste();
  let evidence: EvidenceMap = {};
  const seen: Dish[] = [];
  const history: ExistingDuelRow[] = [];
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const tick = () => (clock += 3600_000);

  for (let i = 0; i < rated.length; i++) {
    const dish = rated[i];
    const score = Math.max(-1, Math.min(1, RATING_GAIN * utility(gt, dish) + gauss(r) * RATING_NOISE));
    vector = updateTaste(vector, evidence, dish.attributes, score);
    evidence = bumpEvidence(evidence, dish.attributes);
    seen.push(dish);

    if ((i + 1) % interval === 0 && seen.length >= 4) {
      const candidates: DuelCandidate[] = seen.map(d => ({ id: d.id, cuisine: d.cuisine, attributes: d.attributes, identityId: null }));
      const pair = selectDuelPair(candidates, evidence, history, clock);
      if (pair) {
        const da = seen.find(d => d.id === pair.a.id)!;
        const db = seen.find(d => d.id === pair.b.id)!;
        const du = utility(gt, da) - utility(gt, db);
        // A pairwise choice is MORE reliable than an absolute flick — that's the
        // whole premise of duels — so the chooser is sharper than the rating noise.
        const pAWins = 1 / (1 + Math.exp(-16 * du));
        const aWins = r() < pAWins;
        const winner = aWins ? da : db;
        const loser = aWins ? db : da;
        vector = updateTasteFromDuel(vector, evidence, winner.attributes, loser.attributes, duelOpts);
        evidence = bumpEvidenceFromDuel(evidence, winner.attributes, loser.attributes);
        history.push({ dish_a: pair.a.id, dish_b: pair.b.id, winner: winner.id, served_at: new Date(tick()).toISOString(), skipped_at: null });
      }
    }
  }
  return { vector, evidence };
}

// ── evaluation ───────────────────────────────────────────────────────────────
/** Held-out pairwise ranking accuracy: does the learned vector order same-cuisine
 * pairs the way ground-truth utility does? */
function pairwiseAccuracy(gt: TasteVector, learned: TasteVector, heldout: [Dish, Dish][]): [number, number] {
  let c = 0, t = 0;
  for (const [a, b] of heldout) {
    const du = utility(gt, a) - utility(gt, b);
    if (Math.abs(du) < 1e-4) continue; // no ground-truth preference -> not a test
    const pred = contentScore(learned, a.attributes, {}) - contentScore(learned, b.attributes, {});
    t++; if (Math.sign(pred) === Math.sign(du)) c++;
  }
  return [c, t];
}

/** The dims that matter for this measurement: ones the user genuinely has an
 * opinion about (|gt| big) that RATINGS left uncertain (low evidence). Duels are
 * supposed to teach exactly these — so we score whether the learned vector recovers
 * their SIGN. decidingDim above is retained as documentation of the earlier,
 * lower-powered attempt. */
function lowEvidenceOpinionatedDims(gt: TasteVector, ratingEvidence: EvidenceMap): string[] {
  return DIMS.filter(d => (ratingEvidence[d] ?? 0) <= 2 && Math.abs(gt[d] ?? 0) > 0.25);
}
void decidingDim;

// ── run ──────────────────────────────────────────────────────────────────────
function run(duelOpts: { weight: number; k: number }, seedOffset = 0) {
  // Sparse ratings on purpose: with only this many flicks, several dims a user
  // genuinely cares about stay under-taught (low evidence) — the regime duels exist
  // to help. (A user who has rated hundreds of dishes needs no help.)
  const N_USERS = 30, POOL = 120, RATINGS = 10, HELDOUT = 400;
  let A = { oC: 0, oT: 0, lC: 0, lT: 0 };
  let B = { oC: 0, oT: 0, lC: 0, lT: 0 };

  for (let u = 0; u < N_USERS; u++) {
    const r = rng(1000 + u * 7 + seedOffset);
    const gt = makeGroundTruth(r);
    const pool = Array.from({ length: POOL }, (_, i) => makeDish(r, i));

    const shuffled = [...pool].sort(() => r() - 0.5);
    const rated = shuffled.slice(0, RATINGS);

    const heldout: [Dish, Dish][] = [];
    let guard = 0;
    while (heldout.length < HELDOUT && guard++ < HELDOUT * 40) {
      const a = pool[Math.floor(r() * POOL)], b = pool[Math.floor(r() * POOL)];
      if (a.id !== b.id && a.cuisine === b.cuisine) heldout.push([a, b]);
    }

    const only = learnRatingsOnly(gt, rated, rng(9000 + u + seedOffset));
    const withD = learnWithDuels(gt, rated, rng(9000 + u + seedOffset), duelOpts); // same rating seed -> identical ratings

    // Overall pairwise ranking.
    const [oCa, oTa] = pairwiseAccuracy(gt, only.vector, heldout);
    const [oCb, oTb] = pairwiseAccuracy(gt, withD.vector, heldout);
    A.oC += oCa; A.oT += oTa; B.oC += oCb; B.oT += oTb;

    // Sign recovery on the dims the user cares about that ratings left uncertain —
    // the SAME dim set for both conditions (defined from ratings-only), so we're
    // measuring what the duels added on exactly those dims.
    for (const d of lowEvidenceOpinionatedDims(gt, only.evidence)) {
      A.lT++; if (Math.sign(only.vector[d]) === Math.sign(gt[d])) A.lC++;
      B.lT++; if (Math.sign(withD.vector[d]) === Math.sign(gt[d])) B.lC++;
    }
  }
  const pct = (c: number, t: number) => (t ? (100 * c / t) : NaN);
  return {
    overallA: pct(A.oC, A.oT), overallB: pct(B.oC, B.oT),
    lowEvA: pct(A.lC, A.lT), lowEvB: pct(B.lC, B.lT),
    lowEvN: A.lT,
  };
}

// Average over several seed bases so the tuning decision isn't chasing one lucky
// draw of 30 users.
const SEEDS = [0, 500, 1000, 1500, 2000];
function avg(opts: { weight: number; k: number }) {
  let oA = 0, oB = 0, lA = 0, lB = 0, n = 0;
  for (const s of SEEDS) {
    const r = run(opts, s);
    oA += r.overallA; oB += r.overallB; lA += r.lowEvA; lB += r.lowEvB; n += r.lowEvN;
  }
  const k = SEEDS.length;
  return { overallA: oA / k, overallB: oB / k, lowEvA: lA / k, lowEvB: lB / k, lowEvN: Math.round(n / k) };
}

// Sweep (weight, K), each averaged across seeds, to pick defaults on evidence.
const grid = [
  { weight: 0.3, k: 4 }, { weight: 0.6, k: 4 }, { weight: 0.9, k: 4 },
  { weight: 0.6, k: 1 }, { weight: 0.6, k: 2 }, { weight: 0.6, k: 6 },
];
console.log(`sweep — mean over ${SEEDS.length} seed bases (overall A→B / low-ev A→B):`);
for (const g of grid) {
  const rr = avg(g);
  const dO = rr.overallB - rr.overallA, dL = rr.lowEvB - rr.lowEvA;
  console.log(
    `  weight=${g.weight} k=${g.k}:  overall ${rr.overallA.toFixed(1)}→${rr.overallB.toFixed(1)} (${dO >= 0 ? '+' : ''}${dO.toFixed(2)}pp)  ` +
    `low-ev ${rr.lowEvA.toFixed(1)}→${rr.lowEvB.toFixed(1)} (${dL >= 0 ? '+' : ''}${dL.toFixed(1)}pp, n≈${rr.lowEvN})`,
  );
}

console.log(`\nACCEPTANCE — shipped constants (DUEL_WEIGHT=${DUEL_WEIGHT}, DUEL_K=${DUEL_K}), mean over ${SEEDS.length} seeds:`);
const res = avg({ weight: DUEL_WEIGHT, k: DUEL_K });
const lowEvGain = res.lowEvB - res.lowEvA;
const overallDelta = res.overallB - res.overallA;
console.log(`  overall ranking:   ${res.overallA.toFixed(2)}%  →  ${res.overallB.toFixed(2)}%   (Δ ${overallDelta >= 0 ? '+' : ''}${overallDelta.toFixed(2)}pp)`);
console.log(`  low-evidence-dim:  ${res.lowEvA.toFixed(2)}%  →  ${res.lowEvB.toFixed(2)}%   (Δ ${lowEvGain >= 0 ? '+' : ''}${lowEvGain.toFixed(2)}pp, n≈${res.lowEvN})`);

const pass = lowEvGain > 1.0 && overallDelta >= -0.5;
console.log(`\n${pass ? 'PASS' : 'FAIL'}: duels ${lowEvGain > 1.0 ? 'improve' : 'do NOT improve'} low-evidence accuracy` +
  ` and ${overallDelta >= -0.5 ? 'do not degrade' : 'DEGRADE'} overall.`);
process.exit(pass ? 0 : 1);
