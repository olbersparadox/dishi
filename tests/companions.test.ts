import { describe, it, expect } from 'vitest';
import { canonicalPair, edgeRowsForPick, edgeRowsForJoin, companionStats, type CompanionEdgeView } from '../src/lib/companions';

// Table Mode item 4 — the pure half of the 同檯 companion-edges layer. The
// privacy-critical parts (RLS, admin-only writes) live in the DB and were
// proven with rolled-back dry runs at migration time; what's tested here is
// the pair/aggregation logic every write path shares.

const A = 'aaaaaaaa-0000-0000-0000-000000000000';
const B = 'bbbbbbbb-0000-0000-0000-000000000000';
const C = 'cccccccc-0000-0000-0000-000000000000';
const D = 'dddddddd-0000-0000-0000-000000000000';
const SESSION = 'ffffffff-0000-0000-0000-000000000000';

describe('canonicalPair', () => {
  it('orders the pair user_a < user_b regardless of argument order', () => {
    expect(canonicalPair(B, A)).toEqual([A, B]);
    expect(canonicalPair(A, B)).toEqual([A, B]);
  });
  it('refuses a self-pair — a user is never their own companion', () => {
    expect(canonicalPair(A, A)).toBeNull();
  });
});

describe('edgeRowsForPick', () => {
  it('writes every member pair per dish (communal-dining semantics), canonically ordered', () => {
    const rows = edgeRowsForPick([C, A, B], ['dish1'], SESSION);
    expect(rows).toHaveLength(3); // C(3,2)
    const pairs = rows.map(r => `${r.user_a}|${r.user_b}`).sort();
    expect(pairs).toEqual([`${A}|${B}`, `${A}|${C}`, `${B}|${C}`]);
    for (const r of rows) {
      expect(r.user_a < r.user_b).toBe(true);
      expect(r.table_session_id).toBe(SESSION);
      expect(r.picked_at).toBeUndefined(); // pick-time: DB default now()
    }
  });
  it('multiplies pairs across a batch of dishes', () => {
    expect(edgeRowsForPick([A, B], ['d1', 'd2', 'd3'], SESSION)).toHaveLength(3);
  });
  it('a solo table produces no edges — nothing to link', () => {
    expect(edgeRowsForPick([A], ['d1'], SESSION)).toEqual([]);
    expect(edgeRowsForPick([A, A], ['d1'], SESSION)).toEqual([]); // dupes collapse first
  });
});

describe('edgeRowsForJoin', () => {
  it('back-fills only pairs involving the new member, with the PICK time preserved', () => {
    const rows = edgeRowsForJoin(D, [A, B], [{ id: 'd1', created_at: '2026-07-21T10:00:00Z' }], SESSION);
    expect(rows).toHaveLength(2); // (D,A), (D,B) — never (A,B), which pick time already wrote
    expect(rows.every(r => r.user_a === D || r.user_b === D)).toBe(true);
    expect(rows.every(r => r.picked_at === '2026-07-21T10:00:00Z')).toBe(true);
  });
  it('excludes the joiner from the others list (idempotent re-join calls)', () => {
    expect(edgeRowsForJoin(D, [D, A], [{ id: 'd1' }], SESSION)).toHaveLength(1);
  });
});

const edge = (over: Partial<CompanionEdgeView>): CompanionEdgeView => ({
  other: B, dish_id: 'd1', table_session_id: SESSION, picked_at: '2026-07-21T10:00:00Z', ...over,
});

describe('companionStats', () => {
  it('counts distinct dishes, distinct sessions as meals, and named cuisines', () => {
    const stats = companionStats([
      edge({ dish_id: 'd1', cuisine: 'cantonese' }),
      edge({ dish_id: 'd2', cuisine: 'japanese' }),
      edge({ dish_id: 'd2', cuisine: 'japanese' }), // duplicate dish -> counted once
      edge({ dish_id: 'd3', table_session_id: 'other-session', cuisine: 'unknown' }),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ userId: B, dishCount: 3, mealCount: 2 });
    expect(stats[0].cuisines.sort()).toEqual(['cantonese', 'japanese']); // 'unknown' excluded
  });
  it('a cleaned-up (null) session still proves at least one shared meal', () => {
    const stats = companionStats([edge({ table_session_id: null })]);
    expect(stats[0].mealCount).toBe(1);
  });
  it('sorts companions by shared dishes, and keeps the earliest shared pick', () => {
    const stats = companionStats([
      edge({ other: C, dish_id: 'd1', picked_at: '2026-07-20T09:00:00Z' }),
      edge({ other: B, dish_id: 'd2', picked_at: '2026-07-21T10:00:00Z' }),
      edge({ other: B, dish_id: 'd3', picked_at: '2026-07-19T08:00:00Z' }),
    ]);
    expect(stats.map(s => s.userId)).toEqual([B, C]);
    expect(stats[0].firstSharedAt).toBe('2026-07-19T08:00:00Z');
  });
});
