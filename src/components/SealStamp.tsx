'use client';
// The 印 seal stamp — tappable ANYWHERE it appears (duel header, pick-card names,
// anywhere a sealed prediction is marked). Tapping it opens the shared ExplainModal
// describing what the seal is. One component so the stamp and its explainer never
// drift between surfaces. Visual size is inherited from context (e.g. .duel-head
// scales it up); .seal-stamp-btn only undoes the <button> UA reset so it looks
// pixel-identical to the old inline <span>.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import ExplainModal from './ExplainModal';

export default function SealStamp({ className = '' }: { className?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`seal-stamp seal-stamp-btn ${className}`}
        aria-label={t('seal.stamp.title')}
        title={t('seal.stamp.title')}
        aria-expanded={open}
        // stopPropagation/preventDefault: the stamp often sits inside a larger tap
        // target (a pick-card, the duel header) — opening the explainer must not
        // also trigger that surface's own click.
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
      >印</button>
      {open && (
        <ExplainModal
          title={t('seal.explain.title')}
          body={t('seal.explain.body')}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
