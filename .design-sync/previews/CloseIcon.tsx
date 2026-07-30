import { CloseIcon } from 'dishi';

// X — cancel / close. Two real homes: a card header's quiet corner dismiss
// (.duel-x, on the 對決 duel/execution-slider card), and the ink-filled
// "not the same dish" answer circle on IdentityConfirmCard.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <CloseIcon size={16} />
      <CloseIcon size={20} />
      <CloseIcon size={26} />
      <CloseIcon size={40} />
    </div>
  );
}

/** The duel card's own header — title centered, close pinned to the right
 *  edge exactly as .duel-head/.duel-x place it. */
export function DuelHeaderClose() {
  return (
    <div style={{ padding: 24 }}>
      <div className="card duel-card" style={{ width: 260, marginBottom: 0 }}>
        <div className="card-body">
          <div className="duel-head">
            <div className="duel-head-center">
              <span className="duel-title">對決</span>
            </div>
            <button className="duel-x" aria-label="取消"><CloseIcon /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** IdentityConfirmCard's "not the same dish" answer — ink-filled circle,
 *  white glyph, the same pair language as its "same" ✓ sibling. */
export function IdentityAnswer() {
  return (
    <div style={{ padding: 24 }}>
      <button className="identity-answer" aria-label="唔係同一味">
        <span className="identity-answer-circle"><CloseIcon size={22} /></span>
      </button>
    </div>
  );
}
