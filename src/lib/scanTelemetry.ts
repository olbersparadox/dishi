// Scan latency instrumentation — ONE structured log line per scan.
//
// WHY THIS EXISTS (2026-07-29): the menu scan had been repaired for latency
// several times (the seafood-tripwire retry storm on 2026-07-24, the
// stage-pipelining/stall fix on 2026-07-29) and kept regressing — same
// symptom, same trigger (a Japanese menu), a DIFFERENT root cause each time.
// The reason it kept coming back is that each fix removed whichever landmine
// was currently dominant, which simply promoted the next one; and with no
// measurement anywhere in stages 2/3, the only regression detector was the
// owner running a scan and being annoyed. You cannot hold a performance
// property you do not measure — this module is the measurement.
//
// It lives CLIENT-side by necessity: stages 2 and 3 are per-dish calls
// orchestrated by the browser, so "when were the chips actually complete" —
// the user-facing number — is only knowable there. The client collects, then
// POSTs one summary to /api/scan-telemetry, which formats and logs it.
//
// Everything here is pure and side-effect free so it can be unit-tested;
// the recorder holds numbers only, never a network call.

/**
 * Budgets per user-visible milestone. TWO deliberate properties, both learned
 * from the first real line this instrument ever produced (2026-07-29, a
 * 30-item Japanese menu):
 *
 * 1. They SCALE WITH ITEM COUNT. A flat budget fails every large menu and
 *    passes every small one, so it stops carrying information and everyone
 *    learns to ignore the field. Only `first_name` is flat — it is upload +
 *    vision prefill, which does not depend on how many dishes exist.
 *
 * 2. They are charged against the PREVIOUS milestone, not scan start. That
 *    first line read BUDGET_MISS=first_name,names_done,chips_done,recs_done —
 *    all four — when in truth only stage 1 was slow (33s) and stages 2/3 were
 *    excellent (every chip resolved 5s after the last name, zero failures).
 *    Absolute budgets cascade: one slow stage marks every stage behind it, and
 *    a report that blames everything names nothing. An increment budget makes
 *    the miss list say which stage is actually at fault.
 *
 * The marks in the log line stay ABSOLUTE — those are the truth about how long
 * the person waited. Only the pass/fail verdict is per-stage.
 */
export function scanBudgetMs(items: number): Record<StageKey, number> {
  const n = Math.max(1, items);
  return {
    /** Upload + vision prefill, before any dish can paint. Flat. */
    first_name: 3_000,
    /** Streaming the remaining names, charged from first_name. */
    names_done: 5_000 + 600 * n,
    /** Stage 2's TAIL past the stream — it runs concurrently with stage 1, so
     *  most of the work is already done when the last name lands. */
    chips_done: 8_000 + 200 * n,
    /** Stage 3's tail, same shape; scoring settles the ranked view. */
    recs_done: 10_000 + 250 * n,
  };
}

export type StageKey = 'first_name' | 'names_done' | 'chips_done' | 'recs_done';
const STAGE_ORDER: StageKey[] = ['first_name', 'names_done', 'chips_done', 'recs_done'];

/** What each milestone's budget is charged against. chips_done and recs_done
 * both hang off names_done rather than off each other: they are independent
 * stages racing in parallel, so neither should inherit the other's delay. */
const CHARGED_AGAINST: Record<StageKey, StageKey | null> = {
  first_name: null, // scan start
  names_done: 'first_name',
  chips_done: 'names_done',
  recs_done: 'names_done',
};

/**
 * Nearest-rank percentile (no interpolation) over a small sample.
 *
 * Deliberately the simple definition: a scan carries ~10-30 per-dish calls, so
 * p95 is effectively "the worst one or two" — which is exactly the number worth
 * watching, since a single 12s straggler is what holds the settle back. Returns
 * null for an empty sample rather than 0, so "no calls made" can never be
 * misread as "instant".
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export type CallStat = {
  p50: number | null;
  p95: number | null;
  max: number | null;
  /** Calls that returned a usable result. */
  ok: number;
  /** Calls that threw or returned !ok — a dish that silently lost its chips. */
  failed: number;
};

/**
 * Durations of EVERY attempt (successes and failures alike) feed the
 * percentiles, because a call that burned its 12s budget and then failed cost
 * the user those 12 seconds just as surely as a slow success did. `failed` is
 * reported separately so the two questions — "how slow" and "how broken" —
 * stay independently answerable.
 */
export function callStats(durations: number[], ok: number, failed: number): CallStat {
  return {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    max: percentile(durations, 100),
    ok,
    failed,
  };
}

export type ScanMarks = Partial<Record<StageKey, number>>;

export type ScanSummary = {
  /** The MENU's language (japanese/cantonese/...), not the UI language — this
   * is the dimension the regressions have consistently correlated with. */
  lang: string;
  items: number;
  /** A 加掃一版 second page, whose latency profile is its own. */
  append: boolean;
  marks: ScanMarks;
  enrich: CallStat;
  score: CallStat;
  /** Set when the scan threw instead of completing — a died scan is data too. */
  error?: string;
};

/** Which milestones blew their own budget — each charged against the previous
 * one (see CHARGED_AGAINST), so a slow stage marks only ITSELF, not everything
 * downstream of it.
 *
 * Unreached milestones are NOT misses: a mock scan or an under-threshold user
 * legitimately never scores anything, and inventing a violation there would
 * train everyone to ignore the field. A milestone whose baseline is missing is
 * skipped for the same reason — there is nothing honest to charge it against. */
export function budgetMisses(marks: ScanMarks, items: number): StageKey[] {
  const budget = scanBudgetMs(items);
  return STAGE_ORDER.filter(k => {
    const v = marks[k];
    if (typeof v !== 'number') return false;
    const base = CHARGED_AGAINST[k];
    if (base === null) return v > budget[k];
    const from = marks[base];
    if (typeof from !== 'number') return false;
    return v - from > budget[k];
  });
}

const num = (v: number | null | undefined) => (typeof v === 'number' ? String(Math.round(v)) : '-');

/** The one glanceable line. Greppable by prefix, dimensioned by lang/items,
 * and ending in the verdict — so a scan's health is readable without parsing. */
export function formatScanSummary(s: ScanSummary): string {
  const misses = budgetMisses(s.marks, s.items);
  const stat = (c: CallStat) => `p50:${num(c.p50)}/p95:${num(c.p95)}/max:${num(c.max)}/fail:${c.failed}of${c.ok + c.failed}`;
  return [
    'scan-telemetry',
    `lang=${s.lang}`,
    `items=${s.items}`,
    `append=${s.append}`,
    `first_name=${num(s.marks.first_name)}`,
    `names_done=${num(s.marks.names_done)}`,
    `chips_done=${num(s.marks.chips_done)}`,
    `recs_done=${num(s.marks.recs_done)}`,
    `enrich=${stat(s.enrich)}`,
    `score=${stat(s.score)}`,
    s.error ? `error=${s.error}` : null,
    misses.length ? `BUDGET_MISS=${misses.join(',')}` : 'budget=ok',
  ].filter(Boolean).join(' ');
}

/**
 * The client-side collector. Holds numbers and nothing else — the caller owns
 * when (and whether) to ship the summary, so telemetry can never be the reason
 * a scan fails.
 */
export function createScanTelemetry(now: () => number = Date.now) {
  const started = now();
  const marks: ScanMarks = {};
  const enrich = { durations: [] as number[], ok: 0, failed: 0 };
  const score = { durations: [] as number[], ok: 0, failed: 0 };

  const record = (bucket: typeof enrich, ms: number, ok: boolean) => {
    bucket.durations.push(ms);
    if (ok) bucket.ok++; else bucket.failed++;
  };

  return {
    /** Elapsed-since-start, for timing an individual call. */
    since: (t: number) => now() - t,
    now,
    /** LAST write wins — for milestones that complete when their final piece
     * lands (chips_done/recs_done are re-marked on every result, so the last
     * one to arrive is the one recorded). */
    mark(key: StageKey) { marks[key] = now() - started; },
    /** FIRST write wins — for milestones that happen once (first_name). */
    markOnce(key: StageKey) { if (marks[key] === undefined) marks[key] = now() - started; },
    recordEnrich(ms: number, ok: boolean) { record(enrich, ms, ok); },
    recordScore(ms: number, ok: boolean) { record(score, ms, ok); },
    summary(meta: { lang: string; items: number; append: boolean; error?: string }): ScanSummary {
      return {
        lang: meta.lang,
        items: meta.items,
        append: meta.append,
        marks: { ...marks },
        enrich: callStats(enrich.durations, enrich.ok, enrich.failed),
        score: callStats(score.durations, score.ok, score.failed),
        ...(meta.error ? { error: meta.error } : {}),
      };
    },
  };
}

export type ScanTelemetry = ReturnType<typeof createScanTelemetry>;

// ── server-side intake hardening ────────────────────────────────────────────
// The payload is user-controlled and goes STRAIGHT INTO A LOG LINE, so it is
// sanitized rather than trusted: a newline in `lang` would otherwise let a
// client forge additional log entries, and an absurd duration would poison the
// numbers this whole module exists to make trustworthy.

const clampMs = (v: unknown): number | undefined => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  if (Number.isNaN(n)) return undefined;
  return Math.min(600_000, Math.max(0, Math.round(n)));
};

const clampCount = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(1_000, Math.max(0, Math.round(n)));
};

/** Strip anything that isn't a plain token — kills newlines (log forging),
 * spaces (field splitting), and unbounded length in one pass. */
const cleanToken = (v: unknown): string => {
  const s = typeof v === 'string' ? v : '';
  const out = s.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 32);
  return out || 'unknown';
};

function sanitizeStat(raw: any): CallStat {
  return {
    p50: clampMs(raw?.p50) ?? null,
    p95: clampMs(raw?.p95) ?? null,
    max: clampMs(raw?.max) ?? null,
    ok: clampCount(raw?.ok),
    failed: clampCount(raw?.failed),
  };
}

/** Coerce an untrusted request body into a ScanSummary safe to log. */
export function sanitizeScanSummary(raw: any): ScanSummary {
  const marks: ScanMarks = {};
  for (const k of STAGE_ORDER) {
    const v = clampMs(raw?.marks?.[k]);
    if (v !== undefined) marks[k] = v;
  }
  return {
    lang: cleanToken(raw?.lang),
    items: clampCount(raw?.items),
    append: raw?.append === true,
    marks,
    enrich: sanitizeStat(raw?.enrich),
    score: sanitizeStat(raw?.score),
    ...(raw?.error ? { error: cleanToken(raw.error) } : {}),
  };
}
