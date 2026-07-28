'use client';
import { Fragment, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import MyDishes from '@/components/MyDishes';
import FeedList from '@/components/FeedList';
import { useLang } from '@/lib/i18n';

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
    <AuthGate>
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

  const selectTab = (key: 'mine' | 'feed') => {
    setTab(key);
    // replace, not push — clicking between tabs shouldn't pile up back-stack
    // entries; only leaving the page (e.g. to a dossier) does that.
    router.replace(key === 'feed' ? '/?tab=feed' : '/', { scroll: false });
  };

  return (
    <div>
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
      {tab === 'mine' ? <MyDishes t={t} lang={lang} onPublished={() => selectTab('feed')} /> : <FeedList />}
    </div>
  );
}
