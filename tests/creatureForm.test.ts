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

  it('a young leg is SHORT but THICK — girth rides its own curve', () => {
    // owner, 2026-08-06 "thicker baby leg": scaling length and width together
    // made the bud a wire. Girth is f^BUD_GIRTH, so it outruns length at the
    // bud and converges at maturity — a mature limb must not move at all.
    const budF = limbStrengths({ sea: 6.2, land: 2.2 }, 'metabolism').legs;
    expect(Math.pow(budF, 0.45) / budF).toBeGreaterThan(1.5); // stubby
    const matureF = limbStrengths({ land: 30 }, 'metabolism').legs;
    expect(matureF).toBeCloseTo(1, 6);
    expect(Math.pow(matureF, 0.45) / matureF).toBeCloseTo(1, 6); // untouched
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

/* ── G9: contested dominance is settled by the duel, never by a knife edge ─────
   The bug these pin, found by the owner on the metabolism bench: an alternating
   crab/lobster diet flipped the claw on 16 of 17 meals, because the species was
   a bare `>=` comparison. */
import { pickVariant, domOfStable } from '../src/lib/creatureForm';

describe('pickVariant — the contested-dominance ladder', () => {
  const K = 'shell:crab|lobster';

  it('rung 1 — a CLEAR lead wins outright, duels notwithstanding', () => {
    const mix = { crab: 8, lobster: 2 };
    expect(pickVariant(mix, 'crab', 'lobster', 'shell', { [K]: -5 })).toBe('crab');
  });

  it('rung 2 — inside the dead zone, the DUEL decides', () => {
    const mix = { crab: 5.2, lobster: 4.8 };              // eating says nothing
    expect(pickVariant(mix, 'crab', 'lobster', 'shell', { [K]: -1 })).toBe('lobster');
    expect(pickVariant(mix, 'crab', 'lobster', 'shell', { [K]: 1 })).toBe('crab');
  });

  it('rung 3 — contested and never duelled holds STEADY, whoever ate last', () => {
    // the flicker case: the lead alternates by a few percent, meal to meal
    const a = pickVariant({ crab: 5.2, lobster: 4.8 }, 'crab', 'lobster', 'shell', undefined);
    const b = pickVariant({ crab: 4.8, lobster: 5.2 }, 'crab', 'lobster', 'shell', undefined);
    expect(a).toBe(b); // <- the whole point: no flip
  });

  it('THE REGRESSION: an alternating 50/50 diet no longer flips the claw', () => {
    // reproduces the bench exactly — crab and lobster trading a ~8% lead
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const mix = i % 2 ? { crab: 5.4, lobster: 4.6 } : { crab: 4.6, lobster: 5.4 };
      seen.add(pickVariant(mix, 'crab', 'lobster', 'shell', undefined));
    }
    expect(seen.size).toBe(1); // one species for the whole run, not twelve flips
  });

  it('a duel verdict is OVERRIDDEN once eating genuinely decides', () => {
    // the verdict only speaks while eating is silent — present tense wins
    expect(pickVariant({ crab: 9, lobster: 1 }, 'crab', 'lobster', 'shell', { [K]: -3 }))
      .toBe('crab');
  });
});

describe('domOfStable — the same ladder for the three-way foot', () => {
  it('a clear beef eater still gets a hoof', () => {
    expect(domOfStable({ beef: 7, pork: 2, chicken: 1 }, ['beef', 'pork', 'chicken'], 'land', undefined)).toBe('beef');
  });

  it('near-tied beef/pork — ordinary HK eating — does not flicker', () => {
    const a = domOfStable({ beef: 4.6, pork: 4.4, chicken: 1 }, ['beef', 'pork', 'chicken'], 'land', undefined);
    const b = domOfStable({ beef: 4.4, pork: 4.6, chicken: 1 }, ['beef', 'pork', 'chicken'], 'land', undefined);
    expect(a).toBe(b);
  });

  it('and a beef-vs-pork duel settles it', () => {
    const mix = { beef: 4.5, pork: 4.5, chicken: 1 };
    expect(domOfStable(mix, ['beef', 'pork', 'chicken'], 'land', { 'land:beef|pork': -2 })).toBe('pork');
    expect(domOfStable(mix, ['beef', 'pork', 'chicken'], 'land', { 'land:beef|pork': 2 })).toBe('beef');
  });
});

describe('pickVariant reads REAL evidence, not subMix\'s blending default', () => {
  it('a never-eaten variant loses outright to a lightly-eaten one', () => {
    // subMix defaults an absent key to 1 (right for blending geometry, wrong
    // for choosing). Measured on the owner's live profile: lobster 1.23 and
    // crab never eaten — under the blend default those sit 0.103 apart, a hair
    // outside the dead zone, so a nudge either way would have handed the claw
    // to a species they have never had.
    expect(pickVariant({ lobster: 1.23 }, 'crab', 'lobster', 'shell', undefined)).toBe('lobster');
  });

  it('no evidence at all for either — hold stable rather than invent a winner', () => {
    expect(pickVariant({}, 'crab', 'lobster', 'shell', undefined)).toBe('crab');
    expect(pickVariant(undefined, 'crab', 'lobster', 'shell', undefined)).toBe('crab');
  });

  it('the owner\'s real land mix still reads pork — no live creature moves', () => {
    const real = { beef: 2.802794119468894, pork: 5.69031428745255, chicken: 3.483171746745267 };
    expect(domOfStable(real, ['beef', 'pork', 'chicken'], 'land', undefined)).toBe('pork');
  });
});

describe('MIN_LEAD — a lead smaller than one meal is not a lead', () => {
  it('two lobster against one crab does NOT flip the claw, landslide share or not', () => {
    // 67/33 by share, three meals by life. This is the shape that produced 9
    // flips across the bench's first nine shellfish meals before MIN_LEAD.
    expect(pickVariant({ crab: 1.1, lobster: 2.2 }, 'crab', 'lobster', 'shell', undefined))
      .toBe(pickVariant({ crab: 2.2, lobster: 1.1 }, 'crab', 'lobster', 'shell', undefined));
  });

  it('but a real habit still wins — five clear meals ahead is a lead', () => {
    expect(pickVariant({ crab: 8, lobster: 2 }, 'crab', 'lobster', 'shell', undefined)).toBe('crab');
    expect(pickVariant({ crab: 2, lobster: 8 }, 'crab', 'lobster', 'shell', undefined)).toBe('lobster');
  });

  it('a first-ever meal still shows what was eaten, MIN_LEAD notwithstanding', () => {
    // zero-evidence guard must outrank MIN_LEAD, or one lobster dish would fall
    // through to the stable hold and draw a crab claw
    expect(pickVariant({ lobster: 1.1 }, 'crab', 'lobster', 'shell', undefined)).toBe('lobster');
  });
});

/* ── G10: sub-node variants COEXIST — the takeover as a watchable process ─────
   Owner, 2026-08-06: crab claws stay while "2 baby lobster claws" appear, grow
   with the lobster habit, and only take over once crab stops. */
import { clawSeats } from '../src/lib/creatureForm';

describe('clawSeats — one pair per coexisting variant', () => {
  const M = (shell: Record<string, number>): DomainEvidence => ({ sub: { shell } as any });

  it('a first loved lobster appears IMMEDIATELY, without unseating the crab', () => {
    const before = clawSeats(M({ crab: 4.5 }), 'metabolism', 0.9);
    const after = clawSeats(M({ crab: 4.5, lobster: 1.5 }), 'metabolism', 0.9);
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);                     // something happened, same day
    expect(after[0].species).toBe('crab');             // crab still owns the prime seat
    expect(after[0].sizeF).toBeCloseTo(before[0].sizeF, 6); // and is untouched by it
    expect(after[1].species).toBe('lobster');
    expect(after[1].sizeF).toBeLessThan(0.4);          // a BABY pair
  });

  it('the newcomer grows with its own habit, not the parent domain\'s', () => {
    const young = clawSeats(M({ crab: 4.5, lobster: 1.5 }), 'metabolism', 0.9)[1].sizeF;
    const older = clawSeats(M({ crab: 4.5, lobster: 4.0 }), 'metabolism', 0.9)[1].sizeF;
    expect(older).toBeGreaterThan(young * 2);
  });

  it('the takeover is a SEAT SWAP, not an appearance — both pairs persist', () => {
    const s = clawSeats(M({ crab: 2.2, lobster: 7.0 }), 'metabolism', 0.9);
    expect(s[0].species).toBe('lobster');   // lobster now prime
    expect(s[1].species).toBe('crab');      // crab demoted, still there
    expect(s[1].sizeF).toBeLessThan(s[0].sizeF);
  });

  it('and the old variant leaves only when its own evidence sheds', () => {
    const s = clawSeats(M({ crab: 0.4, lobster: 9.0 }), 'metabolism', 0.9);
    expect(s).toHaveLength(1);
    expect(s[0].species).toBe('lobster');
  });

  it('the two pairs never share a seat', () => {
    const s = clawSeats(M({ crab: 4.5, lobster: 4.0 }), 'metabolism', 0.9);
    expect(s[0].seat).not.toBe(s[1].seat);
  });

  it('a prawn-dominant palate wears PRAWN pincers — its own species, since G4', () => {
    // The owner's real profile. Before the 蝦 gesture existed (G4 round 1,
    // 2026-08-07) this evidence was folded into a 龍蝦 prime seat it never
    // earned — the very fold that saturated sizeF to the crop bug. Now prawn
    // is first-class: prime pincers sized by prawn's OWN evidence, and the
    // barely-lived lobster (1.23, a hair over the bud floor) takes the
    // second seat as a baby claw.
    const s = clawSeats(M({ prawn: 5.64, lobster: 1.23 }), 'metabolism', 0.9);
    expect(s).toHaveLength(2);
    expect(s[0].species).toBe('prawn');
    expect(s[0].sizeF).toBeGreaterThan(0.8);
    expect(s[1].species).toBe('lobster');
    expect(s[1].sizeF).toBeLessThan(0.4);
  });

  it('undifferentiated shell evidence still draws the parent gesture', () => {
    const s = clawSeats(M({}), 'metabolism', 0.9);
    expect(s).toHaveLength(1);
    expect(s[0].sizeF).toBeCloseTo(0.5 + 0.5 * 0.9, 6); // exactly the legacy size
  });

  it('LEGACY is one pair at exactly today\'s size, whatever the sub-mix', () => {
    const cases: Record<string, number>[] = [{ crab: 4.5, lobster: 4.0 }, { crab: 4.5 }, {}];
    for (const shell of cases) {
      const s = clawSeats(M(shell), 'legacy', 0.9);
      expect(s).toHaveLength(1);
      expect(s[0].seat).toBe(1.95);
      expect(s[0].sizeF).toBeCloseTo(0.5 + 0.5 * 0.9, 6);
    }
  });
});

/* ── 螯 motion: the pair chops IN UNISON (owner, 2026-08-06) ──────────────────
   Tested through the pure function, never by sampling the canvas: rAF is
   paused whenever the preview pane is hidden, so a pixel diff reports a
   perfectly still creature whether or not the motion works. */
import { clawMotion } from '../src/lib/creatureGestures';

describe('clawMotion — both claws snap at the same time', () => {
  // one full cycle (7200ms) at fine resolution, so no snap can hide between samples
  const TS = Array.from({ length: 400 }, (_, i) => i * 18);

  it('the snap itself is IDENTICAL on both sides, at every instant', () => {
    for (const t of TS) {
      expect(clawMotion(t, 1).grip).toBeCloseTo(clawMotion(t, -1).grip, 12);
    }
  });

  it('neither side fires a snap the other does not', () => {
    // the original bug shape: an offset alone still left one side chopping a
    // third time after the other had gone quiet
    const firing = (side: number) => TS.filter(t => clawMotion(t, side).grip < 0.999).length;
    expect(firing(1)).toBe(firing(-1));
    expect(firing(1)).toBeGreaterThan(0); // and it really does chop
  });

  it('still chops — a double snap, then a long quiet', () => {
    const shut = TS.map(t => clawMotion(t, 1).grip < 0.5);
    const bursts = shut.filter((v, i) => v && !shut[i - 1]).length;
    expect(bursts).toBe(2);                                   // two snaps
    expect(shut.filter(Boolean).length / shut.length).toBeLessThan(0.15); // mostly rest
  });

  it('the recoil rides the snap, so it synchronises for free', () => {
    const tSnap = TS.find(t => clawMotion(t, 1).grip < 0.5)!;
    const a = clawMotion(tSnap, 1), b = clawMotion(tSnap, -1);
    // sway = shared recoil + a per-side drift; the recoil part must match
    expect(a.sway - b.sway).toBeCloseTo(
      0.010 * (Math.sin(tSnap * 0.00041 + 2.6) - Math.sin(tSnap * 0.00041 - 2.6)), 12);
  });

  it('the resting breath still differs per side — texture, not the chop', () => {
    const quiet = TS.filter(t => clawMotion(t, 1).grip > 0.999);
    const differ = quiet.filter(t => Math.abs(clawMotion(t, 1).pinch - clawMotion(t, -1).pinch) > 1e-9);
    expect(differ.length).toBeGreaterThan(quiet.length * 0.5);
  });
});

describe('clawMotion — two pairs take turns (owner, 2026-08-06)', () => {
  const TS = Array.from({ length: 400 }, (_, i) => i * 18);
  const firing = (seat: number) => TS.filter(t => clawMotion(t, 1, seat).grip < 0.5);

  it('within a pair, still perfectly in unison at BOTH seats', () => {
    for (const seat of [0, 1]) {
      for (const t of TS) {
        expect(clawMotion(t, 1, seat).grip).toBeCloseTo(clawMotion(t, -1, seat).grip, 12);
      }
    }
  });

  it('but the second pair fires LATER — one pair, then the other', () => {
    const a = firing(0), b = firing(1);
    expect(a.length).toBe(b.length);          // same gesture, same amount of it
    expect(Math.min(...b)).toBeGreaterThan(Math.min(...a)); // just later
  });

  it('the two bursts never overlap — you hear snap-snap, then snap-snap', () => {
    const a = new Set(firing(0));
    expect(firing(1).some(t => a.has(t))).toBe(false);
  });

  it('a lone pair is unaffected — seat 0 is the default', () => {
    for (const t of TS) expect(clawMotion(t, 1).grip).toBe(clawMotion(t, 1, 0).grip);
  });
});

/* ── the CLAW_MAX ceiling — a regression guard, not just a code comment ───────
   Owner, 2026-08-07: "cropped by an invisible square" — confirmed by reading
   actual canvas pixels on the live page (see clawSeats' own comment for why
   parsing the SVG path text was not a safe way to check this). sizeF must
   never exceed the calibrated ceiling, on ANY evidence shape — not just the
   one fixture that happened to clip. */
describe('CLAW_MAX — sizeF never exceeds the calibrated safe ceiling', () => {
  it('sweeps a wide range of evidence and shares; nothing ever tops 0.85', () => {
    for (const prime of [1.5, 3, 6, 12, 30, 100]) {
      for (const other of [0, 1, 3, 6, 20]) {
        for (const unallocated of [0, 2, 8, 40]) {
          const bag = { crab: prime, lobster: other, prawn: unallocated };
          const seats = clawSeats({ sub: { shell: bag } } as any, 'metabolism', 0.9);
          for (const seat of seats) expect(seat.sizeF).toBeLessThanOrEqual(0.85 + 1e-9);
        }
      }
    }
  });

  it('the exact profile that clipped in production stays under the ceiling', () => {
    // owner's real live shell mix. Pre-G4 it folded into a 龍蝦 seat and ran
    // claw ink onto canvas column 0 (confirmed on /jerry by scanning rendered
    // ImageData, not by parsing path text); the ceiling closed that. Since G4
    // it wears its own prawn pincers — still bounded by the same ceiling.
    const s = clawSeats(
      { sub: { shell: { prawn: 5.64, lobster: 1.23 } } } as any, 'metabolism', 0.9);
    for (const seat of s) expect(seat.sizeF).toBeLessThanOrEqual(0.85 + 1e-9);
  });

  it('legacy is untouched — sizeF can still reach a genuine 1.0', () => {
    const s = clawSeats(
      { sub: { shell: { prawn: 5.64, lobster: 1.23 } } } as any, 'legacy', 1.0);
    expect(s[0].sizeF).toBeCloseTo(1.0, 6);
  });
});

describe('蝦 prawn as a first-class claw species (G4 round 1)', () => {
  const M2 = (shell: Record<string, number>): DomainEvidence => ({ sub: { shell } as any });

  it('three-way ranking: the strongest OTHER takes the second seat', () => {
    const s = clawSeats(M2({ prawn: 8, crab: 5, lobster: 2 }), 'metabolism', 0.9);
    expect(s.map(x => x.species)).toEqual(['prawn', 'crab']); // lobster waits
  });

  it('prawn no longer inflates a claw it did not earn — the fold is gone', () => {
    // heavy prawn + barely-lived crab: crab's seat is sized by crab's OWN 1.5,
    // not by 20 of someone else's eating
    const s = clawSeats(M2({ crab: 1.5, prawn: 20 }), 'metabolism', 0.9);
    expect(s[0].species).toBe('prawn');
    expect(s[1].species).toBe('crab');
    expect(s[1].sizeF).toBeLessThan(0.35);
  });

  it('LEGACY never draws prawn — the frozen control keeps the crab/lobster pair', () => {
    const s = clawSeats(M2({ prawn: 20, lobster: 1 }), 'legacy', 0.9);
    expect(s).toHaveLength(1);
    expect(s[0].species).not.toBe('prawn');
    expect(s[0].sizeF).toBeCloseTo(0.5 + 0.5 * 0.9, 6);
  });
});

/* ── 翼 wing variants (G4 round 2): 雞 flutter vs 鴨鵝 glide ──────────────────
   Ported from the lab v7 endpoints; detector is G3's sub.air. The load-bearing
   property: EQUAL MIX IS EXACTLY NEUTRAL — undifferentiated air renders the
   generic fan byte-for-byte, and legacy is pinned neutral whatever the data. */
import { wingShape, wingFlapAngle } from '../src/lib/creatureForm';

describe('wingShape — the 雞/鴨鵝 blend', () => {
  const NEUTRAL = {
    lenMul: 1, widthMul: 1, spreadMul: 1, baseAng: -0.32, humpMul: 1, countMul: 1,
    speciesK: 0,
  };

  it('legacy is neutral REGARDLESS of the bag — the frozen control grows no variants', () => {
    expect(wingShape({ chicken: 30 }, 'legacy')).toEqual(NEUTRAL);
    expect(wingShape({ duck_goose: 30 }, 'legacy')).toEqual(NEUTRAL);
  });

  it('no lived sub.air is neutral in metabolism too — fail closed to the generic fan', () => {
    expect(wingShape(undefined, 'metabolism')).toEqual(NEUTRAL);
    expect(wingShape({}, 'metabolism')).toEqual(NEUTRAL);
    expect(wingShape({ chicken: 5, duck_goose: 5 }, 'metabolism')).toEqual(NEUTRAL);
  });

  it('pure 雞: short-vs-long SHAPE still holds, wide flutter, raised', () => {
    const w = wingShape({ chicken: 10 }, 'metabolism');
    const g = wingShape({ duck_goose: 10 }, 'metabolism');
    expect(w.lenMul).toBeLessThan(g.lenMul);
    expect(w.spreadMul).toBeCloseTo(1.5, 6);
    expect(w.baseAng).toBeLessThan(-0.55);
  });

  it('pure 鴨鵝: long, thin, tight sweep, flattened toward glide — UNCHANGED by any 雞 dial', () => {
    // the goose endpoint must read exactly the plain blend on every axis
    // except its OWN thickness dial (chickenBoost is clamped to k>=0 only,
    // so it is 0 here by construction; gooseBoost supplies the +20% instead)
    const w = wingShape({ duck_goose: 10 }, 'metabolism');
    expect(w.lenMul).toBeCloseTo(1.35, 6);
    expect(w.widthMul).toBeCloseTo(0.7 * 1.2, 6);
    expect(w.spreadMul).toBeCloseTo(0.5, 6);
    expect(w.baseAng).toBeGreaterThan(-0.1);
    expect(w.humpMul).toBeCloseTo(0.7, 6); // no curvature dial on this side
    expect(w.countMul).toBeCloseTo(1, 6);
  });

  it("the owner's real bag reads chicken-side, continuously", () => {
    const w = wingShape({ chicken: 4.68, duck_goose: 1.10 }, 'metabolism');
    expect(w.lenMul).toBeLessThan(1); // still shorter than generic, unboosted
    expect(w.widthMul).toBeGreaterThan(1 + 0.3 * ((4.68 / 5.78) * 2 - 1)); // thickness dial live
  });

  /** Supersedes the earlier mass-boost round (reverted 2026-08-07). Owner, same
   *  session, next message: "same length, width, and stroke count. just the
   *  stroke thickness increase, and more curved." Two independent one-sided
   *  dials now, thickness and curvature only — length/spread/count match the
   *  plain species blend exactly, with no chicken-specific scaling at all. */
  describe('thickness + curvature dials (owner correction, supersedes the mass boost)', () => {
    it('length, fan spread, and stroke count are UNCHANGED — exactly the plain blend', () => {
      const w = wingShape({ chicken: 10 }, 'metabolism');
      expect(w.lenMul).toBeCloseTo(0.65, 6);   // the plain blend value, no boost
      expect(w.spreadMul).toBeCloseTo(1.5, 6); // untouched, as always
      expect(w.countMul).toBeCloseTo(1, 6);    // flat 1 now — no species variation
    });

    it('pure 雞 gets +40% curvature and a STACKED thickness (1.4x then another 1.5x)', () => {
      const w = wingShape({ chicken: 10 }, 'metabolism');
      // plain blend at k=1: widthMul 1.3, humpMul 1.3. Thickness carries TWO
      // multiplicative passes (owner: "increase stroke thickness by another
      // 50%", read as stacked on the existing +40%) — curvature is untouched
      // by this round and stays at the single +40% dial.
      expect(w.widthMul).toBeCloseTo(1.3 * 1.4 * 1.5, 6);
      expect(w.humpMul).toBeCloseTo(1.3 * 1.4, 6);
    });

    it('the stacked thickness dial is ONE-SIDED: any 鴨鵝-leaning mix gets exactly zero 雞 boost', () => {
      for (const mix of [{ duck_goose: 1 }, { chicken: 1, duck_goose: 3 }, { duck_goose: 100 }]) {
        const w = wingShape(mix, 'metabolism');
        const k = (mix.chicken ?? 0) / ((mix.chicken ?? 0) + mix.duck_goose) * 2 - 1;
        // widthMul on this side carries the GOOSE dial (below), not the 雞
        // stack — isolate it by dividing the goose dial back out.
        const gooseBoost = Math.max(0, -k);
        expect(w.widthMul / (1 + 0.2 * gooseBoost)).toBeCloseTo(1 + 0.3 * k, 6);
        expect(w.humpMul).toBeCloseTo(1 + 0.3 * k, 6); // no curvature dial on this side either
      }
    });

    it('ramps continuously from the neutral middle, never jumps', () => {
      const shares = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(ck =>
        wingShape({ chicken: ck, duck_goose: 1 - ck }, 'metabolism').widthMul);
      for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThan(shares[i - 1]);
      expect(shares[0]).toBeCloseTo(1, 6);                    // 50/50 = neutral = k≈0 = no boost
      expect(shares[shares.length - 1]).toBeCloseTo(1.3 * 1.4 * 1.5, 6); // pure 雞 = full stack
    });

    it('angle carries no dial — only thickness (width) and curvature (hump) move', () => {
      const w = wingShape({ chicken: 10 }, 'metabolism');
      expect(w.baseAng).toBeCloseTo(-0.6, 6); // the plain blend's raised angle, untouched
    });
  });

  /** Owner, same session, next message: "duck / goose stroke thickness
   *  increase by 20%." Mirrors 雞's thickness dial on the opposite side —
   *  thickness only, no curvature dial requested for 鴨鵝. */
  describe('鴨鵝 thickness dial (mirrors the 雞 dial, opposite side)', () => {
    it('pure 鴨鵝 gets exactly +20% thickness, curvature untouched', () => {
      const w = wingShape({ duck_goose: 10 }, 'metabolism');
      // plain blend at k=-1: widthMul 0.7, humpMul 0.7 — only width picks up the dial
      expect(w.widthMul).toBeCloseTo(0.7 * 1.2, 6);
      expect(w.humpMul).toBeCloseTo(0.7, 6);
    });

    it('is ONE-SIDED: any 雞-leaning mix (including neutral) gets exactly zero goose boost', () => {
      for (const mix of [{ chicken: 1 }, { chicken: 3, duck_goose: 1 }, { chicken: 1, duck_goose: 1 }]) {
        const w = wingShape(mix, 'metabolism');
        const k = (mix.chicken ?? 0) / ((mix.chicken ?? 0) + (mix.duck_goose ?? 0)) * 2 - 1;
        const chickenBoost = Math.max(0, k);
        const thicknessMul = (1 + 0.4 * chickenBoost) * (1 + 0.5 * chickenBoost);
        expect(w.widthMul).toBeCloseTo((1 + 0.3 * k) * thicknessMul, 6); // no goose dial anywhere on this side
      }
    });

    it('ramps continuously from the neutral middle toward pure 鴨鵝, never jumps', () => {
      const shares = [0.5, 0.4, 0.3, 0.2, 0.1, 0.0].map(ck =>
        wingShape({ chicken: ck, duck_goose: 1 - ck }, 'metabolism').widthMul);
      for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeLessThan(shares[i - 1]);
      expect(shares[0]).toBeCloseTo(1, 6);                 // 50/50 = neutral = k≈0 = no boost
      expect(shares[shares.length - 1]).toBeCloseTo(0.7 * 1.2, 6); // pure 鴨鵝 = full goose boost
    });
  });

  it('speciesK carries the raw blend for wingFlapAngle — 0 at neutral/legacy, ±1 at the pure endpoints', () => {
    expect(wingShape(undefined, 'metabolism').speciesK).toBe(0);
    expect(wingShape({ chicken: 5, duck_goose: 5 }, 'metabolism').speciesK).toBeCloseTo(0, 6);
    expect(wingShape({ chicken: 30 }, 'legacy').speciesK).toBe(0); // legacy is always NEUTRAL
    expect(wingShape({ chicken: 10 }, 'metabolism').speciesK).toBeCloseTo(1, 6);
    expect(wingShape({ duck_goose: 10 }, 'metabolism').speciesK).toBeCloseTo(-1, 6);
  });
});

/** Owner, on the wing bench, after the shape/thickness dials settled — not a
 *  number this time but a described RHYTHM: "chicken should be flap flap
 *  flap.....pause... then flap flap flap in loop" / "goose duck should be
 *  flap flap.....flappppp.....gliding.....then flap......gliding.....then
 *  loop." Supersedes the same-session flapFreqMul/flapAmpMul dial (a plain
 *  frequency/amplitude scale on one continuous sine can't produce a
 *  pause-then-burst rhythm) rather than adding to it — WingShape.speciesK
 *  replaces those two fields, and this pure function owns the waveform.
 *  Owner verifies the feel live on /dev-wings; these tests pin the
 *  STRUCTURE (exact stillness during declared pause/glide windows,
 *  periodicity, boundedness, and the k=0 fallback to the untouched original
 *  single sine) rather than a "looks right" claim no unit test can make. */
describe('wingFlapAngle — the burst-pause (雞) / burst-glide (鴨鵝) rhythm', () => {
  it('k=0 (neutral) is EXACTLY the original single sine, unchanged', () => {
    for (const t of [0, 137, 500, 1250, 3000, 9999]) {
      expect(wingFlapAngle(0, t)).toBeCloseTo(0.13 * Math.sin(t * 0.0013), 10);
    }
  });

  it('pure 雞 (k=1): held EXACTLY still during the declared pause window', () => {
    // period 1600ms, burst fills [0,700), pause is [700,1600)
    for (const t of [750, 900, 1100, 1300, 1599, 1600 + 750, 3 * 1600 + 1000]) {
      expect(wingFlapAngle(1, t)).toBe(0);
    }
  });

  it('pure 雞 (k=1): nonzero and bounded during the burst window', () => {
    for (const t of [50, 150, 300, 450, 650]) {
      const v = wingFlapAngle(1, t);
      expect(Math.abs(v)).toBeGreaterThan(0);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.13 * 1.1 + 1e-9);
    }
  });

  it('pure 鴨鵝 (k=-1): held EXACTLY still during both declared glide windows', () => {
    // period 4200ms: ramp [0,900), glide1 [900,2300), flap2 [2300,2700), glide2 [2700,4200)
    for (const t of [1000, 1800, 2299, 2800, 3500, 4199, 4200 + 1500]) {
      expect(wingFlapAngle(-1, t)).toBe(0);
    }
  });

  it('pure 鴨鵝 (k=-1): nonzero and bounded during both flap windows', () => {
    for (const t of [100, 400, 700, 2350, 2600, 2650]) {
      const v = wingFlapAngle(-1, t);
      expect(Math.abs(v)).toBeGreaterThan(0);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.13 * 1.4 + 1e-9);
    }
  });

  it('is periodic — each species repeats its own declared period exactly', () => {
    for (const t of [0, 233, 811, 1599]) {
      expect(wingFlapAngle(1, t)).toBeCloseTo(wingFlapAngle(1, t + 1600), 10);
    }
    for (const t of [0, 500, 2100, 4199]) {
      expect(wingFlapAngle(-1, t)).toBeCloseTo(wingFlapAngle(-1, t + 4200), 10);
    }
  });

  it('never produces NaN or runs away, across the whole k range', () => {
    for (let k = -1; k <= 1; k += 0.25) {
      for (const t of [0, 1, 500, 1234, 5000, 10000]) {
        const v = wingFlapAngle(k, t);
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(0.13 * 1.5); // generous ceiling above every dial's peak
      }
    }
  });
});
