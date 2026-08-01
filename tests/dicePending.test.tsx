// @vitest-environment jsdom
//
// Every 大話骰 action is a server round trip that is deliberately NOT optimistic
// (see playDice's own comment: a call is a claim in a game with money on it, and
// showing it as made before the server accepted it is how a table ends up arguing
// about a bid that was never legal). The cost of that choice is dead time on every
// tap, so the button that started it has to say it is working — otherwise it looks
// inert and gets tapped again.
//
// The part worth pinning is that it is the TAPPED button, not all of them.
// dicePending is one flag for the whole screen, and on the two-action state (raise
// or 開) both circles are up at once; spinning both would say "the table is busy"
// rather than "your tap landed".
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import LiarsDice from '../src/components/LiarsDice';
import type { Die } from '../src/lib/liarsDice';
import type { DiceGameView } from '../src/lib/tableDice';
import type { Member } from '../src/lib/useTableSession';

afterEach(cleanup);

const seat = (id: string, name: string): Member => ({
  user_id: id, handle: name.toLowerCase(), display_name: name,
  username_claimed: true, has_profile: true, rating_count: 10, ready_at: null,
} as unknown as Member);
const M = [seat('u-jerry', 'Jerry'), seat('u-chan', 'Chan'), seat('u-wing', 'Wing'), seat('u-priya', 'Priya')];
const ORDER = M.map(m => m.user_id);
const bid = (u: string, quantity: number, face: Die) =>
  ({ user_id: u, quantity, face, at: '2026-08-01T12:00:00Z' });
const base = {
  round: 1, order: ORDER, firstPlayerId: 'u-jerry',
  yourDice: [4, 4, 1, 6, 2] as Die[], reveal: null,
};

function mount(game: DiceGameView, dicePending: boolean, on: Record<string, any> = {}) {
  return render(
    <LanguageProvider>
      <LiarsDice
        game={game} you="u-jerry" members={M} colorFor={() => '#3B82F6'}
        onPickDirection={on.dir ?? (() => {})} onCallBid={on.bid ?? (() => {})}
        onOpenCups={on.open ?? (() => {})} onDone={() => {}}
        dicePending={dicePending}
      />
    </LanguageProvider>,
  );
}

describe('a tapped 大話骰 button shows it is working', () => {
  it('spins the arrow you picked, and leaves the other one an arrow', () => {
    const game = { ...base, direction: null, currentTurnUserId: 'u-jerry', bids: [] } as DiceGameView;
    // Re-render with the flag true is what a real move does: the tap sets it.
    const view = mount(game, false, { dir: () => {} });
    const arrows = () => Array.from(view.container.querySelectorAll('.turn-dir-btn'));
    fireEvent.click(arrows()[0]);
    view.rerender(
      <LanguageProvider>
        <LiarsDice game={game} you="u-jerry" members={M} colorFor={() => '#3B82F6'}
          onPickDirection={() => {}} onCallBid={() => {}} onOpenCups={() => {}} onDone={() => {}}
          dicePending />
      </LanguageProvider>,
    );
    expect(arrows()[0].querySelector('.dice-btn-spinner'), 'tapped arrow should spin').toBeTruthy();
    expect(arrows()[1].querySelector('.dice-btn-spinner'), 'the other arrow must NOT spin').toBeFalsy();
    // Both lock, though: a second move while one is open is exactly the double-tap
    // this is here to prevent.
    expect((arrows()[0] as HTMLButtonElement).disabled).toBe(true);
    expect((arrows()[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not fire a second move when the first is still open', () => {
    const game = { ...base, direction: null, currentTurnUserId: 'u-jerry', bids: [] } as DiceGameView;
    const dir = vi.fn();
    const view = mount(game, true, { dir });
    fireEvent.click(view.container.querySelectorAll('.turn-dir-btn')[0]);
    expect(dir).not.toHaveBeenCalled();
  });

  it('nothing spins before anything is tapped', () => {
    const game = { ...base, direction: 'right', currentTurnUserId: 'u-jerry', bids: [bid('u-chan', 7, 4)] } as DiceGameView;
    const view = mount(game, false);
    expect(view.container.querySelector('.dice-btn-spinner')).toBeFalsy();
    expect(view.container.querySelector('.ok-circle-spinner')).toBeFalsy();
  });

  it('the reveal\'s ✓ never spins — it is local, not a round trip', () => {
    const game = {
      ...base, direction: 'right', currentTurnUserId: 'u-wing', bids: [bid('u-priya', 9, 4)],
      reveal: {
        rolls: { 'u-jerry': [4, 4, 1, 6, 2] as Die[], 'u-chan': [4, 3, 2, 5, 6] as Die[],
                 'u-wing': [1, 5, 3, 2, 6] as Die[], 'u-priya': [2, 6, 3, 5, 3] as Die[] },
        masks: Object.fromEntries(ORDER.map(u => [u, [true, false, false, false, false]])),
        bid: { quantity: 9, face: 4 as Die }, bidderId: 'u-priya',
        challengerId: 'u-jerry', actual: 5, loserId: 'u-priya',
      },
    } as unknown as DiceGameView;
    const view = mount(game, true); // even mid-flight, dismissing is instant
    const ok = view.container.querySelector('.ok-circle')!;
    expect(ok.querySelector('.ok-circle-spinner')).toBeFalsy();
    expect((ok as HTMLButtonElement).disabled).toBe(false);
  });
});
