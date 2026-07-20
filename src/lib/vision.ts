import { DIMS, DishVector, LEARN_CUTOFF } from './taste';
import { callClaude, imagePart, textPart, parseJsonResponse } from './openrouter';
import {
  sanitizeDietFlags, sanitizeCookingMethod, sanitizeHeaviness,
  DIET_FLAG_LIST, DIET_PROMPT_GUIDANCE, HK_MENU_SHORTHAND_GUIDANCE,
  type DietFlag, type CookingMethod, type Heaviness,
} from './menuScan';

export type VisionResult = {
  name: string;
  name_zh: string | null; // Traditional Chinese name (translated if needed)
  cuisine: string;
  attributes: DishVector;
  confidence: number;
  // Separate from `confidence` on purpose: confidence is "how sure am I WHICH dish
  // this is" (a blurry-but-real bowl of soup can be low-confidence and still very
  // much a dish). is_dish is "is this food at all" — a selfie, a receipt, a cat.
  // Defaults to true everywhere a real judgment isn't available (mock, no-key, a
  // failed call) so a missing signal never falsely accuses a real dish photo.
  is_dish: boolean;
  // Same closed vocabularies and sanitizers menu scanning uses (menuScan.ts) —
  // deliberately reused rather than reinvented, so a photographed dish and a
  // menu-scanned dish that later gets rated show up identically on the Taste tab.
  diet: DietFlag[];
  cooking_method: CookingMethod | null;
  heaviness: Heaviness | null;
  // Key ingredients (up to 4) the model reads off the dish. NOT a stored column —
  // passed through on the /api/dishes response so the rating/growth screen can show
  // them as chips + stream them into the taste blob without a second enrich round-trip.
  ingredients: string[];
  // True ONLY when the vision call genuinely failed (timeout / unparseable after
  // retries) and everything above is placeholder. is_dish stays true in that case
  // — benefit of the doubt — but the CLIENT must know the difference between "a
  // model looked and said dish" and "nobody ever looked": the first proceeds
  // silently, the second must ask the person instead of pretending. Deliberately
  // NOT set by the mock/no-key paths — those are working demo modes, not failures.
  vision_failed?: boolean;
};

const SYSTEM = `You identify a dish from a photo and estimate its sensory attributes.
Respond with ONLY a JSON object, no markdown fences, in this exact shape:
{"is_dish": boolean (true if the photo shows food/a dish at all — false for a
 selfie, a receipt, a menu, a pet, a landscape, or anything that clearly isn't
 something to eat),
 "name": string (English), "name_zh": string (the dish name in Traditional Chinese — translate if the dish isn't Chinese, e.g. "Margherita pizza" -> "瑪格麗特薄餅"),
 "cuisine": string (lowercase, e.g. "cantonese", "japanese", "italian"),
 "confidence": number 0..1 (how sure you are about the IDENTIFICATION — this can be
 low for a real but blurry/ambiguous dish; it's independent of is_dish),
 "ingredients": [string] (up to 4 key ingredients of the dish as classically prepared, lowercase),
 "diet": [string] (diet/allergen flags, from EXACTLY this set: ${DIET_FLAG_LIST} — omit any you're not reasonably confident about; empty array if none apply),
 "cooking_method": string|null (EXACTLY one of: fried, steamed, grilled, braised, baked, raw, stir-fried, boiled, other — your best culinary judgment from how it looks; null if unclear),
 "heaviness": string|null (light, medium, or heavy — your best culinary judgment; null if unclear),
 "attributes": { ${DIMS.map((d) => `"${d}": number 0..1`).join(', ')} }}
${DIET_PROMPT_GUIDANCE}
${HK_MENU_SHORTHAND_GUIDANCE}
Attributes are presence/intensity, not quality. A tonkotsu ramen might be
umami 0.9, rich 0.85, salty 0.7, chewy 0.6, spicy 0.1. If is_dish is false, still
fill name/cuisine/attributes with a best-effort placeholder — the caller decides
whether to use them. If the photo is ambiguous but plausibly food, set is_dish true
and give your best guess with lower confidence.`;

/**
 * Identify a dish and its attribute vector from a base64 photo.
 * Falls back to a deterministic mock when no OpenRouter key is configured so the
 * whole loop remains demoable offline. See src/lib/openrouter.ts for why
 * anthropic/claude-sonnet-5 is the model used here.
 */
export async function inferDish(base64: string, mediaType: string): Promise<VisionResult> {
  if (!process.env.OPENROUTER_API_KEY) return mockResult();

  // expectJson: a truncated/garbled body gets retried inside callClaude rather
  // than falling through to the fallback below — which matters here more than
  // anywhere, because that fallback's is_dish:true silently skips the
  // not-a-dish confirmation the moment a flaky response slips past.
  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Identify this dish.'),
  ], { maxTokens: 500, expectJson: true });

  const parsed = parseJsonResponse(text);
  // Call failed with a real key (timeout/model error): keep the log flow alive with
  // an honest low-confidence Unknown — the user gets the "fix the name" chip — rather
  // than fake demo data or a hard failure after they already took the photo.
  if (!parsed) {
    return { name: 'Unknown dish', name_zh: null, cuisine: 'unknown', attributes: {}, confidence: 0.1, is_dish: true, diet: [], cooking_method: null, heaviness: null, ingredients: [], vision_failed: true };
  }
  return sanitize(parsed);
}

function sanitize(raw: any): VisionResult {
  // Keep only dims the model reported with real presence (>= LEARN_CUTOFF). The old
  // loop wrote a value for EVERY dim, defaulting missing ones to 0 — which densified
  // the stored vector and reintroduced the missing-vs-confirmed-absent bug through
  // the back door: a stored murmur 0.1 is indistinguishable from confirmed
  // near-absence at both scoring and learning time. Live production rows (all 18
  // keys present on a photo-logged dish) confirmed this was happening. Sparse
  // storage makes the data match the epistemology the engine already commits to.
  const attributes: DishVector = {};
  for (const d of DIMS) {
    const v = clamp01(Number(raw?.attributes?.[d] ?? 0));
    if (v >= LEARN_CUTOFF) attributes[d] = v;
  }
  return {
    name: String(raw?.name ?? 'Unknown dish'),
    name_zh: raw?.name_zh ? String(raw.name_zh) : null,
    cuisine: String(raw?.cuisine ?? 'unknown').toLowerCase(),
    attributes,
    confidence: clamp01(Number(raw?.confidence ?? 0.5)),
    // Default true on any ambiguous/missing value — benefit of the doubt always
    // goes to "this is a real dish," never the other way.
    is_dish: raw?.is_dish !== false,
    diet: sanitizeDietFlags(raw?.diet),
    cooking_method: sanitizeCookingMethod(raw?.cooking_method),
    heaviness: sanitizeHeaviness(raw?.heaviness),
    ingredients: Array.isArray(raw?.ingredients)
      ? raw.ingredients.map((g: unknown) => String(g).trim().toLowerCase()).filter(Boolean).slice(0, 4)
      : [],
  };

}

function mockResult(): VisionResult {
  const attributes: DishVector = {};
  for (const d of DIMS) attributes[d] = 0.3;
  attributes.umami = 0.7;
  attributes.rich = 0.6;
  return { name: 'Logged dish (vision key not set)', name_zh: null, cuisine: 'unknown', attributes, confidence: 0.2, is_dish: true, diet: [], cooking_method: null, heaviness: null, ingredients: ['egg', 'scallion'] };
}

const ANCHORED_SYSTEM = `You re-analyze a dish photo. The eater has told you what the dish
ACTUALLY is — their identification is ground truth and overrides whatever the photo
might suggest on its own. Your job is to estimate the dish's sensory attributes and
cuisine, consistent with BOTH the given name and what is visible in the photo
(portion, preparation, sauce, char, garnish all still carry real information).
Respond with ONLY a JSON object, no markdown fences:
{"cuisine": string (lowercase, e.g. "cantonese", "japanese", "thai"),
 "ingredients": [string] (up to 4 key ingredients of the dish as classically prepared, lowercase),
 "diet": [string] (diet/allergen flags, from EXACTLY this set: ${DIET_FLAG_LIST} — omit any you're not reasonably confident about; empty array if none apply),
 "cooking_method": string|null (EXACTLY one of: fried, steamed, grilled, braised, baked, raw, stir-fried, boiled, other; null if unclear),
 "heaviness": string|null (light, medium, or heavy; null if unclear),
 "attributes": { ${DIMS.map((d) => `"${d}": number 0..1`).join(', ')} }}
${DIET_PROMPT_GUIDANCE}
${HK_MENU_SHORTHAND_GUIDANCE}
Attributes are presence/intensity, not quality. Only report attributes you are
genuinely confident about; leave uncertain ones near 0.`;

/**
 * Re-derives a dish's attributes, cuisine, and cooking-info (diet/cooking_method/
 * heaviness) from its photo, ANCHORED on the name the person corrected it to. This
 * exists because a dish record is a bundle derived from vision's original guess:
 * when the guess was wrong and the person fixes the name, EVERYTHING bundled with
 * the wrong guess is wrong too — not just cuisine and attributes, but the cooking
 * method shown on the Taste tab (a renamed "fried chicken" -> "steamed fish" must
 * not keep showing 香炸濃郁/"Rich & Fried" as its cooking style forever). Returns
 * null on any failure so the caller keeps existing values rather than blocking the
 * rename.
 */
export async function reanalyzeAnchored(
  name: string, base64: string, mediaType: string,
): Promise<{ attributes: DishVector; cuisine: string; diet: DietFlag[]; cooking_method: CookingMethod | null; heaviness: Heaviness | null } | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const text = await callClaude(ANCHORED_SYSTEM, [
    imagePart(base64, mediaType),
    textPart(`The eater says this dish is: ${name}`),
  ], { maxTokens: 400, expectJson: true });
  const parsed = parseJsonResponse<any>(text);
  if (!parsed) return null;
  const s = sanitize({ ...parsed, name });
  return { attributes: s.attributes, cuisine: s.cuisine, diet: s.diet, cooking_method: s.cooking_method, heaviness: s.heaviness };
}

/** The two vision prompt sites (fresh identify + name-anchored re-analysis) — exported
 * so a test can assert both embed the shared shorthand/diet grounding and can't
 * silently drop it, mirroring SCAN_PROMPTS in menuScan.ts. */
export const VISION_PROMPTS = [SYSTEM, ANCHORED_SYSTEM];

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
