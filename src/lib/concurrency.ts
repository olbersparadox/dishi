/**
 * The concurrency cap matters for real reasons, not just politeness: firing every
 * item as a simultaneous request risks the provider's rate limits kicking in and
 * turning "many small fast calls" into "many small calls, several of which fail."
 * A modest cap keeps the wall-clock benefit of parallelism while keeping the whole
 * batch inside a size that reliably succeeds.
 */
/**
 * Push-as-you-go concurrency-capped task pool, for work that arrives over time
 * instead of as a ready array — built for the scan pipeline, where each dish
 * starts enriching/scoring the MOMENT it streams in, not after the whole menu
 * finishes (measured 2026-07-29: a Japanese menu's skeleton stream held its
 * connection for the full 50s timeout, and because the per-dish stages waited
 * for it to end, chips/recommendations couldn't even BEGIN until nearly a
 * minute in). Replaced the array-in/array-out mapWithConcurrency that used to
 * live here — the pool is the same engine minus the requirement to know all
 * the work up front, and both scan callers now push per item.
 *
 * Contracts: at most `limit` in flight, `onEach` fires the moment each result
 * lands (not after the batch), one task's failure never touches the others
 * (null result + the error passed to onEach). `drain()` closes the pool and
 * resolves with the results array (indexed by the caller's own `index`, holes
 * filled with null) once everything pushed has finished.
 */
export function createTaskPool<R>(
  limit: number,
  onEach?: (result: R | null, index: number, error: unknown) => void,
) {
  const results: (R | null)[] = [];
  const queue: { index: number; task: () => Promise<R> }[] = [];
  let active = 0;
  let closed = false;
  let resolveDrain: (r: (R | null)[]) => void;
  const drained = new Promise<(R | null)[]>(r => { resolveDrain = r; });

  function maybeSettle() {
    if (closed && active === 0 && queue.length === 0) {
      for (let i = 0; i < results.length; i++) if (results[i] === undefined) results[i] = null;
      resolveDrain(results);
    }
  }

  function pump() {
    while (active < limit && queue.length > 0) {
      const { index, task } = queue.shift()!;
      active++;
      task()
        .then(r => { results[index] = r; onEach?.(r, index, null); })
        .catch(err => { results[index] = null; onEach?.(null, index, err); })
        .finally(() => { active--; pump(); maybeSettle(); });
    }
  }

  return {
    push(index: number, task: () => Promise<R>) {
      if (closed) return; // late push after drain: dropped, never resurrects the pool
      queue.push({ index, task });
      pump();
    },
    /** Close and wait for everything in flight/queued. Safe to call with
     * nothing ever pushed (resolves immediately with []). */
    drain(): Promise<(R | null)[]> {
      closed = true;
      maybeSettle();
      return drained;
    },
  };
}
