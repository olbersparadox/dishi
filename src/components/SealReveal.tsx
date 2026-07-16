'use client';
// Shown once, immediately after a rating breaks a seal (Session A/B seal spec).
// The prediction was written server-side BEFORE the rating existed — this card is
// the ONLY place its content is ever shown, and only after the fact. It now carries
// three things the engine committed to in advance: the direction it called, the
// honest reason it sealed, and (when earned) the run of consecutive hits.
import { useLang } from '@/lib/i18n';

export type SealResult = {
  predicted_direction: string;
  actual_direction: string;
  outcome: 'hit' | 'near' | 'miss';
  reason_zh?: string | null;
  reason_en?: string | null;
  streak?: number;
};

export default function SealReveal({ seal }: { seal: SealResult }) {
  const { t, lang } = useLang();
  const glyph = seal.outcome === 'hit' ? '中' : seal.outcome === 'near' ? '近' : '印';
  const reason = lang === 'zh' ? seal.reason_zh : seal.reason_en;
  // A streak line only when the engine has genuinely earned a run (2+ in a row),
  // and only on a hit — bragging about a streak on the rating that just broke it
  // would be dishonest.
  const showStreak = seal.outcome === 'hit' && (seal.streak ?? 0) >= 2;

  return (
    <div className={`seal-reveal ${seal.outcome}`} role="status">
      <div className="seal-reveal-stamp" aria-hidden>{glyph}</div>
      <div className="seal-reveal-title">{t(`seal.reveal.${seal.outcome}`)}</div>
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
