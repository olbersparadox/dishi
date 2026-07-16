// The taste form ("blob"): a deterministic mapping from a user's REAL learned
// profile to an organic visual identity. One pure math module, consumed by two
// renderers (live Canvas breathing form; static SVG snapshot for version cards,
// export headers, share images) so they can never disagree about what the
// profile looks like.
//
// Honesty contract (same spirit as the taste engine itself):
// - Only dims the engine genuinely KNOWS (evidence >= KNOWS_AT, the same
//   threshold that drives 識睇 in the Buddy API) shape the silhouette at full
//   strength. Dims still being learned (仲摸緊) contribute a faint emerging
//   trace. Fog dims (zero evidence) contribute NOTHING — not a phantom bump.
// - Loved dims push the form outward (lobes); disliked dims carve inward
//   (dents, softened by DENT_SOFTEN — your dislikes shape you, but the form
//   should read as character, not damage).
// - The form is seeded by user id + profile version: the same profile always
//   renders the same being. Live motion is layered ON TOP by the renderer via
//   time-varying noise and never changes the base identity.

import { DIMS, type TasteVector, type Dim } from './taste';
import type { EvidenceMap } from './taste';

/** Same thresholds as /api/buddy — single source of truth for "learned". */
export const KNOWS_AT = 3;

export type DimState = 'knows' | 'learning' | 'fog';

export function dimState(evidenceCount: number | undefined): DimState {
  const n = evidenceCount ?? 0;
  if (n >= KNOWS_AT) return 'knows';
  if (n > 0) return 'learning';
  return 'fog';
}

export type FormInputs = {
  vector: TasteVector;
  evidence: EvidenceMap;
  ratingCount: number;
  /** Stable identity seed, e.g. `${userId}:v${profileVersion}`. */
  seed: string;
};

/** Amplitude multipliers. Softened from the first pass, which read as a harsh,
 * spiky, overly-dominant black blot in the real render rather than the soft
 * organic form from the mockup — smaller swings, wider (smoother) lobes, and
 * far less micro-noise all make the SAME real data look calmer, not less honest. */
const LOBE_GAIN = 0.22;      // full-strength outward reach of a loved, known dim
const DENT_SOFTEN = 0.5;     // inward carve is half the outward reach
const LEARNING_GAIN = 0.3;   // 仲摸緊 dims emerge at 30% strength
const MICRO_NOISE = 0.015;   // seeded per-point irregularity so even the static form is organic
const LOBE_WIDTH = 0.75;     // gaussian width (radians) of each dim's influence — wider = smoother

/** Growth: base radius scales with rating count, saturating — mirrors the
 * buddy LEVELS feel without importing its table. 0 ratings ≈ 0.55, 120+ ≈ 1. */
export function growth(ratingCount: number): number {
  return 0.55 + 0.45 * (1 - Math.exp(-ratingCount / 45));
}

/** mulberry32 over a string hash — tiny, deterministic, good enough for art. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Each dim owns a fixed angle (stable order = stable identity across renders). */
export function dimAngle(index: number): number {
  return (index / DIMS.length) * Math.PI * 2 - Math.PI / 2;
}

export type FormSample = { angles: number[]; radii: number[] };

/**
 * Sample the radial form r(θ) at `points` positions. Radii are in unit space
 * (multiply by your pixel radius). Pure and deterministic for given inputs.
 */
export function sampleForm(inputs: FormInputs, points = 96): FormSample {
  const rnd = seededRandom(inputs.seed);
  const micro: number[] = [];
  for (let i = 0; i < points; i++) micro.push((rnd() * 2 - 1) * MICRO_NOISE);

  const base = growth(inputs.ratingCount);
  const angles: number[] = [];
  const rawRadii: number[] = [];

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    let bump = 0;
    for (let d = 0; d < DIMS.length; d++) {
      const dim = DIMS[d];
      const state = dimState(inputs.evidence[dim]);
      if (state === 'fog') continue;
      const pref = inputs.vector[dim] ?? 0;
      if (pref === 0) continue;
      const gain = state === 'knows' ? 1 : LEARNING_GAIN;
      const amp = pref > 0 ? pref * LOBE_GAIN : pref * LOBE_GAIN * DENT_SOFTEN;
      // shortest angular distance to this dim's home angle
      let delta = theta - (dimAngle(d) + Math.PI / 2);
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      bump += amp * gain * Math.exp(-(delta * delta) / (2 * LOBE_WIDTH * LOBE_WIDTH));
    }
    angles.push(theta);
    rawRadii.push(base * (1 + bump));
  }

  // Adjacent dims sit closer together (360°/18 ≈ 20°) than one dim's Gaussian
  // influence is wide — several known dims' bumps overlap and sum, and summing
  // several same-sign Gaussians of slightly different heights produces a
  // rippled, scalloped combined curve (this is what read as a jagged "cookie
  // bite" edge in review, not the intended soft organic form). Two passes of a
  // small circular moving average low-pass-filters that interference while
  // preserving the broader envelope — smoothing is linear, so it preserves
  // amplitude RATIOS between loved/disliked/learning-stage dims (tested below).
  // Micro noise is added AFTER smoothing, not before: it's meant to texture
  // the smooth macro shape, not itself be smoothed away.
  const smoothed = smoothCircular(smoothCircular(rawRadii, 2), 2);
  const radii = smoothed.map((r, i) => Math.max(0.15, r + micro[i]));

  return { angles, radii };
}

function smoothCircular(arr: number[], halfWindow: number): number[] {
  const n = arr.length;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -halfWindow; k <= halfWindow; k++) sum += arr[(i + k + n) % n];
    out[i] = sum / (halfWindow * 2 + 1);
  }
  return out;
}

/** Catmull-Rom through the samples → smooth closed cubic-bezier SVG path.
 * `size` is the square canvas edge; the form is centered and scaled to it. */
export function formToSvgPath(sample: FormSample, size: number): string {
  const n = sample.radii.length;
  const cx = size / 2, cy = size / 2, scale = size * 0.36;
  const px: number[] = [], py: number[] = [];
  for (let i = 0; i < n; i++) {
    px.push(cx + Math.cos(sample.angles[i]) * sample.radii[i] * scale);
    py.push(cy + Math.sin(sample.angles[i]) * sample.radii[i] * scale);
  }
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(px[0])} ${f(py[0])}`;
  for (let i = 0; i < n; i++) {
    const p0x = px[(i - 1 + n) % n], p0y = py[(i - 1 + n) % n];
    const p1x = px[i], p1y = py[i];
    const p2x = px[(i + 1) % n], p2y = py[(i + 1) % n];
    const p3x = px[(i + 2) % n], p3y = py[(i + 2) % n];
    const c1x = p1x + (p2x - p0x) / 6, c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6, c2y = p2y - (p3y - p1y) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2x)} ${f(p2y)}`;
  }
  return d + ' Z';
}

/** Convenience: full static snapshot path for a profile. */
export function blobSnapshotPath(inputs: FormInputs, size: number, points = 96): string {
  return formToSvgPath(sampleForm(inputs, points), size);
}

/** Fog extent 0..1 — how much of the taste space is still unlearned. Drives the
 * pale wash halo: opacity/extent shrink as dims move fog → learning → knows. */
export function fogExtent(evidence: EvidenceMap): number {
  let unl = 0;
  for (const dim of DIMS) {
    const s = dimState(evidence[dim]);
    if (s === 'fog') unl += 1;
    else if (s === 'learning') unl += 0.5;
  }
  return unl / DIMS.length;
}

/** Top loved, KNOWN dims for the center glyph — never decorative, never from
 * fog or learning-stage dims, and never more than `max`. */
export function topGlyphDims(vector: TasteVector, evidence: EvidenceMap, max = 3): Dim[] {
  return DIMS
    .filter(d => dimState(evidence[d]) === 'knows' && (vector[d] ?? 0) > 0.15)
    .sort((a, b) => (vector[b] ?? 0) - (vector[a] ?? 0))
    .slice(0, max);
}

export function stateCounts(evidence: EvidenceMap): { knows: number; learning: number; fog: number } {
  const out = { knows: 0, learning: 0, fog: 0 };
  for (const dim of DIMS) out[dimState(evidence[dim])] += 1;
  return out;
}
