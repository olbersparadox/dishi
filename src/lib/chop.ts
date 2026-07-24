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

/** A user's preferred palette slot — an internal detail of the two functions
 * below, which are the only assignment rules. */
function chopSlot(userId: string): number {
  return Math.floor(seededRandom(userId)() * CHOP_COLORS.length);
}

/** Deterministic solid color for a user_id alone, with no member set to
 * de-collide against — the fallback for contexts that render one chop outside
 * a known group (e.g. a realtime stamp racing ahead of the members poll).
 * Two-account field test (2026-07-24): both members rendered the SAME green on
 * every screen, because the seed was the display NAME (renaming changed your
 * color; two names could collide) and nothing guarded the 1-in-6 hash
 * collision. user_id is the stable identity; collisions are handled by
 * chopColorMap wherever the member set is known. */
export function chopColorFor(userId: string): string {
  return CHOP_COLORS[chopSlot(userId)];
}

/** Color assignment for a whole member set: each member keeps their own
 * hash-preferred slot when free, and colliding members probe to the next free
 * slot in sorted-user_id order — so any two members of a ≤6-person table are
 * GUARANTEED different colors, and the assignment is identical on every
 * client/screen because it depends only on the set of ids (sorted internally),
 * never on render or join order. Past 6 members the palette must repeat
 * (slots reset), keeping each consecutive group of 6 internally distinct. */
export function chopColorMap(userIds: string[]): Map<string, string> {
  const sorted = Array.from(new Set(userIds)).sort();
  const taken = new Set<number>();
  const map = new Map<string, string>();
  for (const id of sorted) {
    if (taken.size >= CHOP_COLORS.length) taken.clear();
    let slot = chopSlot(id);
    while (taken.has(slot)) slot = (slot + 1) % CHOP_COLORS.length;
    taken.add(slot);
    map.set(id, CHOP_COLORS[slot]);
  }
  return map;
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
