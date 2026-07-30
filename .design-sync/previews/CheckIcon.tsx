import { CheckIcon } from 'dishi';

// Tick — confirm / done / copied. The single shared "acknowledge" glyph:
// every duel/explain-modal card closes on it (.ok-circle), and it is also the
// "same dish" answer on IdentityConfirmCard and the export card's post-copy
// confirmation.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <CheckIcon size={16} />
      <CheckIcon size={20} />
      <CheckIcon size={26} />
      <CheckIcon size={40} />
    </div>
  );
}

/** The shared "done" ink circle every duel/explain card closes on. */
export function OkCircle() {
  return (
    <div style={{ padding: 24 }}>
      <div className="ok-circle-wrap" style={{ margin: 0 }}>
        <button className="ok-circle" aria-label="知道了">
          <CheckIcon size={26} />
        </button>
      </div>
    </div>
  );
}

/** IdentityConfirmCard's "same dish" answer — ink-filled circle, white glyph. */
export function IdentityAnswer() {
  return (
    <div style={{ padding: 24 }}>
      <button className="identity-answer" aria-label="係同一味">
        <span className="identity-answer-circle"><CheckIcon size={22} /></span>
      </button>
    </div>
  );
}
