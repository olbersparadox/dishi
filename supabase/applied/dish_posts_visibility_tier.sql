-- Applied 2026-07-28. Sharing batch item 2: the link-only tier.
--
-- Owner call, made against review's recommendation of a single public tier
-- (see docs/BACKLOG.md "Batch: sharing", which records the argument and the
-- live risk). Sending one dish to one friend is, to the person doing it, a
-- different act from publishing to everyone — so a shared dish gets a post
-- row (the consent event, the verdict, the reason all still apply) that is
-- reachable ONLY at its own permalink.
--
--   'public' — dossier anchor + 大家 feed + persona sourcing pool (today's
--              semantics, which is why it is the DEFAULT: every existing row
--              keeps behaving exactly as it did before this migration).
--   'link'   — permalink only. Absent from dossier, feed and persona pool.
--
-- The failure mode this creates is a READ-side one: three existing read paths
-- must filter to 'public' or link-only posts are silently republished. They
-- are /api/feed, /api/cron/persona-daily and app/[username]/page.tsx.
-- /api/my/dishes must NOT filter — it is the owner's own view of their own
-- posts. Tests assert the ABSENCE of link-only rows from the first three.
alter table dish_posts
  add column visibility text not null default 'public'
  check (visibility in ('public', 'link'));

create index dish_posts_visibility on dish_posts (visibility);
