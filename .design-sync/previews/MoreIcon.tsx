import { MoreIcon } from 'dishi';

// Vertical three dots — "more actions" on a rated-dish row (MyDishes), opening
// edit/delete (and publish/share once rated). Sits in a 38px .icon-btn.lg
// circle, pinned to the row's top-right.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <MoreIcon size={16} />
      <MoreIcon size={20} />
      <MoreIcon size={26} />
      <MoreIcon size={40} />
    </div>
  );
}

/** MyDishes row's kebab — .icon-btn.lg, closed state. */
export function RowKebab() {
  return (
    <div style={{ padding: 24 }}>
      <button className="icon-btn lg" aria-label="更多" title="更多">
        <MoreIcon size={20} />
      </button>
    </div>
  );
}

/** The same kebab, open — .row-menu dropdown with the real edit/delete rows
 *  it actually opens. */
export function RowKebabOpen() {
  return (
    <div style={{ padding: 24, paddingLeft: 140 }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button className="icon-btn lg" aria-label="更多" title="更多">
          <MoreIcon size={20} />
        </button>
        <div className="row-menu" role="menu" style={{ position: 'absolute' }}>
          <button role="menuitem">編輯</button>
          <button role="menuitem">刪除</button>
        </div>
      </div>
    </div>
  );
}
