import { ChopStampRow } from 'dishi';

// The row is right-aligned under a dish's price in the real layout, so each cell
// composes it the way the table and scan screens do rather than floating it bare.
const PALETTE: Record<string, string> = {
  u1: '#3B82F6', u2: '#A855F7', u3: '#22C55E',
  u4: '#F59E0B', u5: '#06B6D4', u6: '#EC4899',
  u7: '#3B82F6', u8: '#A855F7',
};
const colorFor = (id: string) => PALETTE[id] ?? '#3B82F6';

// The row itself is a plain left-to-right flex; its right-alignment comes from
// the slot it is passed into (DishListRow's `stamps`), which stacks it under the
// price. Reproduced here so the card doesn't teach a left-aligned placement the
// product never uses.
function Dish({ name, price, children }: { name: string; price: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, maxWidth: 320 }}>
      <span>{name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span>{price}</span>
        {children}
      </div>
    </div>
  );
}

/** One person has claimed the dish — the common case at a small table. */
export function OnePicker() {
  return (
    <Dish name="乾炒牛河" price="$88">
      <ChopStampRow itemKey="menu-1" stamps={[{ user_id: 'u1', name: 'Jerry Chu' }]} colorFor={colorFor} />
    </Dish>
  );
}

/** Four members piling onto the same dish. */
export function WholeTable() {
  return (
    <Dish name="白切雞" price="$168">
      <ChopStampRow
        itemKey="menu-2"
        stamps={[
          { user_id: 'u1', name: 'Jerry Chu' },
          { user_id: 'u2', name: '陳大文' },
          { user_id: 'u3', name: 'Wing' },
          { user_id: 'u4', name: 'Priya Raman' },
        ]}
        colorFor={colorFor}
      />
    </Dish>
  );
}

/** Past five, the remainder becomes a +N badge so a table of twelve can't blow
 *  out the row's width. */
export function Overflow() {
  return (
    <Dish name="菠蘿油" price="$28">
      <ChopStampRow
        itemKey="menu-3"
        stamps={['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map((id, i) => ({
          user_id: id, name: ['Jerry Chu', '陳大文', 'Wing', 'Priya Raman', 'Ka Ho', '李小明', 'Sam', 'さくら'][i],
        }))}
        colorFor={colorFor}
      />
    </Dish>
  );
}
