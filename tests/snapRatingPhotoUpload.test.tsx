// @vitest-environment jsdom
//
// Queued picks (menu-scan/table, rated via the 待評 queue) can reach the flick
// card with no photo at all — the placeholder used to be a dead end, rating
// blind against just the name. A circular upload badge, top-right of the
// placeholder (owner call, 2026-07-30, matching the annotated screenshot),
// lets a photo be attached right here, before the flick.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SnapRating from '../src/components/SnapRating';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(cleanup);

function mount(props: Partial<React.ComponentProps<typeof SnapRating>> = {}) {
  render(
    <LanguageProvider>
      <SnapRating photoUrl={null} onRate={vi.fn()} {...props} />
    </LanguageProvider>,
  );
}

describe('flick card — photo upload on the no-photo placeholder', () => {
  it('shows no upload badge when onAddPhoto is not given (album/camera flow — always has a photo)', () => {
    mount();
    expect(screen.queryByLabelText('加相')).toBeNull();
  });

  it('shows the badge over the placeholder when a pick has no photo yet', () => {
    mount({ onAddPhoto: vi.fn() });
    const label = screen.getByLabelText('加相');
    expect(label.className).toContain('snap-photo-upload');
    expect(document.querySelector('.flick-nophoto')?.contains(label)).toBe(true);
  });

  it('renders no badge once a photo exists, even if onAddPhoto is passed', () => {
    mount({ photoUrl: 'https://example.com/dish.jpg', onAddPhoto: vi.fn() });
    expect(screen.queryByLabelText('加相')).toBeNull();
  });

  it('fires onAddPhoto with the picked file', () => {
    const onAddPhoto = vi.fn();
    mount({ onAddPhoto });
    const file = new File(['x'], 'dish.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('加相').querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onAddPhoto).toHaveBeenCalledWith(file);
  });

  it('disables the input and shows a saving state while uploading', () => {
    mount({ onAddPhoto: vi.fn(), photoUploading: true });
    const input = screen.getByLabelText('加相').querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText('…')).toBeTruthy();
  });
});
