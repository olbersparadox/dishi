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
const mount = (onChange = vi.fn(async () => {})) => render(
  <LanguageProvider>
    <TableRestaurantLine restaurant={null} onChange={onChange} />
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

  it('still closes on an explicit 略過, which means leave it as it is', async () => {
    const onChange = vi.fn(async () => {});
    const view = mount(onChange);
    fireEvent.click(byText(view.container, '餐廳未定')!);
    await waitFor(() => expect(byText(view.container, '略過')).toBeTruthy());

    fireEvent.click(byText(view.container, '略過')!);

    expect(byText(view.container, '略過'), 'a 略過 tap should dismiss the sheet').toBeFalsy();
    // Dismissing a correction is never destructive: nothing is saved.
    expect(onChange).not.toHaveBeenCalled();
  });
});
