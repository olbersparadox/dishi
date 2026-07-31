// @vitest-environment jsdom
//
// One table's state must never appear on another's.
//
// The live bug (owner, 2026-07-31): user 1 scanned a SECOND menu and had user 2 join
// it. They were on 隨機一人. User 1's screen "occasionally refreshed itself" and then
// dropped into a 大話骰 that was already MID-ROUND, on a table where nobody had
// started a game — while user 2, whose client had only ever seen the new table, was
// still on the settle screen.
//
// Cause: /scan keeps useTableSession mounted across scans and only swaps the `code`.
// Nothing tied the stored state to the code being asked for, so until a poll replaced
// it the new table wore the old one's dishes, members, settle decision and game
// round. The in-flight write guard then made it durable rather than momentary, by
// re-applying the old table's fields on top of every new poll response.
//
// Asserted by actually swapping the code on a mounted hook, because the failure is a
// state-lifetime bug — a source-level check cannot see it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Realtime is pure latency here (see the engine's header note); the poll is the
// source of truth, so a channel that records nothing is enough for these tests.
vi.mock('../src/lib/supabase/client', () => ({
  supabaseBrowser: () => ({
    channel: () => {
      const ch: any = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => {},
  }),
}));

import { useTableSession } from '../src/lib/useTableSession';

/** A settled table mid-大話骰, and a fresh one that has chosen nothing. */
const GAME_TABLE = {
  code: 'AAAAA', session_id: 'sess-game', restaurant_id: null, restaurant: null,
  status: 'open', is_host: true, has_menu: true, orderable: true,
  you: 'u1', members: [{ user_id: 'u1' }, { user_id: 'u2' }],
  items: [{ key: 'k1', name: 'Old dish' }], table_picks: [],
  settled_at: '2026-07-31T00:00:00Z',
  pay_method: 'game', pay_payer_id: 'u2', pay_draw_count: 3,
  game: { round: 1, currentTurnUserId: 'u1', bids: [{ quantity: 6, face: 4 }], reveal: null },
};
const FRESH_TABLE = {
  ...GAME_TABLE,
  code: 'BBBBB', session_id: 'sess-fresh',
  items: [{ key: 'k9', name: 'New dish' }],
  pay_method: null, pay_payer_id: null, pay_draw_count: 0, game: null,
};

const respond = (body: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('swapping to another table', () => {
  it('never reports the previous table\'s game, bill or dishes', async () => {
    const fetchMock = vi.fn((url: string) =>
      respond(String(url).includes('AAAAA') ? GAME_TABLE : FRESH_TABLE));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ code }) => useTableSession(code), {
      initialProps: { code: 'AAAAA' },
    });
    await waitFor(() => expect(result.current.game).not.toBeNull());
    expect(result.current.payMethod).toBe('game');

    // The swap /scan performs: same hook, new code.
    rerender({ code: 'BBBBB' });

    // IMMEDIATELY — before any poll for the new table can answer. This is the window
    // the game leaked through, and one frame of it is enough to mount the game screen.
    expect(result.current.game).toBeNull();
    expect(result.current.payMethod).toBeNull();
    expect(result.current.payerId).toBeNull();
    expect(result.current.state).toBeNull();
    expect(result.current.picks).toEqual([]);
    expect(result.current.members).toEqual([]);

    // And once the new table does answer, it is the new table and only the new table.
    await waitFor(() => expect(result.current.state?.session_id).toBe('sess-fresh'));
    expect(result.current.game).toBeNull();
    expect(result.current.payMethod).toBeNull();
    expect(result.current.state?.items?.[0]?.name).toBe('New dish');
  });

  it('a poll answering for the OLD table cannot land on the new one', async () => {
    // The "refreshed itself" part: a request issued for the previous table can answer
    // after the swap. Its body describes a session this screen is no longer showing.
    let resolveOld: (v: any) => void = () => {};
    const fetchMock = vi.fn((url: string) => String(url).includes('AAAAA')
      ? new Promise(res => { resolveOld = res; })
      : respond(FRESH_TABLE));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ code }) => useTableSession(code), {
      initialProps: { code: 'AAAAA' },
    });
    rerender({ code: 'BBBBB' });
    await waitFor(() => expect(result.current.state?.session_id).toBe('sess-fresh'));

    // The old table's in-flight poll now answers, late.
    resolveOld({ ok: true, json: () => Promise.resolve(GAME_TABLE) });
    await new Promise(r => setTimeout(r, 20));

    expect(result.current.game).toBeNull();
    expect(result.current.payMethod).toBeNull();
    expect(result.current.state?.session_id).toBe('sess-fresh');
  });
});
