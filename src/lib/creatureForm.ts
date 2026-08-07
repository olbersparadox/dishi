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
// PRODUCTION STATUS: LIVE since 2026-08-05. `domain_evidence` is passed by
// TasteFormCard, TasteGrowth and PublicDossier, and the snapshot renderer
// learned the same anatomy (canvasToSvg.ts), closing the two-renderer
// contract. This comment asserted "nothing passes domains yet" for a while
// after that stopped being true — a status note with no date is a trap, so
// this one carries one. The lesson that earned the original note still holds:
// a first port invented a `vector.sea_crustacean` field, so the gate was
// permanently false and the claws never drew. A feature keyed to a field that
// does not exist is not a shipped feature; rendering it is the evidence.
//
// WHAT IS AND IS NOT BUILT lives in ONE place: docs/rnd/mokling-framework.md,
// section "Ledger — what exists and what does not". Check it before concluding
// a feature is missing from the framework. 尾 tails, 鰭 fins, 角 horns and
// 耳 ears are all SPECIFIED there and were BUILT in lab v7 — they are simply
// not ported into this file. Absence here is not absence from the design, and
// a grep of this file alone has already produced exactly that wrong answer.

import {
  sampleForm, growth, seededRandom, fogExtent, dimAngle, type FormInputs,
} from './blobForm';
import { DIMS } from './taste';
import {
  drawLobsterClaw, drawCrabClaw, drawPrawnClaw, clawMotion, CLAW_AXIS, type ClawSpecies,
} from './creatureGestures';
import { svgContext, type InkBounds, type InkRecord } from './canvasToSvg';

const TAU = Math.PI * 2;

/* ── the domain record: what ship-path step 2 must produce ──────────────────
   Each number is liking-weighted evidence (per event: 0.5 + max(0, flick) —
   exposure counts, liking amplifies; you become what you keep coming back to).
   Recency-weighted upstream per the metabolism rules; this module only reads. */
export type DomainEvidence = {
  sea?: number; land?: number; air?: number; shell?: number;
  field?: number; algae?: number; fungus?: number;
  /** Sub-node mixes for typed limbs — the detail that makes a being someone's.
      Absent → equal mix (the lab default). G3 (growth R&D Decision 4) added
      air/sea/field and lamb; each bag is populated but not yet READ by any
      gesture — the detectors ship ahead of the ports they unblock. */
  sub?: {
    shell?: { lobster?: number; crab?: number; prawn?: number };
    land?: { beef?: number; pork?: number; chicken?: number; lamb?: number };
    air?: { chicken?: number; duck_goose?: number };
    sea?: { fish?: number; cephalopod?: number };
    field?: { leaf?: number; root?: number; soy?: number };
  };
  /** 對決 verdicts, `"family:x|y" -> net` (positive = x leads). G9: when eating
      leaves two variants tied, the duel the person actually answered decides
      which one the limb shows. Never decayed — see domainEvidence.ts. */
  duels?: Record<string, number>;
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
export type MethodShares = Record<(typeof METHOD_DIMS)[number], number>;

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

/** Normalised domain shares — each domain's fraction of all domain evidence. */
export type DomainShares = {
  s: number; l: number; a: number; c: number; f: number; fg: number; ag: number;
};

export function domainShares(domains: DomainEvidence): DomainShares {
  const ev = (k: (typeof DOMAIN_KEYS)[number]) => Math.max(0, domains[k] ?? 0);
  const tot = Math.max(1e-6, DOMAIN_KEYS.reduce((sum, k) => sum + ev(k), 0));
  return {
    s: ev('sea') / tot, l: ev('land') / tot, a: ev('air') / tot,
    c: ev('shell') / tot, f: ev('field') / tot, ag: ev('algae') / tot,
    fg: ev('fungus') / tot,
  };
}

export type SkinType = 'soft' | 'smooth' | 'rough' | 'glazed' | 'golden' | 'charred' | 'none';

/**
 * Which surface the being wears. EXTRACTED from the render loop so it can be
 * unit-tested: this decision drifted once already — 軟 silently changed from
 * the framework's 燜 braised to a 田+菌 domain read, and nothing caught it
 * because the NAME still matched on both sides. A pure function with a test
 * is the only thing that makes that class of drift loud.
 *
 * 膚 IS BECOMING METHOD-ONLY (owner, 2026-08-05): one skin per cooking method,
 * with 甲/毛 leaving for 骨 because a carapace and a pelt are body parts an
 * animal GREW, not treatments applied to a surface. Live status:
 * docs/rnd/mokling-framework.md, the "膚" section — the ONLY place 膚 status lives.
 *
 * WHERE THAT SEQUENCE STANDS. Landed: 軟 re-pointed from 田+菌 onto 蒸, and 滑
 * left to 生 alone. Still pending: 甲 and 毛 remain in this chain on purpose —
 * pulling them before their 骨 overlay replacement exists would strip shell
 * and land eaters of their identity with nothing put back. So 甲's precedence
 * over method is still in force and still wrong (a steamed crab reads
 * armoured, not soft). Sequenced, not forgotten.
 *
 * The three method skins cannot collide, structurally rather than luckily:
 * m.steamed/m.raw/m.fried are shares of one normalised total, so at most one
 * clears 0.5. The ordering below does real work only against 甲 and 毛.
 *
 * KNOWN GAP, deliberately not closed here: method skins gate on SHARE with no
 * absolute evidence floor, so a single steamed dish with no other method
 * evidence normalises to m.steamed = 1 and draws a full skin. Fix the skins
 * together, with the owner — not piecemeal.
 */
export function skinOf(m: MethodShares): SkinType {
  if (m.steamed > 0.5) return 'soft';       // 軟 ← 蒸
  if (m.raw > 0.5) return 'smooth';         // 滑 ← 生
  if (m.fried > 0.5) return 'rough';        // 糙 ← 炸
  if (m.braised > 0.5) return 'glazed';     // 釉 ← 燜
  if (m.baked > 0.5) return 'golden';       // 金 ← 焗
  if (m.grilled > 0.5) return 'charred';    // 烙 ← 烤
  return 'none';
}

/**
 * 骨 OVERLAYS — body parts the animal GREW, read from what was EATEN.
 *
 * Deliberately a separate function from skinOf, and deliberately returning
 * FLAGS rather than a winner: 膚 is one slot with one occupant, but 骨 parts
 * are not skins and do not compete with them. A steamed crab is soft AND
 * armoured; a grilled land eater is char-branded AND furred. That composition
 * is the whole point of the 2026-08-05 rearrangement.
 *
 * Both can also fire at once (shell needs >0.30 share, fur >0.45, and those
 * sum under 1), so a shell-and-land eater wears plates and a coat. Honest, and
 * rare enough to be a feature rather than a mess.
 *
 * Gates are unchanged from when these lived in the precedence chain — share
 * AND an absolute evidence floor, both, always.
 */
export type BoneOverlay = { shell: boolean; fur: boolean };

export function boneOverlay(
  domains: DomainEvidence, sh: DomainShares, mode: GrowthMode = 'legacy',
): BoneOverlay {
  const ev = (k: (typeof DOMAIN_KEYS)[number]) => Math.max(0, domains[k] ?? 0);
  const absF = (evd: number, min = 5, span = 7) => smooth01((evd - min) / span);
  if (mode === 'metabolism') {
    // Share doors retired (growth R&D, Decision 1): an overlay is earned by
    // absolutely LIVING the node, and decayed evidence now sinks on its own
    // when the eating stops — the honesty the share door used to buy. The
    // floors stay: a carapace is a loud, whole-body statement, so it keeps
    // the FORM-tier bar rather than budding off one loved dish.
    return {
      shell: absF(ev('shell'), 3, 5) > 0.4,
      fur: absF(ev('land') + ev('air'), 6, 9) > 0.4,
    };
  }
  return {
    shell: sh.c > 0.3 && absF(ev('shell'), 3, 5) > 0.4,
    fur: sh.l + sh.a > 0.45 && absF(ev('land') + ev('air'), 6, 9) > 0.4,
  };
}

/* ── the GROWTH GATES — one layer, two modes ──────────────────────────────────
   Every appendage's existence/size factor computes HERE, nowhere else. The
   seven blocks in drawCreatureFrame used to each carry their own gate
   arithmetic; centralizing is what lets the metabolism redesign (growth R&D,
   docs/rnd/mokling-growth-rnd.md, Decisions 1–2) exist as a MODE beside the
   shipped behavior instead of a rewrite of it.

   'legacy' — the shipped gates, expression-for-expression. Production runs
   this until the owner approves the metabolism on the time-travel harness;
   byte-identity across the extraction was proven by dumping all eight
   scenario lives before and after and diffing.

   'metabolism' — existence by absolute lived evidence, prominence by share:

     stage(ev) = 0.35·smooth01((ev−1.2)/0.8) + 0.65·smooth01((ev−5)/7)
     prom     = 0.6 + 0.4 · share/maxShare
     F        = stage · prom

   The 0.22 share DOOR is retired — share only scales, never denies. A first
   loved dish (ev 1.5) buds a visible nub; a formed limb needs the same ~5
   evidence the legacy floor wanted; depth to ~12 fills it out. Fed by DECAYED
   evidence (domainsAsOf), low floors are safe: a stray dish's nub reabsorbs
   in weeks. The constants are the G2 harness tuning surface — change them
   against the slider, not in the abstract. */
export type GrowthMode = 'legacy' | 'metabolism';

const BUD_FLOOR = 1.2, BUD_SPAN = 0.8, FORM_FLOOR = 5, FORM_SPAN = 7;
const BUD_SIZE = 0.35; // a full bud renders at 35% — visibly a nub, not a limb
// The moment evidence crosses the bud floor, the limb POPS IN at this fraction
// of full treatment instead of fading up from nothing (owner, 2026-08-06: "the
// baby leg is too small to be noticed by anyone. it could be short but need to
// be more obvious"). A bud is short — but it is unmistakably THERE, which is
// the whole instant-gratification beat: rate the dish, see the stub.
const BUD_MIN = 0.35;
/** Girth exponent for a young limb (owner, 2026-08-06: "thicker baby leg").
 *  BUD_MIN made buds POP IN, but scaled length and width together, so the
 *  youngest limb read as a wire rather than a stub. Width now rides
 *  `f^BUD_GIRTH`: at the bud floor (0.35) that is 0.62 — nearly twice as
 *  thick — while f=1 stays exactly 1, so a MATURE limb is untouched. Length
 *  is left alone, which is what keeps a baby leg short AND stubby.
 *  metabolism mode only: legacy is production and must stay byte-identical. */
const BUD_GIRTH = 0.45;

export type LimbStrengths = {
  wings: { on: boolean; evF: number; shareF: number };
  tendrils: { on: boolean; evF: number };
  fronds: number; algae: number; claws: number; legs: number; caps: number;
};

export function limbStrengths(domains: DomainEvidence, mode: GrowthMode): LimbStrengths {
  const ev = (k: (typeof DOMAIN_KEYS)[number]) => Math.max(0, domains[k] ?? 0);
  const sh = domainShares(domains);
  const absF = (evd: number, min = 5, span = 7) => smooth01((evd - min) / span);

  if (mode === 'metabolism') {
    const stage = (evd: number) =>
      BUD_SIZE * smooth01((evd - BUD_FLOOR) / BUD_SPAN)
      + (1 - BUD_SIZE) * smooth01((evd - FORM_FLOOR) / FORM_SPAN);
    const maxShare = Math.max(sh.s, sh.l, sh.a, sh.c, sh.f, sh.fg, sh.ag, 1e-6);
    const prom = (share: number) => 0.6 + 0.4 * (share / maxShare);
    // BUD_MIN applied to the FINAL strength, after prominence: a bud on a
    // minority node must still pop in visibly, or the floor is fiction.
    const F = (evd: number, share: number) =>
      stage(evd) > 0 ? Math.max(BUD_MIN, stage(evd) * prom(share)) : 0;
    const rawWingsF = stage(ev('air'));
    const wingsF = rawWingsF > 0 ? Math.max(BUD_MIN, rawWingsF) : 0;
    const tendF = F(ev('sea'), sh.s);
    return {
      // span already carries share through shareF, so evF stays pure stage —
      // prominence must not be paid twice on the one limb that splits the terms
      wings: { on: wingsF > 0, evF: wingsF, shareF: sh.a / maxShare },
      tendrils: { on: tendF > 0, evF: tendF },
      fronds: F(ev('field'), sh.f),
      algae: F(ev('algae'), sh.ag),
      claws: F(ev('shell'), sh.c),
      legs: F(ev('land'), sh.l),
      caps: F(ev('fungus'), sh.fg),
    };
  }

  // legacy — the shipped expressions, moved not changed
  const GATE = 0.22;
  return {
    wings: {
      on: sh.a > GATE && absF(ev('air')) > 0,
      evF: absF(ev('air')),
      shareF: Math.min(1, (sh.a - GATE) * 2.2),
    },
    tendrils: { on: sh.s > GATE && absF(ev('sea')) > 0, evF: absF(ev('sea')) },
    fronds: smooth01((sh.f - 0.08) / 0.3) * absF(ev('field')),
    algae: smooth01((sh.ag - 0.07) / 0.25) * absF(ev('algae')),
    claws: smooth01((sh.c - 0.06) / 0.28) * absF(ev('shell'), 3, 5),
    legs: smooth01((sh.l - GATE) / 0.3) * absF(ev('land')),
    caps: smooth01((sh.fg - 0.07) / 0.25) * absF(ev('fungus')),
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
const SKIN_SOFT = { halo: '#dad7cf', layer: '#3b3733', core: '#221f1a' };
// 糙 rough: one dot = a grey circle overlapping a black one. Both must read
// against the body's own gradient (L29–55): black sits below it, grey above.
// Grey darkened #5a544c → #3b3731 (owner: "tune the color of the dots
// darker") — ~35% down in lightness, still a visibly distinct warm grey
// against the near-black dot it overlaps, not flattened into it.
const SKIN_ROUGH = { black: '#0a0908', grey: '#3b3731' };
/* 釉 glaze (燜 braised): a lacquered pool, read off the owner's reference —
   the rim is the DARKEST thing (thick sauce banking up at the edge), a warmer
   mass sits inside it, and two bright speculars catch the wet surface. That
   inversion is the whole signature: every other skin is lighter at the rim or
   flat, so 釉 cannot be mistaken for them at a glance. */
const SKIN_GLAZE = { deep: '#0d0c0b', pool: '#2b2723', shine: '#d5d2ca', shineLow: '#8f8a80' };
/* 金 gold (焗 baked): a smooth top-to-bottom gradient and NOTHING else — no
   speculars, no marks. The absence is the signature: it is the only skin with
   no incident on it at all, which is what keeps it apart from 釉's speculars
   and 糙's dots on a body that also happens to be domed.
   TONE STAYS IN THE HOUSE PALETTE (channel spread 5-11, against the house's
   usual 7-15). "Golden" in the brief was figurative — the name describes what
   a baked crust IS, the way 滑 is called wet without being rendered wet. A
   first pass read it as a hue and shipped a genuinely gold top (spread 59);
   that broke the desaturated ink register and was pulled straight back. */
const SKIN_GOLD = { top: '#605b54', mid: '#322e2a', base: '#0e0b0a' };
/* 烙 char-brand (烤 grilled): diagonal grill-iron stripes, read off the
   owner's reference — even bands, alternating near-black gaps and lit
   ridges, one raking-light gradient shared across ALL the ridges rather than
   one per stripe. That sharing is what makes it read as one surface catching
   one light source instead of a stack of separately-lit bars. */
const SKIN_CHAR = { dark: '#0e0c0b', liteA: '#433d36', liteB: '#221f1b' };

const INK = ['#3a3733', '#211d18', '#2e2a24'] as const;
const HILITE = '250,247,241';
const WASH = '217,210,194';

function inkFill(ctx: CanvasRenderingContext2D, c: number, s: number) {
  const g = ctx.createLinearGradient(c - s * 0.3, c - s * 0.3, c + s * 0.3, c + s * 0.3);
  g.addColorStop(0, INK[0]); g.addColorStop(0.6, INK[1]); g.addColorStop(1, INK[2]);
  return g;
}

/** 金's vertical gradient, spanning the DRAWN body rather than the nominal
 *  box — a gradient hung off (cx, cy) would slide up or down the silhouette
 *  as the palate's lobes move it, exactly the way 軟's halo once did. Three
 *  stops, not two: the reference holds a long even light across the crown and
 *  falls away through the lower half, which a straight two-stop ramp cannot
 *  do. */
function goldFill(
  ctx: CanvasRenderingContext2D,
  box: { cx: number; cy: number; hr: number; vr: number },
) {
  const g = ctx.createLinearGradient(box.cx, box.cy - box.vr, box.cx, box.cy + box.vr);
  g.addColorStop(0, SKIN_GOLD.top);
  g.addColorStop(0.5, SKIN_GOLD.mid);
  g.addColorStop(1, SKIN_GOLD.base);
  return g;
}

type Pt = { x: number; y: number };

/** The rim's own outward direction at angle `ph` — the ONE place this sign
 *  lives. `bodyAt` (inside `drawCreatureFrame`) places every silhouette point
 *  at `(cx + sin(ph)·r·R, cyT − cos(ph)·r·R)`, so "away from the creature" at
 *  a given ph is unambiguously `(sin ph, −cos ph)`, never derived any other
 *  way. Exported so it can be unit-tested directly rather than only through a
 *  rendered frame.
 *
 *  This exists because a future appendage getting the sign wrong is a KNOWN
 *  failure, not a hypothetical one: the lab lost wings and tails to exactly
 *  this — each appendage hand-rolled its own direction, the sign was inverted
 *  on one side, and they were drawn INTO the body and buried under the fill.
 *  They were coded, gated, and firing correctly; only the geometry was wrong
 *  (docs/rnd/mokling-framework.md, "The bug that hid half the anatomy"). A
 *  symmetric pair built by calling `out` at `ph` and `TAU - ph` cannot drift
 *  into that bug, because both sides read off the same formula instead of two
 *  hand-typed copies that can silently diverge.
 *
 *  NOT YET USED by the six shipped appendages (wings/fronds/algae/tendrils/
 *  claws/legs) in `drawCreatureFrame` below — each was independently checked
 *  against this exact invariant (opposite sides mirror in x, agree in y) when
 *  this helper was added, and none carries the lab's bug, so their shipped,
 *  owner-tuned geometry is left untouched rather than refactored for its own
 *  sake. This is for whatever ports next from
 *  `docs/rnd/mokling-lab-v7-vocabulary.js` (尾/鰭/翼/角/耳 — none of which
 *  exist here yet): call `out(ph, L)` for the displacement, don't re-derive
 *  sin/cos by hand. */
export function out(ph: number, L: number): Pt {
  return { x: Math.sin(ph) * L, y: -Math.cos(ph) * L };
}

/**
 * The DRAWN silhouette's own box — centre and half-extents of `pts`.
 *
 * Anything anchored to the SKIN must place itself against this, never against
 * the nominal `(cx, cy)`. The two are not the same point and the gap is not
 * small: the body's radius is modulated per-angle by the palate's taste lobes,
 * so a profile with strong upper-compass dims draws a body whose visible
 * centre sits well above `cy`. Measured on a steamed+umami life at size 200:
 * drawn centre y = 74.1 against cy = 92.0, a 16px error — enough to push a
 * halo that was written to peek out at the CROWN down to the BELLY instead.
 *
 * That was a real, shipped bug (owner: "the lighter curvy layer is at the
 * bottom instead of the top"), and the reason it deserves a named helper is
 * that the lesson had ALREADY been learned three times in this same file —
 * appendages attach to the drawn silhouette, the 滑 reflection anchors to the
 * drawn box, and 軟's own core anchors to the drawn box — while 軟's halo,
 * three lines above that core, still used `(cx, cy)`. Prose lessons do not
 * survive; a helper that is the only way to get the box does.
 */
export function bodyBox(pts: Pt[]): { cx: number; cy: number; hr: number; vr: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hr: (x1 - x0) / 2, vr: (y1 - y0) / 2 };
}

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

/**
 * A brush-like specular: a FILLED ribbon along a quadratic whose half-width
 * varies with `wAt`, so the highlight swells and pinches down its length.
 *
 * ctx.stroke() cannot do this — lineWidth is one value for the whole path, so
 * a stroked highlight reads as a uniform pipe no matter how the curve bends.
 * Sampling the curve and offsetting each point along its own normal is the
 * only way to get a stroke that looks brushed rather than extruded.
 */
function wisp(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, qx: number, qy: number, x1: number, y1: number,
  wAt: (t: number) => number,
) {
  const N = 26;
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const px = u * u * x0 + 2 * u * t * qx + t * t * x1;
    const py = u * u * y0 + 2 * u * t * qy + t * t * y1;
    // tangent of the quadratic, for the perpendicular offset
    const tx = 2 * u * (qx - x0) + 2 * t * (x1 - qx);
    const ty = 2 * u * (qy - y0) + 2 * t * (y1 - qy);
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;
    const w = wAt(t);
    a.push({ x: px + nx * w, y: py + ny * w });
    b.push({ x: px - nx * w, y: py - ny * w });
  }
  ctx.beginPath();
  ctx.moveTo(a[0].x, a[0].y);
  for (let i = 1; i < a.length; i++) ctx.lineTo(a[i].x, a[i].y);
  for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i].x, b[i].y);
  ctx.closePath();
  ctx.fill();
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

/* ── which variant a limb SHOWS when the mix is close (G9) ────────────────────
   Found on the metabolism bench: a perfectly alternating crab/lobster diet
   flipped the claw species on 16 of 17 meals, because `mix.crab >= mix.lobster`
   is a knife edge — whichever was eaten most recently edged ahead by a few
   percent and took the whole gesture. Same knife edge sat under the leg's foot
   detail via domOf, where near-tied beef/pork is ordinary eating.

   The framework's blend rule ("terminal detail takes the dominant sub-node") is
   right; it just never said what happens when dominance is CONTESTED. This is
   that missing rule, as a ladder:

     1. CLEAR DOMINANCE — a lead of DEAD_ZONE or more wins outright. Eating far
        more of one thing is itself an answer.
     2. CONTESTED, and they have been DUELLED — the person answered this exact
        question; the duel winner takes the slot (owner, 2026-08-06).
     3. CONTESTED, never duelled — hold the lexicographically-first variant.
        Deliberately arbitrary AND deliberately STABLE: for a genuinely 50/50
        eater there is no true answer, and a steady limb is honest where a
        flickering one is just a bug. The first duel replaces it with the real
        answer, and (next round) the duel engine can ASK when it sees this.

   Rung 3 must not depend on ARGUMENT ORDER — that mistake survived one round
   here: returning "the caller's first key" reads as stable until domOfStable
   passes the pair in mix order, which is itself the value that flickers. The
   tiebreak has to be a property of the PAIR, never of how it was handed over. */
const DEAD_ZONE = 0.1;  // 55/45 — below this, the SHARE has decided nothing
/** ...and a lead smaller than roughly one meal is not a lead at all, however
 *  lopsided it looks as a ratio. Two lobster against one crab is 67/33 — a
 *  landslide by share, three meals by life. Without this, a thin young record
 *  swung the species on every single meal (measured: 9 flips across the bench's
 *  first 9 shellfish meals, all of them "dominance" that was really small
 *  numbers). Same principle as the absolute-evidence floors the gates already
 *  use: a large slice of almost nothing is not evidence. */
const MIN_LEAD = 1.5; // ≈ one loved meal

/** Reads the RAW bag, never subMix's output. subMix defaults a missing variant
 *  to 1 ("absent → equal mix", the lab default) which is right for BLENDING
 *  geometry and wrong for CHOOSING: it would put a never-eaten crab in a
 *  near-tie against a genuinely eaten lobster, and hand rung 3 a species the
 *  person has never touched. Absent must mean zero when the question is
 *  "which one are you". */
export function pickVariant<K extends string>(
  bag: Partial<Record<K, number>> | undefined, a: K, b: K,
  family: string, duels: Record<string, number> | undefined,
): K {
  const va = Math.max(0, bag?.[a] ?? 0), vb = Math.max(0, bag?.[b] ?? 0);
  const tot = va + vb, gap = Math.abs(va - vb);
  // never-eaten loses outright, at any gap — one side having NO evidence is not
  // a close call, and this must outrank MIN_LEAD or a single first meal would
  // fall through to the stable hold and show a species never eaten.
  if (va === 0 || vb === 0) { if (tot > 0) return va > vb ? a : b; }
  else if (gap / tot >= DEAD_ZONE && gap >= MIN_LEAD) return va > vb ? a : b;
  const lo = a < b ? a : b, hi = a < b ? b : a;
  const net = duels?.[`${family}:${lo}|${hi}`] ?? 0;
  if (net !== 0) return net > 0 ? lo : hi;
  return lo; // stable hold — a property of the pair, never of argument order
}

/* ── 螯 SEATS — sub-node variants COEXIST, they do not replace each other ─────
   Owner, 2026-08-06: "a creature doesn't need to be limited to 2 hands. The
   crab claws could stay, with 2 baby lobster claws sticking out from the body.
   In time, if the user eats more and more lobster the 2 lobster claws grow
   bigger, and if they stop eating crab, eventually the lobster claws take
   over." Same principle one level down from G2's domain coexistence (claws AND
   wings), and the owner's own reason for it: a bird eater grows wings while
   keeping claws, a sea eater carries tentacles and legs at once — co-occurrence
   is the common case in real eating, not the exception.

   This REPLACES winner-take-all for claws, and in doing so dissolves the
   flicker G9 was built to manage rather than merely damping it: there is no
   species to pick, so there is nothing to flip. G9's ladder survives where it
   is still needed — deciding which variant takes the PRIME seat here, and the
   genuinely single-slot features (a leg has one foot; you cannot wear a hoof
   and a trotter on the same ankle).

   Sizing, per seat, from that variant's OWN evidence — which is what makes the
   takeover a PROCESS the owner can watch instead of a jump cut:
     - the prime seat also carries every shellfish event that has no gesture of
       its own (prawn, and un-named dishes). Prawn pincers are unbuilt, so that
       eating must still support the claw it is nearest to rather than vanish —
       the framework's "an undifferentiated node falls back to its parent's
       gesture" applied to size instead of shape.
     - a second variant earns its own pair the moment it crosses SUB_BUD (one
       loved dish), starting deliberately small: the owner's "baby claws". */
const SUB_BUD = 1.2;    // one loved dish — the same bar a domain buds at
const SUB_FORM = 6;     // a real habit in that variant specifically
const CLAW_MIN = 0.28;  // a newborn pair reads as a small pincer, not a speck
/* Prime seat, then the second pair higher up the flank. Raised 1.52 → 1.25
   (owner, 2026-08-06: "move up a bit so the two won't overlap too much").
   Measured on a two-full-pair body at 300px: claw ink spans ~57px vertically
   and the seat moves it ~11px per 0.2rad, so the pairs overlapped 44% at 1.52
   and 23% at 1.25. Zero overlap would want ~0.91, which collides with the
   wing seat at 0.80 — two limb families sharing an anchor is the one thing
   the composition rules forbid outright, so some overlap is the correct
   trade and 1.25 keeps 0.45rad of clearance above. */
const CLAW_SEATS = [1.95, 1.25] as const;
/** Shellfish 2.0 (owner, 2026-08-07): both pairs sit LOWER in metabolism —
 *  prime 1.95 → 2.15, second 1.25 → 1.45 (same 0.7 rad spacing, so the
 *  overlap math above still holds), then a same-session follow-up ("move the
 *  2 pairs of claws further lower") took both another +0.15 → 2.30 / 1.60,
 *  spacing still exactly 0.7. Legacy keeps CLAW_SEATS untouched: it is the
 *  frozen control, and its own test pins the prime at exactly 1.95. */
const CLAW_SEATS_META = [2.30, 1.60] as const;
/** 蟹 at the SECOND seat pushes its wrist out toward the silhouette edge — see
 *  WRIST_BURIAL. 1.0 is the hard ceiling (the wrist crossing the edge exactly,
 *  beyond which no body pixels sit behind the join and it floats loose).
 *  0.94 → 0.98 → 1.0 (shellfish 2.0, then same-session "move the upper claws
 *  further out of the body") — now sitting exactly AT that ceiling, as far
 *  out as a wrist can go while a body pixel still backs the join. Metabolism-
 *  only by construction: legacy never seats a second pair. */
const CRAB_SECOND_BURIAL = 1.0;
/** The second pair also ROTATES toward the horizontal (shellfish 2.0: "so
 *  that the 2 jaws can be seen clearly") — the upper wrists sit near the
 *  body's widest point, where the default axis tucks the pincer gape behind
 *  the silhouette; swinging the whole gesture up by a quarter radian clears
 *  it into open air. Mirrored per side at the draw site. */
const SECOND_SEAT_ANG = -0.26;

export type ClawSeat = { species: ClawSpecies; sizeF: number; seat: number };

export function clawSeats(
  domains: DomainEvidence, mode: GrowthMode, clawF: number,
): ClawSeat[] {
  const bag = domains.sub?.shell;
  const prime = pickVariant(bag, 'crab', 'lobster', 'shell', domains.duels);
  // legacy is production and stays exactly one pair, exactly today's size
  const single: ClawSeat[] = [{ species: prime, sizeF: 0.5 + 0.5 * clawF, seat: CLAW_SEATS[0] }];
  if (mode !== 'metabolism') return single;

  const evOf = (k: ClawSpecies) => Math.max(0, bag?.[k] ?? 0);
  // Ceiling capped at 0.85, not 1.0 (owner, 2026-08-07: "cropped by an
  // invisible square"). This ramp reaches its top on absolute evidence ALONE,
  // with no share requirement — legacy's clawF needs both a share near 0.34
  // AND heavy evidence to approach 1.0, so it stayed inboard of the calibrated
  // WRIST_BURIAL by construction. This ramp does not, and reached 1.0 on the
  // owner's own real profile (prawn-heavy, folded into a 龍蝦 prime seat).
  // Confirmed by reading actual rendered PIXELS on the live page, not path
  // math: at sizeF=1.0, scanning the canvas's own ImageData found claw-ink
  // pixels sitting directly on column 0 — genuinely clipped, on production,
  // on the owner's account. (SVG path text is not a safe proxy for this: a
  // curve's control point can sit outside the canvas while the curve itself
  // never goes there, and canvasToSvg's own rect() shorthand — M x yhwvhZ —
  // reads as nonsense to a parser that only knows M/L/C/Q/A. Two different
  // path-string parsers each produced a confident, wrong bounds reading this
  // round before the pixel scan settled it; asserting XY bounds from `d=`
  // text is a trap worth naming so it isn't reached for again.) At sizeF=0.85
  // the same scan found zero clipped pixels, nearest ink 6 backing-store
  // pixels from the edge. Burial is the wrong lever for this: pulling
  // WRIST_BURIAL down far enough to close the gap sacrifices the calibrated
  // reach for every profile below the ceiling, not just the one hitting it.
  const CLAW_MAX = 0.85;
  const ramp = (evd: number) =>
    CLAW_MIN + (CLAW_MAX - CLAW_MIN) * smooth01((evd - SUB_BUD) / (SUB_FORM - SUB_BUD));
  // 蝦 is a first-class species since G4 round 1 (2026-08-07) — the old
  // "fold prawn into the prime seat" compensation existed only because its
  // gesture was unbuilt, and folding is exactly what let a prawn-heavy palate
  // saturate a 龍蝦 claw it never earned (the sizeF=1.0 crop above). Ranked
  // three ways now: prime by the G9 ladder (dominance → duel → stable hold),
  // the strongest OTHER variant above the bud floor takes the second seat.
  const SPECIES: ClawSpecies[] = ['crab', 'lobster', 'prawn'];
  const metaPrime = domOfStable(bag, SPECIES, 'shell', domains.duels);
  const others = SPECIES.filter(k => k !== metaPrime)
    .sort((x, y) => (evOf(y) - evOf(x)) || (x < y ? -1 : 1));
  if (evOf(metaPrime) <= SUB_BUD && evOf(others[0]) <= SUB_BUD) {
    // nothing individually lived — undifferentiated shell falls back to the
    // parent gesture at the parent's size, same as always
    return [{ species: metaPrime, sizeF: 0.5 + 0.5 * clawF, seat: CLAW_SEATS_META[0] }];
  }
  const seats: ClawSeat[] = [
    { species: metaPrime, sizeF: ramp(evOf(metaPrime)), seat: CLAW_SEATS_META[0] },
  ];
  if (evOf(others[0]) > SUB_BUD) {
    seats.push({ species: others[0], sizeF: ramp(evOf(others[0])), seat: CLAW_SEATS_META[1] });
  }
  return seats;
}

/** domOf through the same ladder: only the top TWO can be contested, so the
 *  three-way foot choice reduces to one pickVariant between them. Ordering the
 *  pair by mix (then by key, so an exact tie is still deterministic) is what
 *  makes rung 3's "hold the first key" mean "hold the incumbent". */
export function domOfStable<K extends string>(
  bag: Partial<Record<K, number>> | undefined, keys: K[],
  family: string, duels: Record<string, number> | undefined,
): K {
  const v = (k: K) => Math.max(0, bag?.[k] ?? 0);
  const ranked = [...keys].sort((x, y) => (v(y) - v(x)) || (x < y ? -1 : 1));
  return ranked.length < 2 ? ranked[0] : pickVariant(bag, ranked[0], ranked[1], family, duels);
}

/* ── 翼 wing variants (G4 round 2, 2026-08-07) — 雞 vs 鴨鵝, ported from the
   lab v7 vocabulary. The lab built three (雞 short round · 鴨 pointed swift ·
   鵝 long broad); the shipped DETECTOR is two-way (`sub.air` = chicken vs
   duck_goose, from the diet flags), so the port is the framework's own 肢
   table pairing: 雞 short flutter fans vs 鴨鵝 long glide strokes — the 鴨/鵝
   split waits on a finer detector, per "no detector, no feature".

   Blend rule (lab v5): GEOMETRY blends continuously with the sub-node mix.
   Wings are strokes with no discrete terminal detail, so blend-only is the
   whole rule here. The multipliers are calibrated so the lab's endpoint
   RATIOS survive (chicken ≈ half the glide length, ~2× the fan spread,
   raised toward flutter; measured off 雞翼/鴨翼/鵝翼 in
   mokling-lab-v7-vocabulary.js) while the EQUAL MIX is exactly 1.0 —
   undifferentiated air renders today's generic fan byte-for-byte, which is
   both the fail-closed default and what keeps every no-sub-air being
   unchanged. Legacy mode is pinned neutral regardless of data: the frozen
   control never grows variants. */
export type WingShape = {
  lenMul: number; widthMul: number; spreadMul: number; baseAng: number; humpMul: number;
  countMul: number; speciesK: number;
};
export function wingShape(
  airBag: { chicken?: number; duck_goose?: number } | undefined,
  mode: GrowthMode,
): WingShape {
  const NEUTRAL: WingShape = {
    lenMul: 1, widthMul: 1, spreadMul: 1, baseAng: -0.32, humpMul: 1, countMul: 1,
    speciesK: 0,
  };
  if (mode !== 'metabolism') return NEUTRAL;
  // NOT subMix: its absent→1 default is right for the legs' calibrated
  // blending but wrong for a lived bag here — it would dilute a pure chicken
  // eater with a phantom equal-mix goose (the same absent-means-zero lesson
  // pickVariant already carries from G9). Empty bag → neutral, by the total.
  const ck0 = Math.max(0, airBag?.chicken ?? 0);
  const dg0 = Math.max(0, airBag?.duck_goose ?? 0);
  const tot = ck0 + dg0;
  if (tot <= 0) return NEUTRAL;
  const k = (ck0 / tot) * 2 - 1; // +1 pure 雞 … −1 pure 鴨鵝
  // 雞 gets TWO one-sided dials on top of the shape blend — thickness and
  // curvature only (owner, 2026-08-07, on the wing bench, superseding the
  // earlier mass-boost attempt: "same length, width, and stroke count. just
  // the stroke thickness increase, and more curved"). Length, fan spread
  // (spreadMul, the owner's "width") and stroke count now match the plain
  // species blend exactly — no chicken bonus — which is why countMul is a
  // flat 1 below rather than a computed value. `chickenBoost` ramps 0→1 only
  // across k∈[0,1] (neutral through pure 雞) and is exactly 0 for any
  // 鴨鵝-leaning mix — one-sided, so the goose endpoint, the no-data neutral
  // cell, and legacy stay untouched, each pinned by its own test. 40% picked
  // for both dials (no number was given for curvature) — an easy pair of
  // knobs to retune independently on the next round if either reads wrong. */
  const chickenBoost = Math.max(0, k);
  // A second thickness pass, STACKED on the first (owner, same session:
  // "increase stroke thickness by another 50%" — "another" read as on top of
  // the existing +40%, not a replacement for it). Both terms ride the same
  // chickenBoost, so the stack stays one continuous ramp rather than two
  // independently-shaped curves that could disagree at partial mixes; at
  // pure 雞 that is 1.4 × 1.5 = 2.1× the plain blend's width value.
  const thicknessMul = (1 + 0.4 * chickenBoost) * (1 + 0.5 * chickenBoost); // stroke thickness only
  const curveMul = 1 + 0.4 * chickenBoost;     // extra bow on top of the blend's own hump — untouched by this round
  // 鴨鵝 gets its own one-sided thickness dial, mirroring 雞's (owner, same
  // session: "duck / goose stroke thickness increase by 20%"). `gooseBoost`
  // ramps 0→1 only across k∈[-1,0] (pure 鴨鵝 through neutral) and is exactly
  // 0 for any 雞-leaning mix, so this never touches the chicken side or
  // stacks with `thicknessMul` — at any given k only one of the two boosts
  // is non-1. No curvature dial requested for this side.
  const gooseBoost = Math.max(0, -k);
  const gooseThicknessMul = 1 + 0.2 * gooseBoost; // stroke thickness only
  return {
    lenMul: 1 - 0.35 * k,                   // UNCHANGED — same length as the plain blend
    widthMul: (1 + 0.3 * k) * thicknessMul * gooseThicknessMul, // 雞 1.3→2.73 · 鴨鵝 0.7→0.84
    spreadMul: 1 + 0.5 * k,                 // fan width — untouched, always was
    baseAng: -0.32 - 0.28 * k,              // 雞 raised toward flutter, 鴨鵝 flat glide
    humpMul: (1 + 0.3 * k) * curveMul,      // 雞 rounder arc AND more curved · 鴨鵝 untouched
    countMul: 1,                            // UNCHANGED — same stroke count as the plain blend
    speciesK: k,                            // feeds wingFlapAngle's burst-pattern blend below
  };
}

// 雞's flap period: ONE big lead flap, then a burst of quick beats, then a
// held pause, on loop — "before the burst of flap, add a BIG flap with
// magnitude 2.5 at the beginning then the burst with 1.8" (owner, same
// bench, testing a variant — "if not good revert back to this one"). The
// big flap is prepended as its OWN segment rather than folded into the
// burst, extending the period by its own duration (1600→1850ms) so the
// burst and pause keep their previously-tuned lengths untouched.
// Oscillation phase rides `cyc` (time WITHIN the loop, reset per segment),
// not raw `t` — see the periodicity note in the original burst-pause round.
const CHICKEN_BIG_FLAP = 250, CHICKEN_BIG_OSC = 0.025, CHICKEN_BIG_AMP = 2.5;
const CHICKEN_BURST = 700, CHICKEN_OSC = 0.04, CHICKEN_AMP = 1.8;
const CHICKEN_PERIOD = CHICKEN_BIG_FLAP + CHICKEN_BURST + 900; // 900ms pause, unchanged
function chickenBurstPause(t: number): number {
  let cyc = t % CHICKEN_PERIOD;
  if (cyc < CHICKEN_BIG_FLAP) {
    const env = Math.sin(Math.PI * (cyc / CHICKEN_BIG_FLAP));
    return CHICKEN_BIG_AMP * env * Math.sin(CHICKEN_BIG_OSC * cyc);
  }
  cyc -= CHICKEN_BIG_FLAP;
  if (cyc < CHICKEN_BURST) {
    const env = Math.sin(Math.PI * (cyc / CHICKEN_BURST));
    return CHICKEN_AMP * env * Math.sin(CHICKEN_OSC * cyc);
  }
  return 0; // the pause — held still, not slow
}

// 鴨鵝's flap period: two flap-then-glide phases per loop, unequal — a
// launch-like ramp (a few beats trailing into one longer stroke) then a
// long glide, then a single flap then a shorter glide — "flap flap
// flappppp ..... gliding ..... then flap ...... gliding ..... then loop"
// (owner, same message). 4200ms period: ramp 900ms (~2.5 cycles, a flatter
// sin(πφ)^0.6 envelope so the tail reads as held rather than clipped),
// glide 1400ms, single flap 400ms (~1 cycle), glide 1500ms.
// Glide is now a SLOW SWAY, not dead stillness (owner, same bench: "during
// gliding, there should be slow animation, not dead still") — one gentle
// full cycle (sin(2πφ), φ = position within that glide's own duration) at
// GOOSE_GLIDE_AMP, well under a flap's GOOSE_AMP reach. A full cycle starts
// AND ends at exactly 0, so it always meets the flap segments on either
// side at zero too — no snap at either boundary, pinned by test.
const GOOSE_PERIOD = 4200, GOOSE_RAMP = 900, GOOSE_GLIDE1 = 1400, GOOSE_FLAP2 = 400, GOOSE_GLIDE2 = 1500;
const GOOSE_OSC_RAMP = 0.0175, GOOSE_OSC_FLAP2 = 0.0157, GOOSE_AMP = 1.4, GOOSE_GLIDE_AMP = 0.6;
function gooseBurstGlide(t: number): number {
  let cyc = t % GOOSE_PERIOD;
  if (cyc < GOOSE_RAMP) {
    const env = Math.pow(Math.sin(Math.PI * (cyc / GOOSE_RAMP)), 0.6);
    return GOOSE_AMP * env * Math.sin(GOOSE_OSC_RAMP * cyc);
  }
  cyc -= GOOSE_RAMP;
  if (cyc < GOOSE_GLIDE1) return GOOSE_GLIDE_AMP * Math.sin(2 * Math.PI * (cyc / GOOSE_GLIDE1));
  cyc -= GOOSE_GLIDE1;
  if (cyc < GOOSE_FLAP2) {
    const env = Math.sin(Math.PI * (cyc / GOOSE_FLAP2));
    return GOOSE_AMP * env * Math.sin(GOOSE_OSC_FLAP2 * cyc);
  }
  cyc -= GOOSE_FLAP2;
  return GOOSE_GLIDE_AMP * Math.sin(2 * Math.PI * (cyc / GOOSE_GLIDE2));
}

/**
 * The wing flap angle contribution, in radians (before the caller's own
 * (0.3 + airShare) reach scale) — a continuous cross-fade between three
 * waveforms by `speciesK` (`WingShape.speciesK`, +1 pure 雞 … −1 pure 鴨鵝):
 * the ORIGINAL plain single sine at k=0 (so any being with no lived sub.air,
 * or any equal-mix eater, keeps exactly today's motion, unchanged since
 * before this round), crossing into 雞's burst-pause or 鴨鵝's burst-glide
 * pattern as k moves toward either pure endpoint. `chickenBoost`/
 * `gooseBoost` are the SAME one-sided ramps `wingShape` already uses for
 * its thickness dials, so this fades in on the identical schedule.
 */
export function wingFlapAngle(k: number, t: number): number {
  const chickenBoost = Math.max(0, k);
  const gooseBoost = Math.max(0, -k);
  const plain = Math.sin(t * 0.0013); // unchanged: the pre-existing single-sine flutter
  return 0.13 * (
    plain * (1 - chickenBoost - gooseBoost)
    + chickenBurstPause(t) * chickenBoost
    + gooseBurstGlide(t) * gooseBoost
  );
}

/* ── 尾 tail — G4 round 3 (2026-08-07): ONE tail slot, Decision 6 wired ──────
   A sub-node is a POOL of parts, and something must choose WHICH part grows
   (growth R&D Decision 6). For the tail the choice runs vacancy → priority:

   - 魚: fins are unported, so the forked tail is the fish sub-node's FIRST
     portable part — it claims at the same bud floor a claw variant does.
     軟體 cephalopod never claims (its parts are tentacles, not tails).
   - 牛/豬: the foot slot belongs to the dominant land sub-node, so a species
     that does NOT hold the foot routes its expression to the tail — the
     owner's own example ("a pork-legged body … grows a cow TAIL"). The
     species that DOES hold the foot only buds a tail as a SECOND part.
   - 甲殼/禽: claws and wings express whenever those domains do at all, so
     their tails are always SECOND parts.

   A SECOND part unlocks at the depth where stage() saturates (evidence 12,
   FORM_FLOOR + FORM_SPAN): the first part is fully grown, so further depth
   spends as breadth — "at 精, a second may bud". Contention for the one slot:
   dominant claimant by evidence, exact ties by the framework's fixed variants
   order (魚 甲殼 牛 豬 禽) so replay stays deterministic. Duels do not enter:
   they resolve same-family dominance for feet and claw prime seats; the tail
   contest is cross-family, where evidence is the only honest rank.

   Legacy returns null unconditionally — the frozen control grows no parts. */
export type TailVariant = 'fish' | 'crustacean' | 'beef' | 'pork' | 'poultry';
export type TailPlan = { variant: TailVariant; sizeF: number };

const TAIL_MIN = 0.35;                        // a newborn tail pops in, like BUD_MIN
const TAIL_SECOND = 12, TAIL_SECOND_SPAN = 7; // breadth unlocks where depth saturates

export function tailPlan(domains: DomainEvidence, mode: GrowthMode): TailPlan | null {
  if (mode !== 'metabolism') return null;
  const S = limbStrengths(domains, 'metabolism');
  const firstF = (e: number) =>
    TAIL_MIN + (1 - TAIL_MIN) * smooth01((e - SUB_BUD) / (SUB_FORM - SUB_BUD));
  const secondF = (e: number) =>
    TAIL_MIN + (1 - TAIL_MIN) * smooth01((e - TAIL_SECOND) / TAIL_SECOND_SPAN);
  const claims: { variant: TailVariant; e: number; sizeF: number }[] = [];

  const fish = Math.max(0, domains.sub?.sea?.fish ?? 0);
  if (fish > SUB_BUD) claims.push({ variant: 'fish', e: fish, sizeF: firstF(fish) });

  // Land claims exist only once legs do — the pool's priority is legs > tail,
  // so with no legs at all the node's expression starts there, not here.
  if (S.legs > 0) {
    const foot = domOfStable<'beef' | 'pork' | 'chicken'>(
      domains.sub?.land, ['beef', 'pork', 'chicken'], 'land', domains.duels);
    for (const sp of ['beef', 'pork'] as const) {
      const e = Math.max(0, domains.sub?.land?.[sp] ?? 0);
      if (foot !== sp) {
        if (e > SUB_BUD) claims.push({ variant: sp, e, sizeF: firstF(e) });
      } else if (e > TAIL_SECOND) claims.push({ variant: sp, e, sizeF: secondF(e) });
    }
  }

  const shell = Math.max(0, domains.shell ?? 0);
  if (shell > TAIL_SECOND) claims.push({ variant: 'crustacean', e: shell, sizeF: secondF(shell) });
  const air = Math.max(0, domains.air ?? 0);
  if (air > TAIL_SECOND) claims.push({ variant: 'poultry', e: air, sizeF: secondF(air) });

  if (!claims.length) return null;
  const ORDER: TailVariant[] = ['fish', 'crustacean', 'beef', 'pork', 'poultry'];
  claims.sort((x, y) => (y.e - x.e) || (ORDER.indexOf(x.variant) - ORDER.indexOf(y.variant)));
  return { variant: claims[0].variant, sizeF: claims[0].sizeF };
}

// 牛尾 swat (owner: "flips and wiggle, like a cow keeping the mosquitos /
// flies away"): a cow's tail hangs in a lazy wiggle for most of the loop,
// then CRACKS across the flank — out, back through centre, out the other
// side, back — and settles into the wiggle again. Keyed off time-within-
// the-loop so every pass is identical (the wing rounds' periodicity
// lesson). The wiggle fits the period in WHOLE cycles so the loop wrap is
// seamless, and the swat's sin(πφ) envelope starts and ends at exactly 0,
// so it rides on top of the wiggle without ever snapping against it.
const COW_PERIOD = 3400, COW_SWAT_START = 2720, COW_SWAT_LEN = 340;
const COW_WIGGLE_AMP = 0.07, COW_SWAT_AMP = 0.55;
// Wraps negative t correctly (JS's % keeps the sign of its left operand) —
// needed because the bend function below samples this at a per-point time
// OFFSET, which can go negative near t=0.
function cowSwat(t: number): number {
  const cyc = ((t % COW_PERIOD) + COW_PERIOD) % COW_PERIOD;
  const wiggle = COW_WIGGLE_AMP * Math.sin(TAU * 5 * (cyc / COW_PERIOD));
  if (cyc < COW_SWAT_START || cyc >= COW_SWAT_START + COW_SWAT_LEN) return wiggle;
  const ph = (cyc - COW_SWAT_START) / COW_SWAT_LEN;
  // sin(2πφ) is the double-sided whip; sin(πφ) tapers it in and out
  return wiggle + COW_SWAT_AMP * Math.sin(TAU * ph) * Math.sin(Math.PI * ph);
}

/** Lab v7's leaf blade, ported: a filled quadratic leaf from (x,y) at `ang`. */
function tailBlade(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, L: number, w: number, ang: number,
) {
  const c = Math.cos(ang), s = Math.sin(ang);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + c * L * 0.5 - s * w, y + s * L * 0.5 + c * w, x + c * L, y + s * L);
  ctx.quadraticCurveTo(x + c * L * 0.5 + s * w, y + s * L * 0.5 - c * w, x, y);
  ctx.fill();
}

/* The five 尾 gestures, ported from mokling-lab-v7-vocabulary.js and re-based
   per the port checklist: every gesture starts at (0,0) — the buried base —
   in a LOCAL frame whose +x is the drawn silhouette's outward ray at the
   anchor (checklist step 4: direction from the drawn body, one anchor, no
   mirrored hand-rolled signs — the class of bug that once drew tails INTO
   the body). The rotation is computed in code, never via ctx.translate/rotate:
   the SVG recorder implements exactly the ops the renderer uses and fails
   loud on anything else, and teaching it a transform stack would also mean
   making ink measurement transform-aware — coordinates are the cheaper, safer
   side of that trade. Lengths are in R units so the tail scales with the
   body; the whole gesture scales by sizeF the way a claw does. */
function drawTail(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, outAng: number, R: number, plan: TailPlan, t: number,
) {
  const f = plan.sizeF;
  const ink = 'rgba(33,29,24,.93)'; // 骨 parts wear neutral ink, never 膚's colour
  // 魚 gets its own motion — a real swimming flip, not the shared gentle sway
  // (owner, on the tail bench: "make it flip like a fish tail"). Bigger
  // amplitude and ~4x the frequency of the other four gestures' sway, so it
  // reads as a rhythmic beat rather than a drift. Continuous, not the wings'
  // burst-pause: a swimming tail strokes steadily, it doesn't rest between
  // bursts the way a bird's wing does.
  const FISH_FLIP_AMP = 0.32, FISH_FLIP_FREQ = 0.0032;
  // 牛尾 doesn't rotate as one rigid unit (owner: "the movement within the
  // Stroke, bending left and right, instead of the whole thing like moving
  // a stiff curved stick") — its motion is applied per-point, below, so it
  // takes NO share of `th`; the base direction stays exactly `outAng`.
  const sway = !t ? 0
    : plan.variant === 'fish' ? Math.sin(t * FISH_FLIP_FREQ + 1.1) * FISH_FLIP_AMP
    : plan.variant === 'beef' ? 0
    : Math.sin(t * 0.0008 + 1.1) * 0.055;
  const th = outAng + sway;
  const cosT = Math.cos(th), sinT = Math.sin(th);
  const px = (lx: number, ly: number) => bx + lx * cosT - ly * sinT;
  const py = (lx: number, ly: number) => by + lx * sinT + ly * cosT;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  if (plan.variant === 'fish') {
    /* "one solid two-fluke shape off the lower-right rim" — the owner's own
       sketch (lab v7 TRACES 其二), not VOCAB's specimen study. The two differ
       structurally and the trace is the approved one: NO peduncle, both flukes
       springing from a single point at the rim, and the pair swung off the
       radial so the tail trails horizontally rather than pointing straight out.
       Measured off the trace: flukes 0.49·R long, half-width 0.128·R, bisector
       0.47 rad off the outward ray. The trace's own 0.76 rad spread between
       them narrowed to 0.42 (owner, tail bench: "can we have the fork overlap
       each other more") — bisector held fixed, so the pair still trails the
       same direction, just tighter; both flukes share one origin point, so a
       smaller spread reads directly as more of their filled area crossing. */
    const FORK_SPREAD = 0.42, FORK_BISECTOR = -0.473;
    tailBlade(ctx, px(0, 0), py(0, 0), R * 0.49 * f, R * 0.128 * f,
      th + FORK_BISECTOR - FORK_SPREAD / 2);
    tailBlade(ctx, px(0, 0), py(0, 0), R * 0.49 * f, R * 0.128 * f,
      th + FORK_BISECTOR + FORK_SPREAD / 2);
  } else if (plan.variant === 'crustacean') {
    /* A true 龍蝦 abdomen (owner redesign, 2026-08-07: "look much more like
       a lobster tail … the whole lobster tail would replace the bottom of
       the body, not diagonal, but vertically attached"), superseding the
       old diagonal telescope. Five overlapping tergite segments narrowing
       down the axis — ONE ink, no interior lines: the scalloped silhouette
       where each rounded plate steps in IS the segmentation, per the
       cut-paper style. Then the five-piece fan: telson centre, two uropods
       per side, flaring WIDER than the last segment — the flare after the
       taper is the lobster signature. The caller anchors this at the
       body's drawn bottom point and passes a vertical axis; z-order puts
       it beneath every other appendage ("under the tentacle, covering
       nothing"). */
    const SEGS: [number, number, number][] = [
      // [centre along the axis, half-length, lateral half-width] · R
      [0.10, 0.13, 0.50], [0.28, 0.125, 0.42], [0.45, 0.12, 0.35],
      [0.61, 0.11, 0.29], [0.76, 0.10, 0.24],
    ];
    for (const [cxA, hL, hw] of SEGS) {
      ctx.beginPath();
      ctx.ellipse(px(cxA * R * f, 0), py(cxA * R * f, 0), hL * R * f, hw * R * f, th, 0, TAU);
      ctx.fill();
    }
    // Shellfish 2.0 (owner): the body's 甲 band language extends onto the
    // abdomen — at each tergite junction, the same dark-gap-plus-lit-edge
    // pair the carapace plates wear, arced gently toward the fan so each
    // line follows its plate's curvature. Alphas are the 甲 overlay's
    // large-render base values; the tail has no thumbnail contrast ramp yet.
    for (let i = 0; i < SEGS.length - 1; i++) {
      const xj = (SEGS[i][0] + SEGS[i][1] * 0.5 + SEGS[i + 1][0] - SEGS[i + 1][1] * 0.5) / 2 * R * f;
      const span = SEGS[i + 1][2] * 0.9 * R * f;
      const bow = 0.09 * R * f;
      const band = (off: number) => {
        ctx.beginPath();
        ctx.moveTo(px(xj + off, -span), py(xj + off, -span));
        ctx.quadraticCurveTo(px(xj + off + bow, 0), py(xj + off + bow, 0),
          px(xj + off, span), py(xj + off, span));
        ctx.stroke();
      };
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(8,7,6,0.62)';           // the gap the next plate slides into
      ctx.lineWidth = Math.max(1.4, R * 0.05 * f);
      band(R * 0.025 * f);
      ctx.strokeStyle = `rgba(${HILITE},0.24)`;       // lit plate edge, drawn over it
      ctx.lineWidth = Math.max(1, R * 0.03 * f);
      band(0);
    }
    /* The fan, take 2 (owner: "more like a lobster tail tip"): five broad
       overlapping PADDLES instead of thin leaves — telson centre, two
       uropods per side — each a rounded ellipse radiating from the hinge,
       overlapping its neighbour, the outer pair shorter. The wide scalloped
       semicircle this stack makes is the real animal's fan read, and it
       stays in the same stacked-ellipse language as the tergites above. */
    const fanX = 0.84 * R * f;
    const FAN: [number, number, number, number][] = [
      // [angle off the axis, hinge→centre distance, radial half-length, lateral half-width] · R
      // outer pair swung to ±0.80 — at ±0.62 the five paddles merged into one
      // rounded knob at bench size; the wider swing is what lets the scallop
      // notches between paddle tips survive, which is the whole fan read
      [-0.80, 0.20, 0.16, 0.095], [-0.40, 0.23, 0.19, 0.10],
      [0, 0.25, 0.21, 0.095],
      [0.40, 0.23, 0.19, 0.10], [0.80, 0.20, 0.16, 0.095],
    ];
    for (const [a, d, rL, rW] of FAN) {
      const lx = fanX + Math.cos(a) * d * R * f, ly = Math.sin(a) * d * R * f;
      ctx.beginPath();
      ctx.ellipse(px(lx, ly), py(lx, ly), rL * R * f, rW * R * f, th + a, 0, TAU);
      ctx.fill();
    }
  } else if (plan.variant === 'beef') {
    // thin whip rising then drooping, tufted at the tip. Shrunk 10% (owner,
    // tail bench: first tried 40%, "revert, and shrink 10% instead") — a
    // local scale on top of sizeF, not a change to sizeF itself, so the
    // growth ramp (bud → full) is untouched and only the FULLY-GROWN
    // gesture reads smaller.
    const BEEF_SHRINK = 0.9;
    const bf = f * BEEF_SHRINK;
    /* The swat CURVES the stroke via genuine per-point ROTATION, not a
       small-angle linear offset (owner, third correction: "right now it is
       bending downward with the tip facing the ground, the right animation
       would be bending upward with the tip facing the sky" — the additive
       ly-nudge from the previous round physically cannot get there; it's a
       small-angle approximation of rotation, and no additive shift reaches
       past horizontal into "pointing up" without the geometry breaking
       down. This round rotates each point's ORIGINAL local position around
       the fixed base by a real angle, so a big enough swing genuinely
       flips the tip from hanging down to pointing at the sky.
       Each point still samples `cowSwat` at a per-point DELAYED time
       (`COW_LAG`, growing with `u`) — the follow-through/drag principle
       from the previous round, which the ratio-of-two-points check proved
       is what makes it read as curving rather than rigid. `ROT_GAIN`
       amplifies `cowSwat`'s own small-angle range (peak ≈0.62 rad) up to a
       genuine flip at the tip (≈2.6 rad ≈149°, well past horizontal);
       `u^1.3` still keeps the near-body length stiffer than the tip. The
       tuft rotates by the tip's own angle, since it's rigidly attached. */
    const ROT_POW = 1.3, ROT_GAIN = 4.2, COW_LAG = 180;
    const rotAt = (u: number) => (t ? cowSwat(t - COW_LAG * u) : 0) * ROT_GAIN * Math.pow(u, ROT_POW);
    const rotate = (lx0: number, ly0: number, ang: number): [number, number] => {
      const c = Math.cos(ang), s = Math.sin(ang);
      return [lx0 * c - ly0 * s, lx0 * s + ly0 * c];
    };
    const [c1x, c1y] = rotate(R * 0.5 * bf, -R * 0.28 * bf, rotAt(0.45));
    const [c2x, c2y] = rotate(R * 0.72 * bf, R * 0.3 * bf, rotAt(0.75));
    const tipRot = rotAt(1.0);
    const [tipX, tipY] = rotate(R * 0.55 * bf, R * 0.72 * bf, tipRot);
    ctx.lineWidth = Math.max(1, R * 0.11 * bf);
    ctx.beginPath();
    ctx.moveTo(px(0, 0), py(0, 0));
    ctx.bezierCurveTo(px(c1x, c1y), py(c1x, c1y), px(c2x, c2y), py(c2x, c2y), px(tipX, tipY), py(tipX, tipY));
    ctx.stroke();
    for (const a of [-0.5, 0, 0.5]) {
      tailBlade(ctx, px(tipX, tipY), py(tipX, tipY), R * 0.3 * bf, R * 0.075 * bf, th + Math.PI / 2 + a + tipRot);
    }
  } else if (plan.variant === 'pork') {
    // the curl: a short lead-out clear of the body, then a decaying coil
    ctx.lineWidth = Math.max(1, R * 0.15 * f);
    ctx.beginPath();
    ctx.moveTo(px(0, 0), py(0, 0));
    const ccx = R * 0.62 * f, ccy = -R * 0.12 * f;
    ctx.quadraticCurveTo(
      px(R * 0.3 * f, -R * 0.1 * f), py(R * 0.3 * f, -R * 0.1 * f),
      px(ccx + R * 0.3 * f, ccy), py(ccx + R * 0.3 * f, ccy));
    for (let i = 0; i <= 44; i++) {
      const u = i / 44, ca = u * TAU * 1.55, rr = R * 0.3 * f * (1 - u * 0.42);
      const lx = ccx + Math.cos(ca) * rr, ly = ccy + Math.sin(ca) * rr * 0.92;
      ctx.lineTo(px(lx, ly), py(lx, ly));
    }
    ctx.stroke();
  } else {
    // 禽 fan: five blades from one hinge, centre-longest
    for (let i = 0; i < 5; i++) {
      const a = -0.7 + i * 0.35;
      tailBlade(ctx, px(0, 0), py(0, 0), R * (0.85 - Math.abs(i - 2) * 0.09) * f,
        R * 0.085 * f, th + a);
    }
  }
}

/** Lower-right flank, between the claw prime seat and the legs — the outward
 *  ray here (~0.78 rad) is the one the owner's traced tails sit on (0.753). */
const TAIL_SEAT = 2.35;
/** How far out the base sits, as a fraction of centre → flank point. Four
 *  gestures lead out from their base with a stem, segments or a coil, so the
 *  base itself is hidden at 0.8. 魚 has no stem — its flukes ARE the gesture
 *  and spring straight off the rim, which is where the owner's trace anchors
 *  them (0.956); burying that deep would swallow half the fork. Raised
 *  0.95→0.98 (owner, on the tail bench: "stick out the fish tail more",
 *  corrected to mean POSITION after a first attempt wrongly grew the
 *  gesture's own size instead — "try 0.98"). Kept just inside 1.0 for the
 *  same reason WRIST_BURIAL is: a join with no body pixels behind it floats
 *  loose. */
const TAIL_BURIAL = (v: TailVariant) => (v === 'fish' ? 0.98 : 0.8);

/* 腿 · leg. cow = thick pillar on a cleft hoof; pig = shorter, softer, small
   trotter; chicken = thin, backward knee, three splayed toes. (lab v5) */
/** LENGTH still scales with the growth factor; GIRTH gets its own, passed in.
 *  A limb that scales both linearly comes out of the bud stage as a wire —
 *  35% long and 35% thin. A young animal's leg is short and CHUNKY, so the
 *  caller sends a fatter width factor for a young limb (see BUD_GIRTH). */
function drawLeg(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, R: number, f: number,
  mix: Record<'beef' | 'pork' | 'chicken', number>, lean: number,
  widthF: number = f,
  footType: 'beef' | 'pork' | 'chicken' = domOf(mix),
) {
  const bf = mix.beef, pk = mix.pork, ck = mix.chicken;
  const len = R * (0.42 * bf + 0.3 * pk + 0.5 * ck) * f;
  const w = R * (0.15 * bf + 0.14 * pk + 0.058 * ck) * widthF;
  const kneeX = bx + lean * len * 0.05 - ck * len * 0.2; // chicken bends backward
  const kneeY = by + len * 0.52;
  const footX = bx + lean * len * 0.12 + ck * len * 0.1;
  const footY = by + len;
  ctx.fillStyle = 'rgba(33,29,24,.94)';
  taperQuad(ctx, bx, by, kneeX, kneeY, w * 1.1, w * (0.95 - 0.25 * ck));
  taperQuad(ctx, kneeX, kneeY, footX, footY, w * (0.95 - 0.25 * ck), w * (0.85 - 0.35 * ck));
  const type = footType;
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
  mode: GrowthMode = 'legacy',
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
  const pts = bodyAt(t);
  /* THE BODY FRAME. Every mark that sits ON the skin — position OR outward
     direction — measures from here, never from (cx, cy, R).
     (cx, cy) is where the body was ASKED to be; BB is where it actually got
     drawn, and the two differ because the palate's taste lobes push the
     silhouette around. Measured: ~2px apart on the owner's 18-dim profile,
     but 16px on a 2-dim one — so the error is worst for NEW palates, which
     is precisely whose first creature matters most.
     cx/cy/R stay legal for two things only: building the silhouette itself
     (bodyAt, above) and as SIZE units. Positioning from them is the bug that
     hid 軟's halo under the belly and slid 糙's clusters off their seats. */
  const BB = bodyBox(pts);
  // appendages attach to the DRAWN silhouette, never to a bounding box — a
  // wrist placed off global extents buries wherever the body bulges (measured:
  // claw reach collapsed to 9% on the blob before this rule).
  const bottom = (fr: number) => pts[Math.round(((Math.PI + fr * 0.6) / TAU) * P) % P];
  const flank = (side: number, h: number) =>
    pts[(Math.round((((side > 0 ? h : TAU - h)) / TAU) * P) + P) % P];

  ctx.lineCap = 'round';
  // ONE gate layer for every appendage — limbStrengths carries both modes and
  // the whole rationale; no block below re-derives a gate.
  const S = limbStrengths(domains, mode);

  // ── skin type: ONE source of truth, `skinOf` above, which carries the
  // rearrangement's rationale and is unit-tested. Never re-derive the
  // conditions here — a second copy is exactly how 軟 drifted last time.
  // TWO REGISTERS, resolved independently — 膚 from how it was cooked, 骨 from
  // what was eaten. skinOf cannot even see `domains` any more, which is what
  // stops 膚 quietly re-acquiring a domain dependency the way 軟 once did.
  const skin = skinOf(m);
  const bone = boneOverlay(domains, { s, l, a, c, f, fg, ag }, mode);
  const isShell = bone.shell;
  const isSoft = skin === 'soft';
  const isSmooth = skin === 'smooth';
  const isRough = skin === 'rough';
  const isGlazed = skin === 'glazed';
  const isGolden = skin === 'golden';
  const isCharred = skin === 'charred';
  const isHairy = bone.fur;
  const SKIN = (s + c + ag) >= (l + a + f + fg) ? SKIN_SMOOTH_SEA : SKIN_SMOOTH_LAND;

  // 軟 SOFT goes down first — halo, membrane, core all behind every appendage,
  // so nothing the creature grows is occluded by its own skin. Z-order is the
  // fix; opacity was the wrong lever (lab, measured).
  if (isSoft) {
    /* EVERY layer here anchors to `bodyBox(pts)` — the drawn silhouette —
       never to (cx, cy). The halo used to use (cx, cy) while the core two
       layers below already used the drawn box, so on a lobed body the pale
       ruffle slid off the crown and pooled under the belly. Both now read
       from one box, so they cannot disagree again. Sizes are proportional to
       that box too: expressing the halo in R/widen/squash sized it from the
       NOMINAL body, so it could sit narrower than the drawn one and let the
       flanks poke through the thing meant to sit behind them. */
    ctx.fillStyle = SKIN_SOFT.halo;
    const HN = 96; const hp: Pt[] = [];
    for (let i = 0; i < HN; i++) {
      const ha = (i / HN) * TAU;
      const k = 1
        + Math.sin(ha * 6 + (t ? t * 0.0011 : 0)) * 0.07
        + Math.sin(ha * 9 - (t ? t * 0.0007 : 0)) * 0.042;
      // Lifted toward the crown: the ruffle is a soft-food silhouette read
      // from the owner's reference sheet (「ruffled cloud bumps along the
      // crown」), so the clearance must be widest at the top and nearly shut
      // at the belly — which is also where the darker core lands.
      hp.push({
        x: BB.cx + BB.hr * 0.06 + Math.cos(ha) * BB.hr * 1.12 * k,
        y: BB.cy - BB.vr * 0.08 + Math.sin(ha) * BB.vr * 1.12 * k,
      });
    }
    ctx.beginPath(); closedPath(ctx, hp); ctx.fill();
    ctx.fillStyle = SKIN_SOFT.layer;
    ctx.beginPath(); closedPath(ctx, pts); ctx.fill();
    ctx.fillStyle = SKIN_SOFT.core;
    ctx.beginPath();
    ctx.ellipse(BB.cx, BB.cy + BB.vr * 0.13, BB.hr * 0.8, BB.vr * 0.7, 0, 0, TAU);
    ctx.fill();
  }

  // ── appendages BEHIND the body ────────────────────────────────────────────
  // 尾 tail — the ONE tail slot (tailPlan, G4 round 3). FIRST in the section,
  // so it is the deepest appendage of all: every other limb draws over it
  // (owner, on the 龍蝦 redesign: "under the tentacle, covering nothing").
  const tail = tailPlan(domains, mode);
  if (tail) {
    if (tail.variant === 'crustacean') {
      // 龍蝦 abdomen hangs VERTICALLY from the drawn bottom point — the one
      // tail whose axis is a stated design constant (owner: "not diagonal,
      // vertically attached to the bottom part of the body") rather than the
      // computed outward ray, which at the bottom sits within a few degrees
      // of vertical anyway. Buried at 0.85 so the body fill swallows the
      // top tergite's join.
      const p = bottom(0);
      const tbx = BB.cx + (p.x - BB.cx) * 0.85, tby = BB.cy + (p.y - BB.cy) * 0.85;
      drawTail(ctx, tbx, tby, Math.PI / 2, R, tail, t);
    } else {
      // the other four: anchored to the DRAWN lower flank, base buried like
      // a wrist; outward direction is the silhouette ray (BB centre → flank).
      const p = flank(1, TAIL_SEAT);
      const bur = TAIL_BURIAL(tail.variant);
      const tbx = BB.cx + (p.x - BB.cx) * bur, tby = BB.cy + (p.y - BB.cy) * bur;
      drawTail(ctx, tbx, tby, Math.atan2(p.y - BB.cy, p.x - BB.cx), R, tail, t);
    }
  }
  // wings — lateral fans from the shoulder, angled out
  if (S.wings.on) {
    // 雞/鴨鵝 variant blend (wingShape) — at equal mix every multiplier is 1.0
    // and baseAng is the original −0.32, so this line is a no-op for any being
    // without lived sub.air, and always a no-op in legacy mode.
    const WS = wingShape(domains.sub?.air, mode);
    const span = R * (0.55 + 0.75 * S.wings.shareF) * S.wings.evF * WS.lenMul;
    const flap = t ? wingFlapAngle(WS.speciesK, t) * (0.3 + a) : 0;
    for (const side of [-1, 1]) {
      const base = flank(side, 0.8);
      // countMul is 1.0 for everything except a 雞-leaning mix (see wingShape),
      // so this is a no-op for goose, neutral, and legacy — same guarantee
      // every other WS multiplier already carries.
      const nS = Math.round((4 + Math.min(3, Math.floor(ev('air') / 25))) * WS.countMul);
      for (let w = 0; w < nS; w++) {
        const ang = side > 0
          ? (WS.baseAng + 0.14 * WS.spreadMul * w + flap)
          : (Math.PI - WS.baseAng - 0.14 * WS.spreadMul * w - flap);
        const L = span * (1 - 0.12 * w);
        ctx.strokeStyle = `rgba(33,29,24,${0.55 - 0.06 * w})`;
        ctx.lineWidth = Math.max(1, R * 0.05 * WS.widthMul * (1 - 0.12 * w));
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(
          base.x + Math.cos(ang) * L * 0.5, base.y + Math.sin(ang) * L * 0.5 - R * 0.3 * WS.humpMul,
          base.x + Math.cos(ang) * L, base.y + Math.sin(ang) * L - R * 0.15);
        ctx.stroke();
      }
    }
  }
  // fronds — rising leaf curves with a blade at the tip
  const frondF = S.fronds;
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
  const agF = S.algae;
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
  if (S.tendrils.on) {
    const nT = 2 + Math.min(4, Math.floor(ev('sea') / 14));
    const L = R * (0.8 + 0.6 * s) * S.tendrils.evF;
    for (let i = 0; i < nT; i++) {
      const fr = (i - (nT - 1) / 2) / Math.max(1, (nT - 1) / 2);
      // Floored at 0.22 clear of dead centre (owner, on the tail bench:
      // "move the tentacle a bit, away from the tail so that they could be
      // seen") — 尾 draws FIRST/deepest of every appendage (shellfish 2.0's
      // z-order round), so a tendril anchored at or near bottom(0) sits
      // directly over a centred tail (甲殼's abdomen anchors at bottom(0)
      // exactly). This moves EVERY tendril count, not just odd ones: the
      // fr formula's own denominator, max(1, (nT-1)/2), clamps to 1 at
      // nT=2, so even the plain two-tendril case sits at fr=±0.5 rather
      // than the ±1 a quick read suggests — checked by print, not assumed,
      // after the byte-identity sweep flagged an nT=2 fixture as changed
      // when an earlier draft of this comment claimed it couldn't be.
      // METABOLISM ONLY: legacy never grows a tail (tailPlan returns null
      // there unconditionally), so there is nothing to clear — confirmed by
      // the sweep, which also caught the ungated version moving legacy's
      // tendrils, which must stay the frozen fr*0.8 fan.
      const off = mode !== 'metabolism' ? fr * 0.8
        : fr === 0 ? 0.22 : Math.sign(fr) * (0.22 + Math.abs(fr) * 0.58);
      const b = bottom(off);
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
  const clawF = S.claws;
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
    // one pair PER coexisting sub-node variant — see clawSeats. Legacy returns
    // exactly one seat at exactly today's size, so production cannot move.
    const seats = clawSeats(domains, mode, clawF);
    /* One ink for every body. The old `isSmooth ? SKIN.base : ...` existed
       because 滑's body was lighter back then and a dark claw looked stuck on
       — but that was tuned against ONE skin and never revisited as five more
       arrived, so it quietly meant "match 滑, ignore 軟/糙/釉/金/烙". Deleted
       at the owner's call: 骨 parts wear neutral ink and never chase 膚's
       colour. One rule beats six special cases. */
    const clawInk = 'rgba(33,29,24,.93)';
    for (let seatIndex = 0; seatIndex < seats.length; seatIndex++) {
      const { species, sizeF, seat } = seats[seatIndex];
    // Once earned, a claw reads as a claw: the ramp spans 0.5→1.0 rather than
    // 0→1, so the youngest claw the gates allow is still half-size and visibly
    // a pincer, and growth after that is legible rather than a slow fade-in
    // from nothing. The bud stage (萌) lives in the GATES now, where it belongs.
    // 龍蝦 alone is asymmetric — one big one small IS the lobster read.
    // 蟹 and 蝦 are 1:1 pairs (fine symmetric pincers are the prawn read).
    const [sL, sR] = species === 'lobster' ? [1.22, 0.82] : [1, 1];
    // the calibrated gesture holds its proportions against a body of half-width
    // 0.62·R_claw with the wrist at 0.48·R_claw from centre; here the wrist
    // rides the flank (deeper in), so the conversion pays for the extra burial.
    // REVERTED to 0.48 (owner, 2026-08-04): a prior round raised the divisor
    // instead, which scales the WHOLE gesture (length, width, thickness) —
    // "too big", not "sticking out more". Reach is the wrist's DISTANCE from
    // the body, a position, not the gesture's own size; see WRIST_BURIAL below.
    const Rclaw = (R * widen) / 0.48;
    // How far OUT the wrist sits, as a fraction of the way from body centre to
    // the flank point — the claw's own SIZE is untouched by this, only its base
    // attachment moves. 蟹 stays at the original 0.82 (owner: "the crab claw is
    // fine, just tune the lobster claw"). 龍蝦 raised toward reach, measured on
    // 本尊 each step: .82→22.3%, .90→26.5%, .98→30.7%, 1.0→30.6% (the growth
    // curve is genuinely linear in this range; 1.0 vs .98 barely differing is
    // the ceiling showing itself, not noise). 1.0 is the wrist crossing the
    // flank point exactly — the body silhouette edge along that ray — so
    // anything higher guarantees no body pixels sit behind the wrist and the
    // join floats loose (measured firsthand at 1.05, shared with 蟹 before this
    // split: both claws visibly disconnected from the body). .96 keeps a real
    // margin inside that boundary — verified attached on 龍蝦 too, the heaviest
    // shell life the harness has — landing at 29.3% on the owner's own profile.
    // A hard ceiling around ~30%, short of the requested 35%: getting the rest
    // of the way needs a real size increase on top of this, which is the
    // tradeoff the owner corrected this round for being un-asked-for.
    // The SECOND seat sits nearer the body's widest point, so the same burial
    // FRACTION swallows more absolute depth: 蟹 measured 97px of reach beyond
    // the silhouette at the prime seat and only 64px at the second, and the
    // owner saw it — "the crab claws need to stick out more because most of it
    // are in the body". 龍蝦 barely notices (0.96 already rides the edge, and
    // it loses 83→68), which is why lobster-on-top reads fine as it is. So the
    // compensation is 蟹-at-second only; both calibrated prime values stand.
    // the second seat is a POSITION in either constant set — never infer it
    // from "not the prime", which broke the moment metabolism got its own
    // lowered prime value
    const secondSeat = seat === CLAW_SEATS[1] || seat === CLAW_SEATS_META[1];
    // 蝦's long thin arm carries its own reach, so its wrist sits at the crab
    // depth rather than riding the silhouette edge like 龍蝦's — the arm
    // length is the species' reach, burial shouldn't double it.
    const WRIST_BURIAL = species === 'lobster' ? 0.96
      : species === 'prawn' ? (secondSeat ? CRAB_SECOND_BURIAL : 0.84)
      : secondSeat ? CRAB_SECOND_BURIAL : 0.82;
    // the upper pair swings toward the horizontal so its gape clears the
    // silhouette (SECOND_SEAT_ANG) — mirrored per side, like the axis itself
    const seatAng = secondSeat ? SECOND_SEAT_ANG : 0;
    for (const side of [-1, 1] as const) {
      const p = flank(side, seat);
      const bx = BB.cx + (p.x - BB.cx) * WRIST_BURIAL, by = BB.cy + (p.y - BB.cy) * WRIST_BURIAL;
      const mo = clawMotion(t, side, seatIndex);
      const ang = side > 0 ? CLAW_AXIS + seatAng + mo.sway
        : Math.PI - CLAW_AXIS - seatAng + mo.sway;
      const drawFn = species === 'lobster' ? drawLobsterClaw
        : species === 'prawn' ? drawPrawnClaw : drawCrabClaw;
      drawFn(ctx, bx, by, ang, Rclaw, sizeF * (side < 0 ? sL : sR), mo, clawInk);
      }
    }
  }
  // 足 legs
  const legF = S.legs;
  if (legF > 0) {
    const mix = subMix(domains.sub?.land, ['beef', 'pork', 'chicken']);
    const nL = ev('land') > 30 ? 4 : 2;
    // stubby-young, unchanged-mature — see BUD_GIRTH. Legacy passes nothing,
    // so its width stays exactly legF and production does not move.
    const legW = mode === 'metabolism' ? Math.pow(legF, BUD_GIRTH) : legF;
    for (let i = 0; i < nL; i++) {
      const fr = (i - (nL - 1) / 2) / Math.max(1, (nL - 1) / 2);
      const b = bottom(fr * 0.55);
      const step = t ? Math.sin(t * 0.0009 + i * 2.1) * 0.35 * l : 0;
      drawLeg(ctx, b.x, b.y - R * 0.04, R, legF, mix, fr + step, legW,
        domOfStable<'beef' | 'pork' | 'chicken'>(
          domains.sub?.land, ['beef', 'pork', 'chicken'], 'land', domains.duels));
    }
  }

  // ── the body ──────────────────────────────────────────────────────────────
  ctx.beginPath(); closedPath(ctx, pts);
  const rawA = 1 - 0.17 * m.raw;
  // smooth skin is NOT washed by 生 translucency — its palette IS the raw look
  // (measured in the lab: washing it inverted the three tones)
  if (!isSoft) {
    ctx.save(); ctx.globalAlpha = isSmooth ? 1 : rawA;
    ctx.fillStyle = isGolden ? goldFill(ctx, BB)
      : isCharred ? SKIN_CHAR.dark
      : isGlazed ? SKIN_GLAZE.deep
      : isSmooth ? SKIN.base : inkFill(ctx, c0, size);
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
      const dx = p.x - BB.cx, dy = p.y - BB.cy, d = Math.hypot(dx, dy) || 1;
      const k = Math.max(0, d - M) / d;
      return { x: BB.cx + dx * k, y: BB.cy + dy * k };
    });
    // anchored to the drawn bounding box, not (cx,cy) — identical outlines
    // must place identical reflections (measured on 清蒸魚 vs 壽司 in the lab).
    // Via `bodyBox` since 2026-08-05: this block had the rule right but kept
    // its own private copy of the arithmetic, and the copy 軟's halo did NOT
    // have is precisely what let that halo drift onto the belly. One helper,
    // no copies.
    const HR = BB.hr, VR = BB.vr;
    const RX = BB.cx - HR * 0.2, RY = BB.cy - VR * 0.26;
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
  /* 釉 GLAZE — 燜 braised. Three layers, all anchored to the DRAWN body:
     the near-black base is already down (body fill), then a warmer pool
     inset from the rim so a dark band survives all the way round, then two
     speculars. The speculars are the read at thumbnail size — the pool alone
     is just a slightly lighter blob — so they are placed near the rim where
     a curved wet surface would actually catch light, one long down the left
     flank and one short hook at the upper right. Clipped to the body, so a
     lobed silhouette trims them rather than letting them float. */
  if (isGlazed) {
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    // the pool: offset down-right, leaving the thickest dark band up-left
    ctx.fillStyle = SKIN_GLAZE.pool;
    ctx.beginPath();
    ctx.ellipse(BB.cx + BB.hr * 0.07, BB.cy + BB.vr * 0.11,
      BB.hr * 0.70, BB.vr * 0.68, -0.18, 0, TAU);
    ctx.fill();
    /* Speculars, drawn as WISPS not strokes: each half-width is
       sin(pi*t)^p for a pointed-ended brush shape, times two out-of-phase
       harmonics so the ribbon swells and pinches irregularly instead of
       reading as a uniform pipe. Phases are fixed rather than seeded — every
       braised being should wear the same calibrated highlight, and micro-
       variation here would make the shape unjudgeable round to round.
       The LOWER (left flank) one is deliberately the dimmer tone: on the
       reference the underside catches far less light than the top hook. */
    ctx.fillStyle = SKIN_GLAZE.shineLow;
    wisp(ctx,
      BB.cx - BB.hr * 0.64, BB.cy - BB.vr * 0.46,
      BB.cx - BB.hr * 1.05, BB.cy + BB.vr * 0.06,
      BB.cx - BB.hr * 0.56, BB.cy + BB.vr * 0.60,
      t => Math.max(0.4, BB.hr * 0.042 * Math.pow(Math.sin(Math.PI * t), 0.45)
        * (1 + 0.42 * Math.sin(t * 8.2 + 0.7) + 0.20 * Math.sin(t * 14.5 + 2.1))));
    ctx.fillStyle = SKIN_GLAZE.shine;
    wisp(ctx,
      BB.cx + BB.hr * 0.30, BB.cy - BB.vr * 0.70,
      BB.cx + BB.hr * 0.80, BB.cy - BB.vr * 0.42,
      BB.cx + BB.hr * 0.66, BB.cy + BB.vr * 0.08,
      t => Math.max(0.4, BB.hr * 0.050 * Math.pow(Math.sin(Math.PI * t), 0.45)
        * (1 + 0.38 * Math.sin(t * 7.1 + 1.9) + 0.16 * Math.sin(t * 12.3 + 0.4))));
    ctx.restore();
  }
  /* 烙 CHAR-BRAND — diagonal grill stripes over the base fill above (which is
     already SKIN_CHAR.dark, so the "gaps" between ridges need no drawing at
     all — only the lit ridges are painted, same z-order economy 軟 and 甲
     use). Clip first, then translate+rotate to the DRAWN body's own centre
     (bodyBox) so the stripe direction is fixed in body-space rather than
     canvas-space — a lobed or squashed body tilts the stripes with it instead
     of them staying screen-diagonal regardless of shape.
     The raking gradient is built ONCE in the rotated frame and reused for
     every ridge, which is what reads as one lit surface rather than a stack
     of independently-lit bars — the reference's whole point. */
  if (isCharred) {
    // NO ctx.translate/rotate: the SVG recorder (canvasToSvg.ts) deliberately
    // throws on any canvas method it does not implement rather than silently
    // drop a stroke — the two-renderer contract catching exactly the bug it
    // exists to catch. So the rotation is done by hand: dir is the unit
    // vector ALONG each stripe, nrm the perpendicular the stripes stack along,
    // both in absolute body coordinates, and every stripe is four explicit
    // corners rather than a transformed rect.
    const ang = -0.40;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const nrm = { x: -Math.sin(ang), y: Math.cos(ang) };
    const span = (BB.hr + BB.vr) * 1.6;
    const period = BB.hr * 0.46;
    const liteFrac = 0.56;                 // ridges read WIDER than the gaps
    // One gradient along `dir`, shared by every ridge — a single light source
    // across the whole surface, not one per stripe.
    const grad = ctx.createLinearGradient(
      BB.cx - dir.x * span, BB.cy - dir.y * span,
      BB.cx + dir.x * span, BB.cy + dir.y * span,
    );
    grad.addColorStop(0, SKIN_CHAR.liteA);
    grad.addColorStop(1, SKIN_CHAR.liteB);
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    ctx.fillStyle = grad;
    const n = Math.ceil((span * 2) / period) + 2;
    for (let i = -n; i <= n; i++) {
      const off = i * period, h = (period * liteFrac) / 2;
      const mx = BB.cx + nrm.x * off, my = BB.cy + nrm.y * off;
      ctx.beginPath();
      ctx.moveTo(mx - dir.x * span + nrm.x * -h, my - dir.y * span + nrm.y * -h);
      ctx.lineTo(mx + dir.x * span + nrm.x * -h, my + dir.y * span + nrm.y * -h);
      ctx.lineTo(mx + dir.x * span + nrm.x * h, my + dir.y * span + nrm.y * h);
      ctx.lineTo(mx - dir.x * span + nrm.x * h, my - dir.y * span + nrm.y * h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /* 糙 ROUGH — the owner's spec (2026-08-05), verbatim:
       · one dot = one GREY circle overlapping a BLACK circle
       · 4 dots anchored at the upper right of the body
       · 3 dots anchored at the lower left
       · none of them touching the rim
     Anchored to the DRAWN silhouette (bodyBox), and each dot is pulled back
     along its own ray until the whole pair clears the outline — so "not
     touching the rim" holds on a lobed body, not just a round one. */
  if (isRough) {
    // Distance from the drawn centre to the rim along one direction.
    const rimAt = (ang: number) => {
      let best = BB.hr, near = Infinity;
      for (const p of pts) {
        const pa = Math.atan2(p.y - BB.cy, p.x - BB.cx);
        const d = Math.abs(Math.atan2(Math.sin(pa - ang), Math.cos(pa - ang)));
        if (d < near) { near = d; best = Math.hypot(p.x - BB.cx, p.y - BB.cy); }
      }
      return best;
    };
    // upper-right cluster (4). The first was the only one at full scale;
    // owner shrank it 20% (1 → 0.80), so the cluster now has no dominant dot.
    const DOTS: [number, number, number][] = [
      [0.44, -0.58, 0.80], [0.67, -0.42, 0.86],
      [0.42, -0.30, 0.92], [0.68, -0.18, 0.84],
    ];
    // lower-left cluster (3). All three shrunk 15% together (owner) so the
    // lower half reads lighter than the upper; then its largest took a
    // further 15% (0.80 → 0.68), leaving no dominant dot in either cluster.
    // Dropped ONLY for 甲+糙 (owner, 2026-08-07): 甲's tread bands sit across
    // this exact region, and the two overlays fighting there read as noise —
    // 糙 alone, or 甲 alone, are both unaffected by this.
    if (!(isShell && isRough)) {
      DOTS.push([-0.65, 0.46, 0.68], [-0.48, 0.32, 0.73], [-0.49, 0.60, 0.75]);
    }
    // Scaled off the SHORTER radius, not always BB.hr (owner: "the dots are
    // touching each other" — reproduced without fur too, so this was never
    // hairy-specific: it's any oval body). Cluster spacing follows u·BB.hr
    // horizontally and v·BB.vr vertically — on a wide/squashed body BB.vr
    // shrinks faster than BB.hr, so a radius tied only to BB.hr stays full
    // size while the vertical gaps between dots close under it. min(hr,vr)
    // shrinks the dots right along with whichever axis is actually tight,
    // and is identical to the old formula on a roughly round body (hr≈vr),
    // so this is a no-op for the common case.
    const R0 = Math.min(BB.hr, BB.vr) * 0.105;
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    for (const [u, v, sc] of DOTS) {
      const r = R0 * sc;
      let x = BB.cx + u * BB.hr, y = BB.cy + v * BB.vr;
      const ang = Math.atan2(y - BB.cy, x - BB.cx);
      const dist = Math.hypot(x - BB.cx, y - BB.cy);
      // 1.35r covers the pair's own offset as well as the circle itself
      const max = rimAt(ang) - r * 1.35;
      if (dist > max && dist > 0) {
        const k = max / dist;
        x = BB.cx + (x - BB.cx) * k;
        y = BB.cy + (y - BB.cy) * k;
      }
      ctx.fillStyle = SKIN_ROUGH.black;
      ctx.beginPath(); ctx.arc(x + r * 0.13, y + r * 0.11, r, 0, TAU); ctx.fill();
      ctx.fillStyle = SKIN_ROUGH.grey;
      ctx.beginPath(); ctx.arc(x - r * 0.13, y - r * 0.11, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /* ── 骨 OVERLAYS — drawn LAST, on top of whichever 膚 skin is present.
     Order matters now in a way it never used to: while 甲/毛 were part of the
     skin precedence chain they were mutually exclusive with 糙, so nothing
     could overlap. As independent layers they can co-occur, so plates and
     coat go over the surface texture rather than under it. */
  // 甲 SHELL — stacked "M" plates, each a LIGHT edge over a DARK gap line; the
  // pair is what sells armour (either line alone reads as a scratch). Flat
  // treads, not a zigzag — the flats are what make it a plate edge.
  if (isShell) {
    ctx.save();
    ctx.beginPath(); closedPath(ctx, pts); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Tread profile (owner, 2026-08-06). Every point from the rim (u=±1.3) to
    // the valley floor (v=0.22) sits on ONE continuous diagonal — no flat
    // plateau, no separate elbow kink — so the outer leg reads as a proper M
    // stroke. The valley floor itself stays flat across the centre notch
    // (v=0.22 → 0.04 → 0.22) before the diagonal rises back to the rim on the
    // other side. Max drop is 0.22h, which leaves 0.78h of clearance to the
    // next band's top line — comfortably past the 0.38h point where two bands
    // start reading as a 3rd implied line (the failure mode this whole profile
    // is shaped to avoid).
    const M: [number, number][] = [[-1.3, 0], [-0.62, 0.22], [-0.48, 0.22], [-0.27, 0.22], [-0.13, 0.04],
      [0.13, 0.04], [0.27, 0.22], [0.48, 0.22], [0.62, 0.22], [1.3, 0]];
    // Half-width of the DRAWN silhouette at a given height. Every band used to
    // run the same `R * widen`, so all four were the same length and the stack
    // read as wires laid across a blob rather than plates wrapping a shell —
    // the flat ends being square-clipped by the rim is what gave it away.
    // Measuring the outline per band is what makes them a dome; it is also the
    // same nominal-vs-drawn distinction the rest of this renderer now obeys,
    // since a lopsided palate's body is nowhere near an R-wide ellipse.
    // Half-width of the DRAWN silhouette at a given height, symmetric about
    // BB.cx. Tried an independent left/right version instead (measuring each
    // side to its own actual edge) when the third band's LEFT end sat short
    // of the rim — but the owner then found the RIGHT end short on a
    // different palate. The body's own silhouette near the tail attachment,
    // low and close to where legs/tail crowd the outline, is where THIS
    // measurement itself gets unreliable — not a left-vs-right bias to
    // correct for. Reverted to the single symmetric radius bands 1/2 always
    // used successfully; the third band (below) sidesteps the low-down
    // measurement entirely rather than trusting it.
    const spanAt = (y: number): number => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < P; i++) {
        const a = pts[i], b2 = pts[(i + 1) % P];
        if ((a.y <= y) === (b2.y <= y)) continue;      // segment doesn't cross y
        const x = a.x + ((y - a.y) / (b2.y - a.y)) * (b2.x - a.x);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
      return hi > lo ? (hi - lo) / 2 : 0;
    };
    // Vertical extent anchored to the drawn box, not to R: sizes the GRID for
    // all 4 nominal band slots (3 gaps + a fixed drop allowance) so it covers
    // ±0.67 of the body, crown to belly. This "+0.62" is a fixed grid constant,
    // not read from M — GRID and INK are deliberately decoupled since the
    // 2026-08-06 band cut (only 2 of 4 slots drawn, bFrom below) and the same
    // day's tread flatten (M's own drop is now 0.22, not 0.62). Re-tuning
    // either one must never silently move the other.
    const nB = 4, h = (1.34 * BB.vr) / (nB - 1 + 0.62), y0 = BB.cy - 0.67 * BB.vr;
    const trace = (yTop: number, span: number) => {
      ctx.beginPath();
      M.forEach(([u, v], i) => {
        // u/1.3 normalises the tread's own extremes to ±1, so the shape is
        // unchanged and only its width follows the body
        const x = BB.cx + (u / 1.3) * span, y = yTop + v * h;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
    };
    // Top two bands CUT (owner, 2026-08-06). The remaining two keep their exact
    // positions — the grid is unchanged, the first two are simply not drawn —
    // so this is a subtraction and not a re-space. Four evenly-repeated treads
    // read as tyre tread rather than carapace, and their four identical centre
    // notches stacked into a column down the middle, which is drawing rule 7's
    // seam arriving by a side door.
    // Shellfish 2.0, corrected (owner, 2026-08-07: "the original position of
    // the 2 bands should not moved. Just add the 3rd one below the 2"). The
    // first attempt restored grid slot 1 instead — ABOVE band 2, and it also
    // silently moved band 2 itself, since upperNudge only ever applies to
    // whichever band is `bFrom` and slot 1 took the nudge that slot 2 used
    // to carry. `bFrom` stays 2 for both modes now — bands 2/3 are
    // byte-identical to before this round — and metabolism alone extends the
    // loop one slot PAST 3, at the same fixed spacing `h`, which is strictly
    // larger y = further down the body. Legacy still stops at nB (two bands).
    const bFrom = 2;
    const bTo = mode === 'metabolism' ? nB + 1 : nB;
    // 200px and below, the pair washes out — the lit edge worst, since .24 is
    // calibrated for a large render and a thin light line on a dark body loses
    // most of its contrast to antialiasing as it shrinks. Both alphas ramp up
    // as the creature gets smaller, and the lit edge also gains a little width,
    // so the plates survive down to the feed thumbnail. `sm` is 0 at 200px and
    // 1 at 72px, so ABOVE 200 nothing changes at all — the large render keeps
    // exactly the values it was tuned at. Contrast only: positions, spans,
    // tread and taper are untouched.
    const sm = smooth01((200 - size) / 128);
    // Second, opposing ramp below 120px (owner, 2026-08-06). The first ramp
    // overshoots at the very small end — by the thumbnail the lit edge had gone
    // bright enough to read as a highlight painted ON the shell rather than the
    // shell's own lit rim. `dk` is 0 at 120px and 1 at 72px, and pulls the lit
    // edge back down while the gap keeps darkening, so the band settles darker
    // without losing the legibility the first ramp bought. The two ramps are
    // kept as separate terms on purpose: 120–200 and 120–72 were tuned in
    // different rounds against different complaints, and collapsing them into
    // one curve would make either one impossible to re-tune alone.
    const dk = smooth01((120 - size) / 48);
    const gapA = (0.62 + 0.16 * sm + 0.05 * dk).toFixed(3);
    const litA = (0.24 + 0.30 * sm - 0.10 * dk).toFixed(3);
    // Upper band sits 5px below its grid slot at the 280px review size (owner,
    // 2026-08-06): 5 / h(280≈23.8px) = 0.210h, expressed as a fraction of h so
    // it scales with the creature the same way h itself does. Leaves ~0.57h
    // clear of the lower band's top — comfortably past the 0.38h point where
    // two bands start reading as a 3rd implied line.
    const upperNudge = 0.210;
    // The third band (owner, 2026-08-07, second correction: "add the 3rd
    // band exactly like band 1 and band 2 but only shorter... if decrease
    // the spacings between them can do the job easier, do it") does NOT
    // measure its own span from the silhouette — that independent
    // measurement is exactly what read wrong two rounds running (short on
    // the left, then short on the right, on different palates), because the
    // body outline down near the tail attachment is where this scan itself
    // gets unreliable, not because of a left/right bias to correct for.
    // Instead it's band 2's OWN measured span, scaled down — geometrically
    // guaranteed to be centred and shaped exactly like bands 1/2, just
    // shorter, which is the literal ask. THIRD_GAP tightens the vertical
    // step before it (0.85h instead of a full h) so the shrink reads as a
    // natural taper rather than an isolated shape.
    const THIRD_GAP = 0.85, THIRD_SHRINK = 0.62;
    let band2Span = 0;
    for (let b = bFrom; b < bTo; b++) {
      const isThirdBand = b === nB; // the new slot, one past the original 4-slot grid
      const yTop = isThirdBand
        ? y0 + (nB - 1) * h + THIRD_GAP * h
        : y0 + b * h + (b === bFrom ? upperNudge * h : 0);
      // measured at the band's own ink centre, and overshot by a hair so the
      // ends still clip flush against the rim instead of leaving a sliver
      const span = isThirdBand ? band2Span * THIRD_SHRINK : spanAt(yTop + 0.31 * h) * 1.04;
      if (b === nB - 1) band2Span = span; // band 2 (grid slot 3) — the third band's reference
      ctx.strokeStyle = `rgba(8,7,6,${gapA})`; // the gap the next plate slides into
      ctx.lineWidth = Math.max(1.8, R * 0.085);
      trace(yTop + R * 0.05, span); ctx.stroke();
      ctx.strokeStyle = `rgba(${HILITE},${litA})`; // lit top edge, drawn over it
      ctx.lineWidth = Math.max(1.4 + 0.7 * sm, R * 0.05);
      trace(yTop, span); ctx.stroke();
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
      let nx = px - BB.cx, ny = py - BB.cy;
      const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      // variation applied AFTER the clamp, never inside it: clamping the varied
      // value collapses every hair to exactly the floor once the body is small,
      // and a coat of identical strands reads as a comb, not as fur
      const L = HM.base * (0.82 + rnd() * 0.36);
      const side = px >= BB.cx ? 1 : -1;
      const bend = hairWindBend(nx, ny, px - BB.cx, R, t);
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
  // 炸 crust nubs on the rim
  if (m.fried > 0.15) {
    const nN = Math.round(10 + 26 * m.fried);
    ctx.fillStyle = 'rgba(33,29,24,.92)';
    for (let i = 0; i < nN; i++) {
      const p = pts[Math.floor(rnd() * P)];
      const dx = p.x - BB.cx, dy = p.y - BB.cy, d = Math.hypot(dx, dy) || 1;
      const off = R * (0.01 + rnd() * 0.05);
      ctx.beginPath();
      ctx.arc(p.x + (dx / d) * off, p.y + (dy / d) * off, R * (0.02 + rnd() * 0.03), 0, TAU);
      ctx.fill();
    }
  }
  // 菌 caps
  const fgF = S.caps;
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

  // the glyph rides the DRAWN centre, so it stays optically centred on a
  // lobed body instead of drifting toward wherever the nominal centre sat
  if (glyph) {
    ctx.fillStyle = '#faf7f1';
    ctx.font = `500 ${Math.round(size * 0.09)}px "Songti TC","Noto Serif TC",serif`;
    ctx.textAlign = 'center';
    ctx.fillText(glyph, BB.cx, BB.cy + size * 0.036);
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
  mode: GrowthMode = 'legacy',
): string {
  const { ctx, svg } = svgContext(size, size);
  drawCreatureFrame(ctx, size, inputs, domains, CREATURE_STILL_T, glyph, mode);
  return svg();
}

/**
 * The creature's rendered ink extents, measured by the recorder itself — THE
 * way to answer any geometric question about a render in a test ("does it
 * clip the canvas?", "which element is leftmost?", "how far does a limb
 * reach?"). Never parse the snapshot's path text for geometry: four ad-hoc
 * parsers produced four different wrong answers in one day (2026-08-07)
 * before this existed — see the ink-measurement block in canvasToSvg.ts for
 * the full autopsy and the conservative-direction guarantees.
 */
export function creatureInkBounds(
  inputs: FormInputs, domains: DomainEvidence, size: number, glyph?: string,
  mode: GrowthMode = 'legacy',
): { bounds: InkBounds | null; records: readonly InkRecord[] } {
  const { ctx, inkBounds, inkRecords } = svgContext(size, size);
  drawCreatureFrame(ctx, size, inputs, domains, CREATURE_STILL_T, glyph, mode);
  return { bounds: inkBounds(), records: inkRecords() };
}
