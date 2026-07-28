// @vitest-environment jsdom
//
// The editorial card (BACKLOG batch 2026-07-29) — a columnist post rendered
// by the SAME FeedCard as every other author, which is the whole premise.
// What these pin:
//  1. the photo credit renders — CC BY/BY-SA make attribution a license term;
//  2. the review bar exists ONLY on a pending draft, and its verbs hit the
//     API: publish drops the bar (card stays, as everyone will now see it),
//     discard removes the card entirely;
//  3. bookmarking an editorial card sends persona_post_id — there is no
//     dishes row behind it — and the 待評 row builder keeps the two honest
//     NULLs (eaten_at: wanting ≠ having eaten; photo_url: a licensed
//     reference shot must not become this user's meal photo).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import FeedCard from '../src/components/FeedCard';
import { buildEditorialBookmarkRow, type FeedItem } from '../src/lib/feed';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const editorial = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'pp1',
  author: { kind: 'persona', username: 'Spoon' },
  dish: {
    id: null, name: 'Khao soi', name_zh: '泰北咖喱麵', restaurant: null,
    cuisine: 'thai', photo_url: 'https://x/khao-soi.jpg', attributes: {},
    diet: [], heaviness: null, ingredients: [],
  },
  verdict: null,
  reason: '脆麵沉落椰漿咖喱湯嗰三秒，係成碗嘅意義。',
  editorial: { credit: 'Douglas Perkins / Wikimedia Commons / CC BY 4.0' },
  ...over,
});

const mount = (item: FeedItem) => render(
  <LanguageProvider>
    <FeedCard item={item} onBookmarked={() => {}} />
  </LanguageProvider>,
);

describe('the editorial card is the same card', () => {
  it('renders author, body and the license credit — and no verdict is invented', () => {
    mount(editorial());
    expect(screen.getByText('dishi.Spoon')).toBeTruthy();
    expect(screen.getByText(/脆麵沉落/)).toBeTruthy();
    expect(screen.getByText('Douglas Perkins / Wikimedia Commons / CC BY 4.0')).toBeTruthy();
    expect(document.querySelector('.feed-author-verdict')).toBeNull();
  });

  it('a published editorial card carries NO review bar', () => {
    mount(editorial());
    expect(document.querySelector('.feed-review-bar')).toBeNull();
  });
});

describe('the in-feed review — drafts judged as the pixels everyone will get', () => {
  it('publish PATCHes the post and drops the bar, keeping the card', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([String(url), init]);
      return { ok: true, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;

    mount(editorial({ editorial: { credit: 'c', pending: true } }));
    expect(document.querySelector('.feed-review-bar')).toBeTruthy();
    fireEvent.click(screen.getByText('刊出'));
    await waitFor(() => expect(document.querySelector('.feed-review-bar')).toBeNull());
    expect(calls[0][0]).toBe('/api/persona-posts/pp1');
    expect(calls[0][1]?.method).toBe('PATCH');
    // The card survives — publishing shows the editor exactly what shipped.
    expect(screen.getByText('dishi.Spoon')).toBeTruthy();
  });

  it('discard DELETEs and removes the whole card', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    mount(editorial({ editorial: { credit: 'c', pending: true } }));
    fireEvent.click(screen.getByText('棄用'));
    await waitFor(() => expect(screen.queryByText('dishi.Spoon')).toBeNull());
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]?.method).toBe('DELETE');
  });
});

describe('bookmarking keys on the post', () => {
  it('the tap sends persona_post_id, not a dish id', async () => {
    let sent: unknown = null;
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;

    mount(editorial());
    fireEvent.click(document.querySelector('.feed-bookmark-btn')!);
    await waitFor(() => expect(sent).toEqual({ persona_post_id: 'pp1' }));
  });

  it('the 待評 row keeps the two honest NULLs and the post key', () => {
    const row = buildEditorialBookmarkRow({
      postId: 'pp1', userId: 'u1',
      post: { name: 'Khao soi', name_zh: '泰北咖喱麵', cuisine: 'thai' },
    });
    expect(row.from_persona_post_id).toBe('pp1');
    expect(row.eaten_at).toBeNull();
    expect(row.photo_url).toBeNull();
    expect(row.attributes).toEqual({});
    expect(row.source).toBe('post');
  });
});
