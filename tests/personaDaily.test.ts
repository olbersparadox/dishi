import { describe, it, expect } from 'vitest';
import {
  choosePicks, personaFor, personaLine, topDims,
  PERSONA_PICKS_PER_DAY, PERSONA_PICK_MIN_SCORE, type PersonaCandidate,
} from '../src/lib/personaDaily';

// The daily job's judgement, pinned. The rule this file mostly exists to
// defend: a persona never NAMES anything that isn't in the database. Phase 0.5
// §6 measured one inventing three restaurants with prices, in character,
// convincingly — precomputing that would ship the failure daily to everyone.

const cand = (over: Partial<PersonaCandidate> = {}): PersonaCandidate => ({
  dish_id: 'd1', restaurant_id: 'r1', restaurant: '新記',
  name: 'Beef chow fun', name_zh: '乾炒牛河', cuisine: 'cantonese',
  attributes: { umami: 0.9, rich: 0.7, sweet: 0.2 }, score: 0.8,
  ...over,
});

describe('choosePicks — what may become a pick', () => {
  it('drops a candidate with no restaurant: the venue is the part that must be verified', () => {
    expect(choosePicks([cand({ restaurant: null })], '2026-07-28')).toHaveLength(0);
  });

  it('drops a dish nobody actually liked — a pick is not "a dish that exists"', () => {
    expect(choosePicks([cand({ score: PERSONA_PICK_MIN_SCORE - 0.01 })], '2026-07-28')).toHaveLength(0);
    expect(choosePicks([cand({ score: PERSONA_PICK_MIN_SCORE })], '2026-07-28')).toHaveLength(1);
  });

  it('shows one NAME once — three shops of 乾炒牛河 is a list, not a day of picks', () => {
    const rows = choosePicks([
      cand({ dish_id: 'a', score: 0.9 }),
      cand({ dish_id: 'b', restaurant: '大記', score: 0.85 }),
      cand({ dish_id: 'c', restaurant: '和記', score: 0.8 }),
    ], '2026-07-28');
    expect(rows).toHaveLength(1);
    expect(rows[0].restaurant_id).toBe('r1');
  });

  it('caps each persona per day', () => {
    // Many distinct dishes; whatever lands on one persona is capped.
    const many = Array.from({ length: 40 }, (_, i) =>
      cand({ dish_id: `dish-${i}`, name: `dish ${i}`, name_zh: `菜${i}`, score: 0.9 - i * 0.001 }));
    const rows = choosePicks(many, '2026-07-28');
    for (const p of ['spoon', 'ck', 'kiki']) {
      expect(rows.filter(r => r.persona === p).length).toBeLessThanOrEqual(PERSONA_PICKS_PER_DAY);
    }
  });

  it('an empty day is a legitimate outcome, not an error', () => {
    expect(choosePicks([], '2026-07-28')).toEqual([]);
  });
});

describe('the line', () => {
  it('names ONLY what it was handed — no venue, dish or number is generated', () => {
    const line = personaLine('spoon', {
      name: 'Beef chow fun', name_zh: '乾炒牛河', restaurant: '新記',
      attributes: { umami: 0.9, rich: 0.7 },
    });
    expect(line.zh).toContain('新記');
    expect(line.zh).toContain('乾炒牛河');
    expect(line.en).toContain('新記');
    // Nothing numeric can appear: prices are what the fabricating persona
    // attached to its invented restaurants.
    expect(line.zh).not.toMatch(/\d/);
    expect(line.en).not.toMatch(/\d/);
  });

  it('reads as the same pick in both languages', () => {
    const line = personaLine('kiki', {
      name: 'Char siu', name_zh: '叉燒', restaurant: '再興', attributes: {},
    });
    expect(line.zh).toContain('再興');
    expect(line.en).toContain('再興');
    expect(line.en).toContain('Char siu');
  });

  it('quotes only attributes the dish actually reports', () => {
    // 0.2 is not a claim the dish made about itself — absent evidence, not a
    // weak positive.
    expect(topDims({ umami: 0.9, rich: 0.7, sweet: 0.2 })).toEqual(['umami', 'rich']);
    expect(topDims({})).toEqual([]);
  });
});

describe('persona assignment', () => {
  it('is stable — a dish does not change character between days', () => {
    expect(personaFor('dish-abc')).toBe(personaFor('dish-abc'));
  });
});
