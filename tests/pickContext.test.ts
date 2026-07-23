// Pick context integrity (field-session batch 2026-07-23, item 2): the one
// decision point for what a queued pick's growth card shows about WHERE, and
// whether the nearby-restaurant guess (whose optimistic persist can OVERWRITE a
// correct scan-time restaurant) is allowed to run at all.
import { describe, it, expect } from 'vitest';
import { pickPlaceContext } from '../src/lib/pickContext';
import { buildPickRows } from '../src/lib/pickRows';

const REST = { id: 'r1', name: 'Joy Hing', name_zh: '再興燒臘' };

describe('pickPlaceContext — restaurant known at creation', () => {
  it('renders the restaurant as FIXED context, never re-guessed', () => {
    const ctx = pickPlaceContext(REST, true, 'zh');
    expect(ctx.fixed).toBe(true);
    expect(ctx.choice).toBe('再興燒臘');
  });

  it('NEVER allows the nearby guess for a restaurant-bearing pick — even with coords', () => {
    // The overwrite path being killed at the root: loadNearby optimistic-persists
    // the geographically nearest, silently replacing the correct restaurant.
    expect(pickPlaceContext(REST, true, 'zh').loadNearby).toBe(false);
    expect(pickPlaceContext(REST, false, 'en').loadNearby).toBe(false);
  });

  it('labels in the chrome language, falling back to en when name_zh is missing', () => {
    expect(pickPlaceContext(REST, false, 'en').choice).toBe('Joy Hing');
    expect(pickPlaceContext({ ...REST, name_zh: null }, false, 'zh').choice).toBe('Joy Hing');
  });
});

describe('pickPlaceContext — restaurant-less pick (略過 at pick time)', () => {
  it('keeps the current picker behaviour unchanged: nearby runs iff coords exist', () => {
    expect(pickPlaceContext(null, true, 'zh')).toEqual({ choice: null, fixed: false, loadNearby: true });
    expect(pickPlaceContext(null, false, 'zh')).toEqual({ choice: null, fixed: false, loadNearby: false });
    expect(pickPlaceContext(undefined, true, 'en').loadNearby).toBe(true);
  });
});

describe('buildPickRows — pick time IS the eaten time', () => {
  const ctx = { userId: 'u1', restaurantId: 'r1', tableSessionId: null };

  it('stamps eaten_at = now on every created row', () => {
    const fixed = new Date('2026-07-23T12:34:56Z');
    const rows = buildPickRows(
      [{ name: 'Char Siu' }, { name: 'Roast Goose', name_zh: '燒鵝' }],
      { ...ctx, now: () => fixed },
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.eaten_at).toBe(fixed.toISOString());
  });

  it('keeps the existing row semantics: source by session, malformed items skipped', () => {
    const rows = buildPickRows([{ name: 'A' }, { name: '' }, {}, { name: 'B' }], ctx);
    expect(rows.map(r => r.name)).toEqual(['A', 'B']);
    expect(rows[0].source).toBe('scan');
    expect(rows[0].restaurant_id).toBe('r1');
    const tableRows = buildPickRows([{ name: 'A' }], { ...ctx, tableSessionId: 'ts1' });
    expect(tableRows[0].source).toBe('table');
  });
});
