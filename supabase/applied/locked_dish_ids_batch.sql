-- Applied live to Supabase 2026-07-19 (project yuwfhtpyrvdopmexhpwd).
-- Why: the journal (GET /api/my/dishes?rated=1) called is_dish_locked ONCE PER
-- dish — N DB round-trips per page load, the main cause of its ~1-2s latency.
-- This batched version evaluates the SAME lock semantics for a set of ids in a
-- single query, returning just the locked ones. Verified to match is_dish_locked
-- (both 0 locked for the single-user test data). is_dish_locked is kept — the
-- PATCH/DELETE paths still use it for a single dish.

create or replace function public.locked_dish_ids(p_dish_ids uuid[])
returns setof uuid
language sql
stable
as $function$
  select d1.id
  from dishes d1
  where d1.id = any(p_dish_ids)
    and exists (
      select 1
      from ratings r
      join dishes d2 on d2.id = r.dish_id
      where r.user_id <> d1.user_id
        and (
          (d1.dish_identity_id is not null and d2.dish_identity_id = d1.dish_identity_id)
          or (d1.restaurant_id is not null and d2.restaurant_id = d1.restaurant_id
              and lower(trim(d2.name)) = lower(trim(d1.name)))
          or (d1.restaurant_id is null and d2.id = d1.id)
        )
    );
$function$;
