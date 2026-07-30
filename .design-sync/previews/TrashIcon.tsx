import { TrashIcon } from 'dishi';

// Trash — delete. Two real homes: the paired rate/delete actions on a
// to-be-rated pick (profile page's .icon-btn.lg.delete), and a text row in
// MyDishes' row-menu ("刪除").

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <TrashIcon size={16} />
      <TrashIcon size={20} />
      <TrashIcon size={26} />
      <TrashIcon size={40} />
    </div>
  );
}

/** Profile page's paired rate/delete actions on a pending pick. */
export function PickActions() {
  return (
    <div style={{ display: 'flex', gap: 8, padding: 24 }}>
      <button className="icon-btn lg delete" aria-label="刪除" title="刪除">
        <TrashIcon size={20} />
      </button>
    </div>
  );
}

/** MyDishes' row-menu item — icon + label, exactly as it renders there. */
export function RowMenuItem() {
  return (
    <div style={{ padding: 24 }}>
      <div className="row-menu" role="menu" style={{ position: 'static', display: 'inline-block' }}>
        <button role="menuitem"><TrashIcon size={16} /> 刪除</button>
      </div>
    </div>
  );
}
