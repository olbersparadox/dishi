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

function mount(props: Partial<React.ComponentProps<typeof ExecutionSlider>> = {}) {
  const onDone = props.onDone ?? vi.fn();
  render(
    <LanguageProvider>
      <ExecutionSlider dish={DISH} min={1} max={10} onDone={onDone} {...props} />
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
    expect(document.querySelector('.duel-pair')).toBeTruthy();
  });
});

describe('deliberate divergences from a duel', () => {
  it('the sides are STATIC — tapping a dish must not answer anything', () => {
    // Duels wrap each side in a button meaning "I prefer this". Here the answer
    // is the slider; a tappable side would invite duel muscle memory to answer
    // a question this card is not asking.
    mount({ siblings: [{ dish: SIBLING, score: 8 }] });
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
    mount({ min: 1, max: 4 });
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(range.min).toBe('1');
    expect(range.max).toBe('4');
  });

  it('honours a server-supplied passing range', () => {
    mount({ min: 5, max: 10 });
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(range.min).toBe('5');
    expect(range.max).toBe('10');
  });

  it('starts mid-range so it never pre-accuses a kitchen', () => {
    mount({ min: 1, max: 4 });
    const range = document.querySelector('.exec-range') as HTMLInputElement;
    expect(Number(range.value)).toBeGreaterThanOrEqual(1);
    expect(Number(range.value)).toBeLessThanOrEqual(4);
  });
});

describe('answering and skipping', () => {
  it('POSTs the score and reports back that it was scored', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const onDone = mount({ min: 1, max: 10 });

    const range = document.querySelector('.exec-range') as HTMLInputElement;
    fireEvent.change(range, { target: { value: '2' } });
    (document.querySelector('.ok-circle') as HTMLButtonElement).click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ratings/execution');
    expect(JSON.parse(init.body)).toEqual({ dish_id: 'd1', execution_score: 2 });
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

  it('shows a previously-scored instance as context — the comparison IS the point', () => {
    mount({ siblings: [{ dish: SIBLING, score: 8 }] });
    expect(screen.getByText(/8/)).toBeTruthy();
    expect(document.querySelectorAll('.duel-option').length).toBe(2);
  });
});
