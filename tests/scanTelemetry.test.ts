import { describe, it, expect } from 'vitest';
import {
  SCAN_BUDGET_MS, percentile, callStats, budgetMisses,
  formatScanSummary, createScanTelemetry, sanitizeScanSummary,
  type ScanSummary,
} from '../src/lib/scanTelemetry';

const EMPTY_STAT = { p50: null, p95: null, max: null, ok: 0, failed: 0 };

describe('percentile', () => {
  it('returns null for an empty sample — never 0, which would read as "instant"', () => {
    expect(percentile([], 50)).toBeNull();
  });

  it('uses nearest-rank (no interpolation)', () => {
    const v = [10, 20, 30, 40];
    expect(percentile(v, 50)).toBe(20); // ceil(0.5*4)=2 -> 2nd smallest
    expect(percentile(v, 100)).toBe(40);
  });

  it('p95 on a small sample surfaces the straggler that holds the settle back', () => {
    const v = [100, 120, 110, 130, 12_000]; // one 12s timeout among fast calls
    expect(percentile(v, 95)).toBe(12_000);
    expect(percentile(v, 50)).toBe(120);
  });

  it('does not mutate the caller’s array', () => {
    const v = [3, 1, 2];
    percentile(v, 50);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe('callStats', () => {
  it('counts failures separately but keeps their duration in the percentiles', () => {
    // Two fast successes and one call that burned 12s before failing: the
    // person waited 12s either way, so it must show up in max.
    const s = callStats([200, 250, 12_000], 2, 1);
    expect(s.failed).toBe(1);
    expect(s.ok).toBe(2);
    expect(s.max).toBe(12_000);
  });

  it('reports nulls, not zeros, when no calls were made at all', () => {
    expect(callStats([], 0, 0)).toEqual(EMPTY_STAT);
  });
});

describe('budgetMisses', () => {
  it('flags only milestones that were reached AND blew their budget', () => {
    expect(budgetMisses({
      first_name: 900,
      names_done: 4_000,
      chips_done: SCAN_BUDGET_MS.chips_done + 1,
    })).toEqual(['chips_done']);
  });

  it('an unreached milestone is not a miss (mock / under-threshold scans)', () => {
    // No scoring happened, so recs_done was never marked — inventing a
    // violation there would train everyone to ignore the field.
    expect(budgetMisses({ first_name: 500, names_done: 2_000, chips_done: 5_000 })).toEqual([]);
  });

  it('exactly on budget is not a miss', () => {
    expect(budgetMisses({ first_name: SCAN_BUDGET_MS.first_name })).toEqual([]);
  });

  it('returns misses in pipeline order, not discovery order', () => {
    expect(budgetMisses({
      recs_done: 99_000, first_name: 99_000, chips_done: 99_000, names_done: 99_000,
    })).toEqual(['first_name', 'names_done', 'chips_done', 'recs_done']);
  });
});

describe('formatScanSummary', () => {
  const base: ScanSummary = {
    lang: 'japanese', items: 14, append: false,
    marks: { first_name: 2_100, names_done: 8_300, chips_done: 15_200, recs_done: 18_400 },
    enrich: { p50: 3_200, p95: 8_100, max: 9_000, ok: 14, failed: 0 },
    score: { p50: 2_800, p95: 6_200, max: 7_000, ok: 13, failed: 1 },
  };

  it('renders one greppable line carrying every dimension and milestone', () => {
    const line = formatScanSummary(base);
    expect(line.startsWith('scan-telemetry ')).toBe(true);
    expect(line).toContain('lang=japanese');
    expect(line).toContain('items=14');
    expect(line).toContain('chips_done=15200');
    expect(line).toContain('score=p50:2800/p95:6200/max:7000/fail:1of14');
    expect(line).toContain('budget=ok');
    expect(line.split('\n')).toHaveLength(1);
  });

  it('names the milestones that blew budget instead of just saying "slow"', () => {
    const line = formatScanSummary({ ...base, marks: { ...base.marks, chips_done: 47_000 } });
    expect(line).toContain('BUDGET_MISS=chips_done');
    expect(line).not.toContain('budget=ok');
  });

  it('prints "-" for milestones never reached, never 0', () => {
    const line = formatScanSummary({ ...base, marks: { first_name: 900 }, score: EMPTY_STAT });
    expect(line).toContain('recs_done=-');
    expect(line).toContain('score=p50:-/p95:-/max:-/fail:0of0');
  });

  it('carries the error marker for a scan that died', () => {
    expect(formatScanSummary({ ...base, error: 'not_menu' })).toContain('error=not_menu');
  });
});

describe('createScanTelemetry', () => {
  /** Controllable clock so elapsed values are exact, not timing-dependent. */
  function fakeClock(start = 1_000) {
    let t = start;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
  }

  it('marks elapsed-since-scan-start, not absolute time', () => {
    const c = fakeClock();
    const tele = createScanTelemetry(c.now);
    c.advance(2_500);
    tele.markOnce('first_name');
    expect(tele.summary({ lang: 'x', items: 1, append: false }).marks.first_name).toBe(2_500);
  });

  it('markOnce keeps the FIRST value — first_name can only happen once', () => {
    const c = fakeClock();
    const tele = createScanTelemetry(c.now);
    c.advance(1_000); tele.markOnce('first_name');
    c.advance(5_000); tele.markOnce('first_name');
    expect(tele.summary({ lang: 'x', items: 2, append: false }).marks.first_name).toBe(1_000);
  });

  it('mark keeps the LAST value — chips_done is when the final chip landed', () => {
    const c = fakeClock();
    const tele = createScanTelemetry(c.now);
    c.advance(1_000); tele.mark('chips_done');
    c.advance(5_000); tele.mark('chips_done'); // a straggler arrives
    expect(tele.summary({ lang: 'x', items: 2, append: false }).marks.chips_done).toBe(6_000);
  });

  it('separates enrich and score samples', () => {
    const tele = createScanTelemetry(fakeClock().now);
    tele.recordEnrich(100, true);
    tele.recordEnrich(300, false);
    tele.recordScore(50, true);
    const s = tele.summary({ lang: 'japanese', items: 2, append: true });
    expect(s.enrich).toMatchObject({ ok: 1, failed: 1, max: 300 });
    expect(s.score).toMatchObject({ ok: 1, failed: 0, max: 50 });
    expect(s.append).toBe(true);
  });

  it('since() measures one call against the shared clock', () => {
    const c = fakeClock();
    const tele = createScanTelemetry(c.now);
    const t0 = tele.now();
    c.advance(1_234);
    expect(tele.since(t0)).toBe(1_234);
  });

  it('omits `error` entirely on a healthy scan', () => {
    const tele = createScanTelemetry(fakeClock().now);
    expect(tele.summary({ lang: 'x', items: 1, append: false }).error).toBeUndefined();
  });
});

describe('sanitizeScanSummary (untrusted input → log line)', () => {
  it('strips newlines from lang so a client cannot forge extra log lines', () => {
    const s = sanitizeScanSummary({ lang: 'ja\nscan-telemetry lang=FAKE budget=ok', items: 1 });
    expect(s.lang).not.toContain('\n');
    expect(formatScanSummary(s).split('\n')).toHaveLength(1);
  });

  it('strips spaces too — a field cannot be split into forged fields', () => {
    expect(sanitizeScanSummary({ lang: 'ja items=999' }).lang).toBe('jaitems999');
  });

  it('falls back to "unknown" rather than emitting an empty field', () => {
    expect(sanitizeScanSummary({ lang: '!!!' }).lang).toBe('unknown');
    expect(sanitizeScanSummary({}).lang).toBe('unknown');
  });

  it('clamps absurd durations and counts so they cannot poison the numbers', () => {
    const s = sanitizeScanSummary({
      lang: 'ja', items: 1e9,
      marks: { first_name: -5, names_done: 1e12 },
      enrich: { p50: 1e12, ok: 1e9, failed: -3 },
    });
    expect(s.items).toBe(1_000);
    expect(s.marks.first_name).toBe(0);
    expect(s.marks.names_done).toBe(600_000);
    expect(s.enrich.p50).toBe(600_000);
    expect(s.enrich.ok).toBe(1_000);
    expect(s.enrich.failed).toBe(0);
  });

  it('drops non-numeric marks instead of logging NaN', () => {
    const s = sanitizeScanSummary({ lang: 'ja', marks: { first_name: 'soon', names_done: null } });
    expect(s.marks.first_name).toBeUndefined();
    expect(formatScanSummary(s)).toContain('first_name=-');
  });

  it('coerces append to a real boolean', () => {
    expect(sanitizeScanSummary({ append: 'yes' }).append).toBe(false);
    expect(sanitizeScanSummary({ append: true }).append).toBe(true);
  });

  it('survives a totally malformed body', () => {
    expect(() => formatScanSummary(sanitizeScanSummary(null))).not.toThrow();
    expect(() => formatScanSummary(sanitizeScanSummary('nope'))).not.toThrow();
  });
});
