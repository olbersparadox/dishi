// Shared OpenRouter client for every LLM call in Dishi (menu scan, dish vision, voice
// note extraction, hand-added menu item attributes).
//
/* MODEL comes from OPENROUTER_MODEL and there is NO fallback, deliberately.
 *
 * There used to be one (`|| 'qwen/qwen3.7-plus'`), and it cost a full day.
 * Production has set OPENROUTER_MODEL to a non-thinking vision model since
 * 2026-07-09, but `.env.local` never got the variable — so every local run,
 * probe, eval and A/B for 26 days silently exercised qwen3.7-plus, a THINKING
 * model production had not used since July. Nobody noticed until the provider
 * changed thinking-token accounting (~2026-08-02) and the local-only model
 * started returning empty completions, which read exactly like a production
 * outage and was diagnosed as one. It was not: production was healthy
 * throughout (scan-telemetry fail:0of9). Full account: docs/rnd/data-audit.md,
 * "The env divergence".
 *
 * A missing model config must therefore CRASH, loudly, at the first call. A
 * wrong-but-plausible model is worse than no model: it produces confident
 * measurements of something you are not shipping.
 *
 * Requirement for any model in this slot: it MUST accept image input — the menu
 * scanner and dish vision callers send photos. If scans start failing or return
 * empty items, model capability is still the first thing to check.
 */
const MODEL = process.env.OPENROUTER_MODEL;
const MODEL_UNSET_MSG =
  'OPENROUTER_MODEL is not set. There is no default on purpose — see the note in '
  + 'src/lib/openrouter.ts. Copy the value from Vercel → Environment Variables into '
  + '.env.local, so local runs and evals measure the model production actually ships.';
/** Throws — and shouts first. The throw alone is not enough: every caller here
 *  is wrapped in failure handling that turns exceptions into a quiet `null`,
 *  which is precisely the silent degradation that let a 26-day model divergence
 *  go unnoticed. The console.error survives that swallowing. */
function requireModel(): string {
  if (!MODEL) {
    console.error(`FATAL CONFIG: ${MODEL_UNSET_MSG}`);
    throw new Error(MODEL_UNSET_MSG);
  }
  return MODEL;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * WHICH company actually answers the call, not just which model.
 *
 * OpenRouter is a broker: several providers serve the same model id, and without
 * this field it picks one per request. That made scan reliability a lottery
 * (diagnosed 2026-07-31 from a report of "a menu photo that always worked
 * stopped working" — the photo was never the variable):
 *   - Alibaba answered a vision call with a hard 400, "InternalError.Algo.
 *     InvalidParameter: The image format is illegal and cannot be opened".
 *     Caught by the daily canary at 01:01, same pipeline and same encoding that
 *     had just succeeded. It rejects our images, so it is not eligible.
 *   - The SAME deployment returned 6 items at 09:19 and 0 items at 09:28
 *     (`0 items in 50005ms, is_menu=true` — the model recognised the menu, then
 *     burned the whole 50s overall cap emitting tokens without finishing an
 *     item). Provider-side degradation, not a code change: no commit ran
 *     between those two requests.
 *
 * The ignore list is EMPTY by owner decision (2026-07-31), and that emptiness is
 * load-bearing — do not "restore" an exclusion without new evidence. The history,
 * because it is a decision record:
 *
 * An `ignore: ['Alibaba']` briefly existed here (78ba0c4, never deployed).
 * Grounds: the daily canary caught Alibaba answering a vision call with a hard
 * 400 ("InternalError.Algo.InvalidParameter: The image format is illegal and
 * cannot be opened") on the same encoding that had just succeeded elsewhere.
 * The owner reversed it before it shipped, and the reversal is the sounder call:
 * it rested on ONE 400, the error reads like the provider's internal fault
 * dressed as a parameter complaint (i.e. plausibly transient), and we could not
 * name who served the FAST scans — so for all anyone knew, the exclusion banned
 * the very provider the good speed came from, permanently, over a bad hour.
 *
 * The instrument that settles it is the provider attribution logged below: every
 * stream now names who answered on success AND failure. Re-arm an exclusion (or
 * better, an `order:` preference) only from that data — a provider seen failing
 * vision calls repeatedly across days, or an uptime-ranked list via
 * `/api/v1/models/<model>/endpoints`. One bad answer is weather; the logs are
 * climate.
 *
 * The field still ships with allow_fallbacks (OpenRouter's default, stated
 * explicitly) so the plumbing stays wired and tested: when the data does name a
 * culprit, the fix is a one-line edit here, not a re-derivation of where
 * routing goes.
 */
const PROVIDER_ROUTING: { ignore: string[]; allow_fallbacks: boolean } =
  { ignore: [], allow_fallbacks: true };

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
/** Options shared by the one-shot and streaming callers.
 *
 * `reasoning` (OpenRouter's normalized control) currently has NO production
 * caller, deliberately.
 *
 * ⚠️ SCOPE OF THE A/B BELOW (corrected 2026-08-04): it was run against
 * **qwen3.7-plus**, which is NOT what production runs — production has set
 * OPENROUTER_MODEL to a non-thinking vision model since 2026-07-09. The A/B
 * was almost certainly executed locally, where an absent env var fell through
 * to the qwen3.7-plus default (that fallback is now removed; see the MODEL
 * note at the top of this file). So these findings describe a model the app
 * does not ship, and they say nothing about the current one — which, being
 * non-thinking, has no reasoning behaviour to tune at all. Kept verbatim as a
 * decision record, not as guidance for today.
 *
 * The A/B, for qwen3.7-plus:
 *   - 'off': 20x faster (enrich p50 37s -> 2s, reasoning_tokens 2394 -> 0)
 *     but the diet-flag DERIVATION DISCIPLINE collapses — the soy-seasoning
 *     rule broke on 9/35 dishes, and カキフライ lost `shellfish` while its own
 *     ingredient list said "oyster". Allergen flags feed the tripwires;
 *     disqualified.
 *   - 'low': quality holds (20/27 flag-identical) but ZERO latency win
 *     (p50 39.7s) — this endpoint treats effort as binary, so 'low' still
 *     thinks at full length.
 * Fast-but-unsafe or safe-but-not-fast: no setting was ever right for THAT
 * model, so the env toggle that briefly wired it was removed. Kept as a
 * capability because any future OPENROUTER_MODEL swap TO A THINKING MODEL
 * should re-run exactly this A/B — with the env var set, so it measures what
 * is actually deployed — and the request plumbing is the annoying half. */
type CallOpts = {
  maxTokens?: number; expectJson?: boolean; timeoutMs?: number;
  /** 'off' | 'low' per the A/B above; `{ max_tokens }` is an EXPLICIT thinking
   * budget (OpenRouter-normalized), added 2026-08-04 when the provider changed
   * `max_tokens` to bound thinking+answer combined and unbounded thinking began
   * eating every completion budget in the app (see docs/rnd/data-audit.md,
   * "LIVE OUTAGE"). Verified: the endpoint consumes exactly the budget given
   * and then answers (finish: stop) — thinking bounded by US, not by them. */
  reasoning?: 'off' | 'low' | { max_tokens: number };
};

export async function callClaude(
  system: string,
  userContent: string | ContentPart[],
  opts: CallOpts = {},
): Promise<string | null> {
  // Retry on FAST failures only (the elapsed gate below): a retry after a slow
  // failure (a genuine ~50s timeout) would stack past Vercel's function budget
  // and die mid-flight anyway.
  //
  // TWO failure shapes get retried, not one. Validation on real menus hit the
  // first live: OpenRouter returned a non-JSON body once and the identical
  // request succeeded seconds later (-> null from callClaudeOnce). The second
  // was measured 2026-07-18 against the live provider: HTTP 200 with a valid
  // envelope whose `content` is TRUNCATED JSON, cut mid-object — which is
  // non-null, so the old single-retry logic waved it through to the caller,
  // whose parse then failed silently. For dish vision that silent parse
  // failure fell through to the is_dish:true fallback — exactly the case the
  // not-a-dish guard exists for. `expectJson` lets a caller declare "an
  // unparseable response IS a failure," making truncated bodies retryable.
  //
  // Attempt counts come from a 28-call probe during a degraded provider
  // window: 29% first-attempt failures, one retry recovered ~60% of them, a
  // second cuts the residual roughly in half again. Callers without expectJson
  // keep the original retry-once behavior unchanged.
  //
  // The per-attempt timeout ESCALATES (base, then 2x, then 3x). Found by the
  // canary's first-ever run (2026-07-29): during a slow-provider window the
  // model spent 817 reasoning tokens (~16s) on a 3-word hook, so a FIXED 12s
  // budget aborted attempt 1 mid-body — and then aborted the identical
  // attempt 2 at the identical 12s. A flat timeout only defends against
  // transient faults; under sustained slowness it converts "slow chips" into
  // "no chips, silently, for every dish". Attempt 1 stays tight (fast-fail
  // wins when the fault is transient), the retry gets patience.
  const started = Date.now();
  const attempts = opts.expectJson ? 3 : 2;
  let last: string | null = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      if (Date.now() - started > 15_000) break;
      await new Promise(r => setTimeout(r, 800));
    }
    const timeoutMs = opts.timeoutMs === undefined ? undefined : opts.timeoutMs * (i + 1);
    last = await callClaudeOnce(system, userContent, { ...opts, timeoutMs });
    if (last !== null && (!opts.expectJson || parseJsonResponse(last) !== null)) return last;
  }
  return last;
}

async function callClaudeOnce(
  system: string,
  userContent: string | ContentPart[],
  opts: CallOpts = {},
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  // Abort before Vercel's 60s function kill. CRITICAL: the abort THROWS — the
  // try/catch below turns it into a null return. Without it, the exception crashed
  // the whole route, Vercel served an HTML error page, and Safari surfaced it as
  // "The string did not match the expected pattern" when the client parsed JSON.
  //
  // timeoutMs: callers with SMALL expected outputs (per-dish enrich/score — a
  // healthy answer takes single-digit seconds) pass a tight budget so a hung
  // attempt aborts early and RETRIES, instead of eating the route's whole
  // maxDuration on one dead request (the degraded-provider probe in callClaude's
  // notes: a fresh attempt recovers ~60% of failures). Default stays 50s.
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? 50_000),
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
      model: requireModel(),
      provider: PROVIDER_ROUTING,
      max_tokens: opts.maxTokens ?? 1000,
      // OpenRouter-normalized reasoning control (see CallOpts). Absent unless a
      // caller explicitly opted in, so default behavior is byte-identical.
      ...(opts.reasoning ? {
        reasoning: opts.reasoning === 'off' ? { enabled: false }
          : opts.reasoning === 'low' ? { effort: 'low' }
          : opts.reasoning,
      } : {}),
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
    const content = json?.choices?.[0]?.message?.content ?? null;
    // Only on the EMPTY-answer case, not every call: these run per dish (enrich
    // + score), so a line each would add ~12 per scan and drown the one-line
    // stream summary. An HTTP 200 carrying no content is the interesting one —
    // it is indistinguishable from a model failure until you know who served it.
    if (content === null) {
      console.error(`OpenRouter empty content provider=${json?.provider ?? 'unknown'} model=${MODEL}`);
    }
    return content;
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

  // TWO timeout shapes, because a stream has two distinct failure modes and a
  // single flat 50s cap served both badly (measured 2026-07-29, Japanese menu:
  // the provider streamed 14 items then STALLED, and the flat cap let the dead
  // connection sit until the full 50s before giving up — the whole downstream
  // pipeline waited on it):
  //  - IDLE: no chunk for 15s after streaming has started = the stream is dead;
  //    kill it NOW and salvage what already arrived. The first chunk gets a
  //    more generous 25s (image upload + vision prefill legitimately run long
  //    before any token appears).
  //  - OVERALL: 50s hard ceiling regardless of progress, unchanged — the route
  //    budget (maxDuration 60) still needs post-stream work to fit.
  const ctrl = new AbortController();
  const overallTimer = setTimeout(() => ctrl.abort(new DOMException('stream overall timeout', 'TimeoutError')), 50_000);
  let idleTimer = setTimeout(() => ctrl.abort(new DOMException('stream idle timeout', 'TimeoutError')), 25_000);
  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ctrl.abort(new DOMException('stream idle timeout', 'TimeoutError')), 15_000);
  };
  const clearTimers = () => { clearTimeout(overallTimer); clearTimeout(idleTimer); };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      signal: ctrl.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://dishi.app',
        'X-Title': 'Dishi',
      },
      body: JSON.stringify({
        model: requireModel(),
        provider: PROVIDER_ROUTING,
        max_tokens: opts.maxTokens ?? 1000,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch (e) {
    clearTimers();
    console.error('OpenRouter stream call failed/timed out', e);
    return;
  }

  if (!res.ok || !res.body) {
    clearTimers();
    console.error('OpenRouter stream error', res.status, await res.text().catch(() => ''));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let accumulated = '';
  // WHO answered. Every chunk carries it; we read it off the first one that
  // does. Without this, a provider is only ever identifiable when its name
  // happens to leak into an error string — which is exactly how the 2026-07-31
  // diagnosis went: Alibaba was named in a 400 body, while the stall that
  // actually broke the scan had no attribution at all and still doesn't.
  // A provider-health question you cannot answer from the logs is a question you
  // end up answering by guessing.
  let provider: string | null = null;
  const startedAt = Date.now();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      armIdle();
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
          if (!provider && typeof chunk?.provider === 'string') provider = chunk.provider;
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
    // One line per scan, on the happy path too: comparing a fast scan's provider
    // against a slow one's is the whole point, and only logging failures would
    // leave the "who serves the GOOD scans" half of that unanswerable.
    console.log(`openrouter-stream provider=${provider ?? 'unknown'} model=${MODEL} ms=${Date.now() - startedAt} chars=${accumulated.length}`);
  } catch (e) {
    console.error(`OpenRouter stream read failed mid-stream provider=${provider ?? 'unknown'} ms=${Date.now() - startedAt}`, e);
    // Fall through: whatever was already yielded stays valid. The caller's
    // partial-JSON parser will have already surfaced any complete items found
    // before this failure — a mid-stream drop degrades to "fewer dishes," not
    // "nothing," matching the existing truncation-handling philosophy.
  } finally {
    clearTimers();
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
