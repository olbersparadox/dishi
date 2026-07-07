-- Table Mode + Restaurant Dashboard schema. Additive; safe on the existing database.

-- ---------- table mode ----------
create table table_sessions (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,           -- short join code, the shared secret
  host_id uuid not null references profiles(id) on delete cascade,
  restaurant_id uuid references restaurants(id),
  menu_items jsonb,                    -- scanned MenuItem[] or null -> rank community dishes
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
alter table table_sessions enable row level security;
create policy "sessions readable" on table_sessions for select using (true);
create policy "host creates sessions" on table_sessions for insert with check (auth.uid() = host_id);
create policy "host updates sessions" on table_sessions for update using (auth.uid() = host_id);

create table table_members (
  session_id uuid not null references table_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table table_members enable row level security;
create policy "members readable" on table_members for select using (true);
create policy "join as self" on table_members for insert with check (auth.uid() = user_id);

-- ---------- restaurant ownership ----------
-- MVP claims are instant but stored with a status column so real verification
-- (docs, phone, registry match) can slot in later without a schema change.
create table restaurant_claims (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'unverified' check (status in ('unverified','verified')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
alter table restaurant_claims enable row level security;
create policy "own claims readable" on restaurant_claims for select using (auth.uid() = user_id);
create policy "claim as self" on restaurant_claims for insert with check (auth.uid() = user_id);
