'use client';
// 佢哋整得點？ — execution quality, as a COMPARISON. Third consumer of the 對決
// chassis, per "comparison is the core product DNA" (CLAUDE.md): it mounts
// DuelSide's dish anatomy and DuelOverlay's shell rather than a lookalike.
//
// Two shapes, one mechanic:
//   ONE row  — no other instance of this dish exists yet. Lays down an ANCHOR,
//              bounded by the flick (a 唔會再食 can only be 1-4).
//   TWO rows — a previous instance exists. Both sliders are LIVE, the earlier
//              one preset to whatever it was last set to (or mid-range if it
//              was never scored). The signal is the GAP between them.
//
// Why the reference stays editable: the earlier dish's score is a judgement,
// not a fact, and judgement legitimately moves once the two are side by side —
// "actually that one was better than I remembered; this is a 2." Freezing it
// into a read-only label would destroy the comparison this card exists to make.
// Each row is still bounded by its OWN flick, so revising the reference can
// never contradict how that meal was actually rated.
//
// The card never asks "was it the dish or the kitchen" — that is inferred from
// the gap (isExecutionConfounded in taste.ts), never self-reported.
//
// FIRST-PASS VISUAL — the scale styling wants a Claude Design pass, same
// footing as DuelOverlay's own header note.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { CloseIcon, CheckIcon } from './icons';
import { wordKeyFor } from '@/lib/flickWords';
import DuelSide, { type DuelDish } from './DuelSide';

/** One dish on the card. `min`/`max` come from the server — each row is bounded
 * by ITS OWN flick, so a positively-rated reference can't be dragged to 1. */
export type ExecutionRow = {
  dish: DuelDish;
  min: number;
  max: number;
  /** Where the slider starts: a previously recorded score, or null for mid-range. */
  value: number | null;
  /** The dish's own flick score (raw), so the reference row's "上次" label can
   * fall back to its verdict word (wordKeyFor) when `value` is null — which
   * it usually is, since most rated dishes never get execution-scored. */
  verdictScore: number;
};

export default function ExecutionSlider({ rows, onDone }: {
  /** One row (anchor) or two (comparison, earlier dish FIRST). */
  rows: ExecutionRow[];
  /** scored=false when skipped or dismissed. Skipping is always free. */
  onDone: (scored: boolean) => void;
}) {
  const { t } = useLang();
  const mid = (r: ExecutionRow) => Math.round((r.min + r.max) / 2);
  // Mid-range start on an unscored row so the card never pre-accuses a kitchen
  // the person hasn't judged; a previously scored row opens where they left it.
  const [values, setValues] = useState<number[]>(rows.map(r => r.value ?? mid(r)));
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const comparing = rows.length > 1;
  // The comparing shape asks a sharper question once a second instance is on
  // screen ("which one"), so it gets its own title — see exec.title.compare.
  const title = t(comparing ? 'exec.title.compare' : 'exec.title');

  function close(scored: boolean) {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onDone(scored), 340); // let the fade-out play, as duels do
  }

  // The TRACK is always the full 1-10, whatever the flick permits — two capped
  // scales drawn at different widths are not comparable, and comparison is the
  // whole point (a 2 on a 1-4 track sits where a 5 sits on a 1-10 one). The cap
  // constrains where the thumb may LAND, not how the scale is drawn.
  function setAt(i: number, v: number) {
    const r = rows[i];
    const clamped = Math.min(r.max, Math.max(r.min, v));
    setValues(cur => cur.map((x, j) => (j === i ? clamped : x)));
  }

  /** Where a value sits along the full 1-10 track, as a percentage. */
  const pos = (v: number) => ((v - 1) / 9) * 100;

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      // Both rows are sent: on a comparison the reference may have just been
      // revised, and the revision is as much a judgement as the new score.
      const res = await fetch('/api/ratings/execution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: rows.map((r, i) => ({ dish_id: r.dish.id, execution_score: values[i] })),
        }),
      });
      if (!res.ok) { close(false); return; }
      close(true); // ends right here — no separate "收到" acknowledgement beat
    } catch {
      close(false); // a failed save must not trap the person in the card
    } finally { setBusy(false); }
  }

  return (
    <div className={`duel-overlay ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="duel-backdrop" onClick={() => close(false)} />
      <div className="card duel-card duel-floating">
        <div className="card-body">
          <div className="duel-head">
            <div className="duel-head-center">
              <span className="duel-title">{title}</span>
            </div>
            <button className="duel-x" onClick={() => close(false)} aria-label={t('home.cancel')}><CloseIcon /></button>
          </div>

          {/* The anchor shape still explains what's being asked (not whether you
              like the dish); the comparing shape's title already says exactly
              that ("which one"), so no sub-line repeats it underneath. */}
          {!comparing && <p className="duel-q">{t('exec.q')}</p>}

          {/* Each dish sits in the duel card's own two-up pair, with its OWN scale
              directly beneath it — so which slider belongs to which plate is never
              in question. Sides are STATIC: the answer is the scale, and a tappable
              side would invite duel muscle memory to answer a question this card
              isn't asking. One row (the anchor shape) spans the full width. */}
          <div className={`duel-pair ${comparing ? '' : 'exec-single'}`}>
            {rows.map((r, i) => (
              <div className="duel-option exec-col" key={r.dish.id}>
                <DuelSide dish={r.dish} />
                {/* The STORED value, not values[i] — a fixed historical anchor
                    even as the person drags the (still-editable) reference
                    slider right below it, so the label and the live number
                    can visibly diverge. Most reference dishes have never been
                    execution-scored (that ask only fires on a strong flick or
                    an existing sibling — see ratings/route.ts's ANCHOR_THRESHOLD),
                    so this falls back to the dish's own flick verdict word —
                    the SAME wordKeyFor every other rated-dish row in the app
                    reads off (MyDishes, TasteGrowth, the feed) — never a
                    number invented for a slider nobody has touched yet. */}
                {comparing && i === 0 && (
                  <span className="exec-prior">
                    {t('exec.prior').replace('{n}', r.value != null ? String(r.value) : t(wordKeyFor(r.verdictScore)))}
                  </span>
                )}
                <div className="exec-scale">
                  <output className="exec-value" aria-live="polite">{values[i]}</output>
                  {/* Full 1-10 track always; the shaded band marks what this
                      flick allows, and the thumb clamps to it. */}
                  <div
                    className={`exec-track ${r.min > 1 || r.max < 10 ? 'capped' : ''}`}
                    style={{ ['--lo' as string]: `${pos(r.min)}%`, ['--hi' as string]: `${pos(r.max)}%` }}
                  >
                    <input
                      className="exec-range"
                      type="range" min={1} max={10} step={1} value={values[i]}
                      onChange={e => setAt(i, Number(e.target.value))}
                      aria-label={r.dish.restaurant ?? t('exec.title')}
                      aria-valuemin={r.min}
                      aria-valuemax={r.max}
                      style={{ ['--val' as string]: `${pos(values[i])}%` }}
                    />
                  </div>
                  <div className="exec-ends">
                    <span>{t('exec.low')}</span>
                    <span>{t('exec.high')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ok-circle-wrap">
            <button className="ok-circle" onClick={submit} disabled={busy} aria-label={t('duel.ok')}>
              {busy ? <span className="icon-btn-spinner ok-circle-spinner" aria-hidden /> : <CheckIcon size={26} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
