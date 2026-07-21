// A table member's pick avatar glyph + color (Table Mode social batch, item 2/3;
// per-user color added 2026-07-21 on direct owner request — supersedes the
// earlier "ink only, no per-user variation" decision recorded here). Pure logic
// here; Chop.tsx just renders it.
//
// This is the ONE deliberate exception to the strict paper/ink/grey/hairline
// palette (globals.css's "Palette contract") — the owner's own framing: chop
// color is identity, like emoji color, not part of the ink-on-paper chrome.
// Bumped brighter 2026-07-21 (still owner-requested) from an initial muted
// pass that read as too close to the quiet palette to actually register as
// "a color" at a glance, then lightened one step (same request, "lighter
// side") — light enough to read as airier, still dark enough to keep the
// white initials legible (any lighter and a couple of these — amber
// especially — stop giving white text real contrast).
//
// STILL a hard constraint (CLAUDE.md's vermillion reservation): a chop's color
// must never land in the seal's red-orange hue band. --seal is reserved for
// exactly the sealed-prediction stamp and the AI-export CTA, nothing else —
// CHOP_COLORS below sits at hues 190-330°, nowhere near --seal's ~12°.
import { seededRandom } from './blobForm';

const CHOP_COLORS = [
  '#3B82F6', // blue
  '#A855F7', // violet
  '#22C55E', // green
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EC4899', // pink
] as const;

/** Deterministic solid color for a user, seeded off a stable identity (their
 * user id if available, else the display name/handle) — same person always
 * gets the same color across renders and devices. */
export function chopColor(seed: string): string {
  const idx = Math.floor(seededRandom(seed)() * CHOP_COLORS.length);
  return CHOP_COLORS[idx];
}

/** The glyph a chop bears. Latin name with 2+ words (e.g. "Jerry Chu") -> both
 * initials, uppercased ("JC") - the ask was specifically initials, not a single
 * letter. A single Latin word, or a non-Latin name (CJK has no case, and no
 * "first/last name" split to draw a second initial from) -> just its first
 * character, unchanged from before. Array.from iterates by codepoint, not
 * UTF-16 unit (unlike `s[0]`), so this is safe for any script — and unlike
 * `[...s]`, it needs no downlevelIteration under this repo's tsconfig target
 * (see tests/i18n.test.ts's own note on the same bare-tsc restriction). */
export function chopGlyph(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const isLatin = (s: string) => /[a-zA-Z]/.test(s);
  const firstOf = (w: string) => Array.from(w)[0];
  if (words.length >= 2 && isLatin(firstOf(words[0])) && isLatin(firstOf(words[words.length - 1]))) {
    return (firstOf(words[0]) + firstOf(words[words.length - 1])).toUpperCase();
  }
  const first = firstOf(words[0]);
  return isLatin(first) ? first.toUpperCase() : first;
}
