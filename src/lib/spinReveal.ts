// 隨機一人's reveal: a halo ring that travels the roster, fast at first, and
// coasts to a stop on the person who is paying.
//
// THE ANIMATION DOES NOT CHOOSE THE PAYER. drawPayer already did, server-side and
// deterministically, and this schedule is built backwards from that answer so it
// arrives there. That inversion is the whole point, because the obvious
// construction is broken in a way that only shows up in the field: run a fixed
// easing curve for a fixed 5 seconds, tick the ring on each step, and announce
// whoever it lands on. The landing seat is then a pure function of (curve, member
// count) — every four-person table would pay in the same seat, every time, for
// good. Owner caught this before it was built (2026-07-31). Choosing the
// destination first and solving for the path is what removes it entirely: the seat
// depends on the session, not on the arithmetic of the animation.
//
// Deterministic per session, so every phone at the table runs the SAME spin and
// stops on the same beat — one shared moment rather than four private ones. It
// also means the spin can't be re-rolled by watching it again, the same property
// the draw itself has.
import { seededRandom } from './blobForm';

/** Long enough to build a little dread, short enough that nobody puts the phone
 *  down. The owner asked for 5s and it is the whole animation's budget: the last
 *  tick lands exactly here, never past it. */
export const SPIN_MS = 5000;
/** How many times the ring MOVES, before being rounded up to land on the payer.
 *  Chosen as a move count rather than a number of laps so the pace feels the same
 *  at a table of two as at a table of six — laps would make a pair crawl. */
const MIN_MOVES = 20;
const MOVE_SPREAD = 9;

export type Spin = {
  /** Which seat wears the ring before the first tick. Varied per session so the
   *  spin doesn't visibly always set off from the same chop. */
  startIndex: number;
  /** Elapsed-ms at which the ring leaves its current seat. After tick k the ring
   *  is on (startIndex + k + 1) % count, so the final entry lands on the payer —
   *  which is what lets the component hand back to the plain payer ring with no
   *  visible jump when the spin ends. */
  ticks: number[];
};

/**
 * The path to `targetIndex`, in `count` seats, over `durationMs`.
 *
 * Deceleration is quadratic ease-out, i.e. velocity falling linearly to zero —
 * not a taste decision but what a spun wheel actually does under friction, which
 * is why it reads as physical. Ticks are the times at which that motion crosses
 * each seat boundary: t(k) = T·(1 − √(1 − k/moves)). At ~24 moves that opens near
 * 10 ticks a second and closes with a ~1s final beat.
 *
 * Returns an empty schedule when there is nothing honest to animate (a table of
 * one, or a payer who isn't at it) — the caller then just shows the ring.
 */
export function buildSpin(
  count: number, targetIndex: number, sessionId: string, durationMs: number = SPIN_MS,
): Spin {
  if (count <= 1 || targetIndex < 0 || targetIndex >= count) return { startIndex: 0, ticks: [] };

  // A stream of its own, not drawPayer's: the two answers are independent, and
  // seeding both off the bare session id would tie the path's shape to the seat
  // it ends on for no reason.
  const rand = seededRandom(`${sessionId}:spin`);
  const startIndex = Math.floor(rand() * count);
  const wanted = MIN_MOVES + Math.floor(rand() * MOVE_SPREAD);

  // Round the wanted length UP to the next count that comes to rest on the payer.
  // This is the inversion: the destination is fixed and the trip stretches by at
  // most one lap to reach it, rather than the trip being fixed and the
  // destination falling out of it.
  const offset = (((targetIndex - startIndex) % count) + count) % count;
  const moves = wanted + ((((offset - wanted) % count) + count) % count);

  const ticks: number[] = [];
  for (let k = 1; k <= moves; k++) ticks.push(durationMs * (1 - Math.sqrt(1 - k / moves)));
  return { startIndex, ticks };
}

/**
 * The aside under the reveal, chosen by how many times the table has drawn.
 *
 * Null on the first draw: that one is the ceremony and wants no commentary. From
 * the second on, the screen starts noticing — which is the point of making the
 * draw re-rollable at all (owner, 2026-07-31: "if they keep playing it or someone
 * refuse to pay, it's part of the fun"). The remark is a REMARK only, never the
 * answer: who pays is said by the payer line it sits under, so these lines carry
 * no name and need no separate you-form.
 *
 * Keyed off shared state rather than a per-phone tally, so the whole table reads
 * the same line at the same time — a private count would have four people looking
 * at four different jokes about one draw.
 */
export function revealRemarkKey(drawCount: number): string | null {
  const n = Math.floor(drawCount);
  if (n <= 1) return null;
  // Past the ladder it holds on the last rung. A table on its tenth draw being met
  // with the same flat line is funnier than a fresh quip, and it never runs dry.
  const rung = Math.min(n, 7);
  return `table.settle.remark${rung}`;
}

/** Where the ring sits `elapsed` ms in. Separate from buildSpin so the component
 *  holds no arithmetic of its own, and so the landing is testable without a clock:
 *  at elapsed ≥ durationMs this is always the payer's seat. */
export function spinIndexAt(spin: Spin, count: number, elapsed: number): number {
  if (count <= 0) return 0;
  let moved = 0;
  while (moved < spin.ticks.length && spin.ticks[moved] <= elapsed) moved++;
  return (spin.startIndex + moved) % count;
}
