import { RateIcon } from 'dishi';

// Rate — a vertical fader (up = loved, down = not for me), matching the flick
// gesture itself. Lives on profile page's pending-pick row, paired with delete
// (.icon-btn.lg.rate / .icon-btn.lg.delete).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <RateIcon size={16} />
      <RateIcon size={20} />
      <RateIcon size={26} />
      <RateIcon size={40} />
    </div>
  );
}

/** Profile page's pending-pick row — rate now, next to delete. */
export function PickActions() {
  return (
    <div style={{ display: 'flex', gap: 8, padding: 24 }}>
      <button className="icon-btn lg rate" aria-label="即刻評" title="即刻評">
        <RateIcon size={20} />
      </button>
    </div>
  );
}
