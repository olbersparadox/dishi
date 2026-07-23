// @vitest-environment jsdom
//
// Field-session fix 2026-07-23, item 1c: the 待評 pick-card had no photo slot
// at all — a scan/table pick (the normal no-photo case) had no way to attach
// one from the queue itself. The camera badge is the tap target, bottom-right
// of a passive thumbnail slot — never the whole tile — since the row already
// carries its own rate/delete actions.
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

describe('null photo_url — camera badge is the only add affordance', () => {
  it('renders the badge, not a "+" whole-tile tap target', () => {
    mount();
    expect(screen.getByLabelText('加相')).toBeTruthy();
    expect(screen.queryByText('+')).toBeNull();
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
