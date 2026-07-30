'use client';
// The row of 名印 chops under a dish showing who at the table has picked it.
//
// Extracted from table/page.tsx's inline JSX so /scan mounts the EXACT same
// element tree rather than its own rendering of the same idea. It previously
// showed picker handles as a plain text line there ("X 也選了"), which is what
// the owner saw in the field test as "just a line under chips" — a lookalike, not
// the real stamp. Per CLAUDE.md, two surfaces that must look the same mount one
// component; tests/tableChassis.test.tsx asserts that identity so a re-divergence
// fails rather than ships.
import Chop from '@/components/Chop';
import { useLang } from '@/lib/i18n';
import type { Stamp } from '@/lib/tableStamps';

/** Capped so a table of 12 piling onto one dish can't blow out the row's width;
 * the remainder becomes a "+N" badge. */
export const STAMP_CAP = 5;

export default function ChopStampRow({ itemKey, stamps, colorFor }: {
  /** Only for the per-chop React key — stable as `${itemKey}:${user_id}` so each
   * chop's pop-in animation plays exactly once, when THAT person joins the dish,
   * rather than replaying for everyone whenever the list re-renders. */
  itemKey: string;
  stamps: Stamp[];
  colorFor: (userId: string) => string;
}) {
  const { t } = useLang();
  if (stamps.length === 0) return null;
  return (
    // Right-aligned under the price, spaced rather than overlapped (owner request,
    // 2026-07-21).
    <div className="chop-stamp-row" style={{ marginTop: 5 }} aria-label={t('table.stampedby', { n: stamps.length })}>
      {stamps.slice(0, STAMP_CAP).map(s => (
        <span className="chop-stamp-pop" key={`${itemKey}:${s.user_id}`}>
          <Chop name={s.name} color={colorFor(s.user_id)} size={26} />
        </span>
      ))}
      {stamps.length > STAMP_CAP && <span className="chop-stamp-overflow">+{stamps.length - STAMP_CAP}</span>}
    </div>
  );
}
