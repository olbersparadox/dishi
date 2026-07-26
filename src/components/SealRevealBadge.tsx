'use client';
// The broken 封印, as a STAMP on the dish it belongs to — replaces the stacked
// reveal cards that used to sit above the dish rows on the growth screen (killed
// 2026-07-26: three verdicts × four lines each buried the review list under a
// wall of prose, and each card had to re-name its own dish just to be legible).
//
// Now the verdict rides beside the dish's own name, in the same square-stamp
// treatment as the 印 seal it breaks: the face IS the result, so the outcome
// reads at a glance and the words only appear when asked for. Tapping opens the
// shared ExplainModal (same card as the 味 AI attribute explainers and the 印
// stamp's own explainer) with the full reveal: the same face again, big and
// centred, then what was predicted and what it actually was as two lines, then
// — smaller — the reason sealed in advance, what THIS rating taught the engine
// (the session-wide banner that used to sit above the dish rows now lives
// here, scoped to the one dish it's about), and the streak when earned.
//
// The honesty contract is untouched: this component only ever renders a verdict
// the server already decided and returned. Nothing here can surface a pending seal.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import ExplainModal from './ExplainModal';

export type SealResult = {
  /** Row id — the client acks the render with it so an unshown reveal stays
   * recoverable rather than being silently consumed. */
  id?: string;
  predicted_direction: string;
  actual_direction: string;
  outcome: 'hit' | 'near' | 'miss';
  reason_zh?: string | null;
  reason_en?: string | null;
  streak?: number;
  /** What THIS rating taught the engine — rides on the seal it broke, since the
   * reveal balloon is the only place it's shown now (the session-wide banner
   * above the dish rows was retired 2026-07-26). Absent when the rating moved
   * nothing, or on an older reveal recovered from a session that never
   * persisted it. */
  taught?: { dim: string; dir: number }[];
  /** WHICH dish this verdict is about — now load-bearing rather than cosmetic:
   * it's how the badge finds its row. A reveal with no dish (or a dish that
   * isn't in this session) has nowhere to land and is left unshown, and
   * therefore also unacked, so it stays recoverable. */
  dish?: { id?: string; name: string; name_zh?: string | null } | null;
};

// The result, as a face. Deliberately the ONLY difference between the three
// stamps: keeping the vermillion square constant (it's the 印 being broken)
// means the eye reads "a seal opened here" first and the verdict second.
const FACE: Record<SealResult['outcome'], string> = { hit: '😁', near: '😉', miss: '😅' };

export default function SealRevealBadge({ seal, size = 'tile', showStreak: showStreakProp = true }: {
  seal: SealResult;
  /** 'tile' — the growth screen's review row, where the badge pairs with the
   *  black name TILE and matches its height. 'inline' — a text run (已評嘅菜),
   *  where it sits right after the dish name at the name's own size, exactly
   *  like the 印 stamp it replaces there. */
  size?: 'tile' | 'inline';
  /** In a multi-seal batch only the NEWEST verdict carries the streak line — the
   * streak is a running count over history, so repeating it on every dish would
   * read as several different streaks instead of one. It's also OFF in any
   * historical list: a run that ended weeks ago is not news about this dish. */
  showStreak?: boolean;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const reason = lang === 'zh' ? seal.reason_zh : seal.reason_en;
  // A streak line only when the engine has genuinely earned a run (2+ in a row),
  // and only on a hit — bragging about a streak on the rating that just broke it
  // would be dishonest.
  const showStreak = showStreakProp && seal.outcome === 'hit' && (seal.streak ?? 0) >= 2;
  // Still computed for the badge's OWN aria-label/title (the outcome, named for
  // a screen reader or a hover) — just no longer printed as a headline inside
  // the balloon, which now leads with the big face instead.
  const title = t(`seal.reveal.${seal.outcome}`);
  const learnt = seal.taught?.length
    ? t('profile.justlearned', {
        dims: seal.taught.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · '),
      })
    : null;

  return (
    <>
      <button
        type="button"
        className={`seal-badge seal-badge-${size} seal-badge-${seal.outcome}`}
        aria-label={title}
        title={title}
        aria-expanded={open}
        // stopPropagation/preventDefault: the badge sits inside the dish row's
        // head, next to the tap-to-rename name tile — opening the verdict must
        // not also open the name editor.
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
      >
        <span aria-hidden>{FACE[seal.outcome]}</span>
      </button>
      {open && (
        <ExplainModal
          ariaLabel={title}
          // The face, big and centred, leads the balloon — the same emoji as the
          // badge itself, just no longer squeezed into an 18px tile.
          title={<span className="seal-modal-face" aria-hidden>{FACE[seal.outcome]}</span>}
          extra={
            <>
              <p className="seal-modal-line">{t('seal.reveal.predicted', { predicted: t(`seal.direction.${seal.predicted_direction}`) })}</p>
              <p className="seal-modal-line">{t('seal.reveal.actual', { actual: t(`seal.direction.${seal.actual_direction}`) })}</p>
              {(reason || learnt || showStreak) && (
                <div className="seal-modal-detail">
                  {reason && <p className="seal-modal-reason">{t('seal.reveal.sealed', { reason })}</p>}
                  {/* What THIS rating taught — the same copy/format the old
                      session-wide banner used, now scoped to the one dish this
                      balloon is about. */}
                  {learnt && <p className="seal-modal-learnt">{learnt}</p>}
                  {showStreak && <p className="seal-modal-streak">{t('seal.reveal.streak', { n: seal.streak as number })}</p>}
                </div>
              )}
            </>
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
