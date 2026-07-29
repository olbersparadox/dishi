// @vitest-environment jsdom
//
// STAGE 2/3 ARE PIPELINED INTO STAGE 1 (2026-07-29). The regression this pins:
// a Japanese menu's skeleton stream stalled after its last item and held the
// connection to the full stream timeout — and because enrichment/scoring used
// to be kicked off only after the stream ENDED, chips and recommendations
// trailed the visible menu by minutes on the app's core loop.
//
// The pin is behavioral, on the REAL scan page: the /api/menu-scan response is
// a hand-controlled NDJSON stream that is deliberately HELD OPEN, and the test
// asserts the per-dish /enrich and /score calls fire while it is still open —
// the exact thing the old post-stream sequencing could never do.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import { TranslationProvider } from '../src/lib/translation';
import { ScanPresetProvider } from '../src/lib/scanPreset';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
// AuthGate must see a session, and normalizePhoto needs canvas jsdom lacks.
// `from` is a thenable no-op chain: ensureProfile (AuthGate's side effect)
// probes/creates a profile row, and this test has no DB to answer with.
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
  }),
}));
vi.mock('../src/lib/image', () => ({ normalizePhoto: async (f: File) => f }));

// jsdom has no matchMedia; ScanBenefitDemo checks prefers-reduced-motion.
window.matchMedia = ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as any;

import ScanPage from '../src/app/scan/page';

const encoder = new TextEncoder();

function scanItem(n: number) {
  return {
    name: `Dish ${n}`, name_zh: `菜式${n}`, name_original: `皿${n}`,
    section: null, description: null, price: null, cuisine: 'japanese',
    hook: '', confidence: 1, diet: [], cooking_method: null, heaviness: null, ingredients: [],
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('scan stage pipelining', () => {
  it('fires enrich + score for a dish WHILE the skeleton stream is still open', async () => {
    let streamCtrl!: ReadableStreamDefaultController<Uint8Array>;
    let streamClosed = false;
    const sendLine = (obj: unknown) => streamCtrl.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

    const enrichCalls: any[] = [];
    const scoreCalls: any[] = [];

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const path = String(url);
      if (path.includes('/api/menu-scan/enrich')) {
        const body = JSON.parse(init.body);
        enrichCalls.push({ item: body.item, streamOpenAtCall: !streamClosed });
        return new Response(JSON.stringify({ item: { ...body.item, hook: 'Crisp', hook_zh: '脆', enriched: true } }), { status: 200 });
      }
      if (path.includes('/api/menu-scan/score')) {
        const body = JSON.parse(init.body);
        scoreCalls.push({ item: body.item, streamOpenAtCall: !streamClosed });
        return new Response(JSON.stringify({ item: { ...body.item, match: 80, raw_score: 1, reason: null, caution: null, fire: false, attributes: {} } }), { status: 200 });
      }
      if (path.includes('/api/menu-scan')) {
        const stream = new ReadableStream<Uint8Array>({ start(c) { streamCtrl = c; } });
        return new Response(stream, { status: 200 });
      }
      if (path.includes('/api/table')) {
        return new Response(JSON.stringify({ code: 'ABCDE', session_id: 's1' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mock' }));

    const { container } = render(
      <LanguageProvider>
        <TranslationProvider>
          <ScanPresetProvider>
            <ScanPage />
          </ScanPresetProvider>
        </TranslationProvider>
      </LanguageProvider>,
    );

    // Signed-in gate resolves async; the capture screen's file input appears.
    const input = await waitFor(() => {
      const el = container.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!el) throw new Error('file input not mounted yet');
      return el;
    });
    fireEvent.change(input, { target: { files: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })] } });

    // Server contract: 'start' first, then items as each closes.
    await waitFor(() => { if (!streamCtrl) throw new Error('scan stream not opened yet'); });
    sendLine({ kind: 'start', profile_ready: true, rating_count: 49, needed: 5, mock: false, phase: 'needs_scoring' });
    sendLine({ kind: 'item', item: scanItem(1) });

    // THE PIN: dish 1's stage-2/3 calls fire now — the stream is still open
    // (the old sequencing waited for 'done', so these were zero until close).
    await waitFor(() => {
      expect(enrichCalls.length).toBe(1);
      expect(scoreCalls.length).toBe(1);
    });
    expect(streamClosed).toBe(false);
    expect(enrichCalls[0].streamOpenAtCall).toBe(true);
    expect(scoreCalls[0].streamOpenAtCall).toBe(true);
    expect(enrichCalls[0].item.name).toBe('Dish 1');

    // A second dish streams in later — its calls fire too, still mid-stream.
    sendLine({ kind: 'item', item: scanItem(2) });
    await waitFor(() => {
      expect(enrichCalls.length).toBe(2);
      expect(scoreCalls.length).toBe(2);
    });
    expect(streamClosed).toBe(false);

    // Stream ends normally; the scan settles without duplicate stage calls.
    sendLine({ kind: 'done', menu_language: 'japanese', restaurant_guess: null, elapsed_ms: 1000 });
    streamClosed = true;
    streamCtrl.close();

    await waitFor(() => {
      // Settled view: both dishes visible with their enriched hooks merged in.
      expect(container.textContent).toContain('菜式1');
      expect(container.textContent).toContain('菜式2');
    });
    expect(enrichCalls.length).toBe(2); // per dish exactly once — pipelining, not duplication
    expect(scoreCalls.length).toBe(2);
  });
});
