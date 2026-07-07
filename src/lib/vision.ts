import Anthropic from '@anthropic-ai/sdk';
import { DIMS, DishVector } from './taste';

export type VisionResult = {
  name: string;
  cuisine: string;
  attributes: DishVector;
  confidence: number;
};

const SYSTEM = `You identify a dish from a photo and estimate its sensory attributes.
Respond with ONLY a JSON object, no markdown fences, in this exact shape:
{"name": string, "cuisine": string (lowercase, e.g. "cantonese", "japanese", "italian"),
 "confidence": number 0..1 (how sure you are about the identification),
 "attributes": { ${DIMS.map((d) => `"${d}": number 0..1`).join(', ')} }}
Attributes are presence/intensity, not quality. A tonkotsu ramen might be
umami 0.9, rich 0.85, salty 0.7, chewy 0.6, spicy 0.1. If the photo is ambiguous,
give your best guess and lower confidence.`;

/**
 * Identify a dish and its attribute vector from a base64 photo.
 * Falls back to a deterministic mock when no API key is configured so the whole
 * loop remains demoable offline.
 */
export async function inferDish(base64: string, mediaType: string): Promise<VisionResult> {
  if (!process.env.ANTHROPIC_API_KEY) return mockResult();

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
          { type: 'text', text: 'Identify this dish.' },
        ],
      },
    ],
  });

  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return sanitize(parsed);
  } catch {
    return mockResult();
  }
}

function sanitize(raw: any): VisionResult {
  const attributes: DishVector = {};
  for (const d of DIMS) attributes[d] = clamp01(Number(raw?.attributes?.[d] ?? 0));
  return {
    name: String(raw?.name ?? 'Unknown dish'),
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
  return { name: 'Logged dish (vision key not set)', cuisine: 'unknown', attributes, confidence: 0.2 };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
