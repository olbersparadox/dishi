import { describe, it, expect } from 'vitest';
import { DIMS } from '../src/lib/taste';
import {
  dimState, sampleForm, blobSnapshotPath, fogExtent, stateCounts, growth, dimAngle,
} from '../src/lib/blobForm';

const zeroVector = () => Object.fromEntries(DIMS.map(d => [d, 0]));

function inputs(over: Partial<Parameters<typeof sampleForm>[0]> = {}) {
  return { vector: zeroVector(), evidence: {}, ratingCount: 10, seed: 'user:v1', ...over };
}

describe('dimState thresholds match /api/buddy', () => {
  it('>=3 knows, 1-2 learning, 0/undefined fog', () => {
    expect(dimState(3)).toBe('knows');
    expect(dimState(17)).toBe('knows');
    expect(dimState(2)).toBe('learning');
    expect(dimState(1)).toBe('learning');
    expect(dimState(0)).toBe('fog');
    expect(dimState(undefined)).toBe('fog');
  });
});

describe('determinism (identity stability)', () => {
  it('same inputs produce the exact same path', () => {
    const a = blobSnapshotPath(inputs({ vector: { ...zeroVector(), umami: 0.6 }, evidence: { umami: 5 } }), 200);
    const b = blobSnapshotPath(inputs({ vector: { ...zeroVector(), umami: 0.6 }, evidence: { umami: 5 } }), 200);
    expect(a).toBe(b);
  });
  it('different seeds produce different forms for the same profile', () => {
    const v = { ...zeroVector(), umami: 0.6 };
    const a = blobSnapshotPath(inputs({ vector: v, evidence: { umami: 5 }, seed: 'user:v1' }), 200);
    const b = blobSnapshotPath(inputs({ vector: v, evidence: { umami: 5 }, seed: 'user:v2' }), 200);
    expect(a).not.toBe(b);
  });
});

describe('honesty contract', () => {
  const angleIndexFor = (dim: string, points: number) => {
    const d = DIMS.indexOf(dim as (typeof DIMS)[number]);
    const theta = dimAngle(d) + Math.PI / 2; // sampleForm home angle
    return Math.round(((theta % (Math.PI * 2)) / (Math.PI * 2)) * points) % points;
  };

  it('a fog dim contributes nothing even with a nonzero vector value', () => {
    const withPref = sampleForm(inputs({ vector: { ...zeroVector(), spicy: 0.9 }, evidence: {} }));
    const without = sampleForm(inputs({ vector: zeroVector(), evidence: {} }));
    expect(withPref.radii).toEqual(without.radii);
  });

  it('a known loved dim pushes its region outward; a disliked one carves inward, softened', () => {
    const pts = 96;
    const love = sampleForm(inputs({ vector: { ...zeroVector(), umami: 0.8 }, evidence: { umami: 5 } }), pts);
    const hate = sampleForm(inputs({ vector: { ...zeroVector(), umami: -0.8 }, evidence: { umami: 5 } }), pts);
    const flat = sampleForm(inputs(), pts);
    const i = angleIndexFor('umami', pts);
    expect(love.radii[i]).toBeGreaterThan(flat.radii[i]);
    expect(hate.radii[i]).toBeLessThan(flat.radii[i]);
    const out = love.radii[i] - flat.radii[i];
    const dent = flat.radii[i] - hate.radii[i];
    expect(dent).toBeLessThan(out); // DENT_SOFTEN
    expect(dent).toBeGreaterThan(out * 0.3);
  });

  it('a learning dim contributes, but far less than a known dim', () => {
    const pts = 96;
    const known = sampleForm(inputs({ vector: { ...zeroVector(), tender: 0.8 }, evidence: { tender: 5 } }), pts);
    const learning = sampleForm(inputs({ vector: { ...zeroVector(), tender: 0.8 }, evidence: { tender: 2 } }), pts);
    const flat = sampleForm(inputs(), pts);
    const i = angleIndexFor('tender', pts);
    const kBump = known.radii[i] - flat.radii[i];
    const lBump = learning.radii[i] - flat.radii[i];
    expect(lBump).toBeGreaterThan(0);
    expect(lBump).toBeLessThan(kBump * 0.5);
  });

  it('radius never collapses to zero or below', () => {
    const evidence = Object.fromEntries(DIMS.map(d => [d, 9]));
    const vector = Object.fromEntries(DIMS.map(d => [d, -1]));
    const s = sampleForm(inputs({ vector, evidence }));
    for (const r of s.radii) expect(r).toBeGreaterThan(0);
  });
});

describe('growth and fog', () => {
  it('growth rises with ratings and saturates below 1', () => {
    expect(growth(0)).toBeCloseTo(0.55, 2);
    expect(growth(17)).toBeGreaterThan(growth(5));
    expect(growth(300)).toBeLessThanOrEqual(1);
  });
  it('fogExtent: empty profile fully fogged, fully-known profile clear', () => {
    expect(fogExtent({})).toBe(1);
    expect(fogExtent(Object.fromEntries(DIMS.map(d => [d, 5])))).toBe(0);
  });
  it('stateCounts matches Jerry-shaped real data', () => {
    const evidence = { raw: 7, rich: 16, sour: 2, baked: 1, chewy: 13, fresh: 16, fried: 2, salty: 15, spicy: 2, sweet: 8, umami: 16, creamy: 7, crispy: 3, tender: 17, braised: 2, steamed: 8 };
    const c = stateCounts(evidence);
    expect(c).toEqual({ knows: 11, learning: 5, fog: 2 });
  });
});

describe('svg path output', () => {
  it('is a closed cubic path with finite coordinates', () => {
    const d = blobSnapshotPath(inputs({ ratingCount: 17 }), 240);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toContain(' C ');
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});
