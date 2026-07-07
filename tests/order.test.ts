import { describe, it, expect } from 'vitest';
import {
  generateQrToken, isSessionFresh, buildOrderSnapshot,
  MAX_QTY_PER_ITEM, SESSION_FRESH_HOURS, type MenuRow,
} from '../src/lib/order';

describe('generateQrToken', () => {
  it('is 20 URL-safe chars, unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = generateQrToken();
      expect(t).toMatch(/^[a-zA-Z0-9]{20}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(500);
  });
});

describe('isSessionFresh — the lunch-vs-dinner window', () => {
  const now = new Date('2026-07-07T19:00:00Z'); // dinner service

  it('joins a session started within the window', () => {
    expect(isSessionFresh('2026-07-07T18:30:00Z', now)).toBe(true);
    expect(isSessionFresh(new Date(now.getTime() - (SESSION_FRESH_HOURS * 36e5 - 60000)), now)).toBe(true);
  });

  it('refuses a lunch session at dinner time', () => {
    expect(isSessionFresh('2026-07-07T12:30:00Z', now)).toBe(false);
    expect(isSessionFresh(new Date(now.getTime() - SESSION_FRESH_HOURS * 36e5), now)).toBe(false);
  });

  it('refuses garbage and future timestamps', () => {
    expect(isSessionFresh('not-a-date', now)).toBe(false);
    expect(isSessionFresh('2026-07-07T23:00:00Z', now)).toBe(false); // clock skew / tampering
  });
});

describe('buildOrderSnapshot — trust nothing from the client', () => {
  const menu: MenuRow[] = [
    { id: 'm1', name: 'Mapo tofu', price: '$78', available: true },
    { id: 'm2', name: 'Char siu', price: '$92', available: true },
    { id: 'm3', name: 'Egg tart', price: '$12', available: false }, // 86'd mid-service
  ];

  it('snapshots names and prices from the live menu, not the client', () => {
    const { items } = buildOrderSnapshot([{ menu_item_id: 'm1', qty: 2 }], menu);
    expect(items).toEqual([{ menu_item_id: 'm1', name: 'Mapo tofu', price: '$78', qty: 2 }]);
  });

  it('drops unknown ids and unavailable items, with warnings', () => {
    const { items, warnings } = buildOrderSnapshot([
      { menu_item_id: 'ghost', qty: 1 },
      { menu_item_id: 'm3', qty: 1 },
      { menu_item_id: 'm2', qty: 1 },
    ], menu);
    expect(items).toHaveLength(1);
    expect(items[0].menu_item_id).toBe('m2');
    expect(warnings).toHaveLength(2);
    expect(warnings.find(w => w.includes('Egg tart'))).toBeTruthy();
  });

  it('merges duplicate lines and clamps quantities', () => {
    const { items } = buildOrderSnapshot([
      { menu_item_id: 'm1', qty: 15 },
      { menu_item_id: 'm1', qty: 15 },
    ], menu);
    expect(items[0].qty).toBe(MAX_QTY_PER_ITEM);
  });

  it('rejects zero, negative, fractional-below-one, and NaN quantities', () => {
    const { items } = buildOrderSnapshot([
      { menu_item_id: 'm1', qty: 0 },
      { menu_item_id: 'm1', qty: -3 },
      { menu_item_id: 'm2', qty: 0.4 },
      { menu_item_id: 'm2', qty: NaN as unknown as number },
    ], menu);
    expect(items).toHaveLength(0);
  });

  it('floors fractional quantities above one', () => {
    const { items } = buildOrderSnapshot([{ menu_item_id: 'm1', qty: 2.9 }], menu);
    expect(items[0].qty).toBe(2);
  });

  it('an empty or fully-invalid cart yields an empty snapshot', () => {
    expect(buildOrderSnapshot([], menu).items).toHaveLength(0);
    expect(buildOrderSnapshot([{ menu_item_id: 'ghost', qty: 5 }], menu).items).toHaveLength(0);
  });
});
