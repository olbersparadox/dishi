'use client';
// 名印 — one person's mark at a shared table, standing in for a photo avatar. See
// src/lib/chop.ts for the deterministic glyph/style derivation; this is purely the
// render. HARD CONSTRAINT: ink only (.chop in globals.css is --ink on --glaze) —
// never vermillion, no matter how good a red chop might look. Vermillion is
// reserved for the seal stamp, the AI-export CTA, and the dish-edit dirty state.
import { chopGlyph, deriveChopStyle } from '@/lib/chop';

export default function Chop({ userId, name, size = 30 }: { userId: string; name: string; size?: number }) {
  const style = deriveChopStyle(userId);
  return (
    <span
      className="chop"
      style={{
        width: size, height: size,
        borderRadius: `${style.radius}px`,
        borderWidth: `${style.borderWidth}px`,
        transform: `rotate(${style.rotate}deg)`,
        fontSize: Math.round(size * 0.5),
        fontWeight: style.weight,
      }}
      aria-hidden
    >
      {chopGlyph(name)}
    </span>
  );
}
