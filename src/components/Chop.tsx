'use client';
// A table member's pick avatar — a plain circular profile-icon-with-initials, the
// same clean typography-driven look as the rest of the app (matching scan's
// settled-list aesthetic), not the app's separate 印 ink-seal motif. No per-user
// shape variation — every chop is visually identical except its glyph. HARD
// CONSTRAINT: ink only (.chop in globals.css is --ink on --glaze) — never
// vermillion. Vermillion is reserved for the seal stamp, the AI-export CTA, and the
// dish-edit dirty state.
import { chopGlyph } from '@/lib/chop';

export default function Chop({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      className="chop"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {chopGlyph(name)}
    </span>
  );
}
