import { describe, it, expect } from 'vitest';
import {
  computeXP, levelFor, engineStrength, buddyElements, growthHint,
  exploredDims, LEVELS, type BuddyInputs,
} from '../src/lib/buddy';
import { emptyTaste } from '../src/lib/taste';

const inputs = (over: Partial<BuddyInputs> = {}): BuddyInputs => ({
  ratingCount: 0,
  distinctCuisines: 0,
  vector: emptyTaste(),
  cuisineAffinity: {},
  ...over,
});

describe('computeXP — the honest economics', () => {
  it('rewards variety over volume: 10 varied ratings beat 20 identical ones', () => {
    // 20 ratings of the same ramen: one cuisine, umami-ish profile only.
    const grinder = computeXP(inputs({
      ratingCount: 20, distinctCuisines: 1,
      vector: { ...emptyTaste(), umami: 0.6, rich: 0.4 },
    }));
    // 10 ratings across 5 cuisines, many dims explored.
    const explorer = computeXP(inputs({
      ratingCount: 10, distinctCuisines: 5,
      vector: { ...emptyTaste(), umami: 0.4, spicy: 0.5, fresh: 0.3, sweet: -0.3, crispy: 0.4, sour: 0.2, grilled: 0.3 },
    }));
    expect(explorer).toBeGreaterThan(grinder);
  });

  it('is 0 for a brand-new user', () => {
    expect(computeXP(inputs())).toBe(0);
  });
});

describe('levelFor', () => {
  it('starts at Hatchling and ends at the final level', () => {
    expect(levelFor(0).name).toBe('Hatchling');
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(99999).name).toBe(LEVELS[LEVELS.length - 1].name);
    expect(levelFor(99999).next).toBeNull();
    expect(levelFor(99999).progress).toBe(1);
  });

  it('reports remaining XP to the next level', () => {
    const l = levelFor(10); // Nibbler (5) -> Taster at 15
    expect(l.name).toBe('Nibbler');
    expect(l.next!.name).toBe('Taster');
    expect(l.next!.remaining).toBe(5);
  });

  it('progress is monotonic in xp and bounded [0, 1]', () => {
    let prevLevel = 0, prevProgress = -1;
    for (let xp = 0; xp <= 150; xp += 5) {
      const l = levelFor(xp);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThanOrEqual(1);
      if (l.level === prevLevel) expect(l.progress).toBeGreaterThanOrEqual(prevProgress);
      prevLevel = l.level; prevProgress = l.progress;
    }
  });
});

describe('engineStrength', () => {
  it('is 0 for a new user and caps at 100', () => {
    expect(engineStrength(inputs())).toBe(0);
    expect(engineStrength(inputs({
      ratingCount: 1000, distinctCuisines: 30,
      vector: Object.fromEntries(Object.keys(emptyTaste()).map(d => [d, 0.5])),
    }))).toBe(100);
  });

  it('grows with each kind of signal independently', () => {
    const base = engineStrength(inputs({ ratingCount: 5 }));
    const withCuisines = engineStrength(inputs({ ratingCount: 5, distinctCuisines: 3 }));
    const withDims = engineStrength(inputs({
      ratingCount: 5, distinctCuisines: 3,
      vector: { ...emptyTaste(), spicy: 0.5, umami: 0.4 },
    }));
    expect(withCuisines).toBeGreaterThan(base);
    expect(withDims).toBeGreaterThan(withCuisines);
  });
});

describe('buddyElements — nothing worn without data to back it', () => {
  it('a blank profile earns nothing', () => {
    expect(buddyElements(inputs())).toEqual([]);
  });

  it('cuisine accessory requires real affinity, and picks the strongest', () => {
    const weak = buddyElements(inputs({ cuisineAffinity: { japanese: 0.2 } }));
    expect(weak.filter(e => e.kind === 'cuisine')).toHaveLength(0);

    const strong = buddyElements(inputs({ cuisineAffinity: { japanese: 0.5, thai: 0.8 } }));
    const cuisine = strong.find(e => e.kind === 'cuisine');
    expect(cuisine!.id).toBe('thai');
  });

  it('auras require crossing the dim threshold, capped at two, strongest first', () => {
    const none = buddyElements(inputs({ vector: { ...emptyTaste(), spicy: 0.3 } }));
    expect(none.filter(e => e.kind === 'aura')).toHaveLength(0);

    const many = buddyElements(inputs({
      vector: { ...emptyTaste(), spicy: 0.9, fresh: 0.6, sweet: 0.5, umami: 0.7 },
    }));
    const auras = many.filter(e => e.kind === 'aura');
    expect(auras).toHaveLength(2);
    expect(auras[0].id).toBe('fire'); // spicy 0.9 is the strongest signal
  });

  it('negative preferences never earn an aura', () => {
    const e = buddyElements(inputs({ vector: { ...emptyTaste(), spicy: -0.9 } }));
    expect(e).toHaveLength(0);
  });
});

describe('growthHint — always the highest-value next action', () => {
  it('walks the priority ladder as data accumulates', () => {
    expect(growthHint(inputs()).key).toBe('buddy.hint.first');
    expect(growthHint(inputs({ ratingCount: 3 })).key).toBe('buddy.hint.early');
    expect(growthHint(inputs({ ratingCount: 3 })).params!.n).toBe(2);
    expect(growthHint(inputs({ ratingCount: 8, distinctCuisines: 1 })).key).toBe('buddy.hint.cuisine');
    const manyDims = Object.fromEntries(Object.keys(emptyTaste()).map(d => [d, 0.3]));
    expect(growthHint(inputs({ ratingCount: 30, distinctCuisines: 5, vector: manyDims })).key)
      .toBe('buddy.hint.sharp');
  });
});

describe('exploredDims', () => {
  it('counts only dims with clear signal, positive or negative', () => {
    expect(exploredDims({ ...emptyTaste(), spicy: 0.5, sweet: -0.5, umami: 0.1 }))
      .toEqual(['sweet', 'spicy']);
  });
});
