'use client';
// TEMPORARY visual harness for the 大話骰 screens. NOT part of the product —
// delete before committing. It exists because the five game states need four
// players taking turns, which cannot be produced solo against the real API.
// It mounts the REAL TableSettle (never a lookalike) and feeds it the design
// handoff's own content, so screenshots line up with the spec's mocks.
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import TableSettle from '@/components/TableSettle';
import type { DiceGameView } from '@/lib/tableDice';
import type { Die } from '@/lib/liarsDice';

const seat = (user_id: string, display_name: string, handle: string, color: string) => ({
  user_id, display_name, handle, color,
  username_claimed: true, has_profile: true, rating_count: 12, ready_at: null,
});
const M = [
  seat('u-jerry', 'Jerry Chu', 'jerry', '#3B82F6'),
  seat('u-chan', '陳大文', 'twchan', '#22C55E'),
  seat('u-wing', 'Wing', 'wing', '#F59E0B'),
  seat('u-priya', 'Priya Raman', 'priya', '#A855F7'),
];
const colorFor = (id: string) => M.find(m => m.user_id === id)?.color ?? '#3B82F6';
const DISHES = [
  { key: 'd1', name: 'Beef Chow Fun', name_zh: '乾炒牛河', price: '$88' },
  { key: 'd2', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷', price: '$128' },
  { key: 'd3', name: 'Soup of the Day', name_zh: '老火例湯', price: null },
];
const ORDER = M.map(m => m.user_id);
const ROLLS: Record<string, Die[]> = {
  'u-jerry': [4, 4, 1, 6, 2], 'u-chan': [4, 3, 2, 5, 6],
  'u-wing': [1, 5, 3, 2, 6], 'u-priya': [2, 6, 3, 5, 3],
};
const bid = (u: string, quantity: number, face: Die) =>
  ({ user_id: u, quantity, face, at: '2026-08-01T12:00:00Z' });

const B1 = [bid('u-jerry', 6, 4)];
const B2 = [...B1, bid('u-chan', 7, 4)];
const B4 = [...B2, bid('u-wing', 8, 4), bid('u-priya', 9, 4)];

const base = {
  round: 1, order: ORDER, firstPlayerId: 'u-jerry',
  yourDice: ROLLS['u-jerry'], reveal: null,
};
const STATES: Record<string, DiceGameView> = {
  '1h': { ...base, direction: null, currentTurnUserId: 'u-jerry', bids: [] },
  '1i': { ...base, direction: 'right', currentTurnUserId: 'u-jerry', bids: [] },
  '1j': { ...base, direction: 'right', currentTurnUserId: 'u-chan', bids: B1 },
  '1l': { ...base, direction: 'right', currentTurnUserId: 'u-wing', bids: B2 },
  '1l2': { ...base, direction: 'right', currentTurnUserId: 'u-jerry', bids: B4 },
  '1m': {
    ...base, direction: 'right', currentTurnUserId: 'u-wing', bids: B4,
    reveal: {
      rolls: ROLLS,
      masks: Object.fromEntries(ORDER.map(u => [u, ROLLS[u].map(d => d === 4 || d === 1)])),
      bid: { quantity: 9, face: 4 as Die }, bidderId: 'u-priya',
      challengerId: 'u-jerry', actual: 5, loserId: 'u-priya',
    },
  },
};

function Harness() {
  const q = useSearchParams();
  const key = q.get('s') ?? '1h';
  const [pending, setPending] = useState(false);
  const hold = () => setPending(true);
  // The other ways the bill lands, for comparing their answer against the game's
  // 全枱得 … 埋單. 'paid' is the game AFTER its reveal is dismissed — the state whose
  // line used to stand orphaned below the three circles.
  const method = key === 'equal' ? 'equal' : key === 'random' ? 'random' : 'game';
  // ?full=1 drops the unpriced dish, so the total is complete and takes the
  // estimate caveat rather than the floor one.
  const dishes = q.get('full') ? DISHES.filter(d => d.price) : DISHES;
  return (
    <div className="page">
      <TableSettle
        dishes={dishes} members={M} you="u-jerry" colorFor={colorFor}
        payMethod={method as 'equal' | 'random' | 'game'}
        payerId={key === 'random' ? 'u-priya' : key === 'paid' ? 'u-priya' : null}
        payDrawCount={key === 'random' ? Number(q.get('d') ?? 1) : 0}
        sessionId="dev" onChoose={() => {}}
        game={method === 'game' ? (STATES[key] ?? (key === 'paid' ? STATES['1m'] : null)) : null}
        dicePending={pending}
        onStartGame={hold} onPickDirection={hold}
        onCallBid={hold} onOpenCups={hold}
      />
    </div>
  );
}
export default function Page() {
  return <Suspense><Harness /></Suspense>;
}
