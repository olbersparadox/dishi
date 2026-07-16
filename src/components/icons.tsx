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
