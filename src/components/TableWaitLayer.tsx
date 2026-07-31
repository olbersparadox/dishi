'use client';
// The layer between "I'm done picking" and the bill: I have tapped, the table
// has not finished, and this says what is being waited for.
//
// Deliberately NOT an ExplainModal, though it borrows that modal's geometry:
// an explainer is tap-to-learn-more and closes on a scrim tap, and both of those
// are wrong here. A stray tap outside must not quietly un-ready me, because the
// rest of the table is blocked on my tap and would have no idea it had been
// taken back. Leaving is an explicit button instead.
//
// It also shows WHO it is waiting for rather than just a count: at a real table
// that turns "why is this stuck" into "Wing hasn't tapped yet", which someone
// can act on by looking up from their phone.
import Chop from '@/components/Chop';
import { useLang } from '@/lib/i18n';
import type { Member } from '@/lib/useTableSession';

export default function TableWaitLayer({ members, colorFor, onKeepPicking }: {
  members: Member[];
  colorFor: (userId: string) => string;
  onKeepPicking: () => void;
}) {
  const { t } = useLang();
  const ready = members.filter(m => m.ready_at).length;
  return (
    <>
      <div className="wait-scrim" />
      <div className="explain-modal wait-layer" role="status" aria-live="polite">
        <p className="explain-modal-title">{t('table.ready.waiting')}</p>
        <p className="wait-progress">{t('table.ready.progress', { n: ready, total: members.length })}</p>
        <div className="wait-chops">
          {members.map(m => (
            <div key={m.user_id} className={`wait-chop ${m.ready_at ? 'is-ready' : ''}`}>
              <Chop name={m.display_name ?? m.handle} color={colorFor(m.user_id)} size={40} />
            </div>
          ))}
        </div>
        <div className="ok-circle-wrap">
          <button className="btn ghost small" onClick={onKeepPicking}>{t('table.ready.undo')}</button>
        </div>
      </div>
    </>
  );
}
