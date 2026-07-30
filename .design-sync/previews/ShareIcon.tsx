import { ShareIcon } from 'dishi';

// Outward arrow from a tray — send this dish to someone. Two real homes: a
// row-menu text item ("分享", MyDishes), and a white icon-only button
// floating over a feed card's photo (.feed-photo-share-btn, dark scrim).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <ShareIcon size={16} />
      <ShareIcon size={20} />
      <ShareIcon size={26} />
      <ShareIcon size={40} />
    </div>
  );
}

/** MyDishes' row-menu item — icon + label, exactly as it renders there. */
export function RowMenuItem() {
  return (
    <div style={{ padding: 24 }}>
      <div className="row-menu" role="menu" style={{ position: 'static', display: 'inline-block' }}>
        <button role="menuitem"><ShareIcon size={16} /> 分享</button>
      </div>
    </div>
  );
}

/** FeedCard's white icon-only share button floating over a dish photo. */
export function OnPhoto() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ position: 'relative', width: 220, height: 140, borderRadius: 14, background: 'var(--clay)' }}>
        <button type="button" className="feed-photo-share-btn" aria-label="分享" title="分享">
          <ShareIcon size={20} />
        </button>
      </div>
    </div>
  );
}
