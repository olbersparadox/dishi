// @vitest-environment jsdom
//
// The duel-repeats-itself bug (owner report, 2026-08-05).
//
// GET /api/interactions/today is NOT a pure read: past the cooldown it seals a
// prediction and INSERTS a dish_duels row. Both host surfaces mount
// useInteractions (NotificationBell + DailyInteractions), so a page load fired
// TWO GETs ~2ms apart; both saw no open duel, both passed the cooldown, both ran
// the DETERMINISTIC selection onto the same pair, and both inserted. Answering
// one left the duplicate open and < 24h old, so the pending branch served the
// identical two dishes again. Confirmed in prod data: two pairs duplicated
// 162ms and 526ms apart, each answered twice — one comparison taught the engine
// twice.
//
// The hook now shares ONE in-flight request across every consumer. These tests
// pin that (a lookalike that refetches per-instance fails the first one).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { useInteractions, notifyInteractionsChanged } from '../src/lib/useInteractions';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Consumer() {
  useInteractions();
  return null;
}

/** Both host surfaces, mounted together exactly as the app mounts them. */
function mountTwoSurfaces() {
  return render(<><Consumer /><Consumer /></>);
}

describe('one request per load, however many surfaces are mounted', () => {
  it('two mounted consumers produce ONE GET, not one each', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ interactions: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    mountTwoSurfaces();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Let any un-deduped second call land before asserting.
    await new Promise(r => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a refetch asked for mid-flight still runs — answering re-syncs every surface', async () => {
    let release!: (v: unknown) => void;
    const gate = new Promise(r => { release = r; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(gate.then(() => ({ json: async () => ({ interactions: [] }) })))
      .mockResolvedValue({ json: async () => ({ interactions: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    mountTwoSurfaces();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Answering fires this while the mount request is still out. It must not be
    // silently swallowed by the de-dupe, or a resolved duel would linger on screen.
    notifyInteractionsChanged();
    release(null);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
