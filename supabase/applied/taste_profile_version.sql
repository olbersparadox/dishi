-- Applied. profile_version powers the taste-form export loop: a version bump
-- reshapes the deterministic blob identity (see blobForm.ts seed), so
-- exporting v3 vs v4 is a visibly different form, not just a new date stamp.
alter table taste_profiles add column if not exists profile_version int not null default 1;
