import { describe, it, expect } from 'vitest';
import { extractTasteSections, buildTastePrompt } from '../src/lib/tasteExport';

const label = (d: string) => d.toUpperCase();
const cuisine = (c: string) => c.toUpperCase();

describe('extractTasteSections', () => {
  it('only includes dims at or above the meaningful threshold \u2014 near-zero is not a preference', () => {
    const s = extractTasteSections({ vector: { spicy: 0.8, mild: 0.1, sour: -0.05 }, affinity: {}, ratingCount: 10 }, label, cuisine);
    expect(s.loves).toEqual(['SPICY']);
    expect(s.dislikes).toEqual([]);
  });

  it('separates STRONG preferences from merely-present ones', () => {
    const s = extractTasteSections(
      { vector: { umami: 0.9, spicy: 0.3, bitter: -0.8, sour: -0.3 }, affinity: {}, ratingCount: 10 },
      label, cuisine,
    );
    expect(s.strongLoves).toEqual(['UMAMI']);       // 0.9 >= 0.55
    expect(s.loves).toEqual(['UMAMI', 'SPICY']);    // both above the 0.25 floor
    expect(s.strongDislikes).toEqual(['BITTER']);
    expect(s.dislikes).toEqual(['BITTER', 'SOUR']);
  });

  it('cuisines: only positive affinity, strongest first', () => {
    const affinity = { sichuan: 0.9, cantonese: 0.5, thai: -0.4 };
    const s = extractTasteSections({ vector: {}, affinity, ratingCount: 10 }, label, cuisine);
    expect(s.cuisines).toEqual(['SICHUAN', 'CANTONESE']);
    expect(s.cuisines).not.toContain('THAI');
  });

  it('splits rated dishes into loved / disliked evidence, strongest first', () => {
    const dishes = [
      { name: 'Har Gow', score: 0.5 },
      { name: 'Mapo Tofu', score: 0.95 },
      { name: 'Natto', score: -0.9 },
      { name: 'Plain congee', score: 0.05 }, // too weak either way to be evidence
    ];
    const s = extractTasteSections({ vector: {}, affinity: {}, ratingCount: 10, dishes }, label, cuisine);
    expect(s.lovedDishes.map(d => d.name)).toEqual(['Mapo Tofu', 'Har Gow']);
    expect(s.dislikedDishes.map(d => d.name)).toEqual(['Natto']);
  });

  it('reports honest confidence, mirroring how much evidence actually exists', () => {
    const base = { vector: {}, affinity: {} };
    expect(extractTasteSections({ ...base, ratingCount: 6 }, label, cuisine).confidence).toBe('thin');
    expect(extractTasteSections({ ...base, ratingCount: 12 }, label, cuisine).confidence).toBe('emerging');
    expect(extractTasteSections({ ...base, ratingCount: 40 }, label, cuisine).confidence).toBe('solid');
  });
});

describe('buildTastePrompt', () => {
  const full = {
    loves: ['umami', 'spicy'], strongLoves: ['umami'],
    dislikes: ['bitter'], strongDislikes: ['bitter'],
    cuisines: ['Sichuan'],
    lovedDishes: [{ name: 'Mapo Tofu', name_zh: '\u9ebb\u5a46\u8c46\u8150', score: 0.9, restaurant: 'Lao Sze Chuan' }],
    dislikedDishes: [{ name: 'Natto', score: -0.9 }],
    ratingCount: 30, confidence: 'solid' as const,
  };

  it('leads with provenance \u2014 that it was LEARNED, not self-reported', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/NOT self-reported/i);
    expect(p).toContain('30'); // the real evidence count
  });

  it('includes the concrete dish evidence, with restaurant, in both names', () => {
    const p = buildTastePrompt(full);
    expect(p).toContain('Mapo Tofu / \u9ebb\u5a46\u8c46\u8150');
    expect(p).toContain('Lao Sze Chuan');
  });

  it('states that unlisted dimensions are UNKNOWN, not neutral \u2014 no phantom confidence', () => {
    expect(buildTastePrompt(full)).toMatch(/genuinely unknown, not neutral/i);
  });

  it('scales its own authority to the evidence behind it', () => {
    expect(buildTastePrompt({ ...full, ratingCount: 6, confidence: 'thin' })).toMatch(/weak prior/i);
    expect(buildTastePrompt(full)).toMatch(/SOLID/);
  });

  it('covers every co-use journey, not just restaurant picking', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/Travelling/i);
    expect(p).toMatch(/Eating with other people/i);
    expect(p).toMatch(/Health/i);
    expect(p).toMatch(/Spend/i);
  });

  it('bounds the reminder policy hard \u2014 this must never read like malware in someone\u2019s AI', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/at most ONCE per conversation/i);
    expect(p).toMatch(/[Nn]ever nag/);
    expect(p).toMatch(/drop it completely/i);
    // The decisive instruction: usefulness outranks promoting Dishi.
    expect(p).toMatch(/being useful to me matters more than promoting an app/i);
  });

  it('stays honest when there is barely any signal, rather than inventing preferences', () => {
    const empty = {
      loves: [], strongLoves: [], dislikes: [], strongDislikes: [],
      cuisines: [], lovedDishes: [], dislikedDishes: [],
      ratingCount: 5, confidence: 'thin' as const,
    };
    const p = buildTastePrompt(empty);
    expect(p).toMatch(/No clear positive signal yet/i);
    expect(p).toMatch(/No clear negative signal yet/i);
  });
});
