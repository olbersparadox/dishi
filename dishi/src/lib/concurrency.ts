/**
 * Run `worker` over every item with at most `limit` in flight at once, calling
 * `onEach` the moment EACH result lands (not waiting for the rest) — this is what
 * lets the scan UI light up individual rings as their scores arrive, in whatever
 * order they actually finish, rather than waiting for the slowest one to unblock
 * everything.
 *
 * The concurrency cap matters for real reasons, not just politeness: firing every
 * item as a simultaneous request risks the provider's rate limits kicking in and
 * turning "many small fast calls" into "many small calls, several of which fail."
 * A modest cap keeps the wall-clock benefit of parallelism while keeping the whole
 * batch inside a size that reliably succeeds.
 *
 * A single worker failure never aborts the batch: it's caught, reported via
 * onEach(null-ish result), and everything else keeps going.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onEach?: (result: R | null, index: number, error: unknown) => void,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;

  async function runOne() {
    while (next < items.length) {
      const i = next++;
      try {
        const r = await worker(items[i], i);
        results[i] = r;
        onEach?.(r, i, null);
      } catch (err) {
        results[i] = null;
        onEach?.(null, i, err);
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runOne);
  await Promise.all(workers);
  return results;
}
