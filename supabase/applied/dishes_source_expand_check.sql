-- Applied via Supabase MCP on 2026-07-17. Expands dishes.source to cover all log
-- entry contexts.
--
-- Bug fixed by this: the typed no-photo path has inserted source='manual' since it
-- shipped, but the original check constraint only allowed ('photo','scan','table')
-- — so EVERY no-photo log failed with a check violation ("Could not save that
-- dish"). Zero 'manual' rows existed in prod, confirming it never once succeeded.
--
-- New values: 'manual' (typed, no photo), 'home' (home-cooked entry path),
-- 'album' (old camera-roll photo entry path). The value records the ENTRY
-- CONTEXT the user chose, which downstream features read (e.g. 食記 ordering by
-- when-eaten for album logs; home-cooked dishes having no restaurant).
alter table dishes drop constraint if exists dishes_source_check;
alter table dishes add constraint dishes_source_check
  check (source = any (array['photo'::text, 'scan'::text, 'table'::text, 'manual'::text, 'home'::text, 'album'::text]));
