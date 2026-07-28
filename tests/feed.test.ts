import { describe, it, expect } from 'vitest';
import { rankFeed, buildBookmarkRow, FEED_TRAINING_THRESHOLD, type FeedItem } from '../src/lib/feed';

// Taste-rank IS the distribution (no social graph, decision 2). These tests pin
// the two rules that decide whether a post reaches anyone at all.

const item = (id: string, attributes: Record<string, number>, over: Partial<FeedItem> = {}): FeedItem => ({
  id,
  author: { kind: 'user', username: 'jerry' },
  dish: { id: `d-${id}`, name: id, name_zh: null, restaurant: null, cuisine: null, photo_url: null, attributes },
  verdict: 'flick.loved',
  reason: null,
  ...over,
});

// contentScore divides by MIN_SCORED_DIMS, so give each dish enough dims to
// score like a real one rather than a two-attribute fixture.
const dims = (v: number) => Object.fromEntries(
  ['umami', 'rich', 'sweet', 'salty', 'sour', 'bitter', 'spicy', 'tender', 'crisp', 'fresh'].map(d => [d, v]),
);

describe('rankFeed', () => {
  it('ranks by taste match, strongest first', () => {
    const taste = { umami: 0.8, rich: 0.8, sweet: 0.8, salty: 0.8, sour: 0.8, bitter: 0.8, spicy: 0.8, tender: 0.8, crisp: 0.8, fresh: 0.8 };
    const ranked = rankFeed(taste, {}, [item('weak', dims(0.6)), item('strong', dims(1))]);
    expect(ranked.map(r => r.id)).toEqual(['strong', 'weak']);
    expect(ranked[0].match).toBeGreaterThan(ranked[1].match);
  });

  it('DROPS what the engine does not like for you — no rec is better than an irrelevant one', () => {
    const taste = { umami: 0.9, rich: 0.9, sweet: 0.9, salty: 0.9, sour: 0.9, bitter: 0.9, spicy: 0.9, tender: 0.9, crisp: 0.9, fresh: 0.9 };
    // Every dim well below the midpoint the score is measured from: a real
    // mismatch, not a near-miss.
    const ranked = rankFeed(taste, {}, [item('mismatch', dims(0))]);
    expect(ranked).toHaveLength(0);
  });

  it('a NEGATIVE verdict never disqualifies a post — relevance is the dish, the verdict is the content', () => {
    const taste = { umami: 0.8, rich: 0.8, sweet: 0.8, salty: 0.8, sour: 0.8, bitter: 0.8, spicy: 0.8, tender: 0.8, crisp: 0.8, fresh: 0.8 };
    const ranked = rankFeed(taste, {}, [item('bad-somewhere', dims(1), { verdict: 'flick.never' })]);
    expect(ranked.map(r => r.id)).toEqual(['bad-somewhere']);
    expect(ranked[0].verdict).toBe('flick.never'); // and it still travels with the card
  });

  it('the honesty bar is the same one recommendations have always used', () => {
    expect(FEED_TRAINING_THRESHOLD).toBe(5);
  });
});

describe('buildBookmarkRow', () => {
  const row = buildBookmarkRow({
    dishId: 'd1',
    userId: 'u1',
    dish: {
      name: 'Beef chow fun', name_zh: '乾炒牛河', cuisine: 'cantonese',
      attributes: { umami: 0.8 }, restaurant_id: 'r1',
      cooking_method: 'fried', heaviness: 'heavy', diet: ['beef'],
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
});
