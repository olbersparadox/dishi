// The shape a table session's menu_items array actually stores — shared by
// POST /api/table (create) and PATCH /api/table/[code] (append a scanned page,
// 2026-07-21) so the two write paths can never drift into different shapes.
import { sanitizeDietFlags, sanitizeCookingMethod, sanitizeHeaviness } from './menuScan';

export type TableMenuItem = {
  name: string; name_zh: string | null; name_original: string; price: string | null;
  hook: string; cuisine: string; attributes: Record<string, number>;
  diet: string[]; cooking_method: string | null; heaviness: string | null; ingredients: string[];
};

/** Trust but re-shape a client-submitted scan item: only carry the fields table
 * sessions actually store/use (mirrors the shape session.menu_items is read
 * back as in GET /[code]) — never a scan item's raw match/reason/fire fields,
 * which are specific to the ORIGINAL scanner's own taste profile and would be
 * meaningless (or actively misleading) shown as if they applied to the whole
 * table. diet/cooking_method/heaviness/ingredients ARE carried through — see
 * the item-1 correction's note in docs/BACKLOG.md for why that matters. `cap`
 * is the TOTAL the caller wants after this call, not necessarily this batch's
 * own size — a caller appending to an existing array should slice further
 * itself against remaining room (PATCH /api/table/[code]'s RPC does this
 * server-side, atomically). */
export function shapeTableMenuItems(raw: unknown[], cap = 40): TableMenuItem[] {
  return raw
    .map((r: any): TableMenuItem | null => {
      const name = typeof r?.name === 'string' ? r.name.trim().slice(0, 120) : '';
      if (!name) return null;
      return {
        name, name_zh: typeof r?.name_zh === 'string' ? r.name_zh : null,
        name_original: typeof r?.name_original === 'string' ? r.name_original : name,
        price: typeof r?.price === 'string' ? r.price : null,
        hook: typeof r?.hook === 'string' ? r.hook : '',
        cuisine: typeof r?.cuisine === 'string' ? r.cuisine : 'unknown',
        attributes: r?.attributes && typeof r.attributes === 'object' ? r.attributes : {},
        diet: sanitizeDietFlags(r?.diet),
        cooking_method: sanitizeCookingMethod(r?.cooking_method),
        heaviness: sanitizeHeaviness(r?.heaviness),
        // Open free text (not a closed vocabulary like diet), so just trimmed +
        // capped — matches MenuItem's own "up to 4 key ingredients" contract.
        ingredients: Array.isArray(r?.ingredients)
          ? r.ingredients.filter((x: unknown) => typeof x === 'string').map((s: string) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 4)
          : [],
      };
    })
    .filter((x): x is TableMenuItem => x !== null)
    .slice(0, cap);
}
