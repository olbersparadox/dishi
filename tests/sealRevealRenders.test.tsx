// @vitest-environment jsdom
//
// REGRESSION (2026-07-24, live-diagnosed): the seal reveal fired server-side on
// every rating but never rendered, silently burning a one-way `revealed_at`.
// Cause: the only producer of the reveal was the old /log page, which read
// `json.seal` off the ratings response into sessionStorage and navigated to
// /profile?rated=1. /log was killed 2026-07-22 (commit 8c07b62); its replacement
// (RatingStack, an overlay that never navigates) posted the rating
// fire-and-forget and threw the response away, while the profile page kept a
// reader for a key nothing wrote and a `justRated` gate nothing ever set.
//
// What these tests pin, so it cannot rot back:
//   1. a rating whose response carries a seal RENDERS the reveal;
//   2. the pick-from-待評 path specifically (the one the owner hit) is covered;
//   3. the reveal survives the growth screen's mount — it is not cleared by the
//      post-rating refresh/exit sequence;
//   4. no seal in the response => no reveal card invented.
// A fire-and-forget `rate()` fails (1)-(3); a missing render site fails all.
// Assertions read the ZH copy: LanguageProvider defaults to Chinese-first, which
// is what a real user sees here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';

// SnapRating is a pointer-drag slider (no keyboard path), so the flick itself is
// stubbed to a button: what regressed was RatingStack's handling of the RATING
// RESPONSE, not the gesture. Everything downstream of onRate stays real.
vi.mock('@/components/SnapRating', () => ({
  default: ({ onRate }: { onRate: (score: number) => void }) => (
    <button data-testid="flick" onClick={() => onRate(0.9)}>flick</button>
  ),
}));

import RatingStack, { type ExistingPick } from '../src/components/RatingStack';

const SEAL = {
  predicted_direction: 'like',
  actual_direction: 'love',
  outcome: 'near' as const,
  reason_zh: '你鍾意鑊氣重嘅嘢',
  reason_en: 'you lean smoky, wok-charred',
};

const pick: ExistingPick = {
  dishId: 'dish-1', photoUrl: null, name: 'Char Siu', name_zh: '叉燒',
  coords: null, restaurant: null,
};

/** Mocks every endpoint the rating pipeline touches. `seal` is what /api/ratings
 *  hands back — the payload whose loss was the bug. */
function mockFetch(seal: unknown) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const body =
      url.includes('/api/ratings') ? { ok: true, taught: [], seal }
      : url.includes('/api/buddy') ? { state: null }
      : {};
    return { ok: true, json: async () => body } as Response;
  }));
  return calls;
}

function mountPick() {
  return render(
    <LanguageProvider>
      <RatingStack picks={[pick]} userId="u1" onExit={() => {}} />
    </LanguageProvider>,
  );
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('seal reveal renders after a rating (pick-from-待評 path)', () => {
  it('shows the broken seal returned by /api/ratings', async () => {
    mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    // The reveal's own copy — outcome title AND the sealed-in-advance reason,
    // which only exists on the response (nothing client-side could invent it).
    await waitFor(() => expect(screen.getByText(/拆開個印/)).toBeTruthy());
    expect(screen.getByText(/鑊氣重嘅嘢/)).toBeTruthy();
  });

  it('actually reads the ratings RESPONSE — a fire-and-forget POST cannot pass this', async () => {
    const calls = mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.getByText(/拆開個印/)).toBeTruthy());
    // Ordering contract, unchanged by the fix: the seal is written BEFORE the
    // rating that breaks it (the honesty contract), never after.
    const sealIdx = calls.findIndex(u => u.includes('/api/seals'));
    const rateIdx = calls.findIndex(u => u.includes('/api/ratings'));
    expect(sealIdx).toBeGreaterThanOrEqual(0);
    expect(rateIdx).toBeGreaterThan(sealIdx);
  });

  it('the reveal survives the growth screen — it is not cleared on the way in', async () => {
    mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.getByText(/拆開個印/)).toBeTruthy());
    // The growth screen is now mounted (the flick card is gone) and the reveal is
    // still on it — the post-rating refresh/exit sequence must not eat it.
    expect(screen.queryByTestId('flick')).toBeNull();
    expect(screen.getByText(/拆開個印/)).toBeTruthy();
  });

  it('no seal in the response => no reveal card invented', async () => {
    mockFetch(null);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.queryByTestId('flick')).toBeNull()); // reached growth
    expect(screen.queryByText(/拆開個印/)).toBeNull();
  });
});
