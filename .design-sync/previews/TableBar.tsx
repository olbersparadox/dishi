import { TableBar, TableRestaurantLine } from 'dishi';

// The compact table-status bar. `restaurantLine` lives INSIDE the bar (its
// own prop, not a sibling element) so both /scan and /table get the
// restaurant line without either screen placing it itself — these cells pass
// a real TableRestaurantLine through that slot rather than leaving it empty.

/** The common case: a resolved restaurant, editable (a diner's own scan
 *  session, not a QR/registered table). */
export function WithRestaurant() {
  return (
    <TableBar
      code="7F3K"
      memberCount={3}
      pickCount={5}
      onInvite={() => {}}
      restaurantLine={
        <TableRestaurantLine
          restaurant={{ id: 'r1', name: 'Tai Hing', name_zh: '太興 (銅鑼灣店)' }}
          onChange={async () => {}}
        />
      }
    />
  );
}

/** No restaurant resolved yet — the gate refused to guess between
 *  neighbours it can't separate, so the line shows the unset placeholder,
 *  still tappable to fill in. */
export function RestaurantUnset() {
  return (
    <TableBar
      code="9QX2"
      memberCount={1}
      pickCount={0}
      onInvite={() => {}}
      restaurantLine={<TableRestaurantLine restaurant={null} onChange={async () => {}} />}
    />
  );
}

/** A QR/registered table: the restaurant belongs to the restaurant itself,
 *  so the line is plain text, not a button a diner can reassign. */
export function NonEditableRestaurant() {
  return (
    <TableBar
      code="A3"
      memberCount={4}
      pickCount={7}
      onInvite={() => {}}
      restaurantLine={
        <TableRestaurantLine
          restaurant={{ id: 'r2', name: 'Xu Liu Shan', name_zh: '許留山' }}
          onChange={async () => {}}
          editable={false}
        />
      }
    />
  );
}
