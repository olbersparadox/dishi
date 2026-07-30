import { describe, it, expect } from 'vitest';
import { allMembersReady, readyCount, equalSplit, drawPayer } from '../src/lib/tableSettle';

const m = (id: string, ready?: boolean) => ({ user_id: id, ready_at: ready ? '2026-07-30T12:00:00Z' : null });

describe('allMembersReady', () => {
  it('flips only once every member has tapped', () => {
    expect(allMembersReady([m('a', true), m('b')])).toBe(false);
    expect(allMembersReady([m('a', true), m('b', true)])).toBe(true);
    expect(allMembersReady([m('a', true), m('b', true), m('c')])).toBe(false);
    expect(allMembersReady([m('a', true), m('b', true), m('c', true)])).toBe(true);
  });

  it('never fires for a solo scanner, who has nobody to split with', () => {
    expect(allMembersReady([m('a', true)])).toBe(false);
    expect(allMembersReady([])).toBe(false);
  });

  it('reopens when someone joins mid-handshake', () => {
    // The joiner has not tapped, so the table is not done — correct, and the
    // reason settled_at is stamped separately and stickily: a late joiner may
    // delay the flip but must never undo one that already happened.
    expect(allMembersReady([m('a', true), m('b', true), m('late')])).toBe(false);
  });
});

describe('readyCount', () => {
  it('counts the taps behind the waiting layer', () => {
    expect(readyCount([m('a', true), m('b'), m('c', true)])).toBe(2);
    expect(readyCount([m('a'), m('b')])).toBe(0);
  });
});

describe('equalSplit', () => {
  it('divides an even bill exactly', () => {
    expect(equalSplit(300, 3)).toEqual({ each: 100, people: 3, overshoot: 0 });
  });

  it('rounds each share UP so the table never collects short', () => {
    const s = equalSplit(100, 3);
    expect(s.each).toBe(33.34);
    expect(s.each * s.people).toBeGreaterThanOrEqual(100);
    expect(s.overshoot).toBeCloseTo(0.02, 2);
  });

  it('handles a real HK bill', () => {
    expect(equalSplit(284, 4)).toEqual({ each: 71, people: 4, overshoot: 0 });
  });

  it('is inert with no people rather than dividing by zero', () => {
    expect(equalSplit(280, 0)).toEqual({ each: 0, people: 0, overshoot: 0 });
  });
});

describe('drawPayer', () => {
  it('picks a member of the table', () => {
    const ids = ['u1', 'u2', 'u3'];
    expect(ids).toContain(drawPayer(ids, 'session-abc'));
  });

  it('gives the same answer to every client, so a race cannot flip a name', () => {
    const ids = ['u1', 'u2', 'u3', 'u4'];
    const first = drawPayer(ids, 'session-abc');
    expect(drawPayer([...ids].reverse(), 'session-abc')).toBe(first);
    expect(drawPayer(ids, 'session-abc')).toBe(first);
  });

  it('cannot be rerolled: the answer is a function of the table itself', () => {
    const ids = ['u1', 'u2', 'u3'];
    const draws = Array.from({ length: 20 }, () => drawPayer(ids, 'session-abc'));
    expect(new Set(draws).size).toBe(1);
  });

  it('draws differently across sessions', () => {
    const ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    const across = new Set(Array.from({ length: 40 }, (_, i) => drawPayer(ids, `session-${i}`)));
    expect(across.size).toBeGreaterThan(1);
  });

  it('returns null with nobody to draw from', () => {
    expect(drawPayer([], 'session-abc')).toBe(null);
  });
});
