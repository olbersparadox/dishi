// The reveal-display ledger — the safety net behind the 2026-07-24 render
// regression, where 36 seals were computed, one-way-stamped, and never shown.
//
// `revealed_at` means ONLY "the outcome was computed server-side". `displayed_at`
// means "the person actually saw it". Splitting them is what makes an undisplayed
// reveal recoverable instead of destroyed.
//
// THE SEAL CONTRACT, restated because this file is the easiest place to break it:
// a PENDING prediction (revealed_at IS NULL) must never reach the client, in any
// shape. Every query here is hard-filtered on `revealed_at IS NOT NULL`. This
// route can only ever hand back verdicts that are already decided — it widens
// nothing. sealed_predictions is RLS-locked against its own owner, so both
// handlers authenticate the user first and then scope every statement to their
// own user_id through the admin client (the pattern /api/ratings uses).
import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { directionOf } from '@/lib/seal';

/**
 * GET /api/seals/displayed
 * Reveals that were computed but never rendered — the recovery list. Returns
 * only decided verdicts, newest first, with the dish they belong to so the card
 * can name it. Capped: this is a safety net, not a feed.
 */
export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from('sealed_predictions')
    .select('id, predicted_direction, outcome, actual_score, predicted_reason_zh, predicted_reason_en, dishes(id, name, name_zh)')
    .eq('user_id', user.id)
    .not('revealed_at', 'is', null)   // decided only — never a pending seal
    .is('displayed_at', null)
    .order('revealed_at', { ascending: false })
    .limit(3);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seals = (data ?? []).map((r: any) => ({
    id: r.id,
    predicted_direction: r.predicted_direction,
    // Re-derived from the STORED actual_score with the same directionOf the
    // reveal used, so this route can never state a different verdict than the
    // one already computed. `outcome` itself is read from the row, not recomputed.
    actual_direction: directionOf(r.actual_score ?? 0),
    outcome: r.outcome,
    reason_zh: r.predicted_reason_zh ?? null,
    reason_en: r.predicted_reason_en ?? null,
    dish: r.dishes ? { id: r.dishes.id, name: r.dishes.name, name_zh: r.dishes.name_zh ?? null } : null,
  }));
  return NextResponse.json({ seals });
}

/**
 * POST /api/seals/displayed  { ids: string[] }
 * The client acknowledging that these reveals actually rendered. Idempotent:
 * a re-ack of an already-marked row is a no-op, never an error.
 */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some(i => typeof i !== 'string')) {
    return NextResponse.json({ error: 'ids (string[]) required.' }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ ok: true, marked: 0 });

  // Scoped to this user AND to already-revealed rows: an ack must never be able
  // to stamp someone else's row, nor to touch a pending one.
  const { data, error } = await supabaseAdmin()
    .from('sealed_predictions')
    .update({ displayed_at: new Date().toISOString() })
    .in('id', ids as string[])
    .eq('user_id', user.id)
    .not('revealed_at', 'is', null)
    .is('displayed_at', null)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, marked: (data ?? []).length });
}
