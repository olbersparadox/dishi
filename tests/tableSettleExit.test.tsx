// @vitest-environment jsdom
//
// The settled bill must have a way out (owner field session, 2026-08-03: "at
// 大家揀左 screen, Exit menu button should be there at the top right corner,
// otherwise there's no way out of the menu flow").
//
// The failure being pinned: TableSettle REPLACES the picking list rather than
// sitting on top of it, so it inherited none of the header controls the menu
// screens carry — a settled table had no exit but the browser's back button.
// The door must also be the SAME control the menu screens use, not a
// settle-specific lookalike (the "reuse, don't imitate" rule): one act, one
// glyph, one label.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import TableSettle, { type SettleDish } from '../src/components/TableSettle';
import { LanguageProvider } from '../src/lib/i18n';
import { dict } from '../src/lib/i18n-dict';
import type { Member } from '../src/lib/useTableSession';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// jsdom ships no ResizeObserver, and TableSettle's FitLine (the one-line bill
// answer) observes its own box. Nothing here tests the fitting, so a no-op
// shim is enough — without it the component throws on mount.
class NoopResizeObserver { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver ??= NoopResizeObserver;

const members: Member[] = [
  { user_id: 'w', handle: 'W', display_name: 'Winnie', username_claimed: false, has_profile: true, rating_count: 3, ready_at: '2026-08-03T12:15:00Z' },
  { user_id: 'j', handle: 'J', display_name: 'Jerry', username_claimed: true, has_profile: true, rating_count: 18, ready_at: '2026-08-03T12:15:00Z' },
];

const dishes: SettleDish[] = [
  { key: 'a', name: 'Fish soup with rice vermicelli', name_zh: '魚湯海斑米線', price: '$60' },
  { key: 'b', name: 'Egg white stir-fried vermicelli', name_zh: '瑤柱蛋白炒米粉', price: '$58' },
];

function mount(onLeave?: () => void) {
  return render(
    <LanguageProvider>
      <TableSettle
        dishes={dishes} members={members} you="j"
        colorFor={() => '#333'} payMethod="equal" payerId={null}
        onChoose={() => {}} onLeave={onLeave}
      />
    </LanguageProvider>,
  );
}

/** The label both menu screens already give this act — asserted from the dict
 *  rather than retyped, so a copy change can't leave this test asserting a
 *  string the app no longer uses. */
const LEAVE = dict['table.leave'].zh;

describe('TableSettle — the way out', () => {
  it('renders the leave control when the screen has somewhere to go', () => {
    mount(() => {});
    expect(screen.getByRole('button', { name: LEAVE })).toBeTruthy();
  });

  it('calls back when the door is tapped', () => {
    const onLeave = vi.fn();
    mount(onLeave);
    fireEvent.click(screen.getByRole('button', { name: LEAVE }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('renders no dead button when a screen has nowhere to go', () => {
    mount(undefined);
    expect(screen.queryByRole('button', { name: LEAVE })).toBeNull();
  });

  // Identity, not resemblance: the door wears the menu screens' own .icon-btn,
  // so a lookalike built from settle-specific markup FAILS here.
  it('is the same .icon-btn control the menu screens mount', () => {
    mount(() => {});
    expect(screen.getByRole('button', { name: LEAVE }).className).toContain('icon-btn');
  });

  it('leaves the bill itself untouched — both dishes and the total still render', () => {
    mount(() => {});
    expect(screen.getByText('魚湯海斑米線')).toBeTruthy();
    expect(screen.getByText('瑤柱蛋白炒米粉')).toBeTruthy();
    expect(screen.getByText('$118')).toBeTruthy();
  });
});
