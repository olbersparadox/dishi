'use client';
// Magnetic-snap rating — the signature interaction of the album stack.
//
// FEEL model (v4, from owner testing):
//  - FULL-SCREEN overlay; the portrait photo is a card you hold.
//  - VERTICAL is the rating: a magnetic detent with hysteresis pulls the card
//    into the nearest of 6 slots and CLICKS to the next only past BREAK. Once
//    locked it sits dead-still at the slot centre (no give → no jitter).
//  - HORIZONTAL is free physical play (doesn't affect the rating); it springs
//    home when you let go without rating.
//  - Motion is a JS SPRING, not a CSS transition. Pushing new transform values
//    into a CSS transition every frame restarts the ease each frame — that was
//    the shake/blur on approach. The spring eases toward a target we control and
//    settles to an exact pixel, so the snap is smooth and the rest is crisp.
//  - RATE ON RELEASE: the lock is the confirmation, so letting go while locked
//    commits + advances (no Next button). Release mid-transit rates nothing.
//  - As you cross into a slot the photo's saturation/brightness shifts (warmer &
//    richer up top, cooler & dimmer at the bottom) — discrete, so it's cheap.
//
// Haptic: navigator.vibrate is a no-op on iOS Safari; the lock "click" is carried
// by the snap + the colour shift. vibrate still fires on Android.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CloseIcon } from '@/components/icons';

// Slots stack top(most positive) → bottom. `drag` = the vertical offset (px, up
// positive) the card centres on. Rest (0) sits between the two middle slots so a
// fresh card is "not rated yet".
const GAP = 80;
const SLOT_META: { key: string; value: number }[] = [
  { key: 'flick.inhaled',  value: 1 },
  { key: 'flick.loved',    value: 0.6 },
  { key: 'flick.good',     value: 0.35 },
  { key: 'flick.fine',     value: 0.1 },
  { key: 'flick.notforme', value: -0.5 },
  { key: 'flick.never',    value: -0.9 },
];
const SLOTS = SLOT_META.map((m, i) => ({ ...m, drag: (2.5 - i) * GAP })); // +200 … −200

// Wide, strong wells that nearly touch: the card stays pinned through almost the
// whole transit and clicks over only past BREAK, so the tremor-prone free zone is
// tiny. CAPTURE < BREAK is the hysteresis (harder to leave than to enter).
const CAPTURE = 34;
const BREAK = 46;     // just above CAPTURE — a light tug pops it out of the slot
const XFOLLOW = 0.7;  // horizontal play, damped (never affects the rating)
const XCLAMP = 120;
const MAXY = 2.5 * GAP + 50;
const SPRING = 0.44;  // per-frame ease toward the target (higher = snappier)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Discrete colour feedback for the locked slot — a static filter that only
// changes on a click, so it costs nothing per frame.
function filterFor(slot: number | null): string {
  if (slot === null) return 'none';
  const v = SLOTS[slot].value; // −0.9 … 1
  return `saturate(${(1 + v * 0.5).toFixed(3)}) brightness(${(1 + v * 0.08).toFixed(3)})`;
}

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
  const [render, setRender] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState<number | null>(null);
  const [active, setActive] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const lockRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const target = useRef({ x: 0, y: 0 }); // where the card wants to be
  const cur = useRef({ x: 0, y: 0 });    // where it is (spring-integrated)
  const anim = useRef(0);

  useEffect(() => () => { if (anim.current) cancelAnimationFrame(anim.current); }, []);

  function runSpring() {
    if (anim.current) return;
    const step = () => {
      const t = target.current, c = cur.current;
      c.x += (t.x - c.x) * SPRING;
      c.y += (t.y - c.y) * SPRING;
      const settled = Math.abs(t.x - c.x) < 0.4 && Math.abs(t.y - c.y) < 0.4;
      if (settled) { c.x = t.x; c.y = t.y; }        // land exactly → crisp, no shimmer
      setRender({ x: c.x, y: c.y });
      if (settled && !activeRef.current) { anim.current = 0; return; } // done resting
      anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }

  function retarget(clientX: number, clientY: number) {
    const rawY = clamp(startY.current - clientY, -MAXY, MAXY); // up positive
    const rawX = clamp(clientX - startX.current, -XCLAMP, XCLAMP);

    let lock = lockRef.current;
    if (lock !== null && Math.abs(rawY - SLOTS[lock].drag) > BREAK) lock = null; // popped out
    if (lock === null) {
      let best = 0, bestD = Infinity;
      SLOTS.forEach((s, i) => { const d = Math.abs(s.drag - rawY); if (d < bestD) { bestD = d; best = i; } });
      if (bestD < CAPTURE) lock = best;
    }
    if (lock !== lockRef.current) {                 // crossed a well boundary → click
      if (lock !== null) { try { navigator.vibrate?.(12); } catch { /* iOS no-op */ } }
      lockRef.current = lock;
      setLocked(lock);
    }
    // vertical pins to the slot centre when locked; horizontal is always free play
    target.current = { x: rawX * XFOLLOW, y: lock !== null ? SLOTS[lock].drag : rawY };
  }

  function down(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    activeRef.current = true;
    setActive(true);
    runSpring();
  }
  function move(e: React.PointerEvent) {
    if (!activeRef.current) return;
    retarget(e.clientX, e.clientY);
  }
  function up() {
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    const lock = lockRef.current;
    lockRef.current = null;
    setLocked(null);
    if (lock !== null) {
      try { navigator.vibrate?.(20); } catch { /* iOS no-op */ }
      onRate(SLOTS[lock].value); // the lock WAS the confirmation → commit + advance
    } else {
      target.current = { x: 0, y: 0 }; // nothing chosen → spring home
      runSpring();
    }
  }

  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);

  return (
    <div
      className="snap-overlay"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="slider" aria-label={t('flick.aria')} aria-valuemin={-1} aria-valuemax={1}
      aria-valuenow={locked !== null ? SLOTS[locked].value : 0}
      aria-valuetext={locked !== null ? t(SLOTS[locked].key) : t('flick.notyet')}
      tabIndex={0}
    >
      {progress && <div className="snap-progress">{progress}</div>}
      {onClose && (
        <button className="snap-close" onClick={onClose} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon size={22} />
        </button>
      )}

      <div className="snap-card" style={{ transform: `translate3d(${render.x}px, ${-render.y}px, 0)` }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your dish" className="snap-photo" draggable={false}
            style={{ filter: filterFor(locked) }} />
        ) : (
          <div className="snap-photo flick-nophoto"><span>{displayName ?? '🍽️'}</span></div>
        )}
      </div>

      <div className="snap-rail" aria-hidden>
        {SLOTS.map((s, i) => <span key={i} className={`snap-tick ${locked === i ? 'on' : ''}`} />)}
      </div>

      {/* rating name lives at the bottom-centre of the SCREEN, off the card */}
      {locked !== null && <div className="snap-word">{t(SLOTS[locked].key)}</div>}
      {locked === null && !active && <div className="flick-hint">{t('flick.hint')}</div>}
    </div>
  );
}
