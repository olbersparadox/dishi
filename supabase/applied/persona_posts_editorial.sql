-- Applied live 2026-07-29 — dishi.persona editorial (BACKLOG batch 2026-07-29).
-- Personas become columnists in 大家食: precomputed dish-level posts (world
-- canon / humble-done-right / trends), pending→published with in-feed review.
-- Why each piece exists:
--  * persona_posts RLS is enabled with NO policies: pending rows are
--    pre-publication drafts and must be invisible to clients; all access goes
--    through the admin client in API routes (sealed_predictions pattern).
--  * dishes.from_persona_post_id: the binding "every card carries a bookmark"
--    amendment — an editorial card has no dishes row, so its bookmark builds
--    the 待評 row from the post itself, and state/counts key on this column
--    the same way from_dish_id serves real-dish cards.
--  * profiles.is_persona_editor: the review gate is a DB flag, not an env var
--    (Vercel env changes have burned this project before; a flag deploys with
--    zero config). Set true for the owner.
--  * persona-content bucket: editorial images re-hosted (Commons originals
--    recorded in image_source_url), public read like dish-photos.

begin;

create table public.persona_posts (
  id uuid primary key default gen_random_uuid(),
  persona text not null check (persona in ('spoon','ck','kiki')),
  name text,
  name_zh text,
  cuisine text,
  body_zh text not null,
  body_en text not null,
  image_url text not null,
  image_credit text not null,
  image_license text not null,
  image_source_url text not null,
  fact_source_url text not null,
  pack jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','published')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.persona_posts enable row level security;

alter table public.dishes add column from_persona_post_id uuid references public.persona_posts(id) on delete set null;
create index dishes_from_persona_post_idx on public.dishes(from_persona_post_id) where from_persona_post_id is not null;

alter table public.profiles add column is_persona_editor boolean not null default false;
update public.profiles set is_persona_editor = true where id = '4d1c3ae0-47d9-4cba-b35e-179c134271bf';

insert into storage.buckets (id, name, public) values ('persona-content','persona-content', true);

commit;
