'use client';
// Magnetic-snap rating — the signature interaction of the album stack.
//
// FEEL model (v4, from owner testing):
//  - FULL-SCREEN glass overlay; the portrait photo is a card you hold.
//  - VERTICAL is the rating: a magnetic detent with hysteresis pulls the card
//    into the nearest of 6 slots and CLICKS to the next only past BREAK. Once
//    locked it sits dead-still at the slot centre (no give → no jitter).
//  - HORIZONTAL past SKIP_ARM is a Tinder-style DISMISS: fling the card toward the
//    edge and the bottom label turns to "Skip"; release there and the dish is
//    skipped (no rating). Small sideways drift is just free play.
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
const XFOLLOW = 0.7;  // small horizontal drift, damped (free play, no effect)
const SKIP_ARM = 92;  // horizontal past this = DISMISS intent (label turns to Skip)
const XCLAMP = 200;   // let the card travel toward the edge when flinging to skip
const SPRING = 0.48;  // per-frame ease toward the target — the crisp settle owner approved
const TOP_SLOT = 0;
const BOT_SLOT = 5;   // SLOTS.length - 1
const EXIT_MS = 320;  // fling-off duration on skip before the parent advances

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Discrete colour feedback for the locked slot — a static filter that only
// changes on a click, so it costs nothing per frame.
function filterFor(slot: number | null): string {
  if (slot === null) return 'none';
  const v = SLOTS[slot].value; // −0.9 … 1
  return `saturate(${(1 + v * 0.5).toFixed(3)}) brightness(${(1 + v * 0.08).toFixed(3)})`;
}

export default function SnapRating({
  photoUrl, dishName, dishNameZh, onRate, onSkip, progress, onClose,
}: {
  photoUrl: string | null;
  dishName?: string;
  dishNameZh?: string | null;
  onRate: (score: number) => void; // release-while-locked = rated; parent advances
  onSkip?: () => void;             // release past SKIP_ARM = dismissed; parent advances, no rating
  progress?: string;               // subtitle under the title, e.g. "1 / 12 dishes"
  onClose?: () => void;
}) {
  const { t, lang } = useLang();
  const [render, setRender] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState<number | null>(null);
  const [skip, setSkip] = useState(false);
  const [active, setActive] = useState(false);
  const [imgOk, setImgOk] = useState(true); // false if the photo can't decode (e.g. a HEIC we couldn't convert)
  const [exitDir, setExitDir] = useState<number | null>(null); // ±1 while the card flings off on skip

  const startX = useRef(0);
  const startY = useRef(0);
  const lockRef = useRef<number | null>(null);
  const skipRef = useRef(false);
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

  function setLock(next: number | null) {
    if (next === lockRef.current) return;
    if (next !== null) { try { navigator.vibrate?.(12); } catch { /* iOS no-op */ } }
    lockRef.current = next;
    setLocked(next);
  }
  function setSkipping(next: boolean) {
    if (next === skipRef.current) return;
    if (next) { try { navigator.vibrate?.(8); } catch { /* iOS no-op */ } }
    skipRef.current = next;
    setSkip(next);
  }

  function retarget(clientX: number, clientY: number) {
    const rawY = startY.current - clientY; // up positive — UNBOUNDED (drag it right off-screen)
    const rawX = clamp(clientX - startX.current, -XCLAMP, XCLAMP);
    const skipping = Math.abs(rawX) >= SKIP_ARM;
    setSkipping(skipping);

    if (skipping) {
      // dismiss mode — no rating; the card slides toward the edge with your thumb.
      setLock(null);
      target.current = { x: rawX, y: rawY * 0.5 };
      return;
    }

    let lock = lockRef.current;
    // Open-ended extremes: drag past the top slot and it's the best rating, past the
    // bottom and it's the worst — no dead zone, no boundary. Middle slots use the
    // hysteresis wells.
    if (rawY >= SLOTS[TOP_SLOT].drag) lock = TOP_SLOT;
    else if (rawY <= SLOTS[BOT_SLOT].drag) lock = BOT_SLOT;
    else {
      if (lock !== null && Math.abs(rawY - SLOTS[lock].drag) > BREAK) lock = null; // popped out
      if (lock === null) {
        let best = 0, bestD = Infinity;
        SLOTS.forEach((s, i) => { const d = Math.abs(s.drag - rawY); if (d < bestD) { bestD = d; best = i; } });
        if (bestD < CAPTURE) lock = best;
      }
    }
    setLock(lock);
    // Card position. PAST the top/bottom slot it follows the finger 1:1 (fling it
    // clean off-screen — no boundary). Otherwise it PINS to the locked slot's centre:
    // the card holds at a slot and snaps decisively to the next past BREAK — the crisp
    // magnetic "click into place" (this is the feel owner approved a few versions ago).
    const overTop = lock === TOP_SLOT && rawY > SLOTS[TOP_SLOT].drag;
    const overBot = lock === BOT_SLOT && rawY < SLOTS[BOT_SLOT].drag;
    const y = (overTop || overBot) ? rawY
      : lock !== null ? SLOTS[lock].drag
      : rawY;
    target.current = { x: rawX * XFOLLOW, y };
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
    const skipping = skipRef.current;
    const lock = lockRef.current;
    setLock(null);
    setSkipping(false);
    if (skipping && onSkip) {
      // fling the card off the way it was thrown, then advance (parent unmounts us).
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = 0; }
      const dir = cur.current.x >= 0 ? 1 : -1;
      setExitDir(dir);
      try { navigator.vibrate?.(10); } catch { /* iOS no-op */ }
      window.setTimeout(onSkip, EXIT_MS);
      return;
    }
    if (!skipping && lock !== null) {
      try { navigator.vibrate?.(20); } catch { /* iOS no-op */ }
      onRate(SLOTS[lock].value);                          // the lock WAS the confirmation
      return;
    }
    target.current = { x: 0, y: 0 };                      // nothing chosen → spring home
    runSpring();
  }

  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);
  // fade the card as it's flung past the skip threshold, toward "gone".
  const overEdge = Math.min(1, Math.max(0, (Math.abs(render.x) - SKIP_ARM) / (XCLAMP - SKIP_ARM)));

  return (
    <div
      className="snap-overlay"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="slider" aria-label={t('flick.aria')} aria-valuemin={-1} aria-valuemax={1}
      aria-valuenow={locked !== null ? SLOTS[locked].value : 0}
      aria-valuetext={skip ? t('rate.skip') : locked !== null ? t(SLOTS[locked].key) : t('flick.notyet')}
      tabIndex={0}
    >
      {progress && <div className="snap-head"><div className="snap-sub">{progress}</div></div>}
      {onClose && (
        <button className="snap-close" onClick={onClose} aria-label={t('log.cancelflow')} title={t('log.cancelflow')}>
          <CloseIcon size={22} />
        </button>
      )}

      <div className={`snap-card ${exitDir !== null ? 'exiting' : ''}`}
        style={exitDir !== null
          ? {  // toss it off-screen the way it was flung: sideways, a touch of fall + spin, fading out
              transform: `translate3d(${exitDir * 130}vw, ${-cur.current.y + 90}px, 0) rotate(${exitDir * 12}deg)`,
              opacity: 0, pointerEvents: 'none',
            }
          : { transform: `translate3d(${render.x}px, ${-render.y}px, 0)`, opacity: 1 - 0.5 * overEdge }}>
        {photoUrl && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Your dish" className="snap-photo" draggable={false}
            style={{ filter: filterFor(locked) }} onError={() => setImgOk(false)} />
        ) : (
          // no photo, or one the browser couldn't decode — still fully ratable/skippable
          <div className="snap-photo flick-nophoto"><span>{displayName ?? '🍽️'}</span></div>
        )}
      </div>

      <div className="snap-rail" aria-hidden>
        {SLOTS.map((s, i) => <span key={i} className={`snap-tick ${!skip && locked === i ? 'on' : ''}`} />)}
      </div>

      {/* status word — bottom-centre of the SCREEN, off the card */}
      {skip
        ? <div className="snap-word is-skip">{t('rate.skip')}</div>
        : locked !== null
          ? <div className="snap-word">{t(SLOTS[locked].key)}</div>
          : null}
    </div>
  );
}
