// The username's table payoff, found unwired on the 2026-07-28 review
// (BACKLOG "Retire the ask-for-name card for claimed users"): the claim
// mechanically overwrites profiles.handle, so chops already show the chosen
// name — but the ask-for-name 名印 card kept firing for claimed users with no
// display_name, as if they had never named themselves. These pin the fix at
// the source level (the client component is auth-gated + polling, not a
// realistic render-test target) so the gate can't quietly regress back to
// "handle is non-empty" — every legacy profile has a handle, that's the leak
// hasClaimedUsername's own comment warns about.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TABLE_PAGE_SRC = readFileSync(path.resolve(__dirname, '../src/app/table/page.tsx'), 'utf8');
const TABLE_ROUTE_SRC = readFileSync(path.resolve(__dirname, '../src/app/api/table/[code]/route.ts'), 'utf8');

describe('table chop card — suppressed for claimed usernames', () => {
  it('the API derives username_claimed from hasClaimedUsername(username_set_at), not handle', () => {
    expect(TABLE_ROUTE_SRC).toMatch(/hasClaimedUsername\(p\.username_set_at/);
    expect(TABLE_ROUTE_SRC).toMatch(/username_claimed:/);
  });

  it("the chop card's own-row lookup checks username_claimed, not just display_name", () => {
    const chopGate = TABLE_PAGE_SRC.match(/state\.members\.find\(m => m\.user_id === state\.you[^)]*\)/)?.[0];
    expect(chopGate).toBeTruthy();
    expect(chopGate).toMatch(/!m\.display_name/);
    expect(chopGate).toMatch(/!m\.username_claimed/);
  });
});
