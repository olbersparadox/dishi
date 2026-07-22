// @vitest-environment jsdom
//
// 係咪同一味？ (identity-confirm card, backlog 2026-07-22) — chassis-identity
// tests in the house style (tableComponentIdentity.test.tsx precedent): the
// card must MOUNT the duel card's own side anatomy (DuelSide), never a
// lookalike, and its spec'd divergences must hold — non-tappable sides, no
// seal glyph, answers only from the ✓/✗/唔肯定 row.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IdentityConfirmCard from '../src/components/IdentityConfirmCard';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const CARD_SRC = readFileSync(path.resolve(__dirname, '../src/components/IdentityConfirmCard.tsx'), 'utf8');
const DUEL_SRC = readFileSync(path.resolve(__dirname, '../src/components/DuelOverlay.tsx'), 'utf8');

const MINE = { id: 'd1', name: 'Shrimp Dumpling', name_zh: '蝦餃', photo_url: null, restaurant: '美心皇宮' };
const OTHER = { id: 'd2', name: 'Crystal Shrimp Dumpling', name_zh: '水晶鮮蝦餃', photo_url: null, restaurant: '美心皇宮' };

function mount(onDone = vi.fn()) {
  render(
    <LanguageProvider>
      <IdentityConfirmCard mine={MINE} other={OTHER} onDone={onDone} />
    </LanguageProvider>,
  );
  return onDone;
}

describe('chassis reuse is real — one side anatomy, two cards', () => {
  it('both the duel card and the identity card import DuelSide from the same module', () => {
    expect(CARD_SRC).toMatch(/import DuelSide.* from '\.\/DuelSide'/);
    expect(DUEL_SRC).toMatch(/import DuelSide.* from '\.\/DuelSide'/);
  });
  it('the identity card never re-implements the side anatomy inline', () => {
    // Markers of the anatomy that must live ONLY in DuelSide.tsx.
    expect(CARD_SRC).not.toContain('duel-photo');
    expect(CARD_SRC).not.toContain('DishName');
  });
});

describe('spec divergences (hard, not optional)', () => {
  it('sides are NOT tappable — duel muscle memory must not be able to merge dishes', () => {
    mount();
    // Both dish names render, but no button contains a dish name: the only
    // buttons are the answer row (係同一味 / 唔同嘅 — icon + aria-label, no
    // visible copy — and the visible-text 唔肯定 skip).
    expect(screen.getByText('蝦餃')).toBeTruthy();
    expect(screen.getByText('水晶鮮蝦餃')).toBeTruthy();
    const buttonTexts = screen.getAllByRole('button').map(b => b.textContent ?? '');
    expect(buttonTexts.some(t2 => t2.includes('蝦餃'))).toBe(false);
    expect(screen.getByRole('button', { name: '係同一味' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '唔同嘅' })).toBeTruthy();
    expect(buttonTexts.join('|')).toContain('唔肯定');
  });
  it('header says 係咪同一味？ and carries NO seal glyph — nothing is predicted here', () => {
    mount();
    expect(screen.getByText('係咪同一味？')).toBeTruthy();
    expect(screen.queryByText('印')).toBeNull();
    expect(CARD_SRC).not.toContain('SealStamp');
  });
});

describe('answer mechanics', () => {
  it('係同一味 posts a merge and shows the inline result strip until OK', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ linked: true }) })) as unknown as typeof fetch;
    global.fetch = fetchMock;
    const onDone = mount();

    fireEvent.click(screen.getByRole('button', { name: '係同一味' }));
    await waitFor(() => expect(screen.getByText(/已合併/)).toBeTruthy());
    const [, init] = (fetchMock as any).mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ dish_id: 'd1', same_as_dish_id: 'd2' });
    expect(onDone).not.toHaveBeenCalled(); // the strip STAYS until OK (duel-reveal pattern)

    fireEvent.click(screen.getByLabelText('好')); // the OK circle
    expect(onDone).toHaveBeenCalledWith('same');
  });

  it('唔同嘅 posts the permanent negative verdict', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ linked: false, verdict: 'different' }) })) as unknown as typeof fetch;
    global.fetch = fetchMock;
    mount();
    fireEvent.click(screen.getByRole('button', { name: '唔同嘅' }));
    await waitFor(() => expect(screen.getByText(/收到/)).toBeTruthy());
    const [, init] = (fetchMock as any).mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ dish_id: 'd1', not_same_as_dish_id: 'd2' });
  });

  it('唔肯定 posts the cooldown verdict and closes quietly — no result strip', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ linked: false, verdict: 'unsure' }) })) as unknown as typeof fetch;
    global.fetch = fetchMock;
    const onDone = mount();
    fireEvent.click(screen.getByText('唔肯定'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('unsure'));
    const [, init] = (fetchMock as any).mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ dish_id: 'd1', unsure_about_dish_id: 'd2' });
    expect(screen.queryByText(/已合併|收到/)).toBeNull();
  });
});
