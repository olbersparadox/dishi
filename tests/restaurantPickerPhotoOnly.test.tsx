// @vitest-environment jsdom
//
// 食記 retrospective edit (2026-07-26): the restaurant shortlist must come from
// the PHOTO's location or not at all.
//
// The bug: RestaurantPicker fell back to live GPS whenever seedCoords was null.
// So in the same 轉餐廳 / 加間舖 surface, a dish that kept its EXIF got
// where-the-photo-was-taken suggestions and a dish that didn't got
// where-you-are-standing-now suggestions — the shortlist silently meant two
// different things, and on an edit made days later and miles away the second
// kind is confidently wrong.
//
// What these tests pin:
//   1. photoOnly + EXIF  -> nearby is fetched from the EXIF coords;
//   2. photoOnly, no EXIF -> live GPS is NEVER consulted, no shortlist invented;
//   3. the live-GPS escape hatch exists for PINNING a typed place, and only
//      fires on a deliberate tap (a new restaurant needs a coordinate to dedupe);
//   4. WITHOUT photoOnly the old live-GPS fallback still works — the scan-page
//      and 打字 quick-add callers rate at the restaurant, where "now" is right.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RestaurantPicker from '../src/components/RestaurantPicker';
import { LanguageProvider } from '../src/lib/i18n';

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

const EXIF = { lat: 22.28, lng: 114.15 };
/** Where the phone is NOW — deliberately nowhere near EXIF, so a suggestion
 *  sourced from it is unmistakable in the assertions. */
const LIVE = { latitude: 22.99, longitude: 114.99 };

/** Installs a geolocation that reports LIVE, and counts every consultation —
 *  "was live GPS used at all" is the actual contract, not just what came back. */
function stubGeo() {
  const getCurrentPosition = vi.fn((ok: (p: any) => void) =>
    ok({ coords: { latitude: LIVE.latitude, longitude: LIVE.longitude } }));
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition }, configurable: true, writable: true,
  });
  return getCurrentPosition;
}
const nearbyUrls = (f: any) =>
  (f.mock.calls as any[][]).map(c => String(c[0])).filter(u => u.includes('/api/restaurants/nearby'));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (navigator as any).geolocation; // clear the stub between tests
});

describe('RestaurantPicker photoOnly — the shortlist is the photo’s location or nothing', () => {
  let fetchMock: any;
  beforeEach(() => {
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ restaurants: [] }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('with EXIF coords: suggestions come from the photo, live GPS untouched', async () => {
    const geo = stubGeo();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(nearbyUrls(fetchMock)).toHaveLength(1));
    expect(nearbyUrls(fetchMock)[0]).toContain('lat=22.28');
    expect(geo, 'live GPS was consulted despite the photo having coords').not.toHaveBeenCalled();
    // Says where the list came from, rather than presenting it as ambient truth.
    expect(screen.getByText('📍 這張相片拍攝地點附近')).toBeTruthy();
  });

  it('without EXIF coords: live GPS is never consulted and NO shortlist is invented', async () => {
    const geo = stubGeo();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={null} />
      </LanguageProvider>,
    );
    // The honest end state — the photo has no location, and we say so rather
    // than substituting the device's.
    await waitFor(() => expect(screen.getByText('這張相片沒有位置資料 — 可以自己輸入店名，或者跳過。')).toBeTruthy());
    expect(geo, 'live GPS was silently used to build the shortlist').not.toHaveBeenCalled();
    expect(nearbyUrls(fetchMock)).toHaveLength(0);
  });

  it('the live-GPS escape hatch pins a typed place, but only on a deliberate tap', async () => {
    const geo = stubGeo();
    const onChange = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} photoOnly seedCoords={null} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('這張相片沒有位置資料 — 可以自己輸入店名，或者跳過。')).toBeTruthy());

    fireEvent.click(screen.getByText('+ 加間舖'));
    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '新容記' } });
    onChange.mockClear();

    // Still gated before the tap — and the reason names the PHOTO, not a
    // permissions problem the person would go hunting for in Settings.
    fireEvent.click(screen.getByRole('button', { name: '加入' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('這張相片沒有位置，新舖需要一個位置才釘得住。')).toBeTruthy();
    expect(geo).not.toHaveBeenCalled();

    // The deliberate tap — and only now is live GPS allowed to speak.
    fireEvent.click(screen.getByText('用我現時位置'));
    await waitFor(() => expect(geo).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('📍 你現時位置附近')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '加入' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'new', name: '新容記', lat: LIVE.latitude, lng: LIVE.longitude,
      }));
    });
  });

  it('WITHOUT photoOnly the live-GPS fallback still works (scan page / 打字 quick-add)', async () => {
    // Those callers pick a restaurant while standing in it, so "now" is the
    // right answer there — this change must not have narrowed them.
    const geo = stubGeo();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} seedCoords={null} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(geo).toHaveBeenCalled());
    await waitFor(() => expect(nearbyUrls(fetchMock)).toHaveLength(1));
    expect(nearbyUrls(fetchMock)[0]).toContain('lat=22.99');
  });
});
