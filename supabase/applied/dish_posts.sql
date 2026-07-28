-- Applied 2026-07-28 (stream 2 — posts / per-dish opt-in publishing).
--
-- WHY: the public page's anchors were sourced from otherwise-private top
-- ratings on ONE blanket consent event (claiming a username), while the
-- product's consent unit everywhere else is the DISH. A post IS that unit:
-- one row = "I chose to publish this dish." Deleting the row revokes it.
--
-- Any verdict may be posted (owner call 2026-07-28) — so the page renders the
-- verdict word alongside the dish; a negative post must never read as praise.
-- No score column: the verdict is read live from ratings, because re-rating
-- replays history and a snapshot here would let the page state a verdict the
-- person no longer holds.
create table if not exists public.dish_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.dishes(id) on delete cascade,
  -- Why it's worth knowing. Optional: a post with no words is still a post.
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

create index if not exists dish_posts_user_created_idx
  on public.dish_posts (user_id, created_at desc);

alter table public.dish_posts enable row level security;

-- Published means published: any reader may see that a post row exists. What a
-- visitor actually SEES still passes through projectDossier (lib/dossier.ts),
-- which is the privacy contract — this policy is not it.
create policy "posts readable" on public.dish_posts
  for select using (true);

-- Publish only your OWN dish. The dishes subquery is the fence that stops a
-- row claiming someone else's dish under your user_id.
create policy "own posts insertable" on public.dish_posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.dishes d where d.id = dish_id and d.user_id = auth.uid())
  );

create policy "own posts updatable" on public.dish_posts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Unpublish is a real DELETE, not a flag: revoking consent should leave no row.
create policy "own posts deletable" on public.dish_posts
  for delete to authenticated
  using (user_id = auth.uid());
