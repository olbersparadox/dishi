// 貼文 — per-dish opt-in publishing.
//
// A post is the product's CONSENT UNIT made explicit: one row per dish the
// person chose to make public. Everything published about a palate's actual
// eating (the anchors on dishi.me/[username]) is sourced from posts, so the
// blanket "claiming a username publishes your top 6 ratings" placeholder ends
// here — see lib/dossier.ts.
//
// This is PUBLISHING, not sharing with friends: there is no follow graph and
// no relationship anywhere in it (settled 2026-07-27). Copy says 公開.
//
// A post may carry ANY verdict (owner call 2026-07-28) — including a bad one.
// That is why the verdict word travels with the post everywhere it renders:
// a published dislike must never be readable as praise.

/** Reason length cap. A post's reason is a line, not a review — the long form
 * belongs to the person's own journal, and a public page of paragraphs stops
 * being a dossier. */
export const POST_REASON_MAX = 140;

/**
 * How far a post reaches (sharing batch, owner call — see BACKLOG "Batch:
 * sharing"). Both tiers are consented publishing with a verdict attached;
 * they differ only in whether the post is DISCOVERABLE.
 *
 *  - `public` — dossier anchor + 大家 feed + persona sourcing pool.
 *  - `link`   — its own permalink only. Sending one dish to one friend is,
 *               to the person doing it, a different act from publishing to
 *               everyone, and the product honours that distinction.
 */
export const POST_VISIBILITIES = ['public', 'link'] as const;
export type PostVisibility = typeof POST_VISIBILITIES[number];

/** Anything not a known tier becomes `public` — the pre-existing behaviour of
 * every caller that predates the tier, so an old client can't accidentally
 * downgrade a post by omitting the field. */
export function asPostVisibility(raw: unknown): PostVisibility {
  return (POST_VISIBILITIES as readonly string[]).includes(raw as string)
    ? (raw as PostVisibility)
    : 'public';
}

/**
 * Visibility only ever UPGRADES — `link` → `public`, never back.
 *
 * The same shape as the name-authority ladder, and for the same reason: the
 * write path is an upsert, so without this a Share tap on an ALREADY-PUBLIC
 * dish would write `link` over `public` and silently pull it off the owner's
 * dossier and out of the feed. Sharing something is never a request to
 * publish it less. Going back is a real intent, but it belongs to an explicit
 * unpublish (DELETE), not to a side effect of sharing.
 */
export function mergeVisibility(
  existing: PostVisibility | null | undefined,
  requested: PostVisibility,
): PostVisibility {
  return existing === 'public' || requested === 'public' ? 'public' : 'link';
}

/** Trim, collapse runaway whitespace, cap, and treat "" as absent. A post with
 * no words is still a post (the dish + the verdict is the claim), so null is a
 * legitimate value rather than a validation failure. */
export function normalizeReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, POST_REASON_MAX);
  return cleaned.length > 0 ? cleaned : null;
}
