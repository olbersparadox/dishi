// @vitest-environment jsdom
//
// The table-session chassis: /scan and /table must MOUNT one engine and one stamp
// row, never two implementations that look alike. Same house technique as
// executionSliderChassis / tableComponentIdentity — source-level assertions for
// "reuse is real", plus render assertions on the shared anatomy.
//
// This exists because of a two-account field test (2026-07-30) where the scanner
// and the joiner were, in effect, running different products:
//   1. the scanner's picks never reached the server at all (local Set + a 3-step
//      confirm sheet) so the joiner saw nothing — verified in the DB, both picks
//      on session SA9YZ belonged to the joiner and the host had written zero rows;
//   2. the scanner had no realtime channel, so everything arrived up to 5s late;
//   3. the scanner saw picker handles as a text line where /table showed chops.
// Three symptoms, one cause. Each numbered case below pins one of them, and this
// file replaces tests/scanPickConfirmCancel.test.ts, whose subject (the confirm
// sheet) is deliberately gone.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import ChopStampRow, { STAMP_CAP } from '../src/components/ChopStampRow';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(cleanup);

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');
const SCAN_SRC = read('../src/app/scan/page.tsx');
const TABLE_SRC = read('../src/app/table/page.tsx');
const ENGINE_SRC = read('../src/lib/useTableSession.ts');
const ROW_SRC = read('../src/components/ChopStampRow.tsx');

describe('one engine — both screens mount useTableSession', () => {
  it('both screens import it from the same module', () => {
    expect(SCAN_SRC).toMatch(/import \{ useTableSession[^}]*\} from '@\/lib\/useTableSession'/);
    expect(TABLE_SRC).toMatch(/import \{ useTableSession[^}]*\} from '@\/lib\/useTableSession'/);
  });

  // Case 2: the scanner had no realtime at all. These markers must live ONLY in
  // the engine — a screen growing its own channel or its own poll is the exact
  // divergence that produced the 5s lag.
  it('neither screen owns a realtime channel of its own', () => {
    expect(ENGINE_SRC).toMatch(/supabase\.channel\(`table:/);
    expect(SCAN_SRC).not.toMatch(/\.channel\(/);
    expect(TABLE_SRC).not.toMatch(/\.channel\(/);
    expect(SCAN_SRC).not.toMatch(/broadcast/);
    expect(TABLE_SRC).not.toMatch(/broadcast/);
  });

  it('neither screen runs its own poll of the session endpoint', () => {
    expect(ENGINE_SRC).toMatch(/setInterval\(refresh, 5000\)/);
    expect(SCAN_SRC).not.toMatch(/fetch\(`\/api\/table\/\$\{[^}]*\}`\)/);
    expect(TABLE_SRC).not.toMatch(/fetch\(`\/api\/table\/\$\{[^}]*\}`\)/);
  });

  // Case 1: picks must be written by the engine, on tap. A screen POSTing picks
  // itself is how one of them ends up batching them behind a confirm step again.
  it('neither screen posts a pick itself', () => {
    expect(ENGINE_SRC).toMatch(/fetch\('\/api\/dishes\/pick'/);
    expect(SCAN_SRC).not.toMatch(/'\/api\/dishes\/pick'/);
    expect(TABLE_SRC).not.toMatch(/'\/api\/dishes\/pick'/);
  });

  it('the scan screen no longer batches picks behind a confirm sheet', () => {
    // The whole mechanism, gone: no local picked Set, no confirm gate, no
    // restaurant sheet at pick time (the restaurant is a session-level fact now).
    expect(SCAN_SRC).not.toMatch(/confirmingPick/);
    expect(SCAN_SRC).not.toMatch(/confirmPicks/);
    expect(SCAN_SRC).not.toMatch(/setPicked/);
    expect(SCAN_SRC).not.toMatch(/RestaurantPicker/);
  });

  it('a pick is optimistic — the stamp is applied before the response, and rolled back on failure', () => {
    const pickBody = ENGINE_SRC.slice(ENGINE_SRC.indexOf('const pick = async'), ENGINE_SRC.indexOf('const unpick = async'));
    // Applied BEFORE the await, which is the point.
    const stampAt = pickBody.indexOf('applyLocalStampEvent');
    const fetchAt = pickBody.indexOf('await fetch');
    expect(stampAt).toBeGreaterThan(-1);
    expect(stampAt).toBeLessThan(fetchAt);
    // And undone if the write didn't take, broadcast included.
    expect(pickBody).toMatch(/type: 'unpick'/);
  });

  it('a tap during an in-flight write is queued, never dropped — and flips the stamp NOW', () => {
    // Returning early left the dish in the state the user had just asked it to leave,
    // with no feedback — "needs to wait if you want to unpick it" (owner, 2026-07-30).
    const toggle = ENGINE_SRC.slice(ENGINE_SRC.indexOf('const toggle'));
    expect(toggle).toMatch(/desiredRef\.current\.set\(item\.key, want\)/);
    // The queued branch must apply + broadcast the flip at TAP time. Queueing only
    // the write left the chop up until the pick's round trip settled — the residual
    // "still a bit lag" on unpick after the DELETE itself stopped blocking.
    const queued = toggle.slice(0, toggle.indexOf('desiredRef.current.set'));
    expect(queued).toMatch(/applyLocalStampEvent\(item\.key, ev\)/);
    expect(queued).toMatch(/broadcastStamp\(item\.key, ev\)/);
    // A pick must honour a queued unpick when it settles. (There is no converse:
    // un-picking no longer blocks, so nothing can queue behind it.)
    expect(ENGINE_SRC).toMatch(/desiredRef\.current\.get\(item\.key\) === false/);
  });

  it('un-picking never blocks on its own DELETE, but still guards the overlay', () => {
    // DELETE /api/my/dishes is the journal's trash endpoint (lock check, rating
    // count, points detach, delete, profile replay). Awaiting it is the reported
    // unpick latency. Dropping the await must NOT also drop the in-flight guard, or
    // a racing poll resurrects the chop.
    const unpickSrc = ENGINE_SRC.slice(ENGINE_SRC.indexOf('const unpick = async'), ENGINE_SRC.indexOf('unpickRef.current = unpick'));
    expect(unpickSrc).not.toMatch(/await fetch/);
    expect(unpickSrc).toMatch(/markInFlight\(item\.key, true\)/);
    expect(unpickSrc).toMatch(/markInFlight\(item\.key, false\)/);
    // ...and it must not re-acquire the tap lock it just gave up.
    expect(unpickSrc).not.toMatch(/markBusy/);
  });

  it('pending dish ids are a ref, readable by an unpick queued behind a pick', () => {
    // Through useState the queued unpick reads a render-stale copy, finds no id, and
    // silently returns — the same do-nothing tap in a different disguise.
    expect(ENGINE_SRC).toMatch(/pendingDishIds = useRef/);
    expect(ENGINE_SRC).toMatch(/pendingDishIds\.current\[item\.key\]\?\.id/);
  });

  it('the seal is still written at pick time — the sealed-bet contract survived the move', () => {
    // This used to live in scan's confirmPicks, which no longer exists. Losing it
    // silently would break a hard product principle, so it is pinned here.
    expect(ENGINE_SRC).toMatch(/fetch\('\/api\/seals'/);
    expect(ENGINE_SRC).toMatch(/dish_id: dishId/);
  });

  it('the poll clears the overlay against when the request was ISSUED, not when it landed', () => {
    // Otherwise a stamp blinks out when a poll lands mid-flight. This started as an
    // in-flight-keys guard covering only this client's OWN writes; the field test on
    // 2026-07-30 was watching a REMOTE pick, which that guard never protected. The
    // timestamp must be taken before the fetch — taking it after would make the
    // window it protects empty and silently restore the bug.
    const refresh = ENGINE_SRC.slice(ENGINE_SRC.indexOf('const refresh'));
    const stampedAt = refresh.indexOf('requestedAt = Date.now()');
    const fetched = refresh.indexOf('await fetch(');
    expect(stampedAt).toBeGreaterThan(-1);
    expect(stampedAt).toBeLessThan(fetched);
    // ...and the in-flight set must be handed to it. Without the third argument the
    // poll clears an optimistic entry whose write hasn't committed, which is exactly
    // how un-picking a dish put the chop back (owner, 2026-07-30, second run).
    expect(ENGINE_SRC).toMatch(/pruneOverlaysBefore\(prev, requestedAt, inFlightRef\.current\)/);
  });
});

describe('one stamp row — case 3, the "just a line under chips" report', () => {
  it('both screens mount ChopStampRow from the same module', () => {
    expect(SCAN_SRC).toMatch(/import ChopStampRow from '@\/components\/ChopStampRow'/);
    expect(TABLE_SRC).toMatch(/import ChopStampRow from '@\/components\/ChopStampRow'/);
  });

  it('neither screen re-implements the stamp anatomy inline', () => {
    // Markers that must exist ONLY in ChopStampRow.tsx.
    for (const marker of ['chop-stamp-row', 'chop-stamp-pop', 'chop-stamp-overflow']) {
      expect(ROW_SRC).toContain(marker);
      expect(SCAN_SRC).not.toContain(marker);
      expect(TABLE_SRC).not.toContain(marker);
    }
    // Reaching for the bare glyph again is how the next lookalike starts.
    expect(SCAN_SRC).not.toMatch(/from '@\/components\/Chop'/);
    expect(TABLE_SRC).not.toMatch(/from '@\/components\/Chop'/);
  });

  const stamps = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ user_id: `u${i}`, name: `person${i}` }));

  function mount(n: number) {
    return render(
      <LanguageProvider>
        <ChopStampRow itemKey="menu-1" stamps={stamps(n)} colorFor={() => '#3B82F6'} />
      </LanguageProvider>,
    );
  }

  it('renders a real chop per picker, not a handles text line', () => {
    const { container } = mount(2);
    expect(container.querySelectorAll('.chop-stamp-pop')).toHaveLength(2);
    expect(container.textContent).not.toContain('、');
    expect(container.textContent).not.toContain('也選了');
  });

  it('renders nothing at all when nobody has picked', () => {
    expect(mount(0).container.innerHTML).toBe('');
  });

  it('caps the chops and shows the remainder as +N', () => {
    const { container } = mount(STAMP_CAP + 3);
    expect(container.querySelectorAll('.chop-stamp-pop')).toHaveLength(STAMP_CAP);
    expect(container.querySelector('.chop-stamp-overflow')?.textContent).toBe('+3');
  });

  it('keys each chop by item+user so its pop-in plays once, not on every re-render', () => {
    expect(ROW_SRC).toMatch(/key=\{`\$\{itemKey\}:\$\{s\.user_id\}`\}/);
  });
});

describe('one cart bar — table-wide, same number on every screen', () => {
  // Owner ruling, 2026-07-30 (after two rounds of "counter out of sync" reports):
  // a counter on a SHARED surface must show the same number on every member's
  // screen. The first unification made the bar my-picks-only on both screens, and
  // a cross-device disagreement — however intentional — reads as a sync bug.

  it('both screens mount PickedCartBar; neither keeps a lookalike cart bar', () => {
    expect(SCAN_SRC).toMatch(/<PickedCartBar/);
    expect(TABLE_SRC).toMatch(/<PickedCartBar/);
    // The old inline copies were a div styled as .cart-btn with pointerEvents off.
    for (const src of [SCAN_SRC, TABLE_SRC]) {
      expect(src).not.toMatch(/className="btn primary cart-btn"/);
      expect(src).not.toMatch(/pointerEvents: 'none'/);
    }
  });

  it('both feed it the TABLE\'s picks, never an isPicked (mine-only) list', () => {
    const scanBar = SCAN_SRC.match(/<PickedCartBar[^/]*\/>/)?.[0] ?? '';
    const tableBar = TABLE_SRC.match(/<PickedCartBar[^/]*\/>/)?.[0] ?? '';
    // Mine-only is exactly the regression this pins against: it looked like the
    // fix and re-created the desync one report later.
    expect(scanBar).not.toMatch(/isPicked/);
    expect(tableBar).not.toMatch(/isPicked/);
    // Stamped-by-anyone is the table-wide test both screens' lists go through.
    expect(scanBar).toMatch(/stampsOf\(i\)\.length > 0/);
    expect(tableBar).toMatch(/anyPickedItems/);
    expect(TABLE_SRC).toMatch(/anyPickedItems = state\.items\.filter\(it => \(stampsByKey\.get\(it\.key\) \?\? \[\]\)\.length > 0\)/);
  });
});
