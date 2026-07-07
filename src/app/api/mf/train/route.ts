import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { trainMF } from '@/lib/mf';

export const maxDuration = 60;

/**
 * POST /api/mf/train
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * Retrains the matrix-factorization model on the full ratings table and persists the
 * result. Not user-triggered — runs on Vercel's cron schedule (see vercel.json) as the
 * ratings table grows. Vercel automatically attaches this bearer token to scheduled
 * invocations when CRON_SECRET is set as an environment variable, so this endpoint is
 * protected without any custom wiring — but it also means you can trigger a manual
 * retrain yourself by sending the same header (e.g. via curl or Postman) any time.
 *
 * At MVP scale (thousands of rows) this runs synchronously in one request. If the
 * ratings table grows past what fits in one serverless invocation, move this to a
 * queued/background job — the training function itself doesn't change.
 */
export async function POST(req: NextRequest) {
  return handleTrain(req);
}

/** Vercel cron invokes scheduled paths with GET — support both. */
export async function GET(req: NextRequest) {
  return handleTrain(req);
}

async function handleTrain(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: ratings, error } = await admin.from('ratings').select('user_id, dish_id, score');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!ratings || ratings.length < 10) {
    return NextResponse.json({ skipped: true, reason: 'Not enough ratings to train on yet.' });
  }

  // Fixed seed: every retrain on the same data yields the same model — regressions
  // in recommendations become debuggable instead of mysterious.
  const model = trainMF(ratings, { seed: 42 });

  // Persist in batches; jsonb keeps each row small regardless of factor count.
  const userRows = Object.entries(model.userFactors).map(([user_id, factors]) => ({
    user_id, factors, bias: model.userBias[user_id] ?? 0, updated_at: new Date().toISOString(),
  }));
  const dishRows = Object.entries(model.dishFactors).map(([dish_id, factors]) => ({
    dish_id, factors, bias: model.dishBias[dish_id] ?? 0, updated_at: new Date().toISOString(),
  }));

  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const batch of chunk(userRows, 500)) {
    const { error: e } = await admin.from('mf_user_factors').upsert(batch);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  for (const batch of chunk(dishRows, 500)) {
    const { error: e } = await admin.from('mf_dish_factors').upsert(batch);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const { error: stateErr } = await admin.from('mf_model_state').update({
    trained_at: new Date().toISOString(),
    rating_count: model.ratingCount,
    distinct_users: model.distinctUsers,
    distinct_dishes: model.distinctDishes,
    num_factors: model.numFactors,
    global_bias: model.globalBias,
  }).eq('id', true);
  if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    trained_on: { ratings: model.ratingCount, users: model.distinctUsers, dishes: model.distinctDishes },
  });
}
