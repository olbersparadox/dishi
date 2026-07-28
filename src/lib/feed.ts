// The 食記 feed — ONE card type, three author types (owner + review, 2026-07-26).
//
// The author of a card is always a `dishi.X` entity: a persona, any user's
// opt-in post, or (parked) a 食家. They are one surface, not two features that
// look alike — and the reason is cold start, not tidiness: with no social graph
// the feed's content comes from RANKING, and ranking still needs something to
// rank. Personas are what make it non-empty before enough people post.
//
// Distribution is taste-rank (settled 2026-07-27, decision 2). There is no
// follow graph, no friends, and nothing here reads a relationship — a post
// reaches whoever the ranking matches. That means the RANKING IS THE
// DISTRIBUTION: if it is weak, posts reach nobody. Which is why the two rules
// below are conservative rather than generous.
//
// No LLM in the read path, ever (binding amendment): ranking is contentScore
// over attributes the dish already carries.

import { contentScore, type TasteVector } from './taste';

/** Below this many ratings a taste vector is mostly noise — the EMA's learning
 * rate is steepest over exactly these first flicks. /api/recommendations has
 * refused to rank under the same bar since it shipped ("recommendations begin
 * when they can be honest"); a feed that ranked at 2 ratings would be dressing
 * a guess as a match. Under it, the feed shows personas only — content that
 * does not claim to be matched to you. */
export const FEED_TRAINING_THRESHOLD = 5;

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
};

export type RankedFeedItem = FeedItem & { match: number };

/**
 * Rank a mixed pool for one viewer. Descending by contentScore, input order
 * breaking ties (callers pass newest-first).
 *
 * ITEMS THE ENGINE DOESN'T LIKE FOR YOU ARE DROPPED, not ranked last. "No rec
 * is better than an irrelevant one" is the standing product rule, and a feed
 * is the surface most tempted to pad — a short feed is the honest outcome of a
 * thin pool, and an empty one is a legitimate state the UI must be able to say.
 *
 * A negative VERDICT never disqualifies an item: a post saying a dish was bad
 * is about how one place cooked it, and it is exactly as relevant to someone
 * who likes that kind of dish as a rave is. Relevance is the dish; the verdict
 * is the content.
 */
export function rankFeed(
  taste: TasteVector,
  affinity: Record<string, number>,
  items: FeedItem[],
): RankedFeedItem[] {
  return items
    .map(item => ({ ...item, match: contentScore(taste, item.dish.attributes, affinity, item.dish.cuisine) }))
    .filter(item => item.match > 0)
    .sort((a, b) => b.match - a.match);
}

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
  postId: string;
  userId: string;
  dish: {
    name: string | null; name_zh: string | null; cuisine: string | null;
    attributes: Record<string, number> | null; restaurant_id: string | null;
    cooking_method?: string | null; heaviness?: string | null; diet?: string[] | null;
  };
}) {
  const d = source.dish;
  return {
    user_id: source.userId,
    from_post_id: source.postId,
    restaurant_id: d.restaurant_id ?? null,
    name: (d.name ?? '').slice(0, 120),
    name_zh: d.name_zh ?? null,
    cuisine: d.cuisine ?? 'unknown',
    attributes: d.attributes ?? {},
    cooking_method: d.cooking_method ?? null,
    heaviness: d.heaviness ?? null,
    diet: d.diet ?? [],
    photo_url: null,
    eaten_at: null,
    source: 'post' as const,
  };
}
