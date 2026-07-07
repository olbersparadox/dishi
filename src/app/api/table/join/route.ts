import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

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

  return NextResponse.json({ ok: true, code: normalized });
}
