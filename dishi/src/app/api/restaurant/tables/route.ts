import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateQrToken } from '@/lib/order';

/**
 * Owner table management. All operations go through the RLS'd server client, so the
 * claim requirement is enforced by the database policies themselves — a non-owner
 * gets empty reads and rejected writes even if this route had a bug.
 *
 * GET    /api/restaurant/tables?restaurant_id=X          — list tables + tokens
 * POST   /api/restaurant/tables   { restaurant_id, label } — add a table
 * PATCH  /api/restaurant/tables   { table_id }             — regenerate the QR token
 *                                   (invalidates the previously printed code)
 * DELETE /api/restaurant/tables   { table_id }             — remove a table
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id');
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id is required.' }, { status: 400 });

  const { data: tables, error } = await supabase
    .from('restaurant_tables')
    .select('id, label, qr_token, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tables: tables ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { restaurant_id, label } = await req.json().catch(() => ({}));
  const cleanLabel = String(label ?? '').trim().slice(0, 40);
  if (!restaurant_id || !cleanLabel) {
    return NextResponse.json({ error: 'restaurant_id and a table label are required.' }, { status: 400 });
  }

  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .insert({ restaurant_id, label: cleanLabel, qr_token: generateQrToken() })
    .select('id, label, qr_token, created_at')
    .single();
  if (error) {
    const msg = error.code === '42501' ? 'Claim this restaurant first.' : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === '42501' ? 403 : 500 });
  }
  return NextResponse.json({ table });
}

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { table_id } = await req.json().catch(() => ({}));
  if (!table_id) return NextResponse.json({ error: 'table_id is required.' }, { status: 400 });

  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .update({ qr_token: generateQrToken() })
    .eq('id', table_id)
    .select('id, label, qr_token')
    .single();
  if (error || !table) return NextResponse.json({ error: error?.message ?? 'Table not found or not yours.' }, { status: 403 });
  return NextResponse.json({ table });
}

export async function DELETE(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { table_id } = await req.json().catch(() => ({}));
  if (!table_id) return NextResponse.json({ error: 'table_id is required.' }, { status: 400 });

  const { error } = await supabase.from('restaurant_tables').delete().eq('id', table_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
