import { EditIcon } from 'dishi';

// Pencil — edit. Two real homes: a text row inside MyDishes' row-menu
// ("編輯"), and a quiet corner glyph (.taste-name-edit) pinned to the Taste
// card for renaming your dishi.username once you've claimed one.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <EditIcon size={16} />
      <EditIcon size={20} />
      <EditIcon size={26} />
      <EditIcon size={40} />
    </div>
  );
}

/** MyDishes' row-menu item — icon + label, exactly as it renders there. */
export function RowMenuItem() {
  return (
    <div style={{ padding: 24 }}>
      <div className="row-menu" role="menu" style={{ position: 'static', display: 'inline-block' }}>
        <button role="menuitem"><EditIcon size={16} /> 編輯</button>
      </div>
    </div>
  );
}

/** The corner pencil on the Taste card (.taste-name-edit), full opacity here
 *  for legibility — the app dims it to 0.55 until hover. */
export function CardCorner() {
  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ position: 'relative', width: 220, height: 120, marginBottom: 0 }}>
        <button type="button" className="taste-name-edit" style={{ position: 'absolute', opacity: 1 }} aria-label="改名">
          <EditIcon size={19} />
        </button>
        <div className="card-body">
          <span className="username-identity">dishi.jerrychu</span>
        </div>
      </div>
    </div>
  );
}
