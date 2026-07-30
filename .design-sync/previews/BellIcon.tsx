import { BellIcon } from 'dishi';

// Bell — the header's permanent notification affordance (a taste duel or
// comparison is waiting). Lives in the topbar as .notif-bell; a small red dot
// (.notif-dot, the app's own pre-existing --seal usage on a status dot, not
// the glyph itself) marks unseen items.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <BellIcon size={16} />
      <BellIcon size={20} />
      <BellIcon size={26} />
      <BellIcon size={40} />
    </div>
  );
}

/** The header bell, with and without an unseen notification. */
export function HeaderBell() {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, alignItems: 'center' }}>
      <button className="notif-bell" aria-label="通知">
        <BellIcon size={20} />
      </button>
      <button className="notif-bell" aria-label="通知">
        <BellIcon size={20} />
        <span className="notif-dot" aria-hidden />
      </button>
    </div>
  );
}
