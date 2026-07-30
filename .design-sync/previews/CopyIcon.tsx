import { CopyIcon } from 'dishi';

// Two overlapping sheets — copy to clipboard. Lives on the AI-export card's
// big ink circle (.ok-circle, TasteFormCard's copyDoc button), swapping to a
// tick once the copy lands.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <CopyIcon size={16} />
      <CopyIcon size={20} />
      <CopyIcon size={26} />
      <CopyIcon size={40} />
    </div>
  );
}

/** The AI-export card's own ink circle, idle (not yet copied). */
export function ExportCopy() {
  return (
    <div style={{ padding: 24 }}>
      <div className="install-copy-wrap">
        <button className="ok-circle" aria-label="複製">
          <CopyIcon size={24} />
        </button>
        <p className="card-meta">複製你的口味檔案</p>
      </div>
    </div>
  );
}
