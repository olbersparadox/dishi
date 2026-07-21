-- Applied live to Supabase (yuwfhtpyrvdopmexhpwd) on 2026-07-21.
-- Why: 名印 chop identity (Table Mode social batch, item 2). The chop avatar's glyph
-- and any display-name-carrying UI need something other than `handle` (the
-- auto-generated collision-suffixed slug, e.g. mosuko-i47v) to render — a real
-- display name the person sets once. Nullable, no default: null means "hasn't set
-- one yet," and the client falls back to `handle` until they do (see Chop.tsx /
-- ChopSetup in src/app/table/page.tsx). RLS already covers this column — the
-- existing "own profile writable" policy (auth.uid() = id) and "profiles are
-- readable" (true) policies apply to every column on the row, not per-column.
alter table profiles add column if not exists display_name text;
