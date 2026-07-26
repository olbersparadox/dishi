// @vitest-environment jsdom
//
// REGRESSION (2026-07-24, live-diagnosed): the seal reveal fired server-side on
// every rating but never rendered, silently burning a one-way `revealed_at`.
// Cause: the only producer of the reveal was the old /log page, which read
// `json.seal` off the ratings response into sessionStorage and navigated to
// /profile?rated=1. /log was killed 2026-07-22 (commit 8c07b62); its replacement
// (RatingStack, an overlay that never navigates) posted the rating
// fire-and-forget and threw the response away, while the profile page kept a
// reader for a key nothing wrote and a `justRated` gate nothing ever set.
//
// What these tests pin, so it cannot rot back:
//   1. a rating whose response carries a seal RENDERS the reveal;
//   2. the pick-from-待評 path specifically (the one the owner hit) is covered;
//   3. the reveal survives the growth screen's mount — it is not cleared by the
//      post-rating refresh/exit sequence;
//   4. no seal in the response => no reveal invented.
// A fire-and-forget `rate()` fails (1)-(3); a missing render site fails all.
//
// 2026-07-26: the reveal moved from a stack of cards above the dish rows to a
// stamp beside each dish's NAME, with the words behind a tap (the shared
// ExplainModal). "Rendered" therefore now means "a badge exists on that dish's
// row", and the prose assertions open it first. The consumption contract is
// unchanged and still pinned: nothing may burn a one-way `revealed_at` without
// putting the verdict on screen.
//
// Same date: the balloon itself was redesigned (big centred face, predicted/
// actual as two title-size lines, reason + "what this taught me" as smaller
// supporting text underneath), and the session-wide "你剛剛教會了我" banner
// that used to sit above the dish rows was retired — what a rating taught now
// rides on ITS OWN seal's balloon instead (see the last describe block).
// Assertions read the ZH copy: LanguageProvider defaults to Chinese-first, which
// is what a real user sees here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/lib/i18n';

// SnapRating is a pointer-drag slider (no keyboard path), so the flick itself is
// stubbed to a button: what regressed was RatingStack's handling of the RATING
// RESPONSE, not the gesture. Everything downstream of onRate stays real.
vi.mock('@/components/SnapRating', () => ({
  default: ({ onRate }: { onRate: (score: number) => void }) => (
    <button data-testid="flick" onClick={() => onRate(0.9)}>flick</button>
  ),
}));

import RatingStack, { type ExistingPick } from '../src/components/RatingStack';

const SEAL = {
  predicted_direction: 'like',
  actual_direction: 'love',
  outcome: 'near' as const,
  reason_zh: '你鍾意鑊氣重嘅嘢',
  reason_en: 'you lean smoky, wok-charred',
};

const pick: ExistingPick = {
  dishId: 'dish-1', photoUrl: null, name: 'Char Siu', name_zh: '叉燒',
  coords: null, restaurant: null,
};

/** Mocks every endpoint the rating pipeline touches. `seal` is what /api/ratings
 *  hands back — the payload whose loss was the bug. */
function mockFetch(seal: unknown, opts: { missed?: unknown[]; taught?: unknown[] } = {}) {
  const calls: { url: string; body?: any }[] = [];
  let nth = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    // A batch breaks a DIFFERENT seal per dish — give each rating its own row id
    // so "all of them rendered" is a real assertion, not one card counted twice.
    // Only a RATINGS call consumes an id; counting every fetch would renumber
    // the seals by whatever else the pipeline happened to call.
    const nextSeal = () => (seal && typeof seal === 'object'
      ? { ...(seal as object), id: `seal-${++nth}` } : seal);
    const body =
      url.includes('/api/seals/displayed') ? (init?.method === 'POST' ? { ok: true } : { seals: opts.missed ?? [] })
      : url.includes('/api/ratings') ? { ok: true, taught: opts.taught ?? [], seal: nextSeal() }
      : url.includes('/api/buddy') ? { state: null }
      : {};
    return { ok: true, json: async () => body } as Response;
  }));
  return calls;
}
const urls = (calls: { url: string }[]) => calls.map(c => c.url);

/** Every seal badge on screen, in row order. The verdict is a stamp beside the
 *  dish name now, so this is what "the reveal rendered" means. */
const badges = () => Array.from(document.querySelectorAll<HTMLElement>('.seal-badge'));
/** The badge on the row whose dish name is `name` — the attribution assertion:
 *  a verdict stamped on the wrong dish is worse than no verdict. */
const badgeOnRow = (name: string) => {
  const row = Array.from(document.querySelectorAll('.learn-row'))
    .find(r => (r.textContent ?? '').includes(name));
  return row?.querySelector<HTMLElement>('.seal-badge') ?? null;
};
/** Open a verdict and wait for the shared explainer to carry its words. */
const openBadge = async (el: HTMLElement | null) => {
  expect(el, 'no seal badge to open').toBeTruthy();
  el!.click();
  await waitFor(() => expect(document.querySelector('.explain-modal')).toBeTruthy());
};

function mountPick() {
  return render(
    <LanguageProvider>
      <RatingStack picks={[pick]} userId="u1" onExit={() => {}} />
    </LanguageProvider>,
  );
}

/** A BATCH — three dishes, each breaking its own seal. This is the shape that
 *  was silently destroying content: the first fix showed only the first card. */
function mountBatch() {
  const picks: ExistingPick[] = [
    { ...pick, dishId: 'd1', name: 'Char Siu', name_zh: '叉燒' },
    { ...pick, dishId: 'd2', name: 'Roast Goose', name_zh: '燒鵝' },
    { ...pick, dishId: 'd3', name: 'Steamed Grouper', name_zh: '蒸石斑' },
  ];
  return render(
    <LanguageProvider>
      <RatingStack picks={picks} userId="u1" onExit={() => {}} />
    </LanguageProvider>,
  );
}
const flickAll = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await waitFor(() => expect(screen.getByTestId('flick')).toBeTruthy());
    screen.getByTestId('flick').click();
  }
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('seal reveal renders after a rating (pick-from-待評 path)', () => {
  it('shows the broken seal returned by /api/ratings', async () => {
    mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    // The stamp lands on the dish's own row, labelled with the outcome…
    await waitFor(() => expect(badgeOnRow('叉燒')).toBeTruthy());
    expect(badgeOnRow('叉燒')!.getAttribute('aria-label')).toMatch(/拆開個印/);
    // …and opening it gives the reveal's own copy — the predicted and actual
    // direction (SEAL: predicted 'like' -> 幾中意, actual 'love' -> 好鍾意) AND
    // the sealed-in-advance reason, which only exists on the response (nothing
    // client-side could invent it).
    await openBadge(badgeOnRow('叉燒'));
    expect(screen.getByText(/幾中意/)).toBeTruthy();
    expect(screen.getByText(/好鍾意/)).toBeTruthy();
    expect(screen.getByText(/鑊氣重嘅嘢/)).toBeTruthy();
  });

  it('actually reads the ratings RESPONSE — a fire-and-forget POST cannot pass this', async () => {
    const calls = mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badges()).toHaveLength(1));
    // Ordering contract, unchanged by the fix: the seal is written BEFORE the
    // rating that breaks it (the honesty contract), never after.
    const u = urls(calls);
    const sealIdx = u.findIndex(x => x.includes('/api/seals') && !x.includes('displayed'));
    const rateIdx = u.findIndex(x => x.includes('/api/ratings'));
    expect(sealIdx).toBeGreaterThanOrEqual(0);
    expect(rateIdx).toBeGreaterThan(sealIdx);
  });

  it('the reveal survives the growth screen — it is not cleared on the way in', async () => {
    mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badges()).toHaveLength(1));
    // The growth screen is now mounted (the flick card is gone) and the reveal is
    // still on it — the post-rating refresh/exit sequence must not eat it.
    expect(screen.queryByTestId('flick')).toBeNull();
    expect(badgeOnRow('叉燒')).toBeTruthy();
  });

  it('no seal in the response => no reveal invented', async () => {
    mockFetch(null);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.queryByTestId('flick')).toBeNull()); // reached growth
    expect(badges()).toHaveLength(0);
    expect(screen.queryByText(/拆開個印/)).toBeNull();
  });

  it('the verdict stays SEALED until tapped — no prose on the row itself', async () => {
    // The whole point of the move: the growth screen shows a stamp, not a wall of
    // verdict prose. If the reason/predicted-actual lines render inline again,
    // this fails.
    mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badges()).toHaveLength(1));
    expect(screen.queryByText(/鑊氣重嘅嘢/)).toBeNull();
    expect(screen.queryByText(/預計/)).toBeNull();
    expect(document.querySelector('.explain-modal')).toBeNull();
  });
});

describe('no seal is silently consumed (batch, recovery, taught)', () => {

  it('BATCH: every seal the session breaks is rendered, never just the first', async () => {
    // The regression this pins: revealed_at is one-way, so a batch of 3 that
    // renders 1 card has permanently destroyed 2 verdicts.
    const calls = mockFetch(SEAL);
    mountBatch();
    await flickAll(3);
    await waitFor(() => expect(screen.queryByTestId('flick')).toBeNull());
    await waitFor(() => expect(badges()).toHaveLength(3));
    // Each verdict is stamped on ITS OWN dish's row — attribution is structural
    // now (the badge is inside the row), not a name the card had to restate.
    for (const n of ['叉燒', '燒鵝', '蒸石斑']) {
      expect(badgeOnRow(n), `no seal badge on the ${n} row`).toBeTruthy();
    }
    // And every one was acknowledged as displayed, so none stays "recoverable".
    const acked = calls
      .filter(c => c.url.includes('/api/seals/displayed') && c.body?.ids)
      .flatMap(c => c.body.ids);
    expect(new Set(acked)).toEqual(new Set(['seal-1', 'seal-2', 'seal-3']));
  });

  it('acks the render so an unshown reveal stays recoverable', async () => {
    const calls = mockFetch(SEAL);
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badges()).toHaveLength(1));
    const ack = calls.find(c => c.url.includes('/api/seals/displayed') && c.body?.ids?.length);
    expect(ack, 'no displayed-ack was sent — the reveal would look unshown forever').toBeTruthy();
    expect(ack!.body.ids).toContain('seal-1');
  });

  it('recovers a reveal a PREVIOUS session computed but never showed', async () => {
    // The safety net: revealed_at means "computed", displayed_at means "seen".
    // A recovered verdict now stamps the row of ITS OWN dish, so it surfaces on a
    // session that rates that dish again.
    const missed = [{
      id: 'old-1', predicted_direction: 'meh', actual_direction: 'like',
      outcome: 'near', reason_zh: '舊嘅預測', reason_en: 'an older call',
      dish: { id: 'dish-1', name: 'Char Siu', name_zh: '叉燒' },
    }];
    const calls = mockFetch(null, { missed });
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badgeOnRow('叉燒')).toBeTruthy());
    await openBadge(badgeOnRow('叉燒'));
    expect(screen.getByText(/舊嘅預測/)).toBeTruthy();
    // Shown => acked, so it stops coming back.
    await waitFor(() => expect(calls.some(c =>
      c.url.includes('/api/seals/displayed') && c.body?.ids?.includes('old-1'))).toBe(true));
  });

  it('a recovered reveal with NO row here is left unacked — not burned invisibly', async () => {
    // The consequence of stamping verdicts onto dish rows: a recovered one whose
    // dish isn't in this session has nowhere to land. Acking it anyway would mark
    // it "seen" while showing nobody anything — the exact failure displayed_at
    // exists to prevent. It must stay recoverable instead.
    const missed = [{
      id: 'orphan-1', predicted_direction: 'meh', actual_direction: 'like',
      outcome: 'near', reason_zh: '孤兒預測', reason_en: 'an orphan call',
      dish: { id: 'not-in-this-session', name: 'Wonton Noodle', name_zh: '雲吞麵' },
    }];
    const calls = mockFetch(null, { missed });
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.queryByTestId('flick')).toBeNull()); // reached growth
    expect(badges()).toHaveLength(0);
    const acked = calls
      .filter(c => c.url.includes('/api/seals/displayed') && c.body?.ids)
      .flatMap(c => c.body.ids);
    expect(acked).not.toContain('orphan-1');
  });

  it('what a rating taught rides on ITS OWN seal — no seal, no surface for it', async () => {
    // 2026-07-26: the session-wide "你剛剛教會了我" banner above the dish rows
    // was retired. Taught deltas are still computed and still applied to the
    // profile server-side either way — this only pins that a rating with NO
    // seal has nowhere left to say so on screen (nothing invented, nothing
    // silently dropped from view that used to have a home).
    mockFetch(null, { taught: [{ dim: 'umami', dir: 1 }, { dim: 'sweet', dir: -1 }] });
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(screen.queryByTestId('flick')).toBeNull()); // reached growth
    expect(screen.queryByText(/你剛剛教會了我/)).toBeNull();
    expect(badges()).toHaveLength(0);
  });

  it('what a rating taught shows inside ITS dish’s seal balloon', async () => {
    mockFetch(SEAL, { taught: [{ dim: 'umami', dir: 1 }, { dim: 'sweet', dir: -1 }] });
    mountPick();
    screen.getByTestId('flick').click();
    await waitFor(() => expect(badgeOnRow('叉燒')).toBeTruthy());
    // Closed: the learnt line is behind the tap, same as the rest of the reveal.
    expect(screen.queryByText(/你剛剛教會了我/)).toBeNull();
    await openBadge(badgeOnRow('叉燒'));
    expect(screen.getByText(/你剛剛教會了我/)).toBeTruthy();
  });
});
