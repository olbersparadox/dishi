import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateTableCode } from '@/lib/group';
import { shapeTableMenuItems } from '@/lib/tableMenuItems';

/**
 * POST /api/table
 * application/json: { items: [...] } — a menu ALREADY scanned by /scan. Reuses
 * those exact items rather than re-scanning the same photo a second time through
 * a different pipeline, which could plausibly read a different set of dishes
 * than the ones already on screen. This is how Scan's "share with friends"
 * action turns an already-in-progress solo scan into a table session.
 *
 * (The standalone Table page used to also accept a multipart/form-data photo
 * upload here, scanning it itself with no Stage-2 enrichment — that page and
 * its front door were removed 2026-07-21, starting a table now only ever
 * happens from a scan, so that path is gone too.)
 *
 * Creates a table session and auto-joins the host. With menu items, those
 * become the candidate set; with none, the session ranks the community dish
 * pool instead (still fun, less situational). Returns the join code and
 * session id (the latter needed to attach picks to this session).
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to start a table.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : [];
  const menuItems = shapeTableMenuItems(items);
  if (menuItems.length === 0) {
    return NextResponse.json({ error: 'No scanned dishes to share.' }, { status: 400 });
  }

  // Generate a code, retrying on the (rare) collision.
  let session = null;
  for (let attempt = 0; attempt < 5 && !session; attempt++) {
    const code = generateTableCode();
    const { data, error } = await supabase
      .from('table_sessions')
      .insert({ code, host_id: user.id, menu_items: menuItems })
      .select()
      .single();
    if (!error) session = data;
    else if (error.code !== '23505') { // 23505 = unique violation -> code collision, retry
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!session) return NextResponse.json({ error: 'Could not create a session. Try again.' }, { status: 500 });

  await supabase.from('table_members').insert({ session_id: session.id, user_id: user.id });

  return NextResponse.json({ code: session.code, session_id: session.id });
}
