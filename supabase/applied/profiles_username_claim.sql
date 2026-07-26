-- Applied live 2026-07-26. dishi.username — claim at v1 unlock + exactly one
-- free rename (owner decision, see docs/DECISIONS.md "Identity, connection,
-- and export positioning", rename policy).
--
-- No new identity column: `handle` was ALREADY unique and already the string
-- shown on chops and pick attributions — it was just auto-derived from the
-- email local part (mosuko, wool.hk), which leaked the address and was never
-- a choice. Claiming a username overwrites `handle`, so one string keeps
-- serving the chop, the table, and later dishi.me/[username].
--
--   username_set_at        null  = still the auto-derived handle, never claimed.
--                          Claiming stamps it and does NOT spend the change.
--   username_changes_used  renames spent after the claim. The rule is one, so
--                          a rename is allowed only while this is 0.
--
-- The lower(handle) unique index is what actually enforces "taken": handle's
-- own unique constraint is case-sensitive, and the app normalizes to lowercase
-- on write, so this closes the gap for the legacy rows written before it.
alter table profiles
  add column if not exists username_set_at timestamptz,
  add column if not exists username_changes_used smallint not null default 0;

create unique index if not exists profiles_handle_lower_key on profiles (lower(handle));
