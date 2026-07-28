-- Applied live 2026-07-28 (public dossier build, decision 3).
-- "One toggle hides restaurant names, accepting a weaker page." The dossier's
-- anchors carry restaurant names by default because the restaurants are the
-- credibility — dimensions alone read as a horoscope — but the owner of the
-- page may prefer not to publish where they eat. Owner-controlled, default off.
alter table profiles add column if not exists public_hide_restaurants boolean not null default false;
