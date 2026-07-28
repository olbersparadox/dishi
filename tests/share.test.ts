// @vitest-environment jsdom
//
// The share chain, extracted from two call sites that had drifted apart
// (sharing batch, item 1). The behaviour worth pinning is the one they
// DISAGREED on: dismissing the OS share sheet. table/page.tsx used to fall
// through to the clipboard and alert about it, so backing out of the sheet
// silently copied a link you'd just declined to send. A dismissal is an
// answer, and these tests make regressing that a test failure.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink } from '../src/lib/share';

type NavStub = { share?: unknown; canShare?: unknown; clipboard?: unknown };
function stubNavigator(stub: NavStub) {
  Object.defineProperty(globalThis, 'navigator', { value: stub, configurable: true, writable: true });
}
const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

afterEach(() => { vi.restoreAllMocks(); });

describe('shareLink — sheet first, clipboard second', () => {
  it('hands the payload to the OS sheet when one exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } });

    expect(await shareLink({ url: 'https://dishi.me/jerry', title: 'dishi.jerry' })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ url: 'https://dishi.me/jerry', title: 'dishi.jerry' });
    // The whole point of the fallback being a FALLBACK: a successful share
    // must not also litter the clipboard.
    expect(writeText).not.toHaveBeenCalled();
  });

  it('DISMISSING the sheet cancels — it does not silently copy instead', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: vi.fn().mockRejectedValue(abort()), clipboard: { writeText } });

    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('a REAL share failure still gets the link into their hands', async () => {
    // Not an AbortError: no handler for the payload, or blocked outside a
    // gesture. They still want the link; they just cannot have the sheet.
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), clipboard: { writeText } });

    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://dishi.me/jerry');
  });

  it('no share sheet at all (desktop) falls straight to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } });

    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://dishi.me/jerry');
  });

  it('respects canShare rejecting a payload, rather than throwing at call time', async () => {
    // Safari exposes share() but refuses some payloads; asking first turns
    // that into a clean fallback instead of an error to classify.
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, canShare: vi.fn().mockReturnValue(false), clipboard: { writeText } });

    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });

  it('reports failure when NEITHER channel works, so a caller can say so', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('insecure context')) } });
    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('failed');

    stubNavigator({});
    expect(await shareLink({ url: 'https://dishi.me/jerry' })).toBe('failed');
  });
});

describe('no third copy of the share chain', () => {
  it('the two original call sites go through lib/share, not navigator.share', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['../src/app/scan/page.tsx', '../src/app/table/page.tsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src).toMatch(/from '@\/lib\/share'/);
      expect(src).not.toMatch(/navigator\.share/);
      expect(src).not.toMatch(/clipboard\.writeText/);
    }
  });
});
