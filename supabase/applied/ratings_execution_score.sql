-- Applied live 2026-07-26.
--
-- WHY: a flick alone cannot say whether a bad meal was the DISH or the KITCHEN.
-- The owner's 火腿通粉 case — "the dish is fine, this shop served the soup like
-- hot water" — was teaching the palate a permanent dislike of macaroni soup.
--
-- The chosen mechanic measures rather than asks: every instance gets a 1-10
-- execution score (passing line 5), and the dish-vs-execution answer falls out
-- of comparing instances of the same dish_identity_id. 火腿通粉 at A=2 and later
-- at B=8 means the dish is fine and A is the problem — no self-report needed.
--
-- null = never asked, or skipped. Skipping is free by design: no badge, no nag.
-- See docs/BACKLOG.md "佢哋整得點？" and docs/DECISIONS.md
-- "Direction: comparison is the core product DNA".
alter table ratings
  add column if not exists execution_score smallint
  check (execution_score is null or (execution_score between 1 and 10));

create index if not exists ratings_execution on ratings (user_id, execution_score);
