-- Applied live to Supabase 2026-07-19 (project yuwfhtpyrvdopmexhpwd).
-- Supersedes dishes_add_district.sql (which made district a single text column).
-- Why: district/area must render in the user's chosen language with an English
-- fallback, and work in any country. So it's stored as a per-language map
-- {"zh":..,"en":..}, reverse-geocoded in both languages at capture. Internationally
-- this is self-correcting: a zh request for a place with no Chinese name (e.g. an
-- Australian suburb) returns English, so the zh slot holds English — exactly the
-- "if not available, use English" rule.

alter table dishes drop column if exists district;
alter table dishes add column district jsonb;
comment on column dishes.district is 'Bilingual district for a NON-restaurant dish (home/skipped), {"zh":..,"en":..} reverse-geocoded from log coords. Restaurant dishes use restaurants.district. Null when no coords.';

alter table restaurants add column if not exists district jsonb;
comment on column restaurants.district is 'Bilingual district {"zh":..,"en":..} reverse-geocoded from the restaurant coords at create. Display prefers this over the legacy single-language area text.';
