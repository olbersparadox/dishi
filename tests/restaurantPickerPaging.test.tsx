// @vitest-environment jsdom
//
// "Next 10" (owner, 2026-08-07). Field report from Tsim Sha Tsui: the nearby list
// was accurate — every entry 19-21m away — and the shop actually wanted still was
// not in it. Ranking by distance does not help when the tenth nearest is 21m away;
// in that density the correct answer routinely sits just past the cut, and the
// person may have forgotten the name, so browsing further IS the recovery path.
//
// Places now returns up to 20 (billed per request, so the extra ten are free) and
// the picker reveals ten at a time. These pin the paging contract:
//   1. collapsed state shows exactly ten — identical to the pre-paging behaviour;
//   2. the reveal chip carries how many remain, and a tap shows them;
//   3. no chip when there is nothing more to show;
//   4. a NEW location collapses again rather than inheriting the expanded state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RestaurantPicker from '../src/components/RestaurantPicker';
import { LanguageProvider } from '../src/lib/i18n';

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

const EXIF = { lat: 22.28, lng: 114.15 };

/** n Google-sourced neighbours, each a metre further out than the last. */
const neighbours = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    source: 'google', place_id: `p${i}`, name: `Shop ${i}`,
    lat: 22.28, lng: 114.15, distance_m: 10 + i,
  }));

const stubFetch = (restaurants: any[]) => {
  const f = vi.fn(async () => ({ ok: true, json: async () => ({ restaurants }) }));
  global.fetch = f as unknown as typeof fetch;
  return f;
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('RestaurantPicker — paging through the nearby list', () => {
  beforeEach(() => { stubFetch(neighbours(23)); });

  it('shows ten first, then the rest on tap', async () => {
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 0')).toBeTruthy());

    // Collapsed: exactly the first ten, and the eleventh is genuinely absent
    // rather than merely scrolled out of view.
    expect(screen.getByText('Shop 9')).toBeTruthy();
    expect(screen.queryByText('Shop 10')).toBeNull();

    // The chip says how many are still hidden — 23 found, 10 shown.
    const more = screen.getByText('更多').closest('button')!;
    expect(more.textContent).toContain('13');

    fireEvent.click(more);
    expect(screen.getByText('Shop 19')).toBeTruthy();
    expect(screen.queryByText('Shop 20')).toBeNull();

    // Second tap exhausts the list and the chip retires.
    fireEvent.click(screen.getByText('更多').closest('button')!);
    expect(screen.getByText('Shop 22')).toBeTruthy();
    expect(screen.queryByText('更多')).toBeNull();
  });

  it('offers no reveal chip when ten is already everything', async () => {
    stubFetch(neighbours(10));
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 9')).toBeTruthy());
    expect(screen.queryByText('更多')).toBeNull();
  });

  // Expanding is about ONE place. Carrying it to the next lookup would open a
  // different neighbourhood pre-expanded for a question nobody asked yet.
  it('collapses again when a new location loads', async () => {
    const { rerender } = render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 0')).toBeTruthy());
    fireEvent.click(screen.getByText('更多').closest('button')!);
    expect(screen.getByText('Shop 19')).toBeTruthy();

    stubFetch(neighbours(23));
    rerender(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} photoOnly seedCoords={{ lat: 22.30, lng: 114.17 }} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Shop 10')).toBeNull());
    expect(screen.getByText('Shop 9')).toBeTruthy();
  });
});

// 略過 in 食記 was a silent no-op: both it and 住家菜 report a null/home choice, the
// caller's dirty check was `draftRestaurant !== null`, and so a dish attributed to a
// restaurant 1836m away could not be un-attributed from the very editor offering to
// fix it. Blank beats wrong. The picker half of that contract is pinned here; the
// save half lives in MyDishes.
describe('RestaurantPicker — 略過 and 住家菜 are answers, not silence', () => {
  beforeEach(() => { stubFetch(neighbours(3)); });

  it('略過 fires onNone alongside its null choice', async () => {
    const onChange = vi.fn(), onNone = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} onNone={onNone} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 0')).toBeTruthy());
    fireEvent.click(screen.getByText('略過'));
    expect(onNone).toHaveBeenCalledTimes(1);
    // Order matters: the null lands FIRST, so a caller that clears its
    // clear-intent on every choice still ends the tap with the intent set.
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('住家菜 reports {kind:"home"} and never fires onNone', async () => {
    const onChange = vi.fn(), onNone = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} onNone={onNone} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 0')).toBeTruthy());
    fireEvent.click(screen.getByText('住家菜'));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'home' });
    expect(onNone).not.toHaveBeenCalled();
  });

  // Un-picking is not an answer — it must retract the clear, not re-assert it.
  it('tapping 略過 twice retracts it without firing onNone again', async () => {
    const onChange = vi.fn(), onNone = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} onNone={onNone} photoOnly seedCoords={EXIF} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('Shop 0')).toBeTruthy());
    fireEvent.click(screen.getByText('略過'));
    fireEvent.click(screen.getByText('略過'));
    expect(onNone).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
