// One icon set, used everywhere. Previously each page hand-rolled its own inline
// SVGs (and some actions were text buttons on one screen and icons on another),
// so "Rate now"/"Delete" looked like different actions depending where you met
// them. These are the single source of truth.
//
// All of them inherit `currentColor` and take a size, so a caller controls colour
// purely through its own text colour — no icon carries a hardcoded palette value.

type IconProps = { size?: number };

/** Right arrow — submit/go (e.g. join a table by code). */
export function ArrowRightIcon({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

/** Vertical three dots — "more actions" (edit/delete) on a rated-dish row. */
export function MoreIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}

/** Pencil — edit. */
export function EditIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a1.5 1.5 0 000-2.12l-1.88-1.88a1.5 1.5 0 00-2.12 0L4 16v4z"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/** Trash — delete. */
export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** X — cancel / close. */
export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Rate — a single clean bidirectional arrow (up = loved, down = not for me),
 * matching the vertical flick gesture itself. The earlier plate+circle version
 * read as cluttered at small sizes; this is the same honest idea — no
 * one-directional star scale — drawn with one continuous shaft instead of
 * three overlapping shapes, and reads clearly against the filled button
 * background (.icon-btn.rate) it now sits on.
 */
export function RateIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A row of small monochrome marks signalling "this works with the AI you
 * already use" above the export/copy button. Deliberately simplified,
 * currentColor-only abstractions (a sparkle, a bloom, a ring, an X) rather
 * than reproductions of any provider's actual trademarked logo — the point
 * is legibility and trust-by-familiarity, not brand replication.
 */
/** Two overlapping sheets — copy to clipboard. */
export function CopyIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3"
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Tick — the transient "copied" confirmation. */
export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A menu (page with list lines) under a magnifying glass — scan a menu. */
export function ScanMenuIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="13" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <line x1="6" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="14.5" x2="10" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="17" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line x1="20" y1="20" x2="22.3" y2="22.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Solid cooking pot — a filled, monotone mark for a dish's cooking style,
 *  sized and weighted to sit alongside text the way the old ♥ glyph did. */
export function PotIcon({ size = 14 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="4" y="11" width="16" height="8" rx="2" fill="currentColor" />
      <rect x="3" y="9" width="18" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="1.3" y="12.4" width="3.2" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="19.5" y="12.4" width="3.2" height="2.2" rx="1.1" fill="currentColor" />
      <circle cx="12" cy="7.2" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Open menu (booklet) — pairs with the camera icon on the scan dropzone to
 *  signal "photograph a menu" specifically, not just "take a photo". */
export function MenuBookIcon({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true">
      <g fill="currentColor">
        <path d="M11,60H48c1.65,0,3-1.35,3-3V9c0-1.65-1.35-3-3-3h-2V2.74c0-.83-.36-1.61-.99-2.13-.6-.5-1.37-.7-2.13-.57L10.6,6.04c-.91,.18-1.6,.99-1.6,1.96V58c0,1.1,.9,2,2,2ZM49,9V57c0,.55-.45,1-1,1H11V8H48c.55,0,1,.45,1,1Zm-5.76-6.99c.24-.04,.41,.07,.49,.14,.17,.14,.27,.36,.27,.6v3.26H21.77l21.48-3.99Z" />
        <path d="M14,48c0,1.65,1.35,3,3,3h26c1.65,0,3-1.35,3-3,0-1.32-.86-2.43-2.04-2.83-.35-5.99-4.47-10.97-10.02-12.6,.03-.19,.06-.38,.06-.57,0-2.21-1.79-4-4-4s-4,1.79-4,4c0,.2,.04,.38,.06,.57-5.55,1.63-9.67,6.61-10.02,12.6-1.18,.4-2.04,1.51-2.04,2.83Zm14-16c0-1.1,.9-2,2-2s2,.9,2,2c0,.05-.01,.1-.02,.16-.65-.09-1.31-.16-1.98-.16s-1.33,.06-1.98,.16c0-.05-.02-.1-.02-.16Zm2,2c6.28,0,11.44,4.85,11.95,11H18.05c.51-6.15,5.67-11,11.95-11Zm-13,13h26c.55,0,1,.45,1,1s-.45,1-1,1H17c-.55,0-1-.45-1-1s.45-1,1-1Z" />
        <path d="M21,19h18c.55,0,1-.45,1-1s-.45-1-1-1H21c-.55,0-1,.45-1,1s.45,1,1,1Z" />
        <path d="M26,21c-.55,0-1,.45-1,1s.45,1,1,1h8c.55,0,1-.45,1-1s-.45-1-1-1h-8Z" />
      </g>
    </svg>
  );
}

/** Camera — retake/replace the photo. */
export function CameraIcon({ size = 18, strokeWidth = 1.8 }: IconProps & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle cx="12" cy="14" r="3.2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

/** Fork + knife — dining out at a restaurant (餐廳菜). */
export function UtensilsIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3v6a2 2 0 002 2 2 2 0 002-2V3" />
      <path d="M8 11v10" />
      <path d="M18 3c-1.7 0-3 1.8-3 5v4h3V3zm0 9v9" />
    </svg>
  );
}

/** House — home cooking (屋企煮). */
export function HomeIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

/** Photo / picture — an old shot from the camera roll (相簿舊相). */
export function PhotoIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="M21 15l-4.5-4.5L6 21" />
    </svg>
  );
}

/** Speech bubble — Dishi "talking" (e.g. the why-recommended reason line).
 *  Soft, well-rounded bubble with a small tail. */
export function SpeechIcon({ size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10a5 5 0 015 5v2a5 5 0 01-5 5h-5l-4 4v-4H7a5 5 0 01-5-5V8a5 5 0 015-5z" />
    </svg>
  );
}
