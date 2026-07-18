import { describe, it, expect } from 'vitest';
import { pickAreaFromComponents } from '../src/lib/geocode';

describe('pickAreaFromComponents', () => {
  it('prefers a sublocality (neighborhood) over the whole city', () => {
    const area = pickAreaFromComponents([
      { long_name: 'Hong Kong', types: ['locality'] },
      { long_name: 'Causeway Bay', types: ['sublocality', 'sublocality_level_1'] },
    ]);
    expect(area).toBe('Causeway Bay');
  });

  it('falls back to locality when no sublocality exists', () => {
    const area = pickAreaFromComponents([
      { long_name: 'Singapore', types: ['locality'] },
    ]);
    expect(area).toBe('Singapore');
  });

  it('returns null rather than guessing when nothing usable is present', () => {
    const area = pickAreaFromComponents([
      { long_name: 'Some Country', types: ['country'] },
    ]);
    expect(area).toBeNull();
  });

  it('handles an empty component list', () => {
    expect(pickAreaFromComponents([])).toBeNull();
  });

  it('accepts sublocality_level_1 alone (not every result carries plain "sublocality")', () => {
    const area = pickAreaFromComponents([
      { long_name: 'Shibuya', types: ['sublocality_level_1'] },
    ]);
    expect(area).toBe('Shibuya');
  });

  it('picks a Hong Kong district tagged only as neighborhood (葵芳, 香港仔)', () => {
    // Real Google response shape for HK: no sublocality/locality at all — the district
    // is a `neighborhood`, above only the whole-territory admin level and the country.
    const area = pickAreaFromComponents([
      { long_name: '223', types: ['street_number'] },
      { long_name: '興芳路', types: ['route'] },
      { long_name: '葵芳', types: ['neighborhood', 'political'] },
      { long_name: '新界', types: ['administrative_area_level_1', 'political'] },
      { long_name: '香港', types: ['country', 'political'] },
    ]);
    expect(area).toBe('葵芳');
  });
});
