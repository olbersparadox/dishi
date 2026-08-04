import { describe, it, expect } from 'vitest';
import { buildMing } from '../src/lib/logogram';
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
    for (const s of ming.strokes) expect(radii(s.d).end).toBeLessThanOrEqual(ming.extent + 1e-6);
    for (const sp of ming.specks) {
      expect(Math.hypot(sp.cx - C, sp.cy - C)).toBeLessThanOrEqual(ming.extent + 1e-6);
    }
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
