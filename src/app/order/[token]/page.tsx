'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AuthGate from '@/components/AuthGate';

/**
 * /order/[token] — where a table's QR code lands.
 * Flow: resolve token -> join/create the table session -> personalized live menu
 * (same fairness engine as Table Mode; solo diners just get their own ranking) ->
 * tap items into a cart -> send to the kitchen queue -> watch status.
 * Payment is deliberately absent (Level 2): staff confirm orders and payment happens
 * however the restaurant already takes it.
 */

type MenuItem = {
  key: string; menu_item_id?: string; name: string; name_original?: string;
  price?: string | null; hook?: string; cuisine: string | null;
  group_match: number; member_matches: { handle: string; match: number }[];
  unanimous: boolean;
};
type SessionState = {
  code: string; status: string; orderable: boolean;
  table: { table_label: string; restaurant_name: string } | null;
  members: { handle: string; has_profile: boolean }[];
  items: MenuItem[];
};
type MyOrder = {
  id: string; status: string; created_at: string;
  items: { name: string; qty: number; price: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Sent — waiting for the kitchen',
  confirmed: 'Confirmed — being prepared',
  done: 'Served',
  cancelled: 'Cancelled by the restaurant',
};

export default function OrderPage() {
  return (
    <AuthGate>
      <OrderFlow />
    </AuthGate>
  );
}

function OrderFlow() {
  const params = useParams<{ token: string }>();
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 1) Resolve the QR token into a session.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/order/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setCode(json.code);
      } catch (e: any) {
        setError(e.message || 'This QR code didn\u2019t work.');
      }
    })();
  }, [params.token]);

  // 2) Poll session state + my orders.
  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const [sRes, oRes] = await Promise.all([
        fetch(`/api/table/${code}`),
        fetch(`/api/orders?session_code=${code}`),
      ]);
      const sJson = await sRes.json();
      if (!sRes.ok) throw new Error(sJson.error);
      setState(sJson);
      const oJson = await oRes.json();
      if (oRes.ok) setOrders(oJson.orders ?? []);
    } catch (e: any) {
      setError(e.message || 'Lost the table.');
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [code, refresh]);

  function add(key: string, delta: number) {
    setCart(prev => {
      const next = { ...prev, [key]: Math.max(0, Math.min(20, (prev[key] ?? 0) + delta)) };
      if (next[key] === 0) delete next[key];
      return next;
    });
  }

  async function sendOrder() {
    if (!code) return;
    setSending(true); setError(''); setNotice('');
    try {
      const items = Object.entries(cart).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: code, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCart({});
      setNotice(json.warnings?.length ? json.warnings.join(' ') : 'Order sent to the kitchen.');
      refresh();
    } catch (e: any) {
      setError(e.message || 'The order didn\u2019t go through.');
    } finally {
      setSending(false);
    }
  }

  if (error && !state) return <p style={{ color: 'var(--lacquer)' }}>{error}</p>;
  if (!state) return <p className="card-meta">Setting your table\u2026</p>;

  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const profiled = state.members.filter(m => m.has_profile).length;

  return (
    <div style={{ paddingBottom: cartCount > 0 ? 76 : 0 }}>
      <h1 style={{ marginBottom: 2 }}>{state.table?.restaurant_name ?? 'Menu'}</h1>
      <p className="card-meta" style={{ marginBottom: 8 }}>
        {state.table?.table_label ?? 'Your table'} · session <span className="table-code">{state.code}</span>
      </p>
      <p className="card-meta" style={{ marginBottom: 14 }}>
        {state.members.length > 1
          ? `Ranked for ${profiled || 'the'} palate${profiled === 1 ? '' : 's'} at this table — friends can join with the code.`
          : 'Ranked for your taste. Friends at the table can scan the same QR to join the ranking.'}
      </p>

      {notice && <p className="scan-banner" role="status">{notice}</p>}
      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}

      {orders.length > 0 && (
        <div className="card"><div className="card-body">
          <h3 style={{ marginBottom: 8 }}>Your orders</h3>
          {orders.map(o => (
            <div key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="card-meta" style={{ fontSize: 14, color: 'var(--ink)' }}>
                {o.items.map(i => `${i.qty}\u00d7 ${i.name}`).join(', ')}
              </div>
              <div className="card-meta" style={{ color: o.status === 'cancelled' ? 'var(--lacquer)' : 'var(--jade)' }}>
                {STATUS_LABEL[o.status] ?? o.status}
              </div>
            </div>
          ))}
        </div></div>
      )}

      {state.items.length === 0 && (
        <div className="card"><div className="card-body">
          <p><strong>The menu isn\u2019t set up yet.</strong></p>
          <p className="card-meta">Ask the staff — the restaurant hasn\u2019t added dishes to Dishi ordering.</p>
        </div></div>
      )}

      {state.items.map(item => (
        <article className="card" key={item.key}>
          <div className="card-body scan-row">
            <div className="group-ring" style={{
              background: `conic-gradient(${item.group_match >= 70 ? 'var(--jade)' : item.group_match >= 45 ? 'var(--egg-tart)' : 'var(--ink-soft)'} ${item.group_match * 3.6}deg, var(--line) 0deg)`,
            }}>
              <span>{item.group_match}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title" style={{ fontSize: 15.5 }}>
                {item.name}
                {item.unanimous && state.members.length > 1 && <span className="badge-unanimous">whole table</span>}
              </div>
              <div className="card-meta">
                {item.name_original ? `${item.name_original} · ` : ''}
                {item.price ? `${item.price}` : ''}{item.price && item.hook ? ' · ' : ''}{item.hook ?? ''}
              </div>
            </div>
            {item.menu_item_id && (
              <div className="qty-stepper">
                <button aria-label={`Remove one ${item.name}`} onClick={() => add(item.menu_item_id!, -1)}
                  disabled={!cart[item.menu_item_id]}>−</button>
                <span aria-live="polite">{cart[item.menu_item_id] ?? 0}</span>
                <button aria-label={`Add one ${item.name}`} onClick={() => add(item.menu_item_id!, 1)}>+</button>
              </div>
            )}
          </div>
        </article>
      ))}

      {cartCount > 0 && (
        <div className="cart-bar">
          <button className="btn primary" style={{ width: '100%' }} disabled={sending} onClick={sendOrder}>
            {sending ? 'Sending\u2026' : `Send order \u00b7 ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
          </button>
        </div>
      )}
    </div>
  );
}
