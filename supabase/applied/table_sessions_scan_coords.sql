-- Applied live 2026-08-02. Item 3b (identity-constrained vision naming), the
-- wiring half — measured in docs/rnd/vision-naming-context.md.
--
-- WHY scan coords on the session: a photographed dish is named by vision from
-- pixels alone, while the menu that names it correctly was often scanned by the
-- same person, in the same shop, an hour earlier (the 一起食堂 field miss,
-- 2026-08-02). Joining the two needs to know WHERE a scan happened. The client
-- already sends these coords to POST /api/table — they were used once to
-- resolve the session's restaurant and then dropped. Now they persist, because
-- the shortlist source cannot be restaurant-scoped: the restaurant may not
-- exist as a row at all (一起食堂 didn't), and dish_identities held 3 rows on
-- the day one session alone held 31 verbatim menu names.
--
-- Nullable and unwritten by every other path: a session with no fix keeps
-- working exactly as before and simply contributes no shortlist.
alter table table_sessions add column if not exists scan_lat double precision;
alter table table_sessions add column if not exists scan_lng double precision;
create index if not exists table_sessions_scan_coords
  on table_sessions (scan_lat, scan_lng) where scan_lat is not null;

-- WHY a marker on the dish: the item ships with a pre-agreed kill criterion —
-- if the match layer ever adopts a WRONG name in field use, adoption gets
-- gated behind item 5's two-name pick instead of running automatically. That
-- test is unanswerable if an adopted name is indistinguishable from a vision
-- guess after the fact (the R&D run produced exactly one such event, 土魷蒸肉餅
-- adopting a neighbouring menu's 冬菇馬蹄蒸肉餅). This stamp is written ONLY
-- when a name came verbatim off a nearby scanned menu, and is read by no code
-- today — it exists so the kill criterion can be evaluated on evidence.
--
-- Deliberately NOT name_edited_at: that field means a HUMAN typed the name and
-- carries human authority up the ladder (nameAuthority(), src/lib/dishIdentity.ts).
-- A machine adopting the menu's words must never claim it.
alter table dishes add column if not exists name_from_menu_at timestamptz;
