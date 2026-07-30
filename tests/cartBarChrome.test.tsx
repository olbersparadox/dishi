// @vitest-environment jsdom
//
// The cart bar's CHROME CONTRACT, locked so later feature work can't undo it by
// accident. Three properties, each of which was a deliberate decision and each of
// which is invisible in a diff that "just adds a line to the bar":
//
//   1. No plate. The bar is a black pill floating over the menu — no white
//      background, no top border, no backdrop blur (owner, 2026-07-30).
//   2. Taps pass through. Removing the visible plate is only half the job: the
//      container still spans the full width, so it must ignore pointer events and
//      hand them back to its children, or dish rows behind it become unclickable.
//      Deleting either half of that pair silently re-breaks it, which is exactly
//      the kind of thing a later change does while "cleaning up CSS".
//   3. The pill is the way to the rating queue — a real link, not the inert
//      receipt it used to be.
//
// DELIBERATELY NOT LOCKED: what the bar CONTAINS. The 埋單 endgame (docs/BACKLOG.md
// — 均分 equal split, 加一 toggle, ÷ headcount) is expected to add lines here, and
// `.cart-bar > *` covers new children automatically. Lock the contract, not the
// markup, or the next feature has to fight this file to ship.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import PickedCartBar from '../src/components/PickedCartBar';
import { LanguageProvider } from '../src/lib/i18n';

const CSS = readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8');

/** Every flat rule whose selector mentions `cls` as a whole class — so a later
 * override added ANYWHERE in the file is caught, not just the original block. */
function rulesFor(cls: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]+)\}/g;
  const whole = new RegExp(`\\.${cls}(?![\\w-])`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const selector = m[1].split('\n').pop()!.trim();
    if (whole.test(selector)) out.push({ selector, body: m[2] });
  }
  return out;
}

describe('cart bar chrome — the pill floats, and taps reach the menu behind it', () => {
  const barRules = rulesFor('cart-bar');

  it('finds the bar at all (guards this whole file against a silent rename)', () => {
    expect(barRules.length).toBeGreaterThan(0);
  });

  it('paints no plate: no background, no top border, no backdrop blur', () => {
    // It carried `background: #ffffffee; backdrop-filter: blur(8px); border-top:
    // 1px solid var(--line)` — a translucent white strip the owner asked to remove.
    for (const { selector, body } of barRules) {
      const decls = body.toLowerCase();
      expect(decls, `${selector} must not paint a background`).not.toMatch(/(^|[;\s])background(-color)?\s*:/);
      expect(decls, `${selector} must not draw a top border`).not.toMatch(/border-top\s*:\s*(?!0|none)/);
      expect(decls, `${selector} must not blur what's behind it`).not.toMatch(/backdrop-filter\s*:/);
    }
  });

  it('keeps the pass-through PAIR intact — container ignores taps, children take them', () => {
    // Both halves or neither. With only the first, the invisible full-width strip
    // eats taps on the dish rows now showing through it; with only the second,
    // nothing was ever ignoring them in the first place.
    const containerIgnores = barRules.some(r => /pointer-events\s*:\s*none/.test(r.body));
    expect(containerIgnores, '.cart-bar must set pointer-events: none').toBe(true);
    const childrenRestore = barRules.some(r =>
      /\.cart-bar\s*>\s*\*/.test(r.selector) && /pointer-events\s*:\s*auto/.test(r.body));
    expect(childrenRestore, '.cart-bar > * must set pointer-events: auto').toBe(true);
  });

  it('the pill still reads as the filled ink pill, full width', () => {
    const btn = rulesFor('cart-btn').map(r => r.body).join(' ');
    expect(btn).toMatch(/width\s*:\s*100%/);
    // .btn.primary supplies the ink fill; the bar must not be styled to override it.
    for (const { body } of rulesFor('cart-btn')) {
      expect(body.toLowerCase()).not.toMatch(/background(-color)?\s*:\s*(transparent|#fff|white)/);
    }
  });
});

describe('cart bar behaviour — it goes somewhere, and it is one shared component', () => {
  const renderBar = (picked: { key: string; price?: string | null }[]) =>
    render(<LanguageProvider><PickedCartBar picked={picked} /></LanguageProvider>);

  it('is a link to the rating queue, not an inert receipt', () => {
    // Both screens' copies were pointerEvents:'none' divs — "cannot go to next".
    const { container } = renderBar([{ key: 'a', price: '$88' }]);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/profile#to-rate');
    expect(link!.className).toContain('btn');
    expect(link!.className).toContain('primary');
  });

  it('renders nothing at all when no dish is picked (no empty floating pill)', () => {
    const { container } = renderBar([]);
    expect(container.querySelector('.cart-bar')).toBeNull();
  });

  it('counts each dish once even if the item list repeats a key', () => {
    // The scanner's local list is never deduped; a menu printing one name twice
    // would otherwise show an inflated count AND a double-counted bill.
    const { container } = renderBar([
      { key: 'dup', price: '$50' }, { key: 'dup', price: '$50' }, { key: 'other', price: '$30' },
    ]);
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('$80');
  });
});
