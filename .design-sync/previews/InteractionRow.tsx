import { InteractionRow } from 'dishi';

// One row per pending interaction, two variants: 'text' in the notification
// bell's dropdown, 'pair' in the journal's 今日 strip. The wording logic is the
// part that must never fork — the execution sentence changes with the
// RESTAURANT relationship (same shop twice / two shops / place unknown), keyed
// on restaurant ids, never names (HK chains give branches identical names).

// Stand-in dish shots (an SVG plate) — the pair variant is photos-only, so the
// cell needs an image where the product would show the logged photo.
const photo = (table: string, food: string, garnish: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">` +
    `<rect width="160" height="120" fill="${table}"/>` +
    `<ellipse cx="80" cy="64" rx="56" ry="42" fill="#f4efe6"/>` +
    `<ellipse cx="80" cy="62" rx="42" ry="30" fill="${food}"/>` +
    `<ellipse cx="66" cy="54" rx="12" ry="7" fill="${garnish}" opacity="0.85"/>` +
    `</svg>`,
  )}`;

const CHOW_FUN_SUN_KEE = {
  id: 'd-cf1', name: 'Beef Chow Fun', name_zh: '乾炒牛河',
  photo_url: photo('#5c4433', '#a9672f', '#d8b25a'),
  restaurant: '新記茶餐廳', restaurant_id: 'r-sunkee',
};
const CHOW_FUN_KAM_WAH = {
  id: 'd-cf2', name: 'Beef Chow Fun', name_zh: '乾炒牛河',
  photo_url: photo('#4d3a2e', '#b3773b', '#c9a44e'),
  restaurant: '金華冰廳', restaurant_id: 'r-kamwah',
};
const SQUID = {
  id: 'd-sq1', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷',
  photo_url: photo('#4d3a2e', '#d9a441', '#7fa15a'),
  restaurant: '金華冰廳', restaurant_id: 'r-kamwah',
};
const TOAST_A = {
  id: 'd-st1', name: 'Scrambled Egg Toast', name_zh: '炒蛋多士',
  photo_url: photo('#6b5340', '#e8b64c', '#f4efe6'),
  restaurant: '澳洲牛奶公司', restaurant_id: 'r-adc',
};
const TOAST_B = { ...TOAST_A, id: 'd-st2', photo_url: photo('#5c4433', '#e3ad3f', '#f4efe6') };
const HOME_TOMATO_EGG = {
  id: 'd-te1', name: 'Tomato Scrambled Eggs', name_zh: '蕃茄炒蛋',
  photo_url: photo('#7a6a55', '#d1553a', '#e8b64c'),
  restaurant: null, restaurant_id: null,
};
const HOME_TOMATO_EGG_2 = { ...HOME_TOMATO_EGG, id: 'd-te2', photo_url: photo('#6b5c48', '#c94f36', '#e0ac3d') };

// [reference, mine] — the dish being asked about is always the LATER instance.
const execRows = (ref: typeof TOAST_A, mine: typeof TOAST_A) => [
  { dish: ref, min: 5, max: 10, value: 7, verdictScore: 0.6 },
  { dish: mine, min: 5, max: 10, value: null, verdictScore: 0.35 },
];

const DUEL = { kind: 'duel' as const, rematch: false, duel: { id: 'duel-1', a: CHOW_FUN_SUN_KEE, b: SQUID } };
const REMATCH = { kind: 'duel' as const, rematch: true, duel: { id: 'duel-2', a: TOAST_A, b: SQUID } };
const EXEC_SAME = { kind: 'execution' as const, rows: execRows(TOAST_A, TOAST_B) };
const EXEC_CROSS = { kind: 'execution' as const, rows: execRows(CHOW_FUN_SUN_KEE, CHOW_FUN_KAM_WAH) };
const EXEC_AGAIN = { kind: 'execution' as const, rows: execRows(HOME_TOMATO_EGG, HOME_TOMATO_EGG_2) };

// The bell's dropdown surface (.notif-menu is position:absolute in the app, so
// the cell reproduces its 300px card as a static slot instead of floating rows
// on bare paper).
function BellMenu({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 300, background: 'var(--glaze)', border: '1px solid var(--line)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

/** The bell's duel rows: first ask vs rematch — the rematch admits the engine
 *  guessed wrong last time and is verifying. */
export function BellDuelRows() {
  return (
    <BellMenu>
      <InteractionRow interaction={DUEL} variant="text" role="menuitem" onClick={() => {}} />
      <InteractionRow interaction={REMATCH} variant="text" role="menuitem" onClick={() => {}} />
    </BellMenu>
  );
}

/** The three execution wordings, driven by restaurant IDs on the pair: the same
 *  shop twice, two different shops, and no shop to name (home cooking). */
export function BellExecutionWordings() {
  return (
    <BellMenu>
      <InteractionRow interaction={EXEC_SAME} variant="text" role="menuitem" onClick={() => {}} />
      <InteractionRow interaction={EXEC_CROSS} variant="text" role="menuitem" onClick={() => {}} />
      <InteractionRow interaction={EXEC_AGAIN} variant="text" role="menuitem" onClick={() => {}} />
    </BellMenu>
  );
}

/** The journal's pair variant: the photos ARE the message — two dishes, VS,
 *  no words. Shown inside the 今日 strip's outline card as in the journal. */
export function JournalDuelPair() {
  return (
    <div className="daily-interactions" style={{ width: 360 }}>
      <InteractionRow interaction={DUEL} variant="pair" role="listitem" onClick={() => {}} />
    </div>
  );
}

/** An execution pair: the same 乾炒牛河 at two shops — the comparison the
 *  taste engine exists to understand. */
export function JournalExecutionPair() {
  return (
    <div className="daily-interactions" style={{ width: 360 }}>
      <InteractionRow interaction={EXEC_CROSS} variant="pair" role="listitem" onClick={() => {}} />
    </div>
  );
}
