// @vitest-environment jsdom
//
// A scanned menu must survive leaving the Scan tab and coming back.
//
// The bottom nav is client-side <Link> navigation, so the JS heap lives on and
// lib/scanSession.ts's module-level snapshot is the restore path (deliberately not
// Web Storage — the requirement is "keep it until the user taps X or REFRESHES",
// and Web Storage would survive the refresh too). Nothing pinned that until now,
// which is how it could quietly stop working: React unmounts the page on a tab
// switch, and every piece of the menu lives in that component's useState.
//
// This mounts the REAL scan page, runs a real scan through the streaming endpoint,
// unmounts it exactly the way a tab switch does, and remounts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import { TranslationProvider } from '../src/lib/translation';
import { ScanPresetProvider } from '../src/lib/scanPreset';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
function dbChain(): any {
  const c: any = {};
  for (const m of ['select', 'eq', 'maybeSingle', 'single', 'upsert', 'insert', 'update', 'order', 'limit', 'in', 'not']) c[m] = () => c;
  c.then = (resolve: (v: any) => void) => resolve({ data: null, error: null });
  return c;
}
vi.mock('../src/lib/supabase/client', () => ({
  supabaseBrowser: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => dbChain(),
    channel: () => { const ch: any = { on: () => ch, subscribe: () => ch, send: () => {} }; return ch; },
    removeChannel: () => {},
  }),
}));
vi.mock('../src/lib/image', () => ({ normalizePhoto: async (f: File) => f }));
window.matchMedia = ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as any;

import ScanPage from '../src/app/scan/page';
import { clearScanSession } from '../src/lib/scanSession';

const encoder = new TextEncoder();
const scanItem = (n: number) => ({
  name: `Dish ${n}`, name_zh: `菜式${n}`, name_original: `皿${n}`,
  section: null, description: null, price: '$88', cuisine: 'japanese',
  hook: '', confidence: 1, diet: [], cooking_method: null, heaviness: null, ingredients: [],
});

afterEach(() => { cleanup(); clearScanSession(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mount = () => render(
  <LanguageProvider>
    <TranslationProvider>
      <ScanPresetProvider>
        <ScanPage />
      </ScanPresetProvider>
    </TranslationProvider>
  </LanguageProvider>,
);

describe('a scanned menu survives a tab switch', () => {
  it('is still on screen after the page unmounts and remounts', async () => {
    let streamCtrl!: ReadableStreamDefaultController<Uint8Array>;
    const send = (o: unknown) => streamCtrl.enqueue(encoder.encode(JSON.stringify(o) + '\n'));

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const p = String(url);
      if (p.includes('/api/menu-scan/enrich')) {
        const b = JSON.parse(init.body);
        return new Response(JSON.stringify({ item: { ...b.item, enriched: true } }), { status: 200 });
      }
      if (p.includes('/api/menu-scan/score')) {
        const b = JSON.parse(init.body);
        return new Response(JSON.stringify({ item: { ...b.item, match: 80, raw_score: 1, reason: null, caution: null, fire: false, attributes: {} } }), { status: 200 });
      }
      if (p.includes('/api/menu-scan')) {
        return new Response(new ReadableStream<Uint8Array>({ start(c) { streamCtrl = c; } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));

    const first = mount();
    const input = await waitFor(() => {
      const el = first.container.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!el) throw new Error('not mounted');
      return el;
    });
    fireEvent.change(input, { target: { files: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => { if (!streamCtrl) throw new Error('no stream'); });
    send({ kind: 'start', profile_ready: true, rating_count: 49, needed: 5, mock: false, phase: 'needs_scoring' });
    send({ kind: 'item', item: scanItem(1) });
    send({ kind: 'item', item: scanItem(2) });
    send({ kind: 'done' });
    streamCtrl.close();

    // The menu is on screen.
    await waitFor(() => expect(first.container.textContent).toContain('菜式1'));
    expect(first.container.textContent).toContain('菜式2');

    // Tap 食記 or 味 AI: client-side nav, so the heap survives but React unmounts
    // this page and every useState in it goes with it.
    cleanup();

    // Tap back into 掃餐牌.
    const second = mount();
    await waitFor(() => {
      const el = second.container.querySelector('input[type="file"]');
      // Either the menu is back, or we are staring at the capture screen again.
      if (!el && !second.container.textContent) throw new Error('still mounting');
    });
    expect(second.container.textContent, 'the scanned menu was lost on the way back')
      .toContain('菜式1');
  });
});
