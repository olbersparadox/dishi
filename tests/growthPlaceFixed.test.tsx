// @vitest-environment jsdom
//
// Growth confirm card: a pick's KNOWN restaurant renders as settled fact
// (field-session batch 2026-07-23, item 2). The failure being pinned down:
// context known at creation was dropped downstream — the card showed no
// restaurant and offered the full orphan-dish picker (加間舖/略過/住家菜),
// while the nearby guess could overwrite the correct restaurant. The fixed
// card must show the restaurant with NO picker chips and NO tap-to-change
// affordance; a restaurant-less pick keeps the picker exactly as before.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TasteGrowth, { type GrowDish } from '../src/components/TasteGrowth';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const base: GrowDish = {
  photoUrl: null, score: 0.7, status: 'ready', dishId: 'd1', isDish: true,
  name: 'Char Siu', name_zh: '叉燒', cuisine: 'cantonese',
  ingredients: [], diet: [], heaviness: null, enriched: true,
  coords: { lat: 22.28, lng: 114.15 }, nearby: [], placeLoading: false,
  hasLocation: true, choice: null,
};

function mount(gd: Partial<GrowDish>) {
  render(
    <LanguageProvider>
      <TasteGrowth live={[{ ...base, ...gd }]} onExit={() => {}} />
    </LanguageProvider>,
  );
}

describe('pick with a known restaurant — fixed context, not an editor', () => {
  it('shows the restaurant as a static line, not a button', () => {
    mount({ placeFixed: true, choice: '再興燒臘' });
    const el = screen.getByText('再興燒臘');
    expect(el).toBeTruthy();
    // Not tappable: neither the element nor any ancestor is a button — the
    // refine-pill (tap-to-expand) path must not be reachable.
    expect(el.closest('button')).toBeNull();
  });

  it('offers NO picker chips — 加間舖/略過/住家菜 must not appear', () => {
    mount({ placeFixed: true, choice: '再興燒臘' });
    const buttonTexts = screen.getAllByRole('button').map(b => b.textContent ?? '');
    for (const label of ['加間舖', '略過', '住家菜']) {
      expect(buttonTexts.some(t => t.includes(label))).toBe(false);
    }
  });
});

describe('restaurant-less pick (略過 at pick time) — current behaviour unchanged', () => {
  it('still offers the picker chips when the nearby list is open', () => {
    mount({ nearby: [{ label: '雀友茶樓', lat: 22.28, lng: 114.15, source: 'dishi', restaurant_id: 'r9' }] });
    const buttonTexts = screen.getAllByRole('button').map(b => b.textContent ?? '');
    expect(buttonTexts.some(t => t.includes('雀友茶樓'))).toBe(true);
    expect(buttonTexts.some(t => t.includes('略過'))).toBe(true);
    expect(buttonTexts.some(t => t.includes('住家菜'))).toBe(true);
  });
});
