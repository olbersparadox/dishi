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
//      without it the feed is pure consumption and generates nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import FeedCard from '../src/components/FeedCard';
import type { RankedFeedItem } from '../src/lib/feed';

const base: RankedFeedItem = {
  id: 'p1',
  author: { kind: 'user', username: 'jerry' },
  dish: {
    id: 'd1', name: 'Beef chow fun', name_zh: '乾炒牛河', restaurant: '新記',
    cuisine: 'cantonese', photo_url: null, attributes: { umami: 0.8 },
  },
  verdict: 'flick.never',
  reason: '鑊氣唔夠',
  match: 0.2,
};

const card = (item: RankedFeedItem & { bookmarked?: boolean }) => render(
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
});
