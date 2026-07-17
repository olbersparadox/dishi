-- Applied via Supabase MCP on 2026-07-18. Adds the "揀唔落" (tie) outcome to duels.
--
-- A tie is a REAL signal, distinct from a dismiss: the user genuinely can't separate
-- the two dishes, which is evidence the engine's predicted gap between them should
-- shrink (learned toward neutral — see updateTasteFromDuelTie in taste.ts). It is a
-- RESOLUTION like a win, so answered_at is set for both; the two are told apart by
-- winner (a uuid on a win, null on a tie) and tied_at (set only on a tie). A ✕
-- dismiss ("not now") writes nothing — the duel simply stays open.
alter table dish_duels add column if not exists tied_at timestamptz;
