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

  it('the seal is still written at pick time — the sealed-bet contract survived the move', () => {
    // This used to live in scan's confirmPicks, which no longer exists. Losing it
    // silently would break a hard product principle, so it is pinned here.
    expect(ENGINE_SRC).toMatch(/fetch\('\/api\/seals'/);
    expect(ENGINE_SRC).toMatch(/dish_id: dishId/);
  });

  it('the poll does not clear an overlay entry whose write is still in flight', () => {
    // Otherwise an optimistic stamp blinks out when a poll lands mid-flight.
    expect(ENGINE_SRC).toMatch(/inFlightRef/);
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
