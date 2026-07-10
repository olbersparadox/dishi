import { DIMS, DishVector, LEARN_CUTOFF } from './taste';
import { callClaude, imagePart, textPart, parseJsonResponse } from './openrouter';

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
 "attributes": { ${DIMS.map((d) => `"${d}": number 0..1`).join(', ')} }}
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

  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Identify this dish.'),
  ], { maxTokens: 500 });

  const parsed = parseJsonResponse(text);
  // Call failed with a real key (timeout/model error): keep the log flow alive with
  // an honest low-confidence Unknown — the user gets the "fix the name" chip — rather
  // than fake demo data or a hard failure after they already took the photo.
  if (!parsed) {
    return { name: 'Unknown dish', name_zh: null, cuisine: 'unknown', attributes: {}, confidence: 0.1, is_dish: true };
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
  };
}

function mockResult(): VisionResult {
  const attributes: DishVector = {};
  for (const d of DIMS) attributes[d] = 0.3;
  attributes.umami = 0.7;
  attributes.rich = 0.6;
  return { name: 'Logged dish (vision key not set)', name_zh: null, cuisine: 'unknown', attributes, confidence: 0.2, is_dish: true };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
