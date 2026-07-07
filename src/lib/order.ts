// Pure logic for the QR ordering flow, extracted for testability.

export const MAX_QTY_PER_ITEM = 20;
export const MAX_ITEMS_PER_ORDER = 30;
export const SESSION_FRESH_HOURS = 4;

/**
 * QR tokens: 20 chars, URL-safe, from crypto randomness. ~119 bits — unguessable,
 * which matters because the token is the ONLY thing protecting a table's session
 * from drive-by joins. Static by design (printed and laminated); "regenerate"
 * invalidates an old printed code by replacing the token.
 */
export function generateQrToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

/**
 * The join-if-open-else-create rule needs a freshness window: a lunch party's
 * session shouldn't capture unrelated dinner guests scanning the same table hours
 * later. Sessions older than SESSION_FRESH_HOURS are treated as expired for QR
 * joins and a fresh one is created.
 */
export function isSessionFresh(createdAt: string | Date, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const ageHours = (now.getTime() - created) / 36e5;
  return ageHours >= 0 && ageHours < SESSION_FRESH_HOURS;
}

export type CartLine = { menu_item_id: string; qty: number };
export type MenuRow = { id: string; name: string; price: string | null; available: boolean };
export type OrderSnapshotItem = { menu_item_id: string; name: string; price: string | null; qty: number };

/**
 * Build the immutable order snapshot from a client cart, trusting NOTHING from the
 * client except item ids and quantities:
 *  - names and prices are snapshotted from the live menu rows (client can't invent them)
 *  - unknown ids and unavailable items are dropped, with a warning per drop
 *  - quantities are clamped to [1, MAX_QTY_PER_ITEM], duplicate lines merged
 *  - an order is capped at MAX_ITEMS_PER_ORDER distinct items
 */
export function buildOrderSnapshot(
  cart: CartLine[],
  menu: MenuRow[],
): { items: OrderSnapshotItem[]; warnings: string[] } {
  const menuById = new Map(menu.map(m => [m.id, m]));
  const merged = new Map<string, number>();
  const warnings: string[] = [];

  for (const line of cart) {
    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    const item = menuById.get(line.menu_item_id);
    if (!item) { warnings.push('An item was removed from the menu and was dropped.'); continue; }
    if (!item.available) { warnings.push(`${item.name} is no longer available and was dropped.`); continue; }
    merged.set(line.menu_item_id, Math.min(MAX_QTY_PER_ITEM, (merged.get(line.menu_item_id) ?? 0) + qty));
  }

  const items = Array.from(merged.entries())
    .slice(0, MAX_ITEMS_PER_ORDER)
    .map(([id, qty]) => {
      const m = menuById.get(id)!;
      return { menu_item_id: id, name: m.name, price: m.price, qty };
    });

  return { items, warnings };
}
