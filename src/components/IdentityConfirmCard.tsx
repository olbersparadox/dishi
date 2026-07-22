'use client';
// 係咪同一味？ — the dish-identity confirm card, on the 對決 card's chassis
// (backlog 2026-07-22). Gate 3 of the identity pipeline: gates 1+2 (string
// prefilter + LLM adjudication, see dishIdentity.ts) nominated exactly one
// candidate pair; a HUMAN decides. Nothing is ever merged automatically.
//
// Chassis reuse is real, not cosmetic: the two sides mount the SAME DuelSide
// component the duel card renders. The deliberate divergences are the spec's
// own hard requirements:
//  - Sides are NOT tappable. In a duel, tapping a side means "I prefer this" —
//    an identical affordance here would let duel muscle memory merge two dishes
//    by accident. Answers come ONLY from the button row beneath.
//  - Different header (係咪同一味？), NO seal glyph — nothing is predicted or
//    sealed here; the card must be instantly distinguishable from 今日對決.
//  - ✓ circle-check = 係同一味, ✗ circle-X = 唔同嘅 — ink-colored house line
//    icons (the shapes carry the meaning, not green/red); 唔肯定 is the quiet
//    de-emphasized skip, reusing the duel's own .duel-tie treatment, with
//    cooldown semantics server-side.
// Result strip stays until OK (the duel-reveal pattern) so the outcome is
// actually readable.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import DuelSide, { type DuelDish } from './DuelSide';
import { CheckIcon, CloseIcon } from './icons';

export type IdentityOutcome = 'same' | 'different' | 'unsure';

export default function IdentityConfirmCard({ mine, other, onDone }: {
  /** The just-logged / swept dish (left) and the candidate it may BE (right). */
  mine: DuelDish;
  other: DuelDish;
  /** Called once the answer is committed (or on the quiet skip / a failed
   * commit). 'same' means a real merge happened — callers refetch what they
   * show, since the canonical name and the OTHER dish's link both changed
   * server-side in ways a local patch can't know. */
  onDone: (outcome: IdentityOutcome) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'same' | 'different' | null>(null);

  async function answer(outcome: IdentityOutcome) {
    if (busy || result) return;
    setBusy(true);
    try {
      const res = await fetch('/api/dishes/identity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: mine.id,
          same_as_dish_id: outcome === 'same' ? other.id : undefined,
          not_same_as_dish_id: outcome === 'different' ? other.id : undefined,
          unsure_about_dish_id: outcome === 'unsure' ? other.id : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      if (outcome === 'unsure') { onDone('unsure'); return; } // quiet skip — no strip
      setResult(outcome);
    } catch {
      onDone('unsure'); // a failed commit closes quietly; the pair may be asked again later
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card duel-card identity-card">
      <div className="card-body">
        {/* Header: title only — deliberately no seal glyph (nothing is sealed
            here), which is what makes this instantly distinguishable from the
            duel card at a glance. */}
        <div className="duel-head">
          <div className="duel-head-center">
            <span className="duel-title">{t('identity.title')}</span>
          </div>
        </div>

        <div className="duel-pair">
          {[mine, other].map(dish => (
            <div key={dish.id} className={`duel-option identity-side ${result === 'same' ? 'won' : ''}`}>
              <DuelSide dish={dish} />
            </div>
          ))}
        </div>

        {!result ? (
          <>
            <div className="identity-answers">
              <button className="identity-answer" onClick={() => answer('same')} disabled={busy} aria-label={t('identity.same')}>
                <span className="identity-answer-circle"><CheckIcon size={22} /></span>
              </button>
              <button className="identity-answer" onClick={() => answer('different')} disabled={busy} aria-label={t('identity.notsame')}>
                <span className="identity-answer-circle"><CloseIcon size={22} /></span>
              </button>
            </div>
            <button className="duel-tie" onClick={() => answer('unsure')} disabled={busy}>
              {t('identity.unsure')}
            </button>
          </>
        ) : (
          <div className="duel-reveal" role="status">
            <span className="identity-result">{result === 'same' ? t('identity.merged') : t('identity.kept')}</span>
            <div className="ok-circle-wrap">
              <button className="ok-circle" onClick={() => onDone(result)} aria-label={t('duel.ok')}>
                <CheckIcon size={26} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
