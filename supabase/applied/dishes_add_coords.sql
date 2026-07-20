-- Applied live to Supabase (yuwfhtpyrvdopmexhpwd) on 2026-07-21.
-- Why: the Eat Journal "switch restaurant" seeded its nearby list from the device's
-- LIVE GPS, not from where the photo was actually taken — because dishes only stored a
-- reverse-geocoded `district`, never the raw coords. Persist lat/lng on the dish so a
-- later edit can seed the restaurant picker from the photo's EXIF location. Nullable:
-- pre-existing dishes and coordless (EXIF-stripped) photos have no seed and fall back to
-- live GPS, exactly as before.
alter table dishes add column if not exists lat double precision;
alter table dishes add column if not exists lng double precision;
