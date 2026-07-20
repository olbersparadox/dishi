import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchNearbyRestaurants, dedupeAgainstDishi } from '../src/lib/places';

// The Tin Wan miss: 新容記, a well-known spot the user was standing in, fell outside
// the 10 prominence-ranked Google slots. Ranking by DISTANCE makes the 10 the NEAREST
// ten instead — these tests pin that the billed request actually asks for it.

describe('searchNearbyRestaurants request shape', () => {
  const realKey = process.env.GOOGLE_PLACES_API_KEY;
  beforeEach(() => { process.env.GOOGLE_PLACES_API_KEY = 'test-key'; });
  afterEach(() => {
    if (realKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = realKey;
    vi.restoreAllMocks();
  });

  it('ranks by DISTANCE and still sends the required radius restriction', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ places: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await searchNearbyRestaurants(22.25, 114.15, 300, 'zh-HK');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = (fetchMock as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.rankPreference).toBe('DISTANCE');
    // Radius is REQUIRED even with DISTANCE ranking — it bounds the candidate set.
    expect(body.locationRestriction.circle.radius).toBe(300);
    expect(body.maxResultCount).toBe(10);
  });

  it('fails soft to [] on a non-ok response (a Places outage never blocks logging)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'quota' })) as any);
    expect(await searchNearbyRestaurants(22.25, 114.15)).toEqual([]);
  });

  it('returns [] with no API key rather than calling Google', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);
    expect(await searchNearbyRestaurants(22.25, 114.15)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dedupeAgainstDishi', () => {
  it('drops a Google result within 40m of a Dishi row (Dishi copy wins)', () => {
    const google = [{ place_id: 'g1', lat: 22.2500, lng: 114.1500 }];
    const dishi = [{ lat: 22.25005, lng: 114.15005 }]; // ~7m away
    expect(dedupeAgainstDishi(google, dishi)).toEqual([]);
  });
  it('keeps a Google result that is a genuinely different place (>40m)', () => {
    const google = [{ place_id: 'g1', lat: 22.2500, lng: 114.1500 }];
    const dishi = [{ lat: 22.2600, lng: 114.1600 }]; // ~1.4km away
    expect(dedupeAgainstDishi(google, dishi)).toHaveLength(1);
  });
});
