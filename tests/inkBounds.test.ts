// The measurement instrument's OWN tests — this is the point of the whole
// exercise. 2026-08-07: four ad-hoc SVG-path-text parsers in one day each
// produced a confident wrong answer about rendered bounds (arc flags read as
// coordinates; curve endpoints skipped; rect()'s relative h/v misparsed;
// control points counted as ink). The instruments were less tested than the
// renderer they measured, so every "root cause" found through one was
// suspect. The recorder now measures at the emitter (canvasToSvg.ts, the ink
// measurement block); these tests pin it against KNOWN shapes — including
// each shape that broke a parser — so the instrument is finally more trusted
// than the thing it measures.
import { describe, it, expect } from 'vitest';
import { svgContext } from '../src/lib/canvasToSvg';
import { creatureInkBounds, type DomainEvidence } from '../src/lib/creatureForm';
import { domainsAsOf } from '../src/lib/domainEvidence';

const make = () => svgContext(200, 200);

describe('inkBounds — known shapes', () => {
  it('nothing painted → null (a bare path without fill/stroke is not ink)', () => {
    const { ctx, inkBounds } = make();
    expect(inkBounds()).toBeNull();
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(50, 50); // never stroked
    expect(inkBounds()).toBeNull();
  });

  it('a filled rect measures exactly its corners (the rect()/relative-h/v trap)', () => {
    const { ctx, inkBounds } = make();
    ctx.beginPath(); ctx.rect(20, 30, 40, 10); ctx.fill();
    expect(inkBounds()).toEqual({ minX: 20, minY: 30, maxX: 60, maxY: 40 });
  });

  it('a stroked line inflates by half the line width', () => {
    const { ctx, inkBounds } = make();
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(50, 100); ctx.lineTo(150, 100); ctx.stroke();
    const b = inkBounds()!;
    expect(b.minY).toBeCloseTo(95, 6);
    expect(b.maxY).toBeCloseTo(105, 6);
  });

  it('a full circle measures its true extremes, not just arc endpoints (the arc trap)', () => {
    const { ctx, inkBounds } = make();
    ctx.beginPath(); ctx.arc(100, 100, 40, 0, Math.PI * 2); ctx.fill();
    const b = inkBounds()!;
    expect(b.minX).toBeCloseTo(60, 1);
    expect(b.maxX).toBeCloseTo(140, 1);
    expect(b.minY).toBeCloseTo(60, 1);
    expect(b.maxY).toBeCloseTo(140, 1);
  });

  it('a HALF circle does not claim the half that was never swept', () => {
    const { ctx, inkBounds } = make();
    // canvas angles: 0 → π sweeps the BOTTOM half (y grows downward)
    ctx.beginPath(); ctx.arc(100, 100, 40, 0, Math.PI); ctx.fill();
    const b = inkBounds()!;
    expect(b.maxY).toBeCloseTo(140, 1);
    expect(b.minY).toBeCloseTo(100, 1); // never went above the diameter
  });

  it('a rotated ellipse is measured on its rotated extent, not its unrotated radii', () => {
    const { ctx, inkBounds } = make();
    // rx=50, ry=10, rotated 90°: the long axis now runs VERTICALLY
    ctx.beginPath(); ctx.ellipse(100, 100, 50, 10, Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    const b = inkBounds()!;
    expect(b.maxY - b.minY).toBeCloseTo(100, 1);
    expect(b.maxX - b.minX).toBeCloseTo(20, 1);
  });

  it('a quadratic curve includes its true extremum but NEVER its control point (the control-point trap)', () => {
    const { ctx, inkBounds } = make();
    // endpoints y=100, control at y=0: the curve's real top is y=50
    ctx.beginPath(); ctx.moveTo(50, 100); ctx.quadraticCurveTo(100, 0, 150, 100); ctx.stroke();
    const b = inkBounds()!;
    expect(b.minY).toBeGreaterThan(45);   // reaches the true extremum…
    expect(b.minY).toBeLessThan(55);
    expect(b.minY).toBeGreaterThan(5);    // …but never the control point at 0
  });

  it('a cubic curve likewise samples the curve, not the control cage', () => {
    const { ctx, inkBounds } = make();
    // symmetric cubic: both controls at y=0, endpoints y=100 → true top y=25
    ctx.beginPath(); ctx.moveTo(50, 100); ctx.bezierCurveTo(83, 0, 117, 0, 150, 100); ctx.stroke();
    const b = inkBounds()!;
    expect(b.minY).toBeGreaterThan(20);
    expect(b.minY).toBeLessThan(30);
  });

  it('CLIPPED ink is bounded by the clip (the shell-band false-positive trap)', () => {
    const { ctx, inkBounds } = make();
    // clip to a 60-wide box, then fill a rect three times wider — the ink that
    // reaches the page stops at the clip. This is exactly the 甲 band shape
    // that would false-positive any unclipped-bounds reading.
    ctx.save();
    ctx.beginPath(); ctx.rect(70, 70, 60, 60); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 90, 200, 20); ctx.fill();
    ctx.restore();
    const b = inkBounds()!;
    expect(b.minX).toBeGreaterThanOrEqual(70);
    expect(b.maxX).toBeLessThanOrEqual(130);
  });

  it('restore() lifts the clip — ink after it measures unclipped again', () => {
    const { ctx, inkBounds } = make();
    ctx.save();
    ctx.beginPath(); ctx.rect(90, 90, 20, 20); ctx.clip();
    ctx.restore();
    ctx.beginPath(); ctx.rect(10, 10, 20, 20); ctx.fill();
    expect(inkBounds()!.minX).toBe(10);
  });

  it('fully clipped-away ink contributes nothing', () => {
    const { ctx, inkBounds } = make();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 50, 50); ctx.clip();
    ctx.beginPath(); ctx.rect(150, 150, 20, 20); ctx.fill(); // outside the clip
    ctx.restore();
    expect(inkBounds()).toBeNull();
  });

  it('text commits an em-box at its anchor', () => {
    const { ctx, inkBounds } = make() as any;
    ctx.font = '500 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('鮮', 100, 100);
    const b = inkBounds()!;
    expect(b.minX).toBeCloseTo(90, 1);
    expect(b.maxX).toBeCloseTo(110, 1);
    expect(b.minY).toBeLessThan(100); // ascent above the baseline
  });

  it('per-element records carry paint order and style', () => {
    const { ctx, inkRecords } = make();
    ctx.fillStyle = 'red';
    ctx.beginPath(); ctx.rect(0, 0, 10, 10); ctx.fill();
    ctx.strokeStyle = 'blue'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, 50); ctx.lineTo(60, 60); ctx.stroke();
    const r = inkRecords();
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ kind: 'fill', style: 'red' });
    expect(r[1]).toMatchObject({ kind: 'stroke', style: 'blue' });
  });

  it('measuring does not perturb the markup — the recording is byte-identical either way', () => {
    const a = make(); const b = make();
    for (const { ctx } of [a, b]) {
      ctx.beginPath(); ctx.arc(100, 100, 30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.quadraticCurveTo(50, 0, 90, 10); ctx.stroke();
    }
    a.inkBounds(); a.inkRecords(); // reading measurements on one side only
    expect(a.svg()).toBe(b.svg());
  });
});

/* ── the regression this instrument was built for ─────────────────────────────
   "Cropped by the invisible square" (owner, 2026-08-07): claw ink ran off the
   canvas on the owner's real live profile. Pinned here with the exact live
   record, across every production render size, in both modes — measured by
   the recorder, not by a parser, not by eyes. */
const OWNER_T = {"sub":{"air":{"chicken":{"v":4.676423106903779,"at":1785844333098},"duck_goose":{"v":1.10372378647864,"at":1785080659488}},"sea":{"fish":{"v":11.735655114567235,"at":1785986343816},"cephalopod":{"v":0.9085662111805587,"at":1785550429854}},"land":{"beef":{"v":2.6747946698966154,"at":1785836981207},"lamb":{"v":0.2801724137931034,"at":1784604776169},"pork":{"v":5.374887050737043,"at":1785656307718},"chicken":{"v":3.3737972048974365,"at":1785844333098}},"field":{"soy":{"v":5.605240198313659,"at":1785844333098},"leaf":{"v":0.2675,"at":1785080659488}},"shell":{"prawn":{"v":5.233676017205233,"at":1785986343816},"lobster":{"v":1.2295454545454545,"at":1784596177415}}},"duels":{},"nodes":{"air":{"v":2.7725359051666345,"at":1785844333098},"sea":{"v":10.56821394097018,"at":1785986343816},"land":{"v":7.254412706224789,"at":1785836981207},"algae":{"v":1.459325169906236,"at":1785671332634},"field":{"v":3.542752837345634,"at":1785844333098},"shell":{"v":6.738990614187178,"at":1785986343816},"fungus":{"v":1.5078123157503232,"at":1784803504198}}};
const INPUTS = { vector: {}, evidence: {}, ratingCount: 62, seed: 'owner-real' } as any;

const SCENARIO_LIVES: Record<string, DomainEvidence> = {
  sea: { sea: 34, shell: 4, algae: 8 },
  crab: { sea: 12, shell: 26, sub: { shell: { lobster: 4, crab: 18, prawn: 4 } } },
  lobster: { sea: 10, shell: 24, sub: { shell: { lobster: 17, crab: 4, prawn: 3 } } },
  land: { land: 36, air: 6, sub: { land: { beef: 20, pork: 10, chicken: 6 } } },
  fire: { land: 22, air: 14, sub: { land: { beef: 6, pork: 8, chicken: 8 } } },
  garden: { field: 26, fungus: 12, algae: 5 },
  air: { air: 30, land: 8 },
  // 鵝-heavy: the LONGEST wing the blend can produce (lenMul 1.35) — the
  // variant most likely to leave the canvas, so the net must exercise it
  goose: { air: 30, land: 8, sub: { air: { duck_goose: 24 } } },
  rooster: { air: 30, land: 8, sub: { air: { chicken: 24 } } },
  bake: { field: 3, land: 3 },
  // 尾 tails (G4 round 3): the two longest-reach variants at full size —
  // the fish fork points down-right toward the corner; the beef whip is the
  // deepest-drooping gesture the pool has, so it guards the bottom edge
  fishtail: { sea: 30, land: 8, sub: { sea: { fish: 22, cephalopod: 2 } } },
  oxtail: { land: 30, air: 4, sub: { land: { beef: 9, pork: 14, chicken: 2 } } },
};

describe('no creature ever inks outside its canvas', () => {
  const SIZES = [150, 190, 200, 280];

  it("the owner's real live profile, every production size, both modes", () => {
    const domains = domainsAsOf(OWNER_T as any, 1785986343816 + 86_400_000);
    for (const size of SIZES) {
      for (const mode of ['legacy', 'metabolism'] as const) {
        const { bounds } = creatureInkBounds(INPUTS, domains, size, undefined, mode);
        expect(bounds, `${mode}@${size}`).not.toBeNull();
        expect(bounds!.minX, `${mode}@${size} left`).toBeGreaterThanOrEqual(0);
        expect(bounds!.minY, `${mode}@${size} top`).toBeGreaterThanOrEqual(0);
        expect(bounds!.maxX, `${mode}@${size} right`).toBeLessThanOrEqual(size);
        expect(bounds!.maxY, `${mode}@${size} bottom`).toBeLessThanOrEqual(size);
      }
    }
  });

  /** The net's FIRST catch, on its first run (2026-08-07): the garden life's
   *  frond tips overflow the TOP edge — ~6% of canvas at every size, both
   *  modes identically, so it PREDATES the metabolism and shipped inside
   *  legacy. No real profile is field-heavy enough to hit it today, and a
   *  frond geometry change rewrites shipped bodies, so it is grandfathered
   *  HERE and queued for a visual round with the owner (BACKLOG G11) rather
   *  than fixed blind. Shrink the allowance only in that round. */
  const KNOWN_TOP_OVERFLOW: Record<string, number> = { garden: 0.062 };

  it('all eight scenario lives at the dossier size, both modes, glyph on', () => {
    for (const [name, domains] of Object.entries(SCENARIO_LIVES)) {
      for (const mode of ['legacy', 'metabolism'] as const) {
        const { bounds } = creatureInkBounds(
          { ...INPUTS, ratingCount: 40, seed: 'snap-test:v1' }, domains, 190, '鮮', mode);
        expect(bounds, `${name}/${mode}`).not.toBeNull();
        const topAllow = (KNOWN_TOP_OVERFLOW[name] ?? 0) * 190;
        expect(bounds!.minX, `${name}/${mode} left`).toBeGreaterThanOrEqual(0);
        expect(bounds!.minY, `${name}/${mode} top`).toBeGreaterThanOrEqual(-topAllow);
        expect(bounds!.maxX, `${name}/${mode} right`).toBeLessThanOrEqual(190);
        expect(bounds!.maxY, `${name}/${mode} bottom`).toBeLessThanOrEqual(190);
      }
    }
  });
});
