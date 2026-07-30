import { describe, it, expect } from 'vitest';
import { stampsFromPicks, pickMatchesItem, mergeStamps, applyStampEvent, pruneOverlaysBefore, countStampedDishes, type Stamp, type StampOverlay } from '../src/lib/tableStamps';

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
    const overlay: StampOverlay = { u2: { type: 'pick', user_id: 'u2', name: 'b', at: 0 } };
    expect(mergeStamps(poll, overlay).map(s => s.user_id).sort()).toEqual(['u1', 'u2']);
  });

  it('poll wins over a stale overlay pick duplicate of the same user', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'poll-name' }];
    const overlay: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'stale-overlay-name', at: 0 } };
    expect(mergeStamps(poll, overlay)).toEqual([{ user_id: 'u1', name: 'poll-name' }]);
  });

  // Regression (found live, 2026-07-21): "picked" is now derived from whether MY
  // stamp is present (table/page.tsx) — an overlay that could only ever ADD meant
  // un-picking yourself left your own stamp (and the filled card) showing for up
  // to 5s, until the next poll. The overlay must be able to SUPPRESS a poll stamp.
  it('an overlay unpick HIDES a stamp the poll still has (self-unpick, poll not yet caught up)', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }, { user_id: 'u2', name: 'b' }];
    const overlay: StampOverlay = { u1: { type: 'unpick', user_id: 'u1', name: 'a', at: 0 } };
    expect(mergeStamps(poll, overlay)).toEqual([{ user_id: 'u2', name: 'b' }]);
  });

  it('an overlay unpick for someone the poll never had is a harmless no-op', () => {
    const poll: Stamp[] = [{ user_id: 'u2', name: 'b' }];
    const overlay: StampOverlay = { u1: { type: 'unpick', user_id: 'u1', name: 'a', at: 0 } };
    expect(mergeStamps(poll, overlay)).toEqual(poll);
  });
});

describe('applyStampEvent — overlay reducer', () => {
  it('a pick event adds a pending entry', () => {
    const out = applyStampEvent({}, { type: 'pick', user_id: 'u1', name: 'a' }, 0);
    expect(out).toEqual({ u1: { type: 'pick', user_id: 'u1', name: 'a', at: 0 } });
  });

  it('a duplicate pick event is a no-op (idempotent — redelivery-safe)', () => {
    const current: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'a', at: 0 } };
    const out = applyStampEvent(current, { type: 'pick', user_id: 'u1', name: 'a' }, 0);
    expect(out).toBe(current); // same reference: no unnecessary re-render
  });

  it('an unpick event supersedes a pending pick for the same user', () => {
    const current: StampOverlay = { u1: { type: 'pick', user_id: 'u1', name: 'a', at: 0 } };
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' }, 0);
    expect(out).toEqual({ u1: { type: 'unpick', user_id: 'u1', name: 'a', at: 0 } });
  });

  it('an unpick event for someone with no pending entry is still recorded (so it can suppress a poll stamp)', () => {
    const current: StampOverlay = { u2: { type: 'pick', user_id: 'u2', name: 'b', at: 0 } };
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' }, 0);
    expect(out).toEqual({
      u2: { type: 'pick', user_id: 'u2', name: 'b', at: 0 },
      u1: { type: 'unpick', user_id: 'u1', name: 'a', at: 0 },
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

describe('cross-view stamps: scan glance ↔ /table (two-account field test, 2026-07-24)', () => {
  // The two views used to key picks DIFFERENTLY — the scan screen by
  // name_original, /table by array index (`menu-${i}`) — and pickMatchesItem is
  // an exact key comparison when a key exists, so a pick made on either screen
  // was invisible on the other, in both directions, until the scanner rejoined
  // as a plain member. Both sides now key by name_original (scanCandidateKey),
  // which re-authoring (namefix translation, enrichment) never touches.
  const KEY = '天日干しアジの開き定食'; // verbatim printed name — the stable shared key

  it("a joiner's /table pick stamps the scanner's scan-glance card (key = name_original)", () => {
    // Joiner picked on /table where the candidate key is now name_original; the
    // scan glance matches picks against item.name_original — same value.
    const joinerPick = {
      user_id: 'u-joiner', name: 'Mackerel Set', name_zh: '天日干竹筴魚一夜乾定食',
      display_name: 'Peter', handle: 'peter', table_item_key: KEY,
    };
    const scanItem = { key: KEY, name: 'Sun-dried Horse Mackerel Set', name_zh: '天日干しアジの開き定食' };
    expect(stampsFromPicks(scanItem, [joinerPick])).toEqual([{ user_id: 'u-joiner', name: 'Peter' }]);
  });

  it("the scanner's scan-glance pick stamps the /table card, even after the item was re-authored", () => {
    // Scanner picked BEFORE the namefix pass; the shared item's name_zh has since
    // been translated. The key (name_original) is untouched by re-authoring, so
    // the exact-key match still holds despite the two views disagreeing on names.
    const scannerPick = {
      user_id: 'u-scanner', name: 'Sun-dried Horse Mackerel Set', name_zh: '天日干しアジの開き定食',
      display_name: 'Jerry', handle: 'jerry', table_item_key: KEY,
    };
    const reauthoredTableItem = { key: KEY, name: 'Sun-dried Horse Mackerel Set', name_zh: '天日干竹筴魚一夜乾定食' };
    expect(pickMatchesItem(scannerPick, reauthoredTableItem)).toBe(true);
    expect(stampsFromPicks(reauthoredTableItem, [scannerPick])).toEqual([{ user_id: 'u-scanner', name: 'Jerry' }]);
  });

  it('an index-keyed legacy pick from before the fix matches nothing rather than the wrong dish', () => {
    // Live sessions from before the deploy stored `menu-${i}` keys; those stamps
    // go quiet (sessions are ephemeral) instead of cross-stamping by name.
    const legacyPick = {
      user_id: 'u-old', name: 'Mackerel Set', name_zh: null,
      display_name: null, handle: 'old', table_item_key: 'menu-3',
    };
    expect(pickMatchesItem(legacyPick, { key: KEY, name: 'Mackerel Set', name_zh: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Field test, 2026-07-30 (owner): "user 1 tap a dish, user 2 see the profile chop
// almost immediately. But sometimes it would gone disappear in a second. Then after
// a few seconds, reappear again." Same flicker on fast pick/unpick.
// ---------------------------------------------------------------------------
describe('pruneOverlaysBefore — a poll may only clear what it could have seen', () => {
  const pick = (u: string, at: number) => ({ type: 'pick' as const, user_id: u, name: u, at });

  it('clears an entry older than the poll request (the poll response contains it)', () => {
    const overlays = { dishA: { u1: pick('u1', 100) } };
    expect(pruneOverlaysBefore(overlays, 200)).toEqual({});
  });

  it('KEEPS an entry that arrived while the poll was in flight', () => {
    // The response was generated at t=200 and cannot describe an event from t=250.
    // Clearing it is exactly the reported vanish: the chop disappears until the
    // NEXT poll, ~5s later, finally returns the pick.
    const overlays = { dishA: { u1: pick('u1', 250) } };
    expect(pruneOverlaysBefore(overlays, 200)).toEqual(overlays);
  });

  it('protects a REMOTE broadcast, not just this client\'s own writes', () => {
    // The bug this replaces: the old in-flight guard was keyed on the local
    // client's own pending writes, so someone else's pick — the only thing user 2
    // was looking at — had nothing holding it through an in-flight poll.
    const overlays = { dishA: { someoneElse: pick('someoneElse', 300) } };
    expect(pruneOverlaysBefore(overlays, 200)).toEqual(overlays);
  });

  it('prunes per entry, not per item: one stale user does not evict a fresh one', () => {
    const overlays = { dishA: { u1: pick('u1', 100), u2: pick('u2', 300) } };
    expect(pruneOverlaysBefore(overlays, 200)).toEqual({ dishA: { u2: pick('u2', 300) } });
  });

  it('drops an item key entirely once its last entry is superseded (no empty shells)', () => {
    const overlays = { dishA: { u1: pick('u1', 100) }, dishB: { u2: pick('u2', 300) } };
    expect(Object.keys(pruneOverlaysBefore(overlays, 200))).toEqual(['dishB']);
  });

  it('still lets a stale entry go on the FOLLOWING poll (self-healing preserved)', () => {
    // The overlay must never become permanent: an unpick broadcast this client
    // missed has to expire, or the stamp it hides never comes back.
    const overlays = { dishA: { u1: pick('u1', 250) } };
    const afterInFlightPoll = pruneOverlaysBefore(overlays, 200);
    expect(pruneOverlaysBefore(afterInFlightPoll, 400)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Field test, 2026-07-30 (owner): "User 1's total dish counter is incorrect.
// User 2's total dish counter is correct."
// ---------------------------------------------------------------------------
describe('countStampedDishes — distinct dishes, not array rows', () => {
  const stamped = { user_id: 'u1', name: 'a' };
  const stampsFor = (i: { key: string }) => (i.key === 'picked' ? [stamped] : []);

  it('counts a dish once even when the item list repeats its key', () => {
    // The scanner's LOCAL list is never deduped, unlike the session's. A menu that
    // prints one name_original twice gave the scanner two rows sharing a key, and
    // pickMatchesItem is an exact key comparison — so one pick stamped both rows and
    // the header counted 2. Real menus do this (sessions J754Z, BPGWZ).
    const scannerLocal = [{ key: 'picked' }, { key: 'picked' }, { key: 'other' }];
    expect(countStampedDishes(scannerLocal, stampsFor)).toBe(1);
    // The naive count this replaces, kept explicit so the regression is legible:
    expect(scannerLocal.filter(i => stampsFor(i).length > 0).length).toBe(2);
  });

  it('agrees with the deduped session list for the same picks', () => {
    // The whole point: both screens must report the same number for one table.
    const scannerLocal = [{ key: 'picked' }, { key: 'picked' }, { key: 'other' }];
    const sessionDeduped = [{ key: 'picked' }, { key: 'other' }];
    expect(countStampedDishes(scannerLocal, stampsFor))
      .toBe(countStampedDishes(sessionDeduped, stampsFor));
  });

  it('counts a dish once when several people picked it', () => {
    const two = (i: { key: string }) =>
      i.key === 'picked' ? [stamped, { user_id: 'u2', name: 'b' }] : [];
    expect(countStampedDishes([{ key: 'picked' }], two)).toBe(1);
  });

  it('is zero when nothing is stamped', () => {
    expect(countStampedDishes([{ key: 'a' }, { key: 'b' }], () => [])).toBe(0);
  });
});
