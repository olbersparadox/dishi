'use client';
import { useState } from 'react';
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
  const [tab, setTab] = useState<'mine' | 'feed'>('mine');

  return (
    <div>
      {/* The two tabs ARE the heading — same display type, the inactive one
          dimmed. No new tab chrome: the page keeps one title-sized line. */}
      <h1 style={{ marginBottom: 17, display: 'flex', gap: 16 }}>
        {(['mine', 'feed'] as const).map(key => (
          <span
            key={key}
            role="tab"
            aria-selected={tab === key}
            tabIndex={0}
            onClick={() => setTab(key)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setTab(key); }}
            style={{ cursor: 'pointer', color: tab === key ? 'var(--ink)' : 'var(--ink-soft)' }}
          >
            {t(`home.tab.${key}`)}
          </span>
        ))}
      </h1>
      {tab === 'mine' ? <MyDishes t={t} lang={lang} /> : <FeedList />}
    </div>
  );
}
