-- 大話骰 (liar's dice), the third way a table settles. Applied live 2026-07-31.
--
-- Two tables because the game has two halves with opposite visibility rules,
-- and mixing them is exactly how the honesty claim breaks:
--
--   table_dice_rounds — the PUBLIC half. Direction, seating order, whose turn it
--     is, every bid made. All of it is spoken aloud at a real table, so all of it
--     is readable by every member (through the API route, which is the only thing
--     that reads it).
--
--   table_dice_rolls — the HIDDEN half. Five dice per player, under their own cup.
--     Same contract shape as sealed_predictions: written server-side, returned to
--     ONE player until the moment of 開, when every cup is on the table anyway.
--
-- RLS on both, with NO policies at all — deliberately locked against their own
-- owner, exactly like sealed_predictions. A user-scoped client reads nothing and
-- writes nothing here; every access goes through an API route on supabaseAdmin()
-- after authenticating the user and checking membership. A policy that let a
-- player select their own row would also let them select it with a hand-rolled
-- query against someone ELSE's row filter, and the whole point is that the dice
-- are not on the client.

create table if not exists table_dice_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions(id) on delete cascade,
  -- One round settles the bill, but the column exists because a table that wants
  -- a rematch should get a new row rather than mutating the one it just resolved.
  round int not null default 1,
  -- Which way the bidding travels. Null until the first player picks (向左/向右).
  direction text check (direction is null or direction in ('left', 'right')),
  -- Seating order, frozen at 搖骰. Not re-derived per turn: a member joining or a
  -- re-sort mid-round would move people around the table while they are playing.
  seat_order uuid[] not null,
  -- Who opens. The player who tapped 大話骰; also the one who picks direction.
  first_player_id uuid not null,
  current_turn_user_id uuid,
  -- Every call made, in order: [{ user_id, quantity, face, at }]. Append-only.
  bids jsonb not null default '[]'::jsonb,
  challenger_id uuid,
  loser_id uuid,
  -- The count of the challenged face across the whole table, kept so the reveal
  -- screen never recomputes (and never disagrees with) the server's own verdict.
  actual_count int,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, round)
);
alter table table_dice_rounds enable row level security;

create table if not exists table_dice_rolls (
  round_id uuid not null references table_dice_rounds(id) on delete cascade,
  user_id uuid not null,
  dice smallint[] not null,
  rolled_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
alter table table_dice_rolls enable row level security;

create index if not exists table_dice_rounds_session_idx on table_dice_rounds(session_id);
