import { LanguagePicker } from 'dishi';

// The globe replaces the old 中/EN toggle in the header's right slot
// (Shell.tsx's .topbar-right, alongside the notification bell) — it takes no
// props, so the only thing worth reproducing here is that header position
// rather than a bare floating globe.

/** In its real header slot: wordmark left, globe pinned to the top-right. */
export function InHeader() {
  return (
    <header className="topbar" style={{ maxWidth: 380 }}>
      <div className="wordmark">dish<em>i</em></div>
      <div className="topbar-right">
        <LanguagePicker />
      </div>
    </header>
  );
}
