import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scoreOneDish, enrichOneDish, HK_MENU_SHORTHAND_GUIDANCE } from '@/lib/menuScan';
import { translateDishName, inferCuisineFromName } from '@/lib/translate';
import { replayProfile } from '@/lib/replay';
import { resolveAndStoreCanonicalDish } from '@/lib/dishCanonical';
import { buildExecutionOfferForRatedDish } from '@/lib/executionOffer';

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

  const { id, force } = await req.json().catch(() => ({}));
  if (typeof id !== 'string') return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const { data: dish } = await supabase
    .from('dishes')
    .select('id, user_id, name, name_zh, attributes, canonical_dish_id, ingredients')
    .eq('id', id)
    .maybeSingle();
  if (!dish || dish.user_id !== user.id) {
    return NextResponse.json({ error: 'Dish not found.' }, { status: 404 });
  }
  // Already enriched (attributes populated — this ran already, or it's a photo/menu
  // dish that arrived with attributes). Nothing to do — UNLESS force: a post-rename
  // re-derivation must re-reason from the CURRENT (human-typed) name and overwrite.
  // The typed name is the derivation seed per the authority ladder (HUMAN > VISION);
  // without force this early-return made every post-rename call a silent no-op.
  if (!force && dish.attributes && Object.keys(dish.attributes as Record<string, unknown>).length > 0) {
    // Canonical (cross-venue) resolution rides this branch for photo and
    // menu-pick dishes: they arrive with attributes, so this early return is
    // the ONLY enrich pass they ever make — and the client fires it in the
    // background on every rating pipeline, which makes it the right free slot
    // for the resolver's latency. Only when still unresolved; an honest "none"
    // is retried here at no extra cost next time the dish is rated.
    if (dish.canonical_dish_id == null) {
      const canonical = await resolveAndStoreCanonicalDish(supabase, id, dish.name, dish.name_zh);
      dish.canonical_dish_id = canonical;
      // Resolution landing AFTER the rating is the normal first-session order
      // (enrich runs last in the pipeline). The rating response could not
      // offer the cross-venue comparison — the id didn't exist yet — so the
      // offer rides THIS response instead, and the client queues it exactly
      // as if /api/ratings had sent it.
      if (canonical) {
        const execution = await buildExecutionOfferForRatedDish(supabase, user.id, id);
        if (execution) return NextResponse.json({ dish, execution });
      }
    }
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

  const [cuisineInferred, attributes0, enrichment, translated0] = await Promise.all([
    inferCuisineFromName(seed).catch(() => null),
    scoreOneDish({ name: seed, name_zh: nameZh || null, cuisine: 'unknown' }).catch(() => ({})),
    enrichOneDish({ name: seed, name_zh: nameZh || null, cuisine: 'unknown' }).catch(() => null),
    (needEn || needZh) ? translateDishName(seed).catch(() => null) : Promise.resolve(null),
  ]);

  // ── Honest re-score on a carb-tripwire fire (carb backlog follow-up) ──
  // The enrichment's re-ask corrected the ingredients, but the VECTOR above was
  // scored in PARALLEL from the same misreadable shorthand name — and the vector is
  // what the taste engine eats. Name first, then numbers, per the authority ladder:
  //  1. The English NAME: only when the EN slot is machine-fillable (needEn — an
  //     empty/placeholder slot, so this can never demote a human or menu name),
  //     re-translate WITH the shorthand glossary so 炆米 can't land as "Braised
  //     Rice". The parallel translate above ran without it.
  //  2. The VECTOR: one serial re-score, grounded in the corrected ingredient list
  //     (the strongest honest signal the re-ask produced) + the same recheck line.
  // This is the "one more LLM call per fire" the triage accepted (the name redo is
  // a ~60-token rider on the same fire, only when the EN slot was empty anyway).
  // Failures fall back to the parallel results — degraded, never blocked.
  let attributes = attributes0 as Record<string, number>;
  let translated = translated0;
  if (enrichment?.carb_suspect) {
    const [rescored, retranslated] = await Promise.all([
      scoreOneDish(
        { name: seed, name_zh: nameZh || null, cuisine: 'unknown' },
        { groundIngredients: enrichment.ingredients, carbRecheck: true },
      ).catch(() => null),
      needEn ? translateDishName(seed, { guidance: HK_MENU_SHORTHAND_GUIDANCE }).catch(() => null) : Promise.resolve(null),
    ]);
    if (rescored && Object.keys(rescored).length > 0) attributes = rescored;
    if (retranslated) translated = retranslated;
  }

  // In force mode a FAILED derivation must not wipe good data with empties — keep the
  // existing values and let the client fall back honestly. (First-time enrichment has
  // nothing to protect, so empties there are just "still unknown".)
  const gotAttributes = Object.keys(attributes as Record<string, unknown>).length > 0;
  const update: Record<string, unknown> = {
    cuisine: cuisineInferred ?? 'unknown',
    ...(force && !gotAttributes ? {} : { attributes }),
    ...(force && !enrichment ? {} : {
      cooking_method: enrichment?.cooking_method ?? null,
      heaviness: enrichment?.heaviness ?? null,
      diet: enrichment?.diet ?? [],
      ingredients: enrichment?.ingredients ?? [],
    }),
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

  // Canonical (cross-venue) resolution, from the FINAL stored names — after the
  // translation fill above, and after a force-rename replaced the seed. Always
  // overwrites: a rename away from a catalog dish must CLEAR a stale id, so
  // null is a write, not a skip. Resolution state only — never name authority.
  const finalDish = updated ?? dish;
  const canonical = await resolveAndStoreCanonicalDish(supabase, id, finalDish.name, finalDish.name_zh);

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
        domain_evidence: rebuilt.domain_evidence,
        domain_evidence_t: rebuilt.domain_evidence_t,
        evidence: rebuilt.evidence,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Cross-venue comparison offer for a rating whose canonical id only just
  // landed — same late-offer contract as the early-return branch above.
  const execution = (canonical && rated)
    ? await buildExecutionOfferForRatedDish(supabase, user.id, id)
    : null;

  // finalDish already carries ingredients (stored column, written in `update`
  // above) for the client's growth/refine-screen chips — no override needed.
  return NextResponse.json({
    dish: { ...finalDish, canonical_dish_id: canonical },
    ...(execution ? { execution } : {}),
  });
}
