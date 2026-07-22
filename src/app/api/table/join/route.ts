import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { edgeRowsForJoin } from '@/lib/companions';

/**
 * POST /api/table/join  { code }
 * Joins the caller to an open session. Idempotent — joining twice is fine.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to join a table.' }, { status: 401 });

  const { code } = await req.json();
  const normalized = String(code ?? '').trim().toUpperCase();
  if (normalized.length !== 5) return NextResponse.json({ error: 'That code doesn\u2019t look right — it\u2019s 5 characters.' }, { status: 400 });

  const { data: session } = await supabase
    .from('table_sessions').select('id, status').eq('code', normalized).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table found with that code.' }, { status: 404 });
  if (session.status !== 'open') return NextResponse.json({ error: 'That table has been closed by the host.' }, { status: 410 });

  const { error } = await supabase.from('table_members')
    .insert({ session_id: session.id, user_id: user.id });
  if (error && error.code !== '23505') { // 23505 = already a member -> idempotent
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 同檯 companion-edge backfill (Table Mode item 4): joining consents you to
  // the whole session — you can already SEE its existing picks via GET — so a
  // late joiner links against picks that predate them, with picked_at kept as
  // the pick's own time. Runs on re-joins too (the unique index makes it a
  // no-op), so a once-failed backfill self-heals on the next join call.
  // Admin client on purpose: companion_edges has NO client write policies
  // (RLS proof in its migration file). Best-effort with a logged failure —
  // an edge miss must never fail the join itself.
  try {
    const admin = supabaseAdmin();
    const [{ data: members }, { data: picks }] = await Promise.all([
      admin.from('table_members').select('user_id').eq('session_id', session.id),
      admin.from('dishes').select('id, created_at').eq('table_session_id', session.id),
    ]);
    const edgeRows = edgeRowsForJoin(
      user.id,
      (members ?? []).map(m => m.user_id),
      picks ?? [],
      session.id,
    );
    if (edgeRows.length > 0) {
      const { error: edgeError } = await admin
        .from('companion_edges')
        .upsert(edgeRows, { onConflict: 'dish_id,user_a,user_b', ignoreDuplicates: true });
      if (edgeError) console.error('companion edges (join backfill) failed', edgeError);
    }
  } catch (e) {
    console.error('companion edges (join backfill) failed', e);
  }

  return NextResponse.json({ ok: true, code: normalized });
}
