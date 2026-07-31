// @vitest-environment jsdom
//
// The copy confirmation is ONE pill, mounted everywhere — not a lookalike per
// surface. Owner ask (2026-07-31): tapping the table code should confirm "like
// the popup in 食記 when you share a dish". That popup turned out to be
// window.alert(), so the reuse rule (CLAUDE.md: mount the same component, never
// build something that resembles it) cut both ways — the journal was brought onto
// the shared pill rather than the table bar imitating an alert.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import Toast from '../src/components/Toast';

afterEach(cleanup);

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');
/** Every surface that confirms a copy. */
const SURFACES: Record<string, string> = {
  'TableBar.tsx': read('../src/components/TableBar.tsx'),
  'MyDishes.tsx': read('../src/components/MyDishes.tsx'),
  'FeedCard.tsx': read('../src/components/FeedCard.tsx'),
  'scan/page.tsx': read('../src/app/scan/page.tsx'),
  'table/page.tsx': read('../src/app/table/page.tsx'),
};

describe('one confirmation pill, mounted by every surface', () => {
  it('every copy-confirming surface imports and mounts the shared Toast', () => {
    for (const [name, src] of Object.entries(SURFACES)) {
      expect(src, name).toMatch(/import Toast, \{ useToast \} from '@\/components\/Toast'/);
      // onDone may be composed (the journal also clears which row it belongs to),
      // so assert the mount and the shared message source, not one exact spelling.
      expect(src, name).toMatch(/<Toast message=\{toast\.message\} onDone=\{/);
    }
  });

  it('anchors to the trigger, on the edge the trigger sits on', () => {
    // Owner, 2026-07-31: sharing the FIRST row must not confirm at the bottom of
    // the screen. Anchoring is per-trigger, and the edge matters — the panel has
    // to grow into the screen, not off it.
    expect(SURFACES['TableBar.tsx']).toMatch(/<Toast [^>]*anchor="left"/);
    expect(SURFACES['MyDishes.tsx']).toMatch(/<Toast [^>]*anchor="right"/);
  });

  it('the journal pill belongs to ONE row, and only that row', () => {
    // Guards two regressions: a list-level pill (confirming row 1's share at the
    // bottom of the screen), and BOTH mounts existing at once — which would show
    // two pills for one share.
    const src = SURFACES['MyDishes.tsx'];
    expect(src).toMatch(/toastDishId === d\.id && \(\s*<Toast/);
    expect(src.match(/<Toast/g) ?? []).toHaveLength(1);
  });

  it('NOTHING confirms a copy with alert() any more', () => {
    // The regression this guards: alert() is a blocking modal asking someone to
    // acknowledge that the thing they just asked for happened. One surface
    // slipping back to it re-splits the mechanism.
    for (const [name, src] of Object.entries(SURFACES)) {
      expect(src, name).not.toMatch(/alert\(/);
    }
  });

  it('nobody hand-rolls a second pill', () => {
    // A lookalike would style .toast-pill (or its own) directly instead of
    // mounting the component.
    for (const [name, src] of Object.entries(SURFACES)) {
      if (name === 'Toast.tsx') continue;
      expect(src, name).not.toMatch(/className="toast/);
    }
  });
});

describe('Toast behaviour', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<Toast message={null} onDone={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('announces politely without stealing focus', () => {
    render(<Toast message="已複製檯號 JBNBB" onDone={() => {}} />);
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.textContent).toBe('已複製檯號 JBNBB');
  });
});

describe('each surface confirms what it ACTUALLY copied', () => {
  const dict = read('../src/lib/i18n-dict.ts');

  it('the table code says CODE copied, and names the code', () => {
    // table.copied ("Link copied — send it to the table") is the INVITE's
    // confirmation. The code button has never put a link on the clipboard, so
    // reusing that string would be a lie about what was copied.
    expect(SURFACES['TableBar.tsx']).toMatch(/toast\.show\(t\('table\.codecopied', \{ code \}\)\)/);
    expect(dict).toMatch(/'table\.codecopied':[^}]*\{code\}/);
  });

  it('a DISH share never says "send it to the table"', () => {
    // The bug (owner, 2026-07-31): both dish surfaces borrowed table.copied, so
    // sharing a dish from 食記 told you to send it to a table you may not be at.
    for (const name of ['MyDishes.tsx', 'FeedCard.tsx']) {
      expect(SURFACES[name], name).toMatch(/toast\.show\(t\('share\.linkcopied'\)\)/);
      expect(SURFACES[name], name).not.toMatch(/toast\.show\(t\('table\.copied'\)\)/);
    }
    expect(dict).toMatch(/'share\.linkcopied': \{ zh: '已複製連結', en: 'Link copied' \}/);
  });

  it('the table INVITE keeps its table-specific line — it really is a table link', () => {
    for (const name of ['scan/page.tsx', 'table/page.tsx']) {
      expect(SURFACES[name], name).toMatch(/toast\.show\(t\('table\.copied'\)\)/);
    }
  });
});

describe('the link-only badge is gone from the journal', () => {
  it('only 公開 earns a glyph; link-only renders none', () => {
    // Owner, 2026-07-31: the chain link beside the globe read as a second kind of
    // "published", and Share silently makes a dish link-only — so it badged
    // something the person never chose. Knowingly reverses 152a4ec.
    expect(SURFACES['MyDishes.tsx']).toMatch(/d\.posted && d\.post_visibility !== 'link'/);
    expect(SURFACES['MyDishes.tsx']).not.toMatch(/LinkIcon/);
  });

  it('LinkIcon is not importable, so the confusion cannot be re-added by reflex', () => {
    expect(read('../src/components/icons.tsx')).not.toMatch(/export function LinkIcon/);
  });
});
