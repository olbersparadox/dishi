// @vitest-environment jsdom
//
// Table Mode item 1 correction (2026-07-21): the shipped "unified table
// surface" turned out to be a second list styled to LOOK like scan's, not
// scan's actual component reused. This test exists to make that specific
// regression impossible to reintroduce silently — it fails against the
// legacy table/page.tsx (no DishListRow import, banned markers present) and
// it fails if DishListRow's own rendered anatomy ever drifts from the
// reference screenshots (numbered serif row, price, ingredient/heaviness
// chips, no cuisine chip, no fire, no inline pick button).
//
// Uses a Stage-2-enriched fixture item on purpose, not the 測試菜A/B seed —
// that fixture had no diet/ingredients/heaviness at all, which is exactly
// what let the original regression through unnoticed.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import DishListRow, { type DishListRowItem } from '../src/components/DishListRow';
import ChopStampRow from '../src/components/ChopStampRow';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(cleanup);

const SCAN_SRC = readFileSync(path.resolve(__dirname, '../src/app/scan/page.tsx'), 'utf8');
const TABLE_SRC = readFileSync(path.resolve(__dirname, '../src/app/table/page.tsx'), 'utf8');
const ROW_SRC = readFileSync(path.resolve(__dirname, '../src/components/DishListRow.tsx'), 'utf8');

describe('Table Mode item 1 — host and joiner render the SAME list component', () => {
  it('both scan and table import DishListRow from the same module (not a look-alike)', () => {
    expect(SCAN_SRC).toMatch(/import DishListRow from '@\/components\/DishListRow'/);
    expect(TABLE_SRC).toMatch(/import DishListRow from '@\/components\/DishListRow'/);
  });

  it('table/page.tsx never re-implements the banned legacy anatomy', () => {
    // Exact markers of the original regression: a hand-styled second row/card
    // living in table/page.tsx instead of a DishListRow call. Any of these
    // reappearing outside DishListRow.tsx itself means the surface is fake again.
    expect(TABLE_SRC).not.toMatch(/剛剛選了/);       // banned feed card
    expect(TABLE_SRC).not.toMatch(/揀呢個/);          // banned inline pick pill
    expect(TABLE_SRC).not.toMatch(/cuisineLabel/);   // banned cuisine chip
    expect(TABLE_SRC).not.toMatch(/scan-fire/);      // fire is a scan-only earned mark
  });

  const sessionItem: DishListRowItem = {
    key: 'menu-7',
    name: 'XO Sauce Stir-Fried Turnip Cake',
    name_zh: 'XO醬炒蘿蔔糕',
    name_original: 'XO醬炒蘿蔔糕',
    price: '$68',
    cooking_method: 'stir-fried',
    heaviness: 'medium',
    diet: ['spicy'],
    ingredients: ['garlic', 'dried shrimp'],
    enriched: true,
  };

  // Both call sites now pass the SAME props, including the same stamps slot.
  //
  // This used to be the interesting asymmetry: scan passed `pickedBy` (a handle
  // text line) and table passed `stamps` (real chops), and this test asserted the
  // stamps slot was "the one legitimate host/joiner difference". That tolerance is
  // exactly what the 2026-07-30 field test walked into — the owner scanned a menu,
  // the other account joined, and the scanner saw "just a line under chips" where
  // the joiner saw chops. So the difference is gone and `pickedBy` is gone with it;
  // the assertion below is now identity with NOTHING removed first.
  const stampSlot = () => (
    <ChopStampRow itemKey="menu-7" stamps={[{ user_id: 'u1', name: 'mosuko' }]} colorFor={() => '#3B82F6'} />
  );

  function renderAsHost() {
    return render(
      <LanguageProvider>
        <DishListRow item={sessionItem} rank={3} picked={false} onSelect={() => {}}
          stamps={stampSlot()} fire={false} reason={null} />
      </LanguageProvider>,
    );
  }

  function renderAsJoiner() {
    return render(
      <LanguageProvider>
        <DishListRow item={sessionItem} rank={3} picked={false} onSelect={() => {}}
          stamps={stampSlot()} />
      </LanguageProvider>,
    );
  }

  it('renders the identical numbered-row anatomy for host and joiner: rank, name, price, ingredient/heaviness chips', () => {
    for (const { container } of [renderAsHost(), renderAsJoiner()]) {
      expect(container.querySelector('.scan-settle-row')).toBeTruthy();
      expect(container.querySelector('.scan-rank')?.textContent).toBe('3.');
      expect(container.textContent).toContain('XO醬炒蘿蔔糕');
      expect(container.textContent).toContain('$68');
      expect(container.querySelectorAll('.scan-chip').length).toBeGreaterThan(0); // diet + ingredient chips
      expect(container.querySelector('.heaviness-dots')).toBeTruthy();
      // A real chop, not a handles text line. Both roles, same anatomy.
      expect(container.querySelector('.chop-stamp-row')).toBeTruthy();
      expect(container.textContent).not.toContain('也選了');
      // banned anatomy: no cuisine chip, no fire mark, no inline pick button
      expect(container.querySelector('.scan-fire')).toBeFalsy();
      expect(container.querySelector('button')).toBeFalsy();
    }
  });

  it('host and joiner rows are now byte-identical — no slot has to be excused first', () => {
    const hostRoot = renderAsHost().container.querySelector('.scan-settle-row')!;
    const joinerRoot = renderAsJoiner().container.querySelector('.scan-settle-row')!;
    expect(joinerRoot.outerHTML).toBe(hostRoot.outerHTML);
  });

  it('neither screen renders a picker-handle text line anymore', () => {
    // The prop that rendered it is gone from the component; these assert no
    // caller quietly reintroduces the idea locally instead.
    expect(SCAN_SRC).not.toMatch(/alsopicked/);
    expect(TABLE_SRC).not.toMatch(/alsopicked/);
    // Precise, not a substring sweep — the component's comment explains what
    // `pickedBy` WAS and why it went, and a bare /pickedBy/ would flag that prose.
    expect(ROW_SRC).not.toMatch(/pickedBy\?:/);   // the prop declaration
    expect(ROW_SRC).not.toMatch(/pickedBy\.join/); // its rendering
  });
});
