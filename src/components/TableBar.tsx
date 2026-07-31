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
import { InviteIcon } from '@/components/icons';

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
  return (
    <div className="table-bar">
      <span className="table-bar-left">
        <span className="table-bar-codewrap">
          <span className="table-bar-label">{t('scan.tablelabel')}</span>
          <span className="table-bar-code">{code}</span>
        </span>
        {/* Headcount + dishes picked as one quiet meta line, sitting right after
            the code (separated by a "|") — status, not a dashboard. */}
        <span className="table-bar-stat">{t('scan.tablestatus', { n: memberCount, m: pickCount })}</span>
      </span>
      <button className="table-invite-btn" onClick={onInvite} aria-label={t('table.invite')} title={t('table.invite')}>
        <InviteIcon size={16} />
      </button>
      {restaurantLine}
    </div>
  );
}
