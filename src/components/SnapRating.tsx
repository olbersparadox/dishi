'use client';
// Magnetic-snap rating — the signature interaction of the album stack. You press the
// photo and drag; instead of a fuzzy continuous value, it SETTLES into 6 detents
// (the same 6 levels the engine already treats as meaningful), each with a haptic
// tick, a word, and a rail dot. Overshoot-and-settle gives a satisfying "clunk into
// the slot" that IS the confirmation of your call. Release on a slot commits it.
//
// Snapping to 6 discrete levels is deliberately cleaner than the old continuous drag
// for learning: people can't feel the difference between +0.6 and +0.5, so those
// in-between values were noise — the 6 chip anchors are what actually teach.
//
// FEEL is judged by thumb; spacing / spring / haptic are meant to be tuned live.
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

// Top slot = most drag-up = most positive. `drag` = target vertical offset in px
// (up positive) the image magnetically snaps to. Even 48px spacing; the ±24 gap
// across zero is the "not rated yet" resting zone.
const SLOTS: { key: string; value: number; drag: number }[] = [
  { key: 'flick.inhaled',  value: 1,    drag:  120 },
  { key: 'flick.loved',    value: 0.6,  drag:  72 },
  { key: 'flick.good',     value: 0.35, drag:  24 },
  { key: 'flick.fine',     value: 0.1,  drag: -24 },
  { key: 'flick.notforme', value: -0.5, drag: -72 },
  { key: 'flick.never',    value: -0.9, drag: -120 },
];
const CLAMP = 150;   // max drag travel
const REST_GAP = 12; // below this |drag|, no slot is chosen (resting)

export default function SnapRating({
  photoUrl, dishName, dishNameZh, onRate,
}: {
  photoUrl: string | null;
  dishName?: string;
  dishNameZh?: string | null;
  onRate: (score: number) => void;
}) {
  const { t, lang } = useLang();
  const [slot, setSlot] = useState<number | null>(null); // snapped slot index
  const [active, setActive] = useState(false);
  const startY = useRef(0);
  const lastSlot = useRef<number | null>(null);

  function nearest(dragY: number): number | null {
    if (Math.abs(dragY) < REST_GAP) return null;
    let best = 0, bestD = Infinity;
    SLOTS.forEach((s, i) => { const d = Math.abs(s.drag - dragY); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setActive(true);
  }
  function move(e: React.PointerEvent) {
    if (!active) return;
    const dragY = Math.max(-CLAMP, Math.min(CLAMP, startY.current - e.clientY)); // up positive
    const idx = nearest(dragY);
    if (idx !== lastSlot.current) {
      lastSlot.current = idx;
      setSlot(idx);
      if (idx !== null) { try { navigator.vibrate?.(10); } catch { /* unsupported */ } } // tick on each snap
    }
  }
  function up() {
    if (!active) return;
    setActive(false);
    if (slot !== null) { try { navigator.vibrate?.(16); } catch { /* unsupported */ } onRate(SLOTS[slot].value); }
    // resting (slot null): a tap/tremor, not a rating — leave it.
  }

  // Image nudges toward the slot (a fraction of the drag — full travel would reveal
  // the frame edge; scale(1.45) keeps it covered). The rail + haptic carry the
  // precise level. IMG_TRAVEL is a feel knob to tune live.
  const IMG_TRAVEL = 0.4;
  const y = (slot !== null ? -SLOTS[slot].drag : 0) * IMG_TRAVEL;
  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);

  return (
    <div
      className={`flick-stage snap-stage card ${active ? 'dragging' : ''}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="slider" aria-label={t('flick.aria')} aria-valuemin={-1} aria-valuemax={1}
      aria-valuenow={slot !== null ? SLOTS[slot].value : 0}
      aria-valuetext={slot !== null ? t(SLOTS[slot].key) : t('flick.notyet')}
      tabIndex={0}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Your dish" className="card-photo snap-photo" style={{ transform: `translateY(${y}px) scale(1.45)` }} draggable={false} />
      ) : (
        <div className="card-photo snap-photo flick-nophoto" style={{ transform: `translateY(${y}px) scale(1.45)` }}>
          <span>{displayName ?? '🍽️'}</span>
        </div>
      )}

      {/* Rail of 6 detent dots — you SEE which slot you're settling into. */}
      <div className="snap-rail" aria-hidden>
        {SLOTS.map((s, i) => <span key={i} className={`snap-tick ${slot === i ? 'on' : ''}`} />)}
      </div>

      {slot !== null && <div className="flick-word snap-word">{t(SLOTS[slot].key)}</div>}
      {slot === null && !active && <div className="flick-hint">{t('flick.hint')}</div>}
    </div>
  );
}
