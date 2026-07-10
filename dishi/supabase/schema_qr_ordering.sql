-- QR table ordering: tables + curated menus + order queue. Additive migration.

-- Physical tables. qr_token is the secret embedded in each printed QR code, so this
-- table has NO public read policy — diners resolve tokens server-side only, and
-- owners see their own tables via their claim.
create table restaurant_tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  label text not null,
  qr_token text unique not null,
  created_at timestamptz not null default now()
);
alter table restaurant_tables enable row level security;
create policy "owner reads tables" on restaurant_tables for select using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_tables.restaurant_id and c.user_id = auth.uid()));
create policy "owner adds tables" on restaurant_tables for insert with check (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_tables.restaurant_id and c.user_id = auth.uid()));
create policy "owner updates tables" on restaurant_tables for update using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_tables.restaurant_id and c.user_id = auth.uid()));
create policy "owner deletes tables" on restaurant_tables for delete using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_tables.restaurant_id and c.user_id = auth.uid()));

-- The restaurant-curated, authoritative menu — deliberately separate from `dishes`
-- (organic diner logs). Ordering needs owner-controlled names/prices/availability;
-- attributes power the same taste personalization as everywhere else.
create table restaurant_menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  name_original text,
  description text,
  price text,
  cuisine text,
  attributes jsonb not null default '{}'::jsonb,
  available boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table restaurant_menu_items enable row level security;
create policy "menus are public" on restaurant_menu_items for select using (true);
create policy "owner adds menu items" on restaurant_menu_items for insert with check (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_menu_items.restaurant_id and c.user_id = auth.uid()));
create policy "owner updates menu items" on restaurant_menu_items for update using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_menu_items.restaurant_id and c.user_id = auth.uid()));
create policy "owner deletes menu items" on restaurant_menu_items for delete using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = restaurant_menu_items.restaurant_id and c.user_id = auth.uid()));

-- Orders. Items are a jsonb SNAPSHOT of {menu_item_id, name, price, qty} at order
-- time, so later menu edits never rewrite order history.
create table table_orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  table_id uuid references restaurant_tables(id) on delete set null,
  session_id uuid references table_sessions(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  items jsonb not null,
  status text not null default 'pending' check (status in ('pending','confirmed','done','cancelled')),
  created_at timestamptz not null default now()
);
alter table table_orders enable row level security;
create policy "diner creates own orders" on table_orders for insert with check (auth.uid() = created_by);
create policy "diner or owner reads orders" on table_orders for select using (
  auth.uid() = created_by or
  exists (select 1 from restaurant_claims c where c.restaurant_id = table_orders.restaurant_id and c.user_id = auth.uid()));
create policy "owner updates order status" on table_orders for update using (
  exists (select 1 from restaurant_claims c where c.restaurant_id = table_orders.restaurant_id and c.user_id = auth.uid()));

-- QR scans create/join table-scoped sessions (table_sessions.restaurant_id already exists).
alter table table_sessions add column table_id uuid references restaurant_tables(id) on delete set null;
