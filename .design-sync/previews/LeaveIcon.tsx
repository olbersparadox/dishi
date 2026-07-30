import { LeaveIcon } from 'dishi';

// Door + outward arrow — leave a table session. Icon-only, right-aligned
// against the table results title (table/page.tsx's .icon-btn).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <LeaveIcon size={16} />
      <LeaveIcon size={20} />
      <LeaveIcon size={26} />
      <LeaveIcon size={40} />
    </div>
  );
}

/** The table page's own header row — title left, leave button right, exactly
 *  as table/page.tsx composes it. */
export function TableHeader() {
  return (
    <div style={{ padding: 24, width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h1 style={{ margin: 0 }}>掃描結果</h1>
        <button className="icon-btn" aria-label="離開" title="離開">
          <LeaveIcon size={22} />
        </button>
      </div>
    </div>
  );
}
