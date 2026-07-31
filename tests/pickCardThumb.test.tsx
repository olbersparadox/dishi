// @vitest-environment jsdom
//
// Field-session fix 2026-07-23, item 1c: the 待評 pick-card had no photo slot
// at all — a scan/table pick (the normal no-photo case) had no way to attach
// one from the queue itself. Matched to the journal's own empty-photo tile
// 2026-07-30 (owner call: "follow the no photo case from Journey") — the
// whole tile is now the tap target (a `<label>`, same as MyDishes'
// journal-photo-add), showing a plain "+", not a corner camera badge.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PickCardThumb from '../src/components/PickCardThumb';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(cleanup);

function mount(props: Partial<React.ComponentProps<typeof PickCardThumb>> = {}) {
  const onPick = vi.fn();
  render(
    <LanguageProvider>
      <PickCardThumb photoUrl={null} uploading={false} onPick={onPick} {...props} />
    </LanguageProvider>,
  );
  return onPick;
}

describe('null photo_url — whole tile is the "+" add affordance', () => {
  it('renders a "+" label covering the whole tile', () => {
    mount();
    const label = screen.getByLabelText('加相');
    expect(label).toBeTruthy();
    expect(label.className).toContain('pick-card-thumb-add');
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('wires a picked file to onPick', () => {
    const onPick = mount();
    const file = new File(['x'], 'dish.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('加相').querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it('disables the input and shows a saving state while uploading', () => {
    mount({ uploading: true });
    const input = screen.getByLabelText('加相').querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText('…')).toBeTruthy();
  });
});

describe('photo-bearing pick — unchanged, no badge', () => {
  it('shows the photo and renders NO camera badge', () => {
    const { container } = render(
      <LanguageProvider>
        <PickCardThumb photoUrl="https://example.com/dish.jpg" uploading={false} onPick={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.queryByLabelText('加相')).toBeNull();
    const img = container.querySelector('.pick-card-thumb-img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/dish.jpg');
  });
});
