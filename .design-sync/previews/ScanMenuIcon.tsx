import { ScanMenuIcon } from 'dishi';

// A menu page under a magnifying glass — scan a menu. The one place it lives:
// the tab bar's raised center button (.tabbar-scan), Dishi's core loop, at 26px.

/** The icon alone at a spread of sizes, ink on paper. 26 is the real tab-bar
 *  size; the others show how it holds up smaller/larger. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <ScanMenuIcon size={18} />
      <ScanMenuIcon size={22} />
      <ScanMenuIcon size={26} />
      <ScanMenuIcon size={40} />
    </div>
  );
}

/** The raised center tab exactly as Shell renders it — ink circle, white
 *  border, glaze icon, lifted above the bar. */
export function TabBar() {
  return (
    <div style={{ padding: 24 }}>
      <nav className="tabbar" style={{ position: 'static', background: 'var(--paper-inset)', maxWidth: 360, borderRadius: 20 }}>
        <a className="tabbar-side" href="#">食記</a>
        <a className="tabbar-scan" aria-label="掃描">
          <ScanMenuIcon size={26} />
        </a>
        <a className="tabbar-side active" href="#">味 AI</a>
      </nav>
    </div>
  );
}
