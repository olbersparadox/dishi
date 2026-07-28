// The 食記 feed — ONE card type, three author types (owner + review, 2026-07-26).
//
// The author of a card is always a `dishi.X` entity: a persona, any user's
// opt-in post, or (parked) a 食家. They are one surface, not two features that
// look alike — and the reason is cold start, not tidiness: with no social graph
// the feed's content comes from RANKING, and ranking still needs something to
// rank. Personas are what make it non-empty before enough people post.
//
// Distribution is taste-rank (settled 2026-07-27, decision 2). There is no
// follow graph, no friends, and nothing here reads a relationship.
//
// CHRONOLOGICAL FOR NOW (owner, 2026-07-28). The tab shipped ranking every card
// by contentScore and dropping weak matches. That is right at scale and wrong
// today: through trial and early launch, few people will rate a dish AND choose
// to publish it, so "of those, the ones matching your taste" filters a pool of
// almost nothing down to nothing. Ranking a thin pool doesn't select — it just
// hides. So the pool is now the whole pool, newest first, and it INCLUDES the
// viewer's own posts (see the route: excluding them made the tab structurally
// empty for the only user who exists).
//
// This is an interim, not a reversal of decision 2 — taste-rank is still the
// intended distribution and returns when the pool is large enough for a filter
// to be selecting rather than concealing. The re-entry point is one function:
// score with contentScore(taste, dish.attributes, affinity, dish.cuisine),
// drop <= 0, sort descending. It was deleted rather than left dangling
// unwired; contentScore itself is untouched and still ranks menus, duels and
// seals. See DECISIONS.md for the amendment.
//
// No LLM in the read path, ever (binding amendment) — that holds either way.

export type FeedAuthor = {
  /** 'persona' = dishi.Spoon et al (precomputed daily). 'user' = someone's
   * opt-in post. 食家 slots in here as a third kind with NO new surface. */
  kind: 'user' | 'persona';
  /** Rendered as dishi.<username> — the card's whole identity line. */
  username: string;
};

export type FeedDish = {
  id: string | null;
  name: string | null;
  name_zh: string | null;
  restaurant: string | null;
  cuisine: string | null;
  photo_url: string | null;
  attributes: Record<string, number>;
};

export type FeedItem = {
  /** Stable per card — the post id, or the persona item's id. */
  id: string;
  author: FeedAuthor;
  dish: FeedDish;
  /** Flick word key. Present on a user's post (someone ATE this and said what
   * they thought); absent on persona content, which asserts no verdict. */
  verdict: string | null;
  reason: string | null;
  /** The viewer's own post. Their posts belong in the pool (they are public
   * material like anyone else's), but the card drops its bookmark affordance:
   * /api/bookmarks refuses a dish you already own, so offering it would put a
   * button on screen whose only outcome is an error. */
  own?: boolean;
};

/**
 * The 待評 row a bookmark creates — the one affordance every card carries,
 * regardless of author (binding amendment: without it the feed is pure
 * consumption and generates nothing).
 *
 * A bookmark enters the SAME dishes table as a photographed dish, so it rates,
 * deletes, and teaches the engine through the same pipeline. Two fields carry
 * the whole difference from a menu pick:
 *  - `eaten_at` stays NULL. A pick means you are at the table; a bookmark means
 *    you want to eat this. buildPickRows stamps pick-time as eaten-time, which
 *    is exactly wrong here and would date the journal with a meal that never
 *    happened.
 *  - `photo_url` stays NULL. The photo belongs to the person who ate it; the
 *    bookmarker attaches their own when they do (the 待評 card already offers
 *    it). Copying it would quietly re-attribute someone's photograph.
 */
export function buildBookmarkRow(source: {
  /** The dish being bookmarked — someone else's row. Provenance keys on the
   * DISH, not the post: persona cards carry the same affordance and have no
   * post, and both author types point at a real dishes row. */
  dishId: string;
  userId: string;
  dish: {
    name: string | null; name_zh: string | null; cuisine: string | null;
    attributes: Record<string, number> | null; restaurant_id: string | null;
    cooking_method?: string | null; heaviness?: string | null; diet?: string[] | null;
    ingredients?: string[] | null;
  };
}) {
  const d = source.dish;
  return {
    user_id: source.userId,
    from_dish_id: source.dishId,
    restaurant_id: d.restaurant_id ?? null,
    name: (d.name ?? '').slice(0, 120),
    name_zh: d.name_zh ?? null,
    cuisine: d.cuisine ?? 'unknown',
    attributes: d.attributes ?? {},
    cooking_method: d.cooking_method ?? null,
    heaviness: d.heaviness ?? null,
    diet: d.diet ?? [],
    ingredients: d.ingredients ?? [],
    photo_url: null,
    eaten_at: null,
    source: 'post' as const,
  };
}
