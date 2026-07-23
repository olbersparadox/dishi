// @vitest-environment jsdom
//
// Backlog 2026-07-20 item 1: 加入 on a manually-typed restaurant name produced
// no visible change — selectedKey='manual-new' mapped to no rendered element,
// so a real Tin Wan field session lost picks that users reasonably believed
// had been confirmed. This test locks in the fix: a confirmed manual name
// renders as a real selected chip and the form collapses; tapping the chip
// again reopens it pre-filled for editing, not a re-type.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RestaurantPicker from '../src/components/RestaurantPicker';
import { LanguageProvider } from '../src/lib/i18n';

// jsdom doesn't implement scrollIntoView (real browsers do) — the picker calls
// it when the same-place/search-match nudges appear.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

afterEach(cleanup);

describe('RestaurantPicker — manual add produces a visible selected chip', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ restaurants: [] }),
    })) as unknown as typeof fetch;
  });

  it('after typing + 加入, a selected chip with the typed name appears and the form collapses; reopening preserves the text', async () => {
    const onChange = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} seedCoords={{ lat: 22.28, lng: 114.15 }} />
      </LanguageProvider>,
    );

    // seedCoords drives loadNearby's fetch; wait for it to resolve so `coords`
    // is set before we try to confirm (otherwise confirmNew's needloc guard fires).
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ 加間舖'));
    const input = screen.getByPlaceholderText('餐廳名');
    fireEvent.change(input, { target: { value: '新容記' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'new', name: '新容記' }),
      );
    });

    const chip = screen.getByRole('button', { name: '新容記' });
    expect(chip.className).toContain('on');
    // The add form is gone — no second "餐廳名" input left open behind the chip.
    expect(screen.queryByPlaceholderText('餐廳名')).toBeNull();

    fireEvent.click(chip);
    const reopened = screen.getByPlaceholderText('餐廳名') as HTMLInputElement;
    expect(reopened.value).toBe('新容記');
  });

  // Field-session fix 2026-07-23, item 1a: 加入 is now an icon-only circle —
  // idle (nothing typed) = outlined/muted, .filled (any text) = solid ink —
  // never vermillion (reserved for the seal glyph + AI-export CTA only).
  it('the 加入 circle toggles idle ↔ filled as the name field is typed', async () => {
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={vi.fn()} seedCoords={{ lat: 22.28, lng: 114.15 }} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ 加間舖'));
    const confirmBtn = screen.getByRole('button', { name: '加入' }) as HTMLButtonElement;
    expect(confirmBtn.className).toContain('picker-confirm-circle');
    expect(confirmBtn.className).not.toContain('filled');
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '新' } });
    expect(confirmBtn.className).toContain('filled');
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '' } });
    expect(confirmBtn.className).not.toContain('filled');
    expect(confirmBtn.disabled).toBe(true);
  });

  it('confirm with no coords flashes the needloc caption instead of silently failing', async () => {
    // No seedCoords and jsdom has no navigator.geolocation, so status resolves
    // to 'denied' and coords stays null — exercises the other silent path.
    const onChange = vi.fn();
    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText('+ 加間舖'));
    // Opening the add form itself fires onChange(null) (single-select reset) —
    // not the thing under test. What matters is confirm never fires onChange
    // with a 'new' choice while coords is missing.
    onChange.mockClear();
    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '新容記' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    expect(onChange).not.toHaveBeenCalled();
    const caption = screen.getByText('新舖需要開定位，Dishi 先可以幫其他人釘住個位。');
    expect(caption.className).toContain('needloc-flash');
  });
});

describe('RestaurantPicker — search-on-add (Places Text Search)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a name the local chip list misses still resolves via /api/restaurants/search, and picking a result carries its place_id', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/restaurants/search')) {
        return {
          ok: true,
          json: async () => ({
            restaurants: [{ place_id: 'g1', name: '新容記', lat: 22.281, lng: 114.151, address: null, distance_m: null, source: 'google' }],
          }),
        };
      }
      return { ok: true, json: async () => ({ restaurants: [] }) }; // nearby: nothing local
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} seedCoords={{ lat: 22.28, lng: 114.15 }} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ 加間舖'));
    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '新容記' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    // Search call fires with the typed query and the picker's coords.
    await waitFor(() => {
      const calls = (fetchMock as any).mock.calls as any[][];
      const call = calls.find(c => String(c[0]).includes('/api/restaurants/search'));
      expect(call).toBeTruthy();
      expect(String(call![0])).toContain(encodeURIComponent('新容記'));
      expect(String(call![0])).toContain('lat=22.28');
    });

    // The candidate shows in the nudge, NOT as an immediately-confirmed pick.
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'new', place_id: 'g1' }));
    const candidate = await screen.findByRole('button', { name: '新容記' });
    fireEvent.click(candidate);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'new', name: '新容記', place_id: 'g1', lat: 22.281, lng: 114.151 }),
    );
  });

  it('rejecting every search candidate ("not same") falls through to a manual create', async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/restaurants/search')) {
        return {
          ok: true,
          json: async () => ({ restaurants: [{ place_id: 'g1', name: 'Some Other Place', lat: 22.29, lng: 114.16, address: null, distance_m: null, source: 'google' }] }),
        };
      }
      return { ok: true, json: async () => ({ restaurants: [] }) };
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(
      <LanguageProvider>
        <RestaurantPicker onChange={onChange} seedCoords={{ lat: 22.28, lng: 114.15 }} />
      </LanguageProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ 加間舖'));
    fireEvent.change(screen.getByPlaceholderText('餐廳名'), { target: { value: '真.新開舖' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));

    await screen.findByRole('button', { name: 'Some Other Place' });
    fireEvent.click(screen.getByText('不是，是新的店'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new', name: '真.新開舖' }));
    });
    const chip = screen.getByRole('button', { name: '真.新開舖' });
    expect(chip.className).toContain('on');
  });
});
