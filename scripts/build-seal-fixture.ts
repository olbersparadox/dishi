// Pulls the owner's real sealed predictions into the fixture the band
// simulations replay. NOT committed — the rows are a real person's meals and
// this repo is public (same rule as build-rating-fixture.ts). Rebuild locally
// before running any simulate-seal-* script.
//   npx tsx scripts/build-seal-fixture.ts   (needs SUPABASE env + SIM_USER_ID)
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER = process.env.SIM_USER_ID!;
(async () => {
  const sb = createClient(url, key);
  // Revealed rows only: a pending seal has no actual_score to score against,
  // and the sealed-bet contract says nothing pending may be read out anyway.
  const { data, error } = await sb.from('sealed_predictions')
    .select('predicted_raw, actual_score, outcome, predicted_direction, engine_rating_count, dishes(cuisine, attributes)')
    .eq('user_id', USER).not('outcome', 'is', null).order('sealed_at');
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    predicted_raw: r.predicted_raw,
    actual_score: r.actual_score,
    outcome: r.outcome,
    predicted_direction: r.predicted_direction,
    engine_rating_count: r.engine_rating_count,
    cuisine: r.dishes?.cuisine ?? null,
    attributes: r.dishes?.attributes ?? {},
  }));
  writeFileSync('scripts/seal-rows.json', JSON.stringify(rows, null, 0));
  console.log(rows.length, 'seals written');
})();
