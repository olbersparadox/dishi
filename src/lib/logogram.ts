/* 銘 · the logogram — the taste vector WRITTEN rather than plotted.
   Lab v3 (docs/rnd/mokling-framework.md, register 銘), ported 2026-08-05.

   A rough ink ring where each of the 18 dims keeps its compass seat:
     outward strokes = love, inward = dislike,
     stroke count    = evidence,
     silence         = fog.

   It shares its compass with the creature and the blob — `dimAngle(i)`, one
   helper, not a copy — so a dim means one thing in every register of the being.

   This REPLACED the radar polygon outright (owner, 2026-08-05) rather than
   sitting behind it. What the polygon structurally could not say is FOG: a
   radar maps -1..1 onto a radius, so an unrated dim plots at mid-radius,
   indistinguishable from a measured neutral, and the chart asserts a reading
   it never had. Here evidence IS the ink — an unlearned dim simply has nothing
   written at its seat, which is the honesty contract the blob and the creature
   already keep (only mouth-data draws; fog contributes nothing).

   Geometry only: no colour, no DOM. The caller supplies tokens and renders. */
import { DIMS, type TasteVector, type EvidenceMap } from './taste';
import { dimAngle, seededRandom, KNOWS_AT } from './blobForm';

const TAU = Math.PI * 2;

/** One pass of the ring's loaded brush. Carries no phase: the ring is the
 *  body of the figure and breathes as a whole, not as a travelling wave. */
export type MingRingPass = { d: string; opacity: number; width: number };

export type MingStroke = MingRingPass & {
  /** 0..1 position around the ring, starting at the top seat. Becomes an
   *  animation delay, so the sway TRAVELS around the circle like wind crossing
   *  a field rather than every strand swinging in unison. */
  phase: number;
  /** The strand's root on the ring. The renderer pivots the strand about this
   *  point, so the tip sways and the root never moves — which is the whole
   *  safety property: a strand stays at its compass seat, and a seat IS the
   *  dim's identity. Rotating the FIGURE would be a lie (it would read as
   *  someone else's palate); rotating a strand about its own root is hair. */
  rootX: number;
  rootY: number;
  /** Sway amplitude in degrees, seeded per strand so a head of hair doesn't
   *  move as one rigid sheet. Unsigned — every strand leans the same way at a
   *  given phase, because wind is coherent; the travel comes from `phase`. */
  sway: number;
};
export type MingDot = { cx: number; cy: number; r: number; opacity: number };
export type MingBlotch = { cx: number; cy: number; rx: number; ry: number; rot: number };

export type Ming = {
  /** Overlapping jittered passes that read as one loaded brush. */
  ring: MingRingPass[];
  strokes: MingStroke[];
  specks: MingDot[];
  blotches: MingBlotch[];
  /** Furthest radius any ink reaches. The caller places labels beyond THIS
   *  rather than a guessed constant, so a loud profile can't collide with its
   *  own labels and a quiet one doesn't sit in a ring of dead space. */
  extent: number;
};

/** A dim writes nothing below this — a preference this small is the engine
 *  hedging, not an opinion, and the 銘 only writes opinions. */
const SPEAKS_AT = 0.05;

/* Reach is expressed as a fraction of the ring radius, so the figure scales as
 * one object. Much shorter than the lab's 0.5: the lab strip had no labels to
 * clear, and long thin strokes read as fur rather than as writing. Short and
 * heavy is the calligraphic register; long and fine is the creature's coat,
 * which this must never be mistaken for. */
const REACH_BASE = 0.10;
const REACH_GAIN = 0.30;
/** 仲摸緊 dims whisper — same 0.45 the lab settled on, and the same idea as
 *  blobForm's LEARNING_GAIN: below KNOWS_AT a dim is drawn, but faintly. */
const LEARNING_VOICE = 0.45;

/** Strokes per seat. Tiers, not the lab's linear `round(e/2)`: real evidence
 *  runs 1..70+ (the owner's live profile has fourteen dims past 12 ratings), so
 *  a linear count pinned every mature seat to the cap and the number stopped
 *  saying anything — 18 seats × 6 identical marks read as a fringe. Tiers keep
 *  "just learned" visibly lighter than "known cold" across the whole real
 *  range, and the lower cap keeps a fully-learned palate legible as writing. */
function strokeCount(e: number): number {
  if (e < KNOWS_AT) return 1;   // 仲摸緊 — one whisper
  if (e < 6) return 2;
  if (e < 16) return 3;
  return 4;
}

/**
 * Build the 銘 for one profile. `ringR` is the shared rim: pass the radar's own
 * chart radius and the two drawings land on one circle.
 *
 * Deterministic in `seed` — the same profile version always writes the same
 * hand. (Re-rating changes the vector, which changes the version, which changes
 * the seed: the hand is allowed to move when the palate does, never otherwise.)
 */
export function buildMing(
  vector: TasteVector,
  evidence: EvidenceMap,
  seed: string,
  size: number,
  ringR: number,
): Ming {
  const rnd = seededRandom('logo:' + seed);
  const c = size / 2;
  const ring: MingRingPass[] = [];
  const strokes: MingStroke[] = [];
  const specks: MingDot[] = [];
  const blotches: MingBlotch[] = [];
  let extent = ringR;

  // The ring itself: three jittered passes, each thinner and darker than the
  // last. Drawn before any dim so the wobble is identical for every profile of
  // the same seed regardless of how much is written on it.
  for (let pass = 0; pass < 3; pass++) {
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const th = (i / 72) * TAU;
      const r = ringR * (1 + (rnd() - 0.5) * 0.035);
      pts.push(`${(c + Math.cos(th) * r).toFixed(2)},${(c + Math.sin(th) * r).toFixed(2)}`);
    }
    ring.push({
      d: `M${pts.join('L')}Z`,
      opacity: 0.2 + 0.12 * pass,
      width: size * (0.02 - 0.005 * pass),
    });
  }

  for (let d = 0; d < DIMS.length; d++) {
    const dim = DIMS[d];
    const e = evidence[dim] ?? 0;
    if (!e) continue;                                  // fog stays silent
    const pref = vector[dim] ?? 0;
    if (Math.abs(pref) < SPEAKS_AT) continue;

    const ang = dimAngle(d);
    const known = e >= KNOWS_AT;
    const nS = strokeCount(e);
    const voice = known ? 1 : LEARNING_VOICE;
    const L = ringR * (REACH_BASE + REACH_GAIN * Math.abs(pref)) * voice;
    const dir = pref > 0 ? 1 : -1;                     // love reaches out, dislike bites in

    for (let k = 0; k < nS; k++) {
      // Wider angular spread and a wider length spread than the lab's, so the
      // marks at one seat fan like a written radical instead of combing.
      const ja = ang + (rnd() - 0.5) * 0.30;
      const r0 = ringR * (1 + (rnd() - 0.5) * 0.03);
      const L2 = L * (0.5 + rnd() * 0.85);
      const x0 = c + Math.cos(ja) * r0, y0 = c + Math.sin(ja) * r0;
      const rEnd = r0 + dir * L2;
      const x1 = c + Math.cos(ja) * rEnd, y1 = c + Math.sin(ja) * rEnd;
      // Sideways bow off the radius: a brush pulled by a wrist, not a spoke
      // struck from the centre. SIGNED and seeded per strand, so strands curl
      // both ways. The lab used a fixed `0.06 * dir`, which gave every strand
      // in the figure the same handedness — read as a combed, machine-set
      // fringe rather than a hand that moved differently each stroke.
      const bow = (rnd() - 0.5) * 0.36;
      const qx = c + Math.cos(ja + bow) * (r0 + dir * L2 * 0.55);
      const qy = c + Math.sin(ja + bow) * (r0 + dir * L2 * 0.55);
      strokes.push({
        d: `M${x0.toFixed(2)},${y0.toFixed(2)}Q${qx.toFixed(2)},${qy.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`,
        opacity: (0.3 + 0.5 * Math.abs(pref)) * voice,
        width: Math.max(1, size * 0.014 * (1 - 0.14 * k)),
        // Measured from the strand's own angle, not its seat's, so strands
        // within one seat move in sequence rather than as a block.
        phase: (((ja + Math.PI / 2) % TAU) + TAU) % TAU / TAU,
        rootX: x0,
        rootY: y0,
        // Longer strands sway further at the tip from the same rotation, so
        // amplitude is trimmed as reach grows — otherwise a strongly-loved dim
        // whips while a faint one barely stirs, and motion would end up
        // encoding preference, which is the honesty line: motion carries NO
        // data. It layers on top of the reading and never adds to it.
        // Degrees, not pixels — and a strand is SHORT (10-30px at production
        // size), so small angles buy almost no travel. Measured on the live
        // figure: 2.5° moved a tip 0.8px and 5° moved it ~2px, both invisible.
        // These land tip travel around 5-8px over a full cycle, which is what
        // finally reads as a draught rather than as nothing happening.
        sway: (9 + rnd() * 5) * (1 - 0.35 * (L2 / (ringR * (REACH_BASE + REACH_GAIN)))),
      });
      if (dir > 0) extent = Math.max(extent, rEnd);
    }

    // A smoky wash at seats the engine both knows well and feels strongly
    // about — breath on the ring, marking where this palate is most itself.
    if (known && Math.abs(pref) > 0.3) {
      blotches.push({
        cx: c + Math.cos(ang) * ringR,
        cy: c + Math.sin(ang) * ringR,
        rx: size * 0.04 + size * 0.024 * Math.abs(pref),
        ry: size * 0.022,
        rot: (ang * 180) / Math.PI,
      });
    }

    // Spatter. Makes it a hand rather than a diagram, and it is still honest —
    // the count is bounded by evidence, so a thin dim cannot look busy.
    for (let sp = 0; sp < Math.min(4, e); sp++) {
      const sa = ang + (rnd() - 0.5) * 0.4;
      const sr = ringR * (1 + dir * (0.1 + rnd() * 0.3) * Math.abs(pref));
      specks.push({
        cx: c + Math.cos(sa) * sr,
        cy: c + Math.sin(sa) * sr,
        r: size * 0.0035 + rnd() * size * 0.0045,
        opacity: 0.15 + rnd() * 0.3,
      });
      if (dir > 0) extent = Math.max(extent, sr);
    }
  }

  return { ring, strokes, specks, blotches, extent };
}
