// The creature's pure logic: the anatomy gate (fail closed to the blob) and
// temperament (姿/性 read from dims the engine already learns). The drawing
// itself is canvas-only and is verified visually on /dev-creature — but the
// gates are where honesty lives, and honesty is testable.
import { describe, it, expect } from 'vitest';
import {
  hasAnatomy, temperOf, hairWindBend, hairMetrics, out, skinOf, boneOverlay, domainShares, bodyBox,
  creatureSnapshotSvg,
} from '../src/lib/creatureForm';
import type { DomainEvidence, SkinType } from '../src/lib/creatureForm';
import type { FormInputs } from '../src/lib/blobForm';

const TAU = Math.PI * 2;

/** Resolve a skin the way the renderer does — from the METHOD mix alone. */
const skin = (methodDim?: string): SkinType => {
  const vector: Record<string, number> = { umami: 0.4 };
  const evidence: Record<string, number> = { umami: 20 };
  if (methodDim) { vector[methodDim] = 0.9; evidence[methodDim] = 20; }
  const t = temperOf({ vector, evidence, ratingCount: 45, seed: 's:v1' });
  return skinOf(t.m);
};

/** 骨 overlays, resolved from domain evidence the way the renderer does. */
const bone = (domains: DomainEvidence) => boneOverlay(domains, domainShares(domains));

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

describe('out — the rim\'s outward direction, the one place the sign lives', () => {
  // Pins the exact bug the lab lost wings and tails to: a hand-rolled
  // direction with the sign inverted on one side, which drew the appendage
  // INTO the body instead of away from it. Any two calls at mirror angles
  // must themselves be mirrors — never independently signed.
  const CASES = [0, 0.3, Math.PI / 2, 1.9, Math.PI, 4.1, 3 * Math.PI / 2, 6.0];

  it('top of the rim (ph=0) points straight up: x=0, y=-L', () => {
    const p = out(0, 10);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(-10, 10);
  });

  it('bottom of the rim (ph=π) points straight down: x=0, y=+L', () => {
    const p = out(Math.PI, 10);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(10, 10);
  });

  it('right flank (ph=π/2) points right: x=+L, y=0', () => {
    const p = out(Math.PI / 2, 10);
    expect(p.x).toBeCloseTo(10, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('left flank (ph=3π/2) points left: x=-L, y=0', () => {
    const p = out(3 * Math.PI / 2, 10);
    expect(p.x).toBeCloseTo(-10, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('mirrors across the vertical axis: out(ph) and out(TAU-ph) agree in y, negate in x', () => {
    for (const ph of CASES) {
      const a = out(ph, 12), b = out(TAU - ph, 12);
      expect(b.x).toBeCloseTo(-a.x, 10);
      expect(b.y).toBeCloseTo(a.y, 10);
    }
  });

  it('is always the unit direction at ph, scaled by L — never a fixed axis', () => {
    for (const ph of CASES) {
      const p = out(ph, 7);
      expect(p.x).toBeCloseTo(Math.sin(ph) * 7, 10);
      expect(p.y).toBeCloseTo(-Math.cos(ph) * 7, 10);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(7, 10);
    }
  });

  it('scales linearly with L, including negative L reversing direction', () => {
    const ph = 0.85;
    const p1 = out(ph, 1), p3 = out(ph, 3), pNeg = out(ph, -1);
    expect(p3.x).toBeCloseTo(p1.x * 3, 10);
    expect(p3.y).toBeCloseTo(p1.y * 3, 10);
    expect(pNeg.x).toBeCloseTo(-p1.x, 10);
    expect(pNeg.y).toBeCloseTo(-p1.y, 10);
  });
});

describe('bodyBox — anything on the skin anchors to the DRAWN silhouette', () => {
  // The bug this pins (owner, 2026-08-05: "the lighter curvy layer is at the
  // bottom instead of the top"): 軟's pale halo was placed against the nominal
  // (cx, cy) while the body's taste lobes pull its DRAWN centre far off that
  // point, so the ruffle meant for the crown pooled under the belly.
  it('reports the centre of the drawn points, not the centre they orbit', () => {
    // A body lobed upward: every point is offset up by 20 from a nominal 100.
    const lobed = [
      { x: 100, y: 40 }, { x: 140, y: 80 }, { x: 100, y: 100 }, { x: 60, y: 80 },
    ];
    const bb = bodyBox(lobed);
    expect(bb.cx).toBe(100);
    expect(bb.cy).toBe(70);          // NOT 100 — this is the whole point
    expect(bb.hr).toBe(40);
    expect(bb.vr).toBe(30);
  });

  it('a halo sized and placed off bodyBox clears the crown more than the belly', () => {
    // Reproduces the shipped geometry: same wobble, same 1.12 scale, same
    // upward nudge. If a future edit re-anchors this to a nominal centre on a
    // lobed body, the top clearance collapses and this fails.
    const pts = Array.from({ length: 96 }, (_, i) => {
      const ph = (i / 96) * TAU;
      const r = 40 * (1 + 0.25 * Math.max(0, Math.cos(ph))); // strong top lobe
      return { x: 100 + Math.sin(ph) * r, y: 100 - Math.cos(ph) * r };
    });
    const bb = bodyBox(pts);
    const haloY = (ha: number) =>
      bb.cy - bb.vr * 0.08 + Math.sin(ha) * bb.vr * 1.12;
    const topClear = bb.cy - bb.vr - haloY(-Math.PI / 2);   // halo above body top
    const botClear = haloY(Math.PI / 2) - (bb.cy + bb.vr);  // halo below body base
    expect(topClear).toBeGreaterThan(0);
    expect(botClear).toBeGreaterThan(0);      // still enclosed all round
    expect(topClear).toBeGreaterThan(botClear); // but the ruffle reads at the CROWN
  });
});

describe('skinOf — 膚 is METHOD-driven (the rearrangement, owner 2026-08-05)', () => {
  // This decision drifted silently once: 軟 changed from the framework's
  // 燜 braised to a 田+菌 domain read, and nothing caught it because the NAME
  // matched on both sides. These tests exist so the next drift is loud.
  const THIN: DomainEvidence = { sea: 2 }; // passes hasAnatomy, grows nothing

  it('軟 SOFT belongs to 蒸 steamed — NOT to the 田+菌 domain', () => {
    expect(skin('steamed')).toBe('soft');
    // The old wiring: a vegetable+mushroom eater got 軟 for free from their
    // DIET. skinOf can no longer see domains at all, so that cannot recur.
  });

  it('滑 SMOOTH is 生 raw alone now — 蒸 must not also trip it', () => {
    expect(skin('raw')).toBe('smooth');
    expect(skin('steamed')).not.toBe('smooth');
  });

  it('糙 ROUGH belongs to 炸 fried', () => {
    expect(skin('fried')).toBe('rough');
  });

  it('釉 GLAZE belongs to 燜 braised', () => {
    expect(skin('braised')).toBe('glazed');
  });

  it('金 GOLD belongs to 焗 baked', () => {
    expect(skin('baked')).toBe('golden');
  });

  it('烙 CHARRED belongs to 烤 grilled', () => {
    expect(skin('grilled')).toBe('charred');
  });

  it('method skins are mutually exclusive by construction, not by luck', () => {
    // Shares of one normalised total: at most one can clear 0.5. Feeding two
    // wet methods equally must therefore yield neither skin, not both.
    const t = temperOf({
      vector: { steamed: 0.9, raw: 0.9 }, evidence: { steamed: 20, raw: 20 },
      ratingCount: 45, seed: 's:v1',
    });
    expect(t.m.steamed).toBeCloseTo(0.5, 6);
    expect(t.m.raw).toBeCloseTo(0.5, 6);
    expect(skinOf(t.m)).toBe('none');
  });

  it('膚 and 骨 COMPOSE — a steamed crab is soft AND armoured', () => {
    // The whole point of the rearrangement. Under the old precedence chain
    // shell took the one slot and the cooking method left no trace at all.
    expect(skin('steamed')).toBe('soft');
    expect(bone({ shell: 20 }).shell).toBe(true);
    // ...and a grilled land eater is char-branded AND furred.
    expect(skin('grilled')).toBe('charred');
    expect(bone({ land: 20 }).fur).toBe(true);
  });

  it('骨 flags are independent of each other and of method', () => {
    // shell needs >0.30 share, fur >0.45 — those sum under 1, so a
    // shell-and-land eater legitimately wears both.
    const both = bone({ shell: 20, land: 26 });
    expect(both.shell).toBe(true);
    expect(both.fur).toBe(true);
    // and a thin domain record grows neither, whatever the method says
    expect(bone({ sea: 2 })).toEqual({ shell: false, fur: false });
  });

  it('甲 and 毛 have LEFT 膚 — they no longer outrank or block a method skin', () => {
    // The rearrangement, now structural rather than sequenced. Before this,
    // shell won the slot outright and a steamed crab read armoured with no
    // trace of how it was cooked.
    expect(skin('steamed')).toBe('soft');          // domains cannot interfere
    expect(bone({ shell: 20 }).shell).toBe(true);  // ...and the shell is still there
  });

  it('no domain and no method preference is bare — nothing is invented', () => {
    expect(skin()).toBe('none');
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

  it('is never fully still — a lull that stops dead reads as no animation', () => {
    // sample many instants; the coat's peak bend must stay meaningful throughout
    let weakest = Infinity;
    for (let t = 0; t < 40000; t += 250) {
      const peak = Math.max(...HAIRS.map(h => Math.abs(hairWindBend(h.nx, h.ny, h.x, R, t))));
      weakest = Math.min(weakest, peak);
    }
    expect(weakest).toBeGreaterThan(0.05);
  });

  it('bounded — a gust lays fur over, it does not spin it into a limb', () => {
    let worst = 0;
    for (let t = 0; t < 30000; t += 50) {
      for (const h of HAIRS) worst = Math.max(worst, Math.abs(hairWindBend(h.nx, h.ny, h.x, R, t)));
    }
    expect(worst).toBeLessThan(0.9); // ≈50°, and only fully broadside at peak gust
  });
});

// The small-size correction: below ~170px the coat was burying the legs.
describe('hairMetrics — the coat yields to the anatomy under it at small sizes', () => {
  const R = (size: number) => size * 0.1951; // the creature's body radius at this size

  it('leaves the approved large sizes exactly as they were', () => {
    for (const size of [170, 184, 220, 280]) {
      expect(hairMetrics(size, R(size)).w).toBe(3);
    }
  });

  it('below 170px the stroke thins, monotonically', () => {
    const widths = [170, 150, 130, 110, 96, 72].map(s => hairMetrics(s, R(s)).w);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
    expect(widths[widths.length - 1]).toBeLessThan(2);
  });

  it('thinner ⇒ DENSER and SHORTER together — the three-part ask, one lever', () => {
    // measured against the stroke, since that is what legibility is relative to
    const big = hairMetrics(184, R(184));
    const small = hairMetrics(110, R(110));
    expect(small.gap).toBeLessThan(big.gap);     // more hairs per unit rim
    expect(small.base).toBeLessThan(big.base);   // shorter strands
    expect(small.w).toBeLessThan(big.w);         // finer stroke
  });

  it('a strand never grows long enough to swamp the body it sits on', () => {
    for (const size of [72, 96, 120, 150, 184, 280]) {
      const r = R(size);
      expect(hairMetrics(size, r).base).toBeLessThanOrEqual(r * 0.32 + 1e-9);
    }
  });

  it('neighbours never fuse: the gap always clears the stroke width', () => {
    for (const size of [72, 96, 120, 150, 184, 280]) {
      const hm = hairMetrics(size, R(size));
      expect(hm.gap).toBeGreaterThan(hm.w * 1.2);
    }
  });
});

describe('糙 rough — the owner\'s spec, through the real renderer', () => {
  // Owner, 2026-08-05: one dot = a grey circle overlapping a black circle;
  // 4 dots upper-right, 3 lower-left, none touching the rim.
  const svg = creatureSnapshotSvg(
    { vector: { umami: 0.4, fried: 0.9 }, evidence: { umami: 20, fried: 20 }, ratingCount: 45, seed: 'rough:v1' },
    { sea: 2 }, 200,
  );
  // ctx.arc serialises as an arc-pair <path>: the two anchors are opposite
  // points on the rim, so centre = their midpoint and r = half their span.
  // Array.from, not spread — bare tsc lacks downlevelIteration.
  const circles = (fill: string) =>
    Array.from(svg.matchAll(
      /<path d="M([\d.-]+) ([\d.-]+)A([\d.-]+) [\d.-]+ [\d.-]+ \d \d ([\d.-]+) ([\d.-]+)[^"]*" fill="([^"]+)"/g,
    ), m => m).filter(m => m[6] === fill)
      .map(m => ({ cx: (+m[1] + +m[4]) / 2, cy: (+m[2] + +m[5]) / 2, r: +m[3] }));

  const grey = circles('#5a544c');
  const black = circles('#0a0908');

  /** The drawn body outline. Found by SHAPE — the longest bezier path — not by
   *  a def id: ids are content-hashed, so hardcoding one is exactly the kind
   *  of brittle coupling that broke when the collision bug was fixed. */
  const outline = () => {
    const paths = Array.from(svg.matchAll(/<path d="(M[^"]*C[^"]+)"/g), m => m[1]);
    const longest = paths.sort((a, b) => b.length - a.length)[0];
    return longest.match(/-?[\d.]+[, ]-?[\d.]+/g)!
      .map(t => t.split(/[, ]/).map(Number))
      .map(([x, y]) => ({ x, y }));
  };

  it('draws 7 dots — one grey circle over one black circle each', () => {
    expect(grey).toHaveLength(7);
    expect(black).toHaveLength(7);
    // every grey rides its own black: offset is ~0.17r, so well under 1r
    for (const g of grey) {
      const nearest = Math.min(...black.map(b => Math.hypot(b.cx - g.cx, b.cy - g.cy)));
      expect(nearest).toBeLessThan(g.r);
      expect(nearest).toBeGreaterThan(0); // genuinely offset, not concentric
    }
  });

  it('anchors 4 upper-RIGHT and 3 lower-LEFT of the drawn body', () => {
    // Body centre from the drawn outline, same source the renderer uses.
    const bb = bodyBox(outline());
    const upper = grey.filter(d => d.cx > bb.cx && d.cy < bb.cy);
    const lower = grey.filter(d => d.cx < bb.cx && d.cy > bb.cy);
    expect(upper).toHaveLength(4);
    expect(lower).toHaveLength(3);
  });

  it('no dot touches the rim', () => {
    const pts = outline();
    for (const d of [...grey, ...black]) {
      const nearestRim = Math.min(...pts.map(p => Math.hypot(p.x - d.cx, p.y - d.cy)));
      expect(nearestRim).toBeGreaterThan(d.r);
    }
  });
});

/* ── limbStrengths — the two-mode gate layer (G2, growth program) ─────────────
   docs/rnd/mokling-growth-rnd.md Decisions 1–2. Legacy must be the shipped
   arithmetic exactly (the extraction was ALSO proven by byte-diffing all eight
   scenario lives' snapshots before/after); metabolism must deliver the three
   headline behaviors the redesign exists for: wings at the owner's real 7.3%
   air share, buds from a first loved dish, and share as a dial, not a door. */
import { limbStrengths } from '../src/lib/creatureForm';

describe('limbStrengths — legacy mode is the shipped gate arithmetic', () => {
  it('keeps the wings door: air under 0.22 share grows nothing, whatever the evidence', () => {
    // the owner's own measured profile shape: air ~7.3% of a lived, varied diet
    const S = limbStrengths({ sea: 19, land: 13.4, shell: 12.2, field: 5.8, air: 4.4, algae: 2.6, fungus: 2.6 }, 'legacy');
    expect(S.wings.on).toBe(false);
  });

  it('passes a dominant node exactly as before', () => {
    const S = limbStrengths({ air: 30, land: 8 }, 'legacy');
    expect(S.wings.on).toBe(true);
    expect(S.wings.evF).toBeGreaterThan(0.9);
  });
});

describe('limbStrengths — metabolism mode (fed by DECAYED evidence)', () => {
  it('grows wings on the owner-shaped diet the legacy door forbade', () => {
    const S = limbStrengths({ sea: 19, land: 13.4, shell: 12.2, field: 5.8, air: 4.4, algae: 2.6, fungus: 2.6 }, 'metabolism');
    expect(S.wings.on).toBe(true);
    expect(S.wings.evF).toBeGreaterThan(0.2); // a real (young-formed) wing, not a ghost
  });

  it('one loved first dish buds a visible nub; one neutral dish does not', () => {
    // BUD_MIN: the limb POPS IN at >=35% treatment the moment the floor is
    // crossed (owner: "could be short but need to be more obvious") — never a
    // hairline fading up from nothing.
    expect(limbStrengths({ shell: 1.5 }, 'metabolism').claws).toBeGreaterThanOrEqual(0.35);
    expect(limbStrengths({ shell: 1.5 }, 'metabolism').legs).toBe(0); // nothing un-lived pops
    expect(limbStrengths({ shell: 0.5 }, 'metabolism').claws).toBe(0);
  });

  it('share scales but never denies: minority nodes render at >=60% of the dominant treatment', () => {
    const S = limbStrengths({ sea: 30, land: 12 }, 'metabolism');
    expect(S.legs).toBeGreaterThan(0);
    // same evidence as sole node → prom = 1; as minority → prom >= 0.6
    const solo = limbStrengths({ land: 12 }, 'metabolism');
    expect(S.legs / solo.legs).toBeGreaterThanOrEqual(0.6 - 1e-9);
  });

  it('a bud is a nub: full-bud size stays well under half the formed limb', () => {
    const bud = limbStrengths({ field: 2.2 }, 'metabolism').fronds;
    const formed = limbStrengths({ field: 14 }, 'metabolism').fronds;
    expect(bud).toBeGreaterThan(0.2);
    expect(bud).toBeLessThan(0.5 * formed);
  });

  it('boneOverlay drops the share door but keeps the FORM-tier floor', () => {
    const lived = { shell: 9, sea: 40 }; // heavy sea diet — shell share only ~18%
    expect(boneOverlay(lived, domainShares(lived), 'legacy').shell).toBe(false);
    expect(boneOverlay(lived, domainShares(lived), 'metabolism').shell).toBe(true);
    const thin = { shell: 2, sea: 40 }; // two dishes of shell — no carapace
    expect(boneOverlay(thin, domainShares(thin), 'metabolism').shell).toBe(false);
  });
});
