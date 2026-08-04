import { describe, it, expect } from 'vitest';
import { buildMing, labelTier } from '../src/lib/logogram';
import { DIMS } from '../src/lib/taste';
import { dimAngle, KNOWS_AT } from '../src/lib/blobForm';

const SIZE = 300;
const RING = SIZE * 0.24;
const C = SIZE / 2;

function blank() {
  return {
    vector: Object.fromEntries(DIMS.map(d => [d, 0])) as Record<string, number>,
    evidence: Object.fromEntries(DIMS.map(d => [d, 0])) as Record<string, number>,
  };
}

/** Endpoints of one quadratic stroke, as radii from the figure's centre. */
function radii(d: string) {
  const m = d.match(/^M([-\d.]+),([-\d.]+)Q[-\d.]+,[-\d.]+ ([-\d.]+),([-\d.]+)$/);
  if (!m) throw new Error(`unparsable stroke: ${d}`);
  const [x0, y0, x1, y1] = m.slice(1).map(Number);
  return { start: Math.hypot(x0 - C, y0 - C), end: Math.hypot(x1 - C, y1 - C) };
}

/** Which dim seat a stroke belongs to — nearest compass angle to its origin. */
function seatOf(d: string) {
  const m = d.match(/^M([-\d.]+),([-\d.]+)/)!;
  const a = Math.atan2(Number(m[2]) - C, Number(m[1]) - C);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < DIMS.length; i++) {
    const delta = Math.abs(Math.atan2(Math.sin(a - dimAngle(i)), Math.cos(a - dimAngle(i))));
    if (delta < bestD) { bestD = delta; best = i; }
  }
  return DIMS[best];
}

describe('銘 logogram', () => {
  it('writes nothing where there is fog — an unrated dim has no ink at its seat', () => {
    const p = blank();
    p.vector.umami = 0.9;          // a strong opinion...
    p.evidence.umami = 0;          // ...that no meal ever taught
    const ming = buildMing(p.vector, p.evidence, 'seed', SIZE, RING);
    expect(ming.strokes).toHaveLength(0);
    expect(ming.specks).toHaveLength(0);
    expect(ming.blotches).toHaveLength(0);
    // The ring survives: the figure exists, it just has nothing to say.
    expect(ming.ring).toHaveLength(3);
  });

  it('stays silent on a known dim the palate is genuinely neutral about', () => {
    const p = blank();
    p.evidence.umami = 20;
    p.vector.umami = 0.01;
    expect(buildMing(p.vector, p.evidence, 'seed', SIZE, RING).strokes).toHaveLength(0);
  });

  it('fog and neutral are DISTINGUISHABLE — the gap a radar cannot express', () => {
    const fog = blank(); fog.vector.umami = 0.6; fog.evidence.umami = 0;
    const neutral = blank(); neutral.vector.umami = 0.6; neutral.evidence.umami = 8;
    const a = buildMing(fog.vector, fog.evidence, 's', SIZE, RING);
    const b = buildMing(neutral.vector, neutral.evidence, 's', SIZE, RING);
    expect(a.strokes.length).toBe(0);
    expect(b.strokes.length).toBeGreaterThan(0);
  });

  it('love reaches outward and dislike bites inward', () => {
    const love = blank(); love.vector.sweet = 0.8; love.evidence.sweet = 10;
    const hate = blank(); hate.vector.sweet = -0.8; hate.evidence.sweet = 10;
    for (const s of buildMing(love.vector, love.evidence, 's', SIZE, RING).strokes) {
      const r = radii(s.d);
      expect(r.end).toBeGreaterThan(r.start);
    }
    for (const s of buildMing(hate.vector, hate.evidence, 's', SIZE, RING).strokes) {
      const r = radii(s.d);
      expect(r.end).toBeLessThan(r.start);
    }
  });

  it('stroke count reads evidence, and caps so a heavily-fed dim stays legible', () => {
    const counts = (e: number) => {
      const p = blank(); p.vector.sweet = 0.7; p.evidence.sweet = e;
      return buildMing(p.vector, p.evidence, 's', SIZE, RING).strokes.length;
    };
    expect(counts(1)).toBe(1);                              // 仲摸緊 — one whisper
    expect(counts(KNOWS_AT)).toBeGreaterThan(counts(1));    // crossing the line shows
    expect(counts(8)).toBeGreaterThan(counts(4));
    expect(counts(20)).toBeGreaterThan(counts(8));
    // Capped, and the cap is low enough that 18 maxed seats still read as
    // writing rather than a fringe — the failure the first render showed.
    expect(counts(200)).toBe(4);
    expect(counts(200)).toBe(counts(71));   // saturates within the real range
  });

  it('dims still being learned are drawn fainter and shorter than known ones', () => {
    const mk = (e: number) => {
      const p = blank(); p.vector.sweet = 0.8; p.evidence.sweet = e;
      return buildMing(p.vector, p.evidence, 's', SIZE, RING).strokes[0];
    };
    const learning = mk(1), known = mk(KNOWS_AT + 5);
    expect(learning.opacity).toBeLessThan(known.opacity);
    expect(radii(learning.d).end - RING).toBeLessThan(radii(known.d).end - RING);
  });

  it('puts each dim’s ink at its own compass seat, shared with radar and creature', () => {
    const p = blank();
    p.vector.bitter = 0.7; p.evidence.bitter = 9;
    const ming = buildMing(p.vector, p.evidence, 's', SIZE, RING);
    expect(ming.strokes.length).toBeGreaterThan(0);
    for (const s of ming.strokes) expect(seatOf(s.d)).toBe('bitter');
  });

  it('reports an extent that actually covers its outward ink', () => {
    const p = blank();
    for (const d of DIMS) { p.vector[d] = 0.95; p.evidence[d] = 30; }
    const ming = buildMing(p.vector, p.evidence, 's', SIZE, RING);
    expect(ming.extent).toBeGreaterThan(RING);
    // Tolerance is a hair over one path-coordinate quantum: `d` is emitted at
    // 2dp while `extent` is computed exact, so a parsed radius can sit up to
    // ~0.0071 (0.005·√2) beyond it. Anything larger is a real overflow.
    const EPS = 0.01;
    for (const s of ming.strokes) expect(radii(s.d).end).toBeLessThanOrEqual(ming.extent + EPS);
    for (const sp of ming.specks) {
      expect(Math.hypot(sp.cx - C, sp.cy - C)).toBeLessThanOrEqual(ming.extent + EPS);
    }
  });

  it('curls strands BOTH ways — not one machine-set handedness', () => {
    const p = blank();
    for (const d of DIMS) { p.vector[d] = 0.6; p.evidence[d] = 20; }
    const strokes = buildMing(p.vector, p.evidence, 's', SIZE, RING).strokes;
    // Which side of its own chord each strand's control point falls on.
    const sides = strokes.map(s => {
      const m = s.d.match(/^M([-\d.]+),([-\d.]+)Q([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)$/)!;
      const [x0, y0, qx, qy, x1, y1] = m.slice(1).map(Number);
      return Math.sign((x1 - x0) * (qy - y0) - (y1 - y0) * (qx - x0));
    });
    expect(sides.filter(s => s > 0).length).toBeGreaterThan(0);
    expect(sides.filter(s => s < 0).length).toBeGreaterThan(0);
  });

  it('roots every strand ON the ring, so sway pivots without leaving the seat', () => {
    const p = blank();
    for (const d of DIMS) { p.vector[d] = 0.6; p.evidence[d] = 20; }
    for (const s of buildMing(p.vector, p.evidence, 's', SIZE, RING).strokes) {
      // The pivot the renderer rotates about must be the strand's own start,
      // and it must sit on the ring — otherwise the tip's sway drags the root
      // off its compass seat and the figure starts reading the wrong dim.
      const start = s.d.match(/^M([-\d.]+),([-\d.]+)/)!.slice(1).map(Number);
      expect(s.rootX).toBeCloseTo(start[0], 1);
      expect(s.rootY).toBeCloseTo(start[1], 1);
      // On the ring, within the ±1.5% radial jitter that keeps roots from
      // landing on a machine-perfect circle.
      expect(Math.hypot(s.rootX - C, s.rootY - C)).toBeGreaterThan(RING * 0.98);
      expect(Math.hypot(s.rootX - C, s.rootY - C)).toBeLessThan(RING * 1.02);
      expect(s.sway).toBeGreaterThan(0);
      expect(s.sway).toBeLessThan(15);  // subtle: a draught, not a whip
    }
  });

  it('phases the flow by angle around the ring, so the swell travels', () => {
    const p = blank();
    for (const d of DIMS) { p.vector[d] = 0.6; p.evidence[d] = 20; }
    const strokes = buildMing(p.vector, p.evidence, 's', SIZE, RING).strokes;
    for (const s of strokes) {
      expect(s.phase).toBeGreaterThanOrEqual(0);
      expect(s.phase).toBeLessThan(1);
    }
    // Distinct phases across the ring — if they collapsed to one value every
    // strand would blink in unison, which is the effect this exists to avoid.
    expect(new Set(strokes.map(s => s.phase.toFixed(3))).size).toBeGreaterThan(10);
    // A strand at the top seat phases near 0; one a quarter-turn on, near 0.25.
    const top = blank(); top.vector.sweet = 0.6; top.evidence.sweet = 20;
    const quarter = blank(); quarter.vector.crispy = 0.6; quarter.evidence.crispy = 20;
    const pTop = buildMing(top.vector, top.evidence, 's', SIZE, RING).strokes[0].phase;
    const pQtr = buildMing(quarter.vector, quarter.evidence, 's', SIZE, RING).strokes[0].phase;
    expect(Math.min(pTop, 1 - pTop)).toBeLessThan(0.05);
    expect(Math.abs(pQtr - 6 / 18)).toBeLessThan(0.05);   // 'crispy' is seat 6 of 18
  });

  it('is deterministic in the seed, and a different seed writes a different hand', () => {
    const p = blank();
    for (const d of DIMS) { p.vector[d] = 0.4; p.evidence[d] = 6; }
    const a = buildMing(p.vector, p.evidence, 'v3', SIZE, RING);
    const b = buildMing(p.vector, p.evidence, 'v3', SIZE, RING);
    const c = buildMing(p.vector, p.evidence, 'v4', SIZE, RING);
    expect(a).toEqual(b);
    expect(a.strokes.map(s => s.d)).not.toEqual(c.strokes.map(s => s.d));
  });

  it('an empty palate is a bare ring — no fabricated marks', () => {
    const p = blank();
    const ming = buildMing(p.vector, p.evidence, 'new', SIZE, RING);
    expect(ming.strokes).toHaveLength(0);
    expect(ming.specks).toHaveLength(0);
    expect(ming.extent).toBe(RING);
  });
});

describe('銘 label tiers', () => {
  it('never renders "no opinion" the same as "never tasted"', () => {
    // The fabrication the whole figure exists to remove. A dim tasted 49 times
    // that the palate shrugs at is a WEAKER statement than a held opinion, but
    // it is still a statement — unlike a dim no meal ever taught.
    expect(labelTier(49, 0.02, false)).toBe('quiet');
    expect(labelTier(0, 0.02, false)).toBe('fog');
    expect(labelTier(49, 0.02, false)).not.toBe(labelTier(0, 0.02, false));
  });

  it('gives a fully-learned palate three tiers, not two', () => {
    // The owner's live profile: all 18 dims learned, so an evidence-only
    // scheme collapses to a single shade plus the callouts. Five of its dims
    // sit under the opinion line and must come out lighter.
    const v: Record<string, number> = { raw: 0.702, tender: 0.627, umami: 0.626,
      braised: 0.406, steamed: 0.377, sweet: -0.392, sour: -0.378, fresh: 0.274,
      salty: 0.239, creamy: -0.224, baked: -0.224, rich: 0.199, grilled: -0.176,
      spicy: -0.108, bitter: 0.081, chewy: 0.066, crispy: 0.027, fried: 0.012 };
    const e: Record<string, number> = { raw: 13, tender: 60, umami: 61, braised: 16,
      steamed: 18, sweet: 45, sour: 9, fresh: 68, salty: 54, creamy: 40, baked: 14,
      rich: 71, grilled: 16, spicy: 6, bitter: 3, chewy: 49, crispy: 14, fried: 8 };
    const called = new Set(['raw', 'tender', 'umami']);
    const tiers = new Set(DIMS.map(d => labelTier(e[d], v[d], called.has(d))));
    expect(tiers).toEqual(new Set(['called', 'held', 'quiet']));
    expect(tiers.size).toBe(3);
    expect(tiers.has('fog')).toBe(false);   // nothing unlearned to write faint
  });

  it('a sparse palate still reads fog, and being called out wins over evidence', () => {
    expect(labelTier(0, 0.6, false)).toBe('fog');
    expect(labelTier(4, 0.44, true)).toBe('called');
    expect(labelTier(2, 0.3, false)).toBe('held');
  });
});
