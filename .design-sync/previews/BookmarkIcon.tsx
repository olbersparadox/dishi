import { BookmarkIcon } from 'dishi';

// Bookmark ribbon — outline when not yet bookmarked, ink-filled once it is.
// Lives on the feed card, paired with the bookmark COUNT (social proof, shown
// to every viewer including the poster) — .feed-bookmark-btn.

/** The icon alone, outline vs filled, at a spread of sizes. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <BookmarkIcon size={16} />
      <BookmarkIcon size={20} />
      <BookmarkIcon size={26} filled />
      <BookmarkIcon size={40} filled />
    </div>
  );
}

/** The feed card's real bookmark control — count first, then the icon,
 *  not-yet-bookmarked vs already-bookmarked. */
export function FeedBookmark() {
  return (
    <div style={{ display: 'flex', gap: 20, padding: 24 }}>
      <button className="feed-bookmark-btn" aria-label="收埋">
        <span className="feed-bookmark-count">12</span>
        <BookmarkIcon size={20} />
      </button>
      <button className="feed-bookmark-btn" disabled aria-label="已收埋">
        <span className="feed-bookmark-count">13</span>
        <BookmarkIcon size={20} filled />
      </button>
    </div>
  );
}
