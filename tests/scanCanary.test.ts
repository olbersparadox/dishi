import { describe, it, expect } from 'vitest';
import { canaryVerdict, PROBE_BUDGET_MS } from '../src/lib/scanCanary';
import { scanBudgetMs } from '../src/lib/scanTelemetry';

/** A healthy run on the 18-item fixture, used as the mutation base. */
const HEALTHY = {
  items: 18,
  first_item_ms: 2_500,
  names_done_ms: 16_000,
  enrich_probe_ms: 3_400,
  score_probe_ms: 2_800,
};

describe('canaryVerdict', () => {
  it('a healthy run: canary=ok, no breaches, one greppable line', () => {
    const v = canaryVerdict(HEALTHY);
    expect(v.healthy).toBe(true);
    expect(v.breaches).toEqual([]);
    expect(v.line.startsWith('scan-canary ')).toBe(true);
    expect(v.line).toContain('canary=ok');
    expect(v.line.split('\n')).toHaveLength(1);
  });

  it('zero items is broken, never an empty menu — the fixture prints 18 dishes', () => {
    const v = canaryVerdict({ ...HEALTHY, items: 0, first_item_ms: null });
    expect(v.healthy).toBe(false);
    expect(v.breaches).toContain('no_items');
    expect(v.breaches).toContain('first_name'); // no first item ever arrived
    expect(v.line).toContain('CANARY_BREACH=');
    expect(v.line).toContain('first_item=-'); // null prints as '-', never 0
  });

  it('uses the SAME item-scaled budgets as live telemetry — one truth, not two', () => {
    // Just past the streaming allowance for 18 items → names_done breaches.
    const budget = scanBudgetMs(18);
    const over = canaryVerdict({
      ...HEALTHY,
      names_done_ms: HEALTHY.first_item_ms! + budget.names_done + 1,
    });
    expect(over.breaches).toEqual(['names_done']);
    // Exactly on budget passes.
    const on = canaryVerdict({
      ...HEALTHY,
      names_done_ms: HEALTHY.first_item_ms! + budget.names_done,
    });
    expect(on.healthy).toBe(true);
  });

  it('charges streaming from the first item, so slow prefill does not double-count', () => {
    // Prefill blows first_name, but streaming after it is fast: only
    // first_name should breach, exactly like budgetMisses' increment logic.
    const v = canaryVerdict({ ...HEALTHY, first_item_ms: 9_000, names_done_ms: 15_000 });
    expect(v.breaches).toEqual(['first_name']);
  });

  it('a failed probe (null) breaches — silent stage death is the whole point', () => {
    const v = canaryVerdict({ ...HEALTHY, enrich_probe_ms: null });
    expect(v.breaches).toEqual(['enrich_probe']);
    expect(v.line).toContain('enrich_probe=-');
  });

  it('a probe past its ceiling breaches even though it "succeeded"', () => {
    const v = canaryVerdict({ ...HEALTHY, score_probe_ms: PROBE_BUDGET_MS + 1 });
    expect(v.breaches).toEqual(['score_probe']);
  });

  it('multiple failures all get named — a report that blames one thing at random is useless', () => {
    const v = canaryVerdict({
      items: 0, first_item_ms: null, names_done_ms: 50_000,
      enrich_probe_ms: null, score_probe_ms: null,
    });
    expect(v.breaches).toEqual(['no_items', 'first_name', 'enrich_probe', 'score_probe']);
  });
});
