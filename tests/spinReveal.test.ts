// The 隨機一人 spin. These tests exist mostly to pin ONE property: the ring stops
// where drawPayer said, not where the animation's arithmetic happened to land.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSpin, spinIndexAt, revealLineKey, SPIN_MS } from '../src/lib/spinReveal';
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
describe('the re-roll, and the remarks that ride on it', () => {
  it('every tap is a genuinely different draw, seeded off the count', () => {
    // Owner reversal 2026-07-31: 隨機一人 used to keep one payer for the whole meal.
    // Re-tapping now redraws, so the same table must land on different people.
    const ids = ['u-a', 'u-b', 'u-c', 'u-d'];
    const seen = new Set(Array.from({ length: 20 }, (_, i) => drawPayer(ids, `sess:${i + 1}`)));
    expect(seen.size).toBe(4);
  });

  it('and the spin PATH changes with the draw, so no two reveals replay identically', () => {
    // The rigged-looking bug this fixes: seeded on the session alone, a second tap
    // replayed a pixel-identical spin (same start chop, same move count, same
    // landing). The seed has to carry the draw number too.
    const shapes = new Set(Array.from({ length: 8 }, (_, i) =>
      JSON.stringify(buildSpin(4, i % 4, `sess:${i + 1}`))));
    expect(shapes.size).toBe(8);
  });

  it('every draw has a line of its own, the first one included', () => {
    // Owner rewrite 2026-08-01: one line per draw, so draw 1 is a rung like any
    // other rather than a plain announcement with nothing under it.
    expect(revealLineKey(1)).toBe('table.settle.draw1');
    expect(revealLineKey(2)).toBe('table.settle.draw2');
    expect(revealLineKey(5)).toBe('table.settle.draw5');
  });

  it('holds on the last rung forever rather than running dry', () => {
    expect(revealLineKey(7)).toBe('table.settle.draw7');
    expect(revealLineKey(40)).toBe('table.settle.draw7');
  });

  it('never returns a rung below the first, whatever the count says', () => {
    // A count of 0 reaches here on the render between the tap and the write.
    expect(revealLineKey(0)).toBe('table.settle.draw1');
    expect(revealLineKey(-3)).toBe('table.settle.draw1');
  });

  it('every line it can name actually exists, in both languages', () => {
    // A missing key renders the key itself on a real screen, which is the kind of
    // thing that only shows up on the sixth tap in a restaurant.
    const dict = read('../src/lib/i18n-dict.ts');
    for (let n = 1; n <= 40; n++) {
      const key = revealLineKey(n);
      expect(dict, `${key} (draw ${n})`).toContain(`'${key}':`);
    }
  });

  it('the late rungs name nobody, which is the joke', () => {
    // 不如我請啦 is the screen offering to pay and 收舖未啊? 你地慢慢 is it addressing
    // the table. A {name} slot creeping back into either turns them into ordinary
    // payer announcements.
    const dict = read('../src/lib/i18n-dict.ts');
    for (const key of ['table.settle.draw6', 'table.settle.draw7']) {
      const line = dict.slice(dict.indexOf(`'${key}':`)).split('\n')[0];
      expect(line, key).not.toContain('{name}');
    }
    // And the early ones DO name someone — that is what they are for.
    for (const key of ['table.settle.draw1', 'table.settle.draw5']) {
      const line = dict.slice(dict.indexOf(`'${key}':`)).split('\n')[0];
      expect(line, key).toContain('{name}');
    }
  });

  it('the reveal is one line, not a line plus a remark under it', () => {
    // The two-element layout could not express a rung that names nobody.
    const settle = read('../src/components/TableSettle.tsx');
    expect(settle).not.toMatch(/settle-remark/);
    expect(read('../src/app/globals.css')).not.toMatch(/\.settle-remark/);
  });

  it('the DRAW never uses a you-form — one rung serves whoever is looking', () => {
    // Scoped to the random block, not the whole slot: 大話骰's verdict shares that
    // slot now and legitimately says 你付這一餐, which is its own older decision.
    // Widening this back to the slot would fail on that line and invite "fixing"
    // the wrong one.
    const settle = read('../src/components/TableSettle.tsx');
    const start = settle.indexOf("payMethod === 'random' && payer");
    const draw = settle.slice(start, settle.indexOf('</FitLine>', start));
    expect(start, 'random block not found').toBeGreaterThan(-1);
    expect(draw).toMatch(/revealLineKey\(payDrawCount\)/);
    expect(draw).not.toMatch(/payeryou/);
  });
});

describe('wiring', () => {
  const SETTLE = read('../src/components/TableSettle.tsx');
  const CSS = read('../src/app/globals.css');
  const ENGINE = read('../src/lib/useTableSession.ts');
  const SCAN = read('../src/app/scan/page.tsx');
  const TABLE = read('../src/app/table/page.tsx');
  const body = (src: string, from: string, to: string) =>
    src.slice(src.indexOf(from), src.indexOf(to));

  it('the component drives the shared schedule and holds no easing of its own', () => {
    expect(SETTLE).toMatch(/import \{[^}]*\bbuildSpin\b[^}]*\} from '@\/lib\/spinReveal'/);
    expect(SETTLE).toMatch(/import \{[^}]*\bspinIndexAt\b[^}]*\} from '@\/lib\/spinReveal'/);
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
    expect(ENGINE).toMatch(/holding\(PAY_KEY\)/);
    expect(ENGINE).toMatch(/holding\(DICE_KEY\)/);
    // Held keys must be RELEASED on every exit or the poll is frozen out for good.
    expect(body(ENGINE, 'const choosePayMethod', 'const playDice'))
      .toMatch(/finally \{\s*markInFlight\(PAY_KEY, false\)/);
    expect(body(ENGINE, 'const playDice', 'const startDiceGame'))
      .toMatch(/finally \{\s*markInFlight\(DICE_KEY, false\)/);
  });

  it('nothing from one table can survive onto the next one', () => {
    // The live bug (owner, 2026-07-31): user 1 scanned a SECOND menu, and their screen
    // opened inside a mid-round 大話骰 that belonged to the first table, while user 2
    // — whose client had only ever seen the new table — sat on the settle screen.
    // /scan keeps this hook mounted and just swaps the code, so three things have to
    // hold, and all three are load-bearing:
    //   1. state is unusable unless it describes the code being asked for
    expect(ENGINE).toMatch(/loadedState\.code\?\.toUpperCase\(\) === code\.toUpperCase\(\)/);
    //   2. a poll never merges across sessions
    expect(ENGINE).toMatch(/prev\.session_id !== json\.session_id\) return json/);
    //   3. a hung write cannot guard its fields forever
    expect(ENGINE).toMatch(/Date\.now\(\) - since < WRITE_GUARD_MS/);
  });

  it('the per-head figure keeps its placeholder in BOTH languages', () => {
    // The two disagree on where it sits — zh mid-sentence (位位 X 加一未計), en first
    // (X each) — so the dict places it and the component only interpolates. A
    // language that loses {amount} silently drops the figure in that language alone.
    const dict = read('../src/lib/i18n-dict.ts');
    const entry = dict.slice(dict.indexOf("'table.settle.eachhead':")).split('\n')[0];
    expect((entry.match(/\{amount\}/g) ?? []).length, entry).toBe(2); // zh + en
  });

  it('all three ways the bill lands read in ONE type — the game\'s own verdict line', () => {
    // Owner, 2026-08-01. An equal split's figure, 隨機一人's line and 大話骰's loser
    // answer the same question, and three faces made them look like three features.
    // The figure briefly wore .dish-price (20px/200) to escape a serif line; that is
    // now a direct contradiction of the shared rule, so it must not come back.
    expect(SETTLE).not.toMatch(/dish-price/);
    // No sentinel machinery left either — nothing to wrap means nothing to split.
    expect(SETTLE).not.toMatch(/SLOT/);
    const verdict = CSS.slice(CSS.indexOf('.settle-verdict {'));
    const body = verdict.slice(0, verdict.indexOf('}'));
    const target = CSS.slice(CSS.indexOf('.reveal-count-num, .reveal-count-chop-label {'));
    const targetBody = target.slice(0, target.indexOf('}'));
    for (const decl of ['var(--font-body), system-ui, sans-serif', '--fs-title-a', '700']) {
      expect(body, decl).toContain(decl);
      expect(targetBody, decl).toContain(decl); // the line it is matching
    }
  });

  it('all three answers land in the SAME slot — none of them below the buttons', () => {
    // 大話骰's verdict used to sit after the three circles, which left this slot empty
    // and an orphan sentence under the buttons. It read as residue from a screen that
    // had moved on, because that is exactly what it was.
    const slot = SETTLE.slice(SETTLE.indexOf('className="settle-reveal"'));
    const inSlot = slot.slice(0, slot.indexOf('settle-how'));
    for (const m of ["payMethod === 'random'", "payMethod === 'game'", "payMethod === 'equal'"]) {
      expect(inSlot, m).toContain(m);
    }
    // Nothing renders a verdict after the methods any more. Stop at FitLine's own
    // definition, which is further down the file and legitimately names the class.
    const afterMethods = slot.slice(slot.indexOf('settle-how'), slot.indexOf('function FitLine'));
    expect(afterMethods).not.toMatch(/settle-verdict/);
  });

  it('the answer is one line always — it shrinks rather than wrapping', () => {
    // Owner, 2026-08-01. Every answer goes through FitLine; a raw <p> would wrap again.
    expect(SETTLE).not.toMatch(/<p className="settle-verdict settle-reveal-name"/);
    const rule = CSS.slice(CSS.indexOf('.settle-reveal-name {'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toMatch(/white-space: nowrap/);
    // Full width or the measurement is meaningless: a shrink-to-fit box reports its
    // own text as the space available and nothing is ever found too wide.
    expect(body).toMatch(/align-self: stretch/);
    expect(body).toMatch(/calc\(var\(--fs-title-a\) \* var\(--fit, 1\)\)/);
    // One line means one line's reserve; two would push 邊個埋單 down for nothing.
    expect(CSS).toMatch(/min-height: 48px/);
  });

  it('every total is caveated, not only the ones missing a price', () => {
    // A fully-priced bill is still short the 10%, and a bare figure reads as exact.
    expect(SETTLE).toMatch(/t\(price\.complete \? 'table\.settle\.estimate' : 'table\.settle\.partial'\)/);
    // Two DIFFERENT claims, so they must not collapse into one string: missing prices
    // make the total a floor, complete ones make it an estimate.
    const dict = read('../src/lib/i18n-dict.ts');
    for (const k of ['table.settle.partial', 'table.settle.estimate']) {
      expect(dict, k).toContain(`'${k}':`);
    }
    const floor = dict.slice(dict.indexOf("'table.settle.partial':"), dict.indexOf("'table.settle.estimate':"));
    expect(floor).toMatch(/下限/);            // floor
    const est = dict.slice(dict.indexOf("'table.settle.estimate':"));
    expect(est.slice(0, est.indexOf('},'))).not.toMatch(/下限/);
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
