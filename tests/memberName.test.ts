// Names at a table came out lowercase ("peter") while the same person read "Jerry"
// in the feed and their dossier. Not a casing bug in the data: username_display has
// carried the as-typed casing all along (profiles_username_display_casing.sql), and
// feed/buddy/dossier were already reading it. The table surfaces went straight to
// `handle`, which is lowercased on purpose because it is a URL and the uniqueness
// key. One resolver now, so a surface cannot quietly opt out again.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { memberName } from '../src/lib/memberName';

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');

describe('memberName — the ladder', () => {
  it('prefers the as-typed casing over the canonical handle', () => {
    expect(memberName({ username_display: 'Jerry', handle: 'jerry' })).toBe('Jerry');
  });

  it('falls back to the handle when nothing was claimed', () => {
    expect(memberName({ handle: 'peter' })).toBe('peter');
    expect(memberName({ username_display: null, handle: 'peter' })).toBe('peter');
  });

  it('lets a real display name outrank both', () => {
    expect(memberName({ display_name: '陳大文', username_display: 'Jerry', handle: 'jerry' }))
      .toBe('陳大文');
  });

  it('treats an empty string as absent, not as a name', () => {
    // These are text columns a person can blank out; ?? would have shown "".
    expect(memberName({ display_name: '', username_display: 'Jerry', handle: 'jerry' })).toBe('Jerry');
    expect(memberName({ display_name: '', username_display: '', handle: 'jerry' })).toBe('jerry');
  });

  it('has a fallback for a missing profile, and lets the caller pick it', () => {
    expect(memberName(null)).toBe('someone');
    expect(memberName(undefined, '…')).toBe('…');
    expect(memberName({}, '…')).toBe('…');
  });
});

describe('every table surface goes through it', () => {
  it('no surface reads display_name ?? handle by hand any more', () => {
    // That expression IS the bug: it skips username_display entirely.
    for (const f of [
      '../src/components/TableSettle.tsx', '../src/components/TableWaitLayer.tsx',
      '../src/components/LiarsDice.tsx', '../src/lib/tableStamps.ts',
      '../src/lib/useTableSession.ts',
    ]) {
      expect(read(f), f).not.toMatch(/display_name \?\? [\w.?]*handle/);
    }
  });

  it('the table API actually sends the column, or the resolver has nothing to prefer', () => {
    const route = read('../src/app/api/table/[code]/route.ts');
    // Both reads: the roster, and the profiles join behind each pick's stamp.
    expect(route).toMatch(/select\('id, handle, display_name, username_display, username_set_at'\)/);
    expect(route).toMatch(/profiles\(handle, display_name, username_display\)/);
    // And carried out on the wire, not just fetched.
    expect(route).toMatch(/username_display: usernameDisplayById\.get/);
    expect(route).toMatch(/username_display: p\.profiles\?\.username_display/);
  });
});
