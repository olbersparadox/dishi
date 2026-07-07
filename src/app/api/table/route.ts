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
 * multipart/form-data: photo? (a menu photo — optional)
 *
 * Creates a table session and auto-joins the host. With a menu photo, the scanned
 * items become the candidate set; without one, the session ranks the community dish
 * pool instead (still fun, less situational). Returns the join code.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to start a table.' }, { status: 401 });

  const form = await req.formData();
  const photo = form.get('photo') as File | null;

  let menuItems = null;
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

  return NextResponse.json({ code: session.code });
}
