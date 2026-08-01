import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { rollDice, resolveChallenge, type Die, type Direction } from '@/lib/liarsDice';
import {
  viewForUser, canBid, canChallenge, turnAfter, standingBid,
  type DiceRound, type Rolls,
} from '@/lib/tableDice';

/**
 * POST /api/table/[code]/dice  { action: 'roll' | 'direction' | 'bid' | 'challenge' }
 *
 * The whole of 大話骰's server side. One route rather than four because every
 * action is a write to the SAME round row behind the same preamble (authenticate,
 * confirm membership, load the round), and splitting that preamble four ways is
 * how one copy of it eventually forgets a check.
 *
 * The dice never leave this file except through viewForUser. A player's roll is
 * generated here, stored here, and returned to that player alone — the sealed
 * bet's contract, applied to a bill: the table can be told a round is live, and
 * whose turn it is, and what has been called, and still learn nothing about any
 * cup but its own until someone calls 開.
 *
 * Admin client throughout. table_dice_rounds and table_dice_rolls have RLS on and
 * no policies at all, so a user-scoped client reads and writes nothing — the same
 * deliberate lock sealed_predictions uses, and the same reason: the rows are not
 * the client's to see.
 */

/** Crypto-backed, because a predictable roll here is not a flaky test, it is a
 *  way to make someone else pay for dinner. */
function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

type Action = 'roll' | 'direction' | 'bid' | 'challenge';

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? '') as Action;

  const code = params.code.toUpperCase();
  const admin = supabaseAdmin();

  const { data: session } = await admin
    .from('table_sessions').select('id, settled_at').eq('code', code).maybeSingle();
  if (!session) return NextResponse.json({ error: 'No table with that code.' }, { status: 404 });
  // The game settles a bill, so there has to BE a bill: the same gate /pay uses.
  if (!session.settled_at) {
    return NextResponse.json({ error: 'The table is still picking.' }, { status: 409 });
  }

  const { data: memberRows } = await admin
    .from('table_members').select('user_id, joined_at')
    .eq('session_id', session.id).order('joined_at', { ascending: true });
  const memberIds = (memberRows ?? []).map(m => m.user_id as string);
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: 'Join this table first.' }, { status: 403 });
  }

  const { data: existing } = await admin
    .from('table_dice_rounds').select('*')
    .eq('session_id', session.id).order('round', { ascending: false }).limit(1).maybeSingle();
  let round = existing as DiceRound | null;

  if (action === 'roll') {
    // Idempotent on purpose: two people tapping 大話骰 in the same second must not
    // produce two rounds, and a re-tap must never re-roll a cup somebody has
    // already looked at. Whoever gets there first is the round; everyone else
    // just receives it.
    if (!round) {
      // Seating order is join order, frozen now. Two people tapping at once still
      // can't fork the table: the unique (session_id, round) index rejects the
      // loser's insert and it falls through to reading the winner's row.
      const { data: created, error } = await admin
        .from('table_dice_rounds')
        .insert({
          session_id: session.id, round: 1, seat_order: memberIds,
          first_player_id: user.id, current_turn_user_id: user.id,
        })
        .select('*').maybeSingle();
      if (error && error.code !== '23505') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      round = (created as DiceRound | null) ?? await loadRound(admin, session.id);
      if (!round) return NextResponse.json({ error: 'Could not open the cups.' }, { status: 500 });

      // Every cup at once, at the moment the round is created — not lazily on
      // each player's first look, which would let a late-opening player's dice
      // depend on when they opened the screen.
      await admin.from('table_dice_rolls').upsert(
        round.seat_order.map(userId => ({
          round_id: round!.id, user_id: userId, dice: rollDice(secureRandom),
        })),
        { onConflict: 'round_id,user_id', ignoreDuplicates: true },
      );
    }
    // The bill's method follows the game, so every member's settle screen switches
    // over on the same poll that brings them the round.
    //
    // OUTSIDE the creation branch (owner, 2026-08-01). Nested inside it, this only
    // ran for the FIRST tap: a table that already had a round — one that had since
    // gone to 隨機一人 and come back — kept pay_method 'random' in the database while
    // every client optimistically showed the game. Two symptoms, one cause. The
    // draw's leftover pay_payer_id got rendered as the game's verdict, and ~15s
    // later, once the write guard expired, the poll read 'random' back and pulled
    // the whole table out of the game it was sitting in.
    await admin.from('table_sessions')
      .update({
        pay_method: 'game',
        pay_decided_at: new Date().toISOString(),
        // A round in progress has named nobody, and whatever the draw left behind is
        // not its answer. Only 開 writes a payer for this method (see below). A round
        // already revealed keeps the loser it named.
        ...(round?.revealed_at ? {} : { pay_payer_id: null }),
      })
      .eq('id', session.id);
  } else if (!round) {
    return NextResponse.json({ error: 'Nobody has shaken the dice yet.' }, { status: 409 });
  } else if (action === 'direction') {
    const direction = String(body?.direction ?? '') as Direction;
    if (direction !== 'left' && direction !== 'right') {
      return NextResponse.json({ error: 'Left or right.' }, { status: 400 });
    }
    // The opener picks which way the bidding travels, and only before it starts.
    if (round.first_player_id !== user.id || round.direction || round.revealed_at) {
      return NextResponse.json({ error: 'Not yours to pick.' }, { status: 403 });
    }
    const { error } = await admin.from('table_dice_rounds')
      .update({ direction }).eq('id', round.id).is('direction', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === 'bid') {
    const bid = { quantity: Number(body?.quantity), face: Number(body?.face) as Die };
    if (!canBid(round, user.id, bid)) {
      return NextResponse.json({ error: 'That call cannot be made right now.' }, { status: 409 });
    }
    const bids = [...round.bids, { ...bid, user_id: user.id, at: new Date().toISOString() }];
    // Guarded on the turn not having moved: two clients replaying the same tap
    // would otherwise both append, and the table would see the call twice.
    const { data: updated, error } = await admin.from('table_dice_rounds')
      .update({ bids, current_turn_user_id: turnAfter(round, user.id) })
      .eq('id', round.id).eq('current_turn_user_id', user.id).is('revealed_at', null)
      .select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'The turn has already moved on.' }, { status: 409 });
  } else if (action === 'challenge') {
    if (!canChallenge(round, user.id)) {
      return NextResponse.json({ error: 'There is nothing to open.' }, { status: 409 });
    }
    const rolls = await loadRolls(admin, round.id);
    const standing = standingBid(round)!;
    const outcome = resolveChallenge({
      bid: { quantity: standing.quantity, face: standing.face },
      bidderId: standing.user_id,
      challengerId: user.id,
      rolls,
    });
    // First 開 wins: `is('revealed_at', null)` means a second challenger arriving
    // in the same second reads the first one's verdict rather than overwriting it
    // with a different loser.
    const { data: opened } = await admin.from('table_dice_rounds')
      .update({
        challenger_id: user.id, loser_id: outcome.loserId,
        actual_count: outcome.actual, revealed_at: new Date().toISOString(),
      })
      .eq('id', round.id).is('revealed_at', null)
      .select('id').maybeSingle();
    // The loser is the payer, written to the session the same way a random draw
    // is — so the bill, the wait layer, and the game all name one person.
    if (opened) {
      await admin.from('table_sessions')
        .update({ pay_method: 'game', pay_payer_id: outcome.loserId, pay_decided_at: new Date().toISOString() })
        .eq('id', session.id);
    }
  } else {
    return NextResponse.json({ error: 'Unknown move.' }, { status: 400 });
  }

  // Always answer with the caller's own view of the round as it now stands, so a
  // client never has to guess what its write did — and never sees more than the
  // poll would have given it anyway.
  const fresh = await loadRound(admin, session.id);
  if (!fresh) return NextResponse.json({ error: 'Lost the round.' }, { status: 500 });
  const rolls = await loadRolls(admin, fresh.id);
  return NextResponse.json({ game: viewForUser(fresh, rolls, user.id) });
}

async function loadRound(admin: ReturnType<typeof supabaseAdmin>, sessionId: string) {
  const { data } = await admin
    .from('table_dice_rounds').select('*')
    .eq('session_id', sessionId).order('round', { ascending: false }).limit(1).maybeSingle();
  return (data as DiceRound | null) ?? null;
}

async function loadRolls(admin: ReturnType<typeof supabaseAdmin>, roundId: string): Promise<Rolls> {
  const { data } = await admin
    .from('table_dice_rolls').select('user_id, dice').eq('round_id', roundId);
  return Object.fromEntries((data ?? []).map(r => [r.user_id as string, (r.dice ?? []) as Die[]]));
}
