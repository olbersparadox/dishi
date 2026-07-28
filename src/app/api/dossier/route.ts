import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * PATCH — the public dossier's ONE owner control (decision 3): hide restaurant
 * names on dishi.me/[username], accepting a weaker page. Authenticated, own
 * row only; profiles is user-updatable under RLS so the user-scoped client is
 * the right one here (no admin bypass needed for writing your own flag).
 */
export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.hide_restaurants !== 'boolean') {
    return NextResponse.json({ error: 'hide_restaurants must be a boolean.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ public_hide_restaurants: body.hide_restaurants })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hide_restaurants: body.hide_restaurants });
}
