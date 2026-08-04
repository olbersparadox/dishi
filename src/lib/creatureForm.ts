// 墨靈 creature renderer — the taste form grown into an ink lifeform.
// This is a NEW VERSION OF THE BLOB, not a second being (owner, 2026-08-04):
// the body starts from the blob's own taste-lobe silhouette (sampleForm — the
// 18-dim identity, lobes/dents/fog and all) and DOMAIN anatomy layers on top.
// With zero domain evidence every modulation vanishes and the caller keeps
// rendering today's blob — additive-only, fails closed to current behaviour.
//
// The drawing itself is the v6 lab body, restored at the owner's direction
// (2026-08-02: "go back to this version and get things fine tuned one by one")
// and ported from the R&D artifact. Owner-decided rules carried over verbatim:
// no universal highlight ellipse (surface is decided by SKIN TYPE), no spine
// (read as a seam, deleted), no faces yet (眼/口 are late, rare, earned), and
// every appendage gates on SHARE and an absolute evidence FLOOR — both gates,
// always (one stray prawn dish must not give a carnivore claws, and two veg
// dishes out of five must not read as a garden).
//
// Honesty contract, unchanged from the blob: only mouth-data feeds the being;
// the seed decides micro-texture only; motion is layered on top of the grown
// geometry and never changes identity.
//
// PRODUCTION STATUS: nothing passes `domains` yet. The per-user domain
// aggregate (ship path step 2, docs/rnd/mokling-framework.md) does not exist,
// and inventing a field for it is how the sea_crustacean bug happened. The
// untracked /dev-creature harness drives this by hand. Before production:
// the snapshot renderer must learn the same anatomy (two-renderer contract).

import {
  sampleForm, growth, seededRandom, fogExtent, dimAngle, type FormInputs,
} from './blobForm';
import { DIMS } from './taste';
import {
  drawLobsterClaw, drawCrabClaw, clawMotion, CLAW_AXIS, type ClawSpecies,
} from './creatureGestures';
import { svgContext } from './canvasToSvg';

const TAU = Math.PI * 2;

/* ── the domain record: what ship-path step 2 must produce ──────────────────
   Each number is liking-weighted evidence (per event: 0.5 + max(0, flick) —
   exposure counts, liking amplifies; you become what you keep coming back to).
   Recency-weighted upstream per the metabolism rules; this module only reads. */
export type DomainEvidence = {
  sea?: number; land?: number; air?: number; shell?: number;
  field?: number; algae?: number; fungus?: number;
  /** Sub-node mixes for typed limbs — the detail that makes a being someone's.
      Absent → equal mix (the lab default). */
  sub?: {
    shell?: { lobster?: number; crab?: number; prawn?: number };
    land?: { beef?: number; pork?: number; chicken?: number };
  };
};

const DOMAIN_KEYS = ['sea', 'land', 'air', 'shell', 'field', 'algae', 'fungus'] as const;

/** The caller's gate: with no lived domain evidence there is no creature —
    the blob renders, byte-for-byte as today. */
export function hasAnatomy(domains: DomainEvidence | undefined): domains is DomainEvidence {
  if (!domains) return false;
  return DOMAIN_KEYS.some(k => (domains[k] ?? 0) > 0);
}

const smooth01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * 風 · how far a single hair bends, in radians.
 *
 * A gust vector sweeps across the body (~1.3 wavelengths, swelling and lulling
 * on a slower cycle) and each hair bends by the component of it PERPENDICULAR
 * to itself — the cross product. So a hair pointing into the wind barely moves
 * while a broadside one bends most, and the coat ripples instead of swinging as
 * one rigid mass. A travelling ripple is also far easier to see than uniform
 * jitter, which is what lets the amplitude stay genuinely subtle.
 *
 * Pure and exported so the motion is testable WITHOUT a compositor: rAF is
 * paused whenever the preview pane is hidden, which makes pixel-sampling a live
 * canvas an unreliable way to prove that anything is moving (it reports a
 * perfectly still creature either way).
 *
 * @param nx,ny   the hair's outward unit direction
 * @param offsetX the hair's horizontal offset from body centre (the gust travels)
 */
export function hairWindBend(nx: number, ny: number, offsetX: number, R: number, t: number): number {
  // The lull floor is deliberately high: at 0.10 the coat sat near-motionless
  // for seconds at a time, which reads as no animation at all if you happen to
  // look then (owner, 2026-08-04: "don't see animation or too subtle").
  const swell = 0.62 + 0.38 * Math.sin(t * 0.00029); // gusts, never fully still
  const g = swell * Math.sin(t * 0.0015 - (offsetX / (R * 2.2)) * 4.2);
  // Amplitude is what a hair can actually SHOW: a strand is only a few px long,
  // so a 20° lean moves its tip by ~2px and vanishes. Real fur lays right over
  // in a gust, so the peak lean is large — but only for hairs fully broadside,
  // only at peak swell, and only where the travelling wave currently is.
  return 0.8 * g * (0.3 * nx - ny); // cross(hair, wind), wind ≈ (g, .3g)
}

/**
 * 毛 · stroke width, spacing and length for the coat at a given render size.
 *
 * Below ~170px the coat has to stop competing with the anatomy underneath it —
 * at small sizes a 3px stroke with proportional length swallows the legs
 * (owner, 2026-08-04). Thickness is the single lever: because the spacing and
 * length floors are both expressed in stroke widths, thinning the stroke makes
 * the coat DENSER and SHORTER at the same time, which is exactly the
 * three-part correction asked for. Above 170px nothing changes, so the larger
 * sizes already approved are untouched.
 */
export function hairMetrics(size: number, R: number): { w: number; gap: number; base: number } {
  const small = smooth01((170 - size) / 70); // 0 at ≥170px, 1 at ≤100px
  const w = 3 - 1.2 * small;
  return {
    w,
    // spaced by arc length; the floor keeps neighbours from fusing into a rim
    gap: Math.max(R * 0.088, w * 1.55),
    // floored so a strand is never barely longer than it is wide, capped
    // against R so a thumbnail grows a short coat rather than spikes
    base: Math.min(Math.max(R * 0.11, w * 2.0), R * 0.32),
  };
}

/* ── 姿/性 temperament — read from dims the engine ALREADY learns ───────────
   Costs no new data: method + flavor preferences become motion parameters and
   static posture (edge sharpness, lean, centre of mass), so temperament
   survives a screenshot. Preferences gate on evidence like everything else. */
const METHOD_DIMS = ['fried', 'grilled', 'braised', 'steamed', 'raw', 'baked'] as const;
type MethodShares = Record<(typeof METHOD_DIMS)[number], number>;

function methodShares(inputs: FormInputs): MethodShares {
  const o = {} as MethodShares;
  let t = 0;
  for (const d of METHOD_DIMS) {
    const known = (inputs.evidence[d] ?? 0) > 0;
    o[d] = known ? Math.max(0, inputs.vector[d] ?? 0) : 0;
    t += o[d];
  }
  if (t > 0) for (const d of METHOD_DIMS) o[d] /= t;
  return o;
}

export type Temperament = {
  m: MethodShares;
  energy: number; calm: number; weight: number; bounce: number; sharp: number;
};

export function temperOf(inputs: FormInputs): Temperament {
  const m = methodShares(inputs);
  const pref = (d: string) =>
    (inputs.evidence[d] ?? 0) > 0 ? Math.max(0, inputs.vector[d] ?? 0) : 0;
  const energy = Math.min(1, 0.55 * (m.fried + m.grilled) + 0.75 * pref('spicy'));
  const calm = Math.min(1, 0.55 * (m.steamed + m.raw) + 0.75 * pref('fresh'));
  const weight = Math.min(1, 0.6 * m.braised + 0.7 * pref('rich'));
  return {
    m, energy, calm, weight,
    bounce: Math.min(1, pref('sweet')),
    sharp: Math.max(0, energy - calm * 0.7),
  };
}

/* ── 膚 skin palettes — three flat tones each, cut-paper ink, NO gradients
   (owner, 2026-08-02: "too much gradient and doesn't fit this style").
   滑 smooth ships in two weights: lighter for sea-fed (wet, translucent),
   darker for land-fed. `rim` sits above the reflection tone — the wet edge is
   the second-brightest thing on the creature after the catch-light itself. */
const SKIN_SMOOTH_SEA = { base: '#4d4a43', mid: '#635f55', hi: '#b3aea4', rim: '#918b7f' };
const SKIN_SMOOTH_LAND = { base: '#332f2a', mid: '#454039', hi: '#847f76', rim: '#68625a' };
// 軟 soft: pale halo BEHIND the body, opaque near-black body, darker core.
// Read off the owner's reference — earlier passes drew the body at 72% alpha,
// which washed it grey; z-order (body behind limbs) is the fix, not opacity.
const SKIN_SOFT = { halo: '#cbc8c0', layer: '#332f2b', core: '#221f1a' };
// 糙 rough: ONE two-tone dot duplicated and resized — placement is the character.
const SKIN_ROUGH = { dark: '#1a1714', light: '#4b473f' };

const INK = ['#3a3733', '#211d18', '#2e2a24'] as const;
const HILITE = '250,247,241';
const WASH = '217,210,194';

function inkFill(ctx: CanvasRenderingContext2D, c: number, s: number) {
  const g = ctx.createLinearGradient(c - s * 0.3, c - s * 0.3, c + s * 0.3, c + s * 0.3);
  g.addColorStop(0, INK[0]); g.addColorStop(0.6, INK[1]); g.addColorStop(1, INK[2]);
  return g;
}

type Pt = { x: number; y: number };
function closedPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  const n = pts.length; if (n < 3) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
    ctx.bezierCurveTo(
      b.x + (c.x - a.x) / 6, b.y + (c.y - a.y) / 6,
      c.x - (d.x - b.x) / 6, c.y - (d.y - b.y) / 6, c.x, c.y,
    );
  }
  ctx.closePath();
}

/** filled quad tapering w0→w1 — an ink stroke with weight */
function taperQuad(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number, w0: number, w1: number,
) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * 0.5, ny = (dx / L) * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath(); ctx.fill();
}

/* sub-node mixes for typed limbs. Geometry blends with the mix; TERMINAL
   detail takes the dominant sub-node — a blended foot at thumbnail size is
   mud, not nuance (the lab's blend rule). */
function subMix<K extends string>(
  bag: Partial<Record<K, number>> | undefined, keys: K[],
): Record<K, number> {
  const o = {} as Record<K, number>;
  let t = 0;
  for (const k of keys) { o[k] = Math.max(0, bag?.[k] ?? 1); t += o[k]; }
  for (const k of keys) o[k] = t > 0 ? o[k] / t : 1 / keys.length;
  return o;
}
const domOf = <K extends string>(m: Record<K, number>): K =>
  (Object.keys(m) as K[]).reduce((a, b) => (m[b] > m[a] ? b : a));

/* 腿 · leg. cow = thick pillar on a cleft hoof; pig = shorter, softer, small
   trotter; chicken = thin, backward knee, three splayed toes. (lab v5) */
function drawLeg(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, R: number, f: number,
  mix: Record<'beef' | 'pork' | 'chicken', number>, lean: number,
) {
  const bf = mix.beef, pk = mix.pork, ck = mix.chicken;
  const len = R * (0.42 * bf + 0.3 * pk + 0.5 * ck) * f;
  const w = R * (0.15 * bf + 0.14 * pk + 0.058 * ck) * f;
  const kneeX = bx + lean * len * 0.05 - ck * len * 0.2; // chicken bends backward
  const kneeY = by + len * 0.52;
  const footX = bx + lean * len * 0.12 + ck * len * 0.1;
  const footY = by + len;
  ctx.fillStyle = 'rgba(33,29,24,.94)';
  taperQuad(ctx, bx, by, kneeX, kneeY, w * 1.1, w * (0.95 - 0.25 * ck));
  taperQuad(ctx, kneeX, kneeY, footX, footY, w * (0.95 - 0.25 * ck), w * (0.85 - 0.35 * ck));
  const type = domOf(mix);
  if (type === 'beef') { // cleft hoof
    const hw = w * 1.25, hh = w * 0.62;
    ctx.beginPath(); ctx.moveTo(footX - hw, footY - hh * 0.2);
    ctx.lineTo(footX - w * 0.14, footY - hh * 0.2); ctx.lineTo(footX - w * 0.14, footY + hh);
    ctx.lineTo(footX - hw * 0.85, footY + hh); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(footX + w * 0.14, footY - hh * 0.2);
    ctx.lineTo(footX + hw, footY - hh * 0.2); ctx.lineTo(footX + hw * 0.85, footY + hh);
    ctx.lineTo(footX + w * 0.14, footY + hh); ctx.closePath(); ctx.fill();
  } else if (type === 'pork') { // small round trotter
    ctx.beginPath(); ctx.ellipse(footX, footY + w * 0.2, w * 0.78, w * 0.5, 0.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(footX - w * 0.4, footY + w * 0.5, w * 0.26, w * 0.3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(footX + w * 0.4, footY + w * 0.5, w * 0.26, w * 0.3, 0, 0, TAU); ctx.fill();
  } else { // three splayed toes
    for (const sp of [-0.62, 0, 0.62]) {
      taperQuad(ctx, footX, footY,
        footX + Math.sin(sp) * w * 2.4, footY + Math.cos(sp) * w * 1.5, w * 0.7, w * 0.2);
    }
  }
}

/* ═══════════════ the creature frame ═══════════════ */

/**
 * Draw one full frame of the creature: fog wash, appendages-behind, body,
 * skin, appendages-in-front, glyph. `t` in ms drives layered motion; pass 0
 * for a still frame (posture persists — temperament is static too).
 */
export function drawCreatureFrame(
  ctx: CanvasRenderingContext2D,
  size: number,
  inputs: FormInputs,
  domains: DomainEvidence,
  t: number,
  glyph?: string,
) {
  ctx.clearRect(0, 0, size, size);
  const c0 = size / 2;

  // fog wash — the same honesty halo the blob carries, same numbers
  const fog = fogExtent(inputs.evidence);
  const wash = ctx.createRadialGradient(c0, c0, size * 0.2, c0, c0, size * 0.48);
  wash.addColorStop(0, `rgba(${WASH},${0.45 * fog})`);
  wash.addColorStop(1, `rgba(${WASH},0)`);
  ctx.fillStyle = wash;
  ctx.beginPath(); ctx.arc(c0, c0, size * 0.48, 0, TAU); ctx.fill();

  // domain shares — all-zero never reaches here (hasAnatomy gates)
  const ev = (k: (typeof DOMAIN_KEYS)[number]) => Math.max(0, domains[k] ?? 0);
  const tot = Math.max(1e-6, DOMAIN_KEYS.reduce((s, k) => s + ev(k), 0));
  const s = ev('sea') / tot, l = ev('land') / tot, a = ev('air') / tot,
    c = ev('shell') / tot, f = ev('field') / tot, ag = ev('algae') / tot,
    fg = ev('fungus') / tot;
  const tem = temperOf(inputs);
  const m = tem.m;

  // ── the body: blob identity × domain plan ─────────────────────────────────
  // sampleForm carries the WHOLE existing identity (taste lobes, dents,
  // learning traces, seeded micro). Dividing out growth leaves the unit
  // profile; the v6 domain bumps then modulate it, and R re-applies growth at
  // creature proportion (smaller than the blob's 0.36 — limbs need the room;
  // the ×1.12 shrink is the lab's "limbs are part of the silhouette" lesson).
  const P = 96;
  const { radii } = sampleForm(inputs, P);
  const gBase = growth(inputs.ratingCount);
  const rnd = seededRandom('creature:' + inputs.seed);
  // 姿 static posture in the edge itself: calm softens micro, sharp spikes it
  const spikes: number[] = [];
  for (let i = 0; i < P; i++) {
    spikes.push((i % 2 ? 1 : -1) * rnd() * 0.042 * tem.sharp - (rnd() * 2 - 1) * 0.008 * tem.calm);
  }
  const R = size * 0.19 * (0.55 + 0.45 * gBase) * 1.12;
  const cx = c0;
  const squash = 1 - 0.2 * l + 0.14 * a + 0.1 * f;
  const widen = 1 + 0.14 * l - 0.14 * a + 0.12 * c - 0.06 * f;
  const cyAt = (tt: number) => c0 - size * 0.03 + R * 0.1 * l - R * 0.05 * s + R * 0.1 * tem.weight
    + (tt ? s * size * 0.012 * Math.sin(tt * 0.0008) : 0);
  /* The silhouette at a given time. Callable at t=0 to recover the STATIC body,
     which anything anchored to the skin needs: a feature placed off the
     breathing outline drifts with the breath instead of staying put. */
  const bodyAt = (tt: number): Pt[] => {
    const cyT = cyAt(tt);
    const pulse = tt ? 1 + 0.02 * l * Math.sin(tt * 0.0007) : 1;
    const out: Pt[] = [];
    for (let i = 0; i < P; i++) {
      const ph = (i / P) * TAU;
      const up = Math.max(0, Math.cos(ph)), down = Math.max(0, -Math.cos(ph));
      let r = radii[i] / gBase // the blob's unit identity, lobes and all
        + 0.42 * s * Math.cos(ph)
        + 0.3 * l * Math.cos(ph - Math.PI)
        + 0.2 * l * Math.abs(Math.sin(ph))
        - 0.2 * a * Math.abs(Math.sin(ph))
        + 0.38 * m.baked * up * up
        - 0.14 * m.baked * down
        + 0.26 * m.braised * down
        + 0.1 * tem.bounce * Math.abs(Math.sin(ph * 2))
        + spikes[i]
        + (tt ? 0.045 * s * Math.sin(tt * 0.0012 + ph * 3) : 0);
      r = Math.max(0.15, r * pulse);
      out.push({ x: cx + Math.sin(ph) * r * R * widen, y: cyT - Math.cos(ph) * r * R * squash });
    }
    if (tem.energy > 0.05) { // forward lean — aggression is posture, not just speed
      const lean = tem.energy * 0.2;
      for (const p of out) p.x += ((cyT - p.y) / R) * lean * R * 0.5;
    }
    return out;
  };
  const cy = cyAt(t);
  const pts = bodyAt(t);
  // appendages attach to the DRAWN silhouette, never to a bounding box — a
  // wrist placed off global extents buries wherever the body bulges (measured:
  // claw reach collapsed to 9% on the blob before this rule).
  const bottom = (fr: number) => pts[Math.round(((Math.PI + fr * 0.6) / TAU) * P) % P];
  const flank = (side: number, h: number) =>
    pts[(Math.round((((side > 0 ? h : TAU - h)) / TAU) * P) + P) % P];

  ctx.lineCap = 'round';
  const GATE = 0.22;
  const absF = (evd: number, min = 5, span = 7) => smooth01((evd - min) / span);

  // ── skin type decision (owner: the universal highlight is GONE; surface is
  // decided by skin type). Precedence notes are the lab's, flagged not hidden:
  // 甲 shell puts DOMAIN over METHOD (a steamed crab is still armoured), while
  // 毛 hairy puts method over domain (a steamed mammal reads smooth) — one of
  // the two rules should eventually change; carried as-is.
  const isShell = c > 0.3 && absF(ev('shell'), 3, 5) > 0.4;
  const isSoft = !isShell && (f + fg) > 0.45 && absF(ev('field') + ev('fungus'), 5, 7) > 0.4;
  const smoothF = Math.min(1, m.steamed + m.raw * 0.8);
  const isSmooth = !isShell && !isSoft && smoothF > 0.5;
  const SKIN = (s + c + ag) >= (l + a + f + fg) ? SKIN_SMOOTH_SEA : SKIN_SMOOTH_LAND;
  const furShare = l + a;
  // 糙 rough detector is PROVISIONAL — keyed to 根/榖 in the agreed map, which
  // has no domain yet, so it rides 炸 purely to stay reviewable.
  const isRough = !isShell && !isSoft && !isSmooth && m.fried > 0.5;
  const isHairy = !isSmooth && !isShell && !isSoft && !isRough && furShare > 0.45 &&
    absF(ev('land') + ev('air'), 6, 9) > 0.4;

  // 軟 SOFT goes down first — halo, membrane, core all behind every appendage,
  // so nothing the creature grows is occluded by its own skin. Z-order is the
  // fix; opacity was the wrong lever (lab, measured).
  if (isSoft) {
    ctx.fillStyle = SKIN_SOFT.halo;
    const HN = 96; const hp: Pt[] = [];
    for (let i = 0; i < HN; i++) {
      const ha = (i / HN) * TAU;
      const k = 1
        + Math.sin(ha * 6 + (t ? t * 0.0011 : 0)) * 0.07
        + Math.sin(ha * 9 - (t ? t * 0.0007 : 0)) * 0.042;
      hp.push({
        x: cx + R * 0.06 + Math.cos(ha) * R * 1.1 * widen * k,
        y: cy - R * 0.05 + Math.sin(ha) * R * 1.05 * squash * k,
      });
    }
    ctx.beginPath(); closedPath(ctx, hp); ctx.fill();
    ctx.fillStyle = SKIN_SOFT.layer;
    ctx.beginPath(); closedPath(ctx, pts); ctx.fill();
    let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
    for (const p of pts) {
      if (p.x < sx0) sx0 = p.x; if (p.x > sx1) sx1 = p.x;
      if (p.y < sy0) sy0 = p.y; if (p.y > sy1) sy1 = p.y;
    }
    const HRs = (sx1 - sx0) / 2, VRs = (sy1 - sy0) / 2;
    ctx.fillStyle = SKIN_SOFT.core;
    ctx.beginPath();
    ctx.ellipse((sx0 + sx1) / 2, (sy0 + sy1) / 2 + VRs * 0.13, HRs * 0.8, VRs * 0.7, 0, 0, TAU);
    ctx.fill();
  }

  // ── appendages BEHIND the body ────────────────────────────────────────────
  // wings — lateral fans from the shoulder, angled out
  if (a > GATE && absF(ev('air')) > 0) {
    const span = R * (0.55 + 0.75 * Math.min(1, (a - GATE) * 2.2)) * absF(ev('air'));
    const flap = t ? 0.13 * Math.sin(t * 0.0013) * (0.3 + a) : 0;
    for (const side of [-1, 1]) {
      const base = flank(side, 0.8);
      const nS = 4 + Math.min(3, Math.floor(ev('air') / 25));
      for (let w = 0; w < nS; w++) {
        const ang = side > 0 ? (-0.32 + 0.14 * w + flap) : (Math.PI + 0.32 - 0.14 * w - flap);
        const L = span * (1 - 0.12 * w);
        ctx.strokeStyle = `rgba(33,29,24,${0.55 - 0.06 * w})`;
        ctx.lineWidth = Math.max(1, R * 0.05 * (1 - 0.12 * w));
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(
          base.x + Math.cos(ang) * L * 0.5, base.y + Math.sin(ang) * L * 0.5 - R * 0.3,
          base.x + Math.cos(ang) * L, base.y + Math.sin(ang) * L - R * 0.15);
        ctx.stroke();
      }
    }
  }
  // fronds — rising leaf curves with a blade at the tip
  const frondF = smooth01((f - 0.08) / 0.3) * absF(ev('field'));
  if (frondF > 0) {
    const nF = 2 + Math.round(4 * frondF);
    for (let i = 0; i < nF; i++) {
      const fr = (i - (nF - 1) / 2) / Math.max(1, (nF - 1) / 2);
      const base = flank(fr < 0 ? -1 : 1, 0.25 + Math.abs(fr) * 0.3);
      const L = R * (0.55 + 0.85 * frondF) * (1 - 0.15 * Math.abs(fr));
      const sway = t ? Math.sin(t * 0.001 + i * 1.3) * R * 0.08 * (0.3 + f) : 0;
      const curl = fr * R * 0.3;
      const tipX = base.x + curl * 1.5 + sway, tipY = base.y - L;
      ctx.strokeStyle = `rgba(33,29,24,${0.55 - 0.06 * Math.abs(fr)})`;
      ctx.lineWidth = Math.max(1, R * 0.05 * (1 - 0.2 * Math.abs(fr)));
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.bezierCurveTo(
        base.x + curl * 0.3 + sway * 0.4, base.y - L * 0.45,
        base.x + curl + sway, base.y - L * 0.8, tipX, tipY);
      ctx.stroke();
      const bl = R * (0.11 + 0.16 * frondF) * (1 - 0.2 * Math.abs(fr));
      const lean2 = curl * 0.5;
      ctx.fillStyle = `rgba(33,29,24,${0.48 - 0.05 * Math.abs(fr)})`;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY + bl * 0.75);
      ctx.quadraticCurveTo(tipX - bl * 0.62 + lean2 * 0.2, tipY - bl * 0.15, tipX + lean2 * 0.35, tipY - bl * 1.35);
      ctx.quadraticCurveTo(tipX + bl * 0.62 + lean2 * 0.2, tipY - bl * 0.15, tipX, tipY + bl * 0.75);
      ctx.fill();
    }
  }
  // 藻 ribbons
  const agF = smooth01((ag - 0.07) / 0.25) * absF(ev('algae'));
  if (agF > 0) {
    const nB = 2 + Math.round(2 * agF);
    for (let i = 0; i < nB; i++) {
      const fr = (i - (nB - 1) / 2) / Math.max(1, (nB - 1) / 2);
      const b = bottom(fr * 0.7);
      const L = R * (0.7 + 0.7 * agF), w = R * (0.1 + 0.1 * agF);
      ctx.fillStyle = `rgba(33,29,24,${0.42 - 0.05 * Math.abs(fr)})`;
      ctx.beginPath();
      for (const edge of [1, -1]) {
        for (let k = 0; k <= 10; k++) {
          const u = edge > 0 ? k / 10 : 1 - k / 10;
          const ph2 = (t ? t * 0.0011 : 0) + i * 1.4 + u * 3.4;
          const x = b.x + Math.sin(ph2) * R * 0.16 * u + edge * w * 0.5 * (1 - u * 0.5);
          const y = b.y + L * u;
          if (edge > 0 && k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }
      ctx.closePath(); ctx.fill();
    }
  }
  // tendrils
  if (s > GATE && absF(ev('sea')) > 0) {
    const nT = 2 + Math.min(4, Math.floor(ev('sea') / 14));
    const L = R * (0.8 + 0.6 * s) * absF(ev('sea'));
    for (let i = 0; i < nT; i++) {
      const fr = (i - (nT - 1) / 2) / Math.max(1, (nT - 1) / 2);
      const b = bottom(fr * 0.8);
      const sway = t ? Math.sin(t * 0.0011 + i * 1.7) * (R * 0.14) * (0.4 + s) : 0;
      ctx.strokeStyle = `rgba(33,29,24,${0.7 - 0.07 * Math.abs(fr)})`;
      ctx.lineWidth = Math.max(1, R * 0.075 * (1 - 0.25 * Math.abs(fr)));
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.bezierCurveTo(
        b.x + sway * 0.4, b.y + L * 0.4,
        b.x + sway, b.y + L * 0.75,
        b.x + sway * 1.4 + fr * R * 0.18, b.y + L * (1 - 0.08 * Math.abs(fr)));
      ctx.stroke();
    }
  }
  // 螯 claws — the calibrated pair (creatureGestures), which replaced the lab's
  // palm-and-prongs sketch. Wrists pull 18% inside the flank point so the body
  // fill covers the join (z-order, never alpha). One big one small is the whole
  // 龍蝦 read; 蟹 is 1:1. Prawn's fine pincers wait in the gesture pool — its
  // share picks the nearer of the two shipped gestures for now.
  const clawF = smooth01((c - 0.06) / 0.28) * absF(ev('shell'), 3, 5);
  // GATE and SIZE are separate jobs, and conflating them cost the claw its
  // legibility. I first set size = clawF outright, reasoning that a floor would
  // "defeat both gates — one crab dish rendering half-grown claws". That was
  // wrong, and measurable: the evidence floor absF(ev,3,5) already returns 0
  // below ~4 shellfish meals, so one crab dish draws NOTHING no matter what the
  // size ramp says. The gates decide IF; the ramp only decides how big once
  // they have already said yes.
  // Meanwhile size = clawF punished a real habit: the owner's own profile
  // (19.8% shellfish, evidence 7.05, both gates passed) rendered at 44% — a nub
  // you could not read as a claw. The share gate is the slow one (it wants ~34%
  // share for full size), so mid-share eaters sat invisible for a long time.
  if (clawF > 0.12) {
    const mix = subMix(domains.sub?.shell, ['lobster', 'crab', 'prawn']);
    const species: ClawSpecies = mix.crab >= mix.lobster ? 'crab' : 'lobster';
    const clawInk = isSmooth ? SKIN.base : 'rgba(33,29,24,.93)';
    // Once earned, a claw reads as a claw: the ramp spans 0.5→1.0 rather than
    // 0→1, so the youngest claw the gates allow is still half-size and visibly
    // a pincer, and growth after that is legible rather than a slow fade-in
    // from nothing. The bud stage (萌) lives in the GATES now, where it belongs.
    const sizeF = 0.5 + 0.5 * clawF;
    const [sL, sR] = species === 'lobster' ? [1.22, 0.82] : [1, 1];
    // the calibrated gesture holds its proportions against a body of half-width
    // 0.62·R_claw with the wrist at 0.48·R_claw from centre; here the wrist
    // rides the flank (deeper in), so the conversion pays for the extra burial.
    // 0.48 measured on the rendered creature: /0.62 landed reach at 30%/16% of
    // body width against the calibrated 40%/25 — same knob, re-measured.
    const Rclaw = (R * widen) / 0.48;
    for (const side of [-1, 1] as const) {
      const p = flank(side, 1.95);
      const bx = cx + (p.x - cx) * 0.82, by = cy + (p.y - cy) * 0.82;
      const mo = clawMotion(t, side);
      const ang = side > 0 ? CLAW_AXIS + mo.sway : Math.PI - CLAW_AXIS + mo.sway;
      const drawFn = species === 'lobster' ? drawLobsterClaw : drawCrabClaw;
      drawFn(ctx, bx, by, ang, Rclaw, sizeF * (side < 0 ? sL : sR), mo, clawInk);
    }
  }
  // 足 legs
  const legF = smooth01((l - GATE) / 0.3) * absF(ev('land'));
  if (legF > 0) {
    const mix = subMix(domains.sub?.land, ['beef', 'pork', 'chicken']);
    const nL = ev('land') > 30 ? 4 : 2;
    for (let i = 0; i < nL; i++) {
      const fr = (i - (nL - 1) / 2) / Math.max(1, (nL - 1) / 2);
      const b = bottom(fr * 0.55);
      const step = t ? Math.sin(t * 0.0009 + i * 2.1) * 0.35 * l : 0;
      drawLeg(ctx, b.x, b.y - R * 0.04, R, legF, mix, fr + step);
    }
  }

  // ── the body ──────────────────────────────────────────────────────────────
  ctx.beginPath(); closedPath(ctx, pts);
  const rawA = 1 - 0.17 * m.raw;
  // smooth skin is NOT washed by 生 translucency — its palette IS the raw look
  // (measured in the lab: washing it inverted the three tones)
  if (!isSoft) {
    ctx.save(); ctx.globalAlpha = isSmooth ? 1 : rawA;
    ctx.fillStyle = isSmooth ? SKIN.base : inkFill(ctx, c0, size);
    ctx.fill();
    ctx.restore();
  }
  if (m.raw > 0.15) {
    // on smooth skin the rim is LIGHTER than the base — a wet edge catching
    // light, not a drawn contour
    ctx.strokeStyle = isSmooth ? SKIN.rim : `rgba(33,29,24,${0.55 + 0.35 * m.raw})`;
    ctx.lineWidth = Math.max(1.2, R * 0.055);
    ctx.beginPath(); closedPath(ctx, pts); ctx.stroke();
  }
  // 滑 SMOOTH — one fluid reflection + a catch-light stroke, both under the
  // margin rule: clipped to a radially-inset body so they can never touch the
  // rim on ANY body shape (the inset margin converts through the flattest
  // axis — a squat body was measured compressing its gap to ~4px otherwise).
  if (isSmooth) {
    const w1 = t ? Math.sin(t * 0.00042) * 0.035 : 0;
    const w2 = t ? Math.sin(t * 0.00031 + 1.9) * 0.03 : 0;
    const M = Math.max(2.5, (R * 0.12) / Math.min(1, squash));
    const inset = pts.map(p => {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const k = Math.max(0, d - M) / d;
      return { x: cx + dx * k, y: cy + dy * k };
    });
    // anchored to the drawn bounding box, not (cx,cy) — identical outlines
    // must place identical reflections (measured on 清蒸魚 vs 壽司 in the lab)
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (const p of pts) {
      if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x;
      if (p.y < by0) by0 = p.y; if (p.y > by1) by1 = p.y;
    }
    const HR = (bx1 - bx0) / 2, VR = (by1 - by0) / 2;
    const RX = (bx0 + bx1) / 2 - HR * 0.2, RY = (by0 + by1) / 2 - VR * 0.26;
    const refPath = (k: number) => {
      const X = (u: number) => RX + HR * u * k, Y = (v: number) => RY + VR * v * k;
      ctx.beginPath();
      ctx.moveTo(X(-0.6), Y(0.12 + w2));
      ctx.bezierCurveTo(X(-0.68), Y(-0.34), X(-0.4), Y(-0.64), X(0.02), Y(-0.66));
      ctx.bezierCurveTo(X(0.42), Y(-0.68), X(0.68), Y(-0.42), X(0.66), Y(-0.1));
      ctx.bezierCurveTo(X(0.56), Y(0.22 + w1), X(0.3), Y(0.04 + w1), X(0.1), Y(0.32 + w1));
      ctx.bezierCurveTo(X(-0.1), Y(0.58 + w2), X(-0.32), Y(0.66 + w2), X(-0.48), Y(0.5 + w2));
      ctx.bezierCurveTo(X(-0.58), Y(0.38), X(-0.6), Y(0.26), X(-0.6), Y(0.12 + w2));
      ctx.closePath();
    };
    ctx.save();
    ctx.beginPath(); closedPath(ctx, inset); ctx.clip();
    ctx.fillStyle = SKIN.mid; refPath(1); ctx.fill();
    // catch-light: gap solved, not eyeballed — clearance converts through the
    // tighter axis so a widened body can't eat it
    const halfStroke = R * 0.1;
    const tightR = Math.max(1, Math.min(HR, VR));
    const clearLocal = (3 + halfStroke) / tightR;
    const rs = Math.max(0.12, (0.585 - clearLocal) / 1.04);
    const SX = (u: number) => RX + HR * u, SY = (v: number) => RY + VR * v + VR * w1 * 0.5;
    ctx.save();
    refPath(0.8); ctx.clip();
    ctx.strokeStyle = SKIN.hi;
    ctx.lineCap = 'round'; ctx.lineWidth = halfStroke * 2;
    ctx.beginPath();
    ctx.moveTo(SX(-rs * 0.866), SY(-rs * 0.5));
    ctx.quadraticCurveTo(SX(-rs * 0.612), SY(-rs * 0.841), SX(-rs * 0.208), SY(-rs * 0.978));
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  // 甲 SHELL — stacked "M" plates, each a LIGHT edge over a DARK gap line; the
  // pair is what sells armour (either line alone reads as a scratch). Flat
  // treads, not a zigzag — the flats are what make it a plate edge.
  if (isShell) {
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const M: [number, number][] = [[-1.3, 0], [-0.62, 0], [-0.48, 0.62], [-0.27, 0.62], [-0.13, 0.1],
      [0.13, 0.1], [0.27, 0.62], [0.48, 0.62], [0.62, 0], [1.3, 0]];
    const nB = 4, h = R * 0.34, y0 = cy - R * 0.4;
    const trace = (yTop: number) => {
      ctx.beginPath();
      M.forEach(([u, v], i) => {
        const x = cx + u * R * widen, y = yTop + v * h;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
    };
    for (let b = 0; b < nB; b++) {
      const yTop = y0 + b * h;
      ctx.strokeStyle = 'rgba(8,7,6,.62)'; // the gap the next plate slides into
      ctx.lineWidth = Math.max(1.8, R * 0.085);
      trace(yTop + R * 0.05); ctx.stroke();
      ctx.strokeStyle = `rgba(${HILITE},.24)`; // lit top edge, drawn over it
      ctx.lineWidth = Math.max(1.4, R * 0.05);
      trace(yTop); ctx.stroke();
    }
    ctx.restore();
  }
  // 毛 HAIRY — outward-and-down strokes MIRRORED about the vertical axis (a
  // single global lean reads as a comb-over), spaced by ARC LENGTH so density
  // is even everywhere, and literally 4px so hair stays hair at any size.
  if (isHairy) {
    ctx.save();
    ctx.lineCap = 'round';
    // 3px at full size (owner's spec: a literal width, not a proportion, so
    // hair reads as hair rather than thickening into spikes on a large render),
    // tapering below ~170px so the coat stops burying the legs. The width is
    // the yardstick everything else is measured in — see hairMetrics.
    const HM = hairMetrics(size, R);
    ctx.lineWidth = HM.w;
    ctx.strokeStyle = inkFill(ctx, c0, size); // hair IS the body colour
    // ANCHORED TO THE STATIC SILHOUETTE. Deriving the count and the arc-length
    // positions from the LIVE outline makes both drift with the breath: `total`
    // changes, N flips between values, and every hair slides around the rim —
    // which reads as the whole coat slowly ROTATING (owner, 2026-08-04: the
    // animation "should not be the whole thing rotating"). Anchors come from
    // t=0 and are evaluated on the live outline at the same material point, so
    // each hair stays rooted to its own patch of skin.
    const anchor = bodyAt(0);
    const seg: number[] = [], cum = [0];
    let total = 0;
    for (let i = 0; i < P; i++) {
      const p = anchor[i], q = anchor[(i + 1) % P];
      const dl = Math.hypot(q.x - p.x, q.y - p.y);
      seg.push(dl); total += dl; cum.push(total);
    }
    // spaced by ARC LENGTH, not by angle — even angular spacing thins the coat
    // wherever the radius is largest, packing the sides and stripping top/bottom
    const N = Math.max(22, Math.round(total / HM.gap));
    let k = 0;
    for (let i = 0; i < N; i++) {
      const target = (i / N) * total;
      while (k < P - 1 && cum[k + 1] < target) k++;
      const fr = seg[k] ? (target - cum[k]) / seg[k] : 0;
      const p0 = pts[k], p1 = pts[(k + 1) % P]; // live outline, static anchor
      const px = p0.x + (p1.x - p0.x) * fr, py = p0.y + (p1.y - p0.y) * fr;
      let nx = px - cx, ny = py - cy;
      const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      // variation applied AFTER the clamp, never inside it: clamping the varied
      // value collapses every hair to exactly the floor once the body is small,
      // and a coat of identical strands reads as a comb, not as fur
      const L = HM.base * (0.82 + rnd() * 0.36);
      const side = px >= cx ? 1 : -1;
      const bend = hairWindBend(nx, ny, px - cx, R, t);
      // base lean stays MIRRORED about the vertical axis (owner's reference:
      // every hair sweeps outward-and-down); the wind is added in screen space,
      // unmirrored, so the two sides genuinely bend independently
      const tilt = side * (0.42 + (rnd() - 0.5) * 0.16) + bend;
      const ca = Math.cos(tilt), sa2 = Math.sin(tilt);
      ctx.beginPath();
      ctx.moveTo(px - nx * R * 0.02, py - ny * R * 0.02); // rooted just inside the rim
      ctx.lineTo(px + (nx * ca - ny * sa2) * L, py + (ny * ca + nx * sa2) * L);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 糙 ROUGH — 7 two-tone dots in two clusters (upper-right 4, lower-left 3);
  // the clusters are the whole read, a random spread loses it
  if (isRough) {
    const DOTS: [number, number, number][] = [
      [0.28, -0.46, 1], [0.56, -0.34, 0.8], [0.34, -0.22, 0.6], [0.58, -0.1, 0.5],
      [-0.5, 0.18, 0.94], [-0.3, 0.32, 0.72], [-0.5, 0.4, 0.56],
    ];
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    for (const [u, v, sc] of DOTS) {
      const x = cx + u * R * widen, y = cy + v * R * squash, r = R * 0.14 * sc;
      // dark UNDER and slightly larger — a rim around the light, not a shadow
      ctx.fillStyle = SKIN_ROUGH.dark;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.88, -0.38, 0, TAU); ctx.fill();
      ctx.fillStyle = SKIN_ROUGH.light;
      ctx.beginPath(); ctx.ellipse(x - r * 0.1, y - r * 0.1, r * 0.8, r * 0.68, -0.38, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // 炸 crust nubs on the rim
  if (m.fried > 0.15) {
    const nN = Math.round(10 + 26 * m.fried);
    ctx.fillStyle = 'rgba(33,29,24,.92)';
    for (let i = 0; i < nN; i++) {
      const p = pts[Math.floor(rnd() * P)];
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const off = R * (0.01 + rnd() * 0.05);
      ctx.beginPath();
      ctx.arc(p.x + (dx / d) * off, p.y + (dy / d) * off, R * (0.02 + rnd() * 0.03), 0, TAU);
      ctx.fill();
    }
  }
  // 菌 caps
  const fgF = smooth01((fg - 0.07) / 0.25) * absF(ev('fungus'));
  if (fgF > 0) {
    const nC = 1 + Math.round(3 * fgF);
    for (let i = 0; i < nC; i++) {
      const fr = (i - (nC - 1) / 2) / Math.max(1, (nC - 1) / 2);
      const base = flank(fr < 0 ? -1 : 1, 0.3 + Math.abs(fr) * 0.42);
      const stem = R * (0.14 + 0.16 * fgF), capW = R * (0.13 + 0.17 * fgF);
      const tipY = base.y - stem;
      ctx.fillStyle = 'rgba(33,29,24,.95)';
      ctx.beginPath(); ctx.rect(base.x - R * 0.028, tipY, R * 0.056, stem); ctx.fill();
      ctx.beginPath(); ctx.ellipse(base.x, tipY, capW, capW * 0.58, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${HILITE},.16)`; ctx.lineWidth = Math.max(0.8, R * 0.016);
      for (const gg of [-0.5, 0, 0.5]) {
        ctx.beginPath(); ctx.moveTo(base.x + gg * capW * 0.7, tipY);
        ctx.lineTo(base.x + gg * capW * 0.9, tipY + capW * 0.16); ctx.stroke();
      }
    }
  }

  // the glyph rides the body's own centre (cy shifts with weight/domain)
  if (glyph) {
    ctx.fillStyle = '#faf7f1';
    ctx.font = `500 ${Math.round(size * 0.09)}px "Songti TC","Noto Serif TC",serif`;
    ctx.textAlign = 'center';
    ctx.fillText(glyph, cx, cy + size * 0.036);
  }
}

/** Deterministic-still check hook for tests: a frame at t=0 must not depend on
    when it is drawn. (Motion is layered; identity is grown.) */
export const CREATURE_STILL_T = 0;

/**
 * The creature as a static SVG — the snapshot half of the two-renderer
 * contract, produced by REPLAYING drawCreatureFrame through the canvasToSvg
 * recorder at t=0. Not a second drawing: the same strokes, recorded instead of
 * rasterized, so the snapshot cannot disagree with the Taste tab about what a
 * profile looks like. t=0 is the identity pose — motion (pinch, wind, breath)
 * is layered on top of grown geometry and owns no part of who the being is.
 *
 * Returns INNER markup for a `<svg viewBox="0 0 size size">` the caller owns,
 * mirroring how blobSnapshotPath returns a path for the caller's <svg>.
 */
export function creatureSnapshotSvg(
  inputs: FormInputs, domains: DomainEvidence, size: number, glyph?: string,
): string {
  const { ctx, svg } = svgContext(size, size);
  drawCreatureFrame(ctx, size, inputs, domains, CREATURE_STILL_T, glyph);
  return svg();
}
