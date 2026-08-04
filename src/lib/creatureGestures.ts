/* 墨靈 limb gestures — the 甲殼 (crustacean) claw vocabulary, register 骨.
   Built and calibrated against the owner's reference + tracings, 2026-08-04.
   Rules and the failure history live in docs/rnd/mokling-framework.md
   ("Claw implementation rules"). The short version:

   - A claw PINCHES. Palm and fixed finger are ONE rigid mass; only the dactyl
     rotates, about a single hinge. Both halves fanning apart from the wrist is
     a leaf flapping, not a claw — no parameter can fix that, it is topology.
   - The two triangles CROSS at the wrist, so the union is one solid mass and
     the slot opens only where a real claw's fingers begin (~45% out).
   - A left-flank limb MIRRORS the right (negate the cross-axis); rotating the
     frame instead flips the jaws vertically.
   - Motion is layered on top of static geometry and never changes identity —
     the same honesty contract the blob has. */

type Pt = { x: number; y: number };

export type ClawMotion = { pinch: number; grip: number; sway: number };
export type ClawSpecies = 'lobster' | 'crab';

/** Per-corner rounding. It has to be per corner: the achievable radius at a
    corner is t·tan(θ/2), so one number buys a fifth of the rounding at a 25°
    tip that it buys at a blunt corner. The cap is on the tangent length, not
    the radius — a fixed radius on an acute apex eats the whole shape. */
function roundedTri(ctx: CanvasRenderingContext2D, pts: Pt[], rads: number[]) {
  const n = 3;
  const C: { a: Pt; b: Pt; c: Pt }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const u1 = { x: (p0.x - p1.x) / l1, y: (p0.y - p1.y) / l1 };
    const u2 = { x: (p2.x - p1.x) / l2, y: (p2.y - p1.y) / l2 };
    const ang = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
    let t = rads[i] / Math.tan(Math.max(0.06, ang / 2));
    t = Math.min(t, Math.min(l1, l2) * 0.68);
    C.push({
      a: { x: p1.x + u1.x * t, y: p1.y + u1.y * t },
      b: { x: p1.x + u2.x * t, y: p1.y + u2.y * t },
      c: p1,
    });
  }
  ctx.beginPath();
  ctx.moveTo(C[0].b.x, C[0].b.y);
  for (let i = 1; i <= n; i++) {
    const q = C[i % n];
    ctx.lineTo(q.a.x, q.a.y);
    ctx.quadraticCurveTo(q.c.x, q.c.y, q.b.x, q.b.y);
  }
  ctx.closePath();
  ctx.fill();
}

function curvedTaper(ctx: CanvasRenderingContext2D, p0: Pt, p1: Pt, p2: Pt, w0: number, w1: number) {
  const N = 18;
  const A: Pt[] = [], B: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const m = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * t) * 0.5;
    A.push({ x: x - (dy / m) * w, y: y + (dx / m) * w });
    B.push({ x: x + (dy / m) * w, y: y - (dx / m) * w });
  }
  ctx.beginPath();
  ctx.moveTo(A[0].x, A[0].y);
  for (let i = 1; i <= N; i++) ctx.lineTo(A[i].x, A[i].y);
  for (let i = N; i >= 0; i--) ctx.lineTo(B[i].x, B[i].y);
  ctx.closePath();
  ctx.fill();
}

/** Local frame for a limb leaving the body at `ang`. `mir` is the whole
    left-flank rule in one line: mirror the cross-axis, never rotate. */
function frame(bx: number, by: number, ang: number) {
  const yk = 0.86;
  const ca = Math.cos(ang), sa = Math.sin(ang) * yk;
  const axis = Math.atan2(sa, ca);
  const c = Math.cos(axis), s = Math.sin(axis);
  const mir = ca < 0 ? -1 : 1;
  return (u: number, v: number): Pt => {
    const w = v * mir;
    return { x: bx + c * u - s * w, y: by + s * u + c * w };
  };
}

/* Vertex triples in claw-local units (u along the axis from the wrist, v across,
   + is the lower side). Read off the owner's tracing; see the framework doc.
   len .84 rather than the measured .72 because rounding a sharp tip cuts it
   back — blunter prongs are a shorter claw, and the length has to pay for it. */
const LOB = {
  len: 0.84,
  radBig: [0.05, 0.09, 0.20],
  radSml: [0.04, 0.07, 0.16],
  big: [[-0.05, 0.06], [0.30, -0.28], [1.00, -0.03]] as const,
  sml: [[0.03, 0.01], [0.24, 0.26], [0.82, 0.10]] as const,
};

/** 龍蝦 · lobster claw. */
export function drawLobsterClaw(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, ang: number,
  R: number, scale: number, m: ClawMotion, ink: string,
) {
  const L = R * LOB.len * scale;
  const P = frame(bx, by, ang);
  ctx.fillStyle = ink;

  // 螯 · palm + fixed finger: one rigid piece. It never moves.
  roundedTri(ctx, LOB.big.map(p => P(L * p[0], L * p[1])), LOB.radBig.map(r => L * r));

  // 指 · the dactyl, hinged at its own wrist vertex. Rotating about the hinge
  // (rather than translating the tip) also keeps the wrist overlap intact at
  // every angle, so the claw cannot come apart mid-snap.
  const [h, ...rest] = LOB.sml;
  const phi = m.pinch;
  const swing = (p: readonly [number, number]) => {
    const du = p[0] - h[0], dv = p[1] - h[1];
    return P(
      L * (h[0] + du * Math.cos(phi) - dv * Math.sin(phi)),
      L * (h[1] + du * Math.sin(phi) + dv * Math.cos(phi)),
    );
  };
  roundedTri(ctx, [P(L * h[0], L * h[1]), ...rest.map(swing)], LOB.radSml.map(r => L * r));
}

const CRAB = { len: 0.60, palm: 0.54, palmW: 0.46, fing: 0.46 };

/** 蟹 · crab claw: broad palm, rigid upper finger, hinged lower one. */
export function drawCrabClaw(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, ang: number,
  R: number, scale: number, m: ClawMotion, ink: string,
) {
  const L = R * CRAB.len * scale;
  const Lp = L * CRAB.palm, Wp = L * CRAB.palmW, Lf = L * CRAB.fing;
  const g = m.grip;
  const P = frame(bx, by, ang);
  ctx.fillStyle = ink;

  const a = P(0, -Wp * 0.16), d = P(0, Wp * 0.16);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const u1 = P(Lp * 0.42, -Wp * 0.44), u2 = P(Lp * 0.92, -Wp * 0.52), uE = P(Lp, -Wp * 0.36);
  ctx.bezierCurveTo(u1.x, u1.y, u2.x, u2.y, uE.x, uE.y);
  const e1 = P(Lp * 1.10, -Wp * 0.06), e2 = P(Lp * 1.08, Wp * 0.22), lE = P(Lp, Wp * 0.42);
  ctx.bezierCurveTo(e1.x, e1.y, e2.x, e2.y, lE.x, lE.y);
  const b1 = P(Lp * 0.88, Wp * 0.58), b2 = P(Lp * 0.38, Wp * 0.44);
  ctx.bezierCurveTo(b1.x, b1.y, b2.x, b2.y, d.x, d.y);
  ctx.closePath();
  ctx.fill();

  // fixed finger — rigid with the palm, so it takes no motion term at all
  curvedTaper(ctx, P(Lp * 0.94, -Wp * 0.30), P(Lp + Lf * 0.52, -Wp * 0.66),
    P(Lp + Lf, -Wp * 0.36), Wp * 0.44, Wp * 0.09);
  // movable finger — the only part that swings
  curvedTaper(ctx, P(Lp * 0.92, Wp * 0.34), P(Lp + Lf * 0.40, Wp * (0.16 + 0.34 * g)),
    P(Lp + Lf * 0.80, Wp * (-0.16 + 0.42 * g)), Wp * 0.38, Wp * 0.08);
}

const REST_OPEN = 0.17;   // radians the dactyl rests open at
const SNAP_MS = 235;      // one chop: shut + release
const CYCLE_MS = 7200;    // mostly quiet

function snapShut(s: number) {
  return s < 0.18 ? Math.pow(s / 0.18, 0.45)          // shut, fast
                  : Math.pow(1 - (s - 0.18) / 0.82, 1.8);  // release, slower
}

/** A claw doesn't chop continuously — it sits open, fires two or three fast
    snaps, and goes quiet (~90% of the cycle is rest). Each snap shuts in its
    first fifth and releases over the rest; a sine would give closing and
    opening equal time, which reads as waving. Sides take different snap counts
    and are offset, so a pair never chops in unison. */
export function clawMotion(t: number, side: number): ClawMotion {
  const snaps = side > 0 ? 3 : 2;
  const offset = side > 0 ? 0 : CYCLE_MS * 0.47;
  const ph = (t + offset) % CYCLE_MS;
  const shut = ph < snaps * SNAP_MS ? snapShut((ph % SNAP_MS) / SNAP_MS) : 0;
  const idle = 0.010 * Math.sin(t * 0.0006 + side * 2.1);  // barely-there breath at rest
  return {
    pinch: Math.max(0, REST_OPEN * (1 - shut) + idle * (1 - shut)),
    grip: 1 - shut,
    // the chop kicks the whole limb back a little — recoil sells the snap
    sway: 0.010 * Math.sin(t * 0.00041 + side * 2.6) - 0.020 * shut,
  };
}

/** Claw axis: ~41° below horizontal, measured off the reference. The wrist sits
    along this same direction, so a limb's attachment and its aim agree. */
export const CLAW_AXIS = 0.72;
/** Wrist depth as a fraction of the body's rim IN THE CLAW'S OWN DIRECTION.
    It must be the local rim, not a global half-extent: on a lumpy body the
    flank bulges past the bounding box, so a wrist placed off the bounding box
    ends up deep inside and the claw barely emerges (measured — reach collapsed
    to 9% of body width against the calibrated 40%). Same failure family as the
    framework's "bug that hid half the anatomy": when a feature is present in
    the data and absent on screen, suspect the geometry before the gate. */
const WRIST_K = 0.96;
/** Claw size per unit MEAN body radius. Keyed to the mean, not the local rim,
    so a lumpy silhouette cannot make one claw bigger than the other and swamp
    the deliberate 龍蝦 asymmetry. */
const R_K = 1.57;

/** Draw the claw PAIR on a body. This is the only entry point a renderer should
    use: asymmetry, flank placement, mirroring and the motion clock all live
    here, because every one of them is a way to get the gesture wrong by hand.
    (A port that passed the growth value as `scale` gave two equal claws and
    lost the lobster's defining big/small read.)

    `rimL`/`rimR` are the body's radius along each claw's own axis, and `bodyR`
    its mean radius. `growth` is 0..1 saturating evidence — a young node is a
    nub, not invisible. */
export function drawClawPair(ctx: CanvasRenderingContext2D, o: {
  cx: number; cy: number; bodyR: number; rimL: number; rimR: number;
  species: ClawSpecies; growth: number; t: number; ink: string;
}) {
  const g = Math.max(0, Math.min(1, o.growth));
  const size = 0.5 + 0.5 * g;
  // 龍蝦 is asymmetric — one oversized claw is the whole lobster read. 蟹 is 1:1.
  const [sL, sR] = o.species === 'lobster' ? [1.22, 0.82] : [1.0, 1.0];
  const R = o.bodyR * R_K;
  const draw = o.species === 'lobster' ? drawLobsterClaw : drawCrabClaw;
  const mL = clawMotion(o.t, -1), mR = clawMotion(o.t, 1);
  const c = Math.cos(CLAW_AXIS), s = Math.sin(CLAW_AXIS);
  draw(ctx, o.cx - c * o.rimL * WRIST_K, o.cy + s * o.rimL * WRIST_K,
    Math.PI - CLAW_AXIS + mL.sway, R, size * sL, mL, o.ink);
  draw(ctx, o.cx + c * o.rimR * WRIST_K, o.cy + s * o.rimR * WRIST_K,
    CLAW_AXIS + mR.sway, R, size * sR, mR, o.ink);
}
