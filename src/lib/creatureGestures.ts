/* 墨靈 limb gestures — procedural anatomy vocabulary for the taste creature.
   Each gesture is a class of appendages: claws, fins, fronds. They share one
   local frame (attachment point, axis angle) and draw at every relevant scale.
   Motion is always layered on top of static geometry, never changing identity.
   The limb-attachment rule: small accents hug the body silhouette; anything
   sprawling reads as broken. See docs/rnd/mokling-framework.md for the rules. */

/** Per-corner rounding for a triangle. On an acute corner the achievable
    radius is t·tan(θ/2), so the same number gives a fifth of the rounding at
    a blunt corner. Clamp each corner independently so tips can round at all. */
function roundedTri(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  rads: number | number[],
) {
  const n = 3;
  const C: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; c: { x: number; y: number } }> = [];
  for (let i = 0; i < n; i++) {
    const rad = Array.isArray(rads) ? rads[i] : rads;
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const u1 = { x: (p0.x - p1.x) / l1, y: (p0.y - p1.y) / l1 };
    const u2 = { x: (p2.x - p1.x) / l2, y: (p2.y - p1.y) / l2 };
    const ang = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
    let t = rad / Math.tan(Math.max(0.06, ang / 2));
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

/** 龍蝦 · lobster claw (deep node: 甲殼 → 龍蝦). Two rounded-corner triangles
    that cross at the wrist so the union is one solid mass; the dactyl (small
    triangle) hinges about its base, swinging 0–10° to pinch. The big triangle
    (palm + fixed finger) never moves. Reach ≈40% of body width; pair is 1:1.22 / 1.00.
    Motion: rests open, fires 2–3 fast snaps per ~7s cycle with asymmetric
    easing and small recoil. Sides offset so they never chop in unison. */
export function drawLobsterClaw(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  ang: number,
  R: number,
  f: number,
  scale: number,
  m: { pinch: number; sway: number },
) {
  const LOB = {
    len: 0.84,
    radBig: [0.05, 0.09, 0.2] as const,
    radSml: [0.04, 0.07, 0.16] as const,
    big: [[-0.05, 0.06], [0.3, -0.28], [1.0, -0.03]] as const,
    sml: [[0.03, 0.01], [0.24, 0.26], [0.82, 0.1]] as const,
  };

  const L = (R * LOB.len * f * scale) / 1.0;
  const yk = 0.86;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang) * yk;
  const axis = Math.atan2(sa, ca);
  const c = Math.cos(axis);
  const s = Math.sin(axis);
  const mir = ca < 0 ? -1 : 1;
  const P = (u: number, v: number) => {
    const w = v * mir;
    return { x: bx + c * u - s * w, y: by + s * u + c * w };
  };

  // Big triangle: palm + fixed finger, never moves.
  const bigPts = LOB.big.map(p => P(L * p[0], L * p[1]));
  roundedTri(ctx, bigPts, LOB.radBig.map(r => L * r));

  // Small triangle: dactyl, hinges at its own wrist vertex.
  const [h, ...rest] = LOB.sml;
  const hinge = P(L * h[0], L * h[1]);
  const φ = m.pinch || 0;
  const swing = (p: readonly [number, number]) => {
    const du = p[0] - h[0];
    const dv = p[1] - h[1];
    return P(
      L * (h[0] + du * Math.cos(φ) - dv * Math.sin(φ)),
      L * (h[1] + du * Math.sin(φ) + dv * Math.cos(φ)),
    );
  };
  const smlPts = [hinge, ...rest.map(swing)];
  roundedTri(ctx, smlPts, LOB.radSml.map(r => L * r));
}

/** 蟹 · crab claw (depth 2: 甲殼 → 蟹). Palm + two moving fingers: fixed upper
    (rigid with the palm) and a lower dactyl that hinges to pinch. Reach ≈60% body width,
    1:1 pair (same on both sides). Motion: same cycle as lobster, 0–1 grip scale. */
export function drawCrabClaw(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  ang: number,
  R: number,
  f: number,
  scale: number,
  m: { grip: number; sway: number },
) {
  const CRAB = {
    len: 0.6,
    palm: 0.54,
    palmW: 0.46,
    fing: 0.46,
    gape: 1.0,
  };
  const L = R * CRAB.len * f * scale;
  const Lp = L * CRAB.palm;
  const Wp = L * CRAB.palmW;
  const Lf = L * CRAB.fing;
  const g = (m?.grip !== undefined ? m.grip : 0.5);
  const yk = 0.86;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang) * yk;
  const axis = Math.atan2(sa, ca);
  const c = Math.cos(axis);
  const s = Math.sin(axis);
  const mir = ca < 0 ? -1 : 1;
  const P = (u: number, v: number) => {
    const w = v * mir;
    return { x: bx + c * u - s * w, y: by + s * u + c * w };
  };

  ctx.fillStyle = 'currentColor';

  // Palm outline.
  const a = P(0, -Wp * 0.16);
  const d = P(0, Wp * 0.16);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  let u1 = P(Lp * 0.42, -Wp * 0.44);
  let u2 = P(Lp * 0.92, -Wp * 0.52);
  let uE = P(Lp, -Wp * 0.36);
  ctx.bezierCurveTo(u1.x, u1.y, u2.x, u2.y, uE.x, uE.y);
  let e1 = P(Lp * 1.1, -Wp * 0.06);
  let e2 = P(Lp * 1.08, Wp * 0.22);
  let lE = P(Lp, Wp * 0.42);
  ctx.bezierCurveTo(e1.x, e1.y, e2.x, e2.y, lE.x, lE.y);
  let b1 = P(Lp * 0.88, Wp * 0.58);
  let b2 = P(Lp * 0.38, Wp * 0.44);
  ctx.bezierCurveTo(b1.x, b1.y, b2.x, b2.y, d.x, d.y);
  ctx.closePath();
  ctx.fill();

  // Fixed upper finger (rigid, no motion).
  const f0 = P(Lp * 0.94, -Wp * 0.3);
  const f1 = P(Lp + Lf * 0.52, -Wp * 0.66);
  const f2 = P(Lp + Lf, -Wp * 0.36);
  curvedTaper(ctx, f0, f1, f2, Wp * 0.44, Wp * 0.09);

  // Movable lower finger (only this one swings).
  const m0 = P(Lp * 0.92, Wp * 0.34);
  const m1 = P(Lp + Lf * 0.4, Wp * (0.16 + 0.34 * g));
  const m2 = P(Lp + Lf * 0.8, Wp * (-0.16 + 0.42 * g));
  curvedTaper(ctx, m0, m1, m2, Wp * 0.38, Wp * 0.08);
}

function curvedTaper(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  w0: number,
  w1: number,
) {
  const N = 18;
  const A: { x: number; y: number }[] = [];
  const B: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const m = Math.hypot(dx, dy) || 1;
    const w = ((w0 + (w1 - w0) * t) * 0.5);
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

const REST_OPEN = 0.17; // radians the dactyl rests open at
const SNAP_MS = 235; // one chop: shut + release
const CYCLE_MS = 7200; // mostly quiet

function snapShut(s: number): number {
  return s < 0.18 ? Math.pow(s / 0.18, 0.45) : Math.pow(1 - (s - 0.18) / 0.82, 1.8);
}

/** Claw motion: the creature rests open, fires 2–3 fast snaps per ~7s cycle.
    Sides offset so they never chop in unison. */
export function clawMotion(t: number, side: number) {
  const snaps = side > 0 ? 3 : 2;
  const offset = side > 0 ? 0 : CYCLE_MS * 0.47;
  const ph = (t + offset) % CYCLE_MS;
  const burst = snaps * SNAP_MS;
  const shut = ph < burst ? snapShut((ph % SNAP_MS) / SNAP_MS) : 0;
  const idle = 0.01 * Math.sin(t * 0.0006 + side * 2.1);

  return {
    pinch: Math.max(0, REST_OPEN * (1 - shut) + idle * (1 - shut)),
    grip: 1 - shut,
    sway: 0.01 * Math.sin(t * 0.00041 + side * 2.6) - 0.02 * shut,
  };
}
