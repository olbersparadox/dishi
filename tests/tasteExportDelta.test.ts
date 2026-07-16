import { describe, it, expect } from 'vitest';
import { computeExportDelta, EXPORT_DELTA_THRESHOLD } from '../src/lib/tasteExport';

const DIMS = ['umami', 'sweet', 'sour', 'tender', 'fresh'] as const;

describe('computeExportDelta', () => {
  it('no prior snapshot -> no delta, not an error', () => {
    expect(computeExportDelta({ umami: 0.8 }, null, DIMS)).toEqual([]);
  });

  it('identical vectors -> no delta', () => {
    const v = { umami: 0.6, sweet: -0.2 };
    expect(computeExportDelta(v, { ...v }, DIMS)).toEqual([]);
  });

  it('a move at exactly the threshold counts; just under does not', () => {
    const prior = { umami: 0.5 };
    const atThreshold = { umami: 0.5 + EXPORT_DELTA_THRESHOLD };
    const underThreshold = { umami: 0.5 + EXPORT_DELTA_THRESHOLD - 0.01 };
    expect(computeExportDelta(atThreshold, prior, DIMS)).toEqual([{ dim: 'umami', dir: 1 }]);
    expect(computeExportDelta(underThreshold, prior, DIMS)).toEqual([]);
  });

  it('direction sign is correct both ways', () => {
    expect(computeExportDelta({ sweet: 0.6 }, { sweet: 0.0 }, DIMS)).toEqual([{ dim: 'sweet', dir: 1 }]);
    expect(computeExportDelta({ sweet: -0.6 }, { sweet: 0.0 }, DIMS)).toEqual([{ dim: 'sweet', dir: -1 }]);
  });

  it('missing dims in either vector treated as 0, not skipped or crashing', () => {
    expect(computeExportDelta({ umami: 0.5 }, {}, DIMS)).toEqual([{ dim: 'umami', dir: 1 }]);
  });

  it('sorted by magnitude, largest move first', () => {
    const prior = { umami: 0, sweet: 0, sour: 0 };
    const now = { umami: 0.2, sweet: 0.8, sour: 0.3 };
    const delta = computeExportDelta(now, prior, DIMS);
    expect(delta.map(d => d.dim)).toEqual(['sweet', 'sour', 'umami']);
  });

  it('capped at 4 even when more dims moved', () => {
    const many = ['umami', 'sweet', 'sour', 'tender', 'fresh'] as const;
    const prior = Object.fromEntries(many.map(d => [d, 0]));
    const now = Object.fromEntries(many.map((d, i) => [d, 0.3 + i * 0.05]));
    expect(computeExportDelta(now, prior, many)).toHaveLength(4);
  });

  it('respects a custom threshold', () => {
    const prior = { umami: 0 };
    const now = { umami: 0.05 };
    expect(computeExportDelta(now, prior, DIMS, 0.2)).toEqual([]);
    expect(computeExportDelta(now, prior, DIMS, 0.01)).toEqual([{ dim: 'umami', dir: 1 }]);
  });
});
