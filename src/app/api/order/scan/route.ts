import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { generateTableCode } from '@/lib/group';
import { isSessionFresh } from '@/lib/order';

/**
 * POST /api/order/scan  { token }
 * The QR entry point. Resolves the table token (server-side only — tokens are the
 * secret), then applies the join-if-open-else-create rule: a fresh open session at
 * this table gets joined; otherwise a new one is created with the scanner as host.
 * Freshness window (4h) stops a lunch session from capturing dinner guests.
 * Returns the session code, so the rest of the flow reuses the tested Table Mode
 * machinery (including friends joining by code without scanning).
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { token } = await req.json().catch(() => ({} as { token?: string }));
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing table code.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: table } = await admin
    .from('restaurant_tables')
    .select('id, label, restaurant_id, restaurants(name)')
    .eq('qr_token', token)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: 'This QR code isn\u2019t active. Ask the staff for a fresh one.' }, { status: 404 });
  }

  // Join a fresh open session at this table if one exists…
  const { data: openSessions } = await admin
    .from('table_sessions')
    .select('id, code, created_at')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
  let session = openSessions?.[0] && isSessionFresh(openSessions[0].created_at) ? openSessions[0] : null;

  // …else create one, retrying the code on collision.
  if (!session) {
    for (let attempt = 0; attempt < 5 && !session; attempt++) {
      const { data, error } = await admin
        .from('table_sessions')
        .insert({
          code: generateTableCode(),
          host_id: user.id,
          table_id: table.id,
          restaurant_id: table.restaurant_id,
        })
        .select('id, code, created_at')
        .single();
      if (!error) session = data;
      else if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!session) return NextResponse.json({ error: 'Could not open a session. Try again.' }, { status: 500 });
  }

  const { error: joinErr } = await admin
    .from('table_members')
    .insert({ session_id: session.id, user_id: user.id });
  if (joinErr && joinErr.code !== '23505') {
    return NextResponse.json({ error: joinErr.message }, { status: 500 });
  }

  return NextResponse.json({
    code: session.code,
    table_label: table.label,
    restaurant_name: (table as any).restaurants?.name ?? 'this restaurant',
  });
}
