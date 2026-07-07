-- Dishi MVP schema. Run in the Supabase SQL editor.
-- Taste vectors are stored as jsonb keyed by attribute name (18 fixed dims, see src/lib/taste.ts)
-- so the dimension set can evolve without migrations during MVP.

create extension if not exists "uuid-ossp";

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  points int not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles are readable" on profiles for select using (true);
create policy "own profile writable" on profiles for update using (auth.uid() = id);
create policy "own profile insertable" on profiles for insert with check (auth.uid() = id);

-- ---------- restaurants ----------
create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index restaurants_lat_lng on restaurants (lat, lng);

alter table restaurants enable row level security;
create policy "restaurants readable" on restaurants for select using (true);
create policy "restaurants insertable" on restaurants for insert with check (auth.uid() is not null);

-- Haversine distance in meters, used by the GPS quick-pick.
create or replace function nearby_restaurants(user_lat double precision, user_lng double precision, radius_m double precision default 300, max_results int default 8)
returns table (id uuid, name text, lat double precision, lng double precision, address text, distance_m double precision)
language sql stable as $$
  select r.id, r.name, r.lat, r.lng, r.address,
    2 * 6371000 * asin(sqrt(
      pow(sin(radians(r.lat - user_lat) / 2), 2) +
      cos(radians(user_lat)) * cos(radians(r.lat)) *
      pow(sin(radians(r.lng - user_lng) / 2), 2)
    )) as distance_m
  from restaurants r
  where abs(r.lat - user_lat) < 0.02 and abs(r.lng - user_lng) < 0.02
  order by distance_m asc
  limit max_results;
$$;

-- ---------- dishes (one row per logged dish instance) ----------
create table dishes (
  id uuid primary key default uuid_generate_v4(),
  -- null user only for synthetic cold-start seeds
  user_id uuid references profiles(id) on delete cascade,
  restaurant_id uuid references restaurants(id),
  name text not null,
  cuisine text,
  photo_url text,
  attributes jsonb not null,          -- {sweet: 0.7, crispy: 0.2, ...} each 0..1
  vision_confidence real default 0.5, -- how much the vision model trusted its read
  is_synthetic boolean not null default false, -- cold-start seed rows
  created_at timestamptz not null default now(),
  check (user_id is not null or is_synthetic)
);
create index dishes_user on dishes (user_id);
create index dishes_restaurant on dishes (restaurant_id);

alter table dishes enable row level security;
create policy "dishes readable" on dishes for select using (true);
create policy "own dishes insertable" on dishes for insert with check (auth.uid() = user_id);

-- ---------- ratings ----------
create table ratings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  dish_id uuid not null references dishes(id) on delete cascade,
  score real not null check (score >= -1 and score <= 1), -- flick output
  voice_transcript text,
  voice_attributes jsonb, -- structured signal extracted by LLM
  created_at timestamptz not null default now(),
  unique (user_id, dish_id)
);
create index ratings_dish on ratings (dish_id);

alter table ratings enable row level security;
create policy "ratings readable" on ratings for select using (true);
create policy "own ratings writable" on ratings for insert with check (auth.uid() = user_id);
create policy "own ratings updatable" on ratings for update using (auth.uid() = user_id);

-- ---------- taste profiles ----------
create table taste_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  vector jsonb not null default '{}'::jsonb,          -- {sweet: 0.4, spicy: 0.9, ...} each -1..1
  cuisine_affinity jsonb not null default '{}'::jsonb, -- {"japanese": 0.6, ...}
  rating_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table taste_profiles enable row level security;
create policy "taste profiles readable" on taste_profiles for select using (true);
create policy "own taste profile writable" on taste_profiles for all using (auth.uid() = user_id);

-- ---------- helpful marks + points ----------
create table helpful_marks (
  id uuid primary key default uuid_generate_v4(),
  dish_id uuid not null references dishes(id) on delete cascade,
  marked_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dish_id, marked_by) -- one "this helped" per person per dish
);

alter table helpful_marks enable row level security;
create policy "marks readable" on helpful_marks for select using (true);
create policy "marks insertable" on helpful_marks for insert with check (auth.uid() = marked_by);

create table points_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  dish_id uuid references dishes(id),
  points int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table points_ledger enable row level security;
create policy "own ledger readable" on points_ledger for select using (auth.uid() = user_id);

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('dish-photos', 'dish-photos', true)
on conflict do nothing;
create policy "photos readable" on storage.objects for select using (bucket_id = 'dish-photos');
create policy "photos uploadable" on storage.objects for insert with check (bucket_id = 'dish-photos' and auth.uid() is not null);
