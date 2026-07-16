import { DIMS, DishVector, LEARN_CUTOFF } from './taste';
import { callClaude, callClaudeStream, imagePart, textPart, parseJsonResponse } from './openrouter';
import { salvageJsonObjects } from './jsonSalvage';

// Menu Scanner perception layer.
//
// Architecture note: this module ONLY does perception — turning a photo of a physical
// menu into structured items with attribute vectors. It deliberately does NOT rank or
// personalize. Ranking happens in the API route using the exact same contentScore()
// math that powers the feed, so a "92% match" on a scanned menu means the same thing
// as it does everywhere else in Dishi, and every recommendation is explainable from
// the user's real taste vector rather than model vibes.
//
// Photo-overlay grounding (bbox) R&D was built, validated across six real-photo
// rounds, and STOPPED at Jerry's 50% go/no-go bar (estimated 25-30% success).
// The harness and libs were removed in cleanup; full history lives in git
// (src/lib/bbox.ts, rowSnap.ts, /dev/bbox) if OCR-based grounding is revisited;
// nothing in the product scan flow depends on them.

/** Fixed, closed vocabularies for diet/cooking flags — never free text. A closed
 * set keeps the UI's icon mapping exhaustive and makes "likely-contains" framing
 * enforceable in the prompt itself, rather than trusting whatever string the model
 * feels like emitting. */
export const DIET_FLAGS = ['veg', 'pork', 'beef', 'seafood', 'shellfish', 'peanut', 'spicy'] as const;
export type DietFlag = typeof DIET_FLAGS[number];
export const COOKING_METHODS = ['fried', 'steamed', 'grilled', 'braised', 'baked', 'raw', 'stir-fried', 'boiled', 'other'] as const;
export type CookingMethod = typeof COOKING_METHODS[number];
export const HEAVINESS = ['light', 'medium', 'heavy'] as const;
export type Heaviness = typeof HEAVINESS[number];

// A coarser, 5-bucket cooking-style category, used as the scan card's featured
// "how it's cooked" line — deliberately coarser than the 9-value COOKING_METHODS
// above (which stays as-is for the enrichment schema and stays available for
// anyone who wants the finer value later). Real product feedback: the previous
// featured line was a per-dish sensory "hook" (e.g. "Wok-Charred, Numbing Heat")
// that often just restated the dish name in different words. A cooking-style
// category is a genuinely different axis of information at a glance.
export const COOKING_BUCKETS = ['fresh_raw', 'steamed_poached', 'grilled_roasted', 'braised_stewed', 'rich_fried'] as const;
export type CookingBucket = typeof COOKING_BUCKETS[number];

const COOKING_BUCKET_MAP: Record<CookingMethod, CookingBucket | null> = {
  raw: 'fresh_raw',
  steamed: 'steamed_poached',
  boiled: 'steamed_poached',   // closest existing value to "poached"
  grilled: 'grilled_roasted',
  baked: 'grilled_roasted',    // closest existing value to "roasted"
  braised: 'braised_stewed',
  fried: 'rich_fried',
  'stir-fried': 'rich_fried',  // oil-cooked, groups with fried rather than alone
  other: null,                 // no honest bucket to put it in — show nothing
};

/** Maps a dish's specific cooking method onto the coarser 5-bucket category, or
 * null when there's nothing honest to show (no method known, or 'other'). */
export function cookingBucket(method: CookingMethod | null | undefined): CookingBucket | null {
  if (!method) return null;
  return COOKING_BUCKET_MAP[method] ?? null;
}

export type MenuItem = {
  name: string;            // English name (translated if the menu isn't in English)
  name_zh: string | null;  // Traditional Chinese name (translated if the menu isn't Chinese)
  name_original: string;   // exactly as printed, e.g. 麻婆豆腐
  section: string | null;  // menu section header if present, e.g. "Starters", 小菜
  description: string | null;
  price: string | null;    // as printed, currency and all — no parsing games
  cuisine: string;
  hook: string;            // one distinctive sensory detail, e.g. "wok-charred, numbing heat"
                            // '' until enrichment fills it in (see scanMenuSkeleton)
  hook_zh: string;         // same hook, Traditional Chinese (HK flavor) — mirrors the
                            // name/name_zh bilingual pattern used everywhere else in Dishi
  attributes: DishVector;  // 0..1 presence on the shared 18 dims
  confidence: number;      // how legible/certain this item was
  // Day-0 utility fields — useful before ANY taste learning has happened, unlike
  // match scores or fire, which need evidence. "Likely" framing throughout: an LLM
  // reading a photo must never be treated as an allergy authority. Empty/null until
  // enrichment fills them in (see enrichOneDish).
  diet: DietFlag[];
  cooking_method: CookingMethod | null;
  heaviness: Heaviness | null;
  ingredients: string[];   // up to 4 key ingredients — also the substrate for the
                            // ingredient-affinity engine work planned separately
};

export type MenuScanResult = {
  items: MenuItem[];
  menu_language: string;
  restaurant_guess: string | null;
  mock: boolean;
  // Whether the photo was recognisably a menu at all. Only populated by the
  // skeleton scan path (scanMenuSkeleton/scanMenuSkeletonStream) — the older
  // one-shot scanMenu (used by owner menu upload and Table Mode) doesn't ask for
  // this signal, so it's simply absent there. Absent/missing is treated as true
  // downstream (a missing signal shouldn't invent a false "not a menu" verdict —
  // it just falls back to the pre-existing generic failure message). Only ever
  // meaningfully false when items is also empty; a real menu with zero readable
  // items still has is_menu: true (it's a menu, just an unreadable one).
  is_menu?: boolean;
};

const SYSTEM = `You read a photograph of a physical restaurant menu and extract EVERY legible dish as structured data.

Menus are messy: multiple columns, section headers, prices in odd places, mixed languages (especially Chinese + English), specials taped on, glare, handwriting. Work systematically. Do not invent items; extract partially-legible ones with lower confidence.

For each dish, estimate sensory attributes from culinary knowledge.

Respond with ONLY compact JSON, no markdown fences, minimal whitespace:
{"menu_language": string, "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name; translate if needed),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "h": string (<=6 words, most distinctive sensory hook),
   "f": number 0..1 (confidence),
   "a": [18 numbers 0..1, ONE decimal place, in this exact order: ${DIMS.join(', ')}]
 }]}
Keep output small: one decimal place everywhere, no extra fields. Extract at most 28 items; prefer mains and signatures over drinks and sides.`;

export async function scanMenu(base64: string, mediaType: string): Promise<MenuScanResult> {
  // Mock ONLY when no key is configured. A failed/timed-out call with a real key
  // must surface as an error, never silently masquerade as the demo menu.
  if (!process.env.OPENROUTER_API_KEY) return mockMenu();

  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish from this menu.'),
  ], { maxTokens: 3000 });

  const parsed = parseJsonResponse<{ items?: any[]; menu_language?: string; restaurant_guess?: string }>(text);
  if (!parsed) return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };

  const items: MenuItem[] = (parsed.items ?? []).map((raw: any) => sanitizeItem(raw)).filter(Boolean) as MenuItem[];
  if (items.length === 0) return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };
  return {
    items,
    menu_language: String(parsed.menu_language ?? 'unknown'),
    restaurant_guess: parsed.restaurant_guess ? String(parsed.restaurant_guess) : null,
    mock: false,
  };
}

// ---------------------------------------------------------------------------
// THREE-STAGE SCAN. A single call that OCRs a menu AND writes a hook AND estimates
// diet/cooking/heaviness/ingredients AND scores 18 flavor numbers per dish is a
// 20-40+ second generation task once a menu has more than a handful of items — no
// schema trick changes that, and a big blocking response means NOTHING is visible
// to the person until the slowest possible moment. So the work splits three ways:
//
//   Stage 1 (scanMenuSkeleton): name/name_zh/name_original/price/cuisine/confidence
//            ONLY. The lightest possible schema — this is what makes the list
//            appear fast. Always runs, for every scan.
//   Stage 2 (enrichOneDish, one call per dish, concurrency-capped — mirrors Stage 3
//            exactly): hook/diet/cooking_method/heaviness/ingredients. Text-only,
//            no image. Always runs (day-0 utility needs no taste learning), and
//            runs CONCURRENTLY with Stage 3 rather than waiting for it, since the
//            two are independent.
//   Stage 3 (scoreOneDish, unchanged): flavor vectors for ranking/fire. Only runs
//            once the user has enough ratings (>=5) for a score to mean anything.
//
// Per-dish concurrency-capped calls (src/lib/concurrency.ts) mean total wait is
// roughly bounded by the slowest single dish, not the sum of all of them, and
// results arrive in visible waves rather than all-at-once at the end.
//
// Honest scope note: this is NOT token-level streaming of the initial scan itself
// — that would need real SSE plumbing and incremental parsing of a response that
// can be truncated mid-object, a meaningfully bigger and riskier lift. This gets
// most of the perceived-speed win (a lighter Stage 1 call finishes faster in
// absolute terms, and Stage 2/3 fill in visibly in batches) by reusing the
// concurrency pattern already proven in this codebase, not by inventing new
// infrastructure under time pressure.
// ---------------------------------------------------------------------------

const SKELETON_SYSTEM = `You read a photograph and extract EVERY legible restaurant menu dish's IDENTITY only — not its flavor or details.

FIRST decide whether this photo is actually of a restaurant menu (printed, handwritten, or a chalkboard/digital menu display) — as opposed to a receipt, a dish itself, a random object, a person, a street scene, or anything else that isn't a menu. Be generous: a partial menu, a single page, a photo of a menu on a phone screen, and a badly-lit or angled menu are ALL still menus. Only mark "im": false when the photo genuinely shows something that is not a menu at all.

Menus are messy: multiple columns, section headers, prices in odd places, mixed languages (especially Chinese + English), specials taped on, glare, handwriting. Work systematically. Do not invent items; extract partially-legible ones with lower confidence.

Respond with ONLY compact JSON, no markdown fences, minimal whitespace:
{"im": boolean (true if this is a photo of a menu at all, false if it clearly is not),
 "menu_language": string, "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name; translate if needed),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "f": number 0..1 (confidence)
 }]}
If "im" is false, "items" MUST be an empty array — do not guess dishes out of a non-menu photo.
Extract at most 20 items; prefer mains and signatures over drinks and sides. Names, prices, and cuisine ONLY — no hooks, no flavor scoring, no diet flags, no cooking method, nothing else. Keep this fast.`;

export type OcrMenuItem = Omit<MenuItem, 'attributes'>;

export async function scanMenuSkeleton(base64: string, mediaType: string): Promise<MenuScanResult> {
  // Mock includes everything already (hardcoded, free) — the demo path stays a
  // single complete response, no enrichment/scoring stages needed.
  if (!process.env.OPENROUTER_API_KEY) return mockMenu();

  const text = await callClaude(SKELETON_SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish\u2019s name, price, and cuisine only. Nothing else.'),
  // Lighter schema than the old one-shot OCR call, but still generous: real
  // evidence from that call taught us a truncated mid-JSON response is a silent
  // full-scan failure, not a graceful one — erring generous here too.
  ], { maxTokens: 1800 });

  const parsed = parseJsonResponse<{ im?: boolean; items?: any[]; menu_language?: string; restaurant_guess?: string }>(text);

  if (parsed) {
    const items = (parsed.items ?? []).map((raw: any) => sanitizeSkeletonItem(raw)).filter(Boolean) as MenuItem[];
    // "im": false is only trusted when the model also returned zero items — a
    // model that both flags "not a menu" AND extracts real dishes is contradicting
    // itself, and extracted dishes are the stronger, more concrete signal.
    const isMenu = !(parsed.im === false && items.length === 0);
    if (items.length > 0) {
      return {
        items,
        menu_language: String(parsed.menu_language ?? 'unknown'),
        restaurant_guess: parsed.restaurant_guess ? String(parsed.restaurant_guess) : null,
        mock: false,
        is_menu: isMenu,
      };
    }
    if (!isMenu) {
      return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false, is_menu: false };
    }
  }

  const salvaged = text ? salvageJsonObjects(text, 'items').map((raw: any) => sanitizeSkeletonItem(raw)).filter(Boolean) as MenuItem[] : [];
  if (salvaged.length > 0) {
    console.log(`menu-scan/skeleton: salvaged ${salvaged.length} items from a truncated/malformed response`);
    return { items: salvaged, menu_language: 'unknown', restaurant_guess: null, mock: false, is_menu: true };
  }

  if (text) {
    console.error(`menu-scan/skeleton: unparseable response, length=${text.length}, head="${text.slice(0, 200)}", tail="${text.slice(-200)}"`);
  } else {
    console.error('menu-scan/skeleton: no response text at all (call failed/timed out before returning anything)');
  }
  return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false, is_menu: true };
}

export type SkeletonStreamEvent =
  | { kind: 'item'; item: MenuItem }
  | { kind: 'meta'; menu_language: string; restaurant_guess: string | null; is_menu: boolean };

/**
 * STREAMING Stage 1: yields each dish the MOMENT its own JSON object closes in
 * the model's growing response, instead of waiting for the whole menu to finish
 * generating. This is what makes dishes appear on screen one by one rather than
 * all at once after one long wait.
 *
 * Mechanism: re-runs the same tolerant partial-object parser used for truncation
 * recovery (salvageJsonObjects) against the ACCUMULATED buffer on every chunk —
 * cheap enough to re-scan from scratch each time for a menu-sized response, and
 * it means this generator needs no incremental-parser state of its own; it just
 * tracks how many complete items it's already yielded and emits the delta.
 *
 * The `meta` event (menu_language/restaurant_guess) is always yielded LAST, once
 * the stream has ended and the final buffer has been given one last parse —
 * matching the non-streaming scanMenuSkeleton's truncation-salvage behavior
 * (try a clean parse first, fall back to the same salvage pass) so a truncated
 * response degrades to "fewer dishes, real metadata where available" rather than
 * total failure.
 */
export async function* scanMenuSkeletonStream(base64: string, mediaType: string): AsyncGenerator<SkeletonStreamEvent, void, unknown> {
  let emitted = 0;
  let lastText = '';

  for await (const text of callClaudeStream(SKELETON_SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish\u2019s name, price, and cuisine only. Nothing else.'),
  ], { maxTokens: 1800 })) {
    lastText = text;
    const found = salvageJsonObjects(text, 'items');
    if (found.length > emitted) {
      for (let i = emitted; i < found.length; i++) {
        const item = sanitizeSkeletonItem(found[i]);
        if (item) yield { kind: 'item', item };
      }
      emitted = found.length;
    }
  }

  // Stream ended. Try a clean parse of the final buffer first (the common case:
  // the response closed normally); fall back to one more salvage pass for
  // anything a clean parse would reject outright (truncation, trailing garbage).
  const parsed = parseJsonResponse<{ im?: boolean; items?: any[]; menu_language?: string; restaurant_guess?: string }>(lastText);
  const finalItems = parsed?.items ?? salvageJsonObjects(lastText, 'items');
  for (let i = emitted; i < finalItems.length; i++) {
    const item = sanitizeSkeletonItem(finalItems[i]);
    if (item) yield { kind: 'item', item };
  }

  // Same rule as the non-stream path: "im": false is only trusted when the model
  // ALSO produced zero items overall (emitted so far + any final salvage). A
  // model that flags "not a menu" but still extracted real dishes is
  // contradicting itself — the extracted dishes are the stronger signal, and
  // trusting "im" over them would wrongly discard a real, if partial, scan.
  const totalItems = Math.max(emitted, finalItems.length);
  const isMenu = !(parsed?.im === false && totalItems === 0);

  yield {
    kind: 'meta',
    menu_language: String(parsed?.menu_language ?? 'unknown'),
    restaurant_guess: parsed?.restaurant_guess ? String(parsed.restaurant_guess) : null,
    is_menu: isMenu,
  };
}

const ENRICH_SYSTEM = `You describe ONE dish from a restaurant menu, using culinary knowledge only (no photo).
Respond with ONLY compact JSON, no fences:
{"h": string (<=6 words, most distinctive sensory hook, in ENGLISH, each word capitalized like a title),
 "hz": string (the SAME hook, in Traditional Chinese, Hong Kong Cantonese flavor — not a literal word-for-word translation, write it as a native speaker would),
 "d": [string] (diet/allergen flags this dish LIKELY has, from EXACTLY this set: veg, pork, beef, seafood, shellfish, peanut, spicy — omit any you're not reasonably confident about; empty array if none apply),
 "m": string|null (primary cooking method, from EXACTLY: fried, steamed, grilled, braised, baked, raw, stir-fried, boiled, other — null if unclear),
 "w": string|null (heaviness: light, medium, or heavy — your best culinary judgment; null if unclear),
 "i": [string] (up to 4 key ingredients, lowercase, e.g. "tofu","chili","garlic")}
Diet flags are your best estimate from the dish name and culinary knowledge, not a guarantee — never claim certainty about allergens.`;

export type Enrichment = { hook: string; hook_zh: string; diet: DietFlag[]; cooking_method: CookingMethod | null; heaviness: Heaviness | null; ingredients: string[] };

/**
 * Enrich ONE dish (name + cuisine + optional section context in, hook/diet/
 * cooking-method/heaviness/ingredients out). Deliberately not batched, mirroring
 * scoreOneDish exactly: the client fires one of these per dish, several in
 * parallel (concurrency-capped) — total wait becomes roughly the slowest single
 * call, not the sum of every dish, and each card fills in the moment ITS call
 * finishes rather than everyone waiting for the whole menu together.
 */
export async function enrichOneDish(item: { name: string; cuisine: string; section?: string | null }): Promise<Enrichment> {
  const userText = `${item.name}${item.section ? ` (menu section: ${item.section})` : ''} \u2014 cuisine: ${item.cuisine}`;
  const text = await callClaude(ENRICH_SYSTEM, userText, { maxTokens: 260 });
  const parsed = parseJsonResponse<any>(text);
  if (!parsed) return { hook: '', hook_zh: '', diet: [], cooking_method: null, heaviness: null, ingredients: [] };
  return {
    hook: String(parsed.h ?? '').slice(0, 80),
    hook_zh: String(parsed.hz ?? '').slice(0, 80),
    diet: sanitizeDietFlags(parsed.d),
    cooking_method: sanitizeCookingMethod(parsed.m),
    heaviness: sanitizeHeaviness(parsed.w),
    ingredients: sanitizeIngredients(parsed.i),
  };
}

const SCORE_ONE_SYSTEM = `You estimate sensory flavor attributes for ONE dish, using culinary knowledge only (no photo).
Respond with ONLY compact JSON, no fences: {"a": [18 numbers 0..1, one decimal, in this exact order: ${DIMS.join(', ')}]}`;

/**
 * Score a SINGLE dish (name + cuisine in, 18 flavor numbers out). Deliberately not
 * batched: the client fires one of these per dish, several in parallel (capped —
 * see src/lib/concurrency.ts) — total wait time becomes roughly the slowest single
 * call rather than the sum of every dish, and each dish's ring can light up the
 * moment ITS call finishes instead of all-or-nothing at the end.
 */
export async function scoreOneDish(item: { name: string; cuisine: string }): Promise<DishVector> {
  const userText = `${item.name} (${item.cuisine})`;
  const text = await callClaude(SCORE_ONE_SYSTEM, userText, { maxTokens: 150 });
  const parsed = parseJsonResponse<{ a?: unknown }>(text);
  return mergeScoredAttributes(1, Array.isArray(parsed?.a) ? [parsed!.a] : null)[0];
}

/**
 * Trust nothing from the model here either: wrong length, wrong types, extra/missing
 * entries are all real possibilities. Maps by index up to the shorter of the two
 * lengths; anything unmatched gets an empty (neutral) attribute set rather than a
 * crash or a misaligned dish-to-flavor mapping.
 */
export function mergeScoredAttributes(itemCount: number, scores: unknown[] | null): DishVector[] {
  const out: DishVector[] = Array.from({ length: itemCount }, () => ({}));
  if (!Array.isArray(scores)) return out;
  const n = Math.min(itemCount, scores.length);
  for (let i = 0; i < n; i++) {
    const arr = scores[i];
    if (!Array.isArray(arr)) continue;
    const attrs: DishVector = {};
    DIMS.forEach((d, di) => {
      const v = Number(arr[di]);
      if (Number.isFinite(v) && v > 0) attrs[d] = Math.min(1, Math.max(0, v));
    });
    out[i] = attrs;
  }
  return out;
}

export function sanitizeDietFlags(raw: any): DietFlag[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<string>(DIET_FLAGS);
  const seen = new Set<DietFlag>();
  for (const v of raw) { const s = String(v).toLowerCase(); if (valid.has(s)) seen.add(s as DietFlag); }
  return Array.from(seen);
}
export function sanitizeCookingMethod(raw: any): CookingMethod | null {
  const s = raw ? String(raw).toLowerCase() : '';
  return (COOKING_METHODS as readonly string[]).includes(s) ? (s as CookingMethod) : null;
}
export function sanitizeHeaviness(raw: any): Heaviness | null {
  const s = raw ? String(raw).toLowerCase() : '';
  return (HEAVINESS as readonly string[]).includes(s) ? (s as Heaviness) : null;
}
export function sanitizeIngredients(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 4).map(v => String(v).toLowerCase().slice(0, 30)).filter(Boolean);
}

export function sanitizeItem(raw: any): MenuItem | null {
  // Compact schema (short keys, fixed-order attr array) cuts output tokens ~55%,
  // which is the difference between finishing inside the serverless window and
  // getting killed at 60s on big menus. Long keys still accepted for back-compat.
  const name = raw?.n ?? raw?.name;
  if (!name) return null;
  const attributes: DishVector = {};
  const arr = raw?.a;
  if (Array.isArray(arr)) {
    DIMS.forEach((d, i) => {
      const v = Number(arr[i]);
      // >= LEARN_CUTOFF, not > 0: keep only genuinely detected presence. Sub-cutoff
      // values are model murmur — storing them distorts contentScore at menu-ranking
      // time and, if the item becomes a pick, ships murmur into a real dish row.
      if (Number.isFinite(v) && v >= LEARN_CUTOFF) attributes[d] = Math.min(1, v);
    });
  } else {
    for (const d of DIMS) {
      const v = Number(raw?.attributes?.[d]);
      if (Number.isFinite(v) && v >= LEARN_CUTOFF) attributes[d] = Math.min(1, v);
    }
  }
  return {
    name: String(name),
    name_zh: (raw.z ?? raw.name_zh) ? String(raw.z ?? raw.name_zh) : null,
    name_original: String(raw.o ?? raw.name_original ?? name),
    section: raw.section ? String(raw.section) : null,
    description: raw.description ? String(raw.description) : null,
    price: (raw.p ?? raw.price) ? String(raw.p ?? raw.price) : null,
    cuisine: String(raw.c ?? raw.cuisine ?? 'unknown').toLowerCase(),
    hook: String(raw.h ?? raw.hook ?? '').slice(0, 80),
    hook_zh: String(raw.hz ?? raw.hook_zh ?? '').slice(0, 80),
    attributes,
    confidence: Math.min(1, Math.max(0, Number(raw.f ?? raw.confidence ?? 0.5))),
    diet: sanitizeDietFlags(raw.d ?? raw.diet),
    cooking_method: sanitizeCookingMethod(raw.m ?? raw.cooking_method),
    heaviness: sanitizeHeaviness(raw.w ?? raw.heaviness),
    ingredients: sanitizeIngredients(raw.i ?? raw.ingredients),
  };
}

/** Stage 1 (skeleton) parsing: identity fields only. Everything Stage 2 would fill
 * in later starts at an honest "empty" — '' / [] / null, never a guess — so the
 * client can tell "not enriched yet" apart from "enriched and genuinely has none". */
export function sanitizeSkeletonItem(raw: any): MenuItem | null {
  const name = raw?.n ?? raw?.name;
  if (!name) return null;
  return {
    name: String(name),
    name_zh: (raw.z ?? raw.name_zh) ? String(raw.z ?? raw.name_zh) : null,
    name_original: String(raw.o ?? raw.name_original ?? name),
    section: raw.section ? String(raw.section) : null,
    description: null,
    price: (raw.p ?? raw.price) ? String(raw.p ?? raw.price) : null,
    cuisine: String(raw.c ?? raw.cuisine ?? 'unknown').toLowerCase(),
    hook: '',
    hook_zh: '',
    attributes: {},
    confidence: Math.min(1, Math.max(0, Number(raw.f ?? raw.confidence ?? 0.5))),
    diet: [],
    cooking_method: null,
    heaviness: null,
    ingredients: [],
  };
}

/** Demo menu so the whole flow works with no API key — clearly flagged as mock. */
function mockMenu(): MenuScanResult {
  const mk = (
    name: string, name_original: string, cuisine: string, hook: string, hook_zh: string, price: string, attrs: DishVector,
    diet: DietFlag[], cooking_method: CookingMethod, heaviness: Heaviness, ingredients: string[],
  ): MenuItem => ({
    name, name_zh: name_original, name_original, section: 'Demo menu', description: null, price, cuisine, hook, hook_zh,
    attributes: attrs, confidence: 0.9, diet, cooking_method, heaviness, ingredients,
  });
  return {
    mock: true,
    menu_language: 'demo',
    restaurant_guess: 'Demo Kitchen (no vision key set)',
    items: [
      mk('Mapo Tofu', '麻婆豆腐', 'sichuan', 'Numbing Heat, Silky Tofu', '麻辣鮮香，豆腐嫩滑', '$78', { spicy: 0.9, umami: 0.8, tender: 0.7, braised: 0.7, rich: 0.6, salty: 0.5 }, ['veg', 'spicy'], 'braised', 'medium', ['tofu', 'chili', 'sichuan peppercorn']),
      mk('Char Siu', '蜜汁叉燒', 'cantonese', 'Lacquered, Honeyed Char', '蜜汁油亮，叉燒香甜', '$92', { sweet: 0.7, grilled: 0.8, umami: 0.7, tender: 0.7, rich: 0.6 }, ['pork'], 'grilled', 'medium', ['pork', 'honey', 'five-spice']),
      mk('Steamed Fish', '清蒸魚', 'cantonese', 'Delicate, Ginger-Scallion', '清鮮嫩滑，薑蔥提味', '$168', { fresh: 0.9, steamed: 1, tender: 0.8, umami: 0.6 }, ['seafood'], 'steamed', 'light', ['fish', 'ginger', 'scallion']),
      mk('Salt & Pepper Squid', '椒鹽鮮魷', 'cantonese', 'Crackling Crust', '椒鹽香脆', '$88', { crispy: 0.9, fried: 0.9, salty: 0.7, chewy: 0.5 }, ['seafood', 'shellfish'], 'fried', 'heavy', ['squid', 'white pepper', 'garlic']),
      mk('Hot & Sour Soup', '酸辣湯', 'chinese', 'Sharp, Warming', '酸辣開胃，暖入心', '$48', { sour: 0.8, spicy: 0.6, umami: 0.6 }, ['pork', 'spicy'], 'boiled', 'light', ['tofu', 'vinegar', 'white pepper']),
      mk('Egg Tart', '蛋撻', 'cantonese', 'Flaky, Wobbly Custard', '酥皮蛋香，入口即溶', '$12', { sweet: 0.8, creamy: 0.8, crispy: 0.7, baked: 1, rich: 0.6 }, ['veg'], 'baked', 'medium', ['egg', 'butter', 'sugar']),
    ],
  };
}

/**
 * Attribute inference for HAND-ADDED menu items (no photo involved): a text-only
 * call turning "Salt & pepper squid — crispy battered squid, HK style" into the same
 * 18-dim vector the whole taste engine runs on. Without attributes, an item can't be
 * personalized; with a mock fallback of {} it ranks neutrally rather than wrongly.
 */
export async function inferAttributesFromText(name: string, description?: string | null, cuisine?: string | null): Promise<DishVector> {
  const system = `Estimate sensory attributes of a dish from its menu text using culinary knowledge. Respond ONLY with JSON: { <only dims with presence >= 0.15, from: ${DIMS.join(', ')}>: number 0..1 }`;
  const userText = `${name}${description ? ` — ${description}` : ''}${cuisine ? ` (${cuisine})` : ''}`;
  const text = await callClaude(system, userText, { maxTokens: 300 });
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  if (!parsed) return {};

  const attrs: DishVector = {};
  for (const d of DIMS) {
    const v = Number(parsed[d]);
    if (Number.isFinite(v) && v > 0) attrs[d] = Math.min(1, Math.max(0, v));
  }
  return attrs;
}
