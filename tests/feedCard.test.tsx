// @vitest-environment jsdom
//
// ONE card, three author types. What these pin:
//   1. the author line is always dishi.<name> — the merge's whole premise is
//      that a persona is treated as any other dishi user, so the card must not
//      grow an author-specific branch;
//   2. a user's post ALWAYS renders its verdict — posts may be negative, and a
//      card showing only the dish would read as a recommendation of it;
//   3. persona content, which asserts no verdict, renders none (nothing is
//      invented to fill the slot);
//   4. every card carries the bookmark affordance, whatever the author —
//      without it the feed is pure consumption and generates nothing — EXCEPT
//      the viewer's own post, which cannot be bookmarked at all (the API
//      refuses a dish you own), so the button would only ever error;
//   5. PHOTO-FORWARD FORMAT (owner, 2026-07-28): the card mounts the actual
//      DuelSide component (large photo / name / location), not a lookalike —
//      asserted here by checking for DuelSide's own .duel-photo img, which a
//      hand-rolled copy would not produce.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import FeedCard from '../src/components/FeedCard';
import type { FeedItem } from '../src/lib/feed';

const base: FeedItem = {
  id: 'p1',
  author: { kind: 'user', username: 'jerry' },
  dish: {
    id: 'd1', name: 'Beef chow fun', name_zh: '乾炒牛河', restaurant: '新記',
    cuisine: 'cantonese', photo_url: null, attributes: { umami: 0.8 }, ingredients: [],
  },
  verdict: 'flick.never',
  reason: '鑊氣唔夠',
};

const card = (item: FeedItem & { bookmarked?: boolean }) => render(
  <LanguageProvider>
    <FeedCard item={item} onBookmarked={() => {}} />
  </LanguageProvider>,
);

afterEach(cleanup);

describe('FeedCard — one card, whatever the author', () => {
  it('identifies the author as dishi.<name>', () => {
    card(base);
    expect(screen.getByText('dishi.jerry')).toBeTruthy();
  });

  it('renders a NEGATIVE verdict rather than hiding it behind the dish', () => {
    card(base);
    // The flick vocabulary's most negative band, in the reader's language.
    expect(screen.getByText('唔會再食')).toBeTruthy();
    expect(screen.getByText('鑊氣唔夠')).toBeTruthy();
  });

  it('invents no verdict for an author that asserts none (persona content)', () => {
    card({ ...base, author: { kind: 'persona', username: 'Spoon' }, verdict: null, reason: null });
    expect(screen.getByText('dishi.Spoon')).toBeTruthy();
    expect(screen.queryByText('唔會再食')).toBeNull();
  });

  it('carries the bookmark affordance on every card, and reports an existing bookmark', () => {
    card({ ...base, author: { kind: 'persona', username: 'Spoon' }, verdict: null });
    expect(screen.getByRole('button', { name: '想食' })).toBeTruthy();
    cleanup();
    card({ ...base, bookmarked: true });
    const done = screen.getByRole('button', { name: '已加入待評' }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
  });

  it("offers NO bookmark on the viewer's own post — the API would refuse it", () => {
    card({ ...base, own: true });
    expect(screen.queryByRole('button', { name: '想食' })).toBeNull();
    // Still a full card otherwise: it is in the pool, not a stub.
    expect(screen.getByText('dishi.jerry')).toBeTruthy();
    expect(screen.getByText('唔會再食')).toBeTruthy();
  });

  it('mounts the real DuelSide component — a photo renders its actual src, not a placeholder', () => {
    // DuelSide's photo is alt="" (decorative — the name beside it is the text
    // alternative), so it has no accessible "img" role; queried by tag instead.
    const { container } = card({ ...base, dish: { ...base.dish, photo_url: 'https://example.com/goose.jpg' } });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.className).toContain('duel-photo');
    expect(img.src).toBe('https://example.com/goose.jpg');
  });

  it('with no photo, DuelSide renders its own blank block — no img tag invented', () => {
    const { container } = card(base); // base.dish.photo_url is null
    expect(container.querySelector('img')).toBeNull();
  });
});
