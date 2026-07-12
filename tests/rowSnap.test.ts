import { describe, it, expect } from 'vitest';
import { matchBandsToBoxes, monotonicNearestNeighbor, applySnap, partitionByLargestGaps, envelopeFilter } from '../src/lib/rowSnap';

describe('matchBandsToBoxes — the fix for the real menu-2 bug', () => {
  it('REGRESSION: ordinal alignment recovers the direct menu-2 reproduction (was 42%, offline-validated to 100%)', () => {
    // True dish rows are IRREGULARLY spaced (real menus aren't a perfect grid);
    // detected bands land within 1-2px of truth (row detection was never the
    // problem); the MODEL assumed a uniform 58px pitch that's wrong for this
    // menu — exactly the real production failure signature.
    const trueRows = [80, 145, 205, 270, 335, 425, 485, 580, 645, 735, 825, 880];
    const detectedBands = [80, 146, 204, 271, 335, 425, 485, 580, 646, 735, 825, 880];
    const modelGuesses = trueRows.map((_, i) => 80 + i * 58); // wrong uniform grid

    const snapped = matchBandsToBoxes(modelGuesses, detectedBands, 40);
    const withinTolerance = snapped.filter((s, i) => s !== null && Math.abs(s - trueRows[i]) <= 15).length;
    expect(withinTolerance).toBe(trueRows.length); // 100% recovery
  });

  it('uses ordinal (index) correspondence when counts match, ignoring the model y entirely', () => {
    const bands = [10, 50, 200]; // deliberately NOT close to modelYs
    const result = matchBandsToBoxes([1000, 2000, 3000], bands, 5);
    expect(result).toEqual(bands);
  });

  it('falls back to monotonic nearest-neighbor when counts differ', () => {
    const result = matchBandsToBoxes([100, 200], [95, 205, 400], 20);
    expect(result).toEqual([95, 205]);
  });
});

describe('monotonicNearestNeighbor — the count-mismatch fallback', () => {
  it('never assigns the same band to two boxes (the original collision bug)', () => {
    const result = monotonicNearestNeighbor([100, 102, 104], [101], 50);
    const claimed = result.filter(r => r !== null);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('rejects (null) a box with no band within maxDist rather than forcing a bad match', () => {
    const result = monotonicNearestNeighbor([100, 500], [102], 20);
    expect(result).toEqual([102, null]);
  });

  it('REGRESSION: one spurious extra band (header noise) still recovers most rows', () => {
    // Offline validation, exact data: a photo header contributed one
    // false-positive band at y=119, producing a 13-vs-12 count mismatch.
    // Monotonic-NN correctly rejects the last row (the spurious band steals a
    // slot earlier in the sequence) rather than forcing a wrong match — 11/12
    // correct, 1 honest rejection, matching the validated 92% recovery.
    const trueRows = [280, 342, 404, 466, 528, 590, 652, 714, 776, 838, 900, 962];
    const detectedBands = [119, 281, 342, 404, 466, 529, 590, 652, 713, 776, 838, 900, 962];
    const modelGuesses = [260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860, 920];
    const snapped = monotonicNearestNeighbor(modelGuesses, detectedBands, 40);
    const hits = snapped.filter((s, i) => s !== null && Math.abs(s - trueRows[i]) <= 15).length;
    expect(hits / trueRows.length).toBeCloseTo(11 / 12, 2);
    expect(snapped[snapped.length - 1]).toBeNull(); // honest rejection, not a forced wrong match
  });
});

describe('applySnap', () => {
  it('shifts a box to center on the snapped y, keeping x/w/h', () => {
    const box = { x: 10, y: 100, w: 200, h: 40 };
    const result = applySnap(box, 150); // true center should become 150
    expect(result.y + result.h / 2).toBeCloseTo(150);
    expect(result.x).toBe(10);
    expect(result.w).toBe(200);
    expect(result.h).toBe(40);
  });

  it('leaves the box UNCHANGED when snapping found no confident match', () => {
    // A rendering-time correction should never silently drop a dish the model
    // did locate — better to show its original (possibly imperfect) position
    // than to hide it.
    const box = { x: 10, y: 100, w: 200, h: 40 };
    expect(applySnap(box, null)).toEqual(box);
  });
});


describe('partitionByLargestGaps — parameter-free dish grouping', () => {
  it('REGRESSION: two-line dishes group into one row each (fixed-threshold merging split them)', () => {
    // Real failing menu's structure: each dish = main line + sub-line, gaps
    // between a dish's own lines SMALLER than gaps between dishes. Two prior
    // threshold-based merge strategies both failed on real photos; cutting at
    // the n-1 largest gaps is parameter-free and validated offline at 100%.
    const bands: [number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const top = 220 + i * 95;
      bands.push([top, top + 26]);        // main line
      bands.push([top + 40, top + 60]);   // sub-line, 14px gap (inter-dish gap: 35px)
    }
    const centers = partitionByLargestGaps(bands, 12);
    expect(centers.length).toBe(12);
    centers.forEach((c, i) => expect(Math.abs(c - (220 + i * 95 + 30))).toBeLessThanOrEqual(22));
  });

  it('single-line menus pass through unchanged (each band its own group)', () => {
    const bands: [number, number][] = Array.from({ length: 15 }, (_, i) => [80 + i * 60 - 20, 80 + i * 60 + 20]);
    const centers = partitionByLargestGaps(bands, 15);
    expect(centers.length).toBe(15);
    centers.forEach((c, i) => expect(Math.abs(c - (80 + i * 60))).toBeLessThanOrEqual(5));
  });

  it('fewer bands than dishes: returns what exists rather than fabricating rows', () => {
    const centers = partitionByLargestGaps([[100, 120], [200, 220]], 5);
    expect(centers.length).toBe(2);
  });
});

describe('envelopeFilter', () => {
  it('REGRESSION: header text bands outside the model box envelope are excluded', () => {
    // Real failure: a menu title above the dishes contributed spurious bands,
    // breaking the band-count match that the ordinal path depends on.
    const bands: [number, number][] = [[40, 80], [110, 140], [220, 250], [320, 350]];
    const kept = envelopeFilter(bands, 200, 400);
    expect(kept).toEqual([[220, 250], [320, 350]]);
  });
});
