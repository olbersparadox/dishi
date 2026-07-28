// @vitest-environment jsdom
//
// Install-flow UI, taste-only (owner decision 5, built 2026-07-28): the
// taste-form card morphs in place into the install surface (State B), host
// logos open the install layer (the SHARED ExplainModal), and the layer's black
// circle is the one-tap generate+copy action. The persona carousel that lived
// in State B died with the persona-voiced export — these tests assert the new
// interaction AND that no voice-picking path survives. (Supersedes
// personaInstallFlow.test.tsx, deleted on this replacement per CLAUDE.md.)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TasteFormCard from '../src/components/TasteFormCard';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const BUDDY_STATE = {
  version: { v: 2, live: 2, progress: 0.4, nextAt: 0.8, justUnlockedTo: null },
  strength: 91,
  elements: [], hint: { key: 'buddy.hint.rate' },
  knows: ['umami'], learning: [],
  stats: { ratings: 30, cuisines: 5, dims_explored: 9, dims_total: 18 },
  vector: { umami: 0.7 }, evidence: { umami: 1 }, profile_version: 2,
};
// Claimed identity: the container carries the chosen name. `claimed: false`
// with a non-null username is the legacy email-derived-handle state — the doc
// must NEVER pick that string up (the leak the claim exists to end).
const CLAIMED = { username: 'jerry_c', claimed: true, changesLeft: 1 };
const UNCLAIMED = { username: 'mosuko', claimed: false, changesLeft: 1 };

// Solid, unlocked profile — the CTA must be tappable for the flow to open.
const dims = Object.fromEntries([...Array(9)].map((_, i) => [`d${i}`, 0.5]));
const cuisines = Object.fromEntries([...Array(5)].map((_, i) => [`c${i}`, 0.5]));

function mockFetch(identity: object, onExport?: (init?: RequestInit) => void, preview?: object) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/api/buddy')) {
      return { ok: true, json: async () => ({ state: BUDDY_STATE, species: null, identity }) };
    }
    if (String(url).includes('/api/taste/export')) {
      // GET = the read-only "what's new" preview; POST = the real export event.
      if ((init?.method ?? 'GET') === 'POST') {
        onExport?.(init);
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

async function mount(identity: object = CLAIMED, onExport?: (init?: RequestInit) => void, preview?: object) {
  global.fetch = mockFetch(identity, onExport, preview);
  render(
    <LanguageProvider>
      <TasteFormCard vector={dims} affinity={cuisines} count={30} dishes={[]} userId="u1" />
    </LanguageProvider>,
  );
  // The card renders nothing until /api/buddy resolves.
  await screen.findByRole('button', { name: /植入/ });
}

describe('State A → State B: the card morph', () => {
  it('tapping 植入 swaps version/bar/stats for the install surface; X restores them, nothing saved', async () => {
    await mount();
    // State A baseline: version legend + stat boxes visible, no install blurb.
    expect(screen.getByText(/已識/)).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.queryByText('將你的口味植入你日常用的 AI')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    // State B: the identity being installed + hosts; State A internals gone.
    expect(screen.getByText('將你的口味植入你日常用的 AI')).toBeTruthy();
    expect(screen.queryByText(/已識/)).toBeNull();
    expect(screen.queryByText('91%')).toBeNull();
    expect(document.querySelectorAll('.persona-host-btn')).toHaveLength(4);
    // No voice to choose: the carousel is gone, structurally.
    expect(document.querySelector('.persona-viewport')).toBeNull();
    expect(document.querySelectorAll('.persona-dot')).toHaveLength(0);
    expect(screen.queryByText('dishi.Spoon')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByText(/已識/)).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    // Cancel persisted nothing — no export POST ever fired (the read-only GET
    // preview on mount is fine; only POST is the real export event).
    const posts = (global.fetch as any).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('/api/taste/export') && c[1]?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('claimed: State B headlines the container name, dishi.{username}', async () => {
    await mount(CLAIMED);
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    // The State A identity row and State B's container line agree on the name —
    // naming your taste AI and installing it are one chain.
    expect(document.querySelector('.persona-name')?.textContent).toBe('dishi.jerry_c');
  });

  it('unclaimed: plain dishi — the legacy email-derived handle NEVER names the container', async () => {
    await mount(UNCLAIMED);
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    expect(document.querySelector('.persona-name')?.textContent).toBe('dishi');
    expect(screen.queryByText(/mosuko/)).toBeNull();
  });
});

describe('the install layer (shared ExplainModal)', () => {
  it('a host logo opens the layer titled {container} → {host}, with that host’s steps naming the container', async () => {
    await mount(CLAIMED);
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Claude' }));

    const dialog = screen.getByRole('dialog');
    // Accessible name carries container + host even though the visible title is
    // composed (name, arrow, host logo image — no plain-text host name on screen).
    expect(dialog.getAttribute('aria-label')).toBe('植入 dishi.jerry_c → Claude');
    expect(dialog.querySelector('.install-title-row')?.textContent).toContain('dishi.jerry_c');
    // Instructions render as real rows (.install-steps), 書面 register, circled
    // digits — and the naming step carries the SAME name the doc's summon line
    // will teach, so the two can't drift.
    expect(dialog.querySelector('.install-steps')).toBeTruthy();
    const steps = Array.from(dialog.querySelectorAll('.install-step-text')).map(el => el.textContent);
    expect(dialog.querySelector('.install-step-num')?.textContent).toBe('①');
    expect(steps[1]).toBe('命名為 dishi.jerry_c');
    expect(steps.join(' ')).toContain('Project');
  });

  it('the copy circle generates the taste-only doc, copies it, POSTs the export event without a persona', async () => {
    const exportInits: (RequestInit | undefined)[] = [];
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (s: string) => { written.push(s); } }, configurable: true,
    });

    await mount(CLAIMED, init => exportInits.push(init));
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));
    fireEvent.click(screen.getByRole('button', { name: '複製' }));

    await waitFor(() => expect(written).toHaveLength(1));
    // The POST is the real export event — and it carries no persona, because
    // there is no voice to commit (decision 5).
    expect(exportInits).toHaveLength(1);
    expect(exportInits[0]?.body ?? null).toBeNull();
    // The doc is headed by the claimed identity and free of character apparatus.
    expect(written[0]).toContain('# dishi.jerry_c — my AI palate');
    expect(written[0]).toContain('a space named dishi.jerry_c');
    expect(written[0]).not.toMatch(/Chime contract|## Arrival|## Meeting me/);
    // Copied feedback appears (the minimal 已複製 swap, no celebration).
    expect(await screen.findByText('已複製')).toBeTruthy();
  });

  it('unclaimed: the doc stays anonymous — the email-derived handle never reaches it', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (s: string) => { written.push(s); } }, configurable: true,
    });
    await mount(UNCLAIMED);
    fireEvent.click(screen.getByRole('button', { name: /植入/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));
    fireEvent.click(screen.getByRole('button', { name: '複製' }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toContain('# dishi — my AI palate');
    expect(written[0]).not.toContain('mosuko');
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
    global.fetch = mockFetch(CLAIMED);
    render(
      <LanguageProvider>
        <TasteFormCard vector={{ umami: 0.5 }} affinity={{}} count={3} dishes={[]}
          userId="u1" onAlbumPath={onAlbum} />
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
    await mount(CLAIMED, undefined, {
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
