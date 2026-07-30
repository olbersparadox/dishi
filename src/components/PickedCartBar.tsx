'use client';
// The black footer bar: the TABLE's picks so far — count + running bill — and the
// way out of picking.
//
// Extracted because /scan and /table each had their own copy of this markup, and
// they had quietly come to mean DIFFERENT THINGS: scan counted my own picks,
// table counted the whole table's. Same chrome, same position, two semantics — so
// one table showed two numbers and it read as a sync bug. Per CLAUDE.md's
// "reuse, don't imitate", there is now one of these and both screens mount it.
//
// It counts the WHOLE TABLE's picks, by owner ruling (2026-07-30): the first
// unification made it my-picks-only on both screens, and the owner immediately
// read the resulting cross-device disagreement as the same sync bug again
// ("user 1's counter doesn't count user 2"). The rule this settles: a counter on
// a SHARED surface must show the same number on every member's screen, or it
// looks broken regardless of what it means. What-I-ordered already has its own
// honest surface — the rating queue this bar links to — and the running total
// only makes sense table-wide anyway (it's the bill, not my share).
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { ArrowRightIcon } from '@/components/icons';

export default function PickedCartBar({ picked, onDone }: {
  picked: { key: string; price?: string | null }[];
  /**
   * Table mode only (2+ members): the bar stops being a way OUT of picking and
   * becomes "I'm done picking", which is a claim about me that the table then
   * has to agree with before anything happens.
   *
   * Omitted for a solo scanner, who keeps the straight link to the rating queue
   * — there is no handshake to make with yourself, and dropping a lone diner
   * into a split-the-bill screen would be worse than the link they had.
   */
  onDone?: () => void;
}) {
  const { t } = useLang();
  // Dedupe by key HERE, not at the call sites: the scanner's local item list is
  // never deduped (unlike the session's), so a menu printing one name twice would
  // hand this two rows for one dish — the counted-twice bug, and a double-counted
  // bill. One shared guard beats two remembered ones.
  const seen = new Set<string>();
  const dishes = picked.filter(i => !seen.has(i.key) && (seen.add(i.key), true));
  if (!dishes.length) return null;
  const priceSummary = sumPrices(dishes.map(i => i.price ?? null));
  // Only worth showing once at least one picked dish has a real price — otherwise
  // this would just be a count with extra steps. When some (but not all) picked
  // prices are unreadable/missing, the "+" is load-bearing: it's an honest floor,
  // not the real total, and must never be shown as one.
  const priceLabel = priceSummary.parsedCount > 0
    ? `${priceSummary.currency}${priceSummary.total}${priceSummary.complete ? '' : '+'}`
    : null;
  // Count on the left, running total hard-right — different KINDS of information
  // (what the table did vs what it costs), so they sit at opposite ends rather
  // than run together into one comma-joined string.
  //
  // A link, not the inert receipt this used to be: picking is finished when you
  // get up from the menu, and the next thing you want is to rate what you ate.
  // Both screens were pointerEvents:'none', so there was no way onward from
  // either (owner, 2026-07-30: "cannot go to next").
  // Same pill either way — the chrome is the table's running bill in both modes,
  // and only what the tap MEANS changes. A second bar styled to match would be
  // the lookalike this component was extracted to kill.
  const inner = (
    <>
      <span>{onDone ? t('table.ready.done') : t('scan.pickcount', { n: dishes.length })}</span>
      <span className="cart-bar-end">
        {priceLabel && <span className="cart-total">{priceLabel}</span>}
        <ArrowRightIcon />
      </span>
    </>
  );
  return (
    <div className="cart-bar">
      {onDone
        ? <button type="button" className="btn primary cart-btn" onClick={onDone}>{inner}</button>
        : <Link href="/profile#to-rate" className="btn primary cart-btn">{inner}</Link>}
    </div>
  );
}
