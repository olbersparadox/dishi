import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBookmarkRow } from '../src/lib/feed';

// The feed pool is CHRONOLOGICAL (owner, 2026-07-28): while almost nobody has
// both rated and published a dish, a taste filter over that pool hides rather
// than selects. rankFeed is gone rather than left unwired — these tests pin
// that it stayed gone, since the tempting "fix" for a thin feed is to quietly
// reintroduce scoring in the route.

describe('no ranking in the feed read path (interim, owner 2026-07-28)', () => {
  const lib = readFileSync(new URL('../src/lib/feed.ts', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../src/app/api/feed/route.ts', import.meta.url), 'utf8');

  it('lib/feed.ts exports no ranking function', () => {
    expect(lib).not.toMatch(/export function rankFeed/);
    expect(lib).not.toMatch(/FEED_TRAINING_THRESHOLD/);
  });

  // Calls and imports, not the word: the route's comments name contentScore
  // precisely because they record where ranking goes when it returns.
  it('the route scores nothing — no contentScore call, no taste vector read', () => {
    expect(route).not.toMatch(/contentScore\(/);
    expect(route).not.toMatch(/from '@\/lib\/taste'/);
    expect(route).not.toMatch(/\.from\('taste_profiles'\)/);
  });

  it('the route orders the merged pool by time, newest first', () => {
    expect(route).toMatch(/b\.at\.localeCompare\(a\.at\)/);
  });

  it("the viewer's own posts are IN the pool (the neq that emptied the tab is gone)", () => {
    expect(route).not.toMatch(/\.neq\('user_id', user\.id\)/);
    expect(route).toMatch(/own: p\.user_id === user\.id/);
  });

  it('the dish photo travels through both queries (owner call 2026-07-28 — photo-forward cards)', () => {
    // Both selects join photo_url, and both mappings read the real column —
    // the earlier `photo_url: null` (posts) that blocked this is gone.
    expect(route).toMatch(/dishes!inner\([^)]*photo_url/);
    expect(route).toMatch(/dishes!inner\(user_id, photo_url/);
    expect(route).toMatch(/photo_url: p\.dishes\.photo_url/);
    expect(route).toMatch(/photo_url: r\.dishes\?\.photo_url/);
  });
});

describe('buildBookmarkRow', () => {
  const row = buildBookmarkRow({
    dishId: 'd1',
    userId: 'u1',
    dish: {
      name: 'Beef chow fun', name_zh: '乾炒牛河', cuisine: 'cantonese',
      attributes: { umami: 0.8 }, restaurant_id: 'r1',
      cooking_method: 'fried', heaviness: 'heavy', diet: ['beef'], ingredients: ['beef', 'rice noodle'],
    },
  });

  it('carries NO eaten_at — a bookmark is not a meal that happened', () => {
    // buildPickRows stamps pick-time as eaten-time because a pick means you are
    // at the table. Reusing that here would date the journal with a meal that
    // never took place.
    expect(row.eaten_at).toBeNull();
    expect(row.source).toBe('post');
  });

  it('carries NO photo — the photograph belongs to whoever ate it', () => {
    expect(row.photo_url).toBeNull();
  });

  it('keeps the dish itself intact so the queued row rates like any other', () => {
    expect(row.attributes).toEqual({ umami: 0.8 });
    expect(row.cuisine).toBe('cantonese');
    expect(row.restaurant_id).toBe('r1');
    // Provenance is the DISH — persona cards have no post but do have a dish.
    expect(row.from_dish_id).toBe('d1');
    expect(row.user_id).toBe('u1');
  });

  // Backlog: "[S] Persist ingredients on dishes" — same treatment as
  // cooking_method/heaviness/diet just above: the source dish's ingredients
  // travel into the queued row, not silently dropped.
  it('carries the source dish\'s ingredients through, defaulting to empty', () => {
    expect(row.ingredients).toEqual(['beef', 'rice noodle']);
    const rowNoIngredients = buildBookmarkRow({
      dishId: 'd2', userId: 'u1',
      dish: { name: 'Congee', name_zh: null, cuisine: 'cantonese', attributes: {}, restaurant_id: null },
    });
    expect(rowNoIngredients.ingredients).toEqual([]);
  });
});
