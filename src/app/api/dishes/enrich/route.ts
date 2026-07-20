import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scoreOneDish, enrichOneDish } from '@/lib/menuScan';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';
import { replayProfile } from '@/lib/replay';

export const maxDuration = 60;

/**
 * POST /api/dishes/enrich { id } -> { dish }
 *
 * The deferred half of a typed-name log (fix B). createFromName returns a
 * name-only dish instantly; the client fires this in the background to fill in
 * cuisine, taste attributes, diet/cooking/heaviness, and the missing-language
 * name — the 20-30s of qwen work that must never block the rating screen.
 *
 * Because the person will usually rate the dish BEFORE this lands (nobody waits
 * 30s), a rating made against the empty attributes would learn nothing. So after
 * enriching, if the dish has already been rated, we re-run the full taste replay —
 * the exact mechanism a re-rate uses (see /api/ratings) — so the profile heals to
 * reflect the real attributes. If the rating instead arrives AFTER this, it reads
 * the now-populated attributes and learns correctly with no replay needed; either
 * ordering is safe. Idempotent: an already-enriched dish is a no-op.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string') return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const { data: dish } = await supabase
    .from('dishes')
    .select('id, user_id, name, name_zh, attributes')
    .eq('id', id)
    .maybeSingle();
  if (!dish || dish.user_id !== user.id) {
    return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });
  }
  // Already enriched (attributes populated — this ran already, or it's a photo/menu
  // dish that arrived with attributes). Nothing to do.
  if (dish.attributes && Object.keys(dish.attributes as Record<string, unknown>).length > 0) {
    return NextResponse.json({ dish });
  }

  const name = (dish.name ?? '').trim();
  const nameZh = (dish.name_zh ?? '').trim();
  // name is NOT NULL, so it always holds something; when only Chinese was typed it
  // parks the Chinese as a placeholder (name === name_zh). Work out which language
  // is genuinely still missing so translateDishName fills the right slot.
  const needEn = !name || name === nameZh; // English slot empty or still the zh placeholder
  const needZh = !nameZh;                  // Chinese slot empty
  const seed = name || nameZh;             // reason from whatever the person typed

  const [cuisineInferred, attributes, enrichment, translated] = await Promise.all([
    inferCuisineFromName(seed).catch(() => null),
    scoreOneDish({ name: seed, cuisine: 'unknown' }).catch(() => ({})),
    enrichOneDish({ name: seed, name_zh: nameZh || null, cuisine: 'unknown' }).catch(() => null),
    (needEn || needZh) ? translateDishName(seed).catch(() => null) : Promise.resolve(null),
  ]);

  const update: Record<string, unknown> = {
    cuisine: cuisineInferred ?? 'unknown',
    attributes,
    cooking_method: enrichment?.cooking_method ?? null,
    heaviness: enrichment?.heaviness ?? null,
    diet: enrichment?.diet ?? [],
  };
  // translateDishName auto-detects direction, so a Chinese seed yields English and
  // vice-versa — exactly the missing slot. Not a human edit, so name_edited_at is
  // deliberately left untouched (the human authority is the typed name).
  if (translated) {
    if (needEn) update.name = translated;
    else if (needZh) update.name_zh = translated;
  }

  const { data: updated } = await supabase
    .from('dishes').update(update).eq('id', id).select().single();

  // If the person already rated this dish (the common case — they rated within
  // seconds while this ran), that rating learned from empty attributes. Heal it by
  // replaying the whole profile against the dishes' CURRENT attributes.
  const { data: rated } = await supabase
    .from('ratings').select('id').eq('user_id', user.id).eq('dish_id', id).maybeSingle();
  if (rated) {
    const rebuilt = await replayProfile(supabase, user.id);
    if (rebuilt) {
      // rating_count is intentionally omitted: replay doesn't change it, and an
      // upsert leaves unspecified columns untouched on the (guaranteed-existing) row.
      await supabase.from('taste_profiles').upsert({
        user_id: user.id,
        vector: rebuilt.vector,
        cuisine_affinity: rebuilt.cuisine_affinity,
        evidence: rebuilt.evidence,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // ingredients aren't a stored column, but the client (the growth/refine screen)
  // shows them as chips — pass them through on the response only.
  return NextResponse.json({ dish: { ...(updated ?? dish), ingredients: enrichment?.ingredients ?? [] } });
}
