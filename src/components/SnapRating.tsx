'use client';
// Magnetic-snap rating — the signature interaction of the album stack.
//
// FEEL model (v3, from owner testing):
//  - FULL-SCREEN overlay. The photo is a card you hold in your hand.
//  - You drag it freely in 2D (x AND y). The rating is the vertical slot; the
//    horizontal drift is just physical play that eases back as it locks.
//  - MAGNETIC DETENT with hysteresis: as the card nears a slot it's pulled the
//    last few px and LOCKS (a crisp click). Leaving costs more than entering —
//    you must drag past a stronger BREAK threshold to pop out of the well. That
//    asymmetry is the "magnet" feel and the confirmation that you picked a level.
//  - RATE ON RELEASE: because the lock itself confirms the choice, letting go
//    while locked commits the rating (a Next button was pure friction). Release
//    while NOT locked (mid-transit) rates nothing and springs back.
//  - 6 discrete slots, not a fuzzy continuum: people can't feel +0.6 vs +0.5;
//    the anchors are what teach the engine.
//
// Haptic: navigator.vibrate is a no-op on iOS Safari, so the lock "click" is
// carried visually (dot pop + card glide); vibrate still fires on Android.
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CloseIcon } from '@/components/icons';

// Slots stack top(most positive) → bottom. `drag` = the vertical offset (px, up
// positive) the card centres on. Evenly spaced around rest (0), which sits
// between the two middle slots so a fresh card is "not rated yet".
const GAP = 100;
const SLOT_META: { key: string; value: number }[] = [
  { key: 'flick.inhaled',  value: 1 },
  { key: 'flick.loved',    value: 0.6 },
  { key: 'flick.good',     value: 0.35 },
  { key: 'flick.fine',     value: 0.1 },
  { key: 'flick.notforme', value: -0.5 },
  { key: 'flick.never',    value: -0.9 },
];
const SLOTS = SLOT_META.map((m, i) => ({ ...m, drag: (2.5 - i) * GAP })); // +155 … −155

// Wide, strong wells that nearly touch: the card stays pinned to a slot through
// almost the whole transit and CLICKS over to the next only past BREAK — so the
// "in-between" free zone (where thumb tremor read as shake) is tiny.
const CAPTURE = 42;   // enter a well within this of its centre
const BREAK = 70;     // must exceed this from the locked centre to escape (>CAPTURE = hysteresis)
const GIVE_Y = 0.2;   // rubber-band: while locked the card barely follows the thumb (lower = more pinned)
const XLOCK = 0.12;   // while locked, horizontal drift eases back toward centre
const XFOLLOW = 0.7;  // while free, horizontal follows the thumb (damped)
const XCLAMP = 130;
const MAXY = 2.5 * GAP + 50;

export default function SnapRating({
  photoUrl, dishName, dishNameZh, onRate, progress, onClose,
}: {
  photoUrl: string | null;
  dishName?: string;
  dishNameZh?: string | null;
  onRate: (score: number) => void; // release-while-locked = rated; parent advances
  progress?: string;               // e.g. "3 / 12" overlayed top-left
  onClose?: () => void;
}) {
  const { t, lang } = useLang();
  const [render, setRender] = useState({ x: 0, y: 0 }); // rendered card offset
  const [locked, setLocked] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const lockRef = useRef<number | null>(null); // authoritative during a drag (no state lag)
  const raf = useRef(0);
  const pend = useRef({ x: 0, y: 0 });

  function down(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    setActive(true);
  }

  function move(e: React.PointerEvent) {
    if (!active) return;
    const rawY = Math.max(-MAXY, Math.min(MAXY, startY.current - e.clientY)); // up positive
    const rawX = Math.max(-XCLAMP, Math.min(XCLAMP, e.clientX - startX.current));

    let lock = lockRef.current;
    if (lock !== null && Math.abs(rawY - SLOTS[lock].drag) > BREAK) lock = null; // popped out
    if (lock === null) {
      // nearest well; capture only if within its mouth
      let best = 0, bestD = Infinity;
      SLOTS.forEach((s, i) => { const d = Math.abs(s.drag - rawY); if (d < bestD) { bestD = d; best = i; } });
      if (bestD < CAPTURE) lock = best;
    }

    let y: number, x: number;
    if (lock !== null) {
      y = SLOTS[lock].drag + (rawY - SLOTS[lock].drag) * GIVE_Y; // stuck in the well
      x = rawX * XLOCK;                                          // pulled back to centre
    } else {
      y = rawY;
      x = rawX * XFOLLOW;
    }

    if (lock !== lockRef.current) {              // just crossed a well boundary → click
      if (lock !== null) { try { navigator.vibrate?.(12); } catch { /* iOS no-op */ } }
      lockRef.current = lock;
      setLocked(lock);
    }
    pend.current = { x, y };
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setRender(pend.current); });
  }

  function up() {
    if (!active) return;
    setActive(false);
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    const lock = lockRef.current;
    lockRef.current = null;
    setLocked(null);
    setRender({ x: 0, y: 0 }); // spring home (parent unmounts us on a rating)
    if (lock !== null) {
      try { navigator.vibrate?.(20); } catch { /* iOS no-op */ }
      onRate(SLOTS[lock].value); // the lock WAS the confirmation → commit + advance
    }
  }

  const curSlot = locked;
  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);

  return (
    <div
      className="snap-overlay"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="slider" aria-label={t('flick.aria')} aria-valuemin={-1} aria-valuemax={1}
      aria-valuenow={curSlot !== null ? SLOTS[curSlot].value : 0}
      aria-valuetext={curSlot !== null ? t(SLOTS[curSlot].key) : t('flick.notyet')}
      tabIndex={0}
    >
      {progress && <div className="snap-progress">{progress}</div>}
      {onClose && (
        <button className="snap-close" onClick={onClose} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon size={22} />
        </button>
      )}

      <div className={`snap-card ${active ? 'dragging' : ''}`}
        style={{ transform: `translate(${render.x}px, ${-render.y}px)` }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your dish" className="snap-photo" draggable={false} />
        ) : (
          <div className="snap-photo flick-nophoto"><span>{displayName ?? '🍽️'}</span></div>
        )}
        {curSlot !== null && <div className="flick-word snap-word">{t(SLOTS[curSlot].key)}</div>}
      </div>

      <div className="snap-rail" aria-hidden>
        {SLOTS.map((s, i) => <span key={i} className={`snap-tick ${curSlot === i ? 'on' : ''}`} />)}
      </div>

      {curSlot === null && !active && <div className="flick-hint">{t('flick.hint')}</div>}
    </div>
  );
}
