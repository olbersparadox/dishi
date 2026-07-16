import { describe, it, expect } from 'vitest';
import { rankForGroup, generateTableCode, type GroupMember } from '../src/lib/group';
import { emptyTaste } from '../src/lib/taste';

const member = (handle: string, prefs: Record<string, number>, count = 10): GroupMember => ({
  user_id: handle, handle,
  vector: { ...emptyTaste(), ...prefs },
  cuisine_affinity: {},
  rating_count: count,
});

describe('rankForGroup — the fairness guarantee', () => {
  it('a dish everyone quite likes beats a dish three love and one hates', () => {
    // Three spice-lovers, one spice-hater.
    const members = [
      member('a', { spicy: 0.9 }),
      member('b', { spicy: 0.8 }),
      member('c', { spicy: 0.9 }),
      member('d', { spicy: -0.9, tender: 0.7, umami: 0.6 }),
    ];
    const firePot = { key: 'fire', attributes: { spicy: 0.95 }, cuisine: null };
    // Everyone mildly-to-quite likes this one; nobody hates it.
    const braise = { key: 'braise', attributes: { tender: 0.6, umami: 0.6 }, cuisine: null };

    // Sanity: plain averaging would pick the fire pot (3 strong positives vs 1 strong negative).
    const ranked = rankForGroup([firePot, braise], members);
    expect(ranked[0].item.key).toBe('braise');
  });

  it('exposes per-member matches transparently', () => {
    const members = [member('a', { spicy: 0.9 }), member('b', { spicy: -0.9 })];
    const ranked = rankForGroup([{ key: 'x', attributes: { spicy: 1 }, cuisine: null }], members);
    expect(ranked[0].member_matches).toHaveLength(2);
    const byHandle = Object.fromEntries(ranked[0].member_matches.map(m => [m.handle, m.match]));
    expect(byHandle.a).toBeGreaterThan(byHandle.b);
  });

  it('excludes members with no profile from the math instead of flattening it', () => {
    const withGhost = [
      member('a', { spicy: 0.9 }),
      member('ghost', {}, 0), // 0 ratings -> excluded
    ];
    const alone = [member('a', { spicy: 0.9 })];
    const dish = { key: 'x', attributes: { spicy: 1 }, cuisine: null };
    expect(rankForGroup([dish], withGhost)[0].group_match)
      .toBe(rankForGroup([dish], alone)[0].group_match);
    // and the ghost doesn't appear in the transparency bars
    expect(rankForGroup([dish], withGhost)[0].member_matches).toHaveLength(1);
  });

  it('returns neutral 50s when nobody has a profile', () => {
    const ranked = rankForGroup(
      [{ key: 'x', attributes: { spicy: 1 }, cuisine: null }],
      [member('ghost', {}, 0)],
    );
    expect(ranked[0].group_match).toBe(50);
    expect(ranked[0].member_matches).toHaveLength(0);
  });

  it('flags unanimity only when every profiled member clears the bar', () => {
    const happy = [member('a', { umami: 0.8 }), member('b', { umami: 0.7 })];
    const split = [member('a', { umami: 0.8 }), member('b', { umami: -0.8 })];
    const dish = { key: 'x', attributes: { umami: 0.9 }, cuisine: null };
    expect(rankForGroup([dish], happy)[0].unanimous).toBe(true);
    expect(rankForGroup([dish], split)[0].unanimous).toBe(false);
  });

  it('flags dishes whose rank was materially changed by the fairness term', () => {
    const members = [
      member('a', { spicy: 0.9 }), member('b', { spicy: 0.9 }), member('c', { spicy: -0.9 }),
    ];
    const divisive = rankForGroup([{ key: 'x', attributes: { spicy: 1 }, cuisine: null }], members)[0];
    expect(divisive.protected_by_fairness).toBe(true);

    const agreeable = rankForGroup(
      [{ key: 'y', attributes: { umami: 0.5 }, cuisine: null }],
      [member('a', { umami: 0.5 }), member('b', { umami: 0.5 })],
    )[0];
    expect(agreeable.protected_by_fairness).toBe(false);
  });

  it('handles an empty item list', () => {
    expect(rankForGroup([], [member('a', { spicy: 1 })])).toEqual([]);
  });

  it('shows visible separation across an all-aligned menu instead of saturating at 100', () => {
    // Two people who love umami + tender + rich; a menu where every dish is a strong
    // match. The OLD fixed-gain display clamped these all to 100; relative display
    // must spread them so the best and worst still differ.
    const members = [
      member('a', { umami: 0.9, tender: 0.9, rich: 0.9 }),
      member('b', { umami: 0.8, tender: 0.8, rich: 0.8 }),
    ];
    const dishes = [
      { key: 'best', attributes: { umami: 0.95, tender: 0.95, rich: 0.95 }, cuisine: null },
      { key: 'mid', attributes: { umami: 0.9, tender: 0.7, rich: 0.6 }, cuisine: null },
      { key: 'least', attributes: { umami: 0.6, tender: 0.5, rich: 0.4 }, cuisine: null },
    ];
    const ranked = rankForGroup(dishes, members);
    const matches = ranked.map(r => r.group_match);
    // Not all identical — the display actually separates them.
    expect(new Set(matches).size).toBeGreaterThan(1);
    // Nothing pinned at a saturated 100.
    expect(Math.max(...matches)).toBeLessThanOrEqual(95);
    // Order still reflects true strength (best first, least last).
    expect(ranked[0].item.key).toBe('best');
    expect(ranked[ranked.length - 1].item.key).toBe('least');
  });
});

describe('generateTableCode', () => {
  it('is 5 chars from the ambiguity-free alphabet, every time', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTableCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
      expect(code).not.toContain('L');
    }
  });
});
