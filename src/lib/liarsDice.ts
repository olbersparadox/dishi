// 大話骰 — the rules, and nothing else.
//
// The third way a table settles its bill (平均分攤 / 隨機一人 / 大話骰). Five dice
// each, hidden in your own cup; players bid in turn on how many of a face are on
// the WHOLE table; someone calls 開 and everyone lifts. Whoever was wrong pays.
//
// Pure functions here because the interesting failure of this game is not a
// layout bug, it is a rule the client and the server disagree about — and money
// (well, a $216 bill) rides on the disagreement. Every rule below is exercised
// by tests/liarsDice.test.ts, and the API routes are the only thing allowed to
// hold the dice.
//
// THE HIDDEN-STATE CONTRACT, same shape as the sealed bet: a player's dice live
// server-side and are returned to that player alone. Nothing here takes a whole
// table's rolls and hands them to a caller; resolveChallenge does, and it runs
// only at 開, which is the moment every cup is on the table anyway.

export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export const DICE_PER_PLAYER = 5;

export type Bid = {
  /** How many of `face` the bidder claims are on the table, across every cup. */
  quantity: number;
  face: Die;
};

/**
 * 1s are wild and count toward any other face. The one exception is a bid ON
 * 1s: if you have claimed there are four 1s, the 1s are the subject of the
 * claim and cannot also be substitutes for themselves.
 */
export function countFace(dice: Die[], face: Die): number {
  return dice.filter(d => d === face || (face !== 1 && d === 1)).length;
}

/** Which dice in a hand actually count toward `face` — the reveal screen dims
 *  the rest rather than printing an equation, so it needs the mask, not a sum. */
export function countingMask(dice: Die[], face: Die): boolean[] {
  return dice.map(d => d === face || (face !== 1 && d === 1));
}

/**
 * A raise must be strictly bigger: more dice, or the same number of a higher
 * face. Deliberately a total order over (quantity, face) rather than "any
 * change" — without it a table can loop 四 → 五 → 四 forever and the round
 * never reaches a challenge.
 */
export function isRaise(next: Bid, previous: Bid | null): boolean {
  if (!isLegalBid(next)) return false;
  if (!previous) return true;
  if (next.quantity !== previous.quantity) return next.quantity > previous.quantity;
  return next.face > previous.face;
}

/** A bid has to be claimable at all: at least one die, never more dice than the
 *  table actually holds. `totalDice` is players × DICE_PER_PLAYER. */
export function isLegalBid(bid: Bid, totalDice?: number): boolean {
  if (!Number.isInteger(bid.quantity) || bid.quantity < 1) return false;
  if (!Number.isInteger(bid.face) || bid.face < 1 || bid.face > 6) return false;
  return totalDice === undefined || bid.quantity <= totalDice;
}

export type Challenge = {
  /** What was on the table when 開 was called. */
  bid: Bid;
  /** Who made that bid. */
  bidderId: string;
  /** Who called 開. */
  challengerId: string;
  /** Every cup, revealed. This is the only function that sees them all. */
  rolls: Record<string, Die[]>;
};

export type Outcome = {
  /** Actual count of the bid face across the table, wild 1s included. */
  actual: number;
  /** True when the table really did hold at least what was claimed. */
  bidStood: boolean;
  /** Who pays. The bidder if the claim was short, the challenger if it held. */
  loserId: string;
  /** Per player, which of their dice counted — for the reveal's dimming. */
  masks: Record<string, boolean[]>;
};

/**
 * 開. The bid stands if the table holds AT LEAST what was claimed — bidding
 * "four 四" when there are five is a true statement, not an overreach, so the
 * challenger is the one who was wrong. Getting this boundary backwards makes
 * the game quietly unfair in a way nobody notices until someone is out $216.
 */
export function resolveChallenge(c: Challenge): Outcome {
  const all = Object.values(c.rolls).flat();
  const actual = countFace(all, c.bid.face);
  const bidStood = actual >= c.bid.quantity;
  const masks: Record<string, boolean[]> = {};
  for (const [userId, dice] of Object.entries(c.rolls)) {
    masks[userId] = countingMask(dice, c.bid.face);
  }
  return { actual, bidStood, loserId: bidStood ? c.challengerId : c.bidderId, masks };
}

export type Direction = 'left' | 'right';

/**
 * Whose turn comes after `currentId`. The first player picks which way the
 * bidding travels (向左/向右), so the order is the seating order or its
 * reverse — never a re-sort, which would move people mid-round.
 */
export function nextPlayer(order: string[], currentId: string, direction: Direction): string | null {
  const i = order.indexOf(currentId);
  if (i < 0 || order.length === 0) return null;
  const step = direction === 'right' ? 1 : -1;
  return order[(i + step + order.length) % order.length];
}

/**
 * A fresh hand. Takes its randomness as an argument so a round can be replayed
 * from a seed in a test, and so the caller decides the source — the API route
 * passes a crypto-backed one, since a predictable roll is a way to cheat rather
 * than merely a flaky test.
 */
export function rollDice(random: () => number, count: number = DICE_PER_PLAYER): Die[] {
  return Array.from({ length: count }, () => (Math.floor(random() * 6) + 1) as Die);
}
