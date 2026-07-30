import { SealRevealBadge, RatedDishRow, DishName } from 'dishi';

// The broken 封印: the badge only ever renders a verdict the server already
// decided — the face IS the result (😁 hit / 😉 near / 😅 miss), the words
// live behind a tap. The tap-open balloon is internal state and can't render
// statically; its composition is covered by the ExplainModal previews.
//
// These are decided SealResult rows exactly as /api returns them after a
// reveal — never a pending prediction (pending seals are the 印 SealStamp's
// territory, and nothing client-side can surface one).

const HIT = {
  id: 's1', predicted_direction: 'love', actual_direction: 'love', outcome: 'hit' as const,
  reason_zh: '你一向偏好鑊氣足、乾身唔油嘅炒粉麵，呢碟乾炒牛河應該啱你。',
  reason_en: 'You consistently favour wok hei noodles that are dry-fried, not oily, so this beef chow fun should land.',
  streak: 3, taught: [{ dim: 'umami', dir: 1 }, { dim: 'crispy', dir: 1 }],
  dish: { id: 'd1', name: 'Beef Chow Fun', name_zh: '乾炒牛河' },
};
const NEAR = {
  id: 's2', predicted_direction: 'love', actual_direction: 'like', outcome: 'near' as const,
  reason_zh: '你鍾意芒果甜品，不過椰漿重手嘅你通常扣分。',
  reason_en: 'You love mango desserts, though heavy coconut milk usually costs a point.',
  taught: [{ dim: 'sweet', dir: 1 }],
  dish: { id: 'd2', name: 'Mango Pomelo Sago', name_zh: '楊枝甘露' },
};
const MISS = {
  id: 's3', predicted_direction: 'like', actual_direction: 'dislike', outcome: 'miss' as const,
  reason_zh: '牛油香濃嘅包點你通常照單全收。',
  reason_en: 'Buttery baked goods usually go straight in.',
  taught: [{ dim: 'rich', dir: -1 }],
  dish: { id: 'd3', name: 'Pineapple Bun with Butter', name_zh: '菠蘿油' },
};

/** The growth screen's review rows: each verdict stamped beside the black
 *  name TILE it belongs to (.learn-head), stretched to the tile's height so
 *  seal and name read as one pair. Only the session's newest verdict keeps
 *  the streak (showStreak) — the others explicitly drop it. */
export function GrowthReviewRows() {
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 380 }}>
      <div className="learn-head">
        <button type="button" className="refine-pill refine-name">
          <DishName name="Beef Chow Fun" name_zh="乾炒牛河" size="md" />
        </button>
        <SealRevealBadge seal={HIT} />
      </div>
      <div className="learn-head">
        <button type="button" className="refine-pill refine-name">
          <DishName name="Mango Pomelo Sago" name_zh="楊枝甘露" size="md" />
        </button>
        <SealRevealBadge seal={NEAR} showStreak={false} />
      </div>
      <div className="learn-head">
        <button type="button" className="refine-pill refine-name">
          <DishName name="Pineapple Bun with Butter" name_zh="菠蘿油" size="md" />
        </button>
        <SealRevealBadge seal={MISS} showStreak={false} />
      </div>
    </div>
  );
}

/** 已評嘅菜 — the inline variant rides the dish NAME (RatedDishRow mounts it
 *  in DishName's suffix slot, the same slot a pending 印 uses), so one dish
 *  reads as one object through the whole arc: sealed, then opened. */
export function InlineOnRatedRows() {
  return (
    <div style={{ maxWidth: 380 }}>
      <RatedDishRow id="d1" name="Beef Chow Fun" name_zh="乾炒牛河" restaurant="榮記茶餐廳" verdict="超好味" seal={HIT} />
      <RatedDishRow id="d2" name="Mango Pomelo Sago" name_zh="楊枝甘露" restaurant="滿記甜品" verdict="幾好食" seal={NEAR} />
      <RatedDishRow id="d3" name="Pineapple Bun with Butter" name_zh="菠蘿油" restaurant="金華冰廳" verdict="唔啱我" seal={MISS} />
    </div>
  );
}
