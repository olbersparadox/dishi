'use client';
// Shown once, immediately after a rating breaks a seal (Session A/B seal spec).
// The prediction was written server-side BEFORE the rating existed — this card is
// the ONLY place its content is ever shown, and only after the fact. It now carries
// three things the engine committed to in advance: the direction it called, the
// honest reason it sealed, and (when earned) the run of consecutive hits.
import { useLang } from '@/lib/i18n';
import DishName from '@/components/DishName';

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
  /** WHICH dish this verdict is about. Required once a session can break more
   * than one seal (an album batch seals + rates every photo): without it, two
   * stacked cards are two anonymous verdicts and the person can't tell which
   * dish either belongs to. Absent on a single-seal session, where the growth
   * screen's one dish row is unambiguous. */
  dish?: { id?: string; name: string; name_zh?: string | null } | null;
};

export default function SealReveal({ seal, showStreak: showStreakProp = true }: {
  seal: SealResult;
  /** In a multi-seal batch only the LAST card carries the streak line — the
   * streak is a running count over history, so repeating it on every card
   * would read as several different streaks instead of one. */
  showStreak?: boolean;
}) {
  const { t, lang } = useLang();
  const glyph = seal.outcome === 'hit' ? '中' : seal.outcome === 'near' ? '近' : '印';
  const reason = lang === 'zh' ? seal.reason_zh : seal.reason_en;
  // A streak line only when the engine has genuinely earned a run (2+ in a row),
  // and only on a hit — bragging about a streak on the rating that just broke it
  // would be dishonest.
  const showStreak = showStreakProp && seal.outcome === 'hit' && (seal.streak ?? 0) >= 2;

  return (
    <div className={`seal-reveal ${seal.outcome}`} role="status">
      <div className="seal-reveal-stamp" aria-hidden>{glyph}</div>
      <div className="seal-reveal-title">{t(`seal.reveal.${seal.outcome}`)}</div>
      {/* Which dish this verdict is about — the same name treatment the rest of
          the app uses (never a re-styled lookalike), so a stacked batch reads as
          one verdict per dish. */}
      {seal.dish && (
        <div className="seal-reveal-dish">
          <DishName id={seal.dish.id} name={seal.dish.name} name_zh={seal.dish.name_zh} size="md" />
        </div>
      )}
      <div className="seal-reveal-detail">
        {t('seal.reveal.detail', {
          predicted: t(`seal.direction.${seal.predicted_direction}`),
          actual: t(`seal.direction.${seal.actual_direction}`),
        })}
      </div>
      {reason && (
        <div className="seal-reveal-reason">{t('seal.reveal.sealed', { reason })}</div>
      )}
      {showStreak && (
        <div className="seal-reveal-streak">{t('seal.reveal.streak', { n: seal.streak as number })}</div>
      )}
    </div>
  );
}
