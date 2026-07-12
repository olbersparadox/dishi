/**
 * ROW SNAPPING — corrects box y-positions to real text rows instead of trusting
 * the vision model's assumed uniform grid.
 *
 * Origin: real-photo validation found the production model emits geometrically
 * self-consistent but WRONG grids — perfectly contiguous, uniformly-spaced boxes
 * whose assumed row pitch doesn't match the menu's true pitch, so misalignment
 * accumulates down a column while every existing geometric gate (overlap, crowd,
 * drift) reads clean, because those gates check consistency BETWEEN boxes, not
 * correctness against the actual photo.
 *
 * Offline validation (synthetic menus with known ground truth) found two
 * independent facts:
 *  1. Horizontal-darkness row DETECTION is already excellent — within 1-2px of
 *     true row centers, holding up under skew and noise individually.
 *  2. The original bug was in MATCHING, not detection: naive nearest-neighbor
 *     collides once cumulative drift exceeds half a row gap, then cascades — the
 *     exact real-photo failure signature. Ordinal alignment (when detected band
 *     count equals model box count, trust the ORDER, not the model's y-guess)
 *     fixed the direct reproduction of the real bug completely (100%, up from 42%
 *     with distance-based matching).
 *
 * This module is deliberately split in two:
 *  - matchBandsToBoxes/monotonicNearestNeighbor: pure math, unit-tested directly
 *    against the validated Python offline results.
 *  - detectRowBands: needs real pixel data (browser Canvas ImageData), so it's
 *    validated visually through the /dev/bbox harness rather than vitest — this
 *    project has no canvas/raster support in its test environment, and faking one
 *    would test the fake, not the algorithm.
 *
 * Honest residual: a synthetic worst-case stacking skew + noise + a busy photo
 * header + irregular spacing ALL AT ONCE still failed offline (36%, unmoved by
 * further tuning) — harsher than any single real photo tested. Snapping is
 * layered as a rendering-time IMPROVEMENT after the existing server-side gates
 * (overlap/crowd/drift/reject-rate), not a replacement for them: if a real photo
 * ever hits something that nasty, those gates remain the safety net and the scan
 * falls back to list, same as before this module existed.
 */

/** When detected band count equals box count: trust the ORDER, not the model's
 * y-guess — this is the fix for the real bug (menu 2), validated at 100% recovery
 * on its direct reproduction. When counts differ, falls back to monotonic nearest-
 * neighbor with no band reused twice, which recovered 92% on a mismatch caused by
 * one spurious extra band (a noisy photo header bleeding into detection). */
export function matchBandsToBoxes(modelYs: number[], bandCenters: number[], maxDist: number): (number | null)[] {
  if (bandCenters.length === modelYs.length) return [...bandCenters];
  return monotonicNearestNeighbor(modelYs, bandCenters, maxDist);
}

/** Nearest-neighbor matching where each detected band can be claimed at most
 * once. This alone is NOT what fixed the real bug (unconstrained nearest-neighbor
 * without the no-reuse constraint is what caused the collision/cascade in the
 * first place) — it exists as the fallback for the count-mismatch case, where
 * ordinal alignment cannot apply because there's no valid 1:1 index correspondence. */
export function monotonicNearestNeighbor(modelYs: number[], bandCenters: number[], maxDist: number): (number | null)[] {
  const usedIdx = new Set<number>();
  const out: (number | null)[] = [];
  for (const y of modelYs) {
    let bestIdx = -1, bestDist = Infinity;
    bandCenters.forEach((b, i) => {
      if (usedIdx.has(i)) return;
      const d = Math.abs(b - y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestDist <= maxDist) { out.push(bandCenters[bestIdx]); usedIdx.add(bestIdx); }
    else out.push(null);
  }
  return out;
}

/** Apply a snap result to a box: shift y by the correction delta, keep x/w/h —
 * a box's HEIGHT wasn't shown to be wrong in validation, only its vertical
 * position, so only position is corrected. Returns the original box unchanged
 * when snapping couldn't find a confident match (rendering-time correction should
 * never silently drop a dish the model did locate). */
export function applySnap<T extends { y: number; h: number }>(box: T, snappedCenterY: number | null): T {
  if (snappedCenterY === null) return box;
  const currentCenter = box.y + box.h / 2;
  const delta = snappedCenterY - currentCenter;
  return { ...box, y: box.y + delta };
}

// ---------------------------------------------------------------------------
// Browser-only: real pixel-based row detection. Not unit-testable in this
// project's Node/vitest environment (no canvas/raster support) — validated
// visually via /dev/bbox, and by construction (thresholds scaled to the
// model's own average box height, so it adapts to photo resolution instead of
// hardcoding pixel counts tuned to one synthetic canvas size).
// ---------------------------------------------------------------------------

/** Horizontal darkness projection profile -> smoothed -> thresholded into RAW
 * bands (one per text line — a two-line dish yields two bands; headers yield
 * bands too). Grouping bands into dishes is deliberately NOT done here: real-photo
 * testing killed two threshold-based merge strategies in a row (a fixed
 * 0.2×boxHeight gap split every two-line dish; a 0.45×pitch gap swallowed whole
 * menus whose dishes sit closer than half a pitch). The lesson: any fixed merge
 * threshold encodes an assumption some real menu violates. Grouping now happens in
 * partitionByLargestGaps, which is parameter-free. */
export function detectRowBands(imageData: ImageData, avgBoxHeight: number): [number, number][] {
  const { width, height, data } = imageData;
  if (height === 0 || width === 0 || avgBoxHeight <= 0) return [];

  const darkness = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    darkness[y] = 255 - sum / width;
  }

  const k = Math.max(3, Math.round(avgBoxHeight / 5));
  const smooth = movingAverage(darkness, k);

  let maxV = -Infinity, sumV = 0;
  for (let y = 0; y < height; y++) { if (smooth[y] > maxV) maxV = smooth[y]; sumV += smooth[y]; }
  const threshold = maxV * 0.15 + (sumV / height) * 0.1;
  const minBandLen = Math.max(2, Math.round(avgBoxHeight * 0.05));

  const bands: [number, number][] = [];
  let y = 0;
  while (y < height) {
    if (smooth[y] > threshold) {
      const start = y;
      while (y < height && smooth[y] > threshold) y++;
      if (y - start >= minBandLen) bands.push([start, y]);
    } else {
      y++;
    }
  }
  return bands;
}

/** Drop bands outside the model boxes' own vertical range (± margin) — the model's
 * boxes are imprecise but their ENVELOPE reliably brackets the dish region, so
 * header/footer text bands can't leak into dish grouping. Validated live: a menu
 * title above the dishes contributed spurious bands that broke count matching. */
export function envelopeFilter(bands: [number, number][], envLo: number, envHi: number): [number, number][] {
  return bands.filter(([s, e]) => { const c = (s + e) / 2; return c >= envLo && c <= envHi; });
}

/** Partition sorted raw bands into exactly n groups by cutting at the n-1 LARGEST
 * inter-band gaps, then take each group's center as that dish's row position.
 * Parameter-free by design — it exploits the one hard fact we hold (the model
 * told us exactly how many dishes this column has) instead of a tuned threshold.
 * Offline validation: 100% on two-line-with-header (the real failing menu's
 * structure), single-line regular, irregular-with-sublines, and mixed
 * one/two-line menus. Returns group centers, length exactly n when there were at
 * least n bands (which is what lets the ordinal path engage). */
export function partitionByLargestGaps(bands: [number, number][], n: number): number[] {
  if (n <= 0) return [];
  if (bands.length <= n) return bands.map(([s, e]) => Math.round((s + e) / 2));
  const gaps: { size: number; i: number }[] = [];
  for (let i = 0; i < bands.length - 1; i++) gaps.push({ size: bands[i + 1][0] - bands[i][1], i });
  const cutAfter = new Set(
    gaps.sort((a, b) => b.size - a.size).slice(0, n - 1).map(g => g.i),
  );
  const centers: number[] = [];
  let groupStart = bands[0][0], groupEnd = bands[0][1];
  for (let i = 1; i < bands.length; i++) {
    if (cutAfter.has(i - 1)) {
      centers.push(Math.round((groupStart + groupEnd) / 2));
      groupStart = bands[i][0];
    }
    groupEnd = bands[i][1];
  }
  centers.push(Math.round((groupStart + groupEnd) / 2));
  return centers;
}

function movingAverage(arr: Float64Array, k: number): Float64Array {
  const out = new Float64Array(arr.length);
  const half = Math.floor(k / 2);
  // Simple O(n*k) sliding window — photo heights are at most a few thousand
  // pixels, well within a single frame's budget, and correctness matters more
  // here than shaving a constant factor off a one-time per-scan computation.
  for (let i = 0; i < arr.length; i++) {
    const lo = Math.max(0, i - half), hi = Math.min(arr.length - 1, i + half);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += arr[j];
    out[i] = s / (hi - lo + 1);
  }
  return out;
}
