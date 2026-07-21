-- Applied live to Supabase (yuwfhtpyrvdopmexhpwd) on 2026-07-21.
-- Why: the dishi version ladder (replaces Levels). The achieved version is an unlock
-- HISTORY, ratcheted — it only ever rises: deleting a rating never demotes a version
-- the user already unlocked, while the live progress bar toward the next version
-- honestly dips with the data. 0 = not yet v1 (v1 ≡ the export unlock; see
-- src/lib/version.ts for the whole contract). Maintained by GET /api/buddy, which is
-- also where the unlock moment stakes its auto-seal.
alter table taste_profiles add column if not exists version_unlocked integer not null default 0;
