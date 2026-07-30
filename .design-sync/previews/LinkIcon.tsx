import { LinkIcon } from 'dishi';

// Chain link — a dish published LINK-ONLY (dish_posts.visibility='link').
// Deliberately not the globe: "anyone can find this" and "only people holding
// the link can" are different promises. Lives on MyDishes' status badge,
// same footprint as the globe badge it stands in for.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <LinkIcon size={16} />
      <LinkIcon size={20} />
      <LinkIcon size={26} />
      <LinkIcon size={40} />
    </div>
  );
}

/** MyDishes' quiet "link-only" status badge next to the kebab. */
export function LinkOnlyBadge() {
  return (
    <div style={{ padding: 24 }}>
      <span className="dish-public-badge" aria-label="只限連結" title="只限連結">
        <LinkIcon size={16} />
      </span>
    </div>
  );
}
