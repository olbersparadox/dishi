'use client';
import { useCallback, useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import TableQR from '@/components/TableQR';

type ClaimableRestaurant = {
  id: string; name: string; address: string | null;
  dish_count: number; claim_status: string | null;
};
type Dashboard = {
  restaurant: { id: string; name: string; address: string | null };
  claim_status: string;
  totals: { dishes_logged: number; ratings: number; avg_delight: number | null; helpful_marks: number };
  dishes: { id: string; name: string; rating_count: number; avg_delight: number | null; helpful_marks: number }[];
  hidden_gems: { id: string; name: string; avg_delight: number | null; rating_count: number }[];
  loved_for: string[];
};

type OwnerTable = { id: string; label: string; qr_token: string };
type OwnerMenuItem = {
  id: string; name: string; name_original: string | null; description: string | null;
  price: string | null; cuisine: string | null; available: boolean;
};
type OwnerOrder = {
  id: string; status: 'pending' | 'confirmed'; created_at: string; table_label: string; diner: string;
  items: { name: string; qty: number; price: string | null }[];
};

const DIM_LABELS: Record<string, string> = {
  sweet: 'sweetness', salty: 'seasoning', sour: 'acidity', bitter: 'bitter notes',
  umami: 'umami depth', spicy: 'heat', crispy: 'crunch', creamy: 'creaminess',
  chewy: 'texture', tender: 'tenderness', rich: 'richness', fresh: 'freshness',
  fried: 'frying', grilled: 'grill work', braised: 'braising', steamed: 'steaming',
  raw: 'raw prep', baked: 'baking',
};

export default function OwnerPage() {
  return (
    <AuthGate>
      <Owner />
    </AuthGate>
  );
}

function Owner() {
  const [restaurants, setRestaurants] = useState<ClaimableRestaurant[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<'overview' | 'menu' | 'tables' | 'orders'>('overview');
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    const res = await fetch('/api/restaurant/claim');
    const json = await res.json();
    if (res.ok) setRestaurants(json.restaurants);
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  async function claim(id: string) {
    setError('');
    const res = await fetch('/api/restaurant/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: id }),
    });
    if (res.ok) { await loadList(); open(id); }
    else setError((await res.json()).error || 'Claim failed.');
  }

  async function open(id: string) {
    setSelected(id); setDash(null); setError(''); setTab('overview');
    const res = await fetch(`/api/restaurant/dashboard?restaurant_id=${id}`);
    const json = await res.json();
    if (res.ok) setDash(json);
    else { setError(json.error || 'Could not load the dashboard.'); setSelected(null); }
  }

  // ---- dashboard view ----
  if (selected && dash) {
    const t = dash.totals;
    return (
      <div>
        <button className="btn ghost small" onClick={() => { setSelected(null); setDash(null); }}>
          ← All restaurants
        </button>
        <h1 style={{ margin: '10px 0 2px' }}>{dash.restaurant.name}</h1>
        <p className="card-meta" style={{ marginBottom: 4 }}>{dash.restaurant.address ?? ''}</p>
        <p className="scan-banner">
          Unverified claim — analytics are live, but public "owner" features stay off until real verification exists.
        </p>

        <div className="owner-tabs" role="tablist">
          {(['overview', 'menu', 'tables', 'orders'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t}
              className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'menu' ? 'Menu' : t === 'tables' ? 'Tables & QR' : 'Orders'}
            </button>
          ))}
        </div>

        {tab === 'menu' && <MenuTab restaurantId={dash.restaurant.id} />}
        {tab === 'tables' && <TablesTab restaurantId={dash.restaurant.id} />}
        {tab === 'orders' && <OrdersTab restaurantId={dash.restaurant.id} />}
        {tab !== 'overview' ? null : <>
        <div className="stat-row">
          <div className="stat"><div className="stat-num">{t.dishes_logged}</div><div className="stat-label">dishes logged</div></div>
          <div className="stat"><div className="stat-num">{t.ratings}</div><div className="stat-label">ratings</div></div>
          <div className="stat"><div className="stat-num">{t.avg_delight ?? '—'}</div><div className="stat-label">avg delight</div></div>
          <div className="stat"><div className="stat-num">{t.helpful_marks}</div><div className="stat-label">helped diners decide</div></div>
        </div>

        {dash.loved_for.length > 0 && (
          <div className="card"><div className="card-body">
            <h3 style={{ marginBottom: 8 }}>What people love you for</h3>
            <div className="chips">
              {dash.loved_for.map(d => <span className="chip on" key={d}>{DIM_LABELS[d] ?? d}</span>)}
            </div>
            <p className="card-meta" style={{ marginTop: 8 }}>
              From the flavor profiles of your positively-rated dishes — the kitchen's strengths as diners actually taste them.
            </p>
          </div></div>
        )}

        {dash.hidden_gems.length > 0 && (
          <div className="card scan-hero"><div className="card-body">
            <h3 style={{ marginBottom: 8 }}>Hidden gems 💎</h3>
            <p className="card-meta" style={{ marginBottom: 10 }}>
              Rated well above your average, but rarely logged — candidates for the specials board.
            </p>
            {dash.hidden_gems.map(g => (
              <div key={g.id} className="card-meta" style={{ padding: '4px 0', fontSize: 14 }}>
                <strong style={{ color: 'var(--ink)' }}>{g.name}</strong> — {g.avg_delight} delight, only {g.rating_count} {g.rating_count === 1 ? 'rating' : 'ratings'}
              </div>
            ))}
          </div></div>
        )}

        <div className="card"><div className="card-body">
          <h3 style={{ marginBottom: 10 }}>Dish performance</h3>
          {dash.dishes.length === 0 && <p className="card-meta">No dishes logged here yet.</p>}
          <div className="bars">
            {dash.dishes.map(d => (
              <div className="bar-row" key={d.id} style={{ gridTemplateColumns: '110px 1fr 34px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    left: 0, width: `${d.avg_delight ?? 0}%`,
                    background: (d.avg_delight ?? 0) >= 65 ? 'var(--jade)' : (d.avg_delight ?? 0) >= 45 ? 'var(--egg-tart)' : 'var(--ink-soft)',
                  }} />
                </div>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {d.avg_delight ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div></div>
        </>}
      </div>
    );
  }

  // ---- claim list ----
  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Restaurant dashboard</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        Claim your restaurant to see how diners' palates respond to your menu.
      </p>
      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}
      {restaurants === null && <p className="card-meta">Loading restaurants…</p>}
      {restaurants?.length === 0 && (
        <div className="card"><div className="card-body">
          <p><strong>No restaurants on Dishi yet.</strong></p>
          <p className="card-meta">Restaurants appear here once diners start logging dishes at them.</p>
        </div></div>
      )}
      {restaurants?.map(r => (
        <div className="card" key={r.id}><div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="card-title" style={{ fontSize: 15.5 }}>{r.name}</div>
            <div className="card-meta">{r.dish_count} {r.dish_count === 1 ? 'dish' : 'dishes'} logged{r.address ? ` · ${r.address}` : ''}</div>
          </div>
          {r.claim_status
            ? <button className="btn small" onClick={() => open(r.id)}>Open dashboard</button>
            : <button className="btn primary small" onClick={() => claim(r.id)}>This is mine</button>}
        </div></div>
      ))}
    </div>
  );
}


// ---------------------------------------------------------------- menu tab ----
function MenuTab({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<OwnerMenuItem[] | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState<'add' | 'import' | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/restaurant/menu?restaurant_id=${restaurantId}`);
    const json = await res.json();
    if (res.ok) setItems(json.items);
  }, [restaurantId]);
  useEffect(() => { load(); }, [load]);

  async function addItem() {
    if (!name.trim()) return;
    setBusy('add'); setMsg('');
    const res = await fetch('/api/restaurant/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, name, price: price || undefined, description: desc || undefined }),
    });
    if (res.ok) { setName(''); setPrice(''); setDesc(''); await load(); }
    else setMsg((await res.json()).error ?? 'Could not add.');
    setBusy(null);
  }

  async function importMenu(file: File | null) {
    if (!file) return;
    setBusy('import'); setMsg('');
    const form = new FormData();
    form.append('restaurant_id', restaurantId);
    form.append('photo', file);
    const res = await fetch('/api/restaurant/menu', { method: 'POST', body: form });
    const json = await res.json();
    setMsg(res.ok
      ? `Imported ${json.imported} dishes from the photo${json.mock ? ' (demo data — no vision key set)' : ''}.`
      : json.error ?? 'Import failed.');
    if (res.ok) await load();
    setBusy(null);
  }

  async function toggle(item: OwnerMenuItem) {
    setItems(prev => prev?.map(i => i.id === item.id ? { ...i, available: !i.available } : i) ?? null);
    await fetch('/api/restaurant/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, available: !item.available }),
    });
  }

  return (
    <div>
      <div className="card"><div className="card-body">
        <h3 style={{ marginBottom: 4 }}>Import your menu in 30 seconds</h3>
        <p className="card-meta" style={{ marginBottom: 10 }}>
          Photograph your physical menu — every dish is read in with taste attributes, ready to personalize.
        </p>
        <input type="file" accept="image/*" capture="environment" className="field"
          disabled={busy !== null} onChange={e => importMenu(e.target.files?.[0] ?? null)} />
        {busy === 'import' && <p className="scan-status" style={{ marginTop: 8 }}>Reading the menu…</p>}
      </div></div>

      <div className="card"><div className="card-body">
        <h3 style={{ marginBottom: 8 }}>Add a dish by hand</h3>
        <input className="field" placeholder="Dish name" value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="field" placeholder="Price (e.g. $88)" value={price} onChange={e => setPrice(e.target.value)} style={{ maxWidth: 130 }} />
          <input className="field" placeholder="Short description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <button className="btn primary small" style={{ marginTop: 10 }} disabled={busy !== null || !name.trim()} onClick={addItem}>
          {busy === 'add' ? 'Adding…' : 'Add dish'}
        </button>
      </div></div>

      {msg && <p className="scan-banner" role="status">{msg}</p>}

      {items === null && <p className="card-meta">Loading the menu…</p>}
      {items?.length === 0 && <p className="card-meta">No dishes yet — import or add above.</p>}
      {items?.map(i => (
        <div className="card" key={i.id}><div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0, opacity: i.available ? 1 : 0.45 }}>
            <div className="card-title" style={{ fontSize: 15 }}>{i.name}</div>
            <div className="card-meta">
              {i.name_original ? `${i.name_original} · ` : ''}{i.price ?? 'no price'}
              {i.description ? ` · ${i.description}` : ''}
            </div>
          </div>
          <button className={`chip ${i.available ? 'on' : ''}`} onClick={() => toggle(i)}>
            {i.available ? 'Available' : '86’d'}
          </button>
        </div></div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- tables tab ----
function TablesTab({ restaurantId }: { restaurantId: string }) {
  const [tables, setTables] = useState<OwnerTable[] | null>(null);
  const [label, setLabel] = useState('');
  const [showQr, setShowQr] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/restaurant/tables?restaurant_id=${restaurantId}`);
    const json = await res.json();
    if (res.ok) setTables(json.tables);
  }, [restaurantId]);
  useEffect(() => { load(); }, [load]);

  async function addTable() {
    if (!label.trim()) return;
    const res = await fetch('/api/restaurant/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, label }),
    });
    if (res.ok) { setLabel(''); await load(); }
    else setMsg((await res.json()).error ?? 'Could not add the table.');
  }

  async function regenerate(t: OwnerTable) {
    if (!confirm(`Regenerate the QR for ${t.label}? Every printed copy of the old code stops working.`)) return;
    const res = await fetch('/api/restaurant/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: t.id }),
    });
    if (res.ok) { await load(); setShowQr(t.id); }
  }

  async function remove(t: OwnerTable) {
    if (!confirm(`Remove ${t.label}? Its QR code stops working.`)) return;
    await fetch('/api/restaurant/tables', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: t.id }),
    });
    await load();
  }

  return (
    <div>
      <div className="card"><div className="card-body">
        <h3 style={{ marginBottom: 8 }}>Add a table</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" placeholder="Table 1, Patio A, Bar 3…" value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn primary small" disabled={!label.trim()} onClick={addTable}>Add</button>
        </div>
        <p className="card-meta" style={{ marginTop: 8 }}>
          Each table gets its own QR to print and laminate. Diners scan it to see the menu ranked for their taste — and order.
        </p>
      </div></div>
      {msg && <p className="scan-banner">{msg}</p>}

      {tables === null && <p className="card-meta">Loading tables…</p>}
      {tables?.length === 0 && <p className="card-meta">No tables yet.</p>}
      {tables?.map(t => (
        <div className="card" key={t.id}><div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="card-title" style={{ fontSize: 15.5 }}>{t.label}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn small" onClick={() => setShowQr(showQr === t.id ? null : t.id)}>
                {showQr === t.id ? 'Hide QR' : 'Show QR'}
              </button>
              <button className="btn ghost small" onClick={() => regenerate(t)}>Regenerate</button>
              <button className="btn ghost small" onClick={() => remove(t)}>Remove</button>
            </div>
          </div>
          {showQr === t.id && <div style={{ marginTop: 12 }}><TableQR token={t.qr_token} label={t.label} /></div>}
        </div></div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- orders tab ----
function OrdersTab({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<OwnerOrder[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders?restaurant_id=${restaurantId}`);
    const json = await res.json();
    if (res.ok) setOrders(json.orders);
  }, [restaurantId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function advance(o: OwnerOrder, status: string) {
    setOrders(prev => prev?.map(x => x.id === o.id
      ? (status === 'confirmed' ? { ...x, status: 'confirmed' as const } : x)
      : x)?.filter(x => !(x.id === o.id && (status === 'done' || status === 'cancelled'))) ?? null);
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: o.id, status }),
    });
    load();
  }

  if (orders === null) return <p className="card-meta">Loading the queue…</p>;
  if (orders.length === 0) return (
    <div className="card"><div className="card-body">
      <p><strong>No active orders.</strong></p>
      <p className="card-meta">New orders from table QR codes appear here within seconds. Keep this tab open during service.</p>
    </div></div>
  );

  return (
    <div>
      {orders.map(o => (
        <div className={`card order-ticket ${o.status}`} key={o.id}><div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="card-title" style={{ fontSize: 15.5 }}>{o.table_label}</div>
            <span className="card-meta">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {o.diner}</span>
          </div>
          <div style={{ margin: '6px 0 10px' }}>
            {o.items.map((i, idx) => (
              <div key={idx} style={{ fontSize: 14.5 }}>
                <strong>{i.qty}×</strong> {i.name} {i.price ? <span className="card-meta">· {i.price}</span> : null}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {o.status === 'pending' && <button className="btn primary small" onClick={() => advance(o, 'confirmed')}>Confirm</button>}
            {o.status === 'confirmed' && <button className="btn primary small" onClick={() => advance(o, 'done')}>Mark served</button>}
            <button className="btn ghost small" onClick={() => advance(o, 'cancelled')}>Cancel</button>
          </div>
        </div></div>
      ))}
    </div>
  );
}
