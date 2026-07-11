/**
 * Bounding-box parsing for menu-photo grounding — the layer that decides whether
 * overlay mode can trust what the vision model returned.
 *
 * Vision models return box coordinates in (at least) three conventions, sometimes
 * inconsistently within one response: normalized 0-1 floats, 0-1000 integers
 * (the Qwen-VL convention, which our production models follow), or raw pixels.
 * The prompt asks for 0-1000, but this parser never assumes compliance: every box
 * is normalized defensively, validated, and either returned as a trustworthy 0-1
 * rect or rejected with a reason. Overlay mode falls back to the list UI when too
 * many boxes are rejected — a wrong box is worse than no box, because a fire mark
 * hovering over the WRONG dish is a false claim.
 */

export type NormalizedBox = { x: number; y: number; w: number; h: number };
export type BoxResult =
  | { ok: true; box: NormalizedBox }
  | { ok: false; reason: 'missing' | 'malformed' | 'out_of_range' | 'degenerate' | 'implausible' };

/** Boxes smaller than this fraction of the image are noise; larger than this are
 * almost certainly the model boxing the whole menu/section instead of one dish. */
const MIN_AREA = 0.0005;
const MAX_AREA = 0.5;

function coerceNumberArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map(Number);
  return nums.every(n => Number.isFinite(n)) ? nums : null;
}

/**
 * Normalize one raw bbox into 0-1 space.
 * Scale inference: all values <= 1 -> already normalized; all <= 1000 -> the
 * 0-1000 convention we prompt for; anything larger is pixel coordinates, which are
 * only usable when the caller knows the photo's dimensions.
 */
export function normalizeBox(raw: unknown, imageDims?: { w: number; h: number }): BoxResult {
  const nums = coerceNumberArray(raw);
  if (raw === undefined || raw === null) return { ok: false, reason: 'missing' };
  if (!nums) return { ok: false, reason: 'malformed' };

  let [x1, y1, x2, y2] = nums;
  // Inverted corners happen; repair rather than reject.
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];

  const maxVal = Math.max(x1, y1, x2, y2);
  // Tolerance bands at each scale boundary: models constantly overshoot the edge
  // of their coordinate system slightly (1.02 in 0-1 space, 1004 in 0-1000 space).
  // A small overshoot is still clearly that convention — clamping handles it below.
  if (maxVal <= 1.05) {
    // already normalized
  } else if (maxVal <= 1050) {
    x1 /= 1000; y1 /= 1000; x2 /= 1000; y2 /= 1000;
  } else if (imageDims && imageDims.w > 0 && imageDims.h > 0) {
    x1 /= imageDims.w; x2 /= imageDims.w; y1 /= imageDims.h; y2 /= imageDims.h;
  } else {
    return { ok: false, reason: 'out_of_range' }; // pixel coords, dimensions unknown
  }

  // Clamp tiny excursions (models emit 1001/1000-style overshoot constantly).
  x1 = Math.min(1, Math.max(0, x1)); x2 = Math.min(1, Math.max(0, x2));
  y1 = Math.min(1, Math.max(0, y1)); y2 = Math.min(1, Math.max(0, y2));

  const w = x2 - x1, h = y2 - y1;
  if (w <= 0 || h <= 0) return { ok: false, reason: 'degenerate' };
  const area = w * h;
  if (area < MIN_AREA || area > MAX_AREA) return { ok: false, reason: 'implausible' };

  return { ok: true, box: { x: x1, y: y1, w, h } };
}

export type GroundingStats = {
  total: number;
  valid: number;
  rejected: Record<string, number>;
  /** share of valid boxes that overlap another valid box by more than half of the
   * smaller box — a high value signals column confusion or whole-section boxes. */
  heavyOverlapShare: number;
  /** share of ADJACENT box pairs (within a column) that vertically overlap by more
   * than a quarter of the smaller box's height. This is the cumulative-drift
   * detector: real-photo testing showed the model's boxes progressively sliding up
   * a long column until neighbors crowd into each other — each individual overlap
   * too small for heavyOverlapShare to see, but the SEQUENCE loses correspondence
   * with the dishes entirely (menu 2 in validation showed exactly this and still
   * scored overlap 0%). Synthetic separation test: healthy/tight/multi-line
   * patterns all score 0.0, cumulative drift scores 1.0. */
  crowdedPairShare: number;
};

function columnClusters(boxes: NormalizedBox[]): NormalizedBox[][] {
  const cols: NormalizedBox[][] = [];
  for (const b of [...boxes].sort((a, c) => a.x - c.x)) {
    const col = cols.find(c => {
      const cx = c[0];
      const ov = Math.min(cx.x + cx.w, b.x + b.w) - Math.max(cx.x, b.x);
      return ov > 0.5 * Math.min(cx.w, b.w);
    });
    if (col) col.push(b); else cols.push([b]);
  }
  return cols;
}

function crowdedPairShare(boxes: NormalizedBox[]): number {
  let pairs = 0, crowded = 0;
  for (const col of columnClusters(boxes)) {
    const sorted = [...col].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      const ov = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      pairs++;
      if (ov > 0.25 * Math.min(a.h, b.h)) crowded++;
    }
  }
  return pairs ? crowded / pairs : 0;
}

/** Validate a whole batch and compute the health stats the go/no-go criteria use. */
export function analyzeGrounding(rawBoxes: unknown[], imageDims?: { w: number; h: number }): { results: BoxResult[]; stats: GroundingStats } {
  const results = rawBoxes.map(b => normalizeBox(b, imageDims));
  const valid = results.filter(r => r.ok) as { ok: true; box: NormalizedBox }[];
  const rejected: Record<string, number> = {};
  for (const r of results) if (!r.ok) rejected[r.reason] = (rejected[r.reason] ?? 0) + 1;

  let heavy = 0;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i].box, b = valid[j].box;
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const inter = ix * iy;
      const smaller = Math.min(a.w * a.h, b.w * b.h);
      if (smaller > 0 && inter / smaller > 0.5) { heavy++; break; }
    }
  }
  return {
    results,
    stats: {
      total: results.length,
      valid: valid.length,
      rejected,
      heavyOverlapShare: valid.length ? heavy / valid.length : 0,
      crowdedPairShare: crowdedPairShare(valid.map(v => v.box)),
    },
  };
}

/** The go/no-go the overlay UI applies per scan: enough trustworthy boxes, low
 * confusion — otherwise it renders the list UI instead. Thresholds mirror the
 * validation criteria agreed before any real-photo testing. */
export function groundingUsable(stats: GroundingStats): boolean {
  if (stats.total === 0) return false;
  return stats.valid / stats.total >= 0.8
    && stats.heavyOverlapShare < 0.15
    && stats.crowdedPairShare < 0.2; // systematic drift -> the sequence can't be trusted
}
