// @vitest-environment jsdom
//
// State B's second swipe — sharing the PROFILE (sharing batch item 4b).
//
// Two things here are load-bearing and easy to regress:
//
//  1. The messenger row is ONE button, not four. The four marks are
//     ILLUSTRATIVE of the destination; making them individually tappable
//     would claim per-app integrations that do not exist (WeChat has no web
//     share target at all). This was the owner's settled call over review's
//     per-app deep-linking proposal, so a test — not just a comment — guards
//     it.
//  2. The share is gated on a CLAIMED username, because only claimed names
//     resolve publicly; a legacy email-derived handle would mint a link that
//     404s, which is worse than no link.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import TasteFormCard from '../src/components/TasteFormCard';
import { LanguageProvider } from '../src/lib/i18n';
import { MESSENGER_MARKS } from '../src/lib/messengers';

// Same fixtures/mock shape as installFlow.test.tsx — this exercises the SAME
// State B, so it must mount it the same way rather than invent a second
// contract for /api/buddy.
const BUDDY_STATE = {
  version: { v: 2, live: 2, progress: 0.4, nextAt: 0.8, justUnlockedTo: null },
  strength: 91,
  elements: [], hint: { key: 'buddy.hint.rate' },
  knows: ['umami'], learning: [],
  stats: { ratings: 30, cuisines: 5, dims_explored: 9, dims_total: 18 },
  vector: { umami: 0.7 }, evidence: { umami: 1 }, profile_version: 2,
};
const CLAIMED = { username: 'jerry', claimed: true, changesLeft: 1 };
// Non-null username with claimed:false is the LEGACY email-derived handle —
// exactly the state that must not mint a public link.
const UNCLAIMED = { username: 'mosuko', claimed: false, changesLeft: 1 };
const dims = Object.fromEntries([...Array(9)].map((_, i) => [`d${i}`, 0.5]));
const cuisines = Object.fromEntries([...Array(5)].map((_, i) => [`c${i}`, 0.5]));

function mockFetch(identity: object) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/api/buddy')) {
      return { ok: true, json: async () => ({ state: BUDDY_STATE, species: null, identity }) };
    }
    if (String(url).includes('/api/taste/export')) {
      return { ok: true, json: async () => ({ profile_version: 2, delta: [], is_first_export: true, new_companions: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

async function openStateB(identity: object = CLAIMED) {
  global.fetch = mockFetch(identity);
  render(
    <LanguageProvider>
      <TasteFormCard vector={dims} affinity={cuisines} count={30} dishes={[]} userId="u1" />
    </LanguageProvider>,
  );
  await screen.findByRole('button', { name: /植入/ });
  fireEvent.click(screen.getByRole('button', { name: /植入/ }));
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('two panels, one surface — an AI or a person', () => {
  it('State B carries both audiences with the SAME divider anatomy', async () => {
    await openStateB();
    expect(document.querySelectorAll('.persona-panel')).toHaveLength(2);
    // The spec's "visually parallel to the AI-host swipe": one divider per
    // panel, from a single definition so the two cannot drift apart.
    expect(document.querySelectorAll('.persona-divider-wrap')).toHaveLength(2);
    expect(screen.getByText('將你的口味植入你日常用的 AI')).toBeTruthy();
    expect(screen.getByText('將你的公開味覺頁面傳給朋友')).toBeTruthy();
  });

  it('the share panel headlines the URL the friend actually receives', async () => {
    await openStateB();
    expect(screen.getByText('dishi.me/jerry')).toBeTruthy();
  });
});

describe('the messenger row is ONE button, never four', () => {
  it('renders a single share control wrapping all four marks', async () => {
    await openStateB();
    const rows = document.querySelectorAll('.msg-share-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].tagName).toBe('BUTTON');
    // Every mark lives INSIDE that one button — none is its own control.
    const marks = rows[0].querySelectorAll('.msg-logos img');
    expect(marks).toHaveLength(MESSENGER_MARKS.length);
    expect(rows[0].querySelectorAll('button')).toHaveLength(0);
  });

  it('a missing brand asset costs nothing — the mark hides, the row still works', async () => {
    // The assets are deliberately absent from the repo (trademarks, owner-
    // supplied like public/ai-logos/). The row must be fully functional
    // today and gain the logos on a pure file drop, so each img hides ITSELF
    // on error rather than the row depending on them.
    await openStateB();
    const img = document.querySelector('.msg-logos img') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
    expect(document.querySelector('.msg-share-row')).toBeTruthy();
  });

  it('tapping it shares the public page URL', async () => {
    await openStateB();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator',
      { value: { share, clipboard: { writeText: vi.fn() } }, configurable: true, writable: true });

    fireEvent.click(document.querySelector('.msg-share-row')!);
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toMatch(/\/jerry$/);
  });
});

describe('gated on a claimed username', () => {
  it('unclaimed gets the claim nudge, and NO share control', async () => {
    // A legacy email-derived handle does not resolve publicly, so a share
    // button there would mint a link that 404s.
    await openStateB(UNCLAIMED);
    expect(document.querySelector('.msg-share-row')).toBeNull();
    expect(screen.getByText('改咗上面個名，就有得分享你嘅味覺頁面')).toBeTruthy();
    // The panel itself still exists — it is the motivator.
    expect(document.querySelectorAll('.persona-panel')).toHaveLength(2);
  });
});
