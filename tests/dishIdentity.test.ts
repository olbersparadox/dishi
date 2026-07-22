import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dismissalBlocks, identityRecheckDue, IDENTITY_UNSURE_COOLDOWN_DAYS,
  normalizeDishName, namesWorthAsking, candidateMatches,
  nameAuthority, preferredName, ownerMenuExactMatch,
  AUTHORITY_OWNER, AUTHORITY_MENU, AUTHORITY_HUMAN, AUTHORITY_VISION,
} from '../src/lib/dishIdentity';

vi.mock('../src/lib/openrouter', () => ({
  callClaude: vi.fn(),
  parseJsonResponse: (raw: string | null) => {
    if (!raw) return null;
    try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { return null; }
  },
}));
import { callClaude } from '../src/lib/openrouter';
import { adjudicateSameDish, CONFIDENCE_FLOOR } from '../src/lib/dishMatch';

describe('normalizeDishName', () => {
  it('folds case, punctuation and width but preserves CJK', () => {
    expect(normalizeDishName('Pan-fried Turnip Cake!')).toBe('panfried turnip cake');
    expect(normalizeDishName('水晶鮮蝦餃')).toBe('水晶鮮蝦餃');
  });
});

describe('namesWorthAsking (gate 1 — deliberately over-inclusive)', () => {
  it('nominates the real duplicate pair from production', () => {
    expect(namesWorthAsking('蝦餃', '水晶鮮蝦餃')).toBe(true);
    expect(namesWorthAsking('Shrimp Dumpling', 'Steamed shrimp dumpling')).toBe(true);
  });

  it('ALSO nominates known false positives — gate 1 is not the safety net', () => {
    // These are genuinely different dishes. Gate 1 is expected to let them through;
    // gates 2 (LLM) and 3 (human) are what reject them. Asserting this explicitly so
    // nobody "fixes" gate 1 into a false sense of correctness.
    expect(namesWorthAsking('壽司', '蝦壽司')).toBe(true);
    expect(namesWorthAsking('sushi', 'shrimp sushi')).toBe(true);
  });

  it('rejects single-character CJK names that would nominate half a menu', () => {
    expect(namesWorthAsking('麵', '沙嗲牛肉公仔麵')).toBe(false);
    expect(namesWorthAsking('飯', '燒鴨叉燒飯')).toBe(false);
  });

  it('rejects unrelated names', () => {
    expect(namesWorthAsking('蛋撻', '棉花雞')).toBe(false);
    expect(namesWorthAsking('egg tart', 'cotton chicken')).toBe(false);
  });
});

describe('candidateMatches', () => {
  const target = { id: 't', name: 'Steamed shrimp dumpling', name_zh: '水晶鮮蝦餃' };

  it('finds the match on EITHER language independently', () => {
    // English names diverge completely; Chinese names still nominate it.
    const pool = [{ id: 'a', name: 'Har Gow', name_zh: '蝦餃' }];
    expect(candidateMatches(target, pool).map(d => d.id)).toEqual(['a']);
  });

  it('excludes the dish itself and dishes already in the same identity', () => {
    const linked = { id: 'x', name: 'Steamed shrimp dumpling', name_zh: '水晶鮮蝦餃', dish_identity_id: 'i1' };
    const pool = [
      { id: 'x', name: 'x', name_zh: null },
      { id: 'a', name: 'Shrimp Dumpling', name_zh: '蝦餃', dish_identity_id: 'i1' },
    ];
    expect(candidateMatches(linked, pool)).toEqual([]);
  });

  it('collapses an existing identity group to ONE thing to ask about', () => {
    const pool = [
      { id: 'a', name: 'Shrimp Dumpling', name_zh: '蝦餃', dish_identity_id: 'i9' },
      { id: 'b', name: 'shrimp dumpling', name_zh: '蝦餃', dish_identity_id: 'i9' },
    ];
    expect(candidateMatches(target, pool)).toHaveLength(1);
  });
});

describe('nameAuthority (the menu is the benchmark)', () => {
  const scan = { source: 'scan', name_edited_at: null };
  const table = { source: 'table', name_edited_at: null };
  const photo = { source: 'photo', name_edited_at: null };

  it('ranks the restaurant\u2019s printed menu above a human above a vision guess', () => {
    expect(nameAuthority(scan)).toBe(AUTHORITY_MENU);
    expect(nameAuthority(table)).toBe(AUTHORITY_MENU);
    expect(nameAuthority({ source: 'photo', name_edited_at: '2026-07-13T00:00:00Z' })).toBe(AUTHORITY_HUMAN);
    expect(nameAuthority(photo)).toBe(AUTHORITY_VISION);
    expect(AUTHORITY_MENU).toBeGreaterThan(AUTHORITY_HUMAN);
    expect(AUTHORITY_HUMAN).toBeGreaterThan(AUTHORITY_VISION);
  });

  it('DEMOTES a scan row whose name a user overwrote \u2014 it is no longer the menu\u2019s words', () => {
    expect(nameAuthority({ source: 'scan', name_edited_at: '2026-07-13T00:00:00Z' })).toBe(AUTHORITY_HUMAN);
  });

  it('puts the owner tier above the printed menu (owner authored what the OCR read)', () => {
    expect(AUTHORITY_OWNER).toBeGreaterThan(AUTHORITY_MENU);
  });
});

describe('ownerMenuExactMatch', () => {
  const items = [
    { id: 'o1', name: 'Har gow', name_zh: '蝦餃' },
    { id: 'o2', name: 'Shrimp sushi', name_zh: '蝦壽司' },
  ];

  it('matches on either language, folding cosmetic variation only', () => {
    expect(ownerMenuExactMatch({ name: 'HAR GOW', name_zh: null }, items)?.id).toBe('o1');
    expect(ownerMenuExactMatch({ name: null, name_zh: '蝦餃' }, items)?.id).toBe('o1');
    expect(ownerMenuExactMatch({ name: ' shrimp  sushi ', name_zh: null }, items)?.id).toBe('o2');
  });

  it('never matches a merely-contained name (that is the LLM path, not this one)', () => {
    // "餃" alone is contained in "蝦餃" but is NOT an exact match — must return null.
    expect(ownerMenuExactMatch({ name: null, name_zh: '餃' }, items)).toBeNull();
    expect(ownerMenuExactMatch({ name: 'Sushi', name_zh: null }, items)).toBeNull();
  });

  it('returns null for an empty target', () => {
    expect(ownerMenuExactMatch({ name: null, name_zh: null }, items)).toBeNull();
  });
});

describe('preferredName', () => {
  const menuScan: { name: string; name_zh: string; source: string; name_edited_at: string | null } =
    { name: 'Steamed shrimp dumpling', name_zh: '水晶鮮蝦餃', source: 'scan', name_edited_at: null };
  const visionPhoto: { name: string; name_zh: string; source: string; name_edited_at: string | null } =
    { name: 'Shrimp Dumpling', name_zh: '蝦餃', source: 'photo', name_edited_at: null };

  it('the menu-scan name wins over a vision guess \u2014 Jerry\u2019s rule', () => {
    const r = preferredName(visionPhoto, menuScan);
    expect(r.winner.name_zh).toBe('水晶鮮蝦餃');
    expect(r.upgraded).toBe(true);
  });

  it('the menu-scan name wins over a human rename too', () => {
    const renamed = { ...visionPhoto, name_zh: '蝦餃', name_edited_at: '2026-07-13T00:00:00Z' };
    expect(preferredName(renamed, menuScan).winner.name_zh).toBe('水晶鮮蝦餃');
  });

  it('a vision guess NEVER overwrites an established menu name', () => {
    const r = preferredName(menuScan, visionPhoto);
    expect(r.winner.name_zh).toBe('水晶鮮蝦餃');
    expect(r.upgraded).toBe(false);
  });

  it('ties go to the incumbent \u2014 a newcomer with an equal claim cannot rename a settled dish', () => {
    const other = { ...visionPhoto, name_zh: '鮮蝦餃' };
    const r = preferredName(visionPhoto, other);
    expect(r.winner.name_zh).toBe('蝦餃');
    expect(r.upgraded).toBe(false);
  });
});

describe('adjudicateSameDish (gate 2 — must REJECT, not agree)', () => {
  const target = { id: 't', name: 'Steamed shrimp dumpling', name_zh: '水晶鮮蝦餃' };
  const cands = [{ id: 'a', name: 'Shrimp Dumpling', name_zh: '蝦餃' }];
  beforeEach(() => vi.mocked(callClaude).mockReset());

  it('accepts a confident same-dish verdict', async () => {
    vi.mocked(callClaude).mockResolvedValue('[{"id":"a","same":true,"confidence":0.93}]');
    expect((await adjudicateSameDish(target, cands)).map(d => d.id)).toEqual(['a']);
  });

  it('rejects a "same" verdict below the confidence floor', async () => {
    vi.mocked(callClaude).mockResolvedValue(`[{"id":"a","same":true,"confidence":${CONFIDENCE_FLOOR - 0.01}}]`);
    expect(await adjudicateSameDish(target, cands)).toEqual([]);
  });

  it('rejects a different-dish verdict even at high confidence', async () => {
    vi.mocked(callClaude).mockResolvedValue('[{"id":"a","same":false,"confidence":0.99}]');
    expect(await adjudicateSameDish(target, cands)).toEqual([]);
  });

  it('fails CLOSED on model unavailability — never falls back to "ask anyway"', async () => {
    vi.mocked(callClaude).mockResolvedValue(null);
    expect(await adjudicateSameDish(target, cands)).toEqual([]);
  });

  it('fails CLOSED on malformed output', async () => {
    vi.mocked(callClaude).mockResolvedValue('sure, they look the same to me!');
    expect(await adjudicateSameDish(target, cands)).toEqual([]);
  });

  it('drops hallucinated ids that were never candidates', async () => {
    vi.mocked(callClaude).mockResolvedValue('[{"id":"ghost","same":true,"confidence":0.99}]');
    expect(await adjudicateSameDish(target, cands)).toEqual([]);
  });

  it('asks about only the single strongest match, never a menu of options', async () => {
    const many = [
      { id: 'a', name: 'Shrimp Dumpling', name_zh: '蝦餃' },
      { id: 'b', name: 'Har Gow', name_zh: '鮮蝦餃' },
    ];
    vi.mocked(callClaude).mockResolvedValue(
      '[{"id":"a","same":true,"confidence":0.80},{"id":"b","same":true,"confidence":0.95}]',
    );
    const out = await adjudicateSameDish(target, many);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b'); // the more confident one, not merely the first
  });

  it('never calls the model when there is nothing to adjudicate', async () => {
    expect(await adjudicateSameDish(target, [])).toEqual([]);
    expect(callClaude).not.toHaveBeenCalled();
  });
});


describe('pair verdicts (identity-confirm card, 係咪同一味？)', () => {
  const NOW = new Date('2026-07-22T12:00:00Z').getTime();
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it("a real denial ('different') blocks forever — a settled no is never re-asked", () => {
    expect(dismissalBlocks('different', daysAgo(0), NOW)).toBe(true);
    expect(dismissalBlocks('different', daysAgo(400), NOW)).toBe(true);
  });

  it("唔肯定 ('unsure') blocks only within the cooldown window, then the pair may return", () => {
    expect(dismissalBlocks('unsure', daysAgo(1), NOW)).toBe(true);
    expect(dismissalBlocks('unsure', daysAgo(IDENTITY_UNSURE_COOLDOWN_DAYS - 1), NOW)).toBe(true);
    expect(dismissalBlocks('unsure', daysAgo(IDENTITY_UNSURE_COOLDOWN_DAYS), NOW)).toBe(false);
    expect(dismissalBlocks('unsure', daysAgo(90), NOW)).toBe(false);
  });

  it('an unparseable clock fails CLOSED (blocks) — never nag on bad data', () => {
    expect(dismissalBlocks('unsure', 'not-a-date', NOW)).toBe(true);
  });

  it('identityRecheckDue: unstamped is due; a fresh no-result stamp is not; a stale one reopens', () => {
    expect(identityRecheckDue(null, NOW)).toBe(true);
    expect(identityRecheckDue(undefined, NOW)).toBe(true);
    expect(identityRecheckDue(daysAgo(1), NOW)).toBe(false);
    expect(identityRecheckDue(daysAgo(IDENTITY_UNSURE_COOLDOWN_DAYS), NOW)).toBe(true);
  });
});
