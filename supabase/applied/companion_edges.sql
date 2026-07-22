-- Applied 2026-07-22 (Table Mode item 4 — 同檯 companion edges).
-- Who you ate with, dish-grained. One row per (dish, member-pair) of a table
-- session — communal-dining semantics: a pick at a shared table is shared BY
-- the table, so every consenting member pair present gets an edge, not just
-- pairs involving the picker (the picker stays derivable from dishes.user_id).
--
-- Privacy lines (backlog, hard):
--  - Edges exist ONLY between consenting members of the same session
--    (joining = consent). table_members only ever holds real authenticated
--    users today (guest participation, 3b, is unbuilt) — when guests arrive
--    they must NOT generate edges until they hold a real account.
--  - RLS: a user reads only edges they are a party to. No client write
--    policies at all — writes go through the service role in API routes.
--    Verified with the standing dry-run pattern (all rolled back): party
--    SELECT returns the seeded edge; a third-party uid sees 0 rows; an
--    authenticated INSERT fails with 42501.
--
-- FK conventions mirror the rest of the schema: dish deletion (un-pick, or a
-- later journal delete) cascades its edges away; account deletion cascades;
-- table-session deletion SETs NULL (same as dishes.table_session_id) so the
-- historical companionship survives session cleanup.
create table if not exists companion_edges (
  id uuid primary key default gen_random_uuid(),
  -- Canonical undirected pair: user_a < user_b enforced, so one row per pair
  -- and no mirror-row bookkeeping.
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references dishes(id) on delete cascade,
  table_session_id uuid references table_sessions(id) on delete set null,
  -- When the PICK happened (dishes.created_at for join-backfilled edges), not
  -- when the edge row was written.
  picked_at timestamptz not null default now(),

  check (user_a < user_b),
  unique (dish_id, user_a, user_b)
);

alter table companion_edges enable row level security;

create policy "read edges you are party to" on companion_edges
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- Aggregate lookups per person ("my companions") from either side of the pair.
create index if not exists companion_edges_user_a on companion_edges (user_a);
create index if not exists companion_edges_user_b on companion_edges (user_b);
