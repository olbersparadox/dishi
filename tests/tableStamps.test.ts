import { describe, it, expect } from 'vitest';
import { stampsFromPicks, pickMatchesItem, mergeStamps, applyStampEvent, type Stamp, type StampOverlay } from '../src/lib/tableStamps';

const pick = (over: Partial<Parameters<typeof stampsFromPicks>[1][number]> = {}) => ({
  user_id: 'u1', name: 'Seafood donburi', name_zh: '海鮮丼',
  display_name: null as string | null, handle: 'mosuko',
  identity_name: null, identity_name_zh: null,
  ...over,
});

describe('stampsFromPicks', () => {
  it('matches on the English name', () => {
    const out = stampsFromPicks({ name: 'Seafood donburi', name_zh: null }, [pick()]);
    expect(out).toEqual([{ user_id: 'u1', name: 'mosuko' }]);
  });

  it('matches on the Chinese name when English differs', () => {
    const out = stampsFromPicks({ name: 'something else', name_zh: '海鮮丼' }, [pick()]);
    expect(out).toEqual([{ user_id: 'u1', name: 'mosuko' }]);
  });

  it('matches via a linked canonical identity name, not just the raw pick name', () => {
    const out = stampsFromPicks(
      { name: '水晶鮮蝦餃', name_zh: null },
      [pick({ name: '蝦餃', name_zh: null, identity_name: '水晶鮮蝦餃' })],
    );
    expect(out).toHaveLength(1);
  });

  it('is case/whitespace insensitive', () => {
    const out = stampsFromPicks({ name: '  SEAFOOD DONBURI  ', name_zh: null }, [pick()]);
    expect(out).toHaveLength(1);
  });

  it('prefers display_name over the auto-handle when both exist', () => {
    const out = stampsFromPicks({ name: 'Seafood donburi', name_zh: null }, [pick({ display_name: '阿哲' })]);
    expect(out[0].name).toBe('阿哲');
  });

  it('does not match an unrelated dish', () => {
    const out = stampsFromPicks({ name: 'Roast duck wings', name_zh: null }, [pick()]);
    expect(out).toEqual([]);
  });

  it('dedupes to one stamp per user_id even with multiple matching rows', () => {
    const out = stampsFromPicks(
      { name: 'Seafood donburi', name_zh: null },
      [pick(), pick({ name_zh: '海鮮丼' })], // same user_id twice
    );
    expect(out).toHaveLength(1);
  });

  it('two different members picking the same dish both appear', () => {
    const out = stampsFromPicks(
      { name: 'Seafood donburi', name_zh: null },
      [pick({ user_id: 'u1' }), pick({ user_id: 'u2', handle: 'friend' })],
    );
    expect(out.map(s => s.user_id).sort()).toEqual(['u1', 'u2']);
  });

  // Regression (found live, 2026-07-21): a real 32-dish menu printed the same
  // 叉燒 short-name on three separate candidates (standalone $128, a combo
  // $128, a rice set) — name-only matching had no way to tell them apart, so
  // picking ONE stamped all three. table_item_key fixes it by matching the
  // specific candidate, not the printed name.
  describe('table_item_key disambiguation (duplicate printed names)', () => {
    const charSiu = pick({ name: 'Char Siu', name_zh: '叉燒', table_item_key: 'menu-3' });

    it('matches the exact candidate by key, ignoring name entirely', () => {
      const out = stampsFromPicks({ key: 'menu-3', name: 'Char Siu', name_zh: '叉燒' }, [charSiu]);
      expect(out).toHaveLength(1);
    });

    it('does NOT stamp a different candidate that merely shares the printed name', () => {
      const roastPork = { key: 'menu-2', name: 'Roast Pork', name_zh: '叉燒' };
      const roastPorkBelly = { key: 'menu-5', name: 'Roast Pork Belly', name_zh: '叉燒' };
      expect(stampsFromPicks(roastPork, [charSiu])).toEqual([]);
      expect(stampsFromPicks(roastPorkBelly, [charSiu])).toEqual([]);
    });

    it('a keyed pick is never matched by name, even if the key check fails', () => {
      // Same printed name, but the querying item has no key at all (e.g. a
      // stale caller) — a keyed pick must still refuse to fall back to name.
      const out = stampsFromPicks({ name: 'Char Siu', name_zh: '叉燒' }, [charSiu]);
      expect(out).toEqual([]);
    });

    it('an unkeyed (legacy) pick still falls back to name matching', () => {
      const legacy = pick({ name: 'Char Siu', name_zh: '叉燒', table_item_key: null });
      const out = stampsFromPicks({ key: 'menu-3', name: 'Char Siu', name_zh: '叉燒' }, [legacy]);
      expect(out).toHaveLength(1);
    });
  });
});

// table/page.tsx's unpickDish uses this directly (not just via stampsFromPicks) to
// find MY OWN pick's row id — same rule, so "is this item picked" and "which row
// do I delete to unpick it" can never disagree with each other.
describe('pickMatchesItem', () => {
  it('matches an exact-keyed pick only against its own key', () => {
    const p = pick({ table_item_key: 'menu-3', name: 'Char Siu', name_zh: '叉燒' });
    expect(pickMatchesItem(p, { key: 'menu-3', name: 'Char Siu', name_zh: '叉燒' })).toBe(true);
    expect(pickMatchesItem(p, { key: 'menu-2', name: 'Roast Pork', name_zh: '叉燒' })).toBe(false);
  });

  it('falls back to name matching for an unkeyed pick', () => {
    const p = pick({ table_item_key: null, name: 'Seafood donburi', name_zh: null });
    expect(pickMatchesItem(p, { key: 'menu-1', name: 'Seafood donburi', name_zh: null })).toBe(true);
  });
});

describe('mergeStamps', () => {
  it('returns the poll list untouched when the overlay is empty', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }];
    expect(mergeStamps(poll, {})).toEqual(poll);
  });

  it('adds an overlay pick the poll has not caught up to yet', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }];
    const overlay: StampOverlay = { u2: { type: 'pick', user_id: 'u2', name: 'b' } };
    expect(mergeStamps(poll, overlay).map(s => s.user_id).sort()).toEqual(['u1', 'u2']);
  });

  it('poll wins over a stale overlay pick duplicate of the same user', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'poll-name' }];
    const overlay: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'stale-overlay-name' } };
    expect(mergeStamps(poll, overlay)).toEqual([{ user_id: 'u1', name: 'poll-name' }]);
  });

  // Regression (found live, 2026-07-21): "picked" is now derived from whether MY
  // stamp is present (table/page.tsx) — an overlay that could only ever ADD meant
  // un-picking yourself left your own stamp (and the filled card) showing for up
  // to 5s, until the next poll. The overlay must be able to SUPPRESS a poll stamp.
  it('an overlay unpick HIDES a stamp the poll still has (self-unpick, poll not yet caught up)', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }, { user_id: 'u2', name: 'b' }];
    const overlay: StampOverlay = { u1: { type: 'unpick', user_id: 'u1', name: 'a' } };
    expect(mergeStamps(poll, overlay)).toEqual([{ user_id: 'u2', name: 'b' }]);
  });

  it('an overlay unpick for someone the poll never had is a harmless no-op', () => {
    const poll: Stamp[] = [{ user_id: 'u2', name: 'b' }];
    const overlay: StampOverlay = { u1: { type: 'unpick', user_id: 'u1', name: 'a' } };
    expect(mergeStamps(poll, overlay)).toEqual(poll);
  });
});

describe('applyStampEvent — overlay reducer', () => {
  it('a pick event adds a pending entry', () => {
    const out = applyStampEvent({}, { type: 'pick', user_id: 'u1', name: 'a' });
    expect(out).toEqual({ u1: { type: 'pick', user_id: 'u1', name: 'a' } });
  });

  it('a duplicate pick event is a no-op (idempotent — redelivery-safe)', () => {
    const current: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'a' } };
    const out = applyStampEvent(current, { type: 'pick', user_id: 'u1', name: 'a' });
    expect(out).toBe(current); // same reference: no unnecessary re-render
  });

  it('an unpick event supersedes a pending pick for the same user', () => {
    const current: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'a' } };
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(out).toEqual({ u1: { type: 'unpick', user_id: 'u1', name: 'a' } });
  });

  it('an unpick event for someone with no pending entry is still recorded (so it can suppress a poll stamp)', () => {
    const current: StampOverlay = { u2: { type: 'pick', user_id: 'u2', name: 'b' } };
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(out).toEqual({
      u2: { type: 'pick', user_id: 'u2', name: 'b' },
      u1: { type: 'unpick', user_id: 'u1', name: 'a' },
    });
  });

  it('a realistic sequence: two picks then one unpick lands in order', () => {
    let overlay: StampOverlay = {};
    overlay = applyStampEvent(overlay, { type: 'pick', user_id: 'u1', name: 'a' });
    overlay = applyStampEvent(overlay, { type: 'pick', user_id: 'u2', name: 'b' });
    overlay = applyStampEvent(overlay, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(mergeStamps([], overlay)).toEqual([{ user_id: 'u2', name: 'b' }]);
  });
});
