import { PotIcon } from 'dishi';

// A solid cooking pot, sized to sit alongside text "the way the old ♥ glyph
// did" (its own doc comment). The cooking-style hook it was drawn for
// (DishInfoDisplay's bucketText, e.g. 燜炆入味) currently renders as text
// alone with no icon prefix, so this composes the icon back into that exact
// spot to show the intended pairing.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <PotIcon size={14} />
      <PotIcon size={20} />
      <PotIcon size={26} />
      <PotIcon size={40} />
    </div>
  );
}

/** Beside the cooking-style hook line (.card-meta.dish-hook), the pairing its
 *  own doc comment describes. */
export function CookingHook() {
  return (
    <div style={{ padding: 24 }}>
      <div className="card-meta dish-hook" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PotIcon size={14} />
        <span>燜炆入味</span>
      </div>
    </div>
  );
}
