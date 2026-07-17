import { describe, it, expect, vi } from 'vitest';
import {
  updateTasteFromDuel, bumpEvidenceFromDuel, duelContrast,
  DUEL_WEIGHT, emptyTaste, type DishVector, type TasteVector,
} from '../src/lib/taste';
import { selectDuelPair, type DuelCandidate, type ExistingDuelRow } from '../src/lib/duels';

// ── duelContrast ───────────────────────────────────────────────────────────────
describe('duelContrast', () => {
  it('centers presence and returns the signed winner−loser difference', () => {
    // umami: winner 0.9 -> centered 0.8, loser 0.5 -> centered 0.0, x = 0.8
    const c = duelContrast({ umami: 0.9 }, { umami: 0.5 });
    expect(c).toEqual([{ dim: 'umami', x: expect.closeTo(0.8, 6) }]);
  });

  it('treats below-cutoff (murmur) and absent dims as 0 presence', () => {
    // winner spicy 0.1 is model murmur (< LEARN_CUTOFF) -> 0; loser has none -> 0
    expect(duelContrast({ spicy: 0.1 }, {})).toEqual([]);
    // only the winner genuinely reports umami; loser absent -> centered 0
    expect(duelContrast({ umami: 0.8 }, {})).toEqual([{ dim: 'umami', x: expect.closeTo(0.6, 6) }]);
  });

  it('omits dims with zero net contrast', () => {
    expect(duelContrast({ umami: 0.8 }, { umami: 0.8 })).toEqual([]);
  });
});

// ── updateTasteFromDuel ─────────────────────────────────────────────────────────
describe('updateTasteFromDuel', () => {
  it('moves a contrasted dim toward the winner', () => {
    const next = updateTasteFromDuel(emptyTaste(), {}, { umami: 0.9 }, { umami: 0.3 });
    expect(next.umami).toBeGreaterThan(0); // winner was umami-rich -> preference rises
  });

  it('scales by surprise: an upset moves more than a confident-correct outcome', () => {
    const winner: DishVector = { spicy: 0.9 };
    const loser: DishVector = { spicy: 0.1 }; // below cutoff -> loser contributes 0
    // Confident: the user already leans toward the winner's attribute.
    const confident = updateTasteFromDuel({ ...emptyTaste(), spicy: 0.3 }, {}, winner, loser);
    // Upset: the user leaned the OTHER way, yet chose the spicy dish.
    const upset = updateTasteFromDuel({ ...emptyTaste(), spicy: -0.3 }, {}, winner, loser);
    const confidentMove = Math.abs(confident.spicy - 0.3);
    const upsetMove = Math.abs(upset.spicy - (-0.3));
    expect(upsetMove).toBeGreaterThan(confidentMove);
  });

  it('ignores murmur dims (below cutoff teaches nothing)', () => {
    const next = updateTasteFromDuel(emptyTaste(), {}, { spicy: 0.1 }, { sweet: 0.05 });
    // no dim cleared the cutoff on either side -> vector unchanged
    expect(next).toEqual(emptyTaste());
  });

  it('clamps to [-1, 1]', () => {
    const next = updateTasteFromDuel({ ...emptyTaste(), umami: 0.99 }, {}, { umami: 1 }, { umami: 0 });
    expect(next.umami).toBeLessThanOrEqual(1);
    expect(next.umami).toBeGreaterThan(0.99); // moved up, but capped
  });

  it('is a no-op for an empty-contrast (identical) pair', () => {
    const start: TasteVector = { ...emptyTaste(), umami: 0.4, spicy: -0.2 };
    expect(updateTasteFromDuel(start, {}, { umami: 0.8, spicy: 0.8 }, { umami: 0.8, spicy: 0.8 })).toEqual(start);
  });

  it('decays the step as evidence accumulates', () => {
    const fresh = updateTasteFromDuel(emptyTaste(), {}, { umami: 0.9 }, { umami: 0.3 });
    const seasoned = updateTasteFromDuel(emptyTaste(), { umami: 20 }, { umami: 0.9 }, { umami: 0.3 });
    expect(fresh.umami).toBeGreaterThan(seasoned.umami);
  });
});

// ── bumpEvidenceFromDuel ────────────────────────────────────────────────────────
describe('bumpEvidenceFromDuel', () => {
  it('bumps only dims contrasted by at least 0.3', () => {
    // umami: 0.9 vs absent -> x = 0.8 (>= 0.3, bumps)
    // sweet: 0.64 vs absent -> x = 0.28 (< 0.3, no bump)
    const ev = bumpEvidenceFromDuel({}, { umami: 0.9, sweet: 0.64 }, {});
    expect(ev.umami).toBe(1);
    expect(ev.sweet).toBeUndefined();
  });

  it('accumulates onto existing evidence', () => {
    const ev = bumpEvidenceFromDuel({ umami: 4 }, { umami: 0.9 }, { umami: 0.3 });
    expect(ev.umami).toBe(5);
  });
});

// ── selectDuelPair ──────────────────────────────────────────────────────────────
const cand = (id: string, cuisine: string | null, attributes: DishVector, identityId: string | null = null): DuelCandidate =>
  ({ id, cuisine, attributes, identityId });

const NOW = Date.parse('2026-07-18T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('selectDuelPair', () => {
  it('returns the qualifying same-cuisine pair with the most information', () => {
    const cands = [
      cand('x', 'cantonese', { umami: 0.9 }),
      cand('y', 'cantonese', { umami: 0.3 }),
    ];
    const pair = selectDuelPair(cands, {}, [], NOW);
    expect(pair).not.toBeNull();
    expect(new Set([pair!.a.id, pair!.b.id])).toEqual(new Set(['x', 'y']));
  });

  it('requires the same cuisine', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'japanese', { umami: 0.3 })];
    expect(selectDuelPair(cands, {}, [], NOW)).toBeNull();
  });

  it('never pairs an unknown cuisine', () => {
    const cands = [cand('x', 'unknown', { umami: 0.9 }), cand('y', 'unknown', { umami: 0.3 })];
    expect(selectDuelPair(cands, {}, [], NOW)).toBeNull();
  });

  it('excludes an already-answered pair regardless of stored order', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    // stored as (y, x) — the opposite order to the candidate loop
    const answered: ExistingDuelRow[] = [{ dish_a: 'y', dish_b: 'x', winner: 'y', served_at: daysAgo(200), skipped_at: null }];
    expect(selectDuelPair(cands, {}, answered, NOW)).toBeNull();
  });

  it('excludes a pair served within the recency window, then lets it back after', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    const recent: ExistingDuelRow[] = [{ dish_a: 'x', dish_b: 'y', winner: null, served_at: daysAgo(10), skipped_at: null }];
    expect(selectDuelPair(cands, {}, recent, NOW)).toBeNull();
    const old: ExistingDuelRow[] = [{ dish_a: 'x', dish_b: 'y', winner: null, served_at: daysAgo(40), skipped_at: null }];
    expect(selectDuelPair(cands, {}, old, NOW)).not.toBeNull();
  });

  it('retires a dish that has hit the lifetime duel cap', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    // x already in 3 duels (with other, long-gone dishes) -> excluded
    const existing: ExistingDuelRow[] = [
      { dish_a: 'x', dish_b: 'p', winner: 'x', served_at: daysAgo(200), skipped_at: null },
      { dish_a: 'x', dish_b: 'q', winner: 'q', served_at: daysAgo(180), skipped_at: null },
      { dish_a: 'x', dish_b: 'r', winner: 'x', served_at: daysAgo(160), skipped_at: null },
    ];
    expect(selectDuelPair(cands, {}, existing, NOW)).toBeNull();
  });

  it('excludes same-identity pairs', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }, 'ident-1'), cand('y', 'cantonese', { umami: 0.3 }, 'ident-1')];
    expect(selectDuelPair(cands, {}, [], NOW)).toBeNull();
  });

  it('disqualifies a pair whose only contrast is on a well-known dim', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    // umami already has plenty of evidence (> uncertainty threshold) -> nothing to learn
    expect(selectDuelPair(cands, { umami: 8 }, [], NOW)).toBeNull();
  });

  it('disqualifies a pair with no dim contrasted by at least 0.3', () => {
    // both barely differ: 0.64 vs 0.5 -> x = 0.28 < floor
    const cands = [cand('x', 'cantonese', { umami: 0.64 }), cand('y', 'cantonese', { umami: 0.5 })];
    expect(selectDuelPair(cands, {}, [], NOW)).toBeNull();
  });
});

// ── replayProfile merged timeline (logic-level, Supabase mocked) ────────────────
vi.mock('../src/lib/supabase/server', () => ({
  supabaseAdmin: () => makeChain(duelData),
}));

// Mutable holders the mock reads from, so each test can set the canned rows.
let ratingData: any[] = [];
let duelData: any[] = [];

/** A minimal chainable query stub: every builder method returns itself, and the
 * object is awaitable, resolving to { data, error }. */
function makeChain(rows: any[]) {
  const c: any = {
    from: () => c, select: () => c, eq: () => c, order: () => c, not: () => c,
    then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
  };
  return c;
}

describe('replayProfile (merged ratings + duels)', () => {
  it('applies answered duels, ignores unanswered ones, and counts only ratings in `replayed`', async () => {
    const { replayProfile } = await import('../src/lib/replay');

    ratingData = [
      { score: 1, voice_attributes: null, created_at: '2026-07-01T00:00:00Z', dishes: { attributes: { umami: 0.8 }, cuisine: 'cantonese' } },
    ];
    duelData = [
      // answered: teaches spicy toward the winner
      { winner: 'w', answered_at: '2026-07-02T00:00:00Z', a: { id: 'w', attributes: { spicy: 0.9 } }, b: { id: 'l', attributes: { spicy: 0.1 } } },
      // unanswered leftover (winner null) — the query filter would drop it live; the
      // defensive guard drops it here too. Must be inert.
      { winner: null, answered_at: null, a: { id: 'w', attributes: { sweet: 0.9 } }, b: { id: 'l', attributes: { sweet: 0.1 } } },
    ];

    const fakeUser: any = { from: () => makeChain(ratingData) };
    const out = await replayProfile(fakeUser, 'user-1');
    expect(out).not.toBeNull();
    expect(out!.replayed).toBe(1);           // one rating; the duel is not counted
    expect(out!.vector.umami).toBeGreaterThan(0); // from the rating
    expect(out!.vector.spicy).toBeGreaterThan(0);  // from the answered duel
    expect(out!.vector.sweet).toBe(0);        // the unanswered duel taught nothing
  });

  it('orders events by time so a later rating and an earlier duel both land', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    ratingData = [
      { score: 1, voice_attributes: null, created_at: '2026-07-05T00:00:00Z', dishes: { attributes: { umami: 0.8 }, cuisine: 'cantonese' } },
    ];
    duelData = [
      { winner: 'w', answered_at: '2026-07-03T00:00:00Z', a: { id: 'w', attributes: { umami: 0.9 } }, b: { id: 'l', attributes: { umami: 0.3 } } },
    ];
    const fakeUser: any = { from: () => makeChain(ratingData) };
    const out = await replayProfile(fakeUser, 'user-1');
    // Duel first (earlier), then rating — both push umami up; net positive.
    expect(out!.vector.umami).toBeGreaterThan(0);
    expect(out!.replayed).toBe(1);
  });
});
