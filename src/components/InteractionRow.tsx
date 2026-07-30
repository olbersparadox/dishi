'use client';
// ONE row for every interaction in the /api/interactions/today feed, in two
// VARIANTS — the bell lists them as text, the journal's 今日 strip as the photo
// pair being compared. Two host files, one module: they previously carried
// byte-identical row markup side by side (the repo's "reuse, don't imitate"
// rule), and what must never fork again is the WORDING logic below, which is
// where the precision bug lived.
//
// No 印/比 glyph on either variant (owner call, 2026-07-29): nobody can tell
// the two marks apart, so the row simply reads as a comparison. 印 still means
// what it always meant on the duel card itself, where the sealed bet lives.
import { Fragment } from 'react';
import { useLang } from '@/lib/i18n';
import { type Interaction } from '@/lib/useInteractions';

/** The only dish fields a row needs — the narrow shape both DuelDish and
 *  ExecRow['dish'] already satisfy. */
type RowDish = {
  id: string; name: string; name_zh: string | null; photo_url: string | null;
  restaurant?: string | null; restaurant_id?: string | null;
};

/** The pair being compared, in the order the overlay will show it. */
export function dishesOf(n: Interaction): RowDish[] {
  return n.kind === 'duel' ? [n.duel.a, n.duel.b] : n.rows.map(r => r.dish);
}

/**
 * Which execution comparison this actually IS. The mechanic serves BOTH shapes
 * (isExecutionSibling in taste.ts links siblings by cross-venue canonical id OR
 * by per-venue identity), and the old single line said 「邊間」 — "which SHOP" —
 * for both, which reads as a mix-up the moment the pair is one kitchen across
 * two visits.
 *
 * Keyed on the RESTAURANT, never on which id linked them: two plates can share
 * a canonical dish AND a restaurant (the same shop's 蛋撻, twice), so the link
 * type says nothing about venue. Ids, not names — HK chains give branches
 * identical names, and 「同一間」 about two different branches is the same lie
 * in the other direction. Anything we can't state confidently (home cooking,
 * one side missing a restaurant) falls to the place-free wording.
 */
export function execComparisonKind(dishes: RowDish[]): 'same' | 'cross' | 'again' {
  const [a, b] = dishes;
  if (!a?.restaurant_id || !b?.restaurant_id) return 'again';
  if (a.restaurant_id !== b.restaurant_id) return 'cross';
  return a.restaurant ? 'same' : 'again';
}

export default function InteractionRow({ interaction: n, variant, role, onClick }: {
  interaction: Interaction;
  /** 'text' — the bell's list. 'pair' — the journal's 今日 strip. */
  variant: 'text' | 'pair';
  role: 'menuitem' | 'listitem';
  onClick: () => void;
}) {
  const { t, lang } = useLang();
  const dishes = dishesOf(n);
  const isDuel = n.kind === 'duel';
  const nameOf = (d: RowDish) => ((lang === 'zh' ? d.name_zh : null) ?? d.name ?? '').trim();

  // ONE line per row (owner call, 2026-07-30): no title above it, the sentence
  // carries the whole ask. The card the row opens still leads with its own
  // title, so nothing is lost by the time the person is actually answering.
  const line = (() => {
    if (n.kind === 'duel') return t(n.rematch ? 'notif.duel.rematch' : 'notif.duel.sub');
    // The dish being asked about is the LATER instance (rows are
    // [reference, mine]); the place, when we name one, is the shared venue.
    const mine = dishes[dishes.length - 1];
    const kind = execComparisonKind(dishes);
    return t(`notif.exec.sub.${kind}`)
      .replace('{dish}', nameOf(mine))
      .replace('{place}', mine?.restaurant ?? '');
  })();

  if (variant === 'text') {
    return (
      <button className="notif-item" role={role} onClick={onClick}>
        <span className="notif-item-line">{line}</span>
      </button>
    );
  }

  // 'pair' — the photos ARE the message, so what a sighted user reads off them
  // (the ask, then both dishes) rides the button's aria-label instead.
  const spoken = [t(isDuel ? 'duel.title' : 'exec.title'), dishes.map(nameOf).filter(Boolean).join(' / ')]
    .filter(Boolean).join(' — ');
  return (
    <button className="notif-item" role={role} onClick={onClick} aria-label={spoken}>
      <span className="notif-thumbs" aria-hidden>
        {dishes.map((d, i) => (
          <Fragment key={d.id}>
            {i > 0 && <span className="notif-vs">VS</span>}
            {d.photo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.photo_url} alt="" className="notif-thumb" />
              : <span className="notif-thumb notif-thumb-blank" />}
          </Fragment>
        ))}
      </span>
    </button>
  );
}
