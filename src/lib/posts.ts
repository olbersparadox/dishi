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

/** Trim, collapse runaway whitespace, cap, and treat "" as absent. A post with
 * no words is still a post (the dish + the verdict is the claim), so null is a
 * legitimate value rather than a validation failure. */
export function normalizeReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, POST_REASON_MAX);
  return cleaned.length > 0 ? cleaned : null;
}
