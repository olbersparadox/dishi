// @vitest-environment jsdom
//
// "+ 加間舖" inside the table's restaurant sheet (the 餐廳未定 line on the scan and
// table screens) opened its form and destroyed it in the same commit.
//
// RestaurantPicker's onChange reports THE CURRENT PENDING CHOICE, and null is one of
// its values: toggleAdd fires onChange(null) to clear whatever chip was picked, since
// you cannot have a chip and the add form selected at once. MyDishes reads it that way
// and is fine. TableRestaurantLine instead read every onChange as a final ANSWER, and
// its answer for null was "close the sheet" — so the one tap that opens the form also
// unmounted the card the form lives in. Nothing on screen, hence "nothing happens".
//
// The distinction that was missing: an explicit 略過 tap is a user answer and should
// close; a pending-state clear is bookkeeping and must not.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import TableRestaurantLine from '../src/components/TableRestaurantLine';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// jsdom has no geolocation, so the picker lands in 'denied' — the add form does not
// need coords to OPEN (only to submit), which keeps this about the open/close bug.
const mount = (
  onChange = vi.fn(async () => {}),
  restaurant: { id: string; name: string; name_zh: string | null } | null = null,
) => render(
  <LanguageProvider>
    <TableRestaurantLine restaurant={restaurant} onChange={onChange} />
  </LanguageProvider>,
);

const byText = (c: HTMLElement, s: string) =>
  Array.from(c.querySelectorAll('button')).find(b => b.textContent?.includes(s));

describe('the table restaurant sheet', () => {
  it('opens the typed-name form when 加間舖 is tapped, and KEEPS it open', async () => {
    const view = mount();
    fireEvent.click(byText(view.container, '餐廳未定')!);
    await waitFor(() => expect(byText(view.container, '加間舖')).toBeTruthy());

    fireEvent.click(byText(view.container, '加間舖')!);

    // The regression: the sheet closed, taking the form with it.
    expect(byText(view.container, '加間舖'), 'the sheet closed on the tap that should open the form').toBeTruthy();
    expect(view.container.querySelector('input.field'), 'no name field — the add form never survived the tap').toBeTruthy();
  });

  // 略過 is "none of these, and I'm not typing one" (owner, 2026-08-01) — an answer
  // about the table, so it clears whatever restaurant was on it. The server reads null
  // as the clear and re-attributes the picks that were pointing at the old shop.
  it('clears the restaurant on 略過, and closes', async () => {
    const onChange = vi.fn(async () => {});
    const view = mount(onChange, { id: 'r1', name: 'Tsui Wah', name_zh: '翠華' });
    fireEvent.click(byText(view.container, '翠華')!);
    await waitFor(() => expect(byText(view.container, '略過')).toBeTruthy());

    fireEvent.click(byText(view.container, '略過')!);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    await waitFor(() => expect(byText(view.container, '略過')).toBeFalsy());
  });

  // A menu belongs to a business by definition, so "home cooking" was never a coherent
  // answer to which restaurant this table is at. It only existed here because it was
  // the sheet's clear; 略過 does that now.
  it('offers no 住家菜 — incoherent for a scanned menu', async () => {
    const view = mount();
    fireEvent.click(byText(view.container, '餐廳未定')!);
    await waitFor(() => expect(byText(view.container, '略過')).toBeTruthy());
    expect(byText(view.container, '住家菜')).toBeFalsy();
  });

  // Backing out without changing anything is now the line itself, and it must stay
  // non-destructive — otherwise merely looking at the sheet costs you the restaurant.
  it('collapses with no write when the line is tapped again', async () => {
    const onChange = vi.fn(async () => {});
    const view = mount(onChange);
    fireEvent.click(byText(view.container, '餐廳未定')!);
    await waitFor(() => expect(byText(view.container, '略過')).toBeTruthy());
    fireEvent.click(byText(view.container, '餐廳未定')!);
    expect(byText(view.container, '略過')).toBeFalsy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
