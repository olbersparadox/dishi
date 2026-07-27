// Canonical dish resolution — the LLM half of cross-venue dish identity.
//
// PIPELINE (catalog proposes, structure vetoes):
//   1. RESOLVE the dish name against the fixed catalog (the Phase 1 prompt,
//      verbatim from scripts/eval-catalog-resolution.ts — 0 false merges,
//      100% on decided held-out pairs; changing its wording means re-running
//      that eval). No confidence floor is applied: the measured result was
//      floorless, and a floor the eval never validated could only kill true
//      merges.
//   2. Category entries are not merge TARGETS — resolving onto 炒飯 yields no
//      cross-venue identity (isCategoryEntry, structural, no blocklist).
//   3. STRUCTURAL VETO: decompose the dish's own name; if both it and the
//      entry's precomputed structure parse and a SPECIFIED slot conflicts, the
//      merge is blocked. Silent whenever either side is opaque.
//
// Every failure degrades to null — "no cross-venue identity" is the designed
// safe state, so a flaky LLM call can never fuse two dishes' histories.
import { SupabaseClient } from '@supabase/supabase-js';
import { callClaude, parseJsonResponse } from './openrouter';
import { CATALOG, CATALOG_BY_ID, entryStructure, isCategoryEntry } from './hkDishCatalog';
import { sanitizeStructure, structureVetoes, type DishStructure } from './dishStructure';
import { PROTEINS, METHODS, BASES } from './dishStructure';

const RESOLVE_SYSTEM = `You map a dish name to an entry in a fixed catalog of common Hong Kong dishes.

The name may be Traditional Chinese, English, Japanese, a romanisation, a vision
model's guess, or carry qualifiers a catalog entry does not: 招牌/特色/精選 (house
special), 例牌/大/細 (portion), 日式/港式/星洲 (regional style), 生滾/白灼 (standard
method), 鮮/水晶/滑 (flourishes). Strip those and map to the underlying dish.

Map to the SAME entry when the plate is the same dish:
- a different language or romanisation of it
- a marketing, portion, style, method, or freshness qualifier on it
- a common misspelling of it

Map to DIFFERENT entries when the plate changes — a different protein, a
different carb vehicle, a different preparation, or a named dish vs the generic
category it belongs to.

Answer "none" when no entry is the same dish. "none" is CORRECT and expected for
anything the catalog does not cover — do NOT stretch to the nearest entry. A wrong
mapping permanently fuses two different dishes' rating histories; an honest "none"
costs nothing.

Respond with ONLY a JSON array, no prose, no fences, one object per input IN ORDER:
[{"i": <index>, "id": "<catalog id>" | "none", "confidence": 0.0-1.0}]`;

const catalogBlock = CATALOG.map(e => `${e.id} | ${e.zh} | ${e.en}`).join('\n');

export const DECOMPOSE_SYSTEM = `You decompose a dish name into three slots. Hong Kong / Cantonese context.

  protein  — the KEY ingredient: ${PROTEINS.join(' | ')}
  method   — how it is cooked:   ${METHODS.join(' | ')}
  base     — the carb vehicle:   ${BASES.join(' | ')}

"absent" vs "unspecified" is the load-bearing distinction — they are opposites:
- absent      = the dish genuinely LACKS this component, and the name shows it.
                燒鵝 has no carb -> base absent. 白粥 is plain by its own name ->
                protein absent. A drink or a plain dessert has no key protein ->
                protein absent.
- unspecified = the name is simply SILENT; the component may well exist.
                炒飯 alone names no protein -> protein unspecified (the plate
                could be 揚州/蝦仁/帶子). 魚片粥 names no method -> method
                unspecified (生滾 is how it is made; the name just omits it).
Never use absent to mean "the name doesn't say" — that is unspecified.

Rules:
- Read HK carb shorthand: 米=rice vermicelli(noodle), 河=flat rice noodle(noodle),
  意=spaghetti(pasta), 通=macaroni(pasta), 丁=instant noodle(noodle). 飯=rice,
  粥=congee, 麵/粉=noodle, 包=bread.
- "mixed" only for genuinely assorted items (拼盤, 車仔麵).
- 炒 = stir_fried. 炸 = deep_fried. 蒸 = steamed. 燜/炆/滷 = braised. 燒/烤 = roasted.

ALSO return "parseable": true only if the name TRANSPARENTLY names its parts.
Set it false for idiomatic or poetic names whose parts cannot be read off the
string — 絲襪奶茶, 西多士, 菠蘿油, 楊枝甘露, 老婆餅, 螞蟻上樹, 佛跳牆 — even if you
happen to know the dish. Structure must stay silent where the name is opaque.

Respond with ONLY a JSON array, no prose, no fences, one object per input IN ORDER:
[{"i": <index>, "protein": "...", "method": "...", "base": "...", "parseable": true|false}]`;

/** The label a dish resolves under — both names when both exist, same joining
 * the Phase 1 eval measured with. */
export function dishLabel(name: string | null | undefined, nameZh: string | null | undefined): string {
  return [nameZh, name].filter(Boolean).join(' / ');
}

/**
 * Is this landing STRING-ANCHORED — the entry's own zh name verbatim inside
 * the dish label? Then the structural veto must NOT run.
 *
 * Found live on the first backfill (2026-07-28): 烤豬肉串 failed to land on
 * its own exact catalog entry, and 日式舒芙蕾鬆餅 (a held-out TRUE pair) on
 * 舒芙蕾鬆餅. Near-identical names give decomposition noise room to
 * manufacture conflicts — "grilled pork skewers" parses `grilled` off the
 * English half against the entry's `roasted` (烤 maps to roasted; same plate,
 * synonym values). The veto was validated on genuinely DIFFERENT names; a
 * landing already anchored by the entry's full zh string is the "qualifier on
 * the underlying dish" case (招牌/日式/生滾…), not a semantic leap, and it is
 * the R&D's own wrong-veto shape (生滾魚片粥 ⊃ 魚片粥) generalised. Category
 * entries are excluded BEFORE the veto stage, so this exemption cannot
 * reopen the 揚州炒飯 → 炒飯 collapse.
 */
export function isStringAnchored(label: string, entryZh: string): boolean {
  return label.includes(entryZh);
}

/**
 * Decompose dish names into structures. Batched small with a high token
 * ceiling — measured on the reasoning model (see the R&D script): larger
 * batches exhaust the budget before emitting content. Missing/failed entries
 * simply aren't in the map; callers treat absence as unparseable.
 */
export async function decomposeDishNames(names: string[]): Promise<Map<number, DishStructure>> {
  const BATCH = 2;
  const out = new Map<number, DishStructure>();
  for (let s = 0; s < names.length; s += BATCH) {
    const slice = names.slice(s, s + BATCH);
    const user = slice.map((n, k) => `${s + k}. ${n}`).join('\n');
    const raw = await callClaude(DECOMPOSE_SYSTEM, `Dish names:\n${user}`, { maxTokens: 16000, expectJson: true });
    const parsed = parseJsonResponse<{ i: number; protein?: unknown; method?: unknown; base?: unknown; parseable?: unknown }[]>(raw);
    if (!Array.isArray(parsed)) continue;
    for (const p of parsed) {
      if (p && typeof p.i === 'number') out.set(p.i, sanitizeStructure(p));
    }
  }
  return out;
}

/**
 * Resolve one dish label to a canonical id, or null. Null is the safe,
 * designed answer for: uncovered dishes, category landings, structural vetoes,
 * hallucinated ids, and any LLM failure.
 */
export async function resolveCanonicalDishId(label: string): Promise<string | null> {
  if (!label.trim()) return null;

  const raw = await callClaude(
    RESOLVE_SYSTEM,
    `CATALOG (id | 中文 | English):\n${catalogBlock}\n\nDish names to map:\n0. ${label}`,
    { maxTokens: 6000, expectJson: true },
  );
  const parsed = parseJsonResponse<{ i: number; id?: unknown }[]>(raw);
  const id = Array.isArray(parsed) ? parsed.find(r => r?.i === 0)?.id : null;
  if (typeof id !== 'string' || id === 'none' || !CATALOG_BY_ID.has(id)) return null;

  // Categories are recognisable landing spots but never merge targets.
  if (isCategoryEntry(id)) return null;

  // Structural veto — only for landings the string itself doesn't anchor
  // (see isStringAnchored), and only when the entry side has a parseable
  // precomputed structure (else there is nothing to conflict with and
  // decomposing the dish name would be a wasted call).
  const entrySide = entryStructure(id);
  if (!isStringAnchored(label, CATALOG_BY_ID.get(id)!.zh) && entrySide?.parseable) {
    const dishSide = (await decomposeDishNames([label])).get(0);
    if (dishSide && structureVetoes(dishSide, entrySide)) return null;
  }

  return id;
}

/**
 * Resolve a dish's canonical id and persist it. Overwrites unconditionally —
 * a rename away from a catalog dish must CLEAR the stale id, so null is a
 * write, not a skip. Deliberately touches only canonical_dish_id: resolution
 * is resolution state, not name authority, and must never stamp
 * name_edited_at (the ladder's HUMAN tier is not ours to claim).
 */
export async function resolveAndStoreCanonicalDish(
  db: SupabaseClient,
  dishId: string,
  name: string | null | undefined,
  nameZh: string | null | undefined,
): Promise<string | null> {
  const canonical = await resolveCanonicalDishId(dishLabel(name, nameZh));
  await db.from('dishes').update({ canonical_dish_id: canonical }).eq('id', dishId);
  return canonical;
}
