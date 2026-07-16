import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateTableCode } from '@/lib/group';
import { scanMenu } from '@/lib/menuScan';

export const maxDuration = 60;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}


/**
 * POST /api/table
 * EITHER multipart/form-data: photo? (a menu photo — optional; existing path, used
 *   by the standalone Table page's own "start a table" flow, which scans on its own)
 * OR application/json: { items: [...] } — a menu ALREADY scanned by /scan. Reuses
 *   those exact items rather than re-scanning the same photo a second time through
 *   a different pipeline, which could plausibly read a different set of dishes
 *   than the ones already on screen. This is how Scan's "share with friends"
 *   action turns an already-in-progress solo scan into a table session.
 *
 * Creates a table session and auto-joins the host. With menu items (from either
 * path), those become the candidate set; with neither, the session ranks the
 * community dish pool instead (still fun, less situational). Returns the join
 * code and session id (the latter needed to attach picks to this session).
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to start a table.' }, { status: 401 });

  const isJson = (req.headers.get('content-type') ?? '').includes('application/json');

  let menuItems: any[] | null = null;
  if (isJson) {
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];
    // Trust but re-shape: only carry the fields table sessions actually store/use
    // (mirrors the shape session.menu_items is read back as in GET /[code]) —
    // never store a scan item's raw match/reason/fire fields, which are specific
    // to the ORIGINAL scanner's own taste profile and would be meaningless (or
    // actively misleading) shown as if they applied to the whole table.
    menuItems = items
      .map((raw: any) => {
        const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : '';
        if (!name) return null;
        return {
          name, name_zh: typeof raw?.name_zh === 'string' ? raw.name_zh : null,
          name_original: typeof raw?.name_original === 'string' ? raw.name_original : name,
          price: typeof raw?.price === 'string' ? raw.price : null,
          hook: typeof raw?.hook === 'string' ? raw.hook : '',
          cuisine: typeof raw?.cuisine === 'string' ? raw.cuisine : 'unknown',
          attributes: raw?.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
        };
      })
      .filter(Boolean)
      .slice(0, 40);
    if (!menuItems || menuItems.length === 0) {
      return NextResponse.json({ error: 'No scanned dishes to share.' }, { status: 400 });
    }
  } else {
    const form = await req.formData();
    const photo = form.get('photo') as File | null;
    if (photo) {
      const bytes = Buffer.from(await photo.arrayBuffer());
      const scan = await scanMenu(bytes.toString('base64'), safeMediaType(photo.type));
      if (scan.items.length === 0) {
        return NextResponse.json({
          error: 'Could not read that menu. Try again with better light, or start the table without one.',
        }, { status: 422 });
      }
      menuItems = scan.items;
    }
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
