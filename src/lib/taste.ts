// The taste model. One place for every vector decision so the reasoning is auditable.
//
// Design choice: a FIXED, INTERPRETABLE 18-dimension attribute space rather than a
// learned embedding. At MVP scale (<10k ratings) a learned latent space would be noise;
// interpretable dims mean (a) the vision LLM can output them directly as structured JSON,
// (b) voice notes ("too salty") map onto them trivially, (c) you can debug a bad
// recommendation by reading the vector. Swap in learned embeddings later when data allows.

export const DIMS = [
  // flavor
  'sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy',
  // texture
  'crispy', 'creamy', 'chewy', 'tender',
  // body
  'rich', 'fresh',
  // method
  'fried', 'grilled', 'braised', 'steamed', 'raw', 'baked',
] as const;

export type Dim = (typeof DIMS)[number];
export type DishVector = Record<string, number>;  // each dim 0..1 (presence)
export type TasteVector = Record<string, number>; // each dim -1..1 (preference)

export function emptyTaste(): TasteVector {
  return Object.fromEntries(DIMS.map((d) => [d, 0]));
}

/**
 * Evidence: how many ratings have actually TAUGHT each dimension. Powers three
 * things: (1) the per-dim learning rate below, (2) honest reason text — never
 * claim "because you love umami" about a dim no rating ever taught, (3) which
 * dims the Buddy should target for exploration. Deliberately NOT used to gate
 * or adjust recommendation scores: simulation showed evidence-based confidence
 * has no real power to predict which predictions are wrong, and a confidence
 * gate that can't discriminate is credibility theater.
 */
export type EvidenceMap = Record<string, number>;

/**
 * Below this presence, a VISION-reported attribute teaches nothing. Live production
 * data showed the vision model reports murmur values (0.05-0.15) for attributes it
 * has no real opinion on; the centering transform reads those as near-confirmed
 * absence, so loving the dish pushed every murmured dim negative — the same class
 * of corruption as the original missing-dim bug, sneaking in through low values
 * instead of missing keys. Simulation (30-trial ground-truth runs through this real
 * code): murmur-learning compounds phantom preferences as ratings accumulate
 * (0.26 -> 0.47 mean fake preference), thresholding holds them near zero; the exact
 * cutoff barely matters (0.25 vs 0.35 indistinguishable). Voice values are EXEMPT —
 * "barely spicy" spoken by the eater is genuine testimony, not model murmur.
 */
export const LEARN_CUTOFF = 0.3;

/** Which dims a rating teaches, and with what presence. The single source of truth
 * shared by updateTaste and bumpEvidence so the vector and its evidence counters can
 * never disagree about what was learned. */
export function taughtDims(dish: DishVector, voiceAttrs?: DishVector | null): { dim: Dim; presence: number }[] {
  const out: { dim: Dim; presence: number }[] = [];
  for (const dim of DIMS) {
    const fromVoice = voiceAttrs?.[dim];
    if (fromVoice !== undefined) { out.push({ dim, presence: fromVoice }); continue; }
    const fromDish = dish[dim];
    // Missing = no evidence either way (the original bug fix); below-cutoff = model
    // murmur, equally not evidence. Both teach nothing — never a phantom signal.
    if (fromDish === undefined || fromDish < LEARN_CUTOFF) continue;
    out.push({ dim, presence: fromDish });
  }
  return out;
}

// ── Self-calibrating rating scale ─────────────────────────────────────────────
// Everyone's scale is different. To one person 一般般 means "fine, nothing to
// complain about"; to another it means "I regret this meal." Hardcoding what a
// flick is worth bakes one person's scale into every palate, so instead the
// engine learns where each person's OWN neutral sits and scores each rating
// relative to that.
//
// Why it matters, from live data: 56% of the first real palate's 41 ratings are
// the SAME value (0.35 幾好食) and 95% are positive. updateTaste multiplies by
// the score, so nearly every dim a dish taught drifted positive — the engine
// learned "you like everything," the opposite of a discriminating palate.
// Measured on that history through this real code (scripts/simulate-scale-
// calibration.ts): pairwise ranking accuracy 76.1% → 80.8% overall, 72.7% →
// 75.8% within-cuisine. See docs/rnd/seal-band-calibration.md §10.

/** What a rating is worth before the person has told us anything. Zero means a
 * brand-new profile behaves EXACTLY as it did before calibration existed —
 * calibration only emerges once there is evidence to calibrate from. */
export const PRIOR_CENTER = 0;

/** Shrinkage strength toward PRIOR_CENTER, in units of "ratings' worth of prior."
 * At k=5 a person's first handful of flicks barely move their centre, and it
 * takes real history to earn a strong one. */
export const CENTER_PRIOR_K = 5;

/**
 * The person's own neutral point, derived from the scores they have ALREADY
 * given. MEDIAN, not mean: one furious −0.9 must not move where "ordinary" sits
 * for someone whose every other meal was fine.
 *
 * Callers must pass only scores from BEFORE the rating being learned, so the
 * centre can never peek at the value it is about to transform. Both learning
 * paths derive it from the same place — the `ratings` table — rather than
 * caching it anywhere: a median has no running-scalar form, so a stored centre
 * would mean storing a second copy of every score, and a second source of truth
 * for the same data is exactly how the two paths silently diverge.
 */
export function neutralCenter(priorScores: number[]): number {
  if (!priorScores.length) return PRIOR_CENTER;
  const s = [...priorScores].sort((a, b) => a - b);
  const mid = s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return (CENTER_PRIOR_K * PRIOR_CENTER + s.length * mid) / (CENTER_PRIOR_K + s.length);
}

/**
 * What a flick actually TEACHES: its distance from this person's neutral point.
 * The single transform both learning paths apply, so /api/ratings' incremental
 * update and replay.ts's full rebuild can never disagree about what a rating
 * meant.
 *
 * Deliberately NOT clamped to ±1. For a palate centred at 0.311 a 唔會再食
 * teaches −1.211 — a rating that far below your own normal genuinely is stronger
 * evidence than the scale's nominal floor, and both consumers clamp their own
 * output anyway (updateTaste and updateCuisineAffinity clamp to ±1). This is
 * also the unclamped form the +4.8pp was measured with.
 *
 * The RAW score is what gets stored in `ratings.score` and what the sealed
 * prediction is judged against — the seal is a claim about the flick the person
 * made, and its bands were calibrated on raw flicks. Centring is a learning-time
 * transform only, which is also what keeps the centre re-derivable from history.
 */
export function calibratedScore(rawScore: number, priorScores: number[]): number {
  return rawScore - neutralCenter(priorScores);
}

/**
 * Update a user's taste vector after a rating.
 * EMA with a PER-DIMENSION learning rate that decays as that dimension accumulates
 * evidence: the first few ratings that teach a dim move it a lot, later ones refine.
 * Previously the rate decayed with the user's TOTAL rating count — so a preference
 * first encountered at rating #30 (say, the first genuinely spicy dish) learned at
 * the floor rate forever. Simulation against ground truth: per-dim rate learns
 * late-discovered preferences ~3.3x better and slightly improves normal-case
 * ranking, with no cold-start cost. Voice-extracted attributes override vision
 * attributes where present — the user's own words beat a photo guess.
 */
export function updateTaste(
  taste: TasteVector,
  evidence: EvidenceMap,
  dish: DishVector,
  score: number, // -1..1 from the flick
  voiceAttrs?: DishVector | null,
): TasteVector {
  const next: TasteVector = { ...emptyTaste(), ...taste };
  for (const { dim, presence } of taughtDims(dish, voiceAttrs)) {
    const alpha = Math.max(0.08, 1 / ((evidence[dim] ?? 0) + 2));
    const centered = (presence - 0.5) * 2;
    next[dim] = clamp(next[dim] + alpha * score * centered, -1, 1);
  }
  return next;
}

/** Increment evidence counters for exactly the dims this rating taught. Call AFTER
 * updateTaste (which reads pre-rating evidence for its learning rate), and skip on
 * re-rates — correcting a slip-flick must not age the profile, mirroring how
 * rating_count already works. */
export function bumpEvidence(evidence: EvidenceMap, dish: DishVector, voiceAttrs?: DishVector | null): EvidenceMap {
  const next = { ...evidence };
  for (const { dim } of taughtDims(dish, voiceAttrs)) next[dim] = (next[dim] ?? 0) + 1;
  return next;
}

/**
 * Strip model murmur from VISION-derived attributes at ingestion: keep only dims
 * reported at or above the cutoff. Applies ONLY to vision output — hand-authored
 * seed dishes keep their explicit zeros, because a curated `fried: 0` on sashimi is
 * genuinely confirmed absence and remains valuable at SCORING time (a fried-hater
 * deserves credit for it). Learning-time protection is separate and universal
 * (taughtDims' cutoff), so seed zeros inform scores without ever teaching phantom
 * dislikes.
 */
export function thresholdVisionAttrs(attrs: DishVector, cutoff = LEARN_CUTOFF): DishVector {
  const out: DishVector = {};
  for (const [d, v] of Object.entries(attrs)) if (v >= cutoff) out[d] = v;
  return out;
}

/** How fast cuisine affinity moves toward a new rating. Converging, not
 * accumulating — see updateCuisineAffinity. */
export const CUISINE_ALPHA = 0.25;

/**
 * Cuisine affinity: how much this person likes a cuisine ON AVERAGE.
 *
 * Was an ACCUMULATOR (`prev + 0.2 * score`, clamped to ±1), which saturates:
 * at a mean rating of ~0.38 it pins at the +1 ceiling after ~13 meals and then
 * stops learning entirely. Observed live 2026-07-24 — cantonese and japanese
 * both sat at exactly 1.0, covering 78% of the person's ratings, so for most of
 * their food the cuisine term was a constant that (a) carried no information,
 * (b) could no longer tell those two cuisines apart, and (c) contributed a
 * maximal 0.3 to contentScore, drowning out the dish's own attributes.
 *
 * Now an EMA toward the score, so it converges on the average feeling about a
 * cuisine and can never pin. Two consequences, both wanted: cuisines the person
 * rates similarly END UP similar (which is honest — the discrimination should
 * come from the dish's attributes, not from who saturated first), and the
 * cuisine bonus shrinks to a proportionate size instead of dominating.
 *
 * Existing profiles heal through the normal full-history replay (replay.ts),
 * which re-derives affinity from scratch on any re-rate.
 */
export function updateCuisineAffinity(
  affinity: Record<string, number>,
  cuisine: string | null | undefined,
  score: number,
): Record<string, number> {
  if (!cuisine) return affinity;
  const key = cuisine.toLowerCase();
  if (key === 'unknown') return affinity; // vision fallback value, not a real cuisine signal
  const prev = affinity[key] ?? 0;
  return { ...affinity, [key]: clamp(prev + CUISINE_ALPHA * (score - prev), -1, 1) };
}

/** Cosine similarity between two taste vectors over the fixed dims. */
export function similarity(a: TasteVector, b: TasteVector): number {
  let dot = 0, na = 0, nb = 0;
  for (const dim of DIMS) {
    const x = a[dim] ?? 0, y = b[dim] ?? 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Which scoring engine is in force, stamped onto every seal
 * (sealed_predictions.scoring_version) so two engines are never silently
 * averaged in an aggregate. **Bump this whenever what a seal MEANS changes** —
 * contentScore's shape, the vector feeding it, or how a prediction is banded.
 * Historical rows cannot be recomputed (the seal-time taste vector was never
 * stored), so the version marker is the only thing keeping old and new
 * predictions comparable-aware.
 * See supabase/applied/sealed_predictions_scoring_version.sql.
 *
 * v1 — divided by all 18 dims regardless of how many a dish reported, which
 *      made the seal's `love` band unreachable.
 * v2 — divisor fixed to the dims actually scored (floored at MIN_SCORED_DIMS).
 * v3 — two changes that both alter what a predicted band means: the
 *      self-calibrating rating scale changed the vector feeding contentScore
 *      (so `predicted_raw` magnitudes are not comparable across the boundary),
 *      and predictions are now banded per-user by quantile mapping rather than
 *      against fixed absolute edges (see predictedDirectionOf in seal.ts). */
export const SCORING_VERSION = 3;

/** Floor on contentScore's divisor — see the note inside contentScore. A dish
 * reporting fewer attributes than this is scored as if it had this many, so a
 * sparse dish can't be amplified into a confident verdict off thin evidence.
 * Fitted (conservatively) to the only real seal data that exists; provisional
 * until more than one palate has sealed predictions. */
export const MIN_SCORED_DIMS = 10;

/** Content-based score: how well a dish's attributes align with a user's preferences. */
export function contentScore(taste: TasteVector, dish: DishVector, cuisineAffinity: Record<string, number>, cuisine?: string | null): number {
  let s = 0;
  let scored = 0;
  for (const dim of DIMS) {
    // Only score dims the dish ACTUALLY reports. scoreOneDish/sanitizeItem only ever
    // add a key when a dim was detected with real positive presence (see
    // menuScan.ts) — an absent key means "no evidence either way," never "confirmed
    // not present." Defaulting missing dims to 0 here used to feed (0 - 0.5) * 2 =
    // -1 into the formula — i.e. treat "not mentioned" as "definitely absent." For
    // anyone with several strong DISLIKES (taste[dim] very negative), that silently
    // manufactured a large POSITIVE match on any dish that simply never mentioned
    // that attribute — including a dish with literally zero attributes at all,
    // which was scoring a "perfect" 100% match before this fix.
    if (!(dim in dish)) continue;
    s += (taste[dim] ?? 0) * (dish[dim] - 0.5) * 2;
    scored++;
  }
  // Divide by the dims actually SCORED, not by all 18 (2026-07-24). The old
  // `s /= DIMS.length` summed over the ~8.7 dims a dish reports and then divided
  // by 18, scaling the whole taste term down by ~2x more than the evidence
  // supports — so `predicted_raw` collapsed to roughly `0.3 * cuisineAffinity`
  // and the cuisine bonus decided almost every verdict. Measured on the only real
  // data that exists: the taste term's mean was 0.068 against a cuisine term of
  // up to 0.3, and the seal's `love` band (>= 0.5) was unreachable — 0 of 11
  // genuinely loved dishes were ever called (docs/rnd/seal-band-calibration.md).
  //
  // MIN_SCORED_DIMS is a floor, not just a count: dividing by a raw count would
  // amplify a dish that happens to list few attributes into false confidence.
  // It is the one parameter here fitted to data, and the data is thin (36 seals,
  // ONE user), so it was chosen conservatively rather than optimally — 10 is the
  // only value in a 1..18 sweep that regresses NEITHER ranking metric against
  // the pre-fix formula (pairwise ordering of really-rated dishes: 76.1% overall
  // unchanged, within-cuisine 68.1% -> 69.9%) while still unlocking `love`.
  // Lower floors score better on the seal (a floor of 4 calls 6 of 11 loves) but
  // cost ~3pp of ranking accuracy, and recommendation quality gates everything.
  // Revisit once seal data exists for more than one palate.
  s /= Math.max(MIN_SCORED_DIMS, scored);
  if (cuisine) s += 0.3 * (cuisineAffinity[cuisine.toLowerCase()] ?? 0);
  return s;
}

// ── 對決 (pairwise taste duels) ────────────────────────────────────────────────
// A duel teaches from a CHOICE between two dishes, not an absolute score. The
// signal lives entirely in the CONTRAST between the two dishes' attributes, so a
// pick isolates the dimensions that actually differed — cleaner than a flick,
// which is a noisy absolute judgment. See docs/specs/dish-duels.md.

export const DUEL_WEIGHT = 0.6; // overall duel step size relative to a rating's
// A tie (揀唔落) is gentler than a decisive pick. Tuned in scripts/simulate-duels.ts:
// a tie-weight sweep showed 0.2 keeps the full low-evidence gain of the wins (+2.2pp,
// identical to ignoring ties) while improving overall calibration versus ignoring
// them — so ties genuinely help, without over-correcting the dims wins just taught.
// Higher (0.4–0.6) starts eroding the low-evidence gain.
export const DUEL_TIE_WEIGHT = 0.2;
// Logistic gain on the un-normalized alignment gap Σ taste·x (NOT contentScore).
// Tuned in scripts/simulate-duels.ts: across a 5-seed × 30-user sweep, weight 0.6 /
// K 2 was the best cell on BOTH axes — overall ranking flat (+0.02pp) and
// low-evidence-dim sign accuracy +4.6pp. (The spec's K=4 was calibrated against the
// original contentScore-÷18 formula, whose gap was ~18× smaller; once p is computed
// on the correct logit, the gain re-tunes down.)
export const DUEL_K = 2;

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Per-dim signed contrast between the winner's and loser's attributes — the ONLY
 * thing a duel teaches from. Centered presence `(v - 0.5) * 2` per dish, but a dim
 * absent or below LEARN_CUTOFF contributes 0 to that dish's side (identical murmur
 * rule to taughtDims — a vision murmur is not evidence in a duel any more than in a
 * rating). Dims whose contrast is exactly 0 taught nothing and are omitted. Shared
 * by the learning update, the evidence bump, and server-side pair selection so all
 * three can never disagree about what a given pair actually contrasts.
 */
export function duelContrast(winner: DishVector, loser: DishVector): { dim: Dim; x: number }[] {
  const centered = (dish: DishVector, dim: Dim): number => {
    const v = dish[dim];
    if (v === undefined || v < LEARN_CUTOFF) return 0;
    return (v - 0.5) * 2;
  };
  const out: { dim: Dim; x: number }[] = [];
  for (const dim of DIMS) {
    const x = centered(winner, dim) - centered(loser, dim);
    if (x !== 0) out.push({ dim, x });
  }
  return out;
}

/**
 * Update a taste vector from a duel outcome (winner beat loser). This is one step
 * of pairwise logistic (Bradley-Terry) regression with the taste vector as the
 * weights and the per-dim contrast `x` as the features: nudge each contrasted dim
 * toward the winner's side, scaled by the prediction error `(1 − p)`.
 *
 * `p` is the model's own probability the winner would win, `sigmoid(K · Σ taste·x)`.
 * IMPORTANT: this uses the UN-normalized alignment gap `Σ taste·x` over the contrast
 * dims — NOT contentScore, whose 1/18 mean crushes the gap so small that `p ≈ 0.5`
 * for ~86% of realistic pairs (measured), which flatlines the error signal into a
 * blind constant push and DEGRADED accuracy in simulation. The raw gap is the
 * correct logit and is what makes `(1 − p)` meaningful — a confidently-correct
 * prediction barely moves the vector; an upset teaches a lot. (Same-cuisine pairing
 * means cuisine affinity cancels, so it's excluded entirely here.) Per-dim learning
 * rate decays with evidence, exactly like updateTaste. K/DUEL_WEIGHT were tuned in
 * scripts/simulate-duels.ts; see that file's reported numbers.
 */
export function updateTasteFromDuel(
  taste: TasteVector,
  evidence: EvidenceMap,
  winner: DishVector,
  loser: DishVector,
  // Overrides exist ONLY so the tuning simulation (scripts/simulate-duels.ts) can
  // sweep these through the real code path rather than a divergent copy; every
  // production caller omits them and gets the shipped constants.
  opts?: { weight?: number; k?: number },
): TasteVector {
  const weight = opts?.weight ?? DUEL_WEIGHT;
  const k = opts?.k ?? DUEL_K;
  const next: TasteVector = { ...emptyTaste(), ...taste };
  const contrast = duelContrast(winner, loser);
  let gap = 0;
  for (const { dim, x } of contrast) gap += (taste[dim] ?? 0) * x;
  const p = sigmoid(k * gap);
  for (const { dim, x } of contrast) {
    const alpha = Math.max(0.08, 1 / ((evidence[dim] ?? 0) + 2));
    next[dim] = clamp(next[dim] + weight * alpha * (1 - p) * x, -1, 1);
  }
  return next;
}

/** Evidence bump for a duel: +1 only for dims the duel GENUINELY contrasted
 * (|x| >= 0.3). A pair that barely differed on a dim is not evidence about it, so
 * it must not age that dim's learning rate — mirroring taughtDims' cutoff for
 * ratings. Call AFTER updateTasteFromDuel (which reads pre-duel evidence). A tie
 * exercises the same contrast, so it bumps identically (winner/loser order is
 * irrelevant to |x|). */
export function bumpEvidenceFromDuel(evidence: EvidenceMap, winner: DishVector, loser: DishVector): EvidenceMap {
  const next = { ...evidence };
  for (const { dim, x } of duelContrast(winner, loser)) {
    if (Math.abs(x) >= 0.3) next[dim] = (next[dim] ?? 0) + 1;
  }
  return next;
}

/**
 * Update a taste vector from a TIE ("揀唔落" — the user genuinely couldn't separate
 * the two dishes). Same logistic step as a win, but toward a target of p = 0.5
 * instead of 1: a tie is evidence the two dishes are equally preferred, so the
 * engine's predicted gap between them should SHRINK. `(0.5 − p)` pulls each contrast
 * dim toward neutral in proportion to how wrong the current confident belief was —
 * a genuinely surprising tie (the engine expected a clear winner) corrects a lot; a
 * tie the engine already half-expected barely moves anything. Distinct from a
 * dismiss, which teaches nothing at all. `a`/`b` are symmetric here; order only sets
 * the sign of x, which cancels because the target is the midpoint.
 */
export function updateTasteFromDuelTie(
  taste: TasteVector,
  evidence: EvidenceMap,
  a: DishVector,
  b: DishVector,
  opts?: { weight?: number; k?: number },
): TasteVector {
  const weight = opts?.weight ?? DUEL_TIE_WEIGHT;
  const k = opts?.k ?? DUEL_K;
  const next: TasteVector = { ...emptyTaste(), ...taste };
  const contrast = duelContrast(a, b);
  let gap = 0;
  for (const { dim, x } of contrast) gap += (taste[dim] ?? 0) * x;
  const p = sigmoid(k * gap);
  for (const { dim, x } of contrast) {
    const alpha = Math.max(0.08, 1 / ((evidence[dim] ?? 0) + 2));
    next[dim] = clamp(next[dim] + weight * alpha * (0.5 - p) * x, -1, 1);
  }
  return next;
}

/**
 * Blend content-based and collaborative scores. `crossUserSignal` is the number of
 * ratings from similar users on this candidate; with little data we trust content,
 * with more we shift toward "people like you loved this".
 */
export function blendScores(content: number, collab: number | null, crossUserSignal: number): { score: number; source: 'content' | 'collab' } {
  if (collab === null || crossUserSignal === 0) return { score: content, source: 'content' };
  const w = Math.min(1, crossUserSignal / 10);
  return { score: (1 - w) * content + w * collab, source: w > 0.4 ? 'collab' : 'content' };
}

/**
 * Map a raw contentScore to a friendly 0-100 "match" for display.
 *
 * Why the gain: contentScore averages over all 18 dims, so even a strong
 * single-attribute alignment produces a small raw value (a user with spicy=0.9
 * meeting a spicy=0.95 dish scores ~0.045 raw). Without gain, every match would
 * render as "49...51" and absolute thresholds (unanimity, fairness badges) would
 * never fire — a bug the test suite caught. Gain 8 puts realistic strong matches
 * in the 65-90 band and strong mismatches in the 10-35 band, with clamping at the
 * extremes. Purely presentational: relative RANKING always uses raw scores.
 */
export function toMatchPercent(raw: number, gain = 8): number {
  return Math.round(clamp((raw * gain + 1) * 50, 0, 100));
}

/**
 * Map a raw score to a percent RELATIVE to the other raw scores in the same batch
 * (the rest of a scanned menu, a feed page, a table's candidate list) — stretching
 * whatever spread actually exists in this batch across a legible display range.
 *
 * Why this exists alongside the fixed-gain toMatchPercent: that function assumes a
 * "typical" raw-score magnitude and saturates at its 100 clamp once real scores run
 * bigger than expected — which happens for anyone with several strong preferences
 * at once, or a menu that's unusually well-aligned with one person's taste. Real
 * production case: a 20-dish menu where nearly every dish legitimately scored above
 * the fixed ceiling, so every dish displayed "100%" even though the underlying
 * reasons (and raw scores) were genuinely different per dish. Relative scaling
 * can't run out of headroom — whatever the actual best and worst dishes in THIS
 * batch are, they'll always show visible separation.
 *
 * Ranking/order is untouched by this — that always comes from raw scores directly.
 * This function only affects what NUMBER gets displayed next to a dish.
 */
export function toRelativeMatchPercent(raw: number, allRaw: number[], floor = 15, ceiling = 95): number {
  if (allRaw.length === 0) return 50;
  const min = Math.min(...allRaw);
  const max = Math.max(...allRaw);
  const spread = max - min;
  // Everything in the batch is (near-)identical — there's nothing real to spread
  // across, so show an honest flat neutral rather than manufacturing fake variance.
  if (spread < 1e-6) return 50;
  const frac = (raw - min) / spread;
  return Math.round(clamp(floor + frac * (ceiling - floor), floor, ceiling));
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
