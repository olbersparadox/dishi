// @vitest-environment jsdom
//
// A scanned menu must survive leaving the Scan tab and coming back — AND a reload.
//
// Two layers, two failure modes, so both are pinned separately:
//   the module singleton covers a tab switch (client-side <Link>, heap intact) —
//     exercised against the REAL scan page, streamed through the real endpoint,
//     unmounted exactly the way a tab switch does, remounted;
//   sessionStorage covers a page RELOAD, which on a phone is not a deliberate act:
//     iOS discards backgrounded tabs, pull-to-refresh misfires, and the group flow
//     requires leaving the app to send a join code.
//
// Nothing pinned any of it until now, which is how it could quietly stop working.
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
import {
  clearScanSession, getScanSession, setScanSession,
  flushScanSession, __resetScanSessionModuleForTest,
} from '../src/lib/scanSession';

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

  it('survives a full PAGE RELOAD, which is what a phone actually does', async () => {
    // The case the module layer alone could never cover, and the one that costs real
    // sessions: iOS discarding a backgrounded tab, an accidental pull-to-refresh, or
    // coming back from the messenger app after sending a join code. The tab is the
    // same tab, so sessionStorage comes back with it.
    setScanSession({
      result: { items: [{ name: 'Dish 1', name_zh: '菜式1' }], profile_ready: true } as any,
      settled: false, keptNote: null, tableSession: { code: 'ABCDE', session_id: 's1' },
    });
    flushScanSession();

    // A reload keeps sessionStorage and destroys the JS heap. __resetForTest is the
    // heap going away; nothing else is touched.
    __resetScanSessionModuleForTest();
    expect(getScanSession<any>(), 'nothing came back from storage').toBeTruthy();
    const back = getScanSession<any>()!;
    expect(back.result.items[0].name_zh).toBe('菜式1');
    // The group re-hydrates silently off this: the code is all the poll needs to
    // bring back picks, members and the bill.
    expect(back.tableSession?.code).toBe('ABCDE');
  });

  it('the X clears BOTH layers, so a dismissal is not resurrected by a reload', () => {
    setScanSession({
      result: { items: [{ name_zh: '菜式1' }] } as any,
      settled: false, keptNote: null, tableSession: null,
    });
    flushScanSession();
    clearScanSession();
    __resetScanSessionModuleForTest();
    expect(getScanSession()).toBeNull();
  });
});
