// @vitest-environment jsdom
//
// The public page's anchors mount the EXACT 大家食 FeedCard (owner correction)
// — not a second lookalike built for this page. Pinned the same way
// tests/feedCard.test.tsx pins it: checking for DuelSide's own .duel-photo
// img, which a hand-rolled copy of the layout would not produce ("sameness
// tests assert identity").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import PublicDossier from '../src/components/PublicDossier';
import type { PublicDossier as Dossier } from '../src/lib/dossier';

// The page's own back button (router.back()) needs an app-router context
// these unit tests don't mount — stubbed the same way any router-dependent
// component would be, not part of what these tests are pinning.
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: () => {} }) }));

const dossier: Dossier = {
  username: 'jerry',
  usernameDisplay: 'Jerry',
  version: 2,
  versionProgress: 0.3,
  ratingCount: 30,
  knowsCount: 3,
  learningCount: 1,
  strength: 45,
  cuisineCount: 4,
  dimsExplored: 5,
  dimsTotal: 18,
  affinity: { cantonese: 0.6 },
  vector: { umami: 0.6 },
  evidence: { umami: 5 },
  anchors: [{
    id: 'd1', name: 'Goose Intestine Noodles', name_zh: '鵝腸豬潤撈麵', restaurant: '三多麵食',
    photo_url: 'https://example.com/goose.jpg', diet: [], heaviness: null, ingredients: [],
    verdict: 'flick.never', reason: '鑊氣唔夠',
  }],
};

afterEach(cleanup);

describe('PublicDossier anchors — photo-forward format', () => {
  // The blob (TasteFormReveal) is an <svg role="img">, always present — these
  // tests are about the ANCHOR's photo specifically, so they query actual
  // <img> tags, which only DuelSide's populated photo state renders.

  it("mounts DuelSide's actual photo, not a placeholder — and still carries a negative verdict", () => {
    const { container } = render(<LanguageProvider><PublicDossier dossier={dossier} isOwner={false} /></LanguageProvider>);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.className).toContain('duel-photo');
    expect(img.src).toBe('https://example.com/goose.jpg');
    expect(screen.getByText('唔會再食')).toBeTruthy();
    expect(screen.getByText('鑊氣唔夠')).toBeTruthy();
  });

  it('an anchor with no photo renders no <img> — DuelSide\'s own blank block, nothing invented', () => {
    const { container } = render(<LanguageProvider>
      <PublicDossier dossier={{ ...dossier, anchors: [{ ...dossier.anchors[0], photo_url: null }] }} isOwner={false} />
    </LanguageProvider>);
    expect(container.querySelector('img')).toBeNull();
  });
});
