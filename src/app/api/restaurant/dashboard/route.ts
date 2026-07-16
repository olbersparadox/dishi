import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { DIMS, DishVector } from '@/lib/taste';

/**
 * GET /api/restaurant/dashboard?restaurant_id=...
 * Owner analytics, all computed from data the platform already has:
 *  - per-dish performance: rating count, average delight (0-100), helpful marks
 *  - hidden gems: dishes rated clearly above the restaurant's average but logged
 *    less often than its median dish — the ones worth putting on the specials board
 *  - "what people love you for": the attribute dims most present in the restaurant's
 *    POSITIVELY-rated dishes, weighted by how positive — a taste-vector portrait of
 *    the kitchen's strengths as diners actually experience them
 * Requires a claim on the restaurant. Aggregates only — no individual diner's rating
 * is ever attributed to a person in what the owner sees.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id');
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id is required.' }, { status: 400 });

  const { data: claim } = await supabase
    .from('restaurant_claims').select('status')
    .eq('restaurant_id', restaurantId).eq('user_id', user.id).maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Claim this restaurant first.' }, { status: 403 });

  const admin = supabaseAdmin();
  const [{ data: restaurant }, { data: dishes }, { data: identities }] = await Promise.all([
    admin.from('restaurants').select('id, name, address').eq('id', restaurantId).single(),
    admin.from('dishes').select('id, name, cuisine, photo_url, attributes, created_at, source, dish_identity_id')
      .eq('restaurant_id', restaurantId),
    admin.from('dish_identities').select('id, name, name_zh').eq('restaurant_id', restaurantId),
  ]);
  const identityNames = new Map((identities ?? []).map(i => [i.id, i.name]));
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });

  const dishIds = (dishes ?? []).map(d => d.id);
  const [{ data: ratings }, { data: marks }] = dishIds.length
    ? await Promise.all([
        admin.from('ratings').select('dish_id, score').in('dish_id', dishIds),
        admin.from('helpful_marks').select('dish_id').in('dish_id', dishIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  // Per-dish aggregates.
  const byDish = new Map<string, { sum: number; n: number }>();
  for (const r of ratings ?? []) {
    const agg = byDish.get(r.dish_id) ?? { sum: 0, n: 0 };
    agg.sum += r.score; agg.n += 1;
    byDish.set(r.dish_id, agg);
  }
  const marksByDish = new Map<string, number>();
  for (const m of marks ?? []) marksByDish.set(m.dish_id, (marksByDish.get(m.dish_id) ?? 0) + 1);

  const to100 = (x: number) => Math.round(Math.min(100, Math.max(0, (x + 1) * 50)));

  const dishStats = (dishes ?? []).map(d => {
    const agg = byDish.get(d.id);
    return {
      id: d.id, name: d.name, cuisine: d.cuisine, photo_url: d.photo_url,
      rating_count: agg?.n ?? 0,
      avg_delight: agg && agg.n > 0 ? to100(agg.sum / agg.n) : null,
      helpful_marks: marksByDish.get(d.id) ?? 0,
      _avgRaw: agg && agg.n > 0 ? agg.sum / agg.n : null,
    };
  }).sort((a, b) => (b.avg_delight ?? -1) - (a.avg_delight ?? -1));

  // Hidden gems: clearly above the restaurant's own average, but under-logged.
  const ratedDishes = dishStats.filter(d => d._avgRaw !== null && d.rating_count > 0);
  const restAvg = ratedDishes.length
    ? ratedDishes.reduce((s, d) => s + d._avgRaw!, 0) / ratedDishes.length : 0;
  const counts = ratedDishes.map(d => d.rating_count).sort((a, b) => a - b);
  const medianCount = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  const hiddenGems = ratedDishes
    .filter(d => d._avgRaw! > restAvg + 0.15 && d.rating_count <= medianCount && ratedDishes.length >= 3)
    .slice(0, 3)
    .map(({ _avgRaw, ...d }) => d);

  // "What people love you for": positive-rating-weighted attribute presence.
  const dimWeights: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]));
  let totalWeight = 0;
  const attrsById = new Map((dishes ?? []).map(d => [d.id, d.attributes as DishVector]));
  for (const r of ratings ?? []) {
    if (r.score <= 0.2) continue;
    const attrs = attrsById.get(r.dish_id);
    if (!attrs) continue;
    for (const dim of DIMS) dimWeights[dim] += r.score * (attrs[dim] ?? 0);
    totalWeight += r.score;
  }
  const lovedFor = totalWeight > 0
    ? DIMS.map(d => ({ dim: d, weight: dimWeights[d] / totalWeight }))
        .filter(x => x.weight > 0.25)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(x => x.dim)
    : [];

  // "Popular from menu scans" (A in the owner's two-metric ask): how many people
  // picked each dish off a scanned menu or at a table session here, and how many of
  // those have gone on to actually rate it. Grouped by NAME — five different people
  // picking "Mapo Tofu" are five signals about ONE dish, not five different dishes.
  // Pure interest signal; never conflated with the real kitchen order queue (B),
  // which lives entirely in table_orders and the Orders tab.
  const pickRows = (dishes ?? []).filter(d => d.source === 'scan' || d.source === 'table');
  const pickIds = pickRows.map(d => d.id);
  const pickRatingsByDish = new Map<string, number>();
  if (pickIds.length) {
    for (const id of pickIds) {
      const agg = byDish.get(id);
      if (agg && agg.n > 0) pickRatingsByDish.set(id, agg.sum / agg.n);
    }
  }
  // Grouping key, strongest signal first:
  //   1. dish_identity_id — a human confirmed these rows are one real dish, even
  //      when the names diverge (蝦餃 / 水晶鮮蝦餃). Displayed under the identity's
  //      canonical name.
  //   2. normalised name — the legacy path, still correct for the many rows that
  //      were never linked (nothing is linked retroactively; identities only form
  //      when someone actually confirms one at log time).
  // An unlinked dish therefore behaves exactly as it did before this change, and a
  // linked one stops being double-counted. Never the reverse: a wrong merge here
  // would corrupt an owner's read of their own menu.
  const groupKeyOf = (d: { name: string; dish_identity_id?: string | null }) =>
    d.dish_identity_id ? `id:${d.dish_identity_id}` : `name:${d.name.trim().toLowerCase()}`;

  const byGroup = new Map<string, { picks: number; rated: number; sumScore: number }>();
  const labelByGroup = new Map<string, string>();
  for (const d of pickRows) {
    const key = groupKeyOf(d);
    const agg = byGroup.get(key) ?? { picks: 0, rated: 0, sumScore: 0 };
    agg.picks += 1;
    const score = pickRatingsByDish.get(d.id);
    if (score !== undefined) { agg.rated += 1; agg.sumScore += score; }
    byGroup.set(key, agg);
    if (!labelByGroup.has(key)) {
      const canonical = d.dish_identity_id ? identityNames.get(d.dish_identity_id) : null;
      labelByGroup.set(key, canonical ?? d.name);
    }
  }
  const popularPicks = Array.from(byGroup.entries())
    .map(([key, agg]) => ({
      name: labelByGroup.get(key) ?? key,
      picks: agg.picks,
      rated: agg.rated,
      avg_delight: agg.rated > 0 ? to100(agg.sumScore / agg.rated) : null,
    }))
    .sort((a, b) => b.picks - a.picks)
    .slice(0, 8);

  return NextResponse.json({
    restaurant,
    claim_status: claim.status,
    totals: {
      dishes_logged: dishes?.length ?? 0,
      ratings: ratings?.length ?? 0,
      avg_delight: ratedDishes.length ? to100(restAvg) : null,
      helpful_marks: (marks ?? []).length,
    },
    dishes: dishStats.map(({ _avgRaw, ...d }) => d),
    hidden_gems: hiddenGems,
    loved_for: lovedFor,
    popular_picks: popularPicks,
  });
}
