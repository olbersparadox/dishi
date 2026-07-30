import { LockIcon } from 'dishi';

// A padlock. Not currently wired to a screen (MyDishes' locked-dish badge is a
// plain 6px dot, .journal-locked), so these compose it against the one real
// "locked" concept in the product copy: a dish someone else already rated,
// frozen so their record can't be overwritten (home.locked).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <LockIcon size={16} />
      <LockIcon size={20} />
      <LockIcon size={26} />
      <LockIcon size={40} />
    </div>
  );
}

/** A locked-dish status badge, same footprint as MyDishes' other row badges
 *  (.dish-public-badge), labelled with the real "already rated by someone
 *  else, locked to protect their record" copy. */
export function LockedBadge() {
  return (
    <div style={{ padding: 24 }}>
      <span className="dish-public-badge" aria-label="已有其他人評過，已鎖定" title="已有其他人評過，已鎖定">
        <LockIcon size={18} />
      </span>
    </div>
  );
}
