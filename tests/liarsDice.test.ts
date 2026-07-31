import { describe, it, expect } from 'vitest';
import {
  countFace, countingMask, isRaise, isLegalBid, resolveChallenge, nextPlayer, rollDice,
  type Die,
} from '../src/lib/liarsDice';

// The design handoff's own worked example, kept verbatim as the anchor case:
// 你 6個四 → 陳大文 7個四 → Priya Raman 開 → 5 fours on the table → 陳大文 pays.
const HANDOFF_ROLLS: Record<string, Die[]> = {
  'u-jerry': [4, 4, 1, 6, 2],
  'u-chan': [4, 3, 2, 5, 6],
  'u-wing': [1, 5, 3, 2, 6],
  'u-priya': [2, 6, 3, 5, 3],
};

describe('countFace', () => {
  it('counts the face itself plus wild 1s', () => {
    expect(countFace([4, 4, 1, 6, 2], 4)).toBe(3);
    expect(countFace([1, 5, 3, 2, 6], 4)).toBe(1);
  });

  it('does NOT let 1s substitute for themselves when 1 is the bid face', () => {
    // Four 1s and a 6 is four 1s, not eight.
    expect(countFace([1, 1, 1, 1, 6], 1)).toBe(4);
  });

  it('counts nothing when the face is absent and no 1s are held', () => {
    expect(countFace([2, 3, 5, 6, 2], 4)).toBe(0);
  });
});

describe('countingMask', () => {
  it('marks exactly the dice that count, for the reveal dimming', () => {
    expect(countingMask([4, 4, 1, 6, 2], 4)).toEqual([true, true, true, false, false]);
  });

  it('stops marking 1s when 1 is the bid face', () => {
    expect(countingMask([1, 4, 1, 6, 2], 1)).toEqual([true, false, true, false, false]);
  });

  it('agrees with countFace on every face', () => {
    for (let f = 1; f <= 6; f++) {
      const face = f as Die;
      for (const dice of Object.values(HANDOFF_ROLLS)) {
        expect(countingMask(dice, face).filter(Boolean).length).toBe(countFace(dice, face));
      }
    }
  });
});

describe('isLegalBid', () => {
  it('rejects nonsense quantities and faces', () => {
    expect(isLegalBid({ quantity: 0, face: 4 })).toBe(false);
    expect(isLegalBid({ quantity: 2.5, face: 4 })).toBe(false);
    expect(isLegalBid({ quantity: 3, face: 7 as Die })).toBe(false);
    expect(isLegalBid({ quantity: 3, face: 0 as Die })).toBe(false);
  });

  it('refuses to claim more dice than the table holds', () => {
    expect(isLegalBid({ quantity: 20, face: 4 }, 20)).toBe(true);
    expect(isLegalBid({ quantity: 21, face: 4 }, 20)).toBe(false);
  });
});

describe('isRaise', () => {
  it('opens on any legal bid', () => {
    expect(isRaise({ quantity: 6, face: 4 }, null)).toBe(true);
  });

  it('accepts more dice, or the same dice at a higher face', () => {
    expect(isRaise({ quantity: 7, face: 4 }, { quantity: 6, face: 4 })).toBe(true);
    expect(isRaise({ quantity: 6, face: 5 }, { quantity: 6, face: 4 })).toBe(true);
  });

  it('rejects a sideways or backward move, so a round cannot loop forever', () => {
    expect(isRaise({ quantity: 6, face: 4 }, { quantity: 6, face: 4 })).toBe(false);
    expect(isRaise({ quantity: 6, face: 3 }, { quantity: 6, face: 4 })).toBe(false);
    expect(isRaise({ quantity: 5, face: 6 }, { quantity: 6, face: 4 })).toBe(false);
  });

  it('treats a higher quantity as a raise even at a lower face', () => {
    expect(isRaise({ quantity: 7, face: 2 }, { quantity: 6, face: 6 })).toBe(true);
  });
});

describe('resolveChallenge', () => {
  it('reproduces the handoff example: 5 fours under a 7個四 call, bidder pays', () => {
    const out = resolveChallenge({
      bid: { quantity: 7, face: 4 },
      bidderId: 'u-chan', challengerId: 'u-priya', rolls: HANDOFF_ROLLS,
    });
    expect(out.actual).toBe(5);
    expect(out.bidStood).toBe(false);
    expect(out.loserId).toBe('u-chan');
  });

  it('makes the CHALLENGER pay when the table holds the claim exactly', () => {
    // Exactly 5 fours against a 5個四 call: "at least" is satisfied, so calling
    // 開 was the mistake. This boundary is the whole fairness of the game.
    const out = resolveChallenge({
      bid: { quantity: 5, face: 4 },
      bidderId: 'u-chan', challengerId: 'u-priya', rolls: HANDOFF_ROLLS,
    });
    expect(out.actual).toBe(5);
    expect(out.bidStood).toBe(true);
    expect(out.loserId).toBe('u-priya');
  });

  it('makes the challenger pay when the table holds MORE than claimed', () => {
    const out = resolveChallenge({
      bid: { quantity: 3, face: 4 },
      bidderId: 'u-chan', challengerId: 'u-priya', rolls: HANDOFF_ROLLS,
    });
    expect(out.bidStood).toBe(true);
    expect(out.loserId).toBe('u-priya');
  });

  it('returns a per-player mask matching each hand', () => {
    const out = resolveChallenge({
      bid: { quantity: 7, face: 4 },
      bidderId: 'u-chan', challengerId: 'u-priya', rolls: HANDOFF_ROLLS,
    });
    expect(out.masks['u-jerry']).toEqual([true, true, true, false, false]);
    expect(out.masks['u-priya']).toEqual([false, false, false, false, false]);
    const marked = Object.values(out.masks).flat().filter(Boolean).length;
    expect(marked).toBe(out.actual);
  });
});

describe('nextPlayer', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('travels the seating order in the chosen direction', () => {
    expect(nextPlayer(order, 'b', 'right')).toBe('c');
    expect(nextPlayer(order, 'b', 'left')).toBe('a');
  });

  it('wraps at both ends', () => {
    expect(nextPlayer(order, 'd', 'right')).toBe('a');
    expect(nextPlayer(order, 'a', 'left')).toBe('d');
  });

  it('handles a two-person table, where both directions are the same person', () => {
    expect(nextPlayer(['a', 'b'], 'a', 'right')).toBe('b');
    expect(nextPlayer(['a', 'b'], 'a', 'left')).toBe('b');
  });

  it('returns null for someone who is not at the table', () => {
    expect(nextPlayer(order, 'zz', 'right')).toBe(null);
  });
});

describe('rollDice', () => {
  it('produces five dice in range', () => {
    const dice = rollDice(Math.random);
    expect(dice).toHaveLength(5);
    for (const d of dice) expect(d).toBeGreaterThanOrEqual(1), expect(d).toBeLessThanOrEqual(6);
  });

  it('is driven entirely by the passed randomness, so a round can be replayed', () => {
    const seq = [0, 0.2, 0.4, 0.6, 0.99];
    let i = 0;
    expect(rollDice(() => seq[i++])).toEqual([1, 2, 3, 4, 6]);
  });

  it('can reach every face', () => {
    const seen = new Set<number>();
    let i = 0;
    const seq = [0.01, 0.2, 0.35, 0.55, 0.7, 0.95];
    for (const d of rollDice(() => seq[i++ % seq.length], 6)) seen.add(d);
    expect(seen.size).toBe(6);
  });
});
