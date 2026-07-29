import { NextRequest, NextResponse } from 'next/server';
import { scanMenuSkeletonStream, enrichOneDish, scoreOneDish } from '@/lib/menuScan';
import { canaryVerdict, type CanaryTimings } from '@/lib/scanCanary';

// The stream alone may legitimately run to its 50s ceiling; probes run
// CONCURRENTLY with it (see below), so 60 covers the whole run.
export const maxDuration = 60;

/**
 * GET /api/canary/scan — daily scheduled scan of the fixed Japanese-script
 * menu (public/canary-menu.jpg) through the REAL stage-1 pipeline plus one
 * enrich probe and one score probe. Judgment lives in lib/scanCanary.ts —
 * see there for why this exists and what it deliberately cannot catch.
 *
 * Emits ONE `scan-canary` log line; a breach ALSO goes to console.error,
 * because Vercel's error clusters outlive raw runtime logs (~7d vs ~1d on
 * this plan) — the alarm has to survive until someone looks.
 *
 * Same auth as the other crons (mf/train, persona-daily): Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically for cron invocations
 * when CRON_SECRET is set. Fails closed without it — an open endpoint that
 * triggers LLM calls is a denial-of-wallet vector. Probes are text-only and
 * write nothing; stage 1 reads a public fixture and writes nothing.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The fixture is served from this deployment's own public/ — no bundling
  // tricks, and the fetch doubles as a static-asset health check.
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const photoRes = await fetch(`${base}/canary-menu.jpg`);
  if (!photoRes.ok) {
    console.error(`scan-canary CANARY_BREACH=fixture_missing status=${photoRes.status}`);
    return NextResponse.json({ error: 'Fixture missing.' }, { status: 500 });
  }
  const base64 = Buffer.from(await photoRes.arrayBuffer()).toString('base64');

  const started = Date.now();

  // Probes fire FIRST and run concurrently with the stream — they are
  // independent single-dish text calls on fixed inputs (dishes that are ON
  // the fixture menu, so the probe exercises exactly what a real scan of it
  // would). Sequencing them after a possibly-50s stream would blow the
  // function budget for no reason.
  const enrichProbe = (async (): Promise<number | null> => {
    const t0 = Date.now();
    try {
      const e = await enrichOneDish({ name: '揚げ出し豆腐', name_zh: '炸豆腐', cuisine: 'japanese' });
      return e.hook ? Date.now() - t0 : null; // empty hook = the call failed internally
    } catch { return null; }
  })();
  const scoreProbe = (async (): Promise<number | null> => {
    const t0 = Date.now();
    try {
      const v = await scoreOneDish({ name: 'うなぎ丼', name_zh: '鰻魚飯', cuisine: 'japanese' });
      return Object.keys(v).length > 0 ? Date.now() - t0 : null; // {} = degenerate/failed vector
    } catch { return null; }
  })();

  let items = 0;
  let firstItemMs: number | null = null;
  try {
    for await (const ev of scanMenuSkeletonStream(base64, 'image/jpeg')) {
      if (ev.kind === 'item') {
        items++;
        if (firstItemMs === null) firstItemMs = Date.now() - started;
      }
    }
  } catch (e) {
    // A thrown stream still produces a verdict below — items=0 or a partial
    // count IS the finding; the canary must report, not crash.
    console.error('scan-canary: stream threw', e);
  }
  const namesDoneMs = Date.now() - started;

  const timings: CanaryTimings = {
    items,
    first_item_ms: firstItemMs,
    names_done_ms: namesDoneMs,
    enrich_probe_ms: await enrichProbe,
    score_probe_ms: await scoreProbe,
  };
  const verdict = canaryVerdict(timings);

  console.log(verdict.line);
  if (!verdict.healthy) console.error(verdict.line); // error clusters retain ~7d

  return NextResponse.json({ ...timings, healthy: verdict.healthy, breaches: verdict.breaches });
}
