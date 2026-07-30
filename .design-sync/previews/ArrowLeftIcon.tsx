import { ArrowLeftIcon } from 'dishi';

// Left arrow — back navigation. Only one real usage: PublicDossier's
// return-to-feed, set at 30px to literally match the page h1's own type size
// (--fs-title-b) since it is the page's only chrome, not a small icon-btn.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <ArrowLeftIcon size={16} />
      <ArrowLeftIcon size={20} />
      <ArrowLeftIcon size={26} />
      <ArrowLeftIcon size={40} />
    </div>
  );
}

/** PublicDossier's own back button — .dossier-back, 30px, same font/size as
 *  the page title, always returning to 大家食 (never router.back()). */
export function DossierBack() {
  return (
    <div style={{ padding: 24 }}>
      <button type="button" className="dossier-back" aria-label="返回">
        <ArrowLeftIcon size={30} />
      </button>
    </div>
  );
}
