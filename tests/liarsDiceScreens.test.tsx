// @vitest-environment jsdom
//
// The 大話骰 game screens, against the design handoff (owner, 2026-08-01).
//
// The bug these mostly exist for: on YOUR turn the call-history strip used to be
// REPLACED by the face chips, so the one moment you had to judge a bid — your own
// — was the one moment the bid to beat was off screen, and 開 was not offered at
// all. Both are now on the same screen, which is what the handoff's 1l2 shows.
// A "fix" that hides the strip again to make room for the chips would pass every
// other test in the repo, so it is pinned here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import LiarsDice from '../src/components/LiarsDice';
import { LanguageProvider } from '../src/lib/i18n';
import type { DiceGameView } from '../src/lib/tableDice';
import type { Die } from '../src/lib/liarsDice';
import type { Member } from '../src/lib/useTableSession';

afterEach(cleanup);

const read = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8');
const CSS = read('../src/app/globals.css');
const SRC = read('../src/components/LiarsDice.tsx');

const COLORS: Record<string, string> = {
  'u-jerry': '#3B82F6', 'u-chan': '#22C55E', 'u-wing': '#F59E0B', 'u-priya': '#A855F7',
};
const colorFor = (id: string) => COLORS[id] ?? '#000';
const ORDER = Object.keys(COLORS);
const members = ORDER.map(user_id => ({
  user_id, display_name: user_id.slice(2), handle: user_id.slice(2),
  username_claimed: true, has_profile: true, rating_count: 1, ready_at: null,
})) as Member[];
const bid = (user_id: string, quantity: number, face: Die) =>
  ({ user_id, quantity, face, at: '2026-08-01T00:00:00Z' });

const view = (over: Partial<DiceGameView>): DiceGameView => ({
  round: 1, direction: 'right', order: ORDER, firstPlayerId: 'u-jerry',
  currentTurnUserId: 'u-jerry', bids: [], yourDice: [4, 4, 1, 6, 2], reveal: null, ...over,
});

function mount(game: DiceGameView) {
  render(
    <LanguageProvider>
      <LiarsDice game={game} you="u-jerry" members={members} colorFor={colorFor}
        onPickDirection={vi.fn()} onCallBid={vi.fn()} onOpenCups={vi.fn()} onDone={vi.fn()} />
    </LanguageProvider>,
  );
}
const boxes = () => Array.from(document.querySelectorAll('.call-history-item'));
const texts = () => boxes().map(b => b.textContent?.trim() || 'dots');
const openBtn = () =>
  Array.from(document.querySelectorAll('.ok-circle'))
    .find(b => b.textContent?.includes('開')) as HTMLElement | undefined;

describe('the strip is on screen on your OWN turn — the 1l2 regression', () => {
  it('shows the calls you are raising over, plus your pending call last', () => {
    mount(view({ bids: [bid('u-wing', 8, 4), bid('u-priya', 9, 4)] }));
    // Not just "a strip exists": the bid to beat has to be READABLE, and your own
    // pending call has to be the trailing box.
    expect(texts()).toEqual(['8個四', '9個四', '9個五']);
  });

  it('the pending box is yours — it carries YOUR chop colour, not the last caller’s', () => {
    mount(view({ bids: [bid('u-priya', 9, 4)] }));
    const last = boxes()[boxes().length - 1] as HTMLElement;
    expect(last.style.borderColor).toBe('rgb(59, 130, 246)'); // u-jerry blue
  });

  it('the pending box tracks the composer, so it never states a call you are not making', () => {
    mount(view({ bids: [bid('u-priya', 9, 4)] }));
    // Seeded at the minimum raise over 9個四.
    expect(texts()[texts().length - 1]).toBe('9個五');
  });

  it('the chips are on screen at the same time — strip and composer, not either/or', () => {
    mount(view({ bids: [bid('u-priya', 9, 4)] }));
    expect(document.querySelectorAll('.first-call-chip')).toHaveLength(6);
    expect(document.querySelector('.call-history-strip')).toBeTruthy();
  });
});

describe('開, and who may call it', () => {
  it('is offered on your own turn when someone else’s bid stands (raise OR open)', () => {
    mount(view({ bids: [bid('u-priya', 9, 4)] }));
    expect(openBtn()).toBeTruthy();
    expect(openBtn()!.style.visibility).not.toBe('hidden');
    // And it is taken out of the flow so it can point at the call it would open,
    // leaving the confirm on the centre it holds everywhere else.
    expect(openBtn()!.className).toContain('dice-open-aside');
  });

  it('is NOT offered when the standing bid is your own — you cannot open yourself', () => {
    mount(view({ currentTurnUserId: 'u-chan', bids: [bid('u-jerry', 6, 4)] }));
    expect(openBtn()!.style.visibility).toBe('hidden');
  });

  it('is not offered on the opening call, where nothing stands yet', () => {
    mount(view({ bids: [] }));
    expect(openBtn()).toBeUndefined();
  });

  it('waiting on someone else, 開 stays centred rather than pointing', () => {
    mount(view({ currentTurnUserId: 'u-wing', bids: [bid('u-chan', 7, 4)] }));
    expect(openBtn()!.className).not.toContain('dice-open-aside');
  });
});

describe('waiting on someone else', () => {
  it('the trailing box is their thinking dots, in their colour', () => {
    mount(view({ currentTurnUserId: 'u-wing', bids: [bid('u-chan', 7, 4)] }));
    expect(texts()).toEqual(['7個四', 'dots']);
    const last = boxes()[1] as HTMLElement;
    expect(last.style.borderColor).toBe('rgb(245, 158, 11)'); // u-wing amber
    expect(last.querySelector('.other-turn-dots')).toBeTruthy();
  });

  it('the stepper is hidden in place, not removed, so the button holds its line', () => {
    mount(view({ currentTurnUserId: 'u-wing', bids: [bid('u-chan', 7, 4)] }));
    const stepper = document.querySelector('.first-call-stepper') as HTMLElement;
    expect(stepper).toBeTruthy();
    expect(stepper.style.visibility).toBe('hidden');
  });
});

describe('the direction picker', () => {
  it('is icon-only — the arrow is the word — but keeps its accessible name', () => {
    mount(view({ direction: null, bids: [] }));
    const btns = Array.from(document.querySelectorAll('.turn-dir-btn'));
    expect(btns).toHaveLength(2);
    expect(btns.map(b => b.getAttribute('aria-label'))).toEqual(['向左', '向右']);
    // A visible caption under each arrow was removed; losing the aria-label with
    // it would leave two unnamed buttons.
    expect(document.querySelectorAll('.turn-dir-cap')).toHaveLength(0);
    expect(CSS).not.toMatch(/\.turn-dir-cap/);
  });
});

// Source-level, the house technique for things that render correctly in a browser
// and cannot be observed in jsdom (no stylesheet is applied here).
describe('type, as the handoff specifies it', () => {
  it('a call sets in sans THROUGHOUT, Han included — no serif/sans split', () => {
    // The split put the numeral and the Han on different baselines at 30px. It
    // lived in SansNum, so the guard is that the call no longer reaches for it.
    expect(SRC).not.toMatch(/SansNum/);
    const rule = CSS.slice(CSS.indexOf('.other-call-text {'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/var\(--font-body\), system-ui, sans-serif/);
  });

  it('every Han glyph in a sans rule carries the fallback stack, not bare --font-body', () => {
    // --font-body is Schibsted Grotesk: Latin-only. Bare, it silently drops CJK
    // to the browser's default serif — which is how 開 and 全枱得 ended up serif
    // inside an otherwise sans UI.
    for (const sel of ['.ok-circle-glyph', '.other-call-text']) {
      const rule = CSS.slice(CSS.indexOf(`${sel} {`));
      expect(rule.slice(0, rule.indexOf('}')), sel)
        .toMatch(/var\(--font-body\), system-ui, sans-serif/);
    }
  });

  it('the reveal’s count and 埋單 are one statement: same face, same size', () => {
    // They were a serif headline with a smaller sans label trailing after it.
    expect(CSS).toMatch(/\.reveal-count-num, \.reveal-count-chop-label \{/);
    const rule = CSS.slice(CSS.indexOf('.reveal-count-num, .reveal-count-chop-label {'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toMatch(/var\(--font-body\), system-ui, sans-serif/);
    expect(body).toMatch(/--fs-title-a/);
  });
});

describe('the strip centres on the live call, whatever its width', () => {
  it('the tail is measured, not a constant — 12個四 is wider than 9個四', () => {
    // A fixed tail parks a two-digit call visibly off-centre from a one-digit one.
    expect(CSS).toMatch(/calc\(50% - var\(--strip-tail, 60px\)\)/);
    expect(SRC).toMatch(/setProperty\('--strip-tail'/);
    // Re-measured when the TEXT changes, not only when a call is added: retyping
    // a raise changes the width with the box count unchanged.
    expect(SRC).toMatch(/items\.map\(i => i\.text \?\? '…'\)\.join\('\|'\)/);
  });

  it('開’s offset comes from the same pass, so it lands on the standing bid’s box', () => {
    expect(SRC).toMatch(/onStandingDx\?\.\(-\(last\.offsetWidth \/ 2 \+ STRIP_GAP \+ prev\.offsetWidth \/ 2\)\)/);
    // The gap is duplicated in JS out of necessity; if the stylesheet's changes
    // and this doesn't, 開 drifts off the box by exactly that difference.
    expect(SRC).toMatch(/const STRIP_GAP = 10/);
    const rule = CSS.slice(CSS.indexOf('.call-history-strip {'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/gap: 10px/);
  });
});
