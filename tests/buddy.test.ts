import { describe, it, expect } from 'vitest';
import {
  onboardingCredit, engineConfidence, levelForConfidence, CONFIDENCE_LEVELS, ONBOARDING_MAX,
  UNLOCK_CONFIDENCE, buddyElements, growthHint, exploredDims, type BuddyInputs,
} from '../src/lib/buddy';
import { EMERGING_AT } from '../src/lib/tasteExport';
import { emptyTaste, DIMS } from '../src/lib/taste';

const inputs = (over: Partial<BuddyInputs> = {}): BuddyInputs => ({
  ratingCount: 0,
  distinctCuisines: 0,
  vector: emptyTaste(),
  cuisineAffinity: {},
  ...over,
});

// ── Onboarding endowment: real acts only, capped ─────────────────────────────────
describe('onboardingCredit — endowed progress from real acts, never fiction', () => {
  it('grows only on genuine early acts and caps at ONBOARDING_MAX', () => {
    expect(onboardingCredit(inputs())).toBeCloseTo(0.08);              // account only
    expect(onboardingCredit(inputs({ ratingCount: 1 }))).toBeCloseTo(0.17); // + first rating
    expect(onboardingCredit(inputs({ ratingCount: 3 }))).toBeCloseTo(0.25); // + getting going
    expect(onboardingCredit(inputs({ ratingCount: 999 }))).toBe(ONBOARDING_MAX); // never exceeds
  });
});

// ── The one confidence bar ───────────────────────────────────────────────────────
describe('engineConfidence — one honest bar', () => {
  it('a bare account sits at the floor, a maxed profile reaches 1', () => {
    expect(engineConfidence(inputs())).toBeCloseTo(0.08, 2); // signed in, nothing rated
    const maxed = engineConfidence(inputs({
      ratingCount: 100, distinctCuisines: 10,
      vector: Object.fromEntries(Object.keys(emptyTaste()).map(d => [d, 0.5])),
    }));
    expect(maxed).toBeCloseTo(1, 2);
  });

  it('onboarding alone can NEVER reach the export-unlock band — trained signal must', () => {
    // A day-1 user with the full endowment but no real taste evidence beyond a few
    // ratings stays below emerging: the endowment is a head start, not a shortcut.
    const dayOne = engineConfidence(inputs({ ratingCount: 3 }));
    expect(dayOne).toBeGreaterThan(0.25);            // visibly non-zero (endowed)
    expect(dayOne).toBeLessThan(0.25 + EMERGING_AT * 0.75 + 0.001); // below unlock
    expect(levelForConfidence(dayOne).name).not.toBe('Gourmand');
  });

  it('rewards variety over volume: varied ratings beat the same dish on repeat', () => {
    const grinder = engineConfidence(inputs({
      ratingCount: 20, distinctCuisines: 1,
      vector: { ...emptyTaste(), umami: 0.6, rich: 0.4 },
    }));
    const explorer = engineConfidence(inputs({
      ratingCount: 12, distinctCuisines: 5,
      vector: { ...emptyTaste(), umami: 0.4, spicy: 0.5, fresh: 0.3, sweet: -0.3, crispy: 0.4, sour: 0.2, grilled: 0.3 },
    }));
    expect(explorer).toBeGreaterThan(grinder);
  });

  it('is monotonic in ratings', () => {
    let prev = -1;
    for (let rc = 0; rc <= 60; rc++) {
      const c = engineConfidence(inputs({ ratingCount: rc, distinctCuisines: Math.min(6, Math.floor(rc / 4)) }));
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });
});

describe('levelForConfidence', () => {
  it('starts at Hatchling, tops out at the final level', () => {
    expect(levelForConfidence(0).name).toBe('Hatchling');
    expect(levelForConfidence(0).level).toBe(1);
    const top = CONFIDENCE_LEVELS[CONFIDENCE_LEVELS.length - 1];
    expect(levelForConfidence(1).name).toBe(top.name);
    expect(levelForConfidence(1).next).toBeNull();
    expect(levelForConfidence(1).progress).toBe(1);
  });

  it('the export unlock (evidence emerging) lands exactly on the Gourmand boundary', () => {
    expect(levelForConfidence(UNLOCK_CONFIDENCE).name).toBe('Gourmand');
    expect(levelForConfidence(UNLOCK_CONFIDENCE - 0.01).name).toBe('Taster'); // just below stays lower
  });

  it('progress is monotonic within a band and bounded [0,1]', () => {
    let prevLevel = 0, prevProgress = -1;
    for (let c = 0; c <= 1.0001; c += 0.02) {
      const l = levelForConfidence(Math.min(1, c));
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThanOrEqual(1);
      if (l.level === prevLevel) expect(l.progress).toBeGreaterThanOrEqual(prevProgress);
      prevLevel = l.level; prevProgress = l.progress;
    }
  });
});

// ── Simulation-honest rebase: no active user opens the app demoted (spec §6) ──────
describe('level rebase does not demote realistic active users', () => {
  // The retired XP model, reconstructed here purely to prove the new mapping never
  // regresses a real user's level. (Pathological volume-only profiles — hundreds of
  // ratings of one dish, zero explored dimensions — are intentionally valued lower
  // by the honest rebase; they are not a real usage pattern and are excluded.)
  const OLD_XP = [0, 5, 15, 35, 70, 120];
  const oldLevel = (rc: number, cui: number, dims: number) => {
    const xp = rc + cui * 3 + dims * 2;
    let l = 1; OLD_XP.forEach((t, i) => { if (xp >= t) l = i + 1; }); return l;
  };

  it('new level >= old level across the realistic active-user space', () => {
    let checked = 0;
    for (let rc = 1; rc <= 120; rc++) {
      for (const vf of [0.5, 0.8, 1.0, 1.3]) { // low..high variety, all plausible
        const dims = Math.min(DIMS.length, Math.round(rc * 0.45 * vf));
        const cui = Math.min(8, Math.round(rc * 0.22 * vf));
        // real dim names, so exploredDims (which keys off DIMS) actually counts them
        const vector = { ...emptyTaste(), ...Object.fromEntries(DIMS.slice(0, dims).map(d => [d, 0.5])) };
        const oldL = oldLevel(rc, cui, dims);
        const newL = levelForConfidence(engineConfidence(inputs({ ratingCount: rc, distinctCuisines: cui, vector }))).level;
        expect(newL, `rc=${rc} cui=${cui} dims=${dims}: old L${oldL} -> new L${newL}`).toBeGreaterThanOrEqual(oldL);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(400);
  });
});

// ── Unchanged behaviour (elements / hints / explored dims) ────────────────────────
describe('buddyElements — nothing worn without data to back it', () => {
  it('a blank profile earns nothing', () => {
    expect(buddyElements(inputs())).toEqual([]);
  });

  it('cuisine accessory requires real affinity, and picks the strongest', () => {
    expect(buddyElements(inputs({ cuisineAffinity: { japanese: 0.2 } })).filter(e => e.kind === 'cuisine')).toHaveLength(0);
    const strong = buddyElements(inputs({ cuisineAffinity: { japanese: 0.5, thai: 0.8 } }));
    expect(strong.find(e => e.kind === 'cuisine')!.id).toBe('thai');
  });

  it('auras require crossing the dim threshold, capped at two, strongest first', () => {
    expect(buddyElements(inputs({ vector: { ...emptyTaste(), spicy: 0.3 } })).filter(e => e.kind === 'aura')).toHaveLength(0);
    const many = buddyElements(inputs({ vector: { ...emptyTaste(), spicy: 0.9, fresh: 0.6, sweet: 0.5, umami: 0.7 } }));
    const auras = many.filter(e => e.kind === 'aura');
    expect(auras).toHaveLength(2);
    expect(auras[0].id).toBe('fire');
  });

  it('negative preferences never earn an aura', () => {
    expect(buddyElements(inputs({ vector: { ...emptyTaste(), spicy: -0.9 } }))).toHaveLength(0);
  });
});

describe('growthHint — always the highest-value next action', () => {
  it('walks the priority ladder as data accumulates', () => {
    expect(growthHint(inputs()).key).toBe('buddy.hint.first');
    expect(growthHint(inputs({ ratingCount: 3 })).key).toBe('buddy.hint.early');
    expect(growthHint(inputs({ ratingCount: 3 })).params!.n).toBe(2);
    expect(growthHint(inputs({ ratingCount: 8, distinctCuisines: 1 })).key).toBe('buddy.hint.cuisine');
    const manyDims = Object.fromEntries(Object.keys(emptyTaste()).map(d => [d, 0.3]));
    expect(growthHint(inputs({ ratingCount: 30, distinctCuisines: 5, vector: manyDims })).key).toBe('buddy.hint.sharp');
  });
});

describe('exploredDims', () => {
  it('counts only dims with clear signal, positive or negative', () => {
    expect(exploredDims({ ...emptyTaste(), spicy: 0.5, sweet: -0.5, umami: 0.1 })).toEqual(['sweet', 'spicy']);
  });
});
