// The settle phase: when a table stops picking, and who carries the bill.
//
// Picking ends by HANDSHAKE, not by any one person's say-so — every member taps
// the cart bar, and only the last tap flips the table over. That shape is the
// whole point: a bill is a group fact, so no member gets to decide unilaterally
// that everyone else is finished looking at the menu.
//
// Pure logic only. The API routes own the writes (table_members and
// table_sessions are both RLS-locked against this kind of update, so they go
// through the admin client), and the screens own the pixels.
import { seededRandom } from './blobForm';

export type ReadyMember = { user_id: string; ready_at?: string | null };

/**
 * Everyone has tapped. Deliberately requires at least two members: a solo
 * scanner is trivially "all ready" against themselves, and letting that count
 * would drop a lone diner into a split-the-bill screen with nobody to split
 * against. Solo keeps the cart bar's original link to the rating queue.
 */
export function allMembersReady(members: ReadyMember[]): boolean {
  return members.length >= 2 && members.every(m => !!m.ready_at);
}

/** How far along the handshake is, for the waiting layer's "2 / 3". */
export function readyCount(members: ReadyMember[]): number {
  return members.filter(m => !!m.ready_at).length;
}

export type Split = {
  /** What each person owes. Rounded UP to the cent so the table can never
   *  collect less than the bill — a rounding shortfall is the host's problem
   *  otherwise, and a cent per head is not worth a decimal-place argument. */
  each: number;
  people: number;
  /** Total minus what the rounded shares actually collect: 0 when the bill
   *  divides evenly, a few cents otherwise. Surfaced rather than hidden so the
   *  screen can stay honest about the shares not summing to the printed total. */
  overshoot: number;
};

export function equalSplit(total: number, people: number): Split {
  if (people <= 0) return { each: 0, people: 0, overshoot: 0 };
  const each = Math.ceil((total / people) * 100) / 100;
  return { each, people, overshoot: Math.round((each * people - total) * 100) / 100 };
}

/**
 * The one member who pays for everyone, drawn from the session id alone.
 *
 * Deterministic on purpose, for two reasons that both bite in the real thing:
 * two people tapping 隨機 at the same moment compute the SAME answer, so the
 * first write winning can never make the name visibly flip on the second
 * person's screen; and a client can't reroll until it likes the result, because
 * there is nothing to reroll — the answer is a function of the table itself.
 *
 * Sorted internally so the draw doesn't depend on member arrival order, the
 * same rule chopColorMap follows.
 */
export function drawPayer(userIds: string[], sessionId: string): string | null {
  const sorted = Array.from(new Set(userIds)).sort();
  if (sorted.length === 0) return null;
  return sorted[Math.floor(seededRandom(sessionId)() * sorted.length)];
}
