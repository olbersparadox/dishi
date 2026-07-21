// dishi VERSIONS — the unbounded growth ladder that replaces Levels.
//
// Framing (owner decision, 2026-07-21): the profile doesn't level up like a pet, it
// VERSIONS like software — dishi v1, v2, … vN, unbounded. Every new version unlock is
// the moment to re-export the palate to your AI (the habit loop). Version semantics
// and per-version perks are deliberately deferred to a design session; this module is
// the mechanical scaffold only: which version you're on, and how far to the next.
//
// TWO SCALES, ONE FACT:
// - v1 IS the export unlock. Not "aligned with" — the same fact, derived from the
//   same number: evidenceConfidence >= EMERGING_AT (tasteExport.ts, the single
//   source of truth for the unlock). There is no second threshold to drift.
// - v2+ live on a CUMULATIVE substrate. Confidence saturates at 1.0 by design
//   (it answers "how much do I trust this profile"), so versions can't ride it
//   forever. The substrate re-weighs the SAME three inputs evidenceConfidence
//   weighs — rating volume, explored dims, distinct cuisines — but ACCUMULATED:
//   volume keeps counting past 25 (with diminishing returns — the 30th identical
//   ramen still teaches ~nothing), cuisines keep counting past 6 (a genuinely new
//   cuisine always teaches). Coverage stays capped: 18 dims is the whole space.
//
// REPLAY-SAFE: versionForProfile is a pure function of ConfidenceInputs, which are
// derived from ratings history — recompute from history and you get the same answer
// (same principle as profile replay). RATCHET (recommended in the backlog, owner has
// not ruled): the ACHIEVED version is an unlock history, persisted and never demoted
// — deleting a rating never takes v3 away, but the live progress bar toward v4
// honestly dips. Tradeoff: after deletions, the shown version can exceed what the
// live data would re-derive; we accept that because an unlock is an event that
// happened, not a claim about current signal (the bar carries the honest live part).

import {
  evidenceConfidence, exportUnlocked, EMERGING_AT, type ConfidenceInputs,
} from './tasteExport';

// ── The substrate: cumulative honest signal, in confidence-equivalent units ──────
// Same 0.55/0.30/0.15 weights as evidenceConfidence so "1.0 substrate" ≈ a fully
// saturated confidence bar — the two scales agree where they overlap.
//
// Volume: (rc/25)^VOL_EXPONENT — sublinear, unbounded. At the 25-rating saturation
// point it equals the confidence term exactly; past it, each rating adds less (the
// same-ramen grind decays) while never hitting a wall.
// Coverage: capped at 18/18 — a finite space, fully credited when fully explored.
// Variety: uncapped — diversity keeps its outsized weight (one new cuisine ≈ several
// ratings' worth of substrate, and relatively more the deeper into volume you are).
export const VOL_EXPONENT = 0.75;

export function versionSubstrate(ci: ConfidenceInputs): number {
  const vol = Math.pow(Math.max(0, ci.ratingCount) / 25, VOL_EXPONENT);
  const cov = Math.min(1, ci.exploredDimCount / 18);
  const varty = ci.distinctCuisines / 6;
  return 0.55 * vol + 0.30 * cov + 0.15 * varty;
}

// ── Threshold curve: early-easy, later-hard ──────────────────────────────────────
// T(n) = substrate needed to REACH version n (n >= 2; v1 is the confidence gate).
// Geometric increment growth: gap(v1→v2) = FIRST_GAP, each later gap × GAP_RATIO.
// Calibration (pinned by the pacing snapshot test):
// - The reference account (25 flicks / 8 cuisines / 10 explored dims — the owner's
//   live curve) sits at v1, ~64% of the way to v2.
// - A good first week of normal use (~50 varied ratings) crosses v2.
// - By v10 (substrate ≈ 17) a version is a real undertaking (years-of-use scale).
export const V1_ANCHOR = 0.50;  // nominal v1 point in substrate units (typical unlock mix)
export const FIRST_GAP = 0.65;  // substrate from v1 anchor to v2
export const GAP_RATIO = 1.25;  // each subsequent gap grows by this factor

/** Substrate threshold to reach version n (n >= 1). T(1) is the nominal anchor —
 * actual v1 is granted by the confidence gate, not by this number. */
export function versionThreshold(n: number): number {
  if (n <= 1) return V1_ANCHOR;
  // T(n) = anchor + FIRST_GAP * (GAP_RATIO^(n-1) - 1) / (GAP_RATIO - 1)
  return V1_ANCHOR + FIRST_GAP * (Math.pow(GAP_RATIO, n - 1) - 1) / (GAP_RATIO - 1);
}

export type VersionState = {
  /** Live version derived from current inputs: 0 = not yet v1 (export locked). */
  version: number;
  /** 0..1 toward the NEXT version. For v0: confidence toward the v1 gate. */
  progress: number;
  /** The next version's threshold — confidence units for v0 (= EMERGING_AT),
   * substrate units for v1+. Display-layer info, not a second gate. */
  nextAt: number;
  /** The raw cumulative substrate, for anyone charting the curve. */
  substrate: number;
};

/**
 * The whole ladder in one pure call. version >= 1 REQUIRES the export-unlock gate
 * (v1 ≡ can-export, always); higher versions additionally require the substrate to
 * clear their threshold. In practice the gate opens well below T(2) for every
 * realistic mix (rc >= 25 alone puts confidence past emerging), so the gate check
 * only ever decides v0-vs-v1 — but it's structural, not assumed: no substrate value
 * can mint v2 while the export is still locked.
 */
export function versionForProfile(ci: ConfidenceInputs): VersionState {
  const conf = evidenceConfidence(ci);
  const substrate = versionSubstrate(ci);

  if (!exportUnlocked(conf)) {
    return {
      version: 0,
      progress: Math.min(1, conf / EMERGING_AT),
      nextAt: EMERGING_AT,
      substrate,
    };
  }

  let version = 1;
  while (substrate >= versionThreshold(version + 1)) version++;

  const cur = versionThreshold(version);
  const next = versionThreshold(version + 1);
  return {
    version,
    // v1 can be gate-granted while substrate sits below the nominal anchor — clamp
    // so the bar never renders negative progress.
    progress: Math.max(0, Math.min(1, (substrate - cur) / (next - cur))),
    nextAt: next,
    substrate,
  };
}

/** The ratchet: achieved versions are an unlock HISTORY — the stored value only ever
 * rises. (Progress toward the next version is live and may dip; see header note.) */
export function ratchetVersion(stored: number, live: number): number {
  return Math.max(stored ?? 0, live);
}
