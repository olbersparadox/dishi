import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * PATCH /api/dishes/eaten-date { dish_id, eaten_at: string | null } -> { eaten_at }
 *
 * Set/clear a dish's when-eaten date. Deliberately its OWN endpoint, not part of
 * the rename cascade in /api/my/dishes: eaten_at is PERSONAL metadata on the user's
 * own row (dishes.user_id), so it has none of that route's lock/translation/replay
 * concerns — a dish "locked" because others rated the shared name must still let
 * you correct when YOU ate it. RLS scopes the update to the caller's own dish.
 *
 * Sourced silently from photo EXIF at log time; this is the manual path — the
 * card's tappable date (incl. the "某年某月某日" placeholder for photos with no
 * readable EXIF). `null` clears it back to unknown.
 */
export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dishId = typeof body?.dish_id === 'string' ? body.dish_id : null;
  if (!dishId) return NextResponse.json({ error: 'dish_id is required.' }, { status: 400 });

  const raw = body?.eaten_at;
  let eatenAt: string | null;
  if (raw === null || raw === '') {
    eatenAt = null;
  } else if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) {
    eatenAt = new Date(raw).toISOString();
  } else {
    return NextResponse.json({ error: 'eaten_at must be a date or null.' }, { status: 400 });
  }

  // RLS restricts this to the caller's own dish; the explicit user_id filter is
  // belt-and-suspenders and makes the intent obvious.
  const { data, error } = await supabase
    .from('dishes').update({ eaten_at: eatenAt }).eq('id', dishId).eq('user_id', user.id)
    .select('id, eaten_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });

  return NextResponse.json({ eaten_at: data?.eaten_at ?? null });
}
