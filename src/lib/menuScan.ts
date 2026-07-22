import { DIMS, DishVector, LEARN_CUTOFF } from './taste';
import { callClaude, callClaudeStream, imagePart, textPart, parseJsonResponse } from './openrouter';
import { salvageJsonObjects } from './jsonSalvage';
import { ZH_FROM_MENU_GUIDANCE } from './nameTranslate';

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
export const DIET_FLAGS = [
  'veg', 'pork', 'beef', 'chicken', 'duck_goose', 'lamb',
  'seafood', 'shellfish', 'egg', 'dairy', 'offal', 'peanut', 'spicy',
] as const;
export type DietFlag = typeof DIET_FLAGS[number];

/** Single source of truth for the diet vocabulary INSIDE prompts. The flag set
 * used to be hand-pasted into three separate prompt strings; when 雞扎 shipped as
 * 豬肉+牛肉 with no way to say chicken, part of the cause was that the schema (7
 * flags) literally could not express the right answer, and nobody noticed because
 * the vocabulary lived in three places. Deriving it here means the prompts and the
 * sanitizer can never drift apart again. */
export const DIET_FLAG_LIST = DIET_FLAGS.join(', ');

/** The diet portion of every enrichment/vision prompt, grounded the way
 * dishIdentity.ts grounds NAME matching: Chinese food names lie at the surface, so
 * a string may never AUTHOR a flag — it can only make the model reason from the
 * real recipe. The chain (ingredients first → flags derived only from them) plus
 * the named trap classes is the whole fix; kept in one constant so all three
 * prompt sites say the exact same thing. */
export const DIET_PROMPT_GUIDANCE =
  `Reason about diet flags in TWO steps, in order:\n` +
  `  (1) First determine the dish's REAL typical ingredients as classically prepared.\n` +
  `  (2) Derive the diet flags ONLY from that ingredient list — NEVER from characters/words in the name.\n` +
  `Chinese names are often figurative: 菠蘿包 (pineapple bun) contains no pineapple; ` +
  `田雞 is frog, NOT chicken; 牛油 is butter, NOT beef; 魚香茄子 contains no fish. ` +
  `Reason from the recipe, not the characters.`;

/** The one extra line appended on a tripwire re-ask (see dietSuspicion). */
export const DIET_RECHECK_LINE =
  `Double-check the diet flags against the dish's classic recipe; correct any flag that does not belong.`;

/** HK-menu carb metonym integrity — same family as DIET_PROMPT_GUIDANCE, and just as
 * trust-critical. Hong Kong menus name the carbohydrate with a single-character
 * shorthand, and vision keeps misreading it as rice (炆米 → "braised rice") or
 * character-literally (干炒牛河 → "beef river") — a wrong carb then poisons the English
 * name, the ingredient chips, AND the 18-dim attribute vector the engine eats. Like
 * the diet guidance, strings never AUTHOR here: this makes the model EXPAND the
 * shorthand to the real dish before deriving anything. Kept in ONE constant so every
 * prompt site (both scan prompts, enrichment, and the two vision prompts) says it
 * identically and can't drift — the same discipline the z-rule and diet rule use. */
export const HK_MENU_SHORTHAND_GUIDANCE =
  `Hong Kong menus name the CARB by a single-character shorthand — expand it to the real dish BEFORE deriving the English name, ingredients, or flavour:\n` +
  `  米 = 米粉 (rice VERMICELLI), 河 = 河粉 (flat rice noodle / "chow fun"), 意 = 意粉 (spaghetti), ` +
  `通 = 通粉 (macaroni), 丁 = 出前一丁 (instant noodle), 瀨 = 瀨粉 (lai fun), 治 = 三文治 (sandwich), 多 / 西多 = 西多士 (French toast).\n` +
  `So 炆米 is braised rice VERMICELLI (never rice), 干炒牛河 is beef CHOW FUN (never "beef river"), 肉醬意 is bolognese SPAGHETTI, 火腿通 is ham MACARONI. ` +
  `The English name must be the KNOWN dish, never a character-literal reading.\n` +
  `齋 as a prefix means a vegetarian/mock version (齋叉燒 has no pork). 底 names the swappable carb base: 飯底 = on rice, 麵底 = on noodles, 意底 = on spaghetti.\n` +
  `But these SAME characters are NOT carb shorthand inside another word — reason from the real dish: ` +
  `米 in 粟米 (corn), 蝦米 (dried shrimp), 糯米 (glutinous rice), 米芝蓮 (Michelin) is not vermicelli; ` +
  `河 in 河蝦 (river shrimp) is not 河粉; 丁 in 雞丁 (diced chicken) is not instant noodle; 通 in 通菜 (water spinach) is not macaroni.\n` +
  // Chicken false-friends (observed live: 油雞髀 shipped as "Fried Chicken Thigh"). The
  // character names the CLASSIC PREPARATION, not a literal cooking verb.
  `Chicken false-friends: 油雞 = soy-poached chicken (豉油雞 — the 油 is the poaching liquor, NEVER deep-fried), ` +
  `白切雞 = plain poached chicken (method: poached, not "white cut" cooking), 手撕雞 = shredded poached chicken, ` +
  `風沙雞 = fried-garlic-crumb chicken (the "sand" is the golden garlic crumb).`;

/** The one extra line appended on a carb-shorthand tripwire re-ask (see carbSuspicion),
 * mirroring DIET_RECHECK_LINE. Names the concrete correction so the re-ask can self-fix. */
export const CARB_RECHECK_LINE =
  `The dish name may use Hong Kong carb shorthand: 米=米粉 (rice vermicelli), 河=河粉 (flat rice noodle), 意=意粉 (spaghetti), 通=通粉 (macaroni), 丁=出前一丁 (instant noodle) — NOT rice. Re-derive the ingredients from the correct carb.`;
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
{"menu_language": string (the menu's PRIMARY language as ONE lowercase word, e.g. "japanese"; if the menu is bilingual with English, report the NON-English language — that's the language the dishes are really in),
 "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name, HK register — if the menu isn't Chinese, TRANSLATE by meaning; NEVER leave kana/hangul in "z"; see the "z" rules below),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "h": string (<=6 words, most distinctive sensory hook),
   "f": number 0..1 (confidence),
   "a": [18 numbers 0..1, ONE decimal place, in this exact order: ${DIMS.join(', ')}]
 }]}
Keep output small: one decimal place everywhere, no extra fields. Extract at most 28 items; prefer mains and signatures over drinks and sides.
${ZH_FROM_MENU_GUIDANCE}
${HK_MENU_SHORTHAND_GUIDANCE}`;

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
 "menu_language": string (the menu's PRIMARY language as ONE lowercase word, e.g. "japanese"; if bilingual with English, report the NON-English language),
 "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name, HK register — if the menu isn't Chinese, TRANSLATE by meaning; NEVER leave kana/hangul in "z"; see the "z" rules below),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "f": number 0..1 (confidence)
 }]}
If "im" is false, "items" MUST be an empty array — do not guess dishes out of a non-menu photo.
Extract at most 20 items; prefer mains and signatures over drinks and sides. Names, prices, and cuisine ONLY — no hooks, no flavor scoring, no diet flags, no cooking method, nothing else. Keep this fast.
${ZH_FROM_MENU_GUIDANCE}
${HK_MENU_SHORTHAND_GUIDANCE}`;

/** The two scan prompt sites (one-shot + skeleton/stream) — exported so a test can
 * assert both embed the shared z-rule hardening and can't silently drop it again. */
export const SCAN_PROMPTS = [SYSTEM, SKELETON_SYSTEM];

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

// Field ORDER matters: "i" (ingredients) is emitted BEFORE "d" (diet) on purpose —
// the model must commit to the real recipe first, then read the flags off it, which
// is exactly the grounding DIET_PROMPT_GUIDANCE describes. Emitting flags first would
// invite the surface-name shortcut the whole spec exists to kill.
export const ENRICH_SYSTEM = `You describe ONE dish from a restaurant menu, using culinary knowledge only (no photo).
Respond with ONLY compact JSON, no fences:
{"h": string (<=6 words, most distinctive sensory hook, in ENGLISH, each word capitalized like a title),
 "hz": string (the SAME hook, in Traditional Chinese, Hong Kong Cantonese flavor — not a literal word-for-word translation, write it as a native speaker would),
 "i": [string] (up to 4 key ingredients of the dish as classically prepared, lowercase, e.g. "tofu","chili","garlic"),
 "d": [string] (diet/allergen flags, from EXACTLY this set: ${DIET_FLAG_LIST} — omit any you're not reasonably confident about; empty array if none apply),
 "m": string|null (primary cooking method, from EXACTLY: fried, steamed, grilled, braised, baked, raw, stir-fried, boiled, other — null if unclear),
 "w": string|null (heaviness: light, medium, or heavy — your best culinary judgment; null if unclear)}
${DIET_PROMPT_GUIDANCE}
${HK_MENU_SHORTHAND_GUIDANCE}
Diet flags are your best estimate, not a guarantee — never claim certainty about allergens.`;

export type Enrichment = { hook: string; hook_zh: string; diet: DietFlag[]; cooking_method: CookingMethod | null; heaviness: Heaviness | null; ingredients: string[] };
/** enrichOneDish's actual return: the enrichment plus whether the carb tripwire
 * FIRED on the first pass. Callers that persist a vector use the flag to justify
 * the one extra honest re-score (the vector was scored in parallel from the same
 * misreadable name); everyone else can ignore it. Deliberately true even when the
 * re-ask itself failed — a failed retry leaves the reading MORE suspect, not less. */
export type EnrichmentResult = Enrichment & { carb_suspect?: boolean };

/**
 * Enrich ONE dish (name + cuisine + optional section context in, hook/diet/
 * cooking-method/heaviness/ingredients out). Deliberately not batched, mirroring
 * scoreOneDish exactly: the client fires one of these per dish, several in
 * parallel (concurrency-capped) — total wait becomes roughly the slowest single
 * call, not the sum of every dish, and each card fills in the moment ITS call
 * finishes rather than everyone waiting for the whole menu together.
 */
const EMPTY_ENRICHMENT: Enrichment = { hook: '', hook_zh: '', diet: [], cooking_method: null, heaviness: null, ingredients: [] };

function parseEnrichment(text: string | null): Enrichment | null {
  const parsed = parseJsonResponse<any>(text);
  if (!parsed) return null;
  return {
    hook: String(parsed.h ?? '').slice(0, 80),
    hook_zh: String(parsed.hz ?? '').slice(0, 80),
    diet: sanitizeDietFlags(parsed.d),
    cooking_method: sanitizeCookingMethod(parsed.m),
    heaviness: sanitizeHeaviness(parsed.w),
    ingredients: sanitizeIngredients(parsed.i),
  };
}

export async function enrichOneDish(item: { name: string; name_zh?: string | null; cuisine: string; section?: string | null }): Promise<EnrichmentResult> {
  // Feed BOTH names when they differ: HK carb shorthand (and loosely-translated
  // protein names) live in the \u4e2d\u6587 name, so the model reasons from more truth \u2014
  // \u7086\u7c73 alongside a bland English name lets the shorthand glossary do its job.
  const zh = item.name_zh && item.name_zh !== item.name ? ` / ${item.name_zh}` : '';
  const userText = `${item.name}${zh}${item.section ? ` (menu section: ${item.section})` : ''} \u2014 cuisine: ${item.cuisine}`;
  const first = parseEnrichment(await callClaude(ENRICH_SYSTEM, userText, { maxTokens: 260 }));
  if (!first) return EMPTY_ENRICHMENT;

  // Tripwires, not authority (see dietSuspicion / carbSuspicion). A name/flag/
  // ingredient mismatch never edits a field itself \u2014 that would be exactly the
  // string-authoring bug the spec forbids. It only earns ONE re-ask of the same
  // knowledge call with a targeted "recheck" nudge, and whatever that re-ask returns
  // is final even if a tripwire would still fire (\u83e0\u863f\u5305 legitimately keeps its
  // no-pineapple answer). Both tripwires share the SAME single retry \u2014 if the diet
  // flags AND the carb both look off we append both lines and re-ask once, never
  // twice. Skip the retry with no key: the call would just return null again, and
  // mock mode has nothing to re-check.
  if (process.env.OPENROUTER_API_KEY) {
    const dietBad = dietSuspicion(item.name, item.name_zh ?? null, first.diet, first.ingredients);
    const carbBad = carbSuspicion(item.name, item.name_zh ?? null, first.ingredients);
    if (dietBad || carbBad) {
      const rechecks = [dietBad ? DIET_RECHECK_LINE : null, carbBad ? CARB_RECHECK_LINE : null].filter(Boolean).join('\n');
      const retry = parseEnrichment(await callClaude(ENRICH_SYSTEM, `${userText}\n${rechecks}`, { maxTokens: 260 }));
      // carb_suspect marks that the FIRST reading misread the carb \u2014 the signal a
      // vector scored in parallel from the same name is polluted too. It stays true
      // regardless of the retry outcome: a corrected retry proves the first pass was
      // wrong; a failed retry leaves it unverified. Either way the vector deserves
      // its one honest re-score (the follow-up this flag exists for).
      if (retry) return carbBad ? { ...retry, carb_suspect: true } : retry;
      if (carbBad) return { ...first, carb_suspect: true };
    }
  }
  return first;
}

// Protein morphemes and the ONE flag each implies, paired with the lowercase
// English ingredient substrings that count as real recipe support. This is the
// tripwire's whole vocabulary: it is deliberately small and closed. It NEVER
// authors a flag \u2014 it only decides whether a name and its flags are consistent
// enough to trust, or worth a single knowledge re-check.
const PROTEIN_TRIPWIRE: { morphemes: string[]; flag: DietFlag; ingredientKeys: string[] }[] = [
  { morphemes: ['\u96de', 'chicken'], flag: 'chicken', ingredientKeys: ['chicken'] },
  { morphemes: ['\u725b', 'beef'], flag: 'beef', ingredientKeys: ['beef'] },
  { morphemes: ['\u8c6c', 'pork'], flag: 'pork', ingredientKeys: ['pork'] },
  { morphemes: ['\u9d28', 'duck'], flag: 'duck_goose', ingredientKeys: ['duck'] },
  { morphemes: ['\u9d5d', 'goose'], flag: 'duck_goose', ingredientKeys: ['goose'] },
  { morphemes: ['\u7f8a', 'lamb', 'mutton'], flag: 'lamb', ingredientKeys: ['lamb', 'mutton'] },
  { morphemes: ['\u8766', 'shrimp', 'prawn'], flag: 'shellfish', ingredientKeys: ['shrimp', 'prawn'] },
  { morphemes: ['\u9b5a', 'fish'], flag: 'seafood', ingredientKeys: ['fish'] },
  { morphemes: ['\u86cb', 'egg'], flag: 'egg', ingredientKeys: ['egg'] },
];

// Figurative compounds where a protein character does NOT mean that protein. These
// are neutralised BEFORE morpheme scanning so the tripwire never demands chicken of
// \u7530\u96de (frog) or beef of \u725b\u6cb9 (butter) \u2014 the key anti-regression cases. This is a
// closed list of known traps, not a general parser; growing it is cheap and safe
// because the worst case of a missing trap is one harmless re-ask, never a wrong flag.
const DIET_NAME_TRAPS = ['\u7530\u96de', '\u725b\u6cb9\u679c', '\u725b\u6cb9', '\u9b5a\u9999', '\u9b5a\u9732', '\u9b5a\u86cb'];

/**
 * TRIPWIRE for diet-flag integrity \u2014 pure, exported, unit-tested. Returns true when
 * a dish's name and its diet flags look INCONSISTENT enough to be worth one recipe
 * re-check. It is advisory only: it never edits a flag, and a "true" here is a
 * question ("are you sure?"), never a verdict ("add chicken"). Two independent ways
 * to raise suspicion:
 *   1. A protein morpheme in the name has neither its flag NOR a supporting
 *      ingredient (e.g. \u96de\u624e named with chicken but tagged only pork+beef).
 *   2. A protein flag is present with no support in the name OR the ingredients
 *      (e.g. the bogus \u8c6c\u8089+\u725b\u8089 on \u96de\u624e \u2014 pork/beef backed by nothing).
 * Figurative names (\u7530\u96de, \u725b\u6cb9\u2026) are stripped first so their characters never fire
 * rule 1 \u2014 reasoning from the recipe, not the surface, exactly as the flags must.
 */
export function dietSuspicion(
  name: string | null | undefined,
  name_zh: string | null | undefined,
  flags: readonly string[],
  ingredients: readonly string[],
): boolean {
  let hay = `${name ?? ''} ${name_zh ?? ''}`.toLowerCase();
  for (const trap of DIET_NAME_TRAPS) hay = hay.split(trap.toLowerCase()).join(' ');
  const ings = ingredients.map(i => i.toLowerCase());
  const flagSet = new Set(flags.map(f => f.toLowerCase()));
  const ingredientSupports = (keys: string[]) => ings.some(ing => keys.some(k => ing.includes(k)));

  for (const p of PROTEIN_TRIPWIRE) {
    const inName = p.morphemes.some(m => hay.includes(m.toLowerCase()));
    const hasFlag = flagSet.has(p.flag);
    const hasIngredient = ingredientSupports(p.ingredientKeys);
    // Rule 1: the name says this protein, but nothing backs it up.
    if (inName && !hasFlag && !hasIngredient) return true;
    // Rule 2: the flag claims this protein, but nothing backs it up.
    if (hasFlag && !inName && !hasIngredient) return true;
  }
  return false;
}

// ── Carb metonym tripwire ──────────────────────────────────────────────────
// Same shape and philosophy as the diet tripwire above: a small, closed, pure
// checker that NEVER authors the carb — it only asks "are you sure?" and earns one
// recipe re-check when a HK carb-shorthand name and its derived ingredients disagree.
//
// Noodle carbs named by a single shorthand character. In a dish name each means a
// NOODLE, but vision keeps resolving them to rice (炆米 → "braised rice" + 飯 chip) or
// char-literally (干炒牛河 → "beef river"). 麵/面 are included so a plainly noodle-named
// dish that came back as rice is caught too.
const NOODLE_MORPHEMES = ['河', '米', '意', '通', '丁', '瀨', '麵', '面'];
// A plainly rice/-named dish — for the reverse trip (rice name, noodle ingredients).
const RICE_MORPHEMES = ['飯'];

// Compounds where a morpheme above is NOT the carb: a rice grain (糯米/粟米), a
// vegetable (通菜), a place (河內), "diced" (雞丁), a proper noun (米芝蓮). Neutralised
// BEFORE morpheme scanning, exactly like DIET_NAME_TRAPS, so an innocent character in
// a genuinely-rice or non-carb dish can't fire. Err toward neutralising: a missed fire
// is only status quo, and the ingredient-says-rice gate below blocks most false fires
// on its own. Closed list, cheap and safe to grow.
const CARB_NAME_TRAPS = [
  // 米 = rice grain / component / proper noun, not 米粉
  '糯米', '白米', '米飯', '蝦米', '粟米', '玉米', '薏米', '小米', '糙米', '黑米', '紅米',
  '米芝蓮', '米酒', '米醋', '爆米花', '香米',
  // 河 = river / place, not 河粉
  '河內', '河蝦', '河鮮', '山河',
  // 意 = intent, not 意粉
  '如意', '生意', '心意', '滿意', '綠意',
  // 通 = through / a vegetable, not 通粉
  '通菜', '交通', '卡通', '普通', '通通',
  // 丁 = diced / clove / pudding, not 出前一丁
  '雞丁', '肉丁', '魚丁', '蝦丁', '牛丁', '菜丁', '瓜丁', '丁香', '布丁', '白丁', '園丁',
  // 飯 = a place/word, not the dish's rice (guards the reverse trip)
  '飯店', '飯堂', '開飯',
];

// Ingredient tokens that reveal which carb the model actually derived. Kept apart so
// the tripwire can tell "read the shorthand as rice" (the bug) from "read it as the
// noodle it is" (correct). Rice-noodle products ("rice vermicelli", "flat rice
// noodle") say NOODLE — the noodle tokens are checked first and win. Bare 粉/麵 are
// deliberately NOT noodle tokens here: as ingredients they collide with powders/starch
// (生粉, 粟粉), so only unambiguous words + explicit noodle compounds count.
const CARB_RICE_TOKENS = ['rice', 'congee', '飯', '粥'];
const CARB_NOODLE_TOKENS = [
  'noodle', 'vermicelli', 'macaroni', 'spaghetti', 'pasta', 'udon', 'ramen', 'mee',
  'chow fun', 'ho fun', 'hor fun', 'rice stick', '米粉', '河粉', '通粉', '瀨粉', '米線',
];

/**
 * TRIPWIRE for HK carb-shorthand integrity — pure, exported, unit-tested; a sibling to
 * dietSuspicion. Returns true when a dish's NAME carries a noodle shorthand yet its
 * derived INGREDIENTS say rice (or a plainly-rice name whose ingredients came back
 * noodle). Advisory only: it never edits the carb, and "true" is a question
 * ("did you read the shorthand?"), never a verdict. Figurative/component names
 * (粟米, 蝦米, 河蝦, 雞丁…) are stripped first so an innocent character can't fire —
 * reasoning from the recipe, not the surface, exactly as the carb itself must be.
 *
 * SCOPE: the mechanical net keys off the ingredient list (the concrete, corrigible
 * pollution — a wrong ingredient chip AND the vector substrate). It does NOT try to
 * mechanically detect a char-literal English name ("beef river"); that leg is the
 * PROMPT glossary's job (HK_MENU_SHORTHAND_GUIDANCE), which fixes the name at the
 * source. 治/多 (sandwich / French toast) are bread shorthand the glossary handles
 * and this rice-vs-noodle check deliberately leaves alone.
 */
export function carbSuspicion(
  name: string | null | undefined,
  name_zh: string | null | undefined,
  ingredients: readonly string[],
): boolean {
  // The MORPHEME source is both names, trap-neutralised.
  let morphemeHay = `${name ?? ''} ${name_zh ?? ''}`.toLowerCase();
  for (const trap of CARB_NAME_TRAPS) morphemeHay = morphemeHay.split(trap.toLowerCase()).join(' ');
  const nameHasNoodle = NOODLE_MORPHEMES.some(m => morphemeHay.includes(m.toLowerCase()));
  const nameHasRice = RICE_MORPHEMES.some(m => morphemeHay.includes(m));

  // The DERIVED carb: ingredients are authoritative (the concrete pollution — the
  // ingredient chip + the vector substrate). When ingredients carry no carb signal at
  // all (e.g. a stored dish with no persisted ingredients — the backfill case), fall
  // back to a bare rice/noodle WORD in the English name ("Braised Rice", "…Vermicelli").
  const ingHay = ingredients.map(i => i.toLowerCase()).join(' ');
  const ingRice = CARB_RICE_TOKENS.some(t => ingHay.includes(t));
  const ingNoodle = CARB_NOODLE_TOKENS.some(t => ingHay.includes(t));
  const enHay = (name ?? '').toLowerCase();
  const enRice = CARB_RICE_TOKENS.some(t => enHay.includes(t)) && !CARB_NOODLE_TOKENS.some(t => enHay.includes(t));
  const enNoodle = CARB_NOODLE_TOKENS.some(t => enHay.includes(t)) && !CARB_RICE_TOKENS.some(t => enHay.includes(t));
  const noIngSignal = !ingRice && !ingNoodle;
  // Rice-noodle products ("rice vermicelli") name BOTH tokens — the noodle reading
  // wins, so a correctly-derived noodle dish is never mistaken for a rice one.
  const dataRice = (ingRice && !ingNoodle) || (noIngSignal && enRice);
  const dataNoodle = (ingNoodle && !ingRice) || (noIngSignal && enNoodle);

  // Rule 1: a noodle shorthand in the name, but the derived carb is rice — the
  // 炆米→飯 / 牛河→飯 production bug.
  if (nameHasNoodle && dataRice) return true;
  // Rule 2 (reverse): a plainly-rice name whose carb came back a noodle.
  if (nameHasRice && dataNoodle) return true;
  return false;
}

// Exported (not just for callers — the carbShorthand embed test asserts the
// shorthand glossary is present here and can't silently drop, same as the other
// five perception prompts). The glossary matters MOST here of anywhere: this
// prompt's 18 numbers are what the taste engine actually eats, and before it
// carried the glossary, 炆米 was scored as a braised-RICE dish even after the
// enrichment tripwire had corrected the ingredient chips.
export const SCORE_ONE_SYSTEM = `You estimate sensory flavor attributes for ONE dish, using culinary knowledge only (no photo).
Respond with ONLY compact JSON, no fences: {"a": [18 numbers 0..1, one decimal, in this exact order: ${DIMS.join(', ')}]}
${HK_MENU_SHORTHAND_GUIDANCE}`;

/** The user-text half of a score call — pure and exported so the honest-re-score
 * composition (grounding + recheck) is unit-testable without an LLM. Both names
 * travel when they differ (the shorthand lives in the 中文 name, exactly as
 * enrichOneDish already feeds its own call); `groundIngredients` anchors a
 * RE-score in the corrected recipe the tripwire re-ask produced — the strongest
 * honest signal we hold — and `carbRecheck` appends the same correction line the
 * enrichment retry uses, so both retries speak identically and can't drift. */
export function buildScoreUserText(
  item: { name: string; name_zh?: string | null; cuisine: string },
  opts?: { groundIngredients?: string[]; carbRecheck?: boolean },
): string {
  const zh = item.name_zh && item.name_zh !== item.name ? ` / ${item.name_zh}` : '';
  let text = `${item.name}${zh} (${item.cuisine})`;
  const ings = (opts?.groundIngredients ?? []).filter(Boolean);
  if (ings.length) text += `\nKey ingredients (verified): ${ings.join(', ')}`;
  if (opts?.carbRecheck) text += `\n${CARB_RECHECK_LINE}`;
  return text;
}

/**
 * Score a SINGLE dish (name + cuisine in, 18 flavor numbers out). Deliberately not
 * batched: the client fires one of these per dish, several in parallel (capped —
 * see src/lib/concurrency.ts) — total wait time becomes roughly the slowest single
 * call rather than the sum of every dish, and each dish's ring can light up the
 * moment ITS call finishes instead of all-or-nothing at the end.
 */
export async function scoreOneDish(
  item: { name: string; name_zh?: string | null; cuisine: string },
  opts?: { groundIngredients?: string[]; carbRecheck?: boolean },
): Promise<DishVector> {
  const text = await callClaude(SCORE_ONE_SYSTEM, buildScoreUserText(item, opts), { maxTokens: 150 });
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
