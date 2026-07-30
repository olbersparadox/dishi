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
    const tableRows = buildPickRows([{ name: 'A' }], { ...ctx, tableSessionId: 'ts1', shared: true });
    expect(tableRows[0].source).toBe('table');
  });

  // Every successful scan now auto-creates a table session, so a session id no
  // longer implies company — only real membership does. Without this, every solo
  // scanner's pick would be recorded as having been eaten at a shared table.
  it('records a solo scan as `scan` even though a table session exists', () => {
    const alone = buildPickRows([{ name: 'A' }], { ...ctx, tableSessionId: 'ts1' });
    expect(alone[0].source).toBe('scan');
    expect(alone[0].table_session_id).toBe('ts1'); // still linked, just not "shared"
    const explicitlyAlone = buildPickRows([{ name: 'A' }], { ...ctx, tableSessionId: 'ts1', shared: false });
    expect(explicitlyAlone[0].source).toBe('scan');
  });

  it('never calls a pick shared when there is no session at all', () => {
    const rows = buildPickRows([{ name: 'A' }], { ...ctx, shared: true });
    expect(rows[0].source).toBe('scan');
  });

  // Backlog: "[S] Persist ingredients on dishes" — the scan's own enrichment
  // already produced these; a pick must carry them into the stored row instead
  // of discarding them like the pre-fix client→server round trip did.
  it('carries ingredients through, re-sanitized like diet/cooking_method/heaviness', () => {
    const rows = buildPickRows(
      [{ name: 'Char Siu', ingredients: ['pork', 'honey', 'not-a-real-one'.repeat(5), 'sugar', 'five'] }],
      ctx,
    );
    // sanitizeIngredients caps at 4 and lowercases/truncates — same contract as
    // the enrichment path, proven in menuScan.test.ts; this just pins re-use.
    expect(rows[0].ingredients).toHaveLength(4);
    expect(rows[0].ingredients).toContain('pork');
  });

  it('defaults ingredients to empty when the client sends none', () => {
    const rows = buildPickRows([{ name: 'A' }], ctx);
    expect(rows[0].ingredients).toEqual([]);
  });
});
