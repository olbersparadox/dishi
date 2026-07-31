'use client';
// The compact table-status bar — 檯號: XXXX | N人·已選N道 | +邀請. Originally
// only ever rendered inline inside scan/page.tsx's "sharing a scan" glance;
// extracted so /table (the full session view) mounts the EXACT same component
// instead of a look-alike header of its own.
//
// 離開 used to live here as a text button, but that crowded the bar against
// the code/count/invite — it moved to an icon-only button on table/page.tsx's
// own title row instead (owner feedback, 2026-07-21).
import { useLang } from '@/lib/i18n';
import { InviteIcon, CopyIcon } from '@/components/icons';
import Toast, { useToast } from '@/components/Toast';

export default function TableBar({ code, memberCount, pickCount, onInvite, restaurantLine }: {
  code: string;
  memberCount: number;
  pickCount: number;
  onInvite: () => void;
  /** Which restaurant this table is at (TableRestaurantLine). Lives INSIDE the bar
   * so it reads as part of the same status block rather than a floating caption,
   * and so both screens that mount TableBar get it without either one placing it
   * itself. The bar wraps, and the line takes a full row of its own. */
  restaurantLine?: React.ReactNode;
}) {
  const { t } = useLang();
  const toast = useToast();
  // Confirms in the SAME pill the journal's share uses (components/Toast), not an
  // alert: a copy is a statement, and 5 characters on the clipboard don't warrant
  // a dialog to dismiss. The pill names the code, so it doubles as proof that the
  // right one was copied.
  const copyCode = () => {
    const confirm = () => toast.show(t('table.codecopied', { code }));
    navigator.clipboard.writeText(code).then(confirm).catch(() => {
      // Fallback for older browsers or insecure contexts.
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      confirm();
    });
  };
  return (
    <div className="table-bar">
      <span className="table-bar-left">
        {/* title/aria describe the ACTION. They said "Link copied — send it to the
            table" before anything had been copied, and named a link this button
            has never put on the clipboard. */}
        <button className="table-bar-codewrap" onClick={copyCode} type="button"
          title={t('table.copycode')} aria-label={`${t('table.copycode')} ${code}`}>
          <span className="table-bar-label">{t('scan.tablelabel')}</span>
          <span className="table-bar-code">{code}</span>
          <span className="table-bar-copy-icon"><CopyIcon size={16} /></span>
        </button>
        {/* Headcount + dishes picked as one quiet meta line, sitting right after
            the code (separated by a "|") — status, not a dashboard. */}
        <span className="table-bar-stat">{t('scan.tablestatus', { n: memberCount, m: pickCount })}</span>
        {/* Inside .table-bar-left (position:relative, no transform) so it drops
            directly under the code — the notification panel's own behaviour,
            where the eye already is. */}
        <Toast message={toast.message} onDone={toast.onDone} anchor="left" />
      </span>
      <button className="table-invite-btn" onClick={onInvite} aria-label={t('table.invite')} title={t('table.invite')}>
        <InviteIcon size={20} />
      </button>
      {restaurantLine}
    </div>
  );
}
