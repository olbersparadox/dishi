// Shared OpenRouter client for every LLM call in Dishi (menu scan, dish vision, voice
// note extraction, hand-added menu item attributes).
//
// MODEL CHOICE: anthropic/claude-sonnet-5, deliberately, for every vision/reasoning
// call in this file's callers:
//  - Menu Scanner is fundamentally an OCR-under-adversarial-conditions problem —
//    multi-column layouts, mixed Chinese/English, glare, handwriting — that ALSO
//    requires real culinary judgment (estimating flavor attributes for a dish the
//    model has never seen a photo of). That's precisely the profile Sonnet 5 is
//    built for: frontier-tier reasoning at a fraction of Opus cost, with full
//    multimodal (image) input.
//  - Opus 4.8 would be overkill and ~2.5x the cost per token for a task that isn't
//    bottlenecked on Opus-tier agentic planning.
//  - Haiku 4.5 is fast and cheap but a meaningfully weaker OCR/reasoning combination
//    for cluttered real-world menu photos — the failure mode (misread dishes, wrong
//    attributes) is exactly what would erode trust in the taste engine.
//  - Sonnet 5 is the deliberate middle: near-Opus quality on exactly this kind of
//    messy multimodal task, at Sonnet pricing.
// If OpenRouter deprecates this slug, check https://openrouter.ai/anthropic for the
// current Sonnet-class identifier before changing MODEL below.
const MODEL = 'anthropic/claude-sonnet-5';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * Call Claude (via OpenRouter's OpenAI-compatible endpoint) with a system prompt and
 * either plain text or text+image user content. Returns the raw text response;
 * callers handle their own JSON parsing/fence-stripping, since each has slightly
 * different tolerance for malformed output.
 *
 * Returns null if OPENROUTER_API_KEY isn't set, so every caller's existing
 * "no key -> mock" fallback keeps working unchanged.
 */
export async function callClaude(
  system: string,
  userContent: string | ContentPart[],
  opts: { maxTokens?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // Optional but recommended by OpenRouter for attribution/analytics on their
      // leaderboards — harmless to omit, cheap to include.
      'HTTP-Referer': 'https://dishi.app',
      'X-Title': 'Dishi',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    console.error('OpenRouter error', res.status, await res.text().catch(() => ''));
    return null;
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? null;
}

/** Build an image content part from base64 + media type, OpenAI-style data URL. */
export function imagePart(base64: string, mediaType: string): ContentPart {
  return { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } };
}

export function textPart(text: string): ContentPart {
  return { type: 'text', text };
}

/** Strip markdown fences and parse JSON, returning null on any failure. */
export function parseJsonResponse<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}
