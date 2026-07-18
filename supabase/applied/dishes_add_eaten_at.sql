-- Applied live to Supabase 2026-07-18 (project yuwfhtpyrvdopmexhpwd).
-- Why: photo EXIF gives WHEN a dish was eaten (DateTimeOriginal), which for album /
-- retrospective logs diverges sharply from when-logged (created_at). Capture that
-- reliable EXIF subset now so the signal exists when the 食記 ordering design lands
-- (order album logs by when-eaten vs when-logged — still an open design question,
-- so this column is captured silently and NOT yet used for ordering). Additive,
-- nullable: typed entries and stripped/screenshot photos leave it null.

alter table dishes add column if not exists eaten_at timestamptz;
comment on column dishes.eaten_at is 'When the dish was actually eaten, from photo EXIF DateTimeOriginal at log time. Nullable: null when no readable EXIF timestamp (typed entries, stripped/screenshot photos). Captured silently for future 食記 ordering; journal still orders by created_at until that design lands.';
