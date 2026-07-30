import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { drawPayer } from '@/lib/tableSettle';

const METHODS = ['equal', 'random'] as const;
type Method = typeof METHODS[number];

/**
 * POST /api/table/[code]/pay  { method: 'equal' | 'random' }
 *
 * How the table carries the bill. Nothing here moves money — Dishi decides WHO
 * pays and prints the number; the actual paying happens the way it always has,
 * at the counter.
 *
 * 'game' (大話骰) is deliberately not accepted yet: the screen marks it as
 * coming, and a method with no game behind it would settle a bill on a coin
 * flip the players never saw.
 *
 * Admin client for the write (table_sessions' UPDATE policy is host-scoped, and
 * any member may choose), with membership checked here instead.
 */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const method = String(body?.method ?? '') as Method;
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Unknown way to split that bill.' }, { status: 400 });
  }

  const code = params.code.toUpperCase();
  const admin = supabaseAdmin();

  const { data: session } = await admin
    .from('table_sessions')
    .select('id, settled_at, pay_payer_id')
    .eq('code', code).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table with that code.' }, { status: 404 });
  if (!session.settled_at) {
    return NextResponse.json({ error: 'The table is still picking.' }, { status: 409 });
  }

  const { data: rows } = await admin
    .from('table_members').select('user_id').eq('session_id', session.id);
  const memberIds = (rows ?? []).map(m => m.user_id);
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Join this table first.' }, { status: 403 });
  }

  // A drawn payer is kept for the life of the session. Switching to 平分 and back
  // must not re-roll — otherwise the table can shop for an answer it likes, and
  // "random" stops meaning anything. (drawPayer is deterministic on the session
  // id anyway, so even a lost row would come back with the same name.)
  const payerId = method === 'random'
    ? (session.pay_payer_id ?? drawPayer(memberIds, session.id))
    : null;

  const { error } = await admin
    .from('table_sessions')
    .update({ pay_method: method, pay_payer_id: payerId, pay_decided_at: new Date().toISOString() })
    .eq('id', session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pay_method: method, pay_payer_id: payerId });
}
