-- Matrix-factorization engine, additive to the existing content-based system.
-- Empty until /api/mf/train is first run, and inert in recommendations until enough
-- data exists (see MF_ACTIVATION in src/lib/mf.ts). Safe to run on an existing database.

create table mf_user_factors (
  user_id uuid primary key references profiles(id) on delete cascade,
  factors jsonb not null,      -- array of ~12 floats, no human-readable meaning
  bias real not null default 0,
  updated_at timestamptz not null default now()
);
alter table mf_user_factors enable row level security;
create policy "mf user factors readable" on mf_user_factors for select using (true);

create table mf_dish_factors (
  dish_id uuid primary key references dishes(id) on delete cascade,
  factors jsonb not null,
  bias real not null default 0,
  updated_at timestamptz not null default now()
);
alter table mf_dish_factors enable row level security;
create policy "mf dish factors readable" on mf_dish_factors for select using (true);

-- Singleton row (id is always true) tracking the state of the last training run —
-- used to compute the blend weight and detect staleness.
create table mf_model_state (
  id boolean primary key default true check (id),
  trained_at timestamptz,
  rating_count int not null default 0,
  distinct_users int not null default 0,
  distinct_dishes int not null default 0,
  num_factors int not null default 12,
  global_bias real not null default 0
);
alter table mf_model_state enable row level security;
create policy "mf model state readable" on mf_model_state for select using (true);
insert into mf_model_state (id) values (true) on conflict do nothing;

-- Writes to all three tables happen only via the service-role client in
-- /api/mf/train, which bypasses RLS — no client-side insert/update policies needed.
