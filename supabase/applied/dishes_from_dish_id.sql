-- Applied 2026-07-28 (stream 2 — the 食記 feed's bookmark).
--
-- Supersedes dishes_from_post_id.sql, applied hours earlier the same day and
-- reverted here before any row used it.
--
-- Bookmark provenance keys on the DISH, not the post: from_post_id could only
-- describe a bookmark of a user's post, and EVERY card in the feed carries the
-- bookmark affordance — including persona picks, which have no post. Both
-- author types point at a real dishes row, so the dish is what a bookmark
-- copies and the right key for "have I already queued this?". Two posts of the
-- same dish row now collapse to one bookmark, which is correct.
--
-- ON DELETE SET NULL because the bookmark outlives its source: someone
-- deleting their own dish must not delete an entry out of another person's
-- queue.
drop index if exists dishes_user_from_post_uniq;
alter table dishes drop column if exists from_post_id;

alter table dishes add column if not exists from_dish_id uuid
  references dishes(id) on delete set null;

create unique index if not exists dishes_user_from_dish_uniq
  on dishes (user_id, from_dish_id) where from_dish_id is not null;
