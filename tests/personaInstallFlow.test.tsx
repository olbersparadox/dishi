// @vitest-environment jsdom
//
// Install-flow UI, owner-specified interaction (2026-07-23): the taste-form card
// morphs in place into the persona carousel (State B), host logos open the
// install layer (the SHARED ExplainModal), and the layer's black circle is the
// one-tap generate+copy action that also persists the persona. The old
// pick-to-copy textarea UI was killed on this replacement — these tests assert
// the new interaction AND that no textarea path survives.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TasteFormCard from '../src/components/TasteFormCard';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const BUDDY = {
  state: {
    version: { v: 2, live: 2, progress: 0.4, nextAt: 0.8, justUnlockedTo: null },
    strength: 91,
    elements: [], hint: { key: 'buddy.hint.rate' },
    knows: ['umami'], learning: [],
    stats: { ratings: 30, cuisines: 5, dims_explored: 9, dims_total: 18 },
    vector: { umami: 0.7 }, evidence: { umami: 1 }, profile_version: 2,
  },
  species: null,
};

// Solid, unlocked profile — the CTA must be tappable for the flow to open.
const dims = Object.fromEntries([...Array(9)].map((_, i) => [`d${i}`, 0.5]));
const cuisines = Object.fromEntries([...Array(5)].map((_, i) => [`c${i}`, 0.5]));

function mockFetch(onExport?: (body: any) => void, preview?: object) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/api/buddy')) return { ok: true, json: async () => BUDDY };
    if (String(url).includes('/api/taste/export')) {
      // GET = the read-only "what's new" preview; POST = the real export event.
      if ((init?.method ?? 'GET') === 'POST') {
        onExport?.(JSON.parse(String(init?.body ?? '{}')));
        return { ok: true, json: async () => ({ profile_version: 2, delta: [], is_first_export: false, companions: { named: [], unnamedCount: 0 } }) };
      }
      return {
        ok: true,
        json: async () => preview ?? { profile_version: 2, delta: [], is_first_export: true, new_companions: [] },
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

async function mount(onExport?: (body: any) => void, onPersisted?: (p: string) => void, preview?: object) {
  global.fetch = mockFetch(onExport, preview);
  render(
    <LanguageProvider>
      <TasteFormCard vector={dims} affinity={cuisines} count={30} dishes={[]}
        userId="u1" persona="spoon" name="Jerry" onPersonaPersisted={onPersisted as any} />
    </LanguageProvider>,
  );
  // The card renders nothing until /api/buddy resolves.
  await screen.findByRole('button', { name: /植入/ });
}

// jsdom has no PointerEvent constructor (clientX would arrive undefined), so
// dispatch MouseEvents carrying the pointer event TYPES — React's onPointer*
// handlers listen by type, and MouseEvent carries clientX fine.
const swipeLeft = (el: Element) => {
  fireEvent(el, new MouseEvent('pointerdown', { clientX: 200, bubbles: true }));
  fireEvent(el, new MouseEvent('pointermove', { clientX: 120, bubbles: true }));
  fireEvent(el, new MouseEvent('pointerup', { clientX: 120, bubbles: true }));
};

describe('State A → State B: the card morph', () => {
  it('tapping 植入 swaps version/bar/stats for the carousel; X restores them, nothing saved', async () => {
    await mount();
    // State A baseline: version legend + stat boxes visible, no persona name.
    expect(screen.getByText(/已識/)).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.queryByText('dishi.Spoon')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    // State B: carousel present (stored persona first), State A internals gone.
    expect(screen.getByText('dishi.Spoon')).toBeTruthy();
    expect(screen.queryByText(/已識/)).toBeNull();
    expect(screen.queryByText('91%')).toBeNull();
    expect(document.querySelectorAll('.persona-dot')).toHaveLength(3);
    expect(document.querySelectorAll('.persona-host-btn')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByText(/已識/)).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.queryByText('dishi.Spoon')).toBeNull();
    // Cancel persisted nothing — no export POST ever fired (the read-only GET
    // preview on mount is fine; only POST is the real export event).
    const posts = (global.fetch as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('/api/taste/export') && c[1]?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('swiping left advances Spoon → CK → Kiki with the dots following', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    const viewport = document.querySelector('.persona-viewport')!;
    const activeIdx = () =>
      Array.from(document.querySelectorAll('.persona-dot')).findIndex(d => d.classList.contains('on'));

    expect(activeIdx()).toBe(0);
    swipeLeft(viewport);
    expect(activeIdx()).toBe(1);
    swipeLeft(viewport);
    expect(activeIdx()).toBe(2);
    swipeLeft(viewport); // end of the rail — stays on Kiki
    expect(activeIdx()).toBe(2);
  });

  it('tapping the dots as a group advances one step and LOOPS 3rd → 1st (unlike swipe, which clamps)', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    const dots = screen.getByRole('button', { name: '下一個角色' });
    const activeIdx = () =>
      Array.from(document.querySelectorAll('.persona-dot')).findIndex(d => d.classList.contains('on'));

    expect(activeIdx()).toBe(0); // Spoon
    fireEvent.click(dots);
    expect(activeIdx()).toBe(1); // CK
    fireEvent.click(dots);
    expect(activeIdx()).toBe(2); // Kiki
    fireEvent.click(dots);
    expect(activeIdx()).toBe(0); // loops back to Spoon, not clamped
    expect(screen.getByText('dishi.Spoon')).toBeTruthy();
  });
});

describe('the install layer (shared ExplainModal)', () => {
  it('a host logo opens the layer titled dishi.{selected} → {host}, with that host’s steps', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    swipeLeft(document.querySelector('.persona-viewport')!); // → CK
    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));

    const dialog = screen.getByRole('dialog');
    // Accessible name carries persona + host even though the visible title is
    // composed (name, arrow, host logo image — no plain-text host name on screen).
    expect(dialog.getAttribute('aria-label')).toBe('植入 dishi.CK → Claude');
    expect(dialog.querySelector('.install-title-row')?.textContent).toContain('dishi.CK');
    // Instructions now render through .explain-modal-body (reusing the SAME
    // typography as every stat explainer), not a bespoke list — 書面 register,
    // steps numbered with circled digits.
    expect(dialog.querySelector('.explain-modal-body')).toBeTruthy();
    expect(dialog.textContent).toContain('② 命名為 dishi.CK');
    expect(dialog.textContent).toContain('Project');
  });

  it('the copy circle generates the doc in the SELECTED voice, copies it, persists the persona', async () => {
    const exportBodies: any[] = [];
    const persisted: string[] = [];
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (s: string) => { written.push(s); } }, configurable: true,
    });

    await mount(b => exportBodies.push(b), p => persisted.push(p));
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    swipeLeft(document.querySelector('.persona-viewport')!); // → CK
    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));
    fireEvent.click(screen.getByRole('button', { name: '複製' }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(exportBodies).toEqual([{ persona: 'ck' }]);   // swipe alone never persisted; copy did
    expect(persisted).toEqual(['ck']);
    expect(written[0]).toContain("# dishi — Jerry's AI palate");
    expect(written[0]).toContain('testimony');            // CK's voice, not Spoon's
    // Copied feedback appears (the minimal 已複製 swap, no celebration).
    expect(await screen.findByText('已複製')).toBeTruthy();
  });

  it('no legacy pick-to-copy path: the layer has no textarea anywhere', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ChatGPT' }));
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('§5 remainder: locked anticipation + the recurring delta line', () => {
  it('locked profile: anticipation copy + album fast track, NO dead disabled button', async () => {
    const onAlbum = vi.fn();
    global.fetch = mockFetch();
    render(
      <LanguageProvider>
        <TasteFormCard vector={{ umami: 0.5 }} affinity={{}} count={3} dishes={[]}
          userId="u1" persona="spoon" name="Jerry" onAlbumPath={onAlbum} />
      </LanguageProvider>,
    );
    const antic = await screen.findByText(/你的味蕾尚未成形/);
    expect(antic.textContent).toMatch(/再評 \d+ 味/); // the honest countdown, in the line itself
    // No export button exists at all in the locked state — not even disabled.
    expect(screen.queryByRole('button', { name: /植入/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '由相簿舊菜開始 →' }));
    expect(onAlbum).toHaveBeenCalled();
    // And the locked state never fires the read-only preview (nothing to say yet).
    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u: string) => u.includes('/api/taste/export'))).toBe(false);
  });

  it('unlocked with a prior export: shows the v{N} delta line + new-companions line, read-only', async () => {
    await mount(undefined, undefined, {
      profile_version: 3,
      delta: [{ dim: 'umami', dir: 1 }, { dim: 'sweet', dir: -1 }],
      is_first_export: false,
      new_companions: ['Ka Yan'],
    });
    expect(await screen.findByText(/v3 · 與上次相比：鮮味 ↑ · 甜 ↓/)).toBeTruthy();
    expect(screen.getByText('新檯友：Ka Yan')).toBeTruthy();
    // The preview must have come from GET — no POST (the real export event) fired.
    const posts = (global.fetch as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('/api/taste/export') && c[1]?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('first export (no prior baseline): no delta line — there is nothing to compare against', async () => {
    await mount(); // default preview: is_first_export true
    expect(screen.queryByText(/與上次相比/)).toBeNull();
  });
});
