import { describe, it, expect } from 'vitest';
import {
  versionSubstrate, versionThreshold, versionForProfile, ratchetVersion,
} from '../src/lib/version';
import { evidenceConfidence, exportUnlocked, type ConfidenceInputs } from '../src/lib/tasteExport';

// dishi versions: the unbounded ladder replacing Levels. These tests pin the four
// contract points from the backlog — v1 ≡ export unlock, monotone growth, ratchet,
// and the pacing curve — so a future curve tweak is a conscious diff, not an accident.

const ci = (ratingCount: number, exploredDimCount: number, distinctCuisines: number): ConfidenceInputs =>
  ({ ratingCount, exploredDimCount, distinctCuisines });

// ── v1 ≡ export unlock: the same fact, never two thresholds ──────────────────────
describe('v1 is the export unlock', () => {
  it('version >= 1 exactly when the export is unlocked, across a broad input grid', () => {
    for (let rc = 0; rc <= 60; rc += 3) {
      for (let dims = 0; dims <= 18; dims += 6) {
        for (let cs = 0; cs <= 12; cs += 3) {
          const inputs = ci(rc, dims, cs);
          const unlocked = exportUnlocked(evidenceConfidence(inputs));
          expect(versionForProfile(inputs).version >= 1).toBe(unlocked);
        }
      }
    }
  });

  it('no substrate value can mint v2 while the export is locked (structural guard)', () => {
    // Impossible-in-real-data mix (distinct cuisines can't exceed ratings), but the
    // guard must be structural, not an assumption about realistic inputs.
    const weird = ci(2, 0, 45);
    expect(exportUnlocked(evidenceConfidence(weird))).toBe(false);
    expect(versionSubstrate(weird)).toBeGreaterThan(versionThreshold(2));
    expect(versionForProfile(weird).version).toBe(0);
  });
});

// ── Monotone: more honest signal never lowers the version ────────────────────────
describe('monotonicity', () => {
  it('version and substrate are non-decreasing in rating volume', () => {
    let prevV = -1; let prevS = -1;
    for (let rc = 0; rc <= 400; rc += 5) {
      const st = versionForProfile(ci(rc, 12, 8));
      expect(st.version).toBeGreaterThanOrEqual(prevV);
      expect(st.substrate).toBeGreaterThanOrEqual(prevS);
      prevV = st.version; prevS = st.substrate;
    }
  });

  it('version is non-decreasing in cuisine variety (diversity always helps)', () => {
    let prev = -1;
    for (let cs = 0; cs <= 30; cs++) {
      const v = versionForProfile(ci(60, 14, cs)).version;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('diversity keeps its outsized weight: a new cuisine holds full value while the same-groove rating decays', () => {
    // A new cuisine is worth the same substrate at any depth; a marginal rating decays
    // (the 30th identical ramen teaches ~nothing). So diversity's RELATIVE worth grows.
    const cuisineGainShallow = versionSubstrate(ci(30, 12, 6)) - versionSubstrate(ci(30, 12, 5));
    const cuisineGainDeep = versionSubstrate(ci(200, 12, 6)) - versionSubstrate(ci(200, 12, 5));
    expect(cuisineGainDeep).toBeCloseTo(cuisineGainShallow, 10); // constant

    const ratingGainShallow = versionSubstrate(ci(31, 12, 5)) - versionSubstrate(ci(30, 12, 5));
    const ratingGainDeep = versionSubstrate(ci(201, 12, 5)) - versionSubstrate(ci(200, 12, 5));
    expect(ratingGainDeep).toBeLessThan(ratingGainShallow); // decaying

    // At depth, one genuinely new cuisine outweighs even a couple more of the same.
    const twoMoreRatingsDeep = versionSubstrate(ci(202, 12, 5)) - versionSubstrate(ci(200, 12, 5));
    expect(cuisineGainDeep).toBeGreaterThan(twoMoreRatingsDeep);
  });
});

// ── Replay determinism: pure function of the inputs, nothing else ────────────────
describe('replay determinism', () => {
  it('identical inputs always produce the identical state (recompute-from-history safe)', () => {
    const inputs = ci(37, 11, 7);
    expect(versionForProfile(inputs)).toEqual(versionForProfile({ ...inputs }));
  });
});

// ── The ratchet: unlocks are history, never demoted ──────────────────────────────
describe('ratchetVersion', () => {
  it('keeps the higher of stored and live — deleting ratings never demotes', () => {
    expect(ratchetVersion(3, 1)).toBe(3); // live dipped after deletions → stays v3
    expect(ratchetVersion(0, 2)).toBe(2); // fresh unlock ratchets up
    expect(ratchetVersion(2, 2)).toBe(2);
  });

  it('progress may honestly dip even while the version holds (the documented tradeoff)', () => {
    const before = versionForProfile(ci(80, 14, 8));
    const afterDeletions = versionForProfile(ci(60, 14, 8));
    expect(afterDeletions.progress).toBeLessThan(before.progress);
    expect(ratchetVersion(before.version, afterDeletions.version)).toBe(before.version);
  });
});

// ── Pacing snapshot: the curve itself, pinned ────────────────────────────────────
describe('pacing snapshot (a curve tweak must be a conscious diff)', () => {
  it('threshold table T(2..10)', () => {
    const T = (n: number) => Number(versionThreshold(n).toFixed(3));
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map(T)).toEqual([
      1.15, 1.963, 2.978, 4.248, 5.835, 7.818, 10.298, 13.397, 17.272,
    ]);
  });

  it('the reference account (25 flicks / 8 cuisines / 10 dims) sits at v1, ~2/3 to v2', () => {
    const st = versionForProfile(ci(25, 10, 8));
    expect(st.version).toBe(1);
    expect(st.progress).toBeGreaterThan(0.55);
    expect(st.progress).toBeLessThan(0.75);
  });

  it('a good first week of normal use (~50 varied ratings) reaches v2', () => {
    expect(versionForProfile(ci(50, 12, 8)).version).toBe(2);
  });

  it('early versions come fast, later ones slow: v-gap widens every step', () => {
    for (let n = 3; n <= 12; n++) {
      const gapPrev = versionThreshold(n) - versionThreshold(n - 1);
      const gapNext = versionThreshold(n + 1) - versionThreshold(n);
      expect(gapNext).toBeGreaterThan(gapPrev);
    }
  });

  it('unbounded: heavy long-term use keeps unlocking (no ceiling)', () => {
    expect(versionForProfile(ci(400, 18, 15)).version).toBeGreaterThanOrEqual(4);
    expect(versionForProfile(ci(5000, 18, 25)).version).toBeGreaterThan(
      versionForProfile(ci(400, 18, 15)).version,
    );
  });
});
