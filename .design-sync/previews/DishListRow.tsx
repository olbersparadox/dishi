import { DishListRow, ChopStampRow } from 'dishi';

// The settled ranked list — always rendered inside .scan-settle (its own
// -15px margin-top tucks it against the table bar/hero above), never a bare
// row: both /scan and /table wrap it exactly this way, so these cells do too.
const PALETTE: Record<string, string> = {
  u1: '#3B82F6', u2: '#A855F7', u3: '#22C55E', u4: '#F59E0B', u5: '#06B6D4',
};
const colorFor = (id: string) => PALETTE[id] ?? '#3B82F6';

/** A picked dish, already enriched: chips render, one chop stamped under the
 *  price. This is the common settled-row shape on both /scan and /table. */
export function Picked() {
  return (
    <div className="scan-settle">
      <DishListRow
        item={{
          key: 'menu-1', name: 'Beef Chow Fun', name_zh: '乾炒牛河', price: '$88',
          cooking_method: 'stir-fried', heaviness: 'medium', diet: ['beef'],
          ingredients: ['noodle', 'bean sprout'], enriched: true,
        }}
        rank={1}
        picked
        onSelect={() => {}}
        stamps={<ChopStampRow itemKey="menu-1" stamps={[{ user_id: 'u1', name: 'Jerry Chu' }]} colorFor={colorFor} />}
      />
    </div>
  );
}

/** Scan's own single earned mark: the 🔥 badge beside the primary name plus
 *  the plain-words reason underneath — /table never sets `fire`, only /scan's
 *  solo ranking does. */
export function SoloFire() {
  return (
    <div className="scan-settle">
      <DishListRow
        item={{
          key: 'menu-2', name: 'Poached Chicken', name_zh: '白切雞', price: '$168',
          cooking_method: 'boiled', heaviness: 'light', diet: ['chicken'],
          ingredients: ['ginger'], enriched: true,
        }}
        rank={1}
        picked={false}
        onSelect={() => {}}
        fire
        reason="你偏好清淡做法，呢間嘅白切雞評分喺同類最高。"
        stamps={<ChopStampRow itemKey="menu-2" stamps={[]} colorFor={colorFor} />}
      />
    </div>
  );
}

/** Table's per-member equivalent of `fire`: one small 🔥 dotted in each
 *  suggested member's own chop color, distinct from the stamps (who has
 *  ACTUALLY picked) sitting under the price. */
export function TableFireFor() {
  return (
    <div className="scan-settle">
      <DishListRow
        item={{
          key: 'menu-3', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷', price: '$128',
          cooking_method: 'fried', heaviness: 'heavy', diet: ['seafood', 'spicy'],
          ingredients: ['squid', 'chili'], enriched: true,
        }}
        rank={2}
        picked
        onSelect={() => {}}
        fireFor={[
          { userId: 'u1', color: '#3B82F6' },
          { userId: 'u3', color: '#22C55E' },
        ]}
        stamps={
          <ChopStampRow
            itemKey="menu-3"
            stamps={[{ user_id: 'u1', name: 'Jerry Chu' }, { user_id: 'u3', name: 'Wing' }]}
            colorFor={colorFor}
          />
        }
      />
    </div>
  );
}

/** 加咗一頁 — a page appended mid-scan tags its rows `isNew`, and Stage-2
 *  enrichment hasn't landed on this one yet (the shimmer placeholder, not the
 *  chip row). */
export function NewUnenriched() {
  return (
    <div className="scan-settle">
      <DishListRow
        item={{
          key: 'menu-4', name: 'Pineapple Bun with Butter', name_zh: '菠蘿油', price: '$28',
          enriched: false, isNew: true,
        }}
        rank={5}
        picked={false}
        onSelect={() => {}}
        stamps={<ChopStampRow itemKey="menu-4" stamps={[]} colorFor={colorFor} />}
      />
    </div>
  );
}
