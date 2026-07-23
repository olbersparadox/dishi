'use client';
// The shared "tap-to-learn-more" explainer: a centered modal (dead-centre of the
// screen, position:fixed), title centred, body left-aligned, dismissed by the
// shared circle-check .ok-circle at the bottom. ONE implementation so every
// explainer — the 味 AI stat boxes and the 印 seal stamp anywhere it appears —
// is identical in size, type, alignment, and dismissal.
//
// z-index sits ABOVE the duel overlay (z-60) via .explain-scrim/.explain-modal
// (70/71), so a 印 tapped inside the duel card still opens on top of it.
import { useLang } from '@/lib/i18n';
import { CheckIcon } from './icons';

export default function ExplainModal({ title, body, extra, footer, onClose }: {
  title: string;
  /** Optional only for callers whose real content is block-level (lists) and
   * lives in `extra` — a <p> may not contain an <ol>. */
  body?: React.ReactNode;
  /** Optional content after the body (e.g. the 菜系 cuisine pills). */
  extra?: React.ReactNode;
  /** Replaces the default dismiss circle with a caller-owned action (the persona
   * install layer's copy circle). Scrim dismissal still applies — the layer's
   * bottom circle can then DO something instead of only closing. */
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useLang();
  return (
    <>
      <div className="explain-scrim" onClick={onClose} />
      <div className="explain-modal" role="dialog" aria-label={title}>
        <p className="explain-modal-title">{title}</p>
        {body != null && <p className="explain-modal-body">{body}</p>}
        {extra}
        {footer ?? (
          <div className="ok-circle-wrap">
            <button className="ok-circle" onClick={onClose} aria-label={t('duel.ok')}><CheckIcon size={26} /></button>
          </div>
        )}
      </div>
    </>
  );
}
