import { DIMS, DishVector } from './taste';
import { callClaude, imagePart, textPart, parseJsonResponse } from './openrouter';

export type VisionResult = {
  name: string;
  name_zh: string | null; // Traditional Chinese name (translated if needed)
  cuisine: string;
  attributes: DishVector;
  confidence: number;
};

const SYSTEM = `You identify a dish from a photo and estimate its sensory attributes.
Respond with ONLY a JSON object, no markdown fences, in this exact shape:
{"name": string (English), "name_zh": string (the dish name in Traditional Chinese — translate if the dish isn't Chinese, e.g. "Margherita pizza" -> "瑪格麗特薄餅"),
 "cuisine": string (lowercase, e.g. "cantonese", "japanese", "italian"),
 "confidence": number 0..1 (how sure you are about the identification),
 "attributes": { ${DIMS.map((d) => `"${d}": number 0..1`).join(', ')} }}
Attributes are presence/intensity, not quality. A tonkotsu ramen might be
umami 0.9, rich 0.85, salty 0.7, chewy 0.6, spicy 0.1. If the photo is ambiguous,
give your best guess and lower confidence.`;

/**
 * Identify a dish and its attribute vector from a base64 photo.
 * Falls back to a deterministic mock when no OpenRouter key is configured so the
 * whole loop remains demoable offline. See src/lib/openrouter.ts for why
 * anthropic/claude-sonnet-5 is the model used here.
 */
export async function inferDish(base64: string, mediaType: string): Promise<VisionResult> {
  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Identify this dish.'),
  ], { maxTokens: 500 });

  const parsed = parseJsonResponse(text);
  if (!parsed) return mockResult();
  return sanitize(parsed);
}

function sanitize(raw: any): VisionResult {
  const attributes: DishVector = {};
  for (const d of DIMS) attributes[d] = clamp01(Number(raw?.attributes?.[d] ?? 0));
  return {
    name: String(raw?.name ?? 'Unknown dish'),
    name_zh: raw?.name_zh ? String(raw.name_zh) : null,
    cuisine: String(raw?.cuisine ?? 'unknown').toLowerCase(),
    attributes,
    confidence: clamp01(Number(raw?.confidence ?? 0.5)),
  };
}

function mockResult(): VisionResult {
  const attributes: DishVector = {};
  for (const d of DIMS) attributes[d] = 0.3;
  attributes.umami = 0.7;
  attributes.rich = 0.6;
  return { name: 'Logged dish (vision key not set)', name_zh: null, cuisine: 'unknown', attributes, confidence: 0.2 };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
