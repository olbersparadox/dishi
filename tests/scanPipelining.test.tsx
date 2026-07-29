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
import { clearScanSession } from '../src/lib/scanSession';

const encoder = new TextEncoder();

function scanItem(n: number) {
  return {
    name: `Dish ${n}`, name_zh: `菜式${n}`, name_original: `皿${n}`,
    section: null, description: null, price: null, cuisine: 'japanese',
    hook: '', confidence: 1, diet: [], cooking_method: null, heaviness: null, ingredients: [],
  };
}

// clearScanSession is the load-bearing one: the scan session is MODULE-level
// (deliberately — it survives tab switches, see lib/scanSession.ts), so a
// completed scan in one test leaves the next one mounting straight into the
// results view, where the file input is "add a page" and every dish dedupes
// as a duplicate. unstubAllGlobals likewise, since restoreAllMocks does not
// undo stubGlobal.
afterEach(() => { cleanup(); clearScanSession(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('scan stage pipelining', () => {
  it('fires enrich + score for a dish WHILE the skeleton stream is still open', async () => {
    let streamCtrl!: ReadableStreamDefaultController<Uint8Array>;
    let streamClosed = false;
    const sendLine = (obj: unknown) => streamCtrl.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

    const enrichCalls: any[] = [];
    const scoreCalls: any[] = [];
    const telemetry: any[] = [];

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
      if (path.includes('/api/scan-telemetry')) {
        telemetry.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
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

    // One latency record per scan, carrying every milestone — this is the
    // thing that makes the NEXT regression visible in a log line instead of
    // costing a forensic session (lib/scanTelemetry.ts).
    await waitFor(() => expect(telemetry).toHaveLength(1));
    const t = telemetry[0];
    expect(t.lang).toBe('japanese');
    expect(t.items).toBe(2);
    expect(t.append).toBe(false);
    // Every milestone reached, and the per-stage call samples are populated.
    for (const k of ['first_name', 'names_done', 'chips_done', 'recs_done']) {
      expect(typeof t.marks[k]).toBe('number');
    }
    expect(t.enrich.ok).toBe(2);
    expect(t.enrich.failed).toBe(0);
    expect(t.score.ok).toBe(2);
    expect(t.error).toBeUndefined();
  });

  it('KEEPS a dish’s chips when later dishes stream in behind it', async () => {
    // The clobber (live 2026-07-29): the item handler wrote a snapshot of the
    // local `items` transcript, which never carries stage 2/3 results — so
    // every newly streamed dish erased the chips of every dish already
    // enriched. Symptom was chips appearing then vanishing, ending with only
    // the last dish or two enriched, while telemetry honestly reported
    // enrich fail:0of18 — the calls succeeded, the UI discarded them.
    let streamCtrl!: ReadableStreamDefaultController<Uint8Array>;
    const sendLine = (obj: unknown) => streamCtrl.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
    const enrichedNames: string[] = [];

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const path = String(url);
      if (path.includes('/api/menu-scan/enrich')) {
        const body = JSON.parse(init.body);
        enrichedNames.push(body.item.name);
        // cooking_method is what actually PAINTS on a scan row: DishInfoDisplay
        // in hookOnly mode renders the cooking bucket into `.dish-hook`. So the
        // count of those elements is exactly "how many dishes visibly have
        // their chips" — the thing seen appearing and then vanishing.
        return new Response(JSON.stringify({
          item: { ...body.item, hook: 'Crisp', hook_zh: '脆', cooking_method: 'fried', ingredients: ['tofu'], enriched: true },
        }), { status: 200 });
      }
      if (path.includes('/api/menu-scan/score')) {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify({ item: { ...body.item, match: 80, raw_score: 1, reason: null, caution: null, fire: false, attributes: {} } }), { status: 200 });
      }
      if (path.includes('/api/scan-telemetry')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      if (path.includes('/api/menu-scan')) {
        return new Response(new ReadableStream<Uint8Array>({ start(c) { streamCtrl = c; } }), { status: 200 });
      }
      if (path.includes('/api/table')) return new Response(JSON.stringify({ code: 'ABCDE', session_id: 's1' }), { status: 200 });
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
    const input = await waitFor(() => {
      const el = container.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!el) throw new Error('file input not mounted yet');
      return el;
    });
    fireEvent.change(input, { target: { files: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => { if (!streamCtrl) throw new Error('scan stream not opened yet'); });
    sendLine({ kind: 'start', profile_ready: true, rating_count: 49, needed: 5, mock: false, phase: 'needs_scoring' });

    // Dish 1 streams in and finishes enriching BEFORE dish 2 arrives.
    sendLine({ kind: 'item', item: scanItem(1) });
    const enrichedRows = () => container.querySelectorAll('.dish-hook').length;
    await waitFor(() => expect(enrichedNames).toContain('Dish 1'));
    await waitFor(() => expect(enrichedRows()).toBe(1));

    // Dish 2 arrives behind it. THE PIN: dish 1's chips must still be on screen.
    // With the clobber this dropped straight back to 0.
    sendLine({ kind: 'item', item: scanItem(2) });
    await waitFor(() => expect(container.textContent).toContain('菜式2'));
    expect(enrichedRows()).toBeGreaterThanOrEqual(1);

    // And they must survive the post-stream metadata write too — that one fired
    // once, right after the stream, and erased everything at a stroke.
    sendLine({ kind: 'done', menu_language: 'japanese', restaurant_guess: null, elapsed_ms: 1000 });
    streamCtrl.close();
    await waitFor(() => expect(enrichedRows()).toBe(2)); // BOTH dishes keep theirs
  });

  it('records a FAILED enrichment rather than letting it vanish silently', async () => {
    // The 15 silent catch sites in the scan path are individually correct
    // ("a failed enrichment must never block the scan") but collectively made
    // degraded indistinguishable from fine. The failure count is what tells
    // those two apart.
    let streamCtrl!: ReadableStreamDefaultController<Uint8Array>;
    const sendLine = (obj: unknown) => streamCtrl.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
    const telemetry: any[] = [];

    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const path = String(url);
      if (path.includes('/api/menu-scan/enrich')) return new Response('nope', { status: 500 });
      if (path.includes('/api/menu-scan/score')) {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify({ item: { ...body.item, match: 80, raw_score: 1, reason: null, caution: null, fire: false, attributes: {} } }), { status: 200 });
      }
      if (path.includes('/api/scan-telemetry')) {
        telemetry.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (path.includes('/api/menu-scan')) {
        return new Response(new ReadableStream<Uint8Array>({ start(c) { streamCtrl = c; } }), { status: 200 });
      }
      if (path.includes('/api/table')) return new Response(JSON.stringify({ code: 'ABCDE', session_id: 's1' }), { status: 200 });
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
    const input = await waitFor(() => {
      const el = container.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!el) throw new Error('file input not mounted yet');
      return el;
    });
    fireEvent.change(input, { target: { files: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => { if (!streamCtrl) throw new Error('scan stream not opened yet'); });
    sendLine({ kind: 'start', profile_ready: true, rating_count: 49, needed: 5, mock: false, phase: 'needs_scoring' });
    sendLine({ kind: 'item', item: scanItem(1) });
    sendLine({ kind: 'done', menu_language: 'japanese', restaurant_guess: null, elapsed_ms: 500 });
    streamCtrl.close();

    await waitFor(() => expect(telemetry).toHaveLength(1));
    expect(telemetry[0].enrich.failed).toBe(1); // the broken stage is NAMED
    expect(telemetry[0].enrich.ok).toBe(0);
    expect(telemetry[0].score.ok).toBe(1);      // the healthy one still reads healthy
  });
});
