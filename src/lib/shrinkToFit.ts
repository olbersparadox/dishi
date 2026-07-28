'use client';
// Content-aware shrink-to-fit for a single-line inline element: steps its
// font-size down (from the CSS default) until it no longer overflows its
// parent's width, or a floor is hit. Mirrors DuelSide.tsx's own
// useShrinkPrimaryToFit (multi-line wrapping) but for horizontal overflow of
// a one-line label instead — can't be done with pure CSS since clamp() only
// reacts to viewport width, not string length. Shared by TasteFormCard.tsx
// and PublicDossier.tsx: both show the SAME dishi.{username} identity line at
// --fs-title-b, which a long claimed name can overflow on a narrow phone.
import { useEffect, type RefObject } from 'react';

export function useShrinkToFitWidth(ref: RefObject<HTMLElement>, dep: unknown, floor = 14) {
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    el.style.fontSize = ''; // reset to the CSS default before re-measuring
    let size = parseFloat(getComputedStyle(el).fontSize);
    let guard = 0; // hard stop — never spin on a layout that won't settle
    while (el.scrollWidth > parent.clientWidth && size > floor && guard < 20) {
      size -= 1;
      el.style.fontSize = `${size}px`;
      guard++;
    }
  }, [dep, floor]);
}
