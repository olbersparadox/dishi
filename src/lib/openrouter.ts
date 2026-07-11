// Shared OpenRouter client for every LLM call in Dishi (menu scan, dish vision, voice
// note extraction, hand-added menu item attributes).
//
// MODEL: qwen/qwen3.7-plus — Jerry's choice (changed from anthropic/claude-sonnet-5).
// Requirement for any model in this slot: it MUST accept image input, since the menu
// scanner and dish vision callers send photos. If scans start failing or returning
// empty items, model capability is the first thing to check.
// Overridable via Vercel env (no redeploy-with-code-change needed to A/B models).
const MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen3.7-plus';

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
  const started = Date.now();
  const first = await callClaudeOnce(system, userContent, opts);
  if (first !== null) return first;
  // Retry exactly once on any FAST gateway-level failure (non-2xx, mangled body).
  // Validation on real menus hit this live: OpenRouter returned a non-JSON body
  // once and the identical request succeeded seconds later. A retry after a slow
  // failure (a genuine ~50s timeout) is skipped — it would stack past Vercel's
  // function budget and die mid-flight anyway.
  if (Date.now() - started > 15_000) return null;
  await new Promise(r => setTimeout(r, 800));
  return callClaudeOnce(system, userContent, opts);
}

async function callClaudeOnce(
  system: string,
  userContent: string | ContentPart[],
  opts: { maxTokens?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // Abort before Vercel's 60s function kill. CRITICAL: the abort THROWS — the
  // try/catch below turns it into a null return. Without it, the exception crashed
  // the whole route, Vercel served an HTML error page, and Safari surfaced it as
  // "The string did not match the expected pattern" when the client parsed JSON.
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
    signal: AbortSignal.timeout(50_000),
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
  } catch (e) {
    console.error('OpenRouter call failed/timed out', e);
    return null;
  }

  if (!res.ok) {
    console.error('OpenRouter error', res.status, await res.text().catch(() => ''));
    return null;
  }

  try {
    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch {
    console.error('OpenRouter returned non-JSON');
    return null;
  }
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
