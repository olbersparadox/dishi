'use client';
// ONE card for every feed author — a persona, any user's post, and (parked)
// a 食家. The author line is always `dishi.<name>`, which is the whole point of
// the merge: a persona is treated the same as any other dishi user, so a new
// author type needs no new screen (lib/feed.ts).
//
// Built from the journal's own row anatomy (.rated-dish-row / .card-body /
// .card-title / .card-meta) rather than a lookalike card, so the second tab
// reads as the same object family as the first.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import type { RankedFeedItem } from '@/lib/feed';

export default function FeedCard({ item, onBookmarked }: {
  item: RankedFeedItem & { bookmarked?: boolean };
  onBookmarked: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const name = lang === 'zh'
    ? [item.dish.name_zh, item.dish.name].filter(Boolean).join(' / ')
    : [item.dish.name, item.dish.name_zh].filter(Boolean).join(' / ');

  const bookmark = async () => {
    if (saving || item.bookmarked) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: item.id }),
      });
      if (!res.ok) { setFailed(true); return; }
      onBookmarked(item.id);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rated-dish-row">
      <div className="card-body">
        <p className="card-meta" style={{ margin: 0 }}>dishi.{item.author.username}</p>
        <div className="card-title" style={{ marginTop: 2 }}>{name}</div>
        {item.dish.restaurant && <div className="card-meta">{item.dish.restaurant}</div>}
        {/* The verdict is never optional dressing on a user's post: posts may be
            negative, and a card that showed only the dish would read as a
            recommendation of it. */}
        {item.verdict && <p className="card-meta" style={{ margin: '4px 0 0' }}>{t(item.verdict)}</p>}
        {item.reason && <p style={{ margin: '4px 0 0', fontSize: 13.5 }}>{item.reason}</p>}
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn small" disabled={saving || !!item.bookmarked} onClick={bookmark}>
            {item.bookmarked ? t('feed.bookmarked') : t('feed.bookmark')}
          </button>
          {failed && <span className="card-meta" style={{ marginLeft: 8 }}>{t('feed.bookmark.failed')}</span>}
        </div>
      </div>
    </article>
  );
}
