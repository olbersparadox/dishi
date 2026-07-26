import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername, renamesLeft } from '@/lib/username';

/**
 * GET  /api/username?check=foo -> { available, error }
 * POST /api/username { username } -> claims it, or spends the ONE rename.
 *
 * The username IS profiles.handle (see supabase/applied/profiles_username_claim.sql)
 * — one identity string for the chop, the table, and later dishi.me/[username].
 * `username_set_at` distinguishes a real claim from the auto-derived handle every
 * legacy row already carries.
 *
 * Availability is checked with the ADMIN client on purpose: profiles is readable
 * per whatever RLS allows, and "is this name taken" must be answered against ALL
 * rows or the check would tell a person a name is free and the write would then
 * fail. The only thing leaked is a boolean about a name the person typed.
 */

/** The lower(handle) unique index is the real gate; this is the friendly pre-check. */
async function isTaken(name: string, exceptUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('profiles').select('id').ilike('handle', name).neq('id', exceptUserId).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('check') ?? '';
  const err = validateUsername(raw);
  if (err) return NextResponse.json({ available: false, error: err });

  const name = normalizeUsername(raw);
  return NextResponse.json({ available: !(await isTaken(name, user.id)), error: null });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const admin = supabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const err = validateUsername(body?.username ?? '');
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const name = normalizeUsername(body.username);

  const { data: profile } = await admin
    .from('profiles').select('handle, username_set_at, username_changes_used').eq('id', user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'noprofile' }, { status: 404 });

  const claimed = !!profile.username_set_at;
  const left = renamesLeft(profile.username_changes_used as number | null);

  // Re-submitting the name you already have is a no-op, not a spent rename —
  // otherwise a double-tap on 儲存 would burn the one change a person gets.
  if (normalizeUsername((profile.handle as string | null) ?? '') === name && claimed) {
    return NextResponse.json({ username: name, changesLeft: left, spent: false });
  }
  if (claimed && left <= 0) return NextResponse.json({ error: 'nochangesleft' }, { status: 409 });
  if (await isTaken(name, user.id)) return NextResponse.json({ error: 'taken' }, { status: 409 });

  // A rename spends the budget; the first claim does not. Both stamp set_at, so
  // the naming prompt never fires again.
  const changesUsed = (profile.username_changes_used as number | null) ?? 0;
  const { error: writeErr } = await admin.from('profiles').update({
    handle: name,
    username_set_at: new Date().toISOString(),
    username_changes_used: claimed ? changesUsed + 1 : changesUsed,
  }).eq('id', user.id);

  // The unique index is the authority — a racing claim lands here, not on a
  // duplicate row.
  if (writeErr) {
    const taken = /duplicate key|unique/i.test(writeErr.message ?? '');
    return NextResponse.json({ error: taken ? 'taken' : 'failed' }, { status: taken ? 409 : 500 });
  }

  return NextResponse.json({
    username: name,
    changesLeft: claimed ? renamesLeft(changesUsed + 1) : left,
    spent: claimed,
  });
}
