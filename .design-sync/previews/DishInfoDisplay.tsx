import { DishInfoDisplay, DishName } from 'dishi';

// DishInfoDisplay never appears alone — it's the second half of a dish row,
// sitting under the name (see DishInfoDisplay.tsx's own header comment: one
// render shared by the scan card and the rated Taste-tab row, so both cells
// below reproduce the dish-name line above it rather than floating the chips
// bare.

/** The scan card's own shape: rank, name, price, then the cooking hook and
 *  full chip row (diet + ingredients + heaviness) underneath. */
export function WithChips() {
  return (
    <article className="card scan-pickable" style={{ maxWidth: 380 }}>
      <div className="card-body">
        <div className="scan-item">
          <span className="scan-rank">3.</span>
          <div className="scan-item-main">
            <div className="dish-row">
              <div className="card-title">
                <DishName name="Salt and Pepper Squid" name_zh="椒鹽鮮魷" />
              </div>
              <span className="dish-price">$128</span>
            </div>
            <DishInfoDisplay
              info={{
                cooking_method: 'fried',
                heaviness: 'heavy',
                diet: ['seafood', 'spicy'],
                ingredients: ['squid', 'chili', 'garlic'],
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/** `hookOnly`: just the cooking-style line, indented under the name — the
 *  half that renders BEFORE Stage-2 enrichment lands, and the half the scan
 *  card keeps in its own left column while the chips sit further out. */
export function HookOnly() {
  return (
    <article className="card scan-pickable" style={{ maxWidth: 380 }}>
      <div className="card-body">
        <div className="scan-item">
          <span className="scan-rank">1.</span>
          <div className="scan-item-main">
            <div className="dish-row">
              <div className="card-title">
                <DishName name="Beef Chow Fun" name_zh="乾炒牛河" />
              </div>
              <span className="dish-price">$88</span>
            </div>
            <DishInfoDisplay info={{ cooking_method: 'stir-fried' }} hookOnly />
          </div>
        </div>
      </div>
    </article>
  );
}

/** `compact` + `hideHook`: the Taste-growth review row's shape — the
 *  restaurant already states the cooking style in words, so the hook line
 *  would just repeat it; only the diet/ingredient/heaviness chips show. */
export function CompactNoHook() {
  return (
    <div style={{ maxWidth: 340 }}>
      <div className="card-title">
        <DishName name="Poached Chicken" name_zh="白切雞" />
      </div>
      <DishInfoDisplay
        info={{
          heaviness: 'light',
          diet: ['chicken'],
          ingredients: ['ginger', 'scallion'],
        }}
        compact
        hideHook
      />
    </div>
  );
}
