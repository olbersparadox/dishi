-- Applied live: 2026-07-24 (via MCP apply_migration).
-- Why: the persona rename (honest/connoisseur/playful → spoon/ck/kiki, commits
-- e6f7213 + 80a3440) changed the code's vocabulary but never migrated the DB —
-- taste_profiles_persona_check still allowed only the OLD names and the column
-- default was still 'honest', so the export POST persisting persona='spoon'
-- 500'd (the known silently-blocked-write failure class; caught during the
-- install-flow UI's live verification). One row existed, on the old default.
-- Order matters: the old constraint must drop BEFORE the value update, or the
-- update itself violates it.

alter table taste_profiles drop constraint taste_profiles_persona_check;

update taste_profiles set persona = case persona
  when 'honest' then 'spoon'
  when 'connoisseur' then 'ck'
  when 'playful' then 'kiki'
  else persona end
where persona in ('honest', 'connoisseur', 'playful');

alter table taste_profiles add constraint taste_profiles_persona_check
  check (persona = any (array['spoon'::text, 'ck'::text, 'kiki'::text]));
alter table taste_profiles alter column persona set default 'spoon';
