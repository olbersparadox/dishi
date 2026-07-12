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

/**
 * Streaming variant of callClaude: same request, but with `stream: true`. Yields
 * the ACCUMULATED response text after every SSE chunk (not just the delta) — this
 * is what lets a caller re-run a tolerant partial-JSON parser (see
 * jsonSalvage.ts) against the growing buffer on every yield and discover complete
 * objects the moment they close, without needing any custom incremental-parser
 * state of its own.
 *
 * Standard OpenAI-compatible SSE framing (`data: {...}\n\n`, terminated by
 * `data: [DONE]\n\n`) — OpenRouter documents this exact format regardless of which
 * underlying model is selected, so this isn't model-specific parsing.
 *
 * Yields nothing (empty generator) if no API key is set, mirroring callClaude's
 * "no key -> caller's mock path" contract. A single malformed SSE frame is
 * skipped rather than aborting the whole stream — the downstream salvage parser
 * already tolerates a text buffer that isn't valid JSON at any given instant, so
 * losing one frame just delays that content fractionally, it doesn't break it.
 */
export async function* callClaudeStream(
  system: string,
  userContent: string | ContentPart[],
  opts: { maxTokens?: number } = {},
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      signal: AbortSignal.timeout(50_000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://dishi.app',
        'X-Title': 'Dishi',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1000,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch (e) {
    console.error('OpenRouter stream call failed/timed out', e);
    return;
  }

  if (!res.ok || !res.body) {
    console.error('OpenRouter stream error', res.status, await res.text().catch(() => ''));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });

      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? ''; // last element may be a partial line — carry over

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]' || payload === '') continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            accumulated += delta;
            yield accumulated;
          }
        } catch {
          // malformed frame — skip it, keep reading (see docstring)
        }
      }
    }
  } catch (e) {
    console.error('OpenRouter stream read failed mid-stream', e);
    // Fall through: whatever was already yielded stays valid. The caller's
    // partial-JSON parser will have already surfaced any complete items found
    // before this failure — a mid-stream drop degrades to "fewer dishes," not
    // "nothing," matching the existing truncation-handling philosophy.
  } finally {
    reader.releaseLock();
  }
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
