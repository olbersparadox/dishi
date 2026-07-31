import { describe, it, expect } from 'vitest';
import {
  viewForUser, canBid, canChallenge, turnAfter, standingBid,
  type DiceRound, type Rolls,
} from '../src/lib/tableDice';
import type { Die } from '../src/lib/liarsDice';

// The design handoff's own worked example, the same anchor liarsDice.test.ts uses:
// 你 6個四 → 陳大文 7個四 → Priya Raman 開 → 5 fours on the table → 陳大文 pays.
const ROLLS: Rolls = {
  'u-jerry': [4, 4, 1, 6, 2] as Die[],
  'u-chan': [4, 3, 2, 5, 6] as Die[],
  'u-wing': [1, 5, 3, 2, 6] as Die[],
  'u-priya': [2, 6, 3, 5, 3] as Die[],
};
const ORDER = ['u-jerry', 'u-chan', 'u-wing', 'u-priya'];

function round(over: Partial<DiceRound> = {}): DiceRound {
  return {
    id: 'r1', round: 1, direction: 'right', seat_order: ORDER,
    first_player_id: 'u-jerry', current_turn_user_id: 'u-jerry',
    bids: [], challenger_id: null, loser_id: null, actual_count: null, revealed_at: null,
    ...over,
  };
}
const bid = (user_id: string, quantity: number, face: Die) =>
  ({ user_id, quantity, face, at: '2026-07-31T12:00:00Z' });

describe('viewForUser — the hidden-state contract', () => {
  it('gives a player their own five dice and nobody else any', () => {
    const view = viewForUser(round(), ROLLS, 'u-wing');
    expect(view.yourDice).toEqual([1, 5, 3, 2, 6]);
    expect(view.reveal).toBeNull();
    // The whole claim of the game, asserted structurally: no other hand appears
    // anywhere in what this player is handed, at any depth.
    const serialized = JSON.stringify(view);
    for (const [userId, dice] of Object.entries(ROLLS)) {
      if (userId === 'u-wing') continue;
      expect(serialized).not.toContain(JSON.stringify(dice));
    }
  });

  it('gives an empty hand to someone who is not in this round', () => {
    expect(viewForUser(round(), ROLLS, 'u-stranger').yourDice).toEqual([]);
  });

  it('still hides the cups mid-round, however many bids have been made', () => {
    const mid = round({
      bids: [bid('u-jerry', 6, 4), bid('u-chan', 7, 4)],
      current_turn_user_id: 'u-wing',
    });
    expect(viewForUser(mid, ROLLS, 'u-jerry').reveal).toBeNull();
    expect(JSON.stringify(viewForUser(mid, ROLLS, 'u-jerry'))).not.toContain('[4,3,2,5,6]');
  });

  it('opens every cup at 開, with the masks the reveal dims by', () => {
    const opened = round({
      bids: [bid('u-jerry', 6, 4), bid('u-chan', 7, 4)],
      challenger_id: 'u-priya', loser_id: 'u-chan', actual_count: 5,
      revealed_at: '2026-07-31T12:05:00Z',
    });
    const view = viewForUser(opened, ROLLS, 'u-jerry');
    expect(view.reveal).not.toBeNull();
    expect(view.reveal!.rolls).toEqual(ROLLS);
    expect(view.reveal!.actual).toBe(5);
    expect(view.reveal!.loserId).toBe('u-chan');
    expect(view.reveal!.bidderId).toBe('u-chan');
    expect(view.reveal!.challengerId).toBe('u-priya');
    // 4, 4, 1 count; 6 and 2 do not.
    expect(view.reveal!.masks['u-jerry']).toEqual([true, true, true, false, false]);
  });

  it('prefers the stored count and loser over recomputing them', () => {
    // A round whose stored verdict disagrees with the dice is a bug somewhere,
    // but the screen must print the verdict the table was actually given rather
    // than quietly arguing with it.
    const opened = round({
      bids: [bid('u-chan', 7, 4)], challenger_id: 'u-priya',
      loser_id: 'u-priya', actual_count: 9, revealed_at: '2026-07-31T12:05:00Z',
    });
    const view = viewForUser(opened, ROLLS, 'u-wing');
    expect(view.reveal!.actual).toBe(9);
    expect(view.reveal!.loserId).toBe('u-priya');
  });

  it('keeps the cups shut on a revealed round with no challenger recorded', () => {
    const broken = round({ bids: [bid('u-chan', 7, 4)], revealed_at: '2026-07-31T12:05:00Z' });
    expect(viewForUser(broken, ROLLS, 'u-wing').reveal).toBeNull();
  });
});

describe('canBid', () => {
  it('lets the player whose turn it is open with anything legal', () => {
    expect(canBid(round(), 'u-jerry', { quantity: 6, face: 4 })).toBe(true);
  });

  it('refuses anyone else, however good the call', () => {
    expect(canBid(round(), 'u-chan', { quantity: 6, face: 4 })).toBe(false);
  });

  it('refuses a call that does not beat what stands', () => {
    const r = round({ bids: [bid('u-jerry', 6, 4)], current_turn_user_id: 'u-chan' });
    expect(canBid(r, 'u-chan', { quantity: 6, face: 3 })).toBe(false);
    expect(canBid(r, 'u-chan', { quantity: 6, face: 5 })).toBe(true);
    expect(canBid(r, 'u-chan', { quantity: 7, face: 2 })).toBe(true);
  });

  it('refuses a claim bigger than the table holds', () => {
    // Four players, twenty dice. 21個四 could never be wrong, or right.
    expect(canBid(round(), 'u-jerry', { quantity: 21, face: 4 })).toBe(false);
    expect(canBid(round(), 'u-jerry', { quantity: 20, face: 4 })).toBe(true);
  });

  it('refuses everyone once the round is open, and before a direction exists', () => {
    expect(canBid(round({ revealed_at: 'x' }), 'u-jerry', { quantity: 6, face: 4 })).toBe(false);
    expect(canBid(round({ direction: null }), 'u-jerry', { quantity: 6, face: 4 })).toBe(false);
  });
});

describe('canChallenge', () => {
  const live = round({ bids: [bid('u-jerry', 6, 4), bid('u-chan', 7, 4)], current_turn_user_id: 'u-wing' });

  it('is open to anyone at the table, in turn or not', () => {
    // Priya opening while Wing still hadn't gone is the handoff's own scenario.
    expect(canChallenge(live, 'u-priya')).toBe(true);
    expect(canChallenge(live, 'u-wing')).toBe(true);
  });

  it('is closed to whoever made the standing bid', () => {
    expect(canChallenge(live, 'u-chan')).toBe(false);
  });

  it('is closed before anyone has called, and after the reveal', () => {
    expect(canChallenge(round(), 'u-chan')).toBe(false);
    expect(canChallenge(round({ ...live, revealed_at: 'x' }), 'u-priya')).toBe(false);
  });

  it('is closed to someone who is not at this table', () => {
    expect(canChallenge(live, 'u-stranger')).toBe(false);
  });
});

describe('turnAfter / standingBid', () => {
  it('walks the seating order in the round’s own direction', () => {
    expect(turnAfter(round(), 'u-jerry')).toBe('u-chan');
    expect(turnAfter(round({ direction: 'left' }), 'u-jerry')).toBe('u-priya');
  });

  it('has no next player before a direction is picked', () => {
    expect(turnAfter(round({ direction: null }), 'u-jerry')).toBeNull();
  });

  it('reads the last call as the one to beat', () => {
    expect(standingBid(round())).toBeNull();
    expect(standingBid(round({ bids: [bid('u-jerry', 6, 4), bid('u-chan', 7, 4)] }))!.quantity).toBe(7);
  });
});
