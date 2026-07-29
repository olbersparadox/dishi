import { describe, it, expect, vi } from 'vitest';
import {
  updateTasteFromDuel, updateTasteFromDuelTie, bumpEvidenceFromDuel, duelContrast,
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

// ── updateTasteFromDuelTie (揀唔落) ─────────────────────────────────────────────
describe('updateTasteFromDuelTie', () => {
  it('pulls a confidently-predicted gap back toward neutral', () => {
    // Engine strongly prefers umami; a tie says "these two are actually equal" ->
    // the umami preference should shrink toward 0.
    const start: TasteVector = { ...emptyTaste(), umami: 0.8 };
    const next = updateTasteFromDuelTie(start, {}, { umami: 0.9 }, { umami: 0.3 });
    expect(next.umami).toBeLessThan(0.8);
    expect(next.umami).toBeGreaterThan(0); // nudged toward neutral, not flipped
  });

  it('is a near-no-op when the engine was already neutral (nothing to correct)', () => {
    // taste umami 0 -> p = 0.5 -> (0.5 - p) = 0 -> no movement
    const next = updateTasteFromDuelTie(emptyTaste(), {}, { umami: 0.9 }, { umami: 0.3 });
    expect(next.umami).toBeCloseTo(0, 9);
  });

  it('ignores murmur dims and is symmetric in dish order', () => {
    const a: DishVector = { umami: 0.9, spicy: 0.1 }; // spicy is murmur
    const b: DishVector = { umami: 0.3 };
    const start: TasteVector = { ...emptyTaste(), umami: 0.8 };
    const ab = updateTasteFromDuelTie(start, {}, a, b);
    const ba = updateTasteFromDuelTie(start, {}, b, a);
    expect(ab.umami).toBeCloseTo(ba.umami, 9); // order-independent
    expect(ab.spicy).toBe(0);                   // murmur taught nothing
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
const cand = (id: string, cuisine: string | null, attributes: DishVector, identityId: string | null = null, canonicalId: string | null = null): DuelCandidate =>
  ({ id, cuisine, attributes, identityId, canonicalId });

const NOW = Date.parse('2026-07-18T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();
/** An empty profile: every bet is a coin flip, so every structural survivor qualifies. */
const noTaste = {};

describe('selectDuelPair', () => {
  it('returns the qualifying same-cuisine pair', () => {
    const cands = [
      cand('x', 'cantonese', { umami: 0.9 }),
      cand('y', 'cantonese', { umami: 0.3 }),
    ];
    const pair = selectDuelPair(cands, noTaste, {}, [], { now: NOW });
    expect(pair).not.toBeNull();
    expect(new Set([pair!.a.id, pair!.b.id])).toEqual(new Set(['x', 'y']));
  });

  it('requires the same cuisine', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'japanese', { umami: 0.3 })];
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).toBeNull();
  });

  it('never pairs an unknown cuisine', () => {
    const cands = [cand('x', 'unknown', { umami: 0.9 }), cand('y', 'unknown', { umami: 0.3 })];
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).toBeNull();
  });

  it('excludes an already-answered pair regardless of stored order', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    // stored as (y, x) — the opposite order to the candidate loop. resolved covers
    // both a win and a tie (揀唔落) — either retires the pair.
    const answered: ExistingDuelRow[] = [{ dish_a: 'y', dish_b: 'x', resolved: true, served_at: daysAgo(200) }];
    expect(selectDuelPair(cands, noTaste, {}, answered, { now: NOW })).toBeNull();
  });

  it('excludes a pair served within the recency window, then lets it back after', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    const recent: ExistingDuelRow[] = [{ dish_a: 'x', dish_b: 'y', resolved: false, served_at: daysAgo(10) }];
    expect(selectDuelPair(cands, noTaste, {}, recent, { now: NOW })).toBeNull();
    const old: ExistingDuelRow[] = [{ dish_a: 'x', dish_b: 'y', resolved: false, served_at: daysAgo(40) }];
    expect(selectDuelPair(cands, noTaste, {}, old, { now: NOW })).not.toBeNull();
  });

  it('retires a dish that has hit the lifetime duel cap', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    // x already in 3 duels (with other, long-gone dishes) -> excluded
    const existing: ExistingDuelRow[] = [
      { dish_a: 'x', dish_b: 'p', resolved: true, served_at: daysAgo(200) },
      { dish_a: 'x', dish_b: 'q', resolved: true, served_at: daysAgo(180) },
      { dish_a: 'x', dish_b: 'r', resolved: true, served_at: daysAgo(160) },
    ];
    expect(selectDuelPair(cands, noTaste, {}, existing, { now: NOW })).toBeNull();
  });

  it('excludes same-identity pairs', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }, 'ident-1'), cand('y', 'cantonese', { umami: 0.3 }, 'ident-1')];
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).toBeNull();
  });

  it('excludes same-CANONICAL pairs — two renderings of one dish are an execution question, not a 對決', () => {
    // Different venues, no shared identity — only the catalog links them.
    const cands = [
      cand('x', 'cantonese', { umami: 0.9 }, null, 'ham-macaroni'),
      cand('y', 'cantonese', { umami: 0.3 }, null, 'ham-macaroni'),
    ];
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).toBeNull();
  });

  it('disqualifies a pair with no dim contrasted by at least 0.3', () => {
    // both barely differ: 0.64 vs 0.5 -> x = 0.28 < floor
    const cands = [cand('x', 'cantonese', { umami: 0.64 }), cand('y', 'cantonese', { umami: 0.5 })];
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).toBeNull();
  });
});

describe('selectDuelPair — the unresolved-bet gate (2026-07-28 redesign)', () => {
  it('heavy evidence NEVER disqualifies — the ratchet bug must stay dead', () => {
    // The old gate (a contrasting dim with evidence <= 2) returned null here and
    // could never reopen: evidence only grows. Measured live at 49 ratings it
    // killed all 374 qualifying pairs while the model's own bets were coin
    // flips. Uncertainty now comes from the BET, not the counter.
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    const heavyEvidence = { umami: 46, rich: 52, tender: 49 };
    const pair = selectDuelPair(cands, noTaste, heavyEvidence, [], { now: NOW });
    expect(pair).not.toBeNull();
  });

  it('excludes a pair the model can already call confidently (p >= band edge)', () => {
    // Two strong taste dims, dishes at opposite ends: contentScore gap ~0.36,
    // p = sigmoid(2 * 0.36) ~ 0.67 >= 0.65 — the bet is settled, asking
    // teaches nothing, the card honestly does not appear.
    const vector = { umami: 1, crispy: 1 };
    const cands = [
      cand('x', 'cantonese', { umami: 0.95, crispy: 0.95 }),
      cand('y', 'cantonese', { umami: 0.05, crispy: 0.05 }),
    ];
    expect(selectDuelPair(cands, vector, {}, [], { now: NOW })).toBeNull();
    // The same pair under an empty profile is a coin flip and qualifies.
    expect(selectDuelPair(cands, noTaste, {}, [], { now: NOW })).not.toBeNull();
  });

  it('serves the LEAST certain pair first', () => {
    // Profile knows umami; says nothing about baked. The umami pair is a
    // leaning bet (p above coin flip); the baked pair is a pure coin flip —
    // it must win selection.
    const vector = { umami: 0.8 };
    const cands = [
      cand('u1', 'cantonese', { umami: 0.9 }),
      cand('u2', 'cantonese', { umami: 0.1 }),
      cand('b1', 'french', { baked: 0.9 }),
      cand('b2', 'french', { baked: 0.2 }),
    ];
    const pair = selectDuelPair(cands, vector, {}, [], { now: NOW });
    expect(pair).not.toBeNull();
    expect(new Set([pair!.a.id, pair!.b.id])).toEqual(new Set(['b1', 'b2']));
    expect(pair!.p).toBeCloseTo(0.5, 2);
  });

  it('breaks near-ties on p by information (thin-evidence dims deserve priority)', () => {
    // Both pairs are exact coin flips under an empty profile; the crispy pair
    // contrasts a dim with far less evidence, so its info score is higher.
    const evidence = { umami: 40, crispy: 1 };
    const cands = [
      cand('u1', 'cantonese', { umami: 0.9 }),
      cand('u2', 'cantonese', { umami: 0.1 }),
      cand('c1', 'french', { crispy: 0.9 }),
      cand('c2', 'french', { crispy: 0.1 }),
    ];
    const pair = selectDuelPair(cands, noTaste, evidence, [], { now: NOW });
    expect(pair).not.toBeNull();
    expect(new Set([pair!.a.id, pair!.b.id])).toEqual(new Set(['c1', 'c2']));
  });

  it('returns the sealed-bet confidence so the route seals exactly what selection judged', () => {
    const cands = [cand('x', 'cantonese', { umami: 0.9 }), cand('y', 'cantonese', { umami: 0.3 })];
    const pair = selectDuelPair(cands, noTaste, {}, [], { now: NOW });
    expect(pair!.p).toBeGreaterThanOrEqual(0.5);
    expect(pair!.p).toBeLessThan(0.65);
  });

  it('a recent WRONG bet redirects selection to pairs re-probing its dims', () => {
    // Without rematchDims the baked pair (coin flip) wins; with crispy flagged
    // from a missed prediction, the crispy pair takes priority and is marked.
    const vector = { crispy: 0.3 };
    const cands = [
      cand('c1', 'cantonese', { crispy: 0.9 }),
      cand('c2', 'cantonese', { crispy: 0.2 }),
      cand('b1', 'french', { baked: 0.9 }),
      cand('b2', 'french', { baked: 0.2 }),
    ];
    const plain = selectDuelPair(cands, vector, {}, [], { now: NOW });
    expect(new Set([plain!.a.id, plain!.b.id])).toEqual(new Set(['b1', 'b2']));
    expect(plain!.rematch).toBe(false);

    const rematch = selectDuelPair(cands, vector, {}, [], { now: NOW, rematchDims: ['crispy'] });
    expect(new Set([rematch!.a.id, rematch!.b.id])).toEqual(new Set(['c1', 'c2']));
    expect(rematch!.rematch).toBe(true);
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
      // a WIN: teaches spicy toward the winner
      { winner: 'w', tied_at: null, answered_at: '2026-07-02T00:00:00Z', a: { id: 'w', attributes: { spicy: 0.9 } }, b: { id: 'l', attributes: { spicy: 0.1 } } },
      // an open/dismissed duel (answered_at null) — inert via the defensive guard
      { winner: null, tied_at: null, answered_at: null, a: { id: 'w', attributes: { sweet: 0.9 } }, b: { id: 'l', attributes: { sweet: 0.1 } } },
    ];

    const fakeUser: any = { from: () => makeChain(ratingData) };
    const out = await replayProfile(fakeUser, 'user-1');
    expect(out).not.toBeNull();
    expect(out!.replayed).toBe(1);           // one rating; the duel is not counted
    expect(out!.vector.umami).toBeGreaterThan(0); // from the rating
    expect(out!.vector.spicy).toBeGreaterThan(0);  // from the answered win
    expect(out!.vector.sweet).toBe(0);        // the open duel taught nothing
  });

  it('replays a tie (揀唔落) as a pull toward neutral', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    // Two ratings first push crispy strongly positive; then a tie between a
    // crispy-rich and a crispy-poor dish says "actually equal" -> crispy shrinks.
    ratingData = [
      { score: 1, voice_attributes: null, created_at: '2026-07-01T00:00:00Z', dishes: { attributes: { crispy: 0.9 }, cuisine: 'x' } },
      { score: 1, voice_attributes: null, created_at: '2026-07-02T00:00:00Z', dishes: { attributes: { crispy: 0.9 }, cuisine: 'x' } },
    ];
    const ratingsOnly: any = { from: () => makeChain(ratingData) };
    duelData = [];
    const before = (await replayProfile(ratingsOnly, 'user-1'))!.vector.crispy;

    duelData = [
      { winner: null, tied_at: '2026-07-03T00:00:00Z', answered_at: '2026-07-03T00:00:00Z', a: { id: 'a', attributes: { crispy: 0.9 } }, b: { id: 'b', attributes: { crispy: 0.3 } } },
    ];
    const after = (await replayProfile(ratingsOnly, 'user-1'))!.vector.crispy;
    expect(after).toBeLessThan(before);  // the tie pulled the learned preference down
    expect(after).toBeGreaterThan(0);    // toward neutral, not flipped
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

/**
 * 佢哋整得點？ at the replay level (2026-07-26). The pure rule is tested in
 * taste.test.ts; this pins that replay actually APPLIES it — that a passing
 * score on one instance retroactively pulls a failing sibling out of learning,
 * which is the whole 火腿通粉 fix.
 */
describe('replayProfile — execution-confounded ratings leave the learning stream', () => {
  const macaroni = { creamy: 0.9 };

  it('one bad plate still teaches — ambiguous, so the opinion stands', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0);
    expect(out!.vector.creamy).toBeLessThan(0); // the hate was learned
  });

  it('a PASSING sibling retroactively rescues the dish from the palate', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    // Same dish identity, two kitchens: one botched it (2), one did it justice (8).
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
      { dish_id: 'b', score: 0.6, execution_score: 8, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(1);          // the -0.9 was blamed on the kitchen
    expect(out!.vector.creamy).toBeGreaterThan(0); // only the honest rating taught
    // ...but the person still rated two dishes, so gates built on rating_count
    // (seal gate, export confidence) must not lose one.
    expect(out!.replayed).toBe(2);
  });

  it('two BAD instances exonerate nothing — both keep teaching', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
      { dish_id: 'b', score: -0.5, execution_score: 3, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0);
    expect(out!.vector.creamy).toBeLessThan(0);
  });

  it('two instances scoring the SAME do not cancel each other out', async () => {
    // Guards self-exclusion: the sibling rule must drop the rating's OWN row
    // (by dish_id), not every row with an equal score — else each instance
    // would look like its own passing sibling.
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: 0.35, execution_score: 7, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
      { dish_id: 'b', score: 0.35, execution_score: 7, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0); // both passing, neither confounded
  });

  it('a bad plate of a DIFFERENT dish is not rescued by an unrelated good one', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
      { dish_id: 'b', score: 0.6, execution_score: 9, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: { crispy: 0.9 }, cuisine: 'cantonese', dish_identity_id: 'ident-OTHER' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0);
    expect(out!.vector.creamy).toBeLessThan(0); // still learned, correctly
  });

  it('unscored ratings are untouched — skipping the slider must cost nothing', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: null, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
      { dish_id: 'b', score: 0.6, execution_score: 9, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-1' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0);
  });

  // ── Cross-venue: canonical_dish_id joins what per-venue identity never could ──
  // (2026-07-28, the catalog build.) dish_identity_id is scoped to ONE
  // restaurant by schema, so before the catalog these two rows could not be
  // siblings at all — the flagship 火腿通粉-at-A-vs-B comparison was
  // structurally unreachable. These pin that replay now reads the canonical
  // link, that it composes with the identity fallback, and that a lookalike
  // grouped-by-one-key implementation FAILS the mixed-pair case.

  it('CROSS-VENUE: a passing sibling at another restaurant exonerates via canonical_dish_id', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    // Different venues => different (null) dish identities; only the catalog
    // links them. 火腿通粉 botched at A, done justice at B.
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: null, canonical_dish_id: 'ham-macaroni' } },
      { dish_id: 'b', score: 0.6, execution_score: 8, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: null, canonical_dish_id: 'ham-macaroni' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(1);               // A's plate is the kitchen's fault now
    expect(out!.vector.creamy).toBeGreaterThan(0); // only B's honest rating taught
    expect(out!.replayed).toBe(2);
  });

  it('different canonical dishes at different venues stay unrelated', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    ratingData = [
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: null, canonical_dish_id: 'ham-macaroni' } },
      { dish_id: 'b', score: 0.6, execution_score: 9, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: { crispy: 0.9 }, cuisine: 'cantonese', dish_identity_id: null, canonical_dish_id: 'roast-goose' } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    expect(out!.confounded).toBe(0);
    expect(out!.vector.creamy).toBeLessThan(0);
  });

  it('MIXED PAIR: canonical and identity links compose — a partition by one key cannot pass this', async () => {
    const { replayProfile } = await import('../src/lib/replay');
    duelData = [];
    // a↔b share a canonical dish (cross-venue); a↔c share a per-venue identity
    // (same shop, second visit); b↔c share NOTHING. Sibling-ness is a graph,
    // not a partition — grouping rows under a single merged key would either
    // link b to c (wrong) or lose one of the real links.
    ratingData = [
      // The bad plate: fails at venue 1.
      { dish_id: 'a', score: -0.9, execution_score: 2, voice_attributes: null,
        created_at: '2026-07-01T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-venue1', canonical_dish_id: 'ham-macaroni' } },
      // Venue 2's rendering passes — exonerates `a` via the canonical link.
      { dish_id: 'b', score: 0.6, execution_score: 8, voice_attributes: null,
        created_at: '2026-07-02T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: null, canonical_dish_id: 'ham-macaroni' } },
      // Venue 1 again, uncovered by the catalog, FAILING — must NOT be
      // exonerated by b (they share nothing), but a's identity link sees it.
      { dish_id: 'c', score: -0.5, execution_score: 3, voice_attributes: null,
        created_at: '2026-07-03T00:00:00Z',
        dishes: { attributes: macaroni, cuisine: 'cantonese', dish_identity_id: 'ident-venue1', canonical_dish_id: null } },
    ];
    const out = await replayProfile({ from: () => makeChain(ratingData) } as any, 'user-1');
    // a: exonerated (b passed, canonical link). c: NOT exonerated — its only
    // sibling is a (identity link), and a FAILED; b is not c's sibling.
    expect(out!.confounded).toBe(1);
    expect(out!.replayed).toBe(3);
  });
});
