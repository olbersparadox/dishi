// The bill's method has to follow the game on EVERY 搖骰, not only the first.
//
// The live bug (owner, 2026-08-01), one cause with two faces. The
// `pay_method: 'game'` write sat INSIDE `if (!round)`, so a table that already had a
// round — one that had since gone to 隨機一人 and come back — left the database saying
// 'random' while every client optimistically showed the game. So:
//
//   1. the draw's leftover pay_payer_id was still on the session, and the settle
//      screen rendered it as the GAME's verdict ("你付這一餐" for a game that had
//      decided nothing);
//   2. ~15s later the write guard expired, the next poll read 'random' back, and the
//      whole table was pulled out of the game it was sitting in.
//
// Source-level, the house technique for wiring that fails silently: the failure is a
// row that is never written, which no unit test of the handler's return value sees.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');
const ROUTE = read('../src/app/api/table/[code]/dice/route.ts');
const SETTLE = read('../src/components/TableSettle.tsx');

/** The body of `if (action === 'roll') { … }`, brace-matched. */
function rollBlock(src: string): string {
  const start = src.indexOf("if (action === 'roll') {");
  expect(start, "roll branch not found").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('unbalanced roll branch');
}
/** The nested `if (!round) { … }` inside it — where the write used to hide. */
function creationBlock(roll: string): string {
  const start = roll.indexOf('if (!round) {');
  expect(start, 'creation branch not found').toBeGreaterThan(-1);
  let depth = 0;
  for (let i = roll.indexOf('{', start); i < roll.length; i++) {
    if (roll[i] === '{') depth++;
    else if (roll[i] === '}' && --depth === 0) return roll.slice(start, i + 1);
  }
  throw new Error('unbalanced creation branch');
}

describe('搖骰 moves the bill to the game every time, not just the first', () => {
  const roll = rollBlock(ROUTE);
  const creation = creationBlock(roll);

  it('writes pay_method on every roll', () => {
    expect(roll).toMatch(/pay_method: 'game'/);
  });

  it('and does it OUTSIDE round creation — the whole bug in one assertion', () => {
    // Re-nesting this is the regression. A second tap on a table that already has a
    // round would silently leave pay_method wherever it was.
    expect(creation).not.toMatch(/pay_method: 'game'/);
  });

  it('clears a payer the game has not named, so a stale draw cannot pose as its verdict', () => {
    expect(roll).toMatch(/pay_payer_id: null/);
    // But a finished round keeps the loser it named — re-entering must not erase it.
    expect(roll).toMatch(/round\?\.revealed_at \? \{\} :/);
  });

  it('only 開 ever writes a payer for this method', () => {
    // If any other branch started assigning pay_payer_id, "who pays" would stop
    // meaning "who lost".
    const writes = (ROUTE.match(/pay_payer_id: [^,\n}]+/g) ?? []).map(w => w.trim());
    expect(writes.sort()).toEqual(['pay_payer_id: null', 'pay_payer_id: outcome.loserId']);
  });
});

describe('the settle screen will not name a payer the game did not choose', () => {
  it('the game verdict is gated on the reveal naming that exact person', () => {
    // Belt and braces with the server fix above: during the optimistic window the
    // client has pay_method 'game' before any round exists, and a leftover payer
    // would otherwise render immediately.
    expect(SETTLE).toMatch(
      /payMethod === 'game' && payer && payer\.user_id === game\?\.reveal\?\.loserId/);
  });
});
