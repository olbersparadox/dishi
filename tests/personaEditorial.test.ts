// The editorial grounding contract (BACKLOG batch 2026-07-29). These tests ARE
// the §6 re-scope's teeth: a persona line may rephrase its pack, never extend
// it — invented money, invented numbers, invented names, and venue-speak all
// fail closed, and register rules (persona.ts neverDoes) are enforced, not
// hoped. Hand-authored sample lines go through this same gate.
import { describe, expect, it } from 'vitest';
import { validateEditorialBody, validateEditorialPost, type GroundingPack } from '../src/lib/personaEditorial';

const KHAO_SOI: GroundingPack = {
  name: 'Khao soi',
  name_zh: '泰北咖喱麵',
  cuisine: 'thai',
  facts_zh: ['清邁名物', '椰漿咖喱湯底', '一半軟蛋麵一半炸脆麵', '配醃芥菜同紅蔥頭'],
  facts_en: ['Chiang Mai signature', 'coconut curry broth', 'boiled egg noodles under a crown of the same noodles fried crisp', 'served with pickled mustard greens and shallots'],
  signal: null,
};

const TREND: GroundingPack = {
  name: 'Dubai chocolate',
  name_zh: '杜拜朱古力',
  cuisine: 'dessert',
  facts_zh: ['流心開心果醬夾 kunafa 脆絲', '2024 年喺社交平台爆紅'],
  facts_en: ['pistachio cream and shredded kunafa inside a chocolate bar', 'went viral on social platforms in 2024'],
  signal: 'Reddit r/food',
};

describe('grounding: the line may rephrase the pack, never extend it', () => {
  it('a clean sensory line passes', () => {
    const r = validateEditorialBody('spoon', KHAO_SOI, '脆麵沉落椰漿咖喱湯嗰三秒，係成碗嘅意義。慢慢嚟。', 'zh');
    expect(r).toEqual({ ok: true, reasons: [] });
  });

  it('invented prices fail — currency is banned outright', () => {
    expect(validateEditorialBody('spoon', KHAO_SOI, '呢碗嘢 $88 好抵。', 'zh').reasons).toContain('currency: editorial posts never state prices');
    expect(validateEditorialBody('spoon', KHAO_SOI, '大概 88 蚊一碗。', 'zh').ok).toBe(false);
  });

  it('a number fails unless the pack contains it', () => {
    const bad = validateEditorialBody('ck', KHAO_SOI, 'The broth simmers for 14 hours.', 'en');
    expect(bad.reasons).toContain('ungrounded number: 14');
    // 2024 IS in the trend pack — sourced, so it passes.
    const ok = validateEditorialBody('ck', TREND, 'It surfaced in 2024, as these things do.', 'en');
    expect(ok.ok).toBe(true);
  });

  it('a Latin proper noun fails unless the pack contains it — §6 in a nicer shirt', () => {
    const bad = validateEditorialBody('ck', KHAO_SOI, 'Best eaten at Mandarin Oriental, naturally.', 'en');
    expect(bad.reasons.some(r => r.startsWith('ungrounded name:'))).toBe(true);
    // Chiang Mai is in the pack; sentence-initial "The" is exempt by design.
    const ok = validateEditorialBody('ck', KHAO_SOI, 'The Chiang Mai original asks two questions.', 'en');
    expect(ok.ok).toBe(true);
  });

  it('venue-speak fails even with no name attached', () => {
    expect(validateEditorialBody('kiki', TREND, '地址喺樓下 📍 快啲去 🏃‍♀️', 'zh').reasons.some(r => r.startsWith('venue-speak'))).toBe(true);
  });
});

describe('register: neverDoes is enforced, not hoped', () => {
  it('CK never uses emoji', () => {
    expect(validateEditorialBody('ck', KHAO_SOI, '魚新鮮，火候啱 👍', 'zh').reasons).toContain('register: CK never uses emoji');
  });

  it('Kiki uses 2–4 emoji — 1 is not her, 5 is a wall she never builds', () => {
    expect(validateEditorialBody('kiki', TREND, '爆紅嘅杜拜朱古力 🔥', 'zh').ok).toBe(false);
    expect(validateEditorialBody('kiki', TREND, '杜拜朱古力 🔥 開心果流心 🤤 值唔值？', 'zh').ok).toBe(true);
    expect(validateEditorialBody('kiki', TREND, '杜拜朱古力 🔥🔥🔥🔥🔥 誇張', 'zh').reasons).toContain('register: emoji wall');
  });

  it('a ZWJ emoji counts once — register counts what a reader sees', () => {
    // 🙅‍♀️ is ONE grapheme (reader sees one mark) but TWO pictographic
    // codepoints. Grapheme-counting reads this line as 1 emoji → below Kiki's
    // floor → rejected; codepoint-counting would read 2 and wrongly pass it.
    const r = validateEditorialBody('kiki', TREND, '杜拜朱古力唔啱你 🙅‍♀️', 'zh');
    expect(r.reasons).toContain('register: Kiki uses 2–4 emoji (got 1)');
  });

  it('Spoon never clusters exclamation marks', () => {
    expect(validateEditorialBody('spoon', KHAO_SOI, '正!! 快啲食!!', 'zh').reasons).toContain('register: Spoon never clusters exclamation marks');
  });
});

describe('validateEditorialPost gates both languages at once', () => {
  it('a violation in either language fails the post, labelled by language', () => {
    const r = validateEditorialPost('spoon', KHAO_SOI, {
      body_zh: '脆麵沉落椰漿咖喱湯，慢慢嚟。',
      body_en: 'Costs $12 and worth every cent.',
    });
    expect(r.ok).toBe(false);
    expect(r.reasons.every(x => x.startsWith('en:'))).toBe(true);
  });
});

// The one-author tell (owner voice pass, 2026-07-29): every early sample
// pivoted on 「——」/「—」, so three "different" columnists shared one habit.
// The ban is register, not grounding — it applies to all personas, both
// languages, and the fix is always to pivot with punctuation the persona
// actually owns (Spoon: a full stop and a short sentence; CK: a colon or a
// dry second clause; Kiki: an emoji beat).
describe('em-dash ban — the ghostwriter tell', () => {
  const pack: GroundingPack = {
    name: 'Congee', name_zh: '粥', cuisine: 'cantonese',
    facts_zh: ['慢火'], facts_en: ['slow fire'], signal: null,
  };
  it('rejects the CJK double dash and the single em-dash, any persona', () => {
    expect(validateEditorialBody('ck', pack, '粥要慢火——呢樣冇得急。', 'zh').ok).toBe(false);
    expect(validateEditorialBody('spoon', pack, 'Congee asks for slow fire — and patience.', 'en').ok).toBe(false);
  });
  it('accepts the same pivot written as the persona would write it', () => {
    expect(validateEditorialBody('ck', pack, '粥要慢火。呢樣冇得急。', 'zh').ok).toBe(true);
    expect(validateEditorialBody('spoon', pack, 'Congee asks for slow fire. And patience.', 'en').ok).toBe(true);
  });
});
