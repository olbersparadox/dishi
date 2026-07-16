-- 封印預測 (sealed predictions) — PENDING, not yet applied.
-- Apply via Supabase MCP apply_migration at the start of the build session.
--
-- Honesty contract: the prediction is written server-side BEFORE the user rates
-- and is never returned to the client until revealed_at is set. The client may
-- only know that a seal EXISTS (the 印 stamp in the fog). This is what makes the
-- reveal provable rather than theater, and what prevents anchoring bias.

create table if not exists sealed_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references dishes(id) on delete cascade,

  -- what the engine committed to, at seal time
  predicted_raw double precision not null,      -- raw contentScore blend output
  predicted_direction text not null check (predicted_direction in ('love','like','meh','dislike')),
  predicted_reason_zh text,                     -- honest reason traced to real dims
  predicted_reason_en text,
  engine_rating_count int not null,             -- profile maturity at seal time
  profile_version int not null default 1,

  -- outcome, filled at reveal
  actual_score double precision,
  outcome text check (outcome in ('hit','near','miss')),
  sealed_at timestamptz not null default now(),
  revealed_at timestamptz,

  unique (user_id, dish_id)
);

alter table sealed_predictions enable row level security;

-- Users may see only their own REVEALED predictions. Unrevealed rows are
-- invisible even to their owner — that is the seal. Writes go through the
-- service role in API routes only.
create policy "read own revealed seals" on sealed_predictions
  for select using (auth.uid() = user_id and revealed_at is not null);

create index if not exists sealed_predictions_user_pending
  on sealed_predictions (user_id) where revealed_at is null;

-- Outcome definition v1 (computed in API, stored here):
--   direction bands on flick score: love >= 0.75, like >= 0.55, meh >= 0.4, else dislike
--   hit  = predicted_direction equals actual band
--   near = adjacent band
--   miss = otherwise
-- Streak = consecutive hits ordered by revealed_at; computed in query, not stored.
