import { SealStamp, DishName, CloseIcon } from 'dishi';

// The 印 stamp marks a sealed prediction wherever the dish it's about appears.
// It is one of exactly three vermillion surfaces in the app, and its size is
// inherited from context — so each cell reproduces a real host: the 待評 pick
// row (18px inline, riding the name) and the 對決 header (scaled to 24px by
// .duel-head). The tap-open explainer is internal state; its card is covered
// by the ExplainModal previews.

/** A 待評 pick with a sealed prediction: the stamp rides the dish name in
 *  DishName's suffix slot (the same slot the broken seal takes over after
 *  rating), with the restaurant meta beneath — the profile page's queue row. */
export function OnPickCardName() {
  return (
    <div style={{ maxWidth: 380 }}>
      <div className="pick-card-info">
        <div className="pick-card-name">
          <DishName id="p1" name="Salt and Pepper Squid" name_zh="椒鹽鮮魷" suffix={<SealStamp />} />
        </div>
        <div className="pick-card-meta">陳記海鮮</div>
      </div>
    </div>
  );
}

/** The 對決 header before the pick: title + 印 centred as a unit (the seal
 *  says "a prediction is already locked in"), the ✕ pulled out of flow so it
 *  can't skew that centring. */
export function InDuelHeader() {
  return (
    <div className="card duel-card" style={{ maxWidth: 420 }}>
      <div className="card-body">
        <div className="duel-head">
          <div className="duel-head-center">
            <span className="duel-title">如果要你揀</span>
            <SealStamp />
          </div>
          <button type="button" className="duel-x" aria-label="取消"><CloseIcon /></button>
        </div>
      </div>
    </div>
  );
}
