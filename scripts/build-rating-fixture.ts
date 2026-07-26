// Pulls the owner's real rating history into a fixture for the scale-calibration
// simulation. The JSON is gitignored, not committed — this repo is public and
// these are a real person's meals; rebuild it locally when you need it.
//   npx tsx scripts/build-rating-fixture.ts   (needs SUPABASE env)
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER = process.env.SIM_USER_ID!;
(async () => {
  const sb = createClient(url, key);
  const { data, error } = await sb.from('ratings')
    .select('score, created_at, dishes(cuisine, attributes)')
    .eq('user_id', USER).order('created_at');
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({ s: r.score, c: r.dishes?.cuisine ?? null, a: r.dishes?.attributes ?? {} }));
  writeFileSync('scripts/rating-history.json', JSON.stringify(rows, null, 0));
  console.log(rows.length, 'ratings written');
})();
