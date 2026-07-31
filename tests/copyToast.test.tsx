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
const SURFACES = {
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
      expect(src, name).toMatch(/<Toast message=\{toast\.message\} onDone=\{toast\.onDone\} \/>/);
    }
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

describe('the table code says CODE copied, not link copied', () => {
  it('uses the code-specific string, and names the code in it', () => {
    // table.copied ("Link copied — send it to the table") is the INVITE's
    // confirmation. The code button has never put a link on the clipboard, so
    // reusing that string would be a lie about what was copied.
    expect(SURFACES['TableBar.tsx']).toMatch(/toast\.show\(t\('table\.codecopied', \{ code \}\)\)/);
    const dict = read('../src/lib/i18n-dict.ts');
    expect(dict).toMatch(/'table\.codecopied':[^}]*\{code\}/);
  });
});
