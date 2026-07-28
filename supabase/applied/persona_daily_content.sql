-- Applied 2026-07-28 (stream 2 — persona daily content).
--
-- persona_items + persona_runs — the precomputed daily content pool. Binding
-- amendments this schema encodes:
--
-- 1. SHARED POOL, RANKED PER USER AT READ TIME. One row is one pick for
--    everyone; personalization is contentScore in /api/feed, never a per-user
--    precomputed list. Identical content for everyone is a magazine, and a
--    magazine is where Dishi has no edge — so the ranking, not the pool, is
--    what makes it Dishi.
-- 2. NO LLM IN THE READ PATH. Everything the card needs is denormalized here
--    (name, attributes, the line in both languages), so serving a card is a
--    select.
-- 3. PLACES-VERIFIED SOURCING ONLY. dish_id/restaurant_id are real rows; a
--    persona never names a venue. Phase 0.5 §6 measured a persona inventing
--    滿福樓, 中華小館 and 豪隍點心茶居 with prices, in character, convincingly —
--    precomputing that would batch the failure and ship it daily to everyone.
-- 4. A VISIBLE FAILURE PATH. persona_runs records every attempt, so the feed
--    can tell "no good picks today" (a legitimate state) apart from "the job
--    broke" (which must never look like a quiet day).
create table if not exists public.persona_items (
  id uuid primary key default gen_random_uuid(),
  persona text not null check (persona = any (array['spoon'::text, 'ck'::text, 'kiki'::text])),
  day date not null default current_date,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  -- Denormalized for the read path (see 2).
  name text,
  name_zh text,
  cuisine text,
  attributes jsonb not null default '{}'::jsonb,
  line_zh text not null,
  line_en text not null,
  created_at timestamptz not null default now(),
  unique (persona, day, dish_id)
);

create index if not exists persona_items_day_idx on public.persona_items (day desc);

create table if not exists public.persona_runs (
  day date primary key,
  status text not null check (status = any (array['ok'::text, 'empty'::text, 'failed'::text])),
  item_count integer not null default 0,
  error text,
  ran_at timestamptz not null default now()
);

alter table public.persona_items enable row level security;
alter table public.persona_runs enable row level security;

-- Read-only to everyone; writes are the cron job's alone (admin client).
create policy "persona items readable" on public.persona_items for select using (true);
create policy "persona runs readable" on public.persona_runs for select using (true);
