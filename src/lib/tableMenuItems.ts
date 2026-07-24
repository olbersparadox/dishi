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

/** The stage results a scan's post-creation passes produce, positionally
 * aligned with the scanned items (mapWithConcurrency preserves order; a null
 * slot is that item's failed call). */
type StageResults<T> = (T | null)[] | null;

/** Fold a scan's finished stages into the shape the shared table session
 * stores — ONE builder for every sync path (scan's fresh-scan re-author sync,
 * scan's append, /table's own add-a-page), so they can't drift on which stage
 * owns which field. `nameFixes` is the kana/hangul namefix result keyed by
 * name_original; folding it here (rather than reading item.name_zh) is what
 * fixes the stale-closure leak where the namefix only ever patched setResult
 * and the sync paths shipped the UNTRANSLATED snapshot to the whole table.
 * name_original passes through verbatim always (standing rule). */
export function mergeFinalScanItems<T extends {
  name: string; name_zh?: string | null; name_original: string; price?: string | null;
  hook?: string | null; cuisine?: string | null; attributes?: Record<string, number> | null;
  diet?: string[] | null; cooking_method?: string | null; heaviness?: string | null;
  ingredients?: string[] | null;
}>(
  items: T[],
  enriched: StageResults<T>,
  scored: StageResults<T>,
  nameFixes: Record<string, string> = {},
) {
  return items.map((item, i) => {
    const e = enriched?.[i];
    const s = scored?.[i];
    return {
      name: item.name,
      name_zh: nameFixes[item.name_original] ?? item.name_zh ?? null,
      name_original: item.name_original, price: item.price ?? null,
      hook: e?.hook ?? item.hook, cuisine: item.cuisine,
      attributes: s?.attributes ?? item.attributes ?? {},
      diet: e?.diet ?? item.diet, cooking_method: e?.cooking_method ?? item.cooking_method,
      heaviness: e?.heaviness ?? item.heaviness, ingredients: e?.ingredients ?? item.ingredients,
    };
  });
}

/** The candidate key GET /api/table/[code] hands out for a scan-shared
 * session's menu_items — and therefore the table_item_key a /table pick
 * stores. name_original, NOT the array index: the scan screen's own picks
 * already key on name_original (scan/page.tsx), and pickMatchesItem is an
 * exact key comparison, so index-keys on this side made every cross-view
 * stamp invisible in BOTH directions (two-account field test, 2026-07-24 —
 * "fixed" only by the scanner rejoining as a plain member). name_original is
 * also the one field re-authoring never touches, so the key survives the
 * namefix/enrich passes that now update the shared items mid-session. The
 * index fallback covers only degenerate stored items with no name at all. */
export function scanCandidateKey(m: { name_original?: string | null; name?: string | null }, index: number): string {
  return m.name_original || m.name || `menu-${index}`;
}
