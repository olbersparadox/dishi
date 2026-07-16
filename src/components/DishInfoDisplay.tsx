'use client';
import { useLang } from '@/lib/i18n';
import { cookingBucket, type CookingMethod, type Heaviness } from '@/lib/menuScan';

// The dish info format, in ONE place. This used to live only inside scan/page.tsx,
// so a dish read off a menu showed cooking style + diet + heaviness, while the very
// same dish — once rated and shown on the Taste tab — showed none of it. Same dish,
// two different amounts of information, purely as an accident of which screen you
// met it on. Both now render through this.

const DIET_ICON: Record<string, string> = {
  veg: '\u{1F331}', pork: '\u{1F416}', beef: '\u{1F404}', seafood: '\u{1F41F}',
  shellfish: '\u{1F990}', peanut: '\u{1F95C}', spicy: '\u{1F336}\uFE0F',
};

// Filled/hollow dots for the heaviness chip: 清淡●○○ / 適中●●○ / 濃郁●●●
// — a quick-scan visual alongside the text label, not a replacement for it.
const HEAVINESS_DOTS: Record<Heaviness, string> = {
  light: '\u25cf\u25cb\u25cb', medium: '\u25cf\u25cf\u25cb', heavy: '\u25cf\u25cf\u25cf',
};

export type DishInfo = {
  cooking_method?: CookingMethod | string | null;
  heaviness?: Heaviness | string | null;
  diet?: string[] | null;
};

export default function DishInfoDisplay({ info, compact = false, hideHook = false }: { info: DishInfo; compact?: boolean; hideHook?: boolean }) {
  const { t } = useLang();

  // null for 'other'/unknown — nothing honest to show, so nothing is shown. A
  // fabricated cooking category would be worse than an absent one.
  const bucket = cookingBucket(info.cooking_method as CookingMethod | null | undefined);
  const bucketText = bucket ? t(`scan.bucket.${bucket}`) : null;
  // hideHook: the caller already shows the cooking style elsewhere (e.g. the
  // journal meta line), so rendering it here too would duplicate it.
  const showHook = !!bucketText && !hideHook;
  const diet = info.diet ?? [];
  const hasChips = diet.length > 0 || !!info.heaviness;

  if (!showHook && !hasChips) return null;

  return (
    <>
      {showHook && <div className="card-meta dish-hook">{bucketText}</div>}
      {hasChips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: compact ? 4 : 5 }}>
          {diet.map(d => (
            <span key={d} className="chip scan-chip">
              <span className="scan-chip-icon">{DIET_ICON[d] ?? ''}</span>
              <span className="scan-chip-label">{t(`scan.diet.${d}`)}</span>
            </span>
          ))}
          {info.heaviness && (
            <span className="chip scan-chip">
              <span className="scan-chip-label">
                {t(`scan.heaviness.${info.heaviness}`)}
                {' '}
                <span className="heaviness-dots" aria-hidden>
                  {HEAVINESS_DOTS[info.heaviness as Heaviness]}
                </span>
              </span>
            </span>
          )}
        </div>
      )}
    </>
  );
}
