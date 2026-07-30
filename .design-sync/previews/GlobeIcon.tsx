import { GlobeIcon, GlobeOffIcon } from 'dishi';

// Globe — a dish published to 大家食 (public). Three real homes: a quiet
// status badge on a MyDishes row (.dish-public-badge, non-interactive), the
// row-menu's "公開" action, and PostSheet's own publish button
// (.icon-btn.save, paired with GlobeOffIcon's unpublish to its left).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <GlobeIcon size={16} />
      <GlobeIcon size={20} />
      <GlobeIcon size={26} />
      <GlobeIcon size={40} />
    </div>
  );
}

/** MyDishes' quiet "this is public" status badge next to the kebab. */
export function PublicBadge() {
  return (
    <div style={{ padding: 24 }}>
      <span className="dish-public-badge" aria-label="已公開" title="已公開">
        <GlobeIcon size={16} />
      </span>
    </div>
  );
}

/** PostSheet's real footer pair — unpublish (GlobeOffIcon, left) and
 *  publish/update (GlobeIcon, right), the exact icon-btn.cancel/.save pair
 *  every dish name-edit site shares. */
export function PublishFooter() {
  return (
    <div style={{ padding: 24, display: 'flex', gap: 8 }}>
      <button type="button" className="icon-btn cancel" aria-label="收回公開">
        <GlobeOffIcon size={16} />
      </button>
      <button type="button" className="icon-btn save" aria-label="公開">
        <GlobeIcon size={16} />
      </button>
    </div>
  );
}
