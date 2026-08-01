// @vitest-environment jsdom
//
// With no coords the restaurant picker is a DEAD END, not merely a thinner one:
// there are no nearby chips, and confirmNew refuses to submit a typed name too (a new
// place with no coordinate can't be pinned or deduped). On the table sheet that left
// 略過 as the only working control — and 略過 now clears the restaurant. So the sheet's
// one usable exit was a delete.
//
// The retry therefore lives in the chip row, reachable before opening anything, rather
// than inside the add form where it only appeared once you'd already committed to
// typing. photoOnly keeps the in-form version: there live GPS must never quietly shape
// a retrospective shortlist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import RestaurantPicker from '../src/components/RestaurantPicker';

const PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3;
const err = (code: number) => ({ code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT });

let getCurrentPosition: ReturnType<typeof vi.fn>;
beforeEach(() => {
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition }, configurable: true, writable: true,
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ restaurants: [{ source: 'dishi', id: 'r1', name: 'Tsui Wah', name_zh: '翠華', lat: 22.3, lng: 114.2, distance_m: 40 }] }),
    { status: 200 },
  )));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mount = (props: Record<string, unknown> = {}) => render(
  <LanguageProvider><RestaurantPicker onChange={() => {}} {...props} /></LanguageProvider>,
);
const byText = (c: HTMLElement, s: string) =>
  Array.from(c.querySelectorAll('button')).find(b => b.textContent?.includes(s));

describe('a failed location fix is recoverable', () => {
  it('offers a retry chip, and a tap actually reloads the shortlist', async () => {
    getCurrentPosition.mockImplementationOnce((_ok, fail) => fail(err(TIMEOUT)));
    const view = mount();
    await waitFor(() => expect(byText(view.container, '再試定位')).toBeTruthy());
    // The dead end: nothing to pick, and the typed path can't submit either.
    expect(byText(view.container, '翠華')).toBeFalsy();

    getCurrentPosition.mockImplementationOnce((ok) =>
      ok({ coords: { latitude: 22.3, longitude: 114.2 } }));
    fireEvent.click(byText(view.container, '再試定位')!);

    await waitFor(() => expect(byText(view.container, '翠華'), 'retry did not reload the shortlist').toBeTruthy());
    expect(byText(view.container, '再試定位'), 'retry chip should go once it worked').toBeFalsy();
  });

  it('does not claim location is off when it timed out with location ON', async () => {
    getCurrentPosition.mockImplementationOnce((_ok, fail) => fail(err(TIMEOUT)));
    const view = mount();
    await waitFor(() => expect(byText(view.container, '再試定位')).toBeTruthy());
    expect(view.container.textContent).toContain('搵唔到你嘅位置');
    expect(view.container.textContent, 'a timeout is not 定位已關').not.toContain('定位已關');
  });

  it('does say location is off when permission really was denied', async () => {
    getCurrentPosition.mockImplementationOnce((_ok, fail) => fail(err(PERMISSION_DENIED)));
    const view = mount();
    await waitFor(() => expect(view.container.textContent).toContain('定位已關'));
  });

  // 略過 is the table sheet's clear now, so no caption may offer it as the soft way out.
  it('never points a stuck user at 跳過', async () => {
    getCurrentPosition.mockImplementationOnce((_ok, fail) => fail(err(PERMISSION_DENIED)));
    const view = mount();
    await waitFor(() => expect(view.container.textContent).toContain('定位已關'));
    const caption = view.container.querySelector('.card-meta')!.textContent ?? '';
    expect(caption, 'the caption still recommends 跳過, which now deletes').not.toContain('跳過');
  });

  // photoOnly's shortlist is EXIF-or-nothing on purpose: live GPS describes where the
  // phone is now, which is the wrong answer for a dish logged days later.
  it('keeps the chip out of the retrospective 食記 picker', async () => {
    const view = mount({ photoOnly: true });
    await waitFor(() => expect(view.container.textContent).toBeTruthy());
    expect(byText(view.container, '再試定位')).toBeFalsy();
    expect(getCurrentPosition, 'photoOnly must not touch live GPS on mount').not.toHaveBeenCalled();
  });
});
