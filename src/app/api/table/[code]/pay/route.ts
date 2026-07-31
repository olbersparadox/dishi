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
    .select('id, settled_at, pay_payer_id, pay_draw_count')
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

  // EVERY tap of 隨機一人 draws again. This reverses the original rule (a single
  // draw kept for the life of the session, so the table couldn't shop for an
  // answer it liked) on an explicit owner call, 2026-07-31: re-tapping and
  // arguing about the outcome is the entertainment, not abuse of it — "if they
  // keep playing it or someone refuse to pay, it's part of the fun."
  //
  // The draw stays a pure function of (members, seed) rather than becoming
  // server-side randomness, because that is what lets every phone compute the
  // same payer on its own and start the reveal on the tap instead of after a
  // round trip. The COUNT is the part that moves.
  const draw = method === 'random' ? (session.pay_draw_count ?? 0) + 1 : (session.pay_draw_count ?? 0);
  const payerId = method === 'random' ? drawPayer(memberIds, `${session.id}:${draw}`) : null;

  const { error } = await admin
    .from('table_sessions')
    .update({
      pay_method: method, pay_payer_id: payerId, pay_draw_count: draw,
      pay_decided_at: new Date().toISOString(),
    })
    .eq('id', session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pay_method: method, pay_payer_id: payerId, pay_draw_count: draw });
}
