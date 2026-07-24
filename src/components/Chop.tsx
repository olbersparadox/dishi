'use client';
// A table member's pick avatar — a circular profile icon, solid-color-per-user
// (2026-07-21, direct owner request) with white initials, no shape variation
// (every chop is the same circle, just a different color + glyph). HARD
// CONSTRAINT still in force: never vermillion (see src/lib/chop.ts's
// CHOP_COLORS comment) — that stays reserved for the seal stamp and the
// AI-export CTA.
import { chopGlyph } from '@/lib/chop';

// `color` comes from the caller (chopColorMap over the member/companion set,
// or chopColorFor for a lone id) — NEVER derived from the display name here.
// Name-seeded color meant renaming changed your color and two names could
// collide into the same one (2026-07-24 field test: two members, same green).
export default function Chop({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="chop"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: color, borderColor: color }}
      aria-hidden
    >
      {chopGlyph(name)}
    </span>
  );
}
