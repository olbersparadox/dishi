import { SpeechIcon } from 'dishi';

// Speech bubble — Dishi "talking": the why-recommended reason line under a
// scanned dish (DishListRow's .scan-reason-icon). NOTE: the app's own CSS
// currently colors that icon with --seal (vermillion), but vermillion is
// strictly reserved for the seal stamp / export CTA / dirty-save button — so
// this preview renders the icon in ink instead of copying that pre-existing
// deviation (flagged in learnings for the orchestrator).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <SpeechIcon size={16} />
      <SpeechIcon size={20} />
      <SpeechIcon size={26} />
      <SpeechIcon size={40} />
    </div>
  );
}

/** The why-recommended reason line under a scanned dish, in ink. */
export function ScanReason() {
  return (
    <div style={{ padding: 24, maxWidth: 320 }}>
      <p className="scan-reason" style={{ color: 'var(--ink)' }}>
        <span className="scan-reason-icon" style={{ color: 'var(--ink)' }}><SpeechIcon size={18} /></span>
        <span>你上次話鍾意清淡啲嘅蒸魚，呢味都係走呢個方向</span>
      </p>
    </div>
  );
}
