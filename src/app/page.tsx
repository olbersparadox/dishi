'use client';
import AuthGate from '@/components/AuthGate';
import MyDishes from '@/components/MyDishes';
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
  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t('home.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>{t('home.journal.blurb')}</p>
      <MyDishes t={t} lang={lang} />
    </div>
  );
}
