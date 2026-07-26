'use client';
// 佢哋整得點？ — the execution-quality card. Third consumer of the 對決 chassis,
// per the standing "comparison is the core product DNA" direction: it mounts
// DuelOverlay's shell classes and DuelSide's dish anatomy rather than a
// lookalike (CLAUDE.md, "Reuse, don't imitate").
//
// What it asks is NOT "was it the dish or the kitchen" — that question is never
// put to the eater. It asks only how well THIS kitchen rendered the dish, and
// the dish-vs-kitchen answer falls out of comparing instances later
// (isExecutionConfounded in taste.ts).
//
// What this card wraps around a side is deliberately DIFFERENT from a duel's:
// duels wrap each side in a tappable button meaning "I prefer this". Here the
// sides are static — the judgement is the slider, and a tappable side would
// invite duel muscle memory to answer a question this card isn't asking.
//
// FIRST-PASS VISUAL — the slider's own styling wants a Claude Design pass, same
// footing as DuelOverlay's header comment.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CloseIcon, CheckIcon } from './icons';
import DuelSide, { type DuelDish } from './DuelSide';

/** A previously-scored instance of the SAME dish identity — the comparison that
 * gives this card its meaning. Empty on the first instance, which is fine: the
 * score still banks and becomes usable the moment the dish repeats. */
export type ExecutionSibling = { dish: DuelDish; score: number };

export default function ExecutionSlider({
  dish, min, max, siblings = [], onDone,
}: {
  dish: DuelDish;
  /** Bounds handed down by the server so this card cannot contradict the flick —
   * never recomputed here (see /api/ratings). */
  min: number;
  max: number;
  siblings?: ExecutionSibling[];
  /** scored=false when skipped or dismissed. Skipping is free, always. */
  onDone: (scored: boolean) => void;
}) {
  const { t } = useLang();
  // Start mid-range so the card never pre-accuses a kitchen the person hasn't
  // judged yet — they must move it or skip.
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  function close(scored: boolean) {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onDone(scored), 340); // let the fade-out play, as duels do
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/ratings/execution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, execution_score: value }),
      });
      close(res.ok);
    } catch {
      close(false); // a failed save must not trap the person in the card
    } finally { setBusy(false); }
  }

  return (
    <div className={`duel-overlay ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={t('exec.title')}>
      <div className="duel-backdrop" onClick={() => close(false)} />
      <div className="card duel-card duel-floating">
        <div className="card-body">
          <div className="duel-head">
            <div className="duel-head-center">
              <span className="duel-title">{t('exec.title')}</span>
            </div>
            <button className="duel-x" onClick={() => close(false)} aria-label={t('home.cancel')}><CloseIcon /></button>
          </div>

          {/* The dish being judged, plus any earlier rendering of the same dish —
              side by side, because the comparison IS the point. Static, not
              tappable: see the header note. */}
          <div className="duel-pair">
            {siblings.map(s => (
              <div key={s.dish.id} className="duel-option exec-sibling">
                <DuelSide dish={s.dish} />
                <span className="exec-prior">{t('exec.prior', { n: s.score })}</span>
              </div>
            ))}
            <div className="duel-option">
              <DuelSide dish={dish} />
            </div>
          </div>

          <p className="duel-q">{t('exec.q')}</p>

          <div className="exec-scale">
            <output className="exec-value" aria-live="polite">{value}</output>
            <input
              className="exec-range"
              type="range" min={min} max={max} step={1} value={value}
              onChange={e => setValue(Number(e.target.value))}
              aria-label={t('exec.title')}
            />
            <div className="exec-ends">
              <span>{t('exec.low')}</span>
              <span>{t('exec.high')}</span>
            </div>
            {/* Only meaningful when the range actually spans the passing line —
                a flick-bounded range sits entirely on one side of it. */}
            {min < 5 && max >= 5 && <span className="exec-pass">{t('exec.pass')}</span>}
          </div>

          <div className="ok-circle-wrap">
            <button className="ok-circle" onClick={submit} disabled={busy} aria-label={t('duel.ok')}>
              <CheckIcon size={26} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
