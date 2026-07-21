'use client';
// A table member's pick avatar — a circular profile icon, solid-color-per-user
// (2026-07-21, direct owner request) with white initials, no shape variation
// (every chop is the same circle, just a different color + glyph). HARD
// CONSTRAINT still in force: never vermillion (see src/lib/chop.ts's
// CHOP_COLORS comment) — that stays reserved for the seal stamp and the
// AI-export CTA.
import { chopGlyph, chopColor } from '@/lib/chop';

export default function Chop({ name, size = 36 }: { name: string; size?: number }) {
  const color = chopColor(name);
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
