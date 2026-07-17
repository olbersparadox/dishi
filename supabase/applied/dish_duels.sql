-- Applied via Supabase MCP on 2026-07-17. Backing table for 對決 (pairwise taste
-- duels) — see docs/specs/dish-duels.md. Recorded here 2026-07-18 after verifying
-- the live schema matches this SQL exactly (columns, FKs incl. user_id ->
-- auth.users, RLS enabled with ZERO policies, both indexes).
--
-- Honesty contract (same as sealed_predictions): a duel writes predicted_winner /
-- predicted_p server-side BEFORE the user answers, and the client must never see
-- them until answered_at is set. RLS is enabled with NO policies ON PURPOSE — the
-- table is unreadable to its own owner through the user-scoped client, so a
-- pending prediction cannot leak. ALL dish_duels I/O goes through supabaseAdmin()
-- in the API route, after authenticating the user and scoping to their user_id.
-- That hiddenness IS the seal for a duel.

create table if not exists dish_duels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_a uuid not null references dishes(id) on delete cascade,
  dish_b uuid not null references dishes(id) on delete cascade,
  predicted_winner uuid references dishes(id) on delete set null,
  predicted_p real,
  winner uuid references dishes(id) on delete cascade,
  skipped_at timestamptz,
  served_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table dish_duels enable row level security;
create index if not exists dish_duels_user on dish_duels(user_id, answered_at);
create index if not exists dish_duels_user_pair on dish_duels(user_id, dish_a, dish_b);
