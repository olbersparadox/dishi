-- Applied live 2026-07-29. dishi.{casing} — a purely cosmetic display variant
-- of the canonical username (profiles.handle stays the lowercase-only URL/
-- uniqueness key — see profiles_username_claim.sql's own note on why "Jerry"
-- and "jerry" can't be two people). username_display carries whatever casing
-- the person actually typed when claiming/renaming ("Jerry"), so dishi.{name}
-- can print it back that way everywhere, while the URL/lookup/uniqueness path
-- never changes. The CHECK constraint is the hard guarantee: this column can
-- only ever be a re-casing of the SAME letters as handle, never a different
-- identity smuggled in under a "display name" — that's what profiles.display_name
-- (a separate, unrelated free-form nickname field) is for.
alter table profiles
  add column if not exists username_display text;

alter table profiles
  add constraint profiles_username_display_case_ck
  check (username_display is null or lower(username_display) = lower(handle));
