// Structural decomposition of Chinese dish names — the PURE half of the
// canonical-dish resolver (docs/rnd/dish-decomposition.md).
//
// A compositional name reads as [key ingredient] + [method] + [base]. Structure
// is a VETO on catalog resolution, never the rule itself: 36% of real HK names
// are non-compositional (絲襪奶茶, 西多士, 楊枝甘露 — measured on the held-out
// pairs), so the shape is *catalog proposes, structure vetoes*, and the veto
// stays silent whenever either side does not parse.
//
// The enum's load-bearing distinction: `absent` vs `unspecified`. The R&D's one
// wrong veto (生滾魚片粥 vs 魚片粥) came from conflating them into a single
// `none` — base-none on 蝦仁炒蛋 is a real property (no carb) and rightly
// conflicts with `rice`, while method-none on 魚片粥 just means the name is
// silent and must conflict with nothing. The naive fix ("none never conflicts")
// was checked and rejected: it also kills two of the four correct vetoes. The
// split keeps both: `absent` is specified (it vetoes), `unspecified` never does.

export const PROTEINS = ['beef', 'pork', 'chicken', 'duck_goose', 'fish', 'shellfish', 'egg', 'tofu_veg', 'mixed', 'absent', 'unspecified'] as const;
export const METHODS = ['stir_fried', 'deep_fried', 'steamed', 'braised', 'roasted', 'grilled', 'boiled_soup', 'raw', 'baked', 'absent', 'unspecified'] as const;
export const BASES = ['rice', 'noodle', 'congee', 'bread', 'pasta', 'dumpling_skin', 'absent', 'unspecified'] as const;

export type DishStructure = {
  protein: string;
  method: string;
  base: string;
  /** True only when the name TRANSPARENTLY names its parts. An opaque or poetic
   * name gets false, and structure then says nothing about it at all. */
  parseable: boolean;
};

/** A slot conflicts only when BOTH sides are specified and differ. `absent` IS
 * a specified value (no-carb genuinely conflicts with rice); `unspecified` is
 * silence, and silence is not evidence. */
export function slotConflicts(a: string, b: string): boolean {
  return a !== 'unspecified' && b !== 'unspecified' && a !== b;
}

/** Should structure BLOCK a proposed merge of these two names? Silent (false)
 * unless both sides parse and a specified slot genuinely disagrees. */
export function structureVetoes(a: DishStructure, b: DishStructure): boolean {
  if (!a.parseable || !b.parseable) return false;
  return slotConflicts(a.protein, b.protein)
    || slotConflicts(a.method, b.method)
    || slotConflicts(a.base, b.base);
}

/**
 * Is this the structure of a generic CATEGORY (炒飯, 燉湯) rather than a dish?
 * The empty-ingredient-slot signal, replacing any hand-maintained blocklist:
 * a parseable name whose key-ingredient slot is UNSPECIFIED names a family of
 * dishes, not a plate — 揚州炒飯 and 帶子炒飯 must never both collapse onto
 * 炒飯. Category entries stay in the catalog (the resolver needs them as
 * landing spots to recognise) but are never merge TARGETS: resolving onto one
 * yields no cross-venue identity.
 *
 * `absent` deliberately does NOT trigger this: a drink (港式奶茶) or a plain
 * dish (白粥) genuinely lacks a key protein and is still one specific thing —
 * exactly the flagship 絲襪奶茶 = 港式奶茶 merge this must not break.
 */
export function isCategoryStructure(s: DishStructure): boolean {
  return s.parseable && s.protein === 'unspecified';
}

/** Coerce one LLM-emitted slot value into the enum; anything unrecognised
 * becomes `unspecified` — "can't trust it" must degrade to silence, never to a
 * value that could veto. */
export function sanitizeSlot(value: unknown, allowed: readonly string[]): string {
  return typeof value === 'string' && allowed.includes(value) ? value : 'unspecified';
}

/** Coerce a whole LLM-emitted structure. A missing/failed parse flag degrades
 * to unparseable, which mutes both the veto and the category signal. */
export function sanitizeStructure(raw: { protein?: unknown; method?: unknown; base?: unknown; parseable?: unknown } | null | undefined): DishStructure {
  return {
    protein: sanitizeSlot(raw?.protein, PROTEINS),
    method: sanitizeSlot(raw?.method, METHODS),
    base: sanitizeSlot(raw?.base, BASES),
    parseable: raw?.parseable === true,
  };
}
