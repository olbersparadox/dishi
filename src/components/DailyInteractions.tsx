'use client';
// 今日 daily interaction cards — the journal's slice of the interactions feed
// (owner direction, 2026-07-28: "place 2 daily out in Journal; more can live in
// the notification"). Up to TWO compact cards above the 食記 list; each opens
// the SAME overlay the bell opens (DuelOverlay / ExecutionSlider — the one
// comparison chassis, never a lookalike). The bell and this strip read one
// endpoint through one hook, so answering in either place clears both.
//
// Quiet by design: two small ink-on-paper rows, no section heading, gone
// entirely when nothing is waiting — the journal is a diary first, and an
// empty prompt strip must not leave chrome behind.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import DuelOverlay from './DuelOverlay';
import ExecutionSlider from './ExecutionSlider';
import InteractionRow from './InteractionRow';
import {
  useInteractions, notifyInteractionsChanged, interactionId,
  type Interaction,
} from '@/lib/useInteractions';

export default function DailyInteractions() {
  const { t } = useLang();
  const { interactions, refresh } = useInteractions();
  const [open, setOpen] = useState<Interaction | null>(null);

  const cards = interactions.slice(0, 2); // journal shows two; the bell hosts the rest
  if (cards.length === 0) return null;

  return (
    <>
      <div className="daily-interactions" role="list" aria-label={t('daily.title')}>
        {cards.map(n => (
          <InteractionRow key={interactionId(n)} interaction={n} variant="pair" role="listitem" onClick={() => setOpen(n)} />
        ))}
      </div>

      {open?.kind === 'duel' && (
        <DuelOverlay
          duel={open.duel}
          rematch={open.rematch}
          onClose={(resolved) => { setOpen(null); if (resolved) notifyInteractionsChanged(); }}
        />
      )}
      {open?.kind === 'execution' && (
        <ExecutionSlider
          rows={open.rows}
          onDone={(scored) => {
            setOpen(null);
            if (scored) notifyInteractionsChanged();
            else refresh.dismissExecution();
          }}
        />
      )}
    </>
  );
}
