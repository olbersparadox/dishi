'use client';
// Untracked dev harness (same role as dev-dice): the 餐廳未定 sheet is behind auth and
// needs a live table, so this mounts the real TableRestaurantLine to eyeball its
// states. Not part of the app.
import TableRestaurantLine from '@/components/TableRestaurantLine';

export default function DevPicker() {
  return (
    <div className="page" style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>dev: 餐廳未定 sheet</h1>
      <p className="card-meta" style={{ margin: '0 0 6px', opacity: 0.6 }}>unset + printed-name confirm chip</p>
      <TableRestaurantLine
        restaurant={null}
        onChange={async c => console.log('chose', c)}
        suggestion={{ name: '翠華餐廳', choice: { kind: 'new', name: 'Tsui Wah', lat: 22.28, lng: 114.19, place_id: 'pl' } }}
      />
      <div style={{ height: 28 }} />
      <p className="card-meta" style={{ margin: '0 0 6px', opacity: 0.6 }}>unset, no suggestion (quiescent)</p>
      <TableRestaurantLine restaurant={null} onChange={async c => console.log('chose', c)} />
    </div>
  );
}
