'use client';
// ONE card for every feed author — a persona, any user's post, and (parked)
// a 食家. The author line is always `dishi.<name>`, which is the whole point of
// the merge: a persona is treated the same as any other dishi user, so a new
// author type needs no new screen (lib/feed.ts).
//
// PHOTO-FORWARD FORMAT (owner, 2026-07-28): the card mounts DuelSide — the
// duel reveal's own single-side anatomy (large photo, dish name, location) —
// wrapped as a static, non-tappable side exactly the way IdentityConfirmCard
// already does, rather than a new lookalike photo card built from scratch
// ("reuse, don't imitate"). `.duel-pair.resolving` collapses its flex layout
// to one full-width item, which is the literal "pick one, reveal" look the
// owner pointed at — no new grid/sizing CSS needed, only a cursor reset.
//
// Sits inside .rated-dish-row so the list still divides the same way the
// first tab's journal rows do; only the anatomy INSIDE each row changed.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import DuelSide from './DuelSide';
import Chop from './Chop';
import { chopColorFor } from '@/lib/chop';
import type { FeedItem } from '@/lib/feed';

export default function FeedCard({ item, onBookmarked }: {
  item: FeedItem & { bookmarked?: boolean };
  onBookmarked: (id: string) => void;
}) {
  const { t, pair } = useLang();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const bookmark = async () => {
    if (saving || item.bookmarked || !item.dish.id) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: item.dish.id }),
      });
      if (!res.ok) { setFailed(true); return; }
      onBookmarked(item.id);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  // Chop color has no user_id to key off here (FeedAuthor carries only a
  // username — personas like dishi.Spoon have no real user_id at all), so it
  // seeds off the username instead. Same fallback MyDishes.tsx already uses
  // for a companion chop with no id (chopColorFor(c.user_id ?? c.name)).
  const chopColor = chopColorFor(item.author.username);

  return (
    <article className="rated-dish-row">
      <div className="duel-pair resolving">
        <div className="duel-option feed-side feed-post">
          <DuelSide
            dish={{
              id: item.dish.id ?? item.id,
              name: item.dish.name ?? '', name_zh: item.dish.name_zh,
              photo_url: item.dish.photo_url, restaurant: item.dish.restaurant,
            }}
            pair={pair}
            afterPhoto={
              <div className="feed-author-row">
                <div className="feed-author-id">
                  <Chop name={item.author.username} color={chopColor} size={28} />
                  <span className="feed-author-name">dishi.{item.author.username}</span>
                </div>
                {/* The verdict is never optional dressing on a user's post: posts
                    may be negative, and a card that showed only the dish would
                    read as a recommendation of it. */}
                {item.verdict && <span className="feed-author-verdict">{t(item.verdict)}</span>}
              </div>
            }
          />
        </div>
      </div>
      {item.reason && <div className="feed-reason-box">{item.reason}</div>}
      {/* Your own post carries no bookmark: /api/bookmarks refuses a dish you
          already own, so the button's only possible outcome would be an
          error. The author row already reads dishi.<you>, which is the only
          "this is yours" marker the card needs. */}
      {!item.own && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button type="button" className="btn small" disabled={saving || !!item.bookmarked} onClick={bookmark}>
            {item.bookmarked ? t('feed.bookmarked') : t('feed.bookmark')}
          </button>
          {failed && <span className="card-meta" style={{ marginLeft: 8 }}>{t('feed.bookmark.failed')}</span>}
        </div>
      )}
    </article>
  );
}
