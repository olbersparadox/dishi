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
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import DuelSide from './DuelSide';
import Chop from './Chop';
import DishInfoDisplay from './DishInfoDisplay';
import ExplainModal from './ExplainModal';
import SignInSheet from './SignInSheet';
import { BookmarkIcon, ShareIcon } from './icons';
import { chopColorFor } from '@/lib/chop';
import { shareLink } from '@/lib/share';
import type { FeedItem } from '@/lib/feed';

export default function FeedCard({ item, onBookmarked }: {
  item: FeedItem & { bookmarked?: boolean; bookmarkCount?: number };
  onBookmarked: (id: string) => void;
}) {
  const { t, pair } = useLang();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showOwnExplain, setShowOwnExplain] = useState(false);
  // Open when a bookmark tap came back 401 — the tap is remembered, not lost.
  const [signInOpen, setSignInOpen] = useState(false);
  // Seeded from the server count, then bumped locally on a successful tap —
  // the server isn't re-fetched just to reflect the viewer's own action back.
  const [count, setCount] = useState(item.bookmarkCount ?? 0);

  // Editorial review state — editor-only, on drafts. 'discarded' unmounts the
  // card below; 'published' just drops the bar, leaving the card as every
  // other viewer will now see it. (reviewAct itself is defined AFTER bookmark:
  // signInResume.test.ts pins that the file's first generic failure check
  // comes after bookmark's 401-as-signup branch.)
  const [review, setReview] = useState<'pending' | 'busy' | 'published' | 'discarded'>('pending');
  const [reviewFailed, setReviewFailed] = useState(false);

  // On your own post the bookmark tap isn't a no-op — it explains why (the
  // API would 400 it anyway) rather than sitting dead or erroring.
  const bookmark = async () => {
    if (item.own) { setShowOwnExplain(true); return; }
    // An editorial card has no dishes row — its bookmark keys on the post
    // itself and the API builds the 待評 row from the post's fields.
    if (saving || item.bookmarked || (!item.dish.id && !item.editorial)) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.editorial && !item.dish.id
          ? { persona_post_id: item.id }
          : { dish_id: item.dish.id }),
      });
      // 401 is not a failure, it is a person without an account reaching for
      // the highest-intent action on the public surface (sharing batch item
      // 5). Ask them to sign in and RESUME — this used to land in `failed`
      // and dead-end exactly the visitor a shared link is aimed at.
      if (res.status === 401) { setSignInOpen(true); return; }
      if (!res.ok) { setFailed(true); return; }
      setCount(c => c + 1);
      onBookmarked(item.id);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const reviewAct = async (action: 'publish' | 'discard') => {
    if (review === 'busy') return;
    setReview('busy');
    setReviewFailed(false);
    try {
      const res = await fetch(`/api/persona-posts/${item.id}`, action === 'publish'
        ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) }
        : { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setReview(action === 'publish' ? 'published' : 'discarded');
    } catch {
      setReview('pending');
      setReviewFailed(true);
    }
  };

  // Share this post — the permalink needs no identity fetch the way
  // MyDishes.tsx's own Share does (that one shares the VIEWER's dish and has
  // to look up their username first; here the author's claimed username
  // already rides on the item). OS share sheet first, clipboard second
  // (lib/share.ts) — same pattern, just a known URL going in.
  const shareThisDish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.dish.id || item.author.kind !== 'user') return;
    const url = `${window.location.origin}/${item.author.username}/d/${item.dish.id}`;
    if (await shareLink({ title: t('post.share.title'), url }) === 'copied') alert(t('table.copied'));
  };

  // Chop color has no user_id to key off here (FeedAuthor carries only a
  // username — personas like dishi.Spoon have no real user_id at all), so it
  // seeds off the username instead. Same fallback MyDishes.tsx already uses
  // for a companion chop with no id (chopColorFor(c.user_id ?? c.name)).
  const chopColor = chopColorFor(item.author.username);

  // A discarded draft leaves the screen — that IS the review's answer.
  if (review === 'discarded') return null;

  return (
    // .rated-dish-row's entrance animation permanently leaves a resolved
    // (non-"none") transform behind even after finishing (see MyDishes.tsx's
    // own note on this) — that silently turns the row into a containing
    // block for any position:fixed descendant. FeedCard has none today, but
    // detaching the animation once done keeps this row honest the same way.
    <article className="rated-dish-row" onAnimationEnd={e => { e.currentTarget.style.animation = 'none'; }}>
      {/* The in-feed review bar — the whole reason drafts render HERE instead
          of on an admin page: the editor judges the exact pixels everyone
          else will get. Publish drops the bar; discard removes the card. */}
      {item.editorial?.pending && review !== 'published' && (
        <div className="feed-review-bar">
          <span className="feed-review-badge">{t('feed.review.pending')}</span>
          {reviewFailed && <span className="feed-review-failed">{t('feed.review.failed')}</span>}
          <button type="button" className="feed-review-btn discard"
            disabled={review === 'busy'} onClick={() => reviewAct('discard')}>
            {t('feed.review.discard')}
          </button>
          <button type="button" className="feed-review-btn publish"
            disabled={review === 'busy'} onClick={() => reviewAct('publish')}>
            {t('feed.review.publish')}
          </button>
        </div>
      )}
      <div className="duel-pair resolving">
        <div className="duel-option feed-side feed-post">
          <DuelSide
            dish={{
              id: item.dish.id ?? item.id,
              name: item.dish.name ?? '', name_zh: item.dish.name_zh,
              photo_url: item.dish.photo_url, restaurant: item.dish.restaurant,
            }}
            pair={pair}
            // Persona posts (dishi.Spoon et al) have no real profile to link
            // to, so no permalink to share — same gate as the chop/name link
            // below.
            photoOverlay={item.author.kind === 'user' && (
              <button type="button" className="feed-photo-share-btn" onClick={shareThisDish}
                aria-label={t('post.share.cta')} title={t('post.share.cta')}>
                <ShareIcon size={20} />
              </button>
            )}
            afterPhoto={
              <>
                {/* CC BY / BY-SA make attribution a license term, not décor —
                    the credit rides directly under the photo it licenses. */}
                {item.editorial && (
                  <p className="feed-photo-credit">{item.editorial.credit}</p>
                )}
                <div className="feed-author-row">
                  {/* A persona (dishi.Spoon et al) has no real profile to link
                      to — only a claimed user's chop/name goes to their
                      dishi.me/[username] dossier (own decision). */}
                  {item.author.kind === 'user' ? (
                    <Link href={`/${item.author.username}`} className="feed-author-id">
                      <Chop name={item.author.username} color={chopColor} size={28} />
                      <span className="feed-author-name">dishi.{item.author.username}</span>
                    </Link>
                  ) : (
                    <div className="feed-author-id">
                      <Chop name={item.author.username} color={chopColor} size={28} />
                      <span className="feed-author-name">dishi.{item.author.username}</span>
                    </div>
                  )}
                  {/* The verdict is never optional dressing on a user's post: posts
                      may be negative, and a card that showed only the dish would
                      read as a recommendation of it. */}
                  {item.verdict && <span className="feed-author-verdict">{t(item.verdict)}</span>}
                </div>
                {/* The poster's own comment, left-aligned with their name (not the
                    chop) — plain text, no box (owner call 2026-07-28: the box read
                    as too heavy). The hairline only exists to close THIS off from
                    the dish name below; skipping both together when there's no
                    comment keeps an empty post going straight from name to dish. */}
                {item.reason && (
                  <>
                    <p className="feed-comment">{item.reason}</p>
                    <hr className="feed-comment-divider" />
                  </>
                )}
              </>
            }
            afterName={
              <div className="feed-chips">
                <DishInfoDisplay info={{ diet: item.dish.diet, heaviness: item.dish.heaviness, ingredients: item.dish.ingredients }} />
              </div>
            }
            // Shown to EVERY viewer, owner included — the count is social proof
            // ("N people want this"), not a personal affordance, so hiding it on
            // your own post would hide real information. Tapping it on your own
            // dish stays enabled but opens the ExplainModal (bookmark() checks
            // item.own first) instead of calling an API that would 400 it.
            titleAside={
              <div className="feed-bookmark-wrap">
                <button
                  type="button"
                  className={`feed-bookmark-btn${item.own ? ' own' : ''}`}
                  disabled={saving || !!item.bookmarked}
                  onClick={(e) => { e.stopPropagation(); bookmark(); }}
                  aria-label={t(item.bookmarked ? 'feed.bookmarked' : 'feed.bookmark')}
                >
                  <span className="feed-bookmark-count">{count}</span>
                  <BookmarkIcon size={20} filled={!!item.bookmarked} />
                </button>
                {failed && <span className="feed-bookmark-failed">{t('feed.bookmark.failed')}</span>}
              </div>
            }
          />
        </div>
      </div>
      {showOwnExplain && (
        <ExplainModal
          title={t('feed.bookmark.own.title')}
          body={t('feed.bookmark.own.body')}
          onClose={() => setShowOwnExplain(false)}
        />
      )}
      {signInOpen && (
        <SignInSheet
          // Says what THIS tap was for, not "sign in" — the ask has to read as
          // the next step of what they already chose to do.
          reason={t('auth.sheet.bookmark')}
          onSignedIn={() => { setSignInOpen(false); bookmark(); }}
          onClose={() => setSignInOpen(false)}
        />
      )}
    </article>
  );
}
