import { TableRestaurantLine } from 'dishi';

// One quiet meta line, always shown INSIDE TableBar's own bar (its
// `restaurantLine` slot, a full row of the inset block) rather than floating
// under it — reproduced here with the same inset background so the line
// doesn't read as sitting on bare paper, which it never does in the product.
function InBar({ children }: { children: React.ReactNode }) {
  return <div className="table-bar">{children}</div>;
}

/** Resolved automatically at table creation, editable — a diner can still
 *  correct it in one tap. */
export function Named() {
  return (
    <InBar>
      <TableRestaurantLine restaurant={{ id: 'r1', name: 'Tai Hing', name_zh: '太興 (銅鑼灣店)' }} onChange={async () => {}} />
    </InBar>
  );
}

/** The gate refused to guess between neighbours it couldn't separate — the
 *  blank is a gap a diner can still fill, never a blocking step. */
export function Unset() {
  return (
    <InBar>
      <TableRestaurantLine restaurant={null} onChange={async () => {}} />
    </InBar>
  );
}

/** A QR/registered table: the restaurant belongs to the restaurant itself,
 *  so the line is plain text, no dotted-underline affordance. */
export function NonEditable() {
  return (
    <InBar>
      <TableRestaurantLine restaurant={{ id: 'r2', name: 'Xu Liu Shan', name_zh: '許留山' }} onChange={async () => {}} editable={false} />
    </InBar>
  );
}
