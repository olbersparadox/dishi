// Row construction for POST /api/dishes/pick, extracted pure so the eaten_at
// rule is unit-testable (field-session batch 2026-07-23, item 2): pick time IS
// the eaten time — the person is at the table choosing off the menu — so every
// created row gets eaten_at stamped now. The photo path learns eaten_at from
// EXIF; the pick path knows it precisely, and before this it wrote nothing,
// which is why 食記 showed 某年某月某日 for a dish eaten an hour ago.
import { sanitizeDietFlags, sanitizeCookingMethod, sanitizeHeaviness } from './menuScan';

export type PickRowContext = {
  userId: string;
  restaurantId: string | null;
  tableSessionId: string | null;
  /** Injectable clock for tests; defaults to now. */
  now?: () => Date;
};

/** One insert-ready dishes row per usable item; malformed entries are skipped,
 * not allowed to fail the batch. Capped — this is a pick, not a data import. */
export function buildPickRows(items: unknown[], ctx: PickRowContext) {
  const now = ctx.now ?? (() => new Date());
  return items
    .map((raw: any) => {
      const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : '';
      if (!name) return null;
      return {
        user_id: ctx.userId,
        restaurant_id: ctx.restaurantId,
        table_session_id: ctx.tableSessionId,
        name,
        name_zh: typeof raw?.name_zh === 'string' ? raw.name_zh.trim().slice(0, 120) || null : null,
        cuisine: typeof raw?.cuisine === 'string' ? raw.cuisine.toLowerCase().slice(0, 40) : 'unknown',
        attributes: raw?.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
        // Re-sanitized, not trusted verbatim — the client echoes back what the scan
        // showed on screen, but it's still client input, and these are closed
        // vocabularies exactly like `cuisine` above should be too.
        cooking_method: sanitizeCookingMethod(raw?.cooking_method),
        heaviness: sanitizeHeaviness(raw?.heaviness),
        diet: sanitizeDietFlags(raw?.diet),
        photo_url: null,
        source: ctx.tableSessionId ? 'table' : 'scan',
        // Which ranked candidate this came from — lets table-mode "who picked
        // this" stamps match unambiguously when two candidates share a printed
        // name (see dishes.table_item_key's migration comment).
        table_item_key: typeof raw?.table_item_key === 'string' ? raw.table_item_key.slice(0, 60) : null,
        // Pick time IS the eaten time — known precisely, unlike the photo path's
        // best-effort EXIF read.
        eaten_at: now().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 30);
}
