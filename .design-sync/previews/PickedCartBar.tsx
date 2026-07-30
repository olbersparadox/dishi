import { PickedCartBar, DishListRow, ChopStampRow } from 'dishi';

// The floating black pill: fixed position, transparent pointer-events-none
// container, renders nothing at all with no picks. Composed here over a
// plausible settled menu (DishListRow, the exact list it floats above on
// both /scan and /table) so the floating relationship is visible rather than
// showing the pill against blank space.
const colorFor = (id: string) => ({ u1: '#3B82F6', u2: '#A855F7' }[id] ?? '#3B82F6');

function MenuBehind() {
  return (
    <div className="scan-settle" style={{ maxWidth: 420 }}>
      <DishListRow
        item={{ key: 'm1', name: 'Beef Chow Fun', name_zh: '乾炒牛河', price: '$88', enriched: true, diet: ['beef'], heaviness: 'medium' }}
        rank={1} picked onSelect={() => {}}
        stamps={<ChopStampRow itemKey="m1" stamps={[{ user_id: 'u1', name: 'Jerry Chu' }]} colorFor={colorFor} />}
      />
      <DishListRow
        item={{ key: 'm2', name: 'Poached Chicken', name_zh: '白切雞', price: '$168', enriched: true, diet: ['chicken'], heaviness: 'light' }}
        rank={2} picked onSelect={() => {}}
        stamps={<ChopStampRow itemKey="m2" stamps={[{ user_id: 'u1', name: 'Jerry Chu' }, { user_id: 'u2', name: '陳大文' }]} colorFor={colorFor} />}
      />
      <DishListRow
        item={{ key: 'm3', name: 'Pineapple Bun with Butter', name_zh: '菠蘿油', price: '$28', enriched: true }}
        rank={3} picked={false} onSelect={() => {}}
        stamps={<ChopStampRow itemKey="m3" stamps={[]} colorFor={colorFor} />}
      />
    </div>
  );
}

/** Two dishes picked, both with a readable price — the pill shows the count
 *  and the summed running bill, linking straight to the rating queue. */
export function OverMenu() {
  return (
    <div style={{ position: 'relative', minHeight: 260, paddingBottom: 80 }}>
      <MenuBehind />
      <PickedCartBar picked={[{ key: 'm1', price: '$88' }, { key: 'm2', price: '$168' }]} />
    </div>
  );
}

/** One picked price is unreadable off the menu photo — the "+" after the
 *  total is load-bearing: an honest floor, never shown as the real total. */
export function PartialPrices() {
  return (
    <div style={{ position: 'relative', minHeight: 260, paddingBottom: 80 }}>
      <MenuBehind />
      <PickedCartBar picked={[{ key: 'm1', price: '$88' }, { key: 'm2', price: null }]} />
    </div>
  );
}
