// The round, as one table's shared state — and the chokepoint that decides what
// each player is allowed to see of it.
//
// liarsDice.ts holds the rules. This holds the ROUND: who is at the table, whose
// turn it is, what has been called, and — the part that matters — the single
// function that turns a stored round plus every cup into the view ONE player
// gets. Everything the client ever learns about the dice comes through
// viewForUser, so there is exactly one place to read when asking "can a player
// see someone else's dice yet?". The answer has to stay: not until 開.
import {
  DICE_PER_PLAYER, isLegalBid, isRaise, nextPlayer, resolveChallenge,
  type Bid, type Die, type Direction,
} from '@/lib/liarsDice';

/** A call, as stored in the round's append-only `bids` array. */
export type BidRecord = Bid & { user_id: string; at: string };

/** The stored round, straight off table_dice_rounds. */
export type DiceRound = {
  id: string;
  round: number;
  direction: Direction | null;
  seat_order: string[];
  first_player_id: string;
  current_turn_user_id: string | null;
  bids: BidRecord[];
  challenger_id: string | null;
  loser_id: string | null;
  actual_count: number | null;
  revealed_at: string | null;
};

/** What every cup holds, keyed by player. Server-side only until 開. */
export type Rolls = Record<string, Die[]>;

/** The reveal, assembled once and shared — the only shape that carries more than
 *  one player's dice, and it exists only after someone has called 開. */
export type DiceReveal = {
  rolls: Rolls;
  /** Which of each player's dice count toward the challenged face. The reveal
   *  screen dims the rest rather than printing an equation (owner, 2026-07-31). */
  masks: Record<string, boolean[]>;
  bid: Bid;
  bidderId: string;
  challengerId: string;
  actual: number;
  loserId: string;
};

/** One player's whole view of the round. Note what is NOT here before the
 *  reveal: any dice but their own. */
export type DiceGameView = {
  round: number;
  direction: Direction | null;
  order: string[];
  firstPlayerId: string;
  currentTurnUserId: string | null;
  bids: BidRecord[];
  /** Your five, and nobody else's. */
  yourDice: Die[];
  reveal: DiceReveal | null;
};

/** The bid a raise has to beat, or null when nobody has opened yet. */
export function standingBid(round: DiceRound): BidRecord | null {
  return round.bids.length ? round.bids[round.bids.length - 1] : null;
}

/**
 * THE contract. Give it the round, every cup, and who is asking; it returns what
 * that player may know. Before the reveal it copies exactly one hand — theirs.
 *
 * Written as a pure function taking all the rolls rather than as a query that
 * fetches only the caller's, because the reveal needs all of them and a second
 * code path is how the two would eventually disagree. The filtering is here, in
 * the open, with a test that fails if it ever stops filtering.
 */
export function viewForUser(round: DiceRound, rolls: Rolls, userId: string): DiceGameView {
  const base: DiceGameView = {
    round: round.round,
    direction: round.direction,
    order: round.seat_order,
    firstPlayerId: round.first_player_id,
    currentTurnUserId: round.current_turn_user_id,
    bids: round.bids,
    yourDice: rolls[userId] ?? [],
    reveal: null,
  };
  if (!round.revealed_at) return base;

  const bid = standingBid(round);
  // A revealed round always has a bid and a challenger (nothing else can reveal
  // it), but the row is nullable in SQL — a half-written round shows its cups
  // rather than crashing the screen everyone at the table is staring at.
  if (!bid || !round.challenger_id) return base;
  const outcome = resolveChallenge({
    bid: { quantity: bid.quantity, face: bid.face },
    bidderId: bid.user_id,
    challengerId: round.challenger_id,
    rolls,
  });
  return {
    ...base,
    reveal: {
      rolls,
      masks: outcome.masks,
      bid: { quantity: bid.quantity, face: bid.face },
      bidderId: bid.user_id,
      challengerId: round.challenger_id,
      // The stored count wins over the recomputed one: the server wrote it at 開,
      // and a screen that recomputed a different number would be arguing with the
      // verdict it is printing underneath.
      actual: round.actual_count ?? outcome.actual,
      loserId: round.loser_id ?? outcome.loserId,
    },
  };
}

/** Whether `userId` may raise right now: their turn, round still live, the call
 *  beats what stands, and it claims no more dice than the table actually holds
 *  (a bid of 40個四 at a four-person table is unbeatable and unloseable). */
export function canBid(round: DiceRound, userId: string, bid: Bid): boolean {
  if (round.revealed_at || !round.direction) return false;
  if (round.current_turn_user_id !== userId) return false;
  if (!isLegalBid(bid, round.seat_order.length * DICE_PER_PLAYER)) return false;
  const standing = standingBid(round);
  return isRaise(bid, standing ? { quantity: standing.quantity, face: standing.face } : null);
}

/**
 * Whether `userId` may call 開 right now. Deliberately NOT turn-gated: at a real
 * table anyone who thinks the call is a lie says so immediately, and the design's
 * own scenario has Priya opening while Wing still hadn't gone. The one person who
 * cannot is whoever made the standing bid — challenging your own claim is either
 * a misclick or a way to hand the bill to nobody.
 */
export function canChallenge(round: DiceRound, userId: string): boolean {
  if (round.revealed_at) return false;
  const standing = standingBid(round);
  if (!standing) return false;
  return standing.user_id !== userId && round.seat_order.includes(userId);
}

/** Who bids after `userId`, in the direction this round settled on. */
export function turnAfter(round: DiceRound, userId: string): string | null {
  if (!round.direction) return null;
  return nextPlayer(round.seat_order, userId, round.direction);
}
