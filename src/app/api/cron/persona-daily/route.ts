import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { choosePicks, type PersonaCandidate } from '@/lib/personaDaily';

export const maxDuration = 60;

/**
 * GET/POST /api/cron/persona-daily
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * Precomputes the day's persona picks (see vercel.json). Same auth shape as
 * /api/mf/train — Vercel attaches the bearer automatically to scheduled runs,
 * and the same header triggers a manual run.
 *
 * EVERY RUN WRITES A persona_runs ROW, including the ones that find nothing.
 * An unattended daily job needs a visible failure path and a legitimate "no
 * good picks today": silence and stale content are both worse than an honest
 * empty, and the feed can only tell them apart if the job says which happened.
 *
 * Sourcing is a query, not a model: candidates come from dishes at restaurants
 * that carry a Google place_id. No venue name is ever generated.
 *
 * AND THE POOL IS PUBLISHED MATERIAL ONLY — posted dishes (dish_posts), never
 * the rated-dish table at large. Every rated dish would be a far bigger pool,
 * and `dishes` is readable, but those are people's PRIVATE logs: surfacing
 * them through a persona would quietly reinstate exactly the blanket-consent
 * publishing that per-dish posts replaced hours earlier. The consent unit is
 * the dish, whoever is doing the surfacing.
 *
 * The cost is real and worth stating: personas were justified as the cold-start
 * answer, and a consent-clean pool is only as big as the posts that exist. Owner
 * -published menus (restaurant_menu_items — public by publication, and
 * Places-verified by the same join) are the next source to add here; today the
 * table is empty. Until then an honest `empty` day is the correct output.
 */
export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const day = new Date().toISOString().slice(0, 10);

  try {
    // POSTED dishes at Places-verified venues. Two joins carry the two
    // guarantees: dish_posts = published with consent, place_id = a real venue.
    const { data: posts, error } = await admin
      .from('dish_posts')
      .select('user_id, dish_id, dishes!inner(id, name, name_zh, cuisine, attributes, is_synthetic, restaurant_id, restaurants!inner(name, place_id))')
      .limit(300);
    if (error) throw new Error(error.message);

    type Row = {
      user_id: string; dish_id: string;
      dishes: {
        id: string; name: string | null; name_zh: string | null; cuisine: string | null;
        attributes: Record<string, number> | null; is_synthetic: boolean | null;
        restaurant_id: string | null; restaurants: { name: string | null; place_id: string | null } | null;
      };
    };
    const rows = ((posts ?? []) as unknown as Row[])
      .filter(r => !r.dishes?.is_synthetic && !!r.dishes?.restaurants?.place_id);

    // The poster's own verdict, read live — the same rule every other surface
    // follows (never snapshotted, because re-rating replays history).
    const scores = new Map<string, number>();
    if (rows.length > 0) {
      const { data: rated } = await admin
        .from('ratings').select('dish_id, user_id, score')
        .in('dish_id', rows.map(r => r.dish_id));
      for (const rt of rated ?? []) {
        const owner = rows.find(r => r.dish_id === rt.dish_id && r.user_id === rt.user_id);
        if (owner) scores.set(owner.dish_id, Number(rt.score));
      }
    }

    const candidates: PersonaCandidate[] = rows
      .filter(r => scores.has(r.dish_id))
      .map(r => ({
        dish_id: r.dishes.id,
        restaurant_id: r.dishes.restaurant_id,
        restaurant: r.dishes.restaurants!.name,
        name: r.dishes.name,
        name_zh: r.dishes.name_zh,
        cuisine: r.dishes.cuisine,
        attributes: (r.dishes.attributes ?? {}) as Record<string, number>,
        score: scores.get(r.dish_id)!,
      }));

    const picks = choosePicks(candidates, day);

    // Replace the day rather than accumulate: a re-run is a correction, not a
    // second edition.
    await admin.from('persona_items').delete().eq('day', day);
    if (picks.length > 0) {
      const { error: insErr } = await admin.from('persona_items').insert(picks);
      if (insErr) throw new Error(insErr.message);
    }

    await admin.from('persona_runs').upsert({
      day, status: picks.length > 0 ? 'ok' : 'empty', item_count: picks.length,
      error: null, ran_at: new Date().toISOString(),
    }, { onConflict: 'day' });

    return NextResponse.json({ day, status: picks.length > 0 ? 'ok' : 'empty', items: picks.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown failure';
    // The failure is RECORDED, not just returned: nobody reads a cron's HTTP
    // response, and a broken job that looks like a quiet day is the exact
    // outcome the visible-failure-path amendment exists to prevent.
    await admin.from('persona_runs').upsert({
      day, status: 'failed', item_count: 0, error: message.slice(0, 500),
      ran_at: new Date().toISOString(),
    }, { onConflict: 'day' });
    return NextResponse.json({ day, status: 'failed', error: message }, { status: 500 });
  }
}
