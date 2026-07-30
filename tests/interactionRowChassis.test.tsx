// @vitest-environment jsdom
//
// The interactions feed's row (2026-07-29) — house-style chassis-identity tests
// (executionSliderChassis.test.tsx precedent). Two host surfaces list these
// rows, the bell as text and the journal's 今日 strip as the photo pair, and
// they used to carry byte-identical row markup side by side. They now mount ONE
// InteractionRow with two variants; these tests fail if either surface re-grows
// its own row, and — the reason the split matters — if the WORDING logic forks.
//
// The wording is where the bug was: 佢哋整得點？ is offered for two different
// comparisons (one dish at two shops, or one shop across two visits) and the
// single old line said 「邊間」, "which shop", for both.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import InteractionRow, { execComparisonKind } from '../src/components/InteractionRow';
import { LanguageProvider } from '../src/lib/i18n';
import { dict } from '../src/lib/i18n-dict';
import type { Interaction } from '../src/lib/useInteractions';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const src = (f: string) => readFileSync(path.resolve(__dirname, `../src/components/${f}`), 'utf8');
const BELL = src('NotificationBell.tsx');
const DAILY = src('DailyInteractions.tsx');

type Dish = {
  id: string; name: string; name_zh: string | null; photo_url: string | null;
  restaurant: string | null; restaurant_id: string | null;
};
const A: Dish = { id: 'a', name: 'Egg tart', name_zh: '蛋撻', photo_url: 'https://x/a.jpg', restaurant: '泰昌餅家', restaurant_id: 'r1' };
const B: Dish = { id: 'b', name: 'Egg tart', name_zh: '蛋撻', photo_url: 'https://x/b.jpg', restaurant: '檀島咖啡', restaurant_id: 'r2' };
/** Same venue as A, a later visit — the shape the old copy got wrong. */
const A2 = { ...A, id: 'a2', photo_url: 'https://x/a2.jpg' };

const duel = (a: Dish = A, b: Dish = B, rematch = false): Interaction => ({ kind: 'duel', duel: { id: 'x', a, b }, rematch });
const exec = (a: Dish = A, b: Dish = B): Interaction => ({
  kind: 'execution',
  rows: [{ dish: a, min: 1, max: 10, value: null, verdictScore: 0.35 }, { dish: b, min: 1, max: 4, value: null, verdictScore: 0.35 }],
});

function mount(n: Interaction, variant: 'text' | 'pair' = 'text') {
  const { container } = render(
    <LanguageProvider>
      <InteractionRow interaction={n} variant={variant}
        role={variant === 'text' ? 'menuitem' : 'listitem'} onClick={vi.fn()} />
    </LanguageProvider>,
  );
  return container;
}

describe('one row module, two hosts — a lookalike must fail these', () => {
  it('both host surfaces mount InteractionRow from the same module', () => {
    for (const [name, s] of [['NotificationBell', BELL], ['DailyInteractions', DAILY]] as const) {
      expect(s, `${name} does not import the row`).toMatch(/import InteractionRow from '\.\/InteractionRow'/);
      expect(s, `${name} does not mount the row`).toMatch(/<InteractionRow\b/);
    }
  });

  it('neither host re-implements the row anatomy or its wording', () => {
    // Markers that must live ONLY in InteractionRow.tsx.
    for (const [name, s] of [['NotificationBell', BELL], ['DailyInteractions', DAILY]] as const) {
      expect(s, `${name} re-declares the row markup`).not.toContain('notif-item-line');
      expect(s, `${name} re-declares the thumbnails`).not.toContain('notif-thumbs');
      expect(s, `${name} re-declares the row button`).not.toContain('notif-item"');
      expect(s, `${name} builds its own copy`).not.toContain('notif.exec.sub');
      expect(s, `${name} builds its own copy`).not.toContain('notif.duel.sub');
    }
  });

  it('each host asks for the variant its width can carry', () => {
    expect(BELL, 'the 300px dropdown cannot fit a photo pair AND text').toMatch(/variant="text"/);
    expect(DAILY).toMatch(/variant="pair"/);
  });
});

describe('the wording names the comparison it is actually making', () => {
  it('classifies by venue id, not by name — HK chains share branch names', () => {
    expect(execComparisonKind([A, { ...B, restaurant: A.restaurant }])).toBe('cross');
    expect(execComparisonKind([A, A2])).toBe('same');
  });

  it('falls back to place-free wording when a venue is unknown (home cooking)', () => {
    const home = { ...A, restaurant: null, restaurant_id: null };
    expect(execComparisonKind([home, { ...home, id: 'h2' }])).toBe('again');
    expect(execComparisonKind([A, home]), 'one side missing a venue').toBe('again');
  });

  it('one shop across two visits never asks which shop — it names the shop and asks about the standard', () => {
    const text = mount(exec(A, A2)).textContent ?? '';
    expect(text).toContain('泰昌餅家');
    expect(text).toContain('蛋撻');
    expect(text, 'asked which SHOP about a single shop').not.toMatch(/[邊哪]間(?!餐廳)/);
  });

  it('two shops does ask which one, and never claims a single venue', () => {
    const text = mount(exec(A, B)).textContent ?? '';
    expect(text).toContain('兩間餐廳');
    expect(text).toContain('哪間');
  });

  it('never renders an unsubstituted placeholder', () => {
    for (const pair of [exec(A, A2), exec(A, B), exec({ ...A, restaurant: null, restaurant_id: null }, { ...B, restaurant: null, restaurant_id: null })]) {
      expect(mount(pair).textContent ?? '').not.toMatch(/\{(dish|place)\}/);
      cleanup();
    }
  });

  it('every execution variant is written in both languages', () => {
    for (const k of ['same', 'cross', 'again']) {
      expect(dict, `notif.exec.sub.${k} missing`).toHaveProperty(`notif.exec.sub.${k}`);
    }
    expect(dict, 'the imprecise single line outlived its replacement').not.toHaveProperty('notif.exec.sub');
  });
});

describe('variants', () => {
  it('text: ONE line carrying the whole ask — no heading above it, no photos', () => {
    const c = mount(duel());
    expect(c.querySelector('.notif-item-line')?.textContent).toBe(dict['notif.duel.sub'].zh);
    expect(c.textContent, 'a second text node crept in').toBe(dict['notif.duel.sub'].zh);
    expect(c.querySelectorAll('img')).toHaveLength(0);
  });

  it('text: a rematch says so instead of the standing line', () => {
    expect(mount(duel(A, B, true)).textContent).toContain(dict['notif.duel.rematch'].zh);
  });

  it('pair: one photo per dish with VS between them, and no words', () => {
    const c = mount(exec(), 'pair');
    expect(c.querySelectorAll('img.notif-thumb')).toHaveLength(2);
    expect(c.querySelector('.notif-vs')?.textContent).toBe('VS');
    expect(c.textContent).toBe('VS');
  });

  it('pair: a dish with no photo still holds its side', () => {
    const c = mount(duel(A, { ...B, photo_url: null }), 'pair');
    expect(c.querySelectorAll('img.notif-thumb')).toHaveLength(1);
    expect(c.querySelectorAll('.notif-thumb-blank')).toHaveLength(1);
    expect(c.querySelectorAll('.notif-vs')).toHaveLength(1);
  });

  it('pair: names the ask and both dishes to a screen reader', () => {
    mount(exec(), 'pair');
    const label = screen.getByRole('listitem').getAttribute('aria-label') ?? '';
    expect(label).toContain(dict['exec.title'].zh);
    expect(label).toContain('蛋撻');
  });

  it('neither variant badges the row with 印 or 比', () => {
    for (const v of ['text', 'pair'] as const) {
      const text = mount(duel(), v).textContent ?? '';
      expect(text).not.toContain('印');
      expect(text).not.toContain('比');
      cleanup();
    }
  });
});
