import { describe, it, expect } from 'vitest';
import {
  decideSessionRestaurant, AUTO_RADIUS_M, AUTO_MARGIN_M, NearbyCandidate,
} from '../src/lib/tableRestaurant';

function dishi(name: string, distance_m: number | null): NearbyCandidate {
  return { source: 'dishi', id: `id-${name}`, name, lat: 22.3, lng: 114.2, distance_m };
}
function google(name: string, distance_m: number | null): NearbyCandidate {
  return { source: 'google', place_id: `pl-${name}`, name, lat: 22.3, lng: 114.2, distance_m };
}

describe('decideSessionRestaurant — the silent-attribution confidence gate', () => {
  it('adopts a lone nearby place with no interaction', () => {
    const v = decideSessionRestaurant([dishi('麥奇記', 12)]);
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('麥奇記');
  });

  it('adopts the nearest when it clearly beats the runner-up', () => {
    const v = decideSessionRestaurant([dishi('far', 55), google('near', 8)]);
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('near');
  });

  // The HK case this gate exists for: same building, different floors, both
  // inside GPS wobble. A "nearest wins" rule would answer confidently and be
  // wrong half the time.
  it('refuses to guess between two places closer together than GPS wobble', () => {
    const v = decideSessionRestaurant([dishi('2樓', 18), google('3樓', 22)]);
    expect(v.kind).toBe('ambiguous');
    expect(v.kind === 'ambiguous' && v.candidates.map(c => c.name)).toEqual(['2樓', '3樓']);
  });

  it('treats a gap of exactly the margin as still ambiguous — strictly greater required', () => {
    const v = decideSessionRestaurant([dishi('a', 5), dishi('b', 5 + AUTO_MARGIN_M)]);
    expect(v.kind).toBe('ambiguous');
  });

  it('returns none when everything is merely in the neighbourhood', () => {
    const v = decideSessionRestaurant([dishi('a', AUTO_RADIUS_M + 1), google('b', 300)]);
    expect(v.kind).toBe('none');
  });

  it('includes a place sitting exactly on the radius', () => {
    const v = decideSessionRestaurant([dishi('a', AUTO_RADIUS_M)]);
    expect(v.kind).toBe('confident');
  });

  // Source must not tip the decision — otherwise the answer depends on Dishi's
  // own coverage rather than on where the person is sitting.
  it('does not prefer a Dishi row over a nearer Google one', () => {
    const v = decideSessionRestaurant([dishi('known', 40), google('actually here', 2)]);
    expect(v.kind === 'confident' && v.candidate.name).toBe('actually here');
  });

  it('still refuses when the Dishi row is the near one but not separated', () => {
    const v = decideSessionRestaurant([dishi('known', 10), google('other', 20)]);
    expect(v.kind).toBe('ambiguous');
  });

  it('drops candidates with no distance rather than assuming they are near', () => {
    const v = decideSessionRestaurant([google('unknown distance', null)]);
    expect(v.kind).toBe('none');
  });

  it('offers at most 5 chips when a dense block is all ambiguous', () => {
    const many = Array.from({ length: 9 }, (_, i) => google(`shop${i}`, 10 + i));
    const v = decideSessionRestaurant(many);
    expect(v.kind).toBe('ambiguous');
    expect(v.kind === 'ambiguous' && v.candidates).toHaveLength(5);
    // Nearest-first, so the chips offered are the closest ones.
    expect(v.kind === 'ambiguous' && v.candidates[0].name).toBe('shop0');
  });

  it('handles an empty neighbourhood', () => {
    expect(decideSessionRestaurant([]).kind).toBe('none');
  });
});

// The menu-in-hand refinement (batch "attribution & naming accuracy" item 1):
// the scan's restaurant_guess enters the gate as testimony. Strictly positive —
// every non-matching shape must produce the byte-identical verdict the gate gave
// before the parameter existed, which the quiescence sweep at the bottom enforces
// mechanically rather than case by case.
describe('decideSessionRestaurant — printed-name refinement', () => {
  it('resolves the same-building ambiguity the gate refuses on distance alone', () => {
    const v = decideSessionRestaurant([dishi('美心', 18), google('翠華餐廳', 22)], '翠華');
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('翠華餐廳');
  });

  it('lets the menu override distance order — wobble is not testimony', () => {
    // Nearest by GPS is the neighbour; the menu in hand says otherwise.
    const v = decideSessionRestaurant([google('麥當勞', 8), dishi('翠華', 50)], '翠華');
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('翠華');
  });

  it('matches in either language, through normalization', () => {
    const zhRow: NearbyCandidate = { ...dishi('Tsui Wah', 20), name_zh: '翠華餐廳' };
    const v = decideSessionRestaurant([zhRow, google('other', 25)], '翠華餐廳');
    expect(v.kind === 'confident' && v.candidate.name).toBe('Tsui Wah');
  });

  it('bridges the branch-suffix shape via guarded containment', () => {
    const v = decideSessionRestaurant([google('元氣壽司 (銅鑼灣)', 30), dishi('隔離舖', 12)], '元氣壽司');
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('元氣壽司 (銅鑼灣)');
  });

  it('two same-name branches in range stay ambiguous — the name proves nothing between them', () => {
    const v = decideSessionRestaurant([dishi('翠華餐廳', 15), google('翠華餐廳', 40)], '翠華');
    expect(v.kind).toBe('ambiguous');
  });

  it('never extends the radius: a name match outside 60m is the chip path, not auto', () => {
    const v = decideSessionRestaurant([google('翠華餐廳', AUTO_RADIUS_M + 5)], '翠華');
    expect(v.kind).toBe('none');
  });

  it('is not a veto: a lone candidate that fails the match still wins by the old rule', () => {
    const v = decideSessionRestaurant([dishi('麥當勞', 12)], '翠華');
    expect(v.kind).toBe('confident');
    expect(v.kind === 'confident' && v.candidate.name).toBe('麥當勞');
  });

  // The batch-wide do-not-destabilize constraint, made mechanical: across every
  // shape the original suite exercises, absent or useless printedName must yield
  // deep-equal verdicts to the no-argument call.
  it('quiescence: null or unmatched names change nothing, on every candidate shape', () => {
    const shapes: NearbyCandidate[][] = [
      [],
      [dishi('a', 12)],
      [dishi('a', 18), google('b', 22)],
      [dishi('a', 5), dishi('b', 5 + AUTO_MARGIN_M)],
      [dishi('a', 55), google('b', 8)],
      [google('a', AUTO_RADIUS_M + 1)],
      [dishi('a', 10), google('b', 20), dishi('c', 30), google('d', 40), dishi('e', 50), google('f', 55)],
      [dishi('a', null)],
    ];
    for (const shape of shapes) {
      expect(decideSessionRestaurant(shape, null)).toEqual(decideSessionRestaurant(shape));
      expect(decideSessionRestaurant(shape, '完全無關的名')).toEqual(decideSessionRestaurant(shape));
    }
  });
});
