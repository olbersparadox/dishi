import { ArrowRightIcon } from 'dishi';

// Right arrow — submit/go. Real sizes in use: 20 (OtpForm's send/verify button,
// PublicDossier-adjacent flows), the 20 default (PickedCartBar's pill).

/** The icon alone at the sizes actually used in the app, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <ArrowRightIcon size={16} />
      <ArrowRightIcon size={20} />
      <ArrowRightIcon size={26} />
      <ArrowRightIcon size={40} />
    </div>
  );
}

/** OtpForm's send/verify circle — .join-go, ink-filled once the field has
 *  enough to submit. */
export function JoinButton() {
  return (
    <div style={{ display: 'flex', gap: 8, padding: 24, alignItems: 'center' }}>
      <input className="field" placeholder="you@example.com" readOnly style={{ width: 200 }} />
      <button className="join-go" aria-label="送出">
        <ArrowRightIcon size={20} />
      </button>
    </div>
  );
}

/** PickedCartBar's black pill — the count on the left, running bill hard-right,
 *  arrow closing the row to say "go rate what you picked." */
export function CartBarPill() {
  return (
    <div style={{ padding: 24 }}>
      <div className="cart-bar" style={{ position: 'static' }}>
        <a className="btn primary cart-btn" href="#">
          <span>已揀 6 味</span>
          <span className="cart-bar-end">
            <span className="cart-total">$428</span>
            <ArrowRightIcon />
          </span>
        </a>
      </div>
    </div>
  );
}
