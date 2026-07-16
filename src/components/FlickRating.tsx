'use client';
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor, CHIPS, WORD_MIN } from '@/lib/flickWords';

/**
 * The signature interaction. Three patterns were considered:
 *
 *  A. Flick with intensity (built) — press the photo and drag: up = loved, down = not
 *     for me, distance = how much. The photo itself responds (saturates + lifts on the
 *     way up, drains on the way down) and a gauge fills at the edge. Release commits;
 *     a 2.5s undo toast catches slips. One gesture, one thumb, ~1 second.
 *  B. Hold-to-fill delight meter — press and hold, a meter fills; release at the level
 *     you feel. Precise, but time-as-value means every strong rating costs ~2s by
 *     construction, and it can't express negatives without a second control.
 *  C. Two-axis drag (enjoy × would-order-again) — richest signal, but demands a
 *     decision the user hasn't consciously made; fails the "no thinking" bar.
 *
 *  A wins: fastest, bidirectional, and intensity comes free from a motion people
 *  already associate with judgment (swipe culture). Accessibility fallback: a
 *  "tap instead" row of five labeled chips (keyboard + screen-reader friendly).
 */

export default function FlickRating({
  photoUrl,
  dishName,
  dishNameZh,
  onRate,
}: {
  // null for a "pick" being rated later with no photo ever taken — the gesture
  // surface still needs SOMETHING to show; falls back to a plain named card.
  // Rating without a photo is a fully supported path, not a degraded one: a dish
  // picked off a menu has real attributes from the scan, so it teaches the engine
  // exactly as much as a photographed one does.
  photoUrl: string | null;
  dishName?: string;
  dishNameZh?: string | null;
  // Fired every time the rating changes — first swipe, or a later swipe that
  // revises it. There's no separate "final commit" step inside this component
  // anymore: the parent decides when the rating is truly final (the Done button),
  // so swiping again before that is just "change my mind," not something that
  // needs an undo timer to catch.
  onRate: (score: number) => void;
}) {
  const { t, lang } = useLang();
  const [drag, setDrag] = useState(0); // -1..1 live value
  const [active, setActive] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const startY = useRef(0);
  const rafId = useRef(0);
  const pendingDrag = useRef(0);

  const RANGE = 180; // px of drag for full intensity
  // Accidental-rating guard: below this, release is treated as a tap/tremor, not a
  // rating. MUST equal WORD_MIN (where a rating word starts showing) — see
  // flickWords.ts for why a mismatch here silently swallows the lowest band.
  const COMMIT_MIN = WORD_MIN;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setActive(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!active) return;
    const dy = startY.current - e.clientY; // up = positive
    // rAF-throttle: at 120Hz pointer rates, a React re-render per event makes the
    // drag visibly stutter on mid-range phones. One state update per frame, max.
    pendingDrag.current = Math.max(-1, Math.min(1, dy / RANGE));
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        setDrag(pendingDrag.current);
      });
    }
  }
  function onPointerUp() {
    if (!active) return;
    setActive(false);
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
    const final = pendingDrag.current || drag;
    setDrag(final);
    if (Math.abs(final) < COMMIT_MIN) { setDrag(0); pendingDrag.current = 0; return; } // tremor, not a rating
    rate(final);
  }

  /** A swipe (or tap chip) lands on a value — reported immediately, every time. */
  function rate(score: number) {
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
    setRated(score);
    onRate(score);
  }

  // Prefer the current UI language, falling back to whichever name exists — never
  // show a blank surface just because one language is missing.
  const displayName = lang === 'zh' ? (dishNameZh || dishName) : (dishName || dishNameZh);

  const v = rated ?? drag;
  const saturation = 1 + Math.max(0, v) * 0.6 - Math.max(0, -v) * 0.85;
  const scale = 1 + Math.max(0, v) * 0.03;
  const fillColor = v >= 0 ? 'var(--ink)' : 'var(--ink-soft)';
  const fillHeight = `${Math.abs(v) * 50}%`;
  const fillPos = v >= 0 ? { bottom: '50%' } : { top: '50%' };

  return (
    <div>
      <div
        className={`flick-stage card ${active ? 'dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label={t('flick.aria')}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(v.toFixed(2))}
        aria-valuetext={Math.abs(v) >= WORD_MIN ? t(wordKeyFor(v)) : t('flick.notyet')}
        tabIndex={0}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Your dish"
            className="card-photo flick-photo"
            style={{ filter: `saturate(${saturation})`, transform: `scale(${scale})` }}
            draggable={false}
          />
        ) : (
          // No photo: the dish's own NAME becomes the surface you flick. Shown in
          // the current display language (Chinese by default), large — it's the
          // title of what you're rating, not a caption.
          <div className="card-photo flick-photo flick-nophoto" style={{ filter: `saturate(${saturation})`, transform: `scale(${scale})` }}>
            <span>{displayName ?? '🍽️'}</span>
          </div>
        )}
        <svg className="flick-arrow flick-arrow-up" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path d="M12 5l6 7h-4v7h-4v-7H6z" fill="currentColor" />
        </svg>
        <div className="flick-gauge" aria-hidden>
          <div className="flick-fill" style={{ ...fillPos, height: fillHeight, background: fillColor }} />
        </div>
        <svg className="flick-arrow flick-arrow-down" viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path d="M12 19l-6-7h4V5h4v7h4z" fill="currentColor" />
        </svg>
        {Math.abs(v) >= WORD_MIN && <div className="flick-word">{t(wordKeyFor(v))}</div>}
        {!active && rated === null && Math.abs(v) < 0.1 && (
          <div className="flick-hint">{t('flick.hint')}</div>
        )}
      </div>

      {/* The tap chips are shown BY DEFAULT now, not hidden behind a "tap instead"
          toggle. The toggle made the whole scale invisible until you went looking
          for it — so the rating vocabulary (and the fact that rating is
          bidirectional at all) was discoverable only by dragging and seeing what
          happened. Showing the full scale up front makes the gesture legible: you
          can see exactly what you're aiming at before you flick. */}
      <p className="card-meta" style={{ marginTop: 10 }}>{t('flick.howto')}</p>
      <div className="chips" style={{ marginTop: 8 }}>
        {CHIPS.map(c => (
          <button
            key={c.key}
            className={`chip ${rated !== null && wordKeyFor(rated) === c.key ? 'on' : ''}`}
            onClick={() => rate(c.value)}
          >
            {t(c.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
