import { describe, it, expect, vi, beforeEach } from 'vitest';

// The adjudicator (gate 2) is an LLM call — mocked so these tests pin down the
// RECONCILE logic's behaviour around it: when it is consulted, when it is not,
// and what its verdict is allowed to cause.
vi.mock('../src/lib/dishMatch', () => ({
  adjudicateSameDish: vi.fn(),
}));
import { adjudicateSameDish } from '../src/lib/dishMatch';
import { applyOwnerMenuAuthority, propagateIdentityNameToDishes } from '../src/lib/ownerMenuReconcile';
import { AUTHORITY_OWNER, AUTHORITY_MENU } from '../src/lib/dishIdentity';

const adjudicate = adjudicateSameDish as unknown as ReturnType<typeof vi.fn>;

type Row = Record<string, any>;
type Update = { table: string; payload: Row; filters: Row };

/**
 * Minimal chainable stand-in for the supabase admin client — just enough surface
 * for what applyOwnerMenuAuthority/propagateIdentityNameToDishes actually call
 * (from → select/update → eq… → await). Select answers come from fixtures (with
 * eq('id', …) honoured for the onlyIdentityId path); every update is recorded
 * with its filters so tests assert on WRITES, the thing that matters here.
 */
function makeAdmin(fixtures: { menuItems: Row[]; identities: Row[] }) {
  const updates: Update[] = [];
  const client = {
    from(table: string) {
      const filters: Row = {};
      const state: { op: 'select' | 'update'; payload?: Row } = { op: 'select' };
      const b: any = {
        select: () => b,
        update: (payload: Row) => { state.op = 'update'; state.payload = payload; return b; },
        eq: (k: string, v: any) => { filters[k] = v; return b; },
        is: () => b,
        then: (resolve: any, reject: any) => {
          if (state.op === 'update') {
            updates.push({ table, payload: state.payload!, filters: { ...filters } });
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          let data: Row[] = [];
          if (table === 'restaurant_menu_items') data = fixtures.menuItems;
          if (table === 'dish_identities') {
            data = fixtures.identities;
            if ('id' in filters) data = data.filter(r => r.id === filters.id);
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  };
  return { client, updates };
}

beforeEach(() => {
  adjudicate.mockReset();
});

describe('applyOwnerMenuAuthority — exact path (useLLM: false)', () => {
  it('upgrades an exactly-matching identity to owner authority and propagates the name', async () => {
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Har Gow', name_zh: '蝦餃' }],
      identities: [{ id: 'i1', name: 'har gow', name_zh: '蝦餃', name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: false });
    expect(res.upgraded).toBe(1);

    const identUpdate = updates.find(u => u.table === 'dish_identities');
    expect(identUpdate).toBeDefined();
    expect(identUpdate!.payload).toMatchObject({
      name: 'Har Gow', name_zh: '蝦餃',
      name_authority: AUTHORITY_OWNER, owner_menu_item_id: 'm1',
    });
    expect(identUpdate!.filters.id).toBe('i1');

    // The owner's canonical name must reach every linked dish row…
    const dishUpdate = updates.find(u => u.table === 'dishes');
    expect(dishUpdate).toBeDefined();
    expect(dishUpdate!.filters.dish_identity_id).toBe('i1');
    expect(dishUpdate!.payload).toEqual({ name: 'Har Gow', name_zh: '蝦餃' });
  });

  it('treats cosmetic variation (case/width/punctuation) as exact — no LLM consulted', async () => {
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: "Kam's Roast Goose", name_zh: null }],
      identities: [{ id: 'i1', name: 'kams roast goose', name_zh: null, name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(res.upgraded).toBe(1);
    expect(adjudicate).not.toHaveBeenCalled();
    expect(updates.some(u => u.table === 'dish_identities')).toBe(true);
  });

  it('never touches an identity already at owner authority (upgrade-only rule)', async () => {
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Har Gow', name_zh: '蝦餃' }],
      identities: [{ id: 'i1', name: 'Old Owner Name', name_zh: '蝦餃', name_authority: AUTHORITY_OWNER }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(res.upgraded).toBe(0);
    expect(updates).toHaveLength(0);
    expect(adjudicate).not.toHaveBeenCalled();
  });

  it('does NOT fuzzy-match without the LLM: containment-only pairs are left alone', async () => {
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃' }],
      identities: [{ id: 'i1', name: 'Har Gow', name_zh: '蝦餃', name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: false });
    expect(res.upgraded).toBe(0);
    expect(updates).toHaveLength(0);
    expect(adjudicate).not.toHaveBeenCalled();
  });

  it('returns 0 and does nothing when the owner has no published items', async () => {
    const { client, updates } = makeAdmin({ menuItems: [], identities: [{ id: 'i1', name: 'x', name_zh: null, name_authority: 0 }] });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(res.upgraded).toBe(0);
    expect(updates).toHaveLength(0);
  });
});

describe('applyOwnerMenuAuthority — LLM path (useLLM: true)', () => {
  it('consults the adjudicator for fuzzy pairs and adopts a confident verdict', async () => {
    adjudicate.mockResolvedValue([{ id: 'm1', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃' }]);
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃' }],
      identities: [{ id: 'i1', name: 'Har Gow', name_zh: '蝦餃', name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true, restaurantName: '美心皇宮' });
    expect(res.upgraded).toBe(1);
    expect(adjudicate).toHaveBeenCalledTimes(1);
    // Restaurant context is passed through — the adjudicator's food knowledge is
    // conditioned on WHERE these names appear.
    expect(adjudicate.mock.calls[0][2]).toBe('美心皇宮');

    const identUpdate = updates.find(u => u.table === 'dish_identities')!;
    expect(identUpdate.payload).toMatchObject({
      name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃',
      name_authority: AUTHORITY_OWNER, owner_menu_item_id: 'm1',
    });
  });

  it('fails closed: an unconfident adjudicator (empty verdict) upgrades nothing', async () => {
    adjudicate.mockResolvedValue([]);
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃' }],
      identities: [{ id: 'i1', name: 'Har Gow', name_zh: '蝦餃', name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(res.upgraded).toBe(0);
    expect(adjudicate).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(0);
  });

  it('skips the LLM entirely when gate 1 nominates no candidates (unrelated names)', async () => {
    const { client } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Roast Goose', name_zh: '燒鵝' }],
      identities: [{ id: 'i1', name: 'Milk Tea', name_zh: '奶茶', name_authority: AUTHORITY_MENU }],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(res.upgraded).toBe(0);
    expect(adjudicate).not.toHaveBeenCalled();
  });

  it('caps LLM adjudications per publish (budget of 12), regardless of how many fuzzy identities exist', async () => {
    adjudicate.mockResolvedValue([]);
    const identities = Array.from({ length: 15 }, (_, k) => ({
      id: `i${k}`, name: `Har Gow ${k}`, name_zh: '蝦餃', name_authority: AUTHORITY_MENU,
    }));
    const { client } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃' }],
      identities,
    });
    await applyOwnerMenuAuthority(client, 'r1', { useLLM: true });
    expect(adjudicate).toHaveBeenCalledTimes(12);
  });

  it('scopes to a single identity when onlyIdentityId is given (the diner-link path)', async () => {
    const { client, updates } = makeAdmin({
      menuItems: [{ id: 'm1', name: 'Har Gow', name_zh: '蝦餃' }],
      identities: [
        { id: 'i1', name: 'har gow', name_zh: '蝦餃', name_authority: AUTHORITY_MENU },
        { id: 'i2', name: 'HAR GOW', name_zh: '蝦餃', name_authority: AUTHORITY_MENU },
      ],
    });
    const res = await applyOwnerMenuAuthority(client, 'r1', { useLLM: false, onlyIdentityId: 'i2' });
    expect(res.upgraded).toBe(1);
    const identUpdates = updates.filter(u => u.table === 'dish_identities');
    expect(identUpdates).toHaveLength(1);
    expect(identUpdates[0].filters.id).toBe('i2');
  });
});

describe('propagateIdentityNameToDishes', () => {
  it('updates ONLY name fields on linked rows — never name_edited_at (no silent tier demotion)', async () => {
    const { client, updates } = makeAdmin({ menuItems: [], identities: [] });
    await propagateIdentityNameToDishes(client, 'i1', '水晶鮮蝦餃', null);
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe('dishes');
    expect(updates[0].filters.dish_identity_id).toBe('i1');
    expect(Object.keys(updates[0].payload).sort()).toEqual(['name', 'name_zh']);
  });
});
