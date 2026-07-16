import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import {
  sanitizeItem, sanitizeSkeletonItem, sanitizeDietFlags, sanitizeCookingMethod,
  sanitizeHeaviness, sanitizeIngredients, DIET_FLAGS, COOKING_METHODS, HEAVINESS,
} from '../src/lib/menuScan';

describe('sanitizeDietFlags — closed vocabulary, never free text', () => {
  it('keeps only flags from the fixed vocabulary', () => {
    expect(sanitizeDietFlags(['pork', 'spicy', 'made-up-flag', 'gluten-free'])).toEqual(['pork', 'spicy']);
  });
  it('lowercases and dedupes', () => {
    expect(sanitizeDietFlags(['PORK', 'pork', 'Spicy'])).toEqual(['pork', 'spicy']);
  });
  it('non-array or missing input -> empty, never throws', () => {
    expect(sanitizeDietFlags(undefined)).toEqual([]);
    expect(sanitizeDietFlags('pork')).toEqual([]);
    expect(sanitizeDietFlags(null)).toEqual([]);
  });
  it('every value in the exported vocabulary round-trips', () => {
    for (const flag of DIET_FLAGS) expect(sanitizeDietFlags([flag])).toEqual([flag]);
  });
});

describe('sanitizeCookingMethod / sanitizeHeaviness — closed enums', () => {
  it('accepts only vocabulary values, case-insensitive', () => {
    expect(sanitizeCookingMethod('Grilled')).toBe('grilled');
    expect(sanitizeCookingMethod('deep-fried-twice')).toBeNull();
    expect(sanitizeCookingMethod(undefined)).toBeNull();
  });
  it('every cooking method in the exported vocabulary round-trips', () => {
    for (const m of COOKING_METHODS) expect(sanitizeCookingMethod(m)).toBe(m);
  });
  it('heaviness accepts only light/medium/heavy', () => {
    expect(sanitizeHeaviness('Heavy')).toBe('heavy');
    expect(sanitizeHeaviness('extremely heavy')).toBeNull();
    for (const h of HEAVINESS) expect(sanitizeHeaviness(h)).toBe(h);
  });
});

describe('sanitizeIngredients', () => {
  it('caps at 4, lowercases, drops empties', () => {
    expect(sanitizeIngredients(['Tofu', 'Chili', 'Garlic', 'Scallion', 'Ginger'])).toEqual(['tofu', 'chili', 'garlic', 'scallion']);
    expect(sanitizeIngredients(['', 'salt'])).toEqual(['salt']);
  });
  it('non-array -> empty', () => { expect(sanitizeIngredients('tofu')).toEqual([]); });
});

describe('sanitizeSkeletonItem — Stage 1, identity fields only', () => {
  it('parses the light schema: name/price/cuisine, nothing else populated', () => {
    const item = sanitizeSkeletonItem({ n: 'Mapo tofu', z: '麻婆豆腐', o: '麻婆豆腐', p: '$78', c: 'sichuan', f: 0.9 });
    expect(item?.name).toBe('Mapo tofu');
    expect(item?.price).toBe('$78');
    expect(item?.cuisine).toBe('sichuan');
  });
  it('every enrichment-stage field starts at an honest empty, not a guess', () => {
    // '' / [] / null are distinguishable from "enriched and genuinely has none" via
    // the client-side `enriched` flag — this function must never fabricate a hook
    // or diet flag just because the fast pass has no way to know them yet.
    const item = sanitizeSkeletonItem({ n: 'X', c: 'x', f: 0.5 });
    expect(item?.hook).toBe('');
    expect(item?.hook_zh).toBe('');
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
    expect(item?.heaviness).toBeNull();
    expect(item?.ingredients).toEqual([]);
    expect(item?.attributes).toEqual({});
  });
  it('missing name -> null, never a fabricated dish', () => {
    expect(sanitizeSkeletonItem({ c: 'x', f: 0.5 })).toBeNull();
  });
});

describe('sanitizeItem — full item assembly (owner-upload path + Stage 2 merge shape)', () => {
  it('parses a fully-populated real-shaped response', () => {
    const item = sanitizeItem({
      n: 'Mapo tofu', z: '麻婆豆腐', o: '麻婆豆腐', p: '$78', c: 'sichuan', h: 'numbing heat', f: 0.9,
      d: ['veg', 'spicy'], m: 'braised', w: 'medium', i: ['tofu', 'chili'],
    });
    expect(item?.diet).toEqual(['veg', 'spicy']);
    expect(item?.cooking_method).toBe('braised');
    expect(item?.heaviness).toBe('medium');
    expect(item?.ingredients).toEqual(['tofu', 'chili']);
  });

  it('REGRESSION: an item from the OLDER prompt schema (no new fields) still parses cleanly', () => {
    // The single-call owner-menu-upload path (scanMenu/SYSTEM) never got these
    // fields added — sanitizeItem is shared, so it must degrade gracefully rather
    // than crash or fabricate values for a response that simply omits them.
    const item = sanitizeItem({ n: 'Char siu', c: 'cantonese', h: 'lacquered char', f: 0.8 });
    expect(item).not.toBeNull();
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
    expect(item?.heaviness).toBeNull();
    expect(item?.ingredients).toEqual([]);
  });

  it('a garbage diet flag or cooking method from the model never leaks into the item', () => {
    const item = sanitizeItem({ n: 'X', c: 'x', h: 'x', d: ['nonsense'], m: 'deep-fried-in-lava' });
    expect(item?.diet).toEqual([]);
    expect(item?.cooking_method).toBeNull();
  });

  it('parses the bilingual hook (hz), matching the name/name_zh pattern used elsewhere', () => {
    const item = sanitizeItem({ n: 'Mapo tofu', c: 'sichuan', h: 'Numbing Heat', hz: '麻辣鮮香' });
    expect(item?.hook).toBe('Numbing Heat');
    expect(item?.hook_zh).toBe('麻辣鮮香');
  });

  it('missing hz -> empty string, not a fabricated translation', () => {
    const item = sanitizeItem({ n: 'X', c: 'x', h: 'English only' });
    expect(item?.hook).toBe('English only');
    expect(item?.hook_zh).toBe('');
  });
});

// ---------------------------------------------------------------------------
// is_menu: the not-a-menu detection gate. Real bug: a non-menu photo used to
// wait out the full model call only to get a generic "closer, flatter, better
// light" message that blamed photo quality for something that was never a menu.
// ---------------------------------------------------------------------------
vi.mock('../src/lib/openrouter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/openrouter')>();
  return { ...actual, callClaude: vi.fn(), callClaudeStream: vi.fn() };
});
import { callClaude, callClaudeStream } from '../src/lib/openrouter';
import { scanMenuSkeleton, scanMenuSkeletonStream, cookingBucket, COOKING_BUCKETS } from '../src/lib/menuScan';

async function collectStream(chunks: string[]) {
  vi.mocked(callClaudeStream).mockImplementation(async function* () {
    for (const c of chunks) yield c;
  });
  const events = [];
  for await (const ev of scanMenuSkeletonStream('b64', 'image/jpeg')) events.push(ev);
  return events;
}

describe('scanMenuSkeleton is_menu gate (non-stream)', () => {
  const ORIGINAL_KEY = process.env.OPENROUTER_API_KEY;
  beforeEach(() => { vi.mocked(callClaude).mockReset(); process.env.OPENROUTER_API_KEY = 'test-key'; });
  afterAll(() => { process.env.OPENROUTER_API_KEY = ORIGINAL_KEY; });

  it('a real menu with items is always is_menu: true, even if "im" is somehow false', async () => {
    // Contradiction guard: extracted dishes are the stronger signal than the
    // model's own self-report — trusting "im" over real items would wrongly
    // discard a genuine, if partially self-doubting, scan.
    vi.mocked(callClaude).mockResolvedValue(
      '{"im":false,"menu_language":"zh","restaurant_guess":null,"items":[{"n":"Char Siu","z":"叉燒","o":"叉燒","p":"$80","c":"cantonese","f":0.9}]}',
    );
    const result = await scanMenuSkeleton('b64', 'image/jpeg');
    expect(result.items).toHaveLength(1);
    expect(result.is_menu).toBe(true);
  });

  it('zero items AND "im": false -> is_menu: false (the actual not-a-menu case)', async () => {
    vi.mocked(callClaude).mockResolvedValue('{"im":false,"menu_language":"unknown","restaurant_guess":null,"items":[]}');
    const result = await scanMenuSkeleton('b64', 'image/jpeg');
    expect(result.items).toHaveLength(0);
    expect(result.is_menu).toBe(false);
  });

  it('zero items but "im" omitted or true -> is_menu: true (an unreadable menu, not a non-menu)', async () => {
    vi.mocked(callClaude).mockResolvedValue('{"menu_language":"unknown","restaurant_guess":null,"items":[]}');
    const result = await scanMenuSkeleton('b64', 'image/jpeg');
    expect(result.is_menu).toBe(true);
  });

  it('a totally unparseable response defaults to is_menu: true — never falsely claims "not a menu"', async () => {
    vi.mocked(callClaude).mockResolvedValue('not json at all');
    const result = await scanMenuSkeleton('b64', 'image/jpeg');
    expect(result.items).toHaveLength(0);
    expect(result.is_menu).toBe(true);
  });
});

describe('scanMenuSkeletonStream is_menu gate (streaming)', () => {
  const ORIGINAL_KEY = process.env.OPENROUTER_API_KEY;
  beforeEach(() => { vi.mocked(callClaudeStream).mockReset(); process.env.OPENROUTER_API_KEY = 'test-key'; });
  afterAll(() => { process.env.OPENROUTER_API_KEY = ORIGINAL_KEY; });

  it('streams a real menu then reports is_menu: true in the final meta event', async () => {
    const events = await collectStream([
      '{"im":true,"menu_language":"zh","restaurant_guess":"Test","items":[{"n":"Char Siu","z":"叉燒","o":"叉燒","p":"$80","c":"cantonese","f":0.9}]}',
    ]);
    expect(events.filter(e => e.kind === 'item')).toHaveLength(1);
    const meta = events.find(e => e.kind === 'meta') as any;
    expect(meta.is_menu).toBe(true);
  });

  it('a non-menu photo streams zero items and meta.is_menu: false', async () => {
    const events = await collectStream(['{"im":false,"menu_language":"unknown","restaurant_guess":null,"items":[]}']);
    expect(events.filter(e => e.kind === 'item')).toHaveLength(0);
    const meta = events.find(e => e.kind === 'meta') as any;
    expect(meta.is_menu).toBe(false);
  });

  it('items that streamed in mid-response still count even if the final buffer is truncated', async () => {
    // Simulates a real truncation: the model streamed one complete dish, then the
    // connection or token budget cut off before "im"/menu_language ever closed.
    const events = await collectStream(['{"items":[{"n":"Mapo Tofu","z":"麻婆豆腐","o":"麻婆豆腐","p":"$78","c":"sichuan","f":0.9}']);
    expect(events.filter(e => e.kind === 'item')).toHaveLength(1);
    const meta = events.find(e => e.kind === 'meta') as any;
    // Real items were recovered — must never be second-guessed into "not a menu"
    // just because the trailing metadata never arrived.
    expect(meta.is_menu).toBe(true);
  });
});


describe('cookingBucket — coarse 5-category grouping for the scan card\u2019s featured line', () => {
  it('maps every known method to a bucket, except "other"', () => {
    expect(cookingBucket('raw')).toBe('fresh_raw');
    expect(cookingBucket('steamed')).toBe('steamed_poached');
    expect(cookingBucket('boiled')).toBe('steamed_poached');
    expect(cookingBucket('grilled')).toBe('grilled_roasted');
    expect(cookingBucket('baked')).toBe('grilled_roasted');
    expect(cookingBucket('braised')).toBe('braised_stewed');
    expect(cookingBucket('fried')).toBe('rich_fried');
    expect(cookingBucket('stir-fried')).toBe('rich_fried');
  });
  it('"other" and missing values have no honest bucket \u2014 null, not a guess', () => {
    expect(cookingBucket('other')).toBeNull();
    expect(cookingBucket(null)).toBeNull();
    expect(cookingBucket(undefined)).toBeNull();
  });
  it('every bucket in the exported vocabulary is reachable from at least one method', () => {
    const reached = new Set(COOKING_METHODS.map(cookingBucket).filter(Boolean));
    for (const b of COOKING_BUCKETS) expect(reached.has(b)).toBe(true);
  });
});
