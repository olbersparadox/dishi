-- Applied live to Supabase 2026-07-19 (project yuwfhtpyrvdopmexhpwd).
-- Why: the location line should always show WHERE a dish is. Restaurant dishes read
-- "name • district" (district from restaurants.area). A dish with NO restaurant
-- (home cooking, or the picker skipped because the place wasn't listed) previously
-- fell back to a bare "住家菜" — now it shows the district (葵芳), reverse-geocoded
-- from the log coords. That district lives here (restaurant dishes keep null and
-- use restaurants.area instead). Additive, nullable.

alter table dishes add column if not exists district text;
comment on column dishes.district is 'District/sublocality where a NON-restaurant dish was logged (home / skipped picker), reverse-geocoded from the log coords (photo EXIF or live GPS). Restaurant dishes derive their district from restaurants.area instead, so this stays null for them. Nullable: no readable coords -> null.';
