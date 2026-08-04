// The creature's pure logic: the anatomy gate (fail closed to the blob) and
// temperament (姿/性 read from dims the engine already learns). The drawing
// itself is canvas-only and is verified visually on /dev-creature — but the
// gates are where honesty lives, and honesty is testable.
import { describe, it, expect } from 'vitest';
import { hasAnatomy, temperOf, hairWindBend } from '../src/lib/creatureForm';
import type { FormInputs } from '../src/lib/blobForm';

const inputs = (vector: Record<string, number>, evidence: Record<string, number>): FormInputs =>
  ({ vector, evidence, ratingCount: 30, seed: 't:v1' });

describe('hasAnatomy — the blob-fallback gate', () => {
  it('no record and empty record both fail closed to the blob', () => {
    expect(hasAnatomy(undefined)).toBe(false);
    expect(hasAnatomy({})).toBe(false);
  });

  it('all-zero evidence is NOT anatomy — zero events must render today\'s blob', () => {
    expect(hasAnatomy({ sea: 0, land: 0, shell: 0 })).toBe(false);
  });

  it('any lived domain opens the creature door', () => {
    expect(hasAnatomy({ shell: 1 })).toBe(true);
    expect(hasAnatomy({ fungus: 0.5 })).toBe(true);
  });

  it('a sub-mix alone (no domain events) is not anatomy — sub-nodes cannot outrank their parent', () => {
    expect(hasAnatomy({ sub: { shell: { crab: 9 } } })).toBe(false);
  });
});

describe('temperOf — 姿 read only from dims the engine knows', () => {
  it('fog dims contribute nothing: a spicy pref with zero evidence is silent', () => {
    const t = temperOf(inputs({ spicy: 0.9 }, {}));
    expect(t.energy).toBe(0);
  });

  it('fried+spicy known → energy; steamed+fresh known → calm', () => {
    const hot = temperOf(inputs({ spicy: 0.8, fried: 0.7 }, { spicy: 5, fried: 5 }));
    expect(hot.energy).toBeGreaterThan(0.5);
    expect(hot.calm).toBe(0);
    const cool = temperOf(inputs({ steamed: 0.8, fresh: 0.7 }, { steamed: 5, fresh: 5 }));
    expect(cool.calm).toBeGreaterThan(0.5);
    expect(cool.energy).toBe(0);
  });

  it('sharp is energy opposed by calm — a hot-and-cool palate is not jagged', () => {
    const mixed = temperOf(inputs(
      { spicy: 0.6, fried: 0.5, steamed: 0.6, fresh: 0.6 },
      { spicy: 5, fried: 5, steamed: 5, fresh: 5 },
    ));
    expect(mixed.sharp).toBeLessThan(temperOf(inputs(
      { spicy: 0.6, fried: 0.5 }, { spicy: 5, fried: 5 },
    )).sharp);
  });

  it('sanity: an empty palate is fully calm-less and energy-less, not NaN', () => {
    const t = temperOf(inputs({}, {}));
    expect(Number.isFinite(t.energy)).toBe(true);
    expect(t.energy + t.calm + t.weight + t.bounce).toBe(0);
  });

  it('method shares normalize: only positive, known method prefs count', () => {
    const t = temperOf(inputs(
      { fried: 0.6, steamed: 0.6, baked: -0.9, grilled: 0.4 },
      { fried: 5, steamed: 5, baked: 5 }, // grilled unknown → excluded
    ));
    expect(t.m.fried).toBeCloseTo(0.5, 5);
    expect(t.m.steamed).toBeCloseTo(0.5, 5);
    expect(t.m.baked).toBe(0);
    expect(t.m.grilled).toBe(0);
  });
});

// The coat's motion. Tested here rather than by sampling the live canvas
// because requestAnimationFrame is paused whenever the preview pane is hidden —
// a pixel probe then reports a perfectly still creature whether or not the
// animation works, which is exactly the kind of false green worth avoiding.
describe('hairWindBend — wind moves each hair, not the whole creature', () => {
  const R = 40;
  const HAIRS = [ // outward unit directions around the body
    { nx: 1, ny: 0, x: R }, { nx: 0, ny: 1, x: 0 },
    { nx: -1, ny: 0, x: -R }, { nx: 0, ny: -1, x: 0 },
    { nx: 0.707, ny: 0.707, x: R * 0.707 }, { nx: -0.707, ny: 0.707, x: -R * 0.707 },
  ];
  const at = (t: number) => HAIRS.map(h => hairWindBend(h.nx, h.ny, h.x, R, t));

  it('moves over time — a still coat is the bug this replaced', () => {
    const track = [0, 400, 900, 1400, 2000, 2700, 3400].map(t => hairWindBend(0, 1, 0, R, t));
    expect(Math.max(...track) - Math.min(...track)).toBeGreaterThan(0.1);
  });

  it('is DIFFERENTIAL: at one instant, hairs bend by different amounts', () => {
    // the whole point — a shared value would move the coat as one rigid mass
    for (const t of [700, 1500, 2600, 5200]) {
      const b = at(t);
      expect(Math.max(...b) - Math.min(...b)).toBeGreaterThan(0.15);
    }
  });

  it('bends hairs in BOTH directions at once (left and right), never all one way', () => {
    const b = at(1500);
    expect(b.some(v => v > 0.02)).toBe(true);
    expect(b.some(v => v < -0.02)).toBe(true);
  });

  it('a hair facing the wind bends less than a broadside one', () => {
    // wind ≈ (g, .3g): the (1,0) hair lies nearly along it, (0,1) across it
    const t = 1200;
    expect(Math.abs(hairWindBend(0, 1, 0, R, t)))
      .toBeGreaterThan(Math.abs(hairWindBend(1, 0, 0, R, t)));
  });

  it('the gust TRAVELS: same hair, different flank, different phase', () => {
    const t = 1800;
    expect(Math.abs(hairWindBend(0, 1, R, R, t) - hairWindBend(0, 1, -R, R, t)))
      .toBeGreaterThan(0.05);
  });

  it('stays subtle — never swings a hair far enough to read as a limb', () => {
    let worst = 0;
    for (let t = 0; t < 30000; t += 50) {
      for (const h of HAIRS) worst = Math.max(worst, Math.abs(hairWindBend(h.nx, h.ny, h.x, R, t)));
    }
    expect(worst).toBeLessThan(0.42); // ≈24°, and only for hairs fully broadside
  });
});
