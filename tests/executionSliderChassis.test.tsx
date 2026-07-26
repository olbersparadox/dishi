// @vitest-environment jsdom
//
// 佢哋整得點？ (execution slider, 2026-07-26) — chassis-identity tests in the
// house style (identityCardChassis.test.tsx precedent). The card must MOUNT the
// duel card's own side anatomy (DuelSide) rather than a lookalike, per the
// standing "comparison is the core product DNA" direction, AND its deliberate
// divergences must hold: static (non-tappable) sides, and a range the flick
// bounds rather than the card choosing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExecutionSlider from '../src/components/ExecutionSlider';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const SRC = readFileSync(path.resolve(__dirname, '../src/components/ExecutionSlider.tsx'), 'utf8');
const DUEL_SRC = readFileSync(path.resolve(__dirname, '../src/components/DuelOverlay.tsx'), 'utf8');

const DISH = { id: 'd1', name: 'Macaroni with ham', name_zh: '通心粉配火腿煎蛋', photo_url: null, restaurant: '茶餐廳' };
const SIBLING = { id: 'd2', name: 'Macaroni with ham', name_zh: '通心粉配火腿煎蛋', photo_url: null, restaurant: '另一間' };

const row = (dish: typeof DISH, min = 1, max = 10, value: number | null = null) => ({ dish, min, max, value });

function mount(rows = [row(DISH)], onDone = vi.fn()) {
  render(
    <LanguageProvider>
      <ExecutionSlider rows={rows} onDone={onDone} />
    </LanguageProvider>,
  );
  return onDone;
}

describe('chassis reuse is real — a lookalike must fail these', () => {
  it('mounts DuelSide from the same module the duel card does', () => {
    expect(SRC).toMatch(/import DuelSide.* from '\.\/DuelSide'/);
    expect(DUEL_SRC).toMatch(/import DuelSide.* from '\.\/DuelSide'/);
  });

  it('never re-implements the side anatomy inline', () => {
    // Markers that must live ONLY in DuelSide.tsx.
    expect(SRC).not.toContain('duel-photo');
    expect(SRC).not.toContain('DishName');
  });

  it('renders inside the duel card shell, not a parallel one', () => {
    mount();
    expect(document.querySelector('.duel-overlay')).toBeTruthy();
    expect(document.querySelector('.duel-card')).toBeTruthy();
    // Not .duel-pair: rows STACK here (each dish above its own scale) rather
    // than sitting side by side. The reuse that matters is the shell and the
    // side anatomy, which a lookalike would not have.
    expect(document.querySelector('.duel-option')).toBeTruthy();
  });
});

describe('deliberate divergences from a duel', () => {
  it('the sides are STATIC — tapping a dish must not answer anything', () => {
    // Duels wrap each side in a button meaning "I prefer this". Here the answer
    // is the slider; a tappable side would invite duel muscle memory to answer
    // a question this card is not asking.
    mount([row(SIBLING, 1, 10, 8), row(DISH)]);
    const options = Array.from(document.querySelectorAll('.duel-option'));
    expect(options.length).toBeGreaterThan(0);
    for (const el of options) expect(el.tagName).not.toBe('BUTTON');
  });

  it('carries no seal glyph — this card claims nothing in advance', () => {
    mount();
    expect(document.querySelector('.seal-stamp')).toBeNull();
  });
});

describe('the range is imposed by the flick, never chosen here', () => {
  it('honours a server-supplied failing range', () => {
    // A 唔會再食 flick caps the slider below the passing line, so the card
    // cannot be used to call that plate a 9.
    mount([row(DISH, 1, 4)]);
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(range.min).toBe('1');
    expect(range.max).toBe('4');
  });

  it('honours a server-supplied passing range', () => {
    mount([row(DISH, 5, 10)]);
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(range.min).toBe('5');
    expect(range.max).toBe('10');
  });

  it('starts mid-range so it never pre-accuses a kitchen', () => {
    mount([row(DISH, 1, 4)]);
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(Number(range.value)).toBeGreaterThanOrEqual(1);
    expect(Number(range.value)).toBeLessThanOrEqual(4);
  });
});

describe('answering and skipping', () => {
  it('POSTs the score and reports back that it was scored', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const onDone = mount([row(DISH, 1, 10)]);

    const range = document.querySelector('.exec-range') as HTMLInputElement;
    fireEvent.change(range, { target: { value: '2' } });
    (document.querySelector('.ok-circle') as HTMLButtonElement).click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ratings/execution');
    expect(JSON.parse(init.body)).toEqual({ scores: [{ dish_id: 'd1', execution_score: 2 }] });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true), { timeout: 1000 });
  });

  it('skipping is free — dismissing reports NOT scored and posts nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onDone = mount();
    (document.querySelector('.duel-x') as HTMLButtonElement).click();
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(false), { timeout: 1000 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the REFERENCE is a live slider, not a frozen label — comparison re-anchors', () => {
    // The point the owner corrected: judgement of the earlier plate legitimately
    // moves once the two sit side by side. A read-only score would destroy the
    // comparison this card exists to make.
    mount([row(SIBLING, 1, 10, 8), row(DISH, 1, 4)]);
    const ranges = Array.from(document.querySelectorAll('.exec-range')) as HTMLInputElement[];
    expect(ranges.length).toBe(2);
    expect(ranges[0].value).toBe('8');       // preset to what it was
    expect(ranges[0].disabled).toBe(false);  // ...but still movable
    expect(ranges[1].max).toBe('4');         // each row bounded by its OWN flick
  });

  it('sends BOTH scores, including a revised reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    mount([row(SIBLING, 1, 10, 8), row(DISH, 1, 4)]);
    const ranges = Array.from(document.querySelectorAll('.exec-range')) as HTMLInputElement[];
    fireEvent.change(ranges[0], { target: { value: '6' } }); // revised down on reflection
    fireEvent.change(ranges[1], { target: { value: '2' } });
    (document.querySelector('.ok-circle') as HTMLButtonElement).click();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scores: [{ dish_id: 'd2', execution_score: 6 }, { dish_id: 'd1', execution_score: 2 }],
    });
  });
});
