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
 * Update a user's taste vector after a rating.
 * EMA with a learning rate that decays as ratings accumulate: early ratings move the
 * profile a lot (fast cold start), later ratings refine it. Voice-extracted attributes
 * override vision attributes where present — the user's own words beat a photo guess.
 */
export function updateTaste(
  taste: TasteVector,
  count: number,
  dish: DishVector,
  score: number, // -1..1 from the flick
  voiceAttrs?: DishVector | null,
): TasteVector {
  const alpha = Math.max(0.08, 1 / (count + 2));
  const next: TasteVector = { ...emptyTaste(), ...taste };
  for (const dim of DIMS) {
    const presence = voiceAttrs?.[dim] ?? dish[dim] ?? 0;
    // centered presence: attributes strongly present push preference in the score's
    // direction; absent attributes push weakly the other way (you loved a dish that
    // isn't spicy — mild negative evidence on spicy).
    const centered = (presence - 0.5) * 2;
    next[dim] = clamp(next[dim] + alpha * score * centered, -1, 1);
  }
  return next;
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

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
