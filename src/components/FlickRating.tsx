'use client';
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

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

const WORD_KEYS: [number, string][] = [
  [0.85, 'flick.inhaled'],
  [0.5, 'flick.loved'],
  [0.15, 'flick.good'],
  [-0.15, 'flick.fine'],
  [-0.5, 'flick.notforme'],
  [-1.01, 'flick.never'],
];

const CHIPS: { key: string; value: number }[] = [
  { key: 'flick.never', value: -0.9 },
  { key: 'flick.notforme', value: -0.5 },
  { key: 'flick.fine', value: 0.1 },
  { key: 'flick.loved', value: 0.6 },
  { key: 'flick.inhaled', value: 1 },
];

export function wordKeyFor(score: number) {
  for (const [min, key] of WORD_KEYS) if (score >= min) return key;
  return 'flick.never';
}

export default function FlickRating({
  photoUrl,
  onCommit,
}: {
  photoUrl: string;
  onCommit: (score: number) => void;
}) {
  const { t } = useLang();
  const [drag, setDrag] = useState(0); // -1..1 live value
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [showChips, setShowChips] = useState(false);
  const startY = useRef(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  const RANGE = 180; // px of drag for full intensity

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setActive(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!active) return;
    const dy = startY.current - e.clientY; // up = positive
    setDrag(Math.max(-1, Math.min(1, dy / RANGE)));
  }
  function onPointerUp() {
    if (!active) return;
    setActive(false);
    if (Math.abs(drag) < 0.1) { setDrag(0); return; } // too small: treat as accidental
    stage(drag);
  }

  /** Commit after a short undo window. */
  function stage(score: number) {
    setPending(score);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setPending(null);
      onCommit(score);
    }, 2500);
  }
  function undo() {
    clearTimeout(undoTimer.current);
    setPending(null);
    setDrag(0);
  }

  const v = pending ?? drag;
  const saturation = 1 + Math.max(0, v) * 0.6 - Math.max(0, -v) * 0.85;
  const scale = 1 + Math.max(0, v) * 0.03;
  const fillColor = v >= 0 ? 'var(--lacquer)' : 'var(--ink-soft)';
  const fillHeight = `${Math.abs(v) * 50}%`;
  const fillPos = v >= 0 ? { bottom: '50%' } : { top: '50%' };

  return (
    <div>
      <div
        className="flick-stage card"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label={t('flick.aria')}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(v.toFixed(2))}
        aria-valuetext={Math.abs(v) >= 0.1 ? t(wordKeyFor(v)) : t('flick.notyet')}
        tabIndex={0}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Your dish"
          className="card-photo flick-photo"
          style={{ filter: `saturate(${saturation})`, transform: `scale(${scale})` }}
          draggable={false}
        />
        <div className="flick-gauge" aria-hidden>
          <div className="flick-fill" style={{ ...fillPos, height: fillHeight, background: fillColor }} />
        </div>
        {Math.abs(v) >= 0.1 && <div className="flick-word">{t(wordKeyFor(v))}</div>}
        {!active && pending === null && Math.abs(v) < 0.1 && (
          <div className="flick-hint">{t('flick.hint')}</div>
        )}
      </div>

      <button className="btn ghost small" onClick={() => setShowChips(s => !s)}>
        {showChips ? t('flick.hidetaps') : t('flick.tap')}
      </button>
      {showChips && (
        <div className="chips" style={{ marginTop: 10 }}>
          {CHIPS.map(c => (
            <button key={c.key} className="chip" onClick={() => stage(c.value)}>{t(c.key)}</button>
          ))}
        </div>
      )}

      {pending !== null && (
        <div className="toast" role="status">
          <span>{t(wordKeyFor(pending))}</span>
          <button onClick={undo}>{t('flick.undo')}</button>
        </div>
      )}
    </div>
  );
}
