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
import Chop from '../src/components/Chop';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(cleanup);

const SCAN_SRC = readFileSync(path.resolve(__dirname, '../src/app/scan/page.tsx'), 'utf8');
const TABLE_SRC = readFileSync(path.resolve(__dirname, '../src/app/table/page.tsx'), 'utf8');

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

  // Mirrors scan/page.tsx's own DishListRow call site (src/app/scan/page.tsx:824).
  // fire/reason/pair are host-only extras scan legitimately has; everything else
  // must match the joiner call exactly.
  function renderAsHost() {
    return render(
      <LanguageProvider>
        <DishListRow item={sessionItem} rank={3} picked={false} onSelect={() => {}}
          pickedBy={['mosuko']} fire={false} reason={null} />
      </LanguageProvider>,
    );
  }

  // Mirrors table/page.tsx's own DishListRow call site.
  function renderAsJoiner() {
    return render(
      <LanguageProvider>
        <DishListRow item={sessionItem} rank={3} picked={false} onSelect={() => {}}
          pickedBy={['mosuko']}
          stamps={<span className="chop-stamp-row"><Chop name="mosuko" size={22} /></span>} />
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
      expect(container.textContent).toContain('mosuko 也選了');
      // banned anatomy: no cuisine chip, no fire mark, no inline pick button
      expect(container.querySelector('.scan-fire')).toBeFalsy();
      expect(container.querySelector('button')).toBeFalsy();
    }
  });

  it('the only rendered difference between host and joiner is the stamps slot — never a second implementation', () => {
    const hostRoot = renderAsHost().container.querySelector('.scan-settle-row')!;
    const joinerRoot = renderAsJoiner().container.querySelector('.scan-settle-row')!;
    joinerRoot.querySelector('.chop-stamp-row')?.remove(); // the one legitimate host/joiner difference
    expect(joinerRoot.outerHTML).toBe(hostRoot.outerHTML);
  });
});
