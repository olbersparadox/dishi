'use client';
import { Fragment, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import MyDishes, { JournalSkeleton } from '@/components/MyDishes';
import FeedList from '@/components/FeedList';
import DailyInteractions from '@/components/DailyInteractions';
import { useLang } from '@/lib/i18n';

// Swipe between 食自己/大家食 (trial, owner call 2026-08-05 — nice-to-have, easy
// to revert as a single commit if it doesn't feel right on a real device).
// Two deliberate guards so this never fights something more important:
//  - EDGE_GUARD: a swipe starting near the screen edge is left alone entirely,
//    because that's also the gesture iOS/Android/desktop browsers use for
//    page-history back/forward — stealing it there would break navigation,
//    not just the tab switch.
//  - SWIPE_RATIO: horizontal movement must dominate vertical by this much, so
//    scrolling the (vertical) journal list never gets misread as a tab swipe.
// Decided at touchend only, and touchmove is never listened to or
// preventDefault'd — normal scrolling is untouched either way.
const EDGE_GUARD = 24;
const SWIPE_THRESHOLD = 60;
const SWIPE_RATIO = 2;

/** AuthGate's fallback while the session check is in flight — the SAME
 * skeleton rows MyDishes shows a moment later for its own data fetch (not a
 * second, different-looking placeholder), under a shape-only stand-in for
 * the tab heading (no translated text yet this early — a skeleton represents
 * shape, not copy). */
function JournalGateSkeleton() {
  return (
    <div aria-hidden>
      <div style={{ marginBottom: 17, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="skel-box" style={{ width: 52, height: 28, borderRadius: 6 }} />
        <span aria-hidden className="home-tab-divider" />
        <span className="skel-box" style={{ width: 68, height: 28, borderRadius: 6 }} />
      </div>
      <JournalSkeleton />
    </div>
  );
}

/**
 * 食記 — the food journal. Replaces the old recommendation feed (為你推介),
 * which the strategic review flagged as a liability at current density: a
 * ranked list competing for attention with the taste-form/scan/rate loop,
 * without enough data yet to feel genuinely personalized for most users.
 *
 * The rated-dish list moved here from the Taste tab (which now holds only
 * the taste-form/stats/export — see profile/page.tsx) so this becomes the
 * app's "what have I actually eaten" surface: a diary, not a dashboard.
 *
 * SECOND TAB (2026-07-28): 大家 — one card type, author always a dishi.X
 * (lib/feed.ts). It is not the old 為你推介 returning: that ranked strangers'
 * dishes nobody had chosen to share, while this ranks things people opted in
 * to publish, and it refuses to rank at all below the honesty bar. Placement
 * here (never under menu scan) is settled — a person holding a menu is in a
 * moment of intent, and browsing must not interrupt it.
 *
 * The old Feed component (recommendation ranking, buddy's-pick card, the
 * "from others" browse list, heart-marking) is intentionally not kept
 * around as dead code — /api/recommendations and /api/helpful stay
 * untouched server-side in case this direction is revisited, but nothing
 * in the UI references them anymore.
 */
export default function Home() {
  return (
    <AuthGate fallback={<JournalGateSkeleton />}>
      <Journal />
    </AuthGate>
  );
}

function Journal() {
  const { t, lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The tab lives in the URL too (not just local state), so a visit to a
  // feed author's dishi.me/[username] dossier and back RESTORES 大家食
  // instead of resetting to the default Private tab — before this, switching
  // tabs never touched the URL, so there was no history entry to return to
  // and router.back() just landed on the bare "/" default.
  const [tab, setTab] = useState<'mine' | 'feed'>(searchParams.get('tab') === 'feed' ? 'feed' : 'mine');
  // Once 大家食 has been visited, FeedList stays MOUNTED (hidden via CSS, not
  // unmounted) so its already-fetched items survive further tab switches —
  // before this, the mine/feed ternary below tore FeedList down on every
  // switch away, so every return to 大家食 refetched from scratch. Bumping
  // feedRefreshKey is the one deliberate exception: right after publishing,
  // the cached list is known-stale (it can't contain the post that doesn't
  // exist yet), so that path forces one fresh fetch.
  const [feedVisited, setFeedVisited] = useState(tab === 'feed');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const selectTab = (key: 'mine' | 'feed') => {
    setTab(key);
    if (key === 'feed') setFeedVisited(true);
    // replace, not push — clicking between tabs shouldn't pile up back-stack
    // entries; only leaving the page (e.g. to a dossier) does that.
    router.replace(key === 'feed' ? '/?tab=feed' : '/', { scroll: false });
  };
  const onPublished = () => {
    setFeedRefreshKey(k => k + 1);
    selectTab('feed');
  };

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    const nearEdge = p.clientX < EDGE_GUARD || p.clientX > window.innerWidth - EDGE_GUARD;
    touchStart.current = nearEdge ? null : { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    selectTab(dx < 0 ? 'feed' : 'mine');
  };

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* The two tabs ARE the heading — same display type, the inactive one
          dimmed. No new tab chrome: the page keeps one title-sized line. A
          hairline divider separates them; whichever tab is INACTIVE reads
          --ink-faint — symmetric on purpose (owner call 2026-07-28): 食自己
          dimming to --ink-faint when 大家食 is picked is the same lightness
          大家食 itself gets when 食自己 is picked, not a permanently-quieter
          secondary tab. */}
      <h1 style={{ marginBottom: 17, display: 'flex', alignItems: 'center', gap: 16 }}>
        {(['mine', 'feed'] as const).map((key, i) => (
          <Fragment key={key}>
            {i === 1 && <span aria-hidden className="home-tab-divider" />}
            <span
              role="tab"
              aria-selected={tab === key}
              tabIndex={0}
              onClick={() => selectTab(key)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectTab(key); }}
              style={{ cursor: 'pointer', color: tab === key ? 'var(--ink)' : 'var(--ink-faint)' }}
            >
              {t(`home.tab.${key}`)}
            </span>
          </Fragment>
        ))}
      </h1>
      {/* 今日 interaction cards — only on the private journal tab: 大家食 is a
          browsing surface, and a calibration ask interrupting browse would be
          the old feed's mistake again. */}
      {tab === 'mine' && <DailyInteractions />}
      {tab === 'mine' && <MyDishes t={t} lang={lang} onPublished={onPublished} />}
      {feedVisited && (
        <div style={{ display: tab === 'feed' ? 'block' : 'none' }}>
          <FeedList refreshKey={feedRefreshKey} />
        </div>
      )}
    </div>
  );
}
