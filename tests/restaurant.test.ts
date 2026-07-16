import { describe, it, expect } from 'vitest';
import { normalizeRestaurantName, namesMatch, namesContainmentRelated, resolveOrCreateRestaurant } from '../src/lib/restaurant';

describe('normalizeRestaurantName', () => {
  it('folds case, whitespace, punctuation and full-width forms', () => {
    expect(normalizeRestaurantName("Kam's Roast Goose")).toBe(normalizeRestaurantName('kams  roast goose'));
    expect(normalizeRestaurantName('ＭcＤonald’s')).toBe(normalizeRestaurantName("McDonald's"));
    expect(normalizeRestaurantName('一風堂・銅鑼灣')).toBe(normalizeRestaurantName('一風堂銅鑼灣'));
  });
  it('does NOT collapse genuinely different names', () => {
    expect(normalizeRestaurantName('添好運')).not.toBe(normalizeRestaurantName('添好運分店二'));
    expect(normalizeRestaurantName('Din Tai Fung')).not.toBe(normalizeRestaurantName('Tim Ho Wan'));
  });
});

describe('namesMatch', () => {
  it('matches against either language on the row', () => {
    const row = { name: 'Tim Ho Wan', name_zh: '添好運' };
    expect(namesMatch('tim ho wan', row)).toBe(true);
    expect(namesMatch('添好運', row)).toBe(true);
    expect(namesMatch('添好', row)).toBe(false); // substring is NOT a match — human decides those
  });
  it('never matches on empty input', () => {
    expect(namesMatch('  ', { name: 'X' })).toBe(false);
  });
});

describe('namesContainmentRelated', () => {
  it('catches a branch/area suffix (same place, extra words)', () => {
    expect(namesContainmentRelated('元氣壽司', { name: '元氣壽司 (銅鑼灣)', name_zh: null })).toBe(true);
    expect(namesContainmentRelated("McDonald's Times Square", { name: "McDonald's", name_zh: null })).toBe(true);
  });
  it('matches against name_zh too', () => {
    expect(namesContainmentRelated('添好運', { name: 'Tim Ho Wan', name_zh: '添好運 中環店' })).toBe(true);
  });
  it('does NOT fire on exact equality (that is namesMatch\u2019s job)', () => {
    expect(namesContainmentRelated('添好運', { name: '添好運', name_zh: null })).toBe(false);
  });
  it('respects a script-aware length floor so a short generic name is not contained everywhere', () => {
    expect(namesContainmentRelated('Cafe', { name: 'Cafe Deco Group', name_zh: null })).toBe(false); // 'cafe' (4) < Latin floor 5
    expect(namesContainmentRelated('壽', { name: '壽司之神', name_zh: null })).toBe(false); // 1 CJK char < floor 2
  });
});

// Minimal fake supabase capturing the exact call surface resolveOrCreateRestaurant uses.
function fakeSupabase(opts: {
  byPlaceId?: { id: string } | null;
  nearby?: Array<{ id: string; name: string; name_zh?: string | null; place_id?: string | null }>;
  insertResult?: { data: { id: string } | null; error: any };
}) {
  const calls: any[] = [];
  return {
    calls,
    rpc: async (_fn: string, args: any) => { calls.push(['rpc', args]); return { data: opts.nearby ?? [] }; },
    from: (_table: string) => ({
      select: () => ({
        eq: (_c: string, v: string) => ({
          limit: () => ({ maybeSingle: async () => { calls.push(['byPlace', v]); return { data: opts.byPlaceId ?? null }; } }),
        }),
      }),
      update: (patch: any) => ({
        eq: (_c: string, id: string) => ({ is: async () => { calls.push(['heal', id, patch]); return { data: null }; } }),
      }),
      insert: (row: any) => ({
        select: () => ({ single: async () => { calls.push(['insert', row]); return opts.insertResult ?? { data: { id: 'new-id' }, error: null }; } }),
      }),
    }),
  };
}

describe('resolveOrCreateRestaurant dedup order', () => {
  const base = { name: 'Tim Ho Wan', lat: 22.28, lng: 114.19 };

  it('place_id match wins before any name comparison', async () => {
    const sb = fakeSupabase({ byPlaceId: { id: 'canonical' }, nearby: [{ id: 'wrong', name: 'Tim Ho Wan' }] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { ...base, place_id: 'gp_1' });
    expect(r.id).toBe('canonical');
    expect(sb.calls.some(c => c[0] === 'rpc')).toBe(false); // never even looked at names
  });

  it('normalized-name match within 50m reuses the row and heals its place_id', async () => {
    const sb = fakeSupabase({ byPlaceId: null, nearby: [{ id: 'legacy', name: "tim  ho wan", place_id: null }] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { ...base, place_id: 'gp_1' });
    expect(r.id).toBe('legacy');
    const heal = sb.calls.find(c => c[0] === 'heal');
    expect(heal?.[2]).toEqual({ place_id: 'gp_1' });
  });

  it('matches legacy rows via name_zh too', async () => {
    const sb = fakeSupabase({ nearby: [{ id: 'zh-row', name: 'Tim Ho Wan HK', name_zh: '添好運' }] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { name: '添好運', lat: 22.28, lng: 114.19 });
    expect(r.id).toBe('zh-row');
  });

  it('creates with place_id stored when nothing matches', async () => {
    const sb = fakeSupabase({ nearby: [] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { ...base, place_id: 'gp_9' });
    expect(r.id).toBe('new-id');
    const insert = sb.calls.find(c => c[0] === 'insert');
    expect(insert?.[1].place_id).toBe('gp_9');
  });

  it('recovers from a place_id unique-violation race by adopting the winner', async () => {
    let firstLookup = true;
    const sb = fakeSupabase({ nearby: [], insertResult: { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "restaurants_place_id_key"' } } });
    // First place_id lookup (pre-insert) misses; the post-conflict re-read hits.
    const origFrom = sb.from.bind(sb);
    sb.from = (t: string) => {
      const o = origFrom(t);
      return {
        ...o,
        select: () => ({
          eq: (_c: string, _v: string) => ({
            limit: () => ({ maybeSingle: async () => {
              if (firstLookup) { firstLookup = false; return { data: null }; }
              return { data: { id: 'winner' } };
            } }),
          }),
        }),
      };
    };
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { ...base, place_id: 'gp_2' });
    expect(r.id).toBe('winner');
    expect(r.error).toBeUndefined();
  });

  it('manual entry with no place_id still creates cleanly', async () => {
    const sb = fakeSupabase({ nearby: [] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, base);
    const insert = sb.calls.find(c => c[0] === 'insert');
    expect(insert?.[1].place_id).toBeNull();
    expect(r.id).toBe('new-id');
  });

  it('reuses a row on a UNIQUE containment match (branch-suffix case)', async () => {
    const sb = fakeSupabase({ nearby: [{ id: 'branch', name: '元氣壽司 (銅鑼灣)', name_zh: null }] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { name: '元氣壽司', lat: 22.28, lng: 114.19 });
    expect(r.id).toBe('branch');
  });

  it('does NOT merge on AMBIGUOUS containment \u2014 two candidates means create + let a human merge', async () => {
    const sb = fakeSupabase({ nearby: [
      { id: 'a', name: '元氣壽司 (銅鑼灣)', name_zh: null },
      { id: 'b', name: '元氣壽司 專門店', name_zh: null },
    ] });
    const r = await resolveOrCreateRestaurant(sb, 'u', null, { name: '元氣壽司', lat: 22.28, lng: 114.19 });
    expect(r.id).toBe('new-id'); // created, not fused into either
  });
});
