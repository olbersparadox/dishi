'use client';
// The black footer bar: what I picked this session, and the way out of picking.
//
// Extracted because /scan and /table each had their own copy of this markup, and
// they had quietly come to mean DIFFERENT THINGS: scan counted my own picks,
// table counted the whole table's. Same chrome, same position, same styling, two
// semantics — so the two screens showed different numbers for one table and it
// read as a sync bug (owner, 2026-07-30: "user 1's counter is out of sync again",
// and on a fresh session "the counter does not show up" on the scanner, which was
// simply the scanner having picked nothing of their own yet). Per CLAUDE.md's
// "reuse, don't imitate", there is now one of these and both screens mount it.
//
// It counts MY picks on both screens, because it is the door to the rating queue
// and you can only ever rate what you yourself ordered. The whole table's count
// already has a home directly above, in TableBar's 已選 N 道.
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { ArrowRightIcon } from '@/components/icons';

export default function PickedCartBar({ picked }: { picked: { price?: string | null }[] }) {
  const { t } = useLang();
  if (!picked.length) return null;
  const priceSummary = sumPrices(picked.map(i => i.price ?? null));
  // Only worth showing once at least one picked dish has a real price — otherwise
  // this would just be a count with extra steps. When some (but not all) picked
  // prices are unreadable/missing, the "+" is load-bearing: it's an honest floor,
  // not the real total, and must never be shown as one.
  const priceLabel = priceSummary.parsedCount > 0
    ? `${priceSummary.currency}${priceSummary.total}${priceSummary.complete ? '' : '+'}`
    : null;
  // Count on the left, running total hard-right — different KINDS of information
  // (what you did vs what it costs), so they sit at opposite ends rather than run
  // together into one comma-joined string.
  //
  // A link, not the inert receipt this used to be: picking is finished when you get
  // up from the menu, and the next thing you want is to rate what you ate. Both
  // screens were pointerEvents:'none', so there was no way onward from either
  // (owner, 2026-07-30: "cannot go to next").
  return (
    <div className="cart-bar">
      <Link href="/profile#to-rate" className="btn primary cart-btn">
        <span>{t('scan.pickcount', { n: picked.length })}</span>
        <span className="cart-bar-end">
          {priceLabel && <span className="cart-total">{priceLabel}</span>}
          <ArrowRightIcon />
        </span>
      </Link>
    </div>
  );
}
