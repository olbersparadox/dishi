// Snapshot parity — the two-renderer contract for the creature.
//
// The guarantee under test is IDENTITY, not resemblance: the snapshot is the
// live renderer's own stroke stream, recorded by canvasToSvg at t=0. So the
// tests here assert (1) the recorder covers everything the creature draws, on
// every scenario life; (2) the output is deterministic; (3) the component
// mounts EXACTLY that recording — so a hand-drawn SVG twin fails; and (4) the
// no-domains path is byte-identical to the blob snapshot it has always been.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { creatureSnapshotSvg, hasAnatomy, type DomainEvidence } from '../src/lib/creatureForm';
import { svgContext } from '../src/lib/canvasToSvg';
import { blobSnapshotPath, type FormInputs } from '../src/lib/blobForm';
import { TasteFormSnapshot } from '../src/components/TasteForm';

const INPUTS: FormInputs = {
  vector: {
    umami: 0.8, fresh: 0.6, steamed: 0.7, rich: 0.4, tender: 0.5,
    spicy: 0.3, crispy: 0.4, fried: 0.2, sweet: -0.2, bitter: -0.3,
  },
  evidence: {
    umami: 9, fresh: 7, steamed: 8, rich: 5, tender: 6,
    spicy: 4, crispy: 5, fried: 3, sweet: 4, bitter: 3,
  },
  ratingCount: 40,
  seed: 'snap-test:v1',
};

// The eight scenario lives the /dev-creature harness reviews — between them
// they exercise every skin (shell/soft/smooth/rough/hairy), every appendage
// (wings/fronds/ribbons/tendrils/claws/legs/caps), both claw species, and the
// crust/raw-rim method overlays. If the recorder survives all eight, it covers
// the creature's whole drawing surface as it exists today.
const LIVES: Record<string, DomainEvidence> = {
  sea: { sea: 34, shell: 4, algae: 8 },
  crab: { sea: 12, shell: 26, sub: { shell: { lobster: 4, crab: 18, prawn: 4 } } },
  lobster: { sea: 10, shell: 24, sub: { shell: { lobster: 17, crab: 4, prawn: 3 } } },
  land: { land: 36, air: 6, sub: { land: { beef: 20, pork: 10, chicken: 6 } } },
  fire: { land: 22, air: 14, sub: { land: { beef: 6, pork: 8, chicken: 8 } } },
  garden: { field: 26, fungus: 12, algae: 5 },
  air: { air: 30, land: 8 },
  bake: { field: 3, land: 3 },
};

describe('canvasToSvg covers the creature\'s whole drawing surface', () => {
  for (const [name, domains] of Object.entries(LIVES)) {
    it(`records the ${name} life without an unimplemented stroke`, () => {
      // svgContext throws on any ctx member it does not implement, so simply
      // completing the draw IS the coverage assertion.
      const svg = creatureSnapshotSvg(INPUTS, domains, 190, '鮮');
      expect(svg.length).toBeGreaterThan(500);   // a being, not a blank
      expect(svg).toContain('<path');
      expect(svg).toContain('<radialGradient');  // the fog wash survived
    });
  }

  it('balances every clip group — no leaked <g> across save/restore', () => {
    for (const domains of Object.values(LIVES)) {
      const svg = creatureSnapshotSvg(INPUTS, domains, 190);
      const open = (svg.match(/<g /g) ?? []).length;
      const close = (svg.match(/<\/g>/g) ?? []).length;
      expect(open).toBe(close);
    }
  });

  it('throws loudly on a stroke the recorder does not know', () => {
    const { ctx } = svgContext(100, 100);
    expect(() => (ctx as any).drawImage()).toThrow(/does not implement/);
  });
});

describe('the snapshot is deterministic — same profile, same being, forever', () => {
  it('two recordings of the same life are byte-identical', () => {
    const a = creatureSnapshotSvg(INPUTS, LIVES.crab, 190, '鮮');
    const b = creatureSnapshotSvg(INPUTS, LIVES.crab, 190, '鮮');
    expect(a).toBe(b);
  });

  it('different seeds are different beings (micro-texture is seeded, not rolled)', () => {
    const a = creatureSnapshotSvg(INPUTS, LIVES.crab, 190);
    const b = creatureSnapshotSvg({ ...INPUTS, seed: 'other:v1' }, LIVES.crab, 190);
    expect(a).not.toBe(b);
  });
});

describe('TasteFormSnapshot mounts the recording itself — a lookalike fails here', () => {
  it('with domains, the component\'s markup IS creatureSnapshotSvg\'s output', () => {
    const html = renderToStaticMarkup(
      React.createElement(TasteFormSnapshot, { inputs: INPUTS, size: 190, glyph: '鮮', domains: LIVES.crab }),
    );
    const inner = creatureSnapshotSvg(INPUTS, LIVES.crab, 190, '鮮');
    // Identity, not resemblance: the exact recorded markup must appear verbatim.
    // Re-implementing the creature as bespoke SVG would satisfy any visual
    // check and still fail this line — which is the point.
    expect(html).toContain(inner);
  });

  it('without domains, the blob path renders byte-identically to blobSnapshotPath', () => {
    const html = renderToStaticMarkup(
      React.createElement(TasteFormSnapshot, { inputs: INPUTS, size: 200 }),
    );
    expect(html).toContain(`d="${blobSnapshotPath(INPUTS, 200)}"`);
    expect(html).not.toContain('clip-path'); // nothing of the creature leaked in
  });

  it('empty domain evidence keeps the blob — the same fail-closed door as live', () => {
    expect(hasAnatomy({})).toBe(false);
    const html = renderToStaticMarkup(
      React.createElement(TasteFormSnapshot, { inputs: INPUTS, size: 200, domains: {} }),
    );
    expect(html).toContain(`d="${blobSnapshotPath(INPUTS, 200)}"`);
  });
});
