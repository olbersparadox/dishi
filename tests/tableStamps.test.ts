import { describe, it, expect } from 'vitest';
import { stampsFromPicks, mergeStamps, applyStampEvent, type Stamp } from '../src/lib/tableStamps';

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
});

describe('mergeStamps', () => {
  it('returns the poll list untouched when realtime is empty', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }];
    expect(mergeStamps(poll, [])).toEqual(poll);
  });

  it('adds a realtime stamp the poll has not caught up to yet', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'a' }];
    const rt: Stamp[] = [{ user_id: 'u2', name: 'b' }];
    expect(mergeStamps(poll, rt).map(s => s.user_id).sort()).toEqual(['u1', 'u2']);
  });

  it('poll wins over a stale realtime duplicate of the same user', () => {
    const poll: Stamp[] = [{ user_id: 'u1', name: 'poll-name' }];
    const rt: Stamp[] = [{ user_id: 'u1', name: 'stale-realtime-name' }];
    expect(mergeStamps(poll, rt)).toEqual([{ user_id: 'u1', name: 'poll-name' }]);
  });
});

describe('applyStampEvent — late-join / reconciliation building block', () => {
  it('a pick event adds a new stamp', () => {
    const out = applyStampEvent([], { type: 'pick', user_id: 'u1', name: 'a' });
    expect(out).toEqual([{ user_id: 'u1', name: 'a' }]);
  });

  it('a duplicate pick event is a no-op (idempotent — redelivery-safe)', () => {
    const current: Stamp[] = [{ user_id: 'u1', name: 'a' }];
    const out = applyStampEvent(current, { type: 'pick', user_id: 'u1', name: 'a' });
    expect(out).toBe(current); // same reference: no unnecessary re-render
  });

  it('an unpick event removes the matching stamp', () => {
    const current: Stamp[] = [{ user_id: 'u1', name: 'a' }, { user_id: 'u2', name: 'b' }];
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(out).toEqual([{ user_id: 'u2', name: 'b' }]);
  });

  it('an unpick for someone not in the list is a harmless no-op', () => {
    const current: Stamp[] = [{ user_id: 'u2', name: 'b' }];
    const out = applyStampEvent(current, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(out).toEqual(current);
  });

  it('a realistic sequence: two picks then one unpick lands in order', () => {
    let stamps: Stamp[] = [];
    stamps = applyStampEvent(stamps, { type: 'pick', user_id: 'u1', name: 'a' });
    stamps = applyStampEvent(stamps, { type: 'pick', user_id: 'u2', name: 'b' });
    stamps = applyStampEvent(stamps, { type: 'unpick', user_id: 'u1', name: 'a' });
    expect(stamps).toEqual([{ user_id: 'u2', name: 'b' }]);
  });
});
