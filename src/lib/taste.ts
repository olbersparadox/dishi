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

export function updateCuisineAffinity(
  affinity: Record<string, number>,
  cuisine: string | null | undefined,
  score: number,
): Record<string, number> {
  if (!cuisine) return affinity;
  const key = cuisine.toLowerCase();
  if (key === 'unknown') return affinity; // vision fallback value, not a real cuisine signal
  const prev = affinity[key] ?? 0;
  return { ...affinity, [key]: clamp(prev + 0.2 * score, -1, 1) };
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

/** Content-based score: how well a dish's attributes align with a user's preferences. */
export function contentScore(taste: TasteVector, dish: DishVector, cuisineAffinity: Record<string, number>, cuisine?: string | null): number {
  let s = 0;
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
  }
  s /= DIMS.length;
  if (cuisine) s += 0.3 * (cuisineAffinity[cuisine.toLowerCase()] ?? 0);
  return s;
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
