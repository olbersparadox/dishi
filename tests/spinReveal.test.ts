// The 隨機一人 spin. These tests exist mostly to pin ONE property: the ring stops
// where drawPayer said, not where the animation's arithmetic happened to land.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSpin, spinIndexAt, SPIN_MS } from '../src/lib/spinReveal';
import { drawPayer } from '../src/lib/tableSettle';

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');

const sessions = Array.from({ length: 60 }, (_, i) => `session-${i}-${'abc'.repeat(i % 4)}`);

describe('buildSpin — it always comes to rest on the payer', () => {
  it('lands on the target seat for every table size and every session', () => {
    for (let count = 2; count <= 8; count++) {
      for (const sid of sessions) {
        for (let target = 0; target < count; target++) {
          const spin = buildSpin(count, target, sid);
          expect(spinIndexAt(spin, count, SPIN_MS), `${count}/${target}/${sid}`).toBe(target);
          // And it is still the payer a moment after the animation is over.
          expect(spinIndexAt(spin, count, SPIN_MS + 10_000)).toBe(target);
        }
      }
    }
  });

  it('the final tick is the one that arrives, so the ring never jumps at handoff', () => {
    // The component drops the spin override when the schedule runs out and falls
    // back to the plain payer ring. That is only seamless if the LAST tick already
    // put the ring on the payer.
    const spin = buildSpin(4, 2, 'seamless');
    const afterLastTick = (spin.startIndex + spin.ticks.length) % 4;
    expect(afterLastTick).toBe(2);
  });
});

describe('the failure mode this design exists to avoid', () => {
  it('a FIXED table size does not always pay the same seat — the seat tracks the session', () => {
    // The trap (owner, 2026-07-31): a spin whose length is a fixed function of the
    // curve and the member count lands on the same seat forever. Here the payer
    // comes from drawPayer, so a four-person table must spread across seats.
    const ids = ['u-a', 'u-b', 'u-c', 'u-d'];
    const landed = new Set<number>();
    for (const sid of sessions) {
      const payer = drawPayer(ids, sid)!;
      const target = [...ids].sort().indexOf(payer);
      const spin = buildSpin(4, target, sid);
      landed.add(spinIndexAt(spin, 4, SPIN_MS));
    }
    expect(landed.size).toBeGreaterThan(1);
    // Not merely "more than one" — every seat is reachable.
    expect(landed.size).toBe(4);
  });

  it('the PATH varies between sessions too, so the spin never looks canned', () => {
    const shapes = new Set(sessions.map(sid => {
      const s = buildSpin(5, 0, sid);
      return `${s.startIndex}:${s.ticks.length}`;
    }));
    expect(shapes.size).toBeGreaterThan(3);
  });
});

describe('the motion itself', () => {
  it('fits the 5s budget exactly — the last tick is the deadline, not past it', () => {
    for (const sid of sessions.slice(0, 10)) {
      const spin = buildSpin(4, 1, sid);
      expect(spin.ticks[spin.ticks.length - 1]).toBeCloseTo(SPIN_MS, 6);
      expect(Math.max(...spin.ticks)).toBeLessThanOrEqual(SPIN_MS);
    }
  });

  it('decelerates: every gap between ticks is longer than the one before', () => {
    const spin = buildSpin(4, 3, 'decel');
    const gaps = spin.ticks.map((t, i) => t - (i === 0 ? 0 : spin.ticks[i - 1]));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    // Opens brisk, closes on a held beat — the reason it reads as a wheel and not
    // a progress bar.
    expect(gaps[0]).toBeLessThan(150);
    expect(gaps[gaps.length - 1]).toBeGreaterThan(600);
  });

  it('is deterministic — every phone at the table runs the identical spin', () => {
    expect(buildSpin(4, 2, 'same')).toEqual(buildSpin(4, 2, 'same'));
  });

  it('starts on a seat that is actually at the table', () => {
    for (let count = 2; count <= 8; count++) {
      for (const sid of sessions.slice(0, 12)) {
        const spin = buildSpin(count, 0, sid);
        expect(spin.startIndex).toBeGreaterThanOrEqual(0);
        expect(spin.startIndex).toBeLessThan(count);
      }
    }
  });
});

// Source-level, the house technique for engine invariants (see tableChassis): the
// wiring below was each a live bug, and none of them fail loudly when they break.
describe('wiring', () => {
  const SETTLE = read('../src/components/TableSettle.tsx');
  const ENGINE = read('../src/lib/useTableSession.ts');
  const SCAN = read('../src/app/scan/page.tsx');
  const TABLE = read('../src/app/table/page.tsx');
  const body = (src: string, from: string, to: string) =>
    src.slice(src.indexOf(from), src.indexOf(to));

  it('the component drives the shared schedule and holds no easing of its own', () => {
    expect(SETTLE).toMatch(/import \{ buildSpin, spinIndexAt, SPIN_MS \} from '@\/lib\/spinReveal'/);
    // A second copy of the curve in the component is how the landing guarantee
    // gets quietly broken — the arithmetic lives in one tested place.
    expect(SETTLE).not.toMatch(/Math\.sqrt|Math\.pow/);
  });

  it('both screens seed the spin, so every phone at the table runs the same one', () => {
    expect(SCAN).toMatch(/sessionId=\{table\.state\.session_id\}/);
    expect(TABLE).toMatch(/sessionId=\{state\.session_id\}/);
  });

  it('the spin yields to reduced motion', () => {
    expect(SETTLE).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('a poll cannot revert a settle write that is still in flight', () => {
    // The regression: a poll landing mid-spin reverted pay_payer_id for one cycle,
    // which cancelled the spin and then started a second one.
    expect(ENGINE).toMatch(/inFlightRef\.current\.has\(PAY_KEY\)/);
    expect(ENGINE).toMatch(/inFlightRef\.current\.has\(DICE_KEY\)/);
    // Held keys must be RELEASED on every exit or the poll is frozen out for good.
    expect(body(ENGINE, 'const choosePayMethod', 'const playDice'))
      .toMatch(/finally \{\s*markInFlight\(PAY_KEY, false\)/);
    expect(body(ENGINE, 'const playDice', 'const startDiceGame'))
      .toMatch(/finally \{\s*markInFlight\(DICE_KEY, false\)/);
  });

  it('neither settle write awaits a refresh — that was the ~2s of dead air', () => {
    // Both endpoints already answer with everything the screen needs, so a
    // trailing full-session fetch only delays the tap landing.
    expect(body(ENGINE, 'const choosePayMethod', 'const playDice')).not.toMatch(/await refresh\(\)/);
    expect(body(ENGINE, 'const playDice', 'const startDiceGame')).not.toMatch(/await refresh\(\)/);
  });

  it('the payer is computed locally on tap, from the same deterministic draw', () => {
    // Not a guess: drawPayer is a function of the session, so the optimistic answer
    // IS the row the server is about to write.
    expect(body(ENGINE, 'const choosePayMethod', 'const playDice')).toMatch(/drawPayer\(/);
  });
});

describe('nothing to animate', () => {
  it('a table of one gets no spin — there is no draw to dramatise', () => {
    expect(buildSpin(1, 0, 's').ticks).toEqual([]);
  });

  it('a payer who is not at the table gets no spin rather than a wrong landing', () => {
    // payerId not found yields -1 from indexOf; the ring must not travel to a seat
    // that does not exist.
    expect(buildSpin(4, -1, 's').ticks).toEqual([]);
    expect(buildSpin(4, 9, 's').ticks).toEqual([]);
  });
});
