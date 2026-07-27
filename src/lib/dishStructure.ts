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
 * Is this zh name a generic CATEGORY (炒飯, 燉湯) rather than a dish? Category
 * entries stay in the catalog (the resolver needs them as landing spots to
 * recognise) but are never merge TARGETS: 揚州炒飯 and 帶子炒飯 must never
 * both collapse onto 炒飯, so resolving onto a category yields no identity.
 *
 * THE RESIDUE RULE, not the empty-protein-slot signal the spec first proposed.
 * That signal was generated and reviewed against the full catalog (2026-07-28)
 * and over-fired on 17 of its 19 flags: slot decomposition gives 揚州炒飯 and
 * 炒飯 the IDENTICAL structure ([unspecified/stir_fried/rice]), so it cannot
 * tell a named style from a bare category — it would have excluded 雲吞麵,
 * 星洲炒米 and 揚州炒飯 from cross-venue comparison entirely, the opposite of
 * safe. What actually separates them is whether anything REMAINS once the
 * generic cooking/base vocabulary is stripped: 炒飯 reduces to 炒+飯 and
 * vanishes; 揚州炒飯 keeps 揚州; 雲吞麵 keeps 雲吞. A name that is nothing but
 * generic food words names a family, not a plate.
 *
 * Still structural (a fixed generic-vocabulary lexicon, not a dish blocklist),
 * deterministic, and independent of the LLM decomposition — a parse failure
 * cannot un-categorise 燉湯. The derived set over the live catalog is pinned
 * exactly in tests, so any drift is a conscious decision, never an accident.
 */
const GENERIC_ZH_TOKENS = [
  // multi-char base words first, so their characters aren't half-stripped
  '烏冬', '拉麵', '意粉', '米線', '通粉',
  // cooking methods
  '炒', '炸', '蒸', '燉', '燜', '炆', '滷', '燒', '烤', '焗', '煎', '灼', '滾', '煮', '拌',
  // carb vehicles / serving forms (deliberately NOT 肉/蛋/魚 — an ingredient
  // word is exactly what makes a name specific)
  '湯', '飯', '麵', '粉', '河', '米', '粥', '包', '串', '鍋',
];
export function zhNameIsGenericCategory(zh: string): boolean {
  let rest = zh.trim();
  if (!rest) return false;
  for (const t of GENERIC_ZH_TOKENS) rest = rest.split(t).join('');
  return rest === '';
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
