import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/table/[code]/ready  { ready: boolean }
 *
 * "I'm done picking." The table stops picking only when EVERY member has said
 * so — this route records one member's tap and, when it turns out to be the
 * last one, stamps the session's settled_at.
 *
 * Admin client throughout, and not for convenience: table_members has no UPDATE
 * policy at all, and table_sessions' only UPDATE policy is host-scoped
 * (auth.uid() = host_id) while any member may complete the handshake. Both
 * writes through the user-scoped client would be silently swallowed — the
 * failure class this repo has been bitten by before. Authorization is done here
 * instead: authenticate, then confirm the caller is actually at this table.
 */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ready = body?.ready !== false; // default true; only an explicit false un-readies

  const code = params.code.toUpperCase();
  const admin = supabaseAdmin();

  const { data: session } = await admin
    .from('table_sessions').select('id, settled_at').eq('code', code).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table with that code.' }, { status: 404 });

  const { data: membership } = await admin
    .from('table_members').select('user_id')
    .eq('session_id', session.id).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Join this table first.' }, { status: 403 });

  const { error: updateError } = await admin
    .from('table_members')
    .update({ ready_at: ready ? new Date().toISOString() : null })
    .eq('session_id', session.id).eq('user_id', user.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Re-read rather than reason about what we just wrote: another member may have
  // tapped in the same second, and the last tap is the one that has to notice.
  const { data: rows } = await admin
    .from('table_members').select('user_id, ready_at').eq('session_id', session.id);
  const members = rows ?? [];
  const readyCount = members.filter(m => m.ready_at).length;

  // The gate reads table_members, the authoritative roster — NOT the GET
  // response's members[], which is built from profiles and would quietly drop
  // anyone without a profile row. Erring toward "not yet" is the safe side of
  // this: a table that flips early strands whoever was still reading the menu.
  let settledAt: string | null = session.settled_at ?? null;
  if (!settledAt && members.length >= 2 && readyCount === members.length) {
    const stamped = new Date().toISOString();
    // Guarded on settled_at still being null so two simultaneous last taps can't
    // both stamp it and hand the two devices different settle times.
    const { data: updated } = await admin
      .from('table_sessions')
      .update({ settled_at: stamped })
      .eq('id', session.id).is('settled_at', null)
      .select('settled_at').maybeSingle();
    settledAt = updated?.settled_at ?? stamped;
  }

  return NextResponse.json({
    ready,
    ready_count: readyCount,
    member_count: members.length,
    settled_at: settledAt,
  });
}
