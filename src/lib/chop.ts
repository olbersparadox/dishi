// A table member's pick avatar glyph — a plain circular profile-icon-with-initials
// (Table Mode social batch, item 2/3). Pure logic here; Chop.tsx just renders it.
//
// HARD CONSTRAINT (do not violate, see CLAUDE.md): a chop renders in INK
// (--ink on --glaze) only, never vermillion — that's reserved for the seal
// stamp, the AI-export CTA, and the dish-edit dirty state. This file doesn't
// touch color at all (that's fixed in the component's CSS), but nothing
// derived here should ever be wired to a red/vermillion token.

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
