// @vitest-environment jsdom
//
// A shared table's dishes belong to everyone who ate them (owner decision,
// field session 2026-08-03). A table of two picked two dishes and each phone's
// 待評菜式 showed ONE, because a pick creates a dish row owned by whoever tapped
// it — while the bill that screen had just split divided BOTH dishes over BOTH
// people.
//
// What must hold, and what these pin:
//  - a table-mate's dish appears in the queue, credited to them;
//  - it is RATEABLE (ratings is unique(user_id, dish_id) — one row, N raters);
//  - nothing the database refuses a non-owner is offered: no delete, no photo
//    slot, no rename tile. dishes' update/delete policies are auth.uid() =
//    user_id, so an offered control there would silently do nothing.
//  - 住家菜 stops standing in for "restaurant unknown" (same field session).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PickCardThumb from '../src/components/PickCardThumb';
import TasteGrowth, { type GrowDish } from '../src/components/TasteGrowth';
import { LanguageProvider } from '../src/lib/i18n';
import { dict } from '../src/lib/i18n-dict';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

class NoopResizeObserver { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver ??= NoopResizeObserver;

const base: GrowDish = {
  photoUrl: null, score: 0.7, status: 'ready', dishId: 'd1', isDish: true,
  name: 'Egg white stir-fried vermicelli', name_zh: '瑤柱蛋白炒米粉', cuisine: 'cantonese',
  ingredients: [], diet: [], heaviness: null, enriched: true,
  hasLocation: true, choice: '大排檔', placeFixed: true,
};

const growth = (gd: Partial<GrowDish>) => render(
  <LanguageProvider>
    <TasteGrowth live={[{ ...base, ...gd }]} onExit={() => {}} onEditName={() => {}} />
  </LanguageProvider>,
);

describe('a table-mate’s dish on the growth card', () => {
  it('shows the name as settled fact — no rename tile', () => {
    growth({ nameFixed: true });
    expect(screen.getByText('瑤柱蛋白炒米粉')).toBeTruthy();
    expect(screen.queryByRole('button', { name: dict['grow.rename'].zh })).toBeNull();
  });

  it('still offers the rename on your OWN dish — the default is unchanged', () => {
    growth({});
    expect(screen.getByRole('button', { name: dict['grow.rename'].zh })).toBeTruthy();
  });
});

describe('the pick card’s photo slot', () => {
  it('is a tap target on your own pick', () => {
    const onPick = vi.fn();
    const { container } = render(
      <LanguageProvider><PickCardThumb photoUrl={null} uploading={false} onPick={onPick} /></LanguageProvider>,
    );
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('offers no file input on a table-mate’s pick — the write would be refused', () => {
    const { container } = render(
      <LanguageProvider><PickCardThumb photoUrl={null} uploading={false} /></LanguageProvider>,
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('still renders their photo when there is one', () => {
    const { container } = render(
      <LanguageProvider><PickCardThumb photoUrl="https://example.test/a.jpg" uploading={false} /></LanguageProvider>,
    );
    expect(container.querySelector('img')).toBeTruthy();
  });
});

// The label bug this session also fixed: 住家菜 is a claim about how the dish was
// COOKED, and it was standing in for every dish whose restaurant never resolved —
// including menu picks, where the table gate deliberately refuses to guess between
// neighbours. The card now says unknown as unknown.
describe('the pick card’s restaurant line', () => {
  const label = (p: { restaurant: string | null; source: string }) =>
    p.restaurant ?? dict[p.source === 'home' ? 'home.homecooking' : 'table.restaurant.unset'].zh;

  it('names the restaurant when one resolved', () => {
    expect(label({ restaurant: '一起食堂', source: 'scan' })).toBe('一起食堂');
  });

  it('says 住家菜 only for a dish actually cooked at home', () => {
    expect(label({ restaurant: null, source: 'home' })).toBe('住家菜');
  });

  it('does NOT call a restaurant-less menu pick home cooking', () => {
    for (const source of ['scan', 'table', 'photo', 'album', 'manual']) {
      expect(label({ restaurant: null, source })).toBe('餐廳未定');
    }
  });
});
