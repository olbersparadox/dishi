// The scan-shared menu must reach every member WHOLE.
//
// GET /api/table/[code] capped its ranked candidates at 15 unless
// `session.table_id` was set — but table_id is set only for QR/registered
// restaurant tables. Every scan-shared session therefore hit the cap, despite the
// code's own comment saying a real menu must never be truncated.
//
// Found by a two-account "add a page" test (owner, 2026-07-30): the joiner never
// saw the appended dishes, and re-joining showed 15 items mixed from both scans.
// The scanner never saw the problem because /scan renders its own local scan
// result rather than the session — the cap only ever hit the people who joined.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../src/app/api/table/[code]/route.ts'), 'utf8');

describe('GET /api/table/[code] — only the community pool is capped', () => {
  it('decides the cap on "has no menu at all", not on table_id', () => {
    expect(SRC).toMatch(/const isCommunityPool = !session\.table_id && !session\.menu_items;/);
    // The regression in one line: a session with menu_items must never be sliced.
    expect(SRC).not.toMatch(/session\.table_id\s*\n?\s*\?\s*rankForGroup\(candidates, members\)\s*\n?\s*:\s*rankForGroup\(candidates, members\)\.slice/);
  });

  it('applies slice(0, 15) only on the community-pool branch', () => {
    const decision = SRC.slice(SRC.indexOf('const isCommunityPool'), SRC.indexOf('const ranked') + 220);
    // The capped arm is the community one...
    expect(decision).toMatch(/isCommunityPool\s*\n?\s*\?\s*rankForGroup\(candidates, members\)\.slice\(0, 15\)/);
    // ...and the other arm ranks the full candidate list.
    expect(decision).toMatch(/:\s*rankForGroup\(candidates, members\);/);
  });

  it('still caps the community pool, which is open-ended by construction', () => {
    // The pool branch reads up to 100 recent dishes with no menu behind them —
    // ranking all of those at a table would be noise, so this cap must survive.
    expect(SRC).toMatch(/\.limit\(100\)/);
    expect(SRC).toMatch(/slice\(0, 15\)/);
  });
});
