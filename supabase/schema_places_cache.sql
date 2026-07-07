-- Caches Google Places "nearby restaurants" results per rough location, so repeated
-- lookups from the same area (very common — people log multiple dishes at one
-- restaurant, or several users are at the same food court) don't re-bill Google every
-- time. This is the main cost lever: without it, every single "+Log a dish" tap would
-- be a billed Places API call.
create table places_cache (
  bucket text primary key,  -- lat/lng rounded to 3 decimals, ~111m grid cell
  results jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table places_cache enable row level security;
create policy "places cache readable" on places_cache for select using (true);
-- Writes happen only via the service-role client in the API route, which bypasses RLS.
