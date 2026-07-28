-- Applied 2026-07-28 (stream 2 — the 食記 feed's bookmark).
-- SUPERSEDED THE SAME DAY, before any row used it: see
-- dishes_from_dish_id.sql, which drops this column. Kept because this WAS
-- applied to the live database — the log records what happened, not only what
-- survives.
--
-- dishes.from_post_id — which feed post a bookmarked 待評 row came from.
-- Exact provenance, not a heuristic: without it "have I already bookmarked
-- this?" would have to be guessed from names, and a second tap on the same
-- card would quietly mint a duplicate queue entry. ON DELETE SET NULL because
-- the bookmark outlives its source — a person who unpublishes their post must
-- not delete a dish out of someone else's queue.
alter table dishes add column if not exists from_post_id uuid
  references dish_posts(id) on delete set null;

create unique index if not exists dishes_user_from_post_uniq
  on dishes (user_id, from_post_id) where from_post_id is not null;
