import { TableSettle } from 'dishi';

// The bill: what the table picked, what it costs, who is at it, and how the
// money gets carried. Reached only through the done-picking handshake, so it
// REPLACES the menu rather than sitting over it.
//
// Nothing here moves money — these screens decide WHO pays and print the
// number. That is why there is no checkout, no card field, and no stored
// payment method anywhere in the component.
//
// Wrapped at the app's real .shell width (420px, matching globals.css): the app
// never renders wider, and the capture is a fixed 900x700 window that would
// otherwise stretch the bill and crop its foot.
const PALETTE: Record<string, string> = {
  u1: '#3B82F6', u2: '#A855F7', u3: '#22C55E', u4: '#F59E0B',
};
const colorFor = (id: string) => PALETTE[id] ?? '#3B82F6';

const member = (user_id: string, name: string) => ({
  user_id, handle: name.toLowerCase().replace(/\s+/g, ''), display_name: name,
  username_claimed: true, has_profile: true, rating_count: 24,
  ready_at: '2026-07-30T12:00:00Z',
});

const MEMBERS = [member('u1', 'Jerry Chu'), member('u2', 'peter')];

// A real scanned menu's picks, printed prices and all. Two of the four carry no
// price, which is the ordinary case and the reason the total is a floor.
const DISHES = [
  { key: 'd1', name: 'Pan-Fried Fish with Tofu', name_zh: '砂鍋煎焗魚卜斑腩', price: '$158' },
  { key: 'd2', name: 'Egg white stir-fried with rice vermicelli', name_zh: '瑤柱蛋白炒米粉', price: '58' },
  { key: 'd3', name: 'Slippery egg and shrimp stir-fried chow fun', name_zh: '滑蛋蝦仁河', price: null },
  { key: 'd4', name: 'Black pepper beef stir-fried noodles', name_zh: '黑椒牛柳絲炒面', price: null },
];

// translateZ(0) makes this the containing block for the fixed 去評分 bar, so it
// renders in a phone-sized footprint instead of smearing across the capture.
// Deliberately NO fixed height: the bar sits 62px off its container's bottom, so
// pinning the box shorter than the content drops the bar straight onto the
// 如何付款 pills — which is a preview artefact, not what the app does. Letting
// the box grow to the content puts it back inside .settle's own 150px foot.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ transform: 'translateZ(0)', position: 'relative', maxWidth: 420 }}>
      {children}
    </div>
  );
}

/** The bill as it lands: nothing chosen yet, all three ways open. The "+" on the
 *  total is load-bearing and the line under it says so out loud, because a
 *  number people are about to hand money over on must never quietly mean
 *  "at least". */
export function Undecided() {
  return (
    <Shell>
      <TableSettle dishes={DISHES} members={MEMBERS} you="u1" colorFor={colorFor}
        payMethod={null} payerId={null} onChoose={() => {}} />
    </Shell>
  );
}

/** 平均分攤. The chosen way ink-fills — the same "this is settled" treatment
 *  .btn.primary carries everywhere else, never vermillion. Shares round UP to
 *  the cent so the table can't collect short. */
export function EqualSplit() {
  return (
    <Shell>
      <TableSettle dishes={DISHES} members={MEMBERS} you="u1" colorFor={colorFor}
        payMethod="equal" payerId={null} onChoose={() => {}} />
    </Shell>
  );
}

/** 隨機一人, seen by someone who dodged it. The draw is a function of the session
 *  itself, so it reads the same on every screen and cannot be rerolled by
 *  switching away and back. */
export function RandomPayer() {
  return (
    <Shell>
      <TableSettle dishes={DISHES} members={MEMBERS} you="u1" colorFor={colorFor}
        payMethod="random" payerId="u2" onChoose={() => {}} />
    </Shell>
  );
}

/** The same draw, seen by the person who lost it. Second person, not their own
 *  name: being told "Jerry Chu pays" while you ARE Jerry Chu is how a bill
 *  screen gets misread at exactly the wrong moment. */
export function YouPay() {
  return (
    <Shell>
      <TableSettle dishes={DISHES} members={MEMBERS} you="u1" colorFor={colorFor}
        payMethod="random" payerId="u1" onChoose={() => {}} />
    </Shell>
  );
}

/** A bigger table, every price printed, so the total is exact and the trailing
 *  "+" is correctly absent. Also the four-chop roster. */
export function WholeTable() {
  return (
    <Shell>
      <TableSettle
        dishes={[
          { key: 'e1', name: 'Beef Chow Fun', name_zh: '乾炒牛河', price: '$88' },
          { key: 'e2', name: 'Poached Chicken', name_zh: '白切雞', price: '$168' },
          { key: 'e3', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷', price: '$98' },
          { key: 'e4', name: 'Pineapple Bun with Butter', name_zh: '菠蘿油', price: '$28' },
        ]}
        members={[...MEMBERS, member('u3', 'Wing'), member('u4', 'Priya Raman')]}
        you="u3" colorFor={colorFor} payMethod="equal" payerId={null} onChoose={() => {}} />
    </Shell>
  );
}
