import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchNearbyRestaurants, searchPlacesText, dedupeAgainstDishi, orderByTrueDistance } from '../src/lib/places';

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

describe('searchPlacesText request shape', () => {
  const realKey = process.env.GOOGLE_PLACES_API_KEY;
  beforeEach(() => { process.env.GOOGLE_PLACES_API_KEY = 'test-key'; });
  afterEach(() => {
    if (realKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = realKey;
    vi.restoreAllMocks();
  });

  it('sends the textQuery, a location bias circle, and the field mask', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ places: [] }) })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await searchPlacesText('新容記', 22.25, 114.15, 1000, 'zh-HK', 5);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (fetchMock as any).mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.headers['X-Goog-FieldMask']).toBe('places.id,places.displayName,places.location,places.formattedAddress');
    const body = JSON.parse(init.body);
    expect(body.textQuery).toBe('新容記');
    expect(body.locationBias.circle.radius).toBe(1000);
    expect(body.locationBias.circle.center).toEqual({ latitude: 22.25, longitude: 114.15 });
    expect(body.languageCode).toBe('zh-HK');
    expect(body.maxResultCount).toBe(5);
  });

  it('maps results the same shape as Nearby Search', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        places: [{ id: 'p1', displayName: { text: '新容記' }, location: { latitude: 22.28, longitude: 114.16 }, formattedAddress: 'Tin Wan' }],
      }),
    })) as any);
    const results = await searchPlacesText('新容記', 22.25, 114.15);
    expect(results).toEqual([{ place_id: 'p1', name: '新容記', lat: 22.28, lng: 114.16, address: 'Tin Wan' }]);
  });

  it('fails soft to [] on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'quota' })) as any);
    expect(await searchPlacesText('新容記', 22.25, 114.15)).toEqual([]);
  });

  it('returns [] with no API key rather than calling Google', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);
    expect(await searchPlacesText('新容記', 22.25, 114.15)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] for a blank query without calling Google', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);
    expect(await searchPlacesText('   ', 22.25, 114.15)).toEqual([]);
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

// The Wan Chai report, 2026-08-07. A dish photographed in Wan Chai offered a list
// that read as Central. The list was NOT mis-located: it was correctly ordered by
// distance, but nearby_restaurants' radius_m parameter was dead (a hardcoded ~2km
// box), so the eight nearest own-restaurants reached 1791m — and the route returned
// [...dishi, ...google], putting all eight ahead of the shops across the street.
// RatingStack commits the FIRST row optimistically, so the dish was attributed to a
// restaurant 270m from where it was eaten. An audit found one committed at 1836m.
//
// Owner call, asked directly: no, your own restaurants should not always outrank
// Google's. Distance decides; provenance only breaks a tie.
describe('orderByTrueDistance — distance decides, not provenance', () => {
  const LAT = 22.2772638888889, LNG = 114.171944444444; // the Wan Chai photo

  // Roughly 100m and 700m north of the photo.
  const near = (m: number) => ({ lat: LAT + m / 111320, lng: LNG });

  it('puts a closer Google place ahead of a further own-restaurant', () => {
    const rows = [
      { ...near(700), distance_m: 700, source: 'dishi' as const, name: 'visited, far' },
      { ...near(100), distance_m: null, source: 'google' as const, name: 'never visited, close' },
    ];
    expect(orderByTrueDistance(rows, LAT, LNG).map(r => r.name))
      .toEqual(['never visited, close', 'visited, far']);
  });

  it('computes the missing distance for Google rows rather than sinking them', () => {
    const [top] = orderByTrueDistance(
      [{ ...near(100), distance_m: null, source: 'google' as const }], LAT, LNG,
    );
    expect(top.distance_m).toBeGreaterThan(90);
    expect(top.distance_m).toBeLessThan(110);
  });

  it('keeps a trusted distance already supplied by the RPC', () => {
    const [top] = orderByTrueDistance(
      [{ ...near(100), distance_m: 42, source: 'dishi' as const }], LAT, LNG,
    );
    expect(top.distance_m).toBe(42);
  });

  // Provenance still matters when distance cannot separate them: the Dishi row may
  // carry real dish history and a stable id, and preferring the Google twin would
  // mint a second record for one physical place.
  it('breaks an exact tie toward the row that already exists in Dishi', () => {
    const rows = [
      { ...near(100), distance_m: 100, source: 'google' as const, name: 'g' },
      { ...near(100), distance_m: 100, source: 'dishi' as const, name: 'd' },
    ];
    expect(orderByTrueDistance(rows, LAT, LNG).map(r => r.name)).toEqual(['d', 'g']);
  });

  it('reproduces the report: the real neighbour outranks eight distant favourites', () => {
    const mine = [270, 1192, 1263, 1387, 1388, 1494, 1581, 1791].map(m => ({
      ...near(m), distance_m: m, source: 'dishi' as const, name: `mine-${m}`,
    }));
    const theirs = [{ ...near(60), distance_m: null, source: 'google' as const, name: '潮興魚蛋粉' }];
    // RatingStack auto-commits whatever lands first — that is the whole bug.
    expect(orderByTrueDistance([...mine, ...theirs], LAT, LNG)[0].name).toBe('潮興魚蛋粉');
  });
});
