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
