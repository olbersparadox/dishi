'use client';
// Magnetic-snap rating — the signature interaction of the album stack.
//
// FEEL model (v2, from owner testing):
//  - The whole card follows your thumb 1:1 while dragging (like moving a real card),
//    then SPRING-SNAPS to the nearest of 6 slots on release.
//  - Release only SETS the rating (shown on the card, re-draggable) — it does NOT
//    commit or advance. A deliberate Next moves on, so a slip can't lock in a wrong
//    rating and skip ahead. (Final commit is the end-of-stack consent step.)
//  - Snapping to 6 discrete levels is cleaner for learning than a fuzzy continuous
//    value: people can't feel +0.6 vs +0.5; the 6 anchors are what actually teach.
//
// Haptic: navigator.vibrate is a no-op on iOS Safari (web has no haptics there), so
// the snap "click" is carried visually (dot pop + settle); vibrate still fires on
// Android. Real iPhone haptics would need a native shell.
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

// Top slot = most drag-up = most positive. `drag` = the vertical offset (px, up
// positive) the card snaps to. The ±REST_GAP around zero is "not rated yet".
const SLOTS: { key: string; value: number; drag: number }[] = [
  { key: 'flick.inhaled',  value: 1,    drag:  115 },
  { key: 'flick.loved',    value: 0.6,  drag:  69 },
  { key: 'flick.good',     value: 0.35, drag:  23 },
  { key: 'flick.fine',     value: 0.1,  drag: -23 },
  { key: 'flick.notforme', value: -0.5, drag: -69 },
  { key: 'flick.never',    value: -0.9, drag: -115 },
];
const CLAMP = 130;
const REST_GAP = 14;

function nearest(y: number): number | null {
  if (Math.abs(y) < REST_GAP) return null;
  let best = 0, bestD = Infinity;
  SLOTS.forEach((s, i) => { const d = Math.abs(s.drag - y); if (d < bestD) { bestD = d; best = i; } });
  return best;
}

export default function SnapRating({
  photoUrl, dishName, dishNameZh, onRate,
}: {
  photoUrl: string | null;
  dishName?: string;
  dishNameZh?: string | null;
  onRate: (score: number) => void; // "rating set" — the PARENT decides when to advance
}) {
  const { t, lang } = useLang();
  const [live, setLive] = useState(0);                       // live drag offset while pressing
  const [rated, setRated] = useState<number | null>(null);   // slot chosen on release
  const [active, setActive] = useState(false);
  const startY = useRef(0);
  const lastSlot = useRef<number | null>(null);
  const raf = useRef(0);
  const pend = useRef(0);

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    lastSlot.current = rated;
    setActive(true);
  }
  function move(e: React.PointerEvent) {
    if (!active) return;
    const y = Math.max(-CLAMP, Math.min(CLAMP, startY.current - e.clientY));
    pend.current = y;
    const s = nearest(y);
    if (s !== lastSlot.current) { lastSlot.current = s; if (s !== null) { try { navigator.vibrate?.(9); } catch { /* iOS no-op */ } } }
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setLive(pend.current); });
  }
  function up() {
    if (!active) return;
    setActive(false);
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    const s = nearest(pend.current);
    setLive(0);
    if (s === null) return; // released in the rest zone — keep whatever was there (or nothing)
    setRated(s);
    try { navigator.vibrate?.(18); } catch { /* iOS no-op */ }
    onRate(SLOTS[s].value); // report the SET value; parent shows it + a Next action
  }

  // While dragging the card tracks the thumb (1:1, no transition); otherwise it rests
  // at the chosen slot with a springy settle.
  const offset = active ? live : (rated !== null ? SLOTS[rated].drag : 0);
  const curSlot = active ? nearest(pend.current) : rated;
  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);

  return (
    <div
      className="snap-stage"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="slider" aria-label={t('flick.aria')} aria-valuemin={-1} aria-valuemax={1}
      aria-valuenow={rated !== null ? SLOTS[rated].value : 0}
      aria-valuetext={curSlot !== null ? t(SLOTS[curSlot].key) : t('flick.notyet')}
      tabIndex={0}
    >
      <div className={`snap-card ${active ? 'dragging' : ''}`} style={{ transform: `translateY(${-offset}px)` }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your dish" className="snap-photo" draggable={false} />
        ) : (
          <div className="snap-photo flick-nophoto"><span>{displayName ?? '🍽️'}</span></div>
        )}
      </div>

      <div className="snap-rail" aria-hidden>
        {SLOTS.map((s, i) => <span key={i} className={`snap-tick ${curSlot === i ? 'on' : ''}`} />)}
      </div>

      {curSlot !== null && <div className="flick-word snap-word">{t(SLOTS[curSlot].key)}</div>}
      {curSlot === null && !active && rated === null && <div className="flick-hint">{t('flick.hint')}</div>}
    </div>
  );
}
