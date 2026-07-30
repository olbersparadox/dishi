// @vitest-environment jsdom
//
// 對決 answer-in-flight signal (owner call, 2026-07-30): tapping a dish already
// disabled BOTH sides while the /api/duels/answer POST is out, but gave no
// visual sign that the tap itself registered — the card just sat inert until
// the reveal landed. The TAPPED side now carries a spinner (DuelSide's own
// photoOverlay slot, built for exactly this: content pinned over the photo),
// the untouched side stays plain.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import DuelOverlay, { type Duel } from '../src/components/DuelOverlay';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const A = { id: 'a', name: 'Char siu', name_zh: '叉燒', photo_url: null, restaurant: '燒味舖' };
const B = { id: 'b', name: 'Roast goose', name_zh: '燒鵝', photo_url: null, restaurant: '燒鵝舖' };
const DUEL: Duel = { id: 'duel-1', a: A, b: B };

function mount(onClose = vi.fn()) {
  render(
    <LanguageProvider>
      <DuelOverlay duel={DUEL} onClose={onClose} />
    </LanguageProvider>,
  );
}

describe('the tapped dish shows its own loading spinner', () => {
  it('only the TAPPED side gets the spinner; the other stays plain', async () => {
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolveFetch = r; })));
    mount();

    const options = Array.from(document.querySelectorAll('.duel-option')) as HTMLButtonElement[];
    expect(options).toHaveLength(2);
    fireEvent.click(options[0]);

    await waitFor(() => expect(options[0].querySelector('.duel-photo-loading')).toBeTruthy());
    expect(options[1].querySelector('.duel-photo-loading')).toBeNull();
    // Both sides disabled while the answer is out — no double-tap, no switching picks.
    expect(options[0].disabled).toBe(true);
    expect(options[1].disabled).toBe(true);

    resolveFetch({ ok: true, json: async () => ({ predicted_correct: true, tie: false, predicted_p: 0.6, learned: [] }) });
  });

  it('the spinner clears once the reveal lands', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ predicted_correct: true, tie: false, predicted_p: 0.6, learned: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    mount();

    const options = Array.from(document.querySelectorAll('.duel-option')) as HTMLButtonElement[];
    fireEvent.click(options[0]);
    await waitFor(() => expect(document.querySelector('.duel-reveal')).toBeTruthy());
    expect(document.querySelector('.duel-photo-loading')).toBeNull();
  });
});
