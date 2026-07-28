-- Applied 2026-07-28 (stream 2 — the 食記 feed's bookmark).
--
-- Bookmarking a post drops the dish into the viewer's 待評 queue, which IS a
-- dishes row (same pipeline as every other way a dish enters — a bookmark
-- rates, deletes and teaches the engine exactly like a photographed dish).
-- It needs its own source value because the existing six all mean "you were
-- there": a bookmark records that you want to eat it, and unlike a menu pick
-- it carries NO eaten_at, which is the honest difference the value marks.
alter table dishes drop constraint if exists dishes_source_check;
alter table dishes add constraint dishes_source_check
  check (source = any (array['photo'::text, 'scan'::text, 'table'::text, 'manual'::text, 'home'::text, 'album'::text, 'post'::text]));
