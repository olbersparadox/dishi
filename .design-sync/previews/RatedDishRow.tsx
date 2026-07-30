import { RatedDishRow } from 'dishi';

// 已評嘅菜: the flat, no-photo reference list under the Taste-tab's AI export
// card. Rows stack directly (the hairline divider is each row's own
// border-bottom), so every cell here renders a short list rather than one
// row in isolation.

/** No sealed prediction on either row — the ordinary case for most rated
 *  dishes. */
export function Plain() {
  return (
    <div style={{ maxWidth: 380 }}>
      <RatedDishRow id="d1" name="Beef Chow Fun" name_zh="乾炒牛河" restaurant="太興" verdict="一掃而空" />
      <RatedDishRow id="d2" name="Mango Pomelo Sago" name_zh="楊枝甘露" restaurant="許留山" verdict="幾好食" />
    </div>
  );
}

/** The engine called these dishes in advance — the broken seal rides the
 *  name itself, one 'hit' and one 'miss' face, no streak restated on an old
 *  row (RatedDishRow always passes showStreak={false}). */
export function WithSeal() {
  return (
    <div style={{ maxWidth: 380 }}>
      <RatedDishRow
        id="d3" name="Poached Chicken" name_zh="白切雞" restaurant="太平館"
        verdict="超好味"
        seal={{ predicted_direction: 'like', actual_direction: 'like', outcome: 'hit' }}
      />
      <RatedDishRow
        id="d4" name="Salt and Pepper Squid" name_zh="椒鹽鮮魷" restaurant="海皇粥店"
        verdict="唔啱我"
        seal={{ predicted_direction: 'like', actual_direction: 'dislike', outcome: 'miss' }}
      />
    </div>
  );
}

/** Home cooking carries no restaurant — the meta line is simply absent,
 *  never a placeholder like "住家菜" typed into that slot. */
export function HomeCooking() {
  return (
    <div style={{ maxWidth: 380 }}>
      <RatedDishRow id="d5" name="Steamed Egg with Minced Pork" name_zh="肉碎蒸蛋" restaurant={null} verdict="幾好食" />
    </div>
  );
}
