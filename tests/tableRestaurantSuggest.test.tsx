// @vitest-environment jsdom
//
// The confirm-chip half of printed-name attribution (batch "attribution & naming
// accuracy" item 1): when the gate couldn't auto-adopt but the menu named a place
// the search resolved, the restaurant line offers ONE chip — 在{name}嗎？ — and a
// tap commits it through the exact same onChange path every other answer takes.
//
// The do-not-destabilize constraint, made mechanical here: with no suggestion the
// line must render EXACTLY what it rendered before the prop existed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import TableRestaurantLine from '../src/components/TableRestaurantLine';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const CHOICE = { kind: 'new' as const, name: 'Tsui Wah', lat: 22.28, lng: 114.19, place_id: 'pl-tw' };
const SUGGESTION = { name: '翠華餐廳', choice: CHOICE };

const mount = (props: Record<string, unknown> = {}, onChange = vi.fn(async () => {})) => ({
  onChange,
  view: render(
    <LanguageProvider>
      <TableRestaurantLine restaurant={null} onChange={onChange} {...props} />
    </LanguageProvider>,
  ),
});
const chip = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('button')).find(b => b.textContent?.includes('翠華餐廳'));

describe('the printed-name confirm chip', () => {
  it('offers the scanned name as a question, and a tap commits that place', async () => {
    const { view, onChange } = mount({ suggestion: SUGGESTION });
    const b = chip(view.container)!;
    expect(b, 'no confirm chip rendered').toBeTruthy();
    expect(b.textContent).toContain('在');
    expect(b.textContent).toContain('嗎？');

    fireEvent.click(b);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(CHOICE));
  });

  it('quiescence: without a suggestion the DOM is identical to before the prop existed', () => {
    const withNull = mount({ suggestion: null }).view.container.innerHTML;
    const withoutProp = mount({}).view.container.innerHTML;
    expect(withNull).toBe(withoutProp);
    expect(withNull).not.toContain('翠華');
  });

  it('disappears once the restaurant is set — it answers a question that no longer exists', () => {
    const { view } = mount({
      suggestion: SUGGESTION,
      restaurant: { id: 'r1', name: 'Tsui Wah', name_zh: '翠華餐廳' },
    });
    // The NAME still shows (on the line itself); the QUESTION must not.
    expect(view.container.textContent).toContain('翠華餐廳');
    expect(view.container.textContent).not.toContain('嗎？');
  });

  it('never renders on a QR/registered table — not a diner\'s to set there either', () => {
    const { view } = mount({ suggestion: SUGGESTION, editable: false, restaurant: null });
    expect(chip(view.container)).toBeFalsy();
  });

  it('yields to the open sheet rather than sitting beside a second chip row', async () => {
    const { view } = mount({ suggestion: SUGGESTION });
    fireEvent.click(
      Array.from(view.container.querySelectorAll('button')).find(b => b.textContent?.includes('餐廳未定'))!,
    );
    await waitFor(() =>
      expect(view.container.textContent).toContain('這一檯在哪間餐廳'));
    expect(chip(view.container)).toBeFalsy();
  });
});
