// Scan canary — the verdict logic for the daily scheduled probe
// (/api/canary/scan, vercel.json cron). Pure and unit-tested; the route owns
// the clocks and the LLM calls, this module owns the judgment.
//
// WHY A CANARY (2026-07-29): the scan's two live regressions were felt by the
// owner at a restaurant before any instrument saw them, and stage-1 latency
// swings ~32% run-to-run on the SAME menu (provider variance), so a single
// human scan can't distinguish "it regressed" from "bad afternoon at the
// provider". A fixed menu scanned on a schedule gives a controlled series.
//
// The fixture (public/canary-menu.jpg) is deliberately a JAPANESE-SCRIPT menu
// — synthetic, authored in-repo — because that's the measured worst case:
// three genuinely different name renderings per dish, and the seafood-heavy
// vocabulary that historically triggered the tripwire retry storm. If the
// worst case is healthy every morning, everything easier is healthy too.
//
// Honest scope note: this watches the SERVER side (stage-1 stream + one
// enrich probe + one score probe). It cannot see client-side breakage — the
// chip-clobber bug lived entirely in React state and no server probe would
// ever have caught it; that class is pinned by tests/scanPipelining.test.tsx
// instead. The canary's job is provider/prompt/runtime drift, nothing more.
import { scanBudgetMs } from './scanTelemetry';

export type CanaryTimings = {
  /** Dishes the skeleton stream produced. The fixture prints 18; the model's
   * own cap says "at most 20" — so 0 means broken, not "empty menu". */
  items: number;
  /** ms until the FIRST item event, null if none ever arrived. */
  first_item_ms: number | null;
  /** ms until the stream fully ended (salvage pass included). */
  names_done_ms: number;
  /** ms for one enrichOneDish probe on a fixed dish; null = no usable
   * enrichment came back (empty hook). */
  enrich_probe_ms: number | null;
  /** ms for one scoreOneDish probe; null = degenerate (empty) vector. */
  score_probe_ms: number | null;
};

/** Generous per-probe ceiling. A probe is ONE dish with zero contention, so
 * even a degraded provider should land it in a fraction of this — past 20s
 * the user-facing experience is already bad enough to want the alarm. */
export const PROBE_BUDGET_MS = 20_000;

export type CanaryVerdict = {
  /** The one greppable line (prefix `scan-canary`), mirroring scan-telemetry's
   * shape so the same eyes read both. */
  line: string;
  healthy: boolean;
  breaches: string[];
};

const num = (v: number | null) => (typeof v === 'number' ? String(Math.round(v)) : '-');

export function canaryVerdict(t: CanaryTimings): CanaryVerdict {
  const budget = scanBudgetMs(t.items);
  const breaches: string[] = [];

  if (t.items === 0) breaches.push('no_items');
  if (t.first_item_ms === null || t.first_item_ms > budget.first_name) breaches.push('first_name');
  // Same increment semantics as budgetMisses: the streaming phase is charged
  // from the first item, so a slow prefill doesn't double-count here.
  if (t.first_item_ms !== null && t.names_done_ms - t.first_item_ms > budget.names_done) breaches.push('names_done');
  if (t.enrich_probe_ms === null || t.enrich_probe_ms > PROBE_BUDGET_MS) breaches.push('enrich_probe');
  if (t.score_probe_ms === null || t.score_probe_ms > PROBE_BUDGET_MS) breaches.push('score_probe');

  const healthy = breaches.length === 0;
  const line = [
    'scan-canary',
    `items=${t.items}`,
    `first_item=${num(t.first_item_ms)}`,
    `names_done=${num(t.names_done_ms)}`,
    `enrich_probe=${num(t.enrich_probe_ms)}`,
    `score_probe=${num(t.score_probe_ms)}`,
    healthy ? 'canary=ok' : `CANARY_BREACH=${breaches.join(',')}`,
  ].join(' ');
  return { line, healthy, breaches };
}
