'use client';
// 迎新 — the album-first cold start (owner design session 2026-07-29). Two cards
// and then the ask, nothing more: the third beat of every onboarding is churn,
// so ours is DOING it. The CTA opens the merged pill's OWN album input (the
// parent passes a click-through to the same node — one entry point), and the
// rating experience that follows IS RatingStack → TasteGrowth. Every step is
// skippable via the corner ✕.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { TasteFormLive } from '@/components/TasteForm';
import { ArrowRightIcon, CloseIcon, HomeIcon, PhotoIcon, UtensilsIcon } from '@/components/icons';

// Card 2's art: a small ILLUSTRATIVE blob from fixed demo inputs — never the
// person's own data, which at this moment is a bare circle and would undersell
// the destination the card is naming.
const DEMO_FORM = {
  vector: { umami: 0.5, crispy: 0.4, fresh: 0.3, spicy: 0.25, sweet: 0.15 },
  evidence: { umami: 6, crispy: 5, fresh: 4, spicy: 3, sweet: 2 },
  ratingCount: 18,
  seed: 'onboard-demo',
};

export default function Onboarding({ onPick, onSkip }: {
  /** Open the merged pill's album file input — the same node, not a copy. */
  onPick: () => void;
  /** Dismiss the walkthrough for good (the parent records the seen flag). */
  onSkip: () => void;
}) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const last = step === 2;

  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="card" style={{ position: 'relative', width: '100%', margin: 0 }}>
          <button type="button" className="grow-close" onClick={onSkip} aria-label={t('grow.skip')}>
            <CloseIcon size={18} />
          </button>
          <div className="card-body" style={{ textAlign: 'center', padding: '38px 26px 20px' }}>
            {step === 0 && (<>
              {/* The merged pill's own three segment icons: equal-weight logging,
                  shown with the same marks that teach it on the Taste tab. */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 26, color: 'var(--ink)', marginBottom: 20 }}>
                <UtensilsIcon size={36} /><HomeIcon size={36} /><PhotoIcon size={36} />
              </div>
              <p style={{ lineHeight: 1.7 }}>{t('onboard.card1')}</p>
            </>)}
            {step === 1 && (<>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <TasteFormLive inputs={DEMO_FORM} size={132} />
              </div>
              <p style={{ lineHeight: 1.7 }}>{t('onboard.card2')}</p>
              <p className="card-meta" style={{ marginTop: 8 }}>{t('onboard.card2.scan')}</p>
            </>)}
            {last && (<>
              <h3 style={{ marginBottom: 6 }}>{t('onboard.ask')}</h3>
              <p className="card-meta">{t('onboard.ask.hint')}</p>
            </>)}
            <div className="ok-circle-wrap" style={{ marginTop: 28 }}>
              {last ? (
                <button type="button" className="ok-circle" onClick={onPick} aria-label={t('onboard.pick')}>
                  <PhotoIcon size={26} />
                </button>
              ) : (
                <button type="button" className="ok-circle" onClick={() => setStep(s => s + 1)} aria-label={t('onboard.next')}>
                  <ArrowRightIcon size={26} />
                </button>
              )}
            </div>
            <div className="persona-dots" style={{ marginTop: 8 }}>
              {[0, 1, 2].map(i => (
                <button key={i} type="button" className={`persona-dot${step === i ? ' on' : ''}`}
                  aria-label={t('onboard.step', { n: i + 1 })} aria-current={step === i}
                  onClick={() => setStep(i)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
