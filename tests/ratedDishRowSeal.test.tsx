// @vitest-environment jsdom
//
// 已評嘅菜 (the flat rated list under the 味 AI card) is the broken seal's
// PERMANENT home — the growth screen shows a verdict once, this keeps it. What
// these tests pin:
//   1. the verdict is a stamp ON THE NAME, not a block of prose in the row;
//   2. tapping it opens the shared explainer with the predicted/actual lines
//      and the sealed-in-advance reason;
//   3. a dish with no seal gets no badge (nothing invented for an unsealed dish);
//   4. no streak line here — it's a running count that ended at whatever the
//      newest rating was, and restating it on an old row would claim a run that
//      isn't about that dish.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';
import RatedDishRow from '../src/components/RatedDishRow';
import type { SealResult } from '../src/components/SealRevealBadge';

const HIT: SealResult = {
  id: 's1', predicted_direction: 'like', actual_direction: 'like', outcome: 'hit',
  reason_zh: '夠鑊氣', reason_en: 'properly wok-charred', streak: 5,
};

const row = (seal: SealResult | null) => render(
  <LanguageProvider>
    <RatedDishRow id="d1" name="Char Siu" name_zh="叉燒" restaurant="Joy Hing"
      verdict="超好味" seal={seal} />
  </LanguageProvider>,
);

afterEach(cleanup);

describe('已評嘅菜: the broken seal stamps the dish name', () => {
  it('renders the badge inside the dish NAME, sealed until tapped', () => {
    row(HIT);
    const badge = document.querySelector<HTMLElement>('.seal-badge');
    expect(badge, 'no seal badge on the rated row').toBeTruthy();
    // Inline variant — beside the name at the name's own size, not the growth
    // screen's tile-height stamp.
    expect(badge!.className).toContain('seal-badge-inline');
    // ON the name: a badge that merely sits somewhere in the row would drift out
    // of the name treatment the moment either side is restyled.
    expect(badge!.closest('.dishname-primary'), 'badge is not inside the dish name').toBeTruthy();
    // Closed: none of the verdict's words are on the row itself.
    expect(screen.queryByText(/夠鑊氣/)).toBeNull();
    expect(screen.queryByText(/預計/)).toBeNull();
  });

  it('tapping opens the shared explainer with the predicted/actual lines and the sealed reason', () => {
    row(HIT);
    fireEvent.click(document.querySelector<HTMLElement>('.seal-badge')!);
    expect(document.querySelector('.explain-modal')).toBeTruthy();
    // HIT: predicted === actual ('like' -> 幾中意 both sides) — the balloon's two
    // title lines each carry the word once.
    expect(screen.getAllByText(/幾中意/)).toHaveLength(2);
    expect(screen.getByText(/夠鑊氣/)).toBeTruthy();
    // Historical seals never carry `taught` (it's ephemeral to the /api/ratings
    // call that broke them, never persisted) — nothing invented for it here.
    expect(screen.queryByText(/你剛剛教會了我/)).toBeNull();
  });

  it('no streak line in the history list, even on a hit with a live run', () => {
    row(HIT);
    fireEvent.click(document.querySelector<HTMLElement>('.seal-badge')!);
    expect(screen.queryByText(/連續命中/)).toBeNull();
  });

  it('a dish with no seal gets no badge', () => {
    row(null);
    expect(document.querySelector('.seal-badge')).toBeNull();
    expect(screen.getByText('叉燒')).toBeTruthy();
  });
});
