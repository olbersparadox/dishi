import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { buildOrderSnapshot, type CartLine } from '@/lib/order';

/**
 * POST  /api/orders  { session_code, items: [{menu_item_id, qty}] } — place an order.
 *        Names/prices/availability are validated server-side against the live menu
 *        (buildOrderSnapshot); the client is trusted only for ids and quantities.
 * GET   /api/orders?session_code=X   — the caller's own orders in that session (diner view)
 * GET   /api/orders?restaurant_id=X  — full active queue, owner-only (RLS-backed + explicit check)
 * PATCH /api/orders  { order_id, status } — owner advances an order through the queue.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sessionCode = String(body?.session_code ?? '').toUpperCase();
  const cart: CartLine[] = Array.isArray(body?.items) ? body.items : [];
  if (sessionCode.length !== 5 || cart.length === 0) {
    return NextResponse.json({ error: 'A session code and at least one item are required.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('table_sessions')
    .select('id, table_id, restaurant_id, status')
    .eq('code', sessionCode)
    .maybeSingle();
  if (!session || !session.table_id || !session.restaurant_id) {
    return NextResponse.json({ error: 'This session isn\u2019t attached to a restaurant table.' }, { status: 400 });
  }
  if (session.status !== 'open') {
    return NextResponse.json({ error: 'This table session is closed.' }, { status: 410 });
  }

  const { data: membership } = await admin
    .from('table_members').select('user_id')
    .eq('session_id', session.id).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Join the table first.' }, { status: 403 });

  const { data: menu } = await admin
    .from('restaurant_menu_items')
    .select('id, name, price, available')
    .eq('restaurant_id', session.restaurant_id);

  const { items, warnings } = buildOrderSnapshot(cart, menu ?? []);
  if (items.length === 0) {
    return NextResponse.json({ error: 'Nothing orderable in that cart.', warnings }, { status: 422 });
  }

  const { data: order, error } = await admin
    .from('table_orders')
    .insert({
      restaurant_id: session.restaurant_id,
      table_id: session.table_id,
      session_id: session.id,
      created_by: user.id,
      items,
    })
    .select('id, status, items, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ order, warnings });
}

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const sessionCode = req.nextUrl.searchParams.get('session_code');
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id');
  const admin = supabaseAdmin();

  // ---- diner view: my orders in this session ----
  if (sessionCode) {
    const { data: session } = await admin
      .from('table_sessions').select('id').eq('code', sessionCode.toUpperCase()).maybeSingle();
    if (!session) return NextResponse.json({ orders: [] });
    const { data: orders } = await admin
      .from('table_orders')
      .select('id, status, items, created_at')
      .eq('session_id', session.id)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    return NextResponse.json({ orders: orders ?? [] });
  }

  // ---- owner view: the live queue ----
  if (restaurantId) {
    const { data: claim } = await supabase
      .from('restaurant_claims').select('id')
      .eq('restaurant_id', restaurantId).eq('user_id', user.id).maybeSingle();
    if (!claim) return NextResponse.json({ error: 'Claim this restaurant first.' }, { status: 403 });

    const { data: orders } = await admin
      .from('table_orders')
      .select('id, status, items, created_at, table_id, restaurant_tables(label), profiles!table_orders_created_by_fkey(handle)')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: true });
    return NextResponse.json({
      orders: (orders ?? []).map((o: any) => ({
        id: o.id, status: o.status, items: o.items, created_at: o.created_at,
        table_label: o.restaurant_tables?.label ?? 'Unknown table',
        diner: o.profiles?.handle ?? 'someone',
      })),
    });
  }

  return NextResponse.json({ error: 'session_code or restaurant_id is required.' }, { status: 400 });
}

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { order_id, status } = await req.json().catch(() => ({}));
  if (!order_id || !status) return NextResponse.json({ error: 'order_id and status are required.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from('table_orders').select('id, status, restaurant_id').eq('id', order_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const { data: claim } = await supabase
    .from('restaurant_claims').select('id')
    .eq('restaurant_id', order.restaurant_id).eq('user_id', user.id).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Only the restaurant can update orders.' }, { status: 403 });

  if (!STATUS_FLOW[order.status]?.includes(status)) {
    return NextResponse.json({ error: `Can't move an order from ${order.status} to ${status}.` }, { status: 400 });
  }

  const { error } = await admin.from('table_orders').update({ status }).eq('id', order_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
