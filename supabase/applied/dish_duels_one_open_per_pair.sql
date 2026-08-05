-- Applied live 2026-08-05.
--
-- WHY: the owner reported that finishing a 對決 often re-served the identical
-- pair. GET /api/interactions/today is not a pure read — past the cooldown it
-- seals a prediction and INSERTS a dish_duels row. Both host surfaces mount
-- useInteractions (NotificationBell + DailyInteractions) and each fetched
-- independently, so every page load fired two GETs ~2ms apart (measured in the
-- browser). Both saw no open duel, both passed the cooldown, both ran the
-- DETERMINISTIC pair selection onto the same pair, and both inserted. Answering
-- one left the duplicate open and under 24h, so the pending-resume branch in
-- the route served the same two dishes again.
--
-- Seen twice in prod: rows 162ms apart (2026-07-31, 壽司拼盤 vs 牛肉丼配溏心蛋)
-- and 526ms apart (2026-08-02, 帶子炒飯 vs 油雞髀腩仔飯). Each pair was answered
-- twice, so one comparison taught the taste engine twice.
--
-- The app-side fix (commit 87757de) single-flights the client request and
-- re-checks for an open duel immediately before inserting. This index is the
-- hard guarantee that survives a cross-tab / multi-device race.

-- 1. One-off cleanup: drop the redundant row of each duplicated pair, keeping
--    the first-served original. Both rows of both pairs recorded the SAME
--    winner (verified before deleting), so no distinct signal was lost — this
--    only stops a future replay from counting one comparison twice. It does NOT
--    retroactively un-teach the currently stored vector.
delete from dish_duels
where id in (
  'a03cbdad-2537-41ca-991e-e1b0606f72a8',  -- dup of 57c52646… (壽司拼盤 pair)
  'b05b50fe-d271-4d0d-8568-76cf00a44752'   -- dup of ebe8d040… (油雞髀腩仔飯 pair)
);

-- 2. The guarantee. Partial on answered_at IS NULL on purpose:
--    * answered pairs are already excluded from selection forever (duels.ts),
--      and the historical duplicates were answered — so a full unique index
--      would have required rewriting history this one does not touch;
--    * an unanswered pair is deliberately allowed to return after
--      DUEL_RECENT_DAYS (30d); this forbids only a SECOND simultaneously-open
--      row for the same pair, which is never anything but a race;
--    * stale open rows therefore cannot wedge the duel engine shut — they only
--      block a re-serve of their OWN pair, which selection already excludes.
--
-- The route's insert fails closed on violation: supabase-js returns `error`
-- rather than throwing, `inserted` is null, and no duel is served that round.
create unique index if not exists dish_duels_one_open_per_pair
  on dish_duels (user_id, dish_a, dish_b)
  where answered_at is null;
