// 名印 — the chop identity every table member wears instead of a photo avatar
// (Table Mode social batch, item 2). Pure logic here; Chop.tsx just renders it.
//
// HARD CONSTRAINT (do not violate, see CLAUDE.md): a chop renders in INK
// (--ink on --glaze) only, never vermillion — that's reserved for the seal
// stamp, the AI-export CTA, and the dish-edit dirty state. This file doesn't
// touch color at all (that's fixed in the component's CSS), but nothing
// derived here should ever be wired to a red/vermillion token.
import { seededRandom } from './blobForm';

/** The glyph a chop bears: the display name's first character AS-IS if it's
 * non-Latin (CJK has no case, and slicing by UTF-16 code unit would mangle a
 * surrogate pair), or that first letter UPPERCASED if it's Latin. Array.from
 * iterates a string by codepoint, not UTF-16 unit (unlike `s[0]`), so this is
 * safe for any script — and unlike `[...s]`, it doesn't need downlevelIteration
 * under this repo's tsconfig target (see tests/i18n.test.ts's own note on the
 * same bare-tsc restriction). */
export function chopGlyph(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}

export type ChopStyle = {
  /** Corner radius in px — how square vs. round the chop reads. */
  radius: number;
  /** Degrees, negative or positive — a chop stamped slightly off true. */
  rotate: number;
  /** Border width in px. */
  borderWidth: number;
  /** Font weight for the glyph. */
  weight: 600 | 700 | 800;
};

/** Deterministic per-user variation — same user id always yields the same style
 * (seededRandom is a pure hash-based PRNG, no Math.random), so a chop is a
 * stable identity across renders/sessions, not a random one that reshuffles
 * every load. Different ids land on visibly different combinations without
 * needing any photo-upload infrastructure. */
export function deriveChopStyle(userId: string): ChopStyle {
  const rnd = seededRandom(userId || 'anon');
  const radius = Math.round(4 + rnd() * 11); // 4–15px: near-square to well-rounded
  const rotate = Math.round((rnd() * 2 - 1) * 7 * 10) / 10; // -7.0..7.0deg
  const borderWidth = rnd() > 0.55 ? 2 : 1.5;
  const weightDraw = rnd(); // one draw, bucketed — not one rnd() call per branch
  const weight: ChopStyle['weight'] = weightDraw > 0.66 ? 800 : weightDraw > 0.33 ? 700 : 600;
  return { radius, rotate, borderWidth, weight };
}
