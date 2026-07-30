-- Applied live 2026-07-30. The "done picking" handshake and the settle phase.
--
-- Why: in a table of 2+, tapping the black cart bar stopped meaning "take me to
-- the rating queue" and started meaning "I'm done picking". The table advances
-- to the settle screen only once EVERY member has tapped, so the state has to
-- live server-side where all members read the same copy of it.
--
-- RLS note: table_members has no UPDATE policy and table_sessions' only UPDATE
-- policy is host-scoped (auth.uid() = host_id). Every write to these new columns
-- therefore goes through an API route on the ADMIN client after authenticating
-- the user and checking their membership -- a user-scoped client would be
-- silently blocked, which is the known failure class in this repo.

alter table table_members add column if not exists ready_at timestamptz;
alter table table_sessions add column if not exists settled_at timestamptz;

-- How the bill gets carried. pay_payer_id is the ONE person paying under
-- 'random' (and, later, the loser of 大話骰); 'equal' leaves it null.
-- The draw is stored server-side rather than computed per client for the same
-- reason the cart-bar count is table-wide: a number that differs per screen
-- reads as a sync bug. Storing it also makes the draw un-rerollable -- a client
-- coin flip could be retried until someone liked the answer.
alter table table_sessions add column if not exists pay_method text;
alter table table_sessions add column if not exists pay_payer_id uuid;
alter table table_sessions add column if not exists pay_decided_at timestamptz;

alter table table_sessions drop constraint if exists table_sessions_pay_method_ck;
alter table table_sessions add constraint table_sessions_pay_method_ck
  check (pay_method is null or pay_method in ('equal', 'random', 'game'));
