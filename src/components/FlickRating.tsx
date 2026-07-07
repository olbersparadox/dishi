'use client';
import { useRef, useState } from 'react';

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

const WORDS: [number, string][] = [
  [0.85, 'Inhaled it'],
  [0.5, 'Loved it'],
  [0.15, 'Pretty good'],
  [-0.15, 'It was fine'],
  [-0.5, 'Not for me'],
  [-1.01, 'Never again'],
];

const CHIPS: { label: string; value: number }[] = [
  { label: 'Never again', value: -0.9 },
  { label: 'Not for me', value: -0.5 },
  { label: 'Fine', value: 0.1 },
  { label: 'Loved it', value: 0.6 },
  { label: 'Inhaled it', value: 1 },
];

export function wordFor(score: number) {
  for (const [min, word] of WORDS) if (score >= min) return word;
  return 'Never again';
}

export default function FlickRating({
  photoUrl,
  onCommit,
}: {
  photoUrl: string;
  onCommit: (score: number) => void;
}) {
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
        aria-label="Rate this dish by dragging up or down"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(v.toFixed(2))}
        aria-valuetext={Math.abs(v) >= 0.1 ? wordFor(v) : 'not rated yet'}
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
        {Math.abs(v) >= 0.1 && <div className="flick-word">{wordFor(v)}</div>}
        {!active && pending === null && Math.abs(v) < 0.1 && (
          <div className="flick-hint">Drag up if you loved it · down if not · further = more</div>
        )}
      </div>

      <button className="btn ghost small" onClick={() => setShowChips(s => !s)}>
        {showChips ? 'Hide taps' : 'Tap instead'}
      </button>
      {showChips && (
        <div className="chips" style={{ marginTop: 10 }}>
          {CHIPS.map(c => (
            <button key={c.label} className="chip" onClick={() => stage(c.value)}>{c.label}</button>
          ))}
        </div>
      )}

      {pending !== null && (
        <div className="toast" role="status">
          <span>{wordFor(pending)}</span>
          <button onClick={undo}>Undo</button>
        </div>
      )}
    </div>
  );
}
