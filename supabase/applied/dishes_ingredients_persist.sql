-- Applied 2026-07-28. Backlog: "[S] Persist ingredients on dishes" — enrichment
-- already extracts up to 4 key ingredients (vision's photo read and menuScan's
-- text-only enrich, both via sanitizeIngredients) and used them for diet flags,
-- then discarded them: no column, zero downstream readers, chips vanished on
-- reload. Same shape/default pattern as the existing `diet` column.
alter table dishes add column ingredients text[] not null default '{}'::text[];
