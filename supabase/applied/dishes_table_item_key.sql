-- Applied 2026-07-21. Fixes a real bug found live: table-mode "who picked
-- this" chop stamps matched purely by dish name, so several menu items
-- sharing a printed name (e.g. a restaurant's own 叉燒 as a standalone dish,
-- a combo, and a rice set — all $128, all name_zh "叉燒" on a real 32-dish
-- scanned menu) got cross-stamped from a single pick. table_item_key records
-- which specific ranked candidate a pick came from, so matching can be exact
-- when present, falling back to the old name-based matching only for picks
-- made before this fix.
alter table dishes add column table_item_key text;
comment on column dishes.table_item_key is 'Which table-session candidate this pick came from (item.key from the ranked list — a scan-session menu index, a restaurant_menu_items id, or a community dishes id). Disambiguates picks when two candidates share a printed name (e.g. the same 叉燒 short-name on a standalone dish, a combo, and a rice set) — matching by name alone cross-stamped every one of them from a single pick. Null for picks made before this fix or via a path that does not send one; those fall back to name-based matching.';
