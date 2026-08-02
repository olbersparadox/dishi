import { describe, it, expect } from 'vitest';
import {
  buildShortlist, findAdoptedName,
  SHORTLIST_RADIUS_M, SHORTLIST_RECENCY_DAYS, SHORTLIST_CAP,
  type ShortlistSource,
} from '../src/lib/nameShortlist';
import { visionUserText } from '../src/lib/vision';

// 一起食堂, Central — the coordinates of the field miss this feature exists for.
const ORIGIN = { lat: 22.2840611, lng: 114.1557694 };
const WHEN = '2026-08-02T04:44:39Z';

/** Metres north of the origin, as a source location. */
const northOf = (m: number) => ({ lat: ORIGIN.lat + m / 111_320, lng: ORIGIN.lng });
const daysFrom = (d: number) => new Date(new Date(WHEN).getTime() + d * 86_400_000).toISOString();

const session = (over: Partial<ShortlistSource> = {}): ShortlistSource => ({
  ...northOf(50), at: WHEN, names: ['和風牛肉烏龍麵'], ...over,
});

describe('buildShortlist — what vision is allowed to see', () => {
  it('includes a menu scanned beside the photo', () => {
    expect(buildShortlist([session()], ORIGIN, WHEN)).toEqual(['和風牛肉烏龍麵']);
  });

  it('drops a menu scanned beyond the radius', () => {
    const far = session(northOf(SHORTLIST_RADIUS_M + 50));
    expect(buildShortlist([far], ORIGIN, WHEN)).toEqual([]);
  });

  it('drops a menu scanned outside the recency window, in either direction', () => {
    const stale = session({ at: daysFrom(-(SHORTLIST_RECENCY_DAYS + 1)) });
    const future = session({ at: daysFrom(SHORTLIST_RECENCY_DAYS + 1) });
    expect(buildShortlist([stale], ORIGIN, WHEN)).toEqual([]);
    expect(buildShortlist([future], ORIGIN, WHEN)).toEqual([]);
  });

  it('keeps a restaurant’s standing identities regardless of age (at: null)', () => {
    const identities: ShortlistSource = { ...northOf(50), at: null, names: ['燒鵝髀飯'] };
    // Same source, dated a year ago as a session, would be dropped.
    expect(buildShortlist([identities], ORIGIN, WHEN)).toEqual(['燒鵝髀飯']);
    expect(buildShortlist([{ ...identities, at: daysFrom(-365) }], ORIGIN, WHEN)).toEqual([]);
  });

  it('fails closed on an unparseable scan timestamp rather than reaching for it', () => {
    expect(buildShortlist([session({ at: 'not a date' })], ORIGIN, WHEN)).toEqual([]);
  });

  it('de-duplicates cosmetically identical names across sources, keeping the first spelling', () => {
    const a = session({ names: ['蚊餅'] });
    const b = session({ ...northOf(60), names: ['（蚊餅）', ' 蚊餅 '] });
    expect(buildShortlist([a, b], ORIGIN, WHEN)).toEqual(['蚊餅']);
  });

  it('caps the list, preserving source order so identities survive before sessions', () => {
    const many = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    const identities: ShortlistSource = { ...northOf(10), at: null, names: many('ID', 5) };
    const scans: ShortlistSource = session({ names: many('SC', 100) });
    const out = buildShortlist([identities, scans], ORIGIN, WHEN);
    expect(out).toHaveLength(SHORTLIST_CAP);
    expect(out.slice(0, 5)).toEqual(many('ID', 5));
  });

  it('ignores sources with no usable coordinates', () => {
    expect(buildShortlist([session({ lat: NaN })], ORIGIN, WHEN)).toEqual([]);
  });
});

describe('findAdoptedName — exact-modulo-cosmetic, never fuzzy', () => {
  const menu = ['和風牛肉烏龍麵', '麻辣牛腱牛丸烏龍麵', '紅燒牛肉麵'];

  it('adopts the menu’s own words when vision echoes them', () => {
    expect(findAdoptedName('和風牛肉烏龍麵', menu)).toBe('和風牛肉烏龍麵');
  });

  it('snaps cosmetic drift back to the printed spelling', () => {
    expect(findAdoptedName(' 和風牛肉烏龍麵 ', menu)).toBe('和風牛肉烏龍麵');
  });

  // The adversarial neighbours that sat on the SAME 31-item list as the field
  // miss. A containment or similarity rule would merge these; only exact match
  // separates them, which is why the rule is exact (see ownerMenuExactMatch).
  it('refuses a near neighbour that shares most of its characters', () => {
    expect(findAdoptedName('牛肉烏龍麵', menu)).toBeNull();
    expect(findAdoptedName('烏龍麵', menu)).toBeNull();
  });

  it('adopts nothing when vision named a dish that is on no nearby menu', () => {
    expect(findAdoptedName('豚骨拉麵', menu)).toBeNull();
  });

  it('adopts nothing with an empty shortlist or no Chinese answer', () => {
    expect(findAdoptedName('和風牛肉烏龍麵', [])).toBeNull();
    expect(findAdoptedName(null, menu)).toBeNull();
    expect(findAdoptedName('', menu)).toBeNull();
  });
});

// The batch-wide constraint this item is bound by (BACKLOG, 2026-08-01):
// "Absent signal ⇒ byte-identical behaviour to today, enforced by a test per
// item." The literal below is the string this path sent before context existed;
// if a future edit makes context leak into the no-context call, this fails.
describe('visionUserText — additive-only, mechanically', () => {
  const BASELINE = 'Identify this dish.';

  it('sends the pre-context request when there is no context at all', () => {
    expect(visionUserText()).toBe(BASELINE);
    expect(visionUserText(null)).toBe(BASELINE);
    expect(visionUserText({})).toBe(BASELINE);
  });

  it('sends the pre-context request when the lookup came back empty', () => {
    expect(visionUserText({ shortlist: [], district: null })).toBe(BASELINE);
  });

  it('adds the locale line only when a district is actually known', () => {
    expect(visionUserText({ district: { zh: '中環', en: 'Central' } }))
      .toBe(`${BASELINE} Context: this photo was taken near 中環 / Central, Hong Kong.`);
    expect(visionUserText({ district: { zh: null, en: null } })).toBe(BASELINE);
  });

  it('lists the menu verbatim and tells the model it may refuse', () => {
    const text = visionUserText({ shortlist: ['和風牛肉烏龍麵', '紅燒牛肉麵'] });
    expect(text.startsWith(BASELINE)).toBe(true);
    expect(text).toContain('1. 和風牛肉烏龍麵');
    expect(text).toContain('2. 紅燒牛肉麵');
    expect(text).toContain('EXACTLY as printed');
    // The refusal clause carried 8 of 10 off-list cases in the measured run;
    // losing it turns a shortlist into a forced choice.
    expect(text).toContain('do not force a match');
  });
});
