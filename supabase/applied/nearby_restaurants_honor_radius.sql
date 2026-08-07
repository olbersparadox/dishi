-- Applied live 2026-08-07.
--
-- WHY: nearby_restaurants accepted a radius_m parameter and never used it. The
-- WHERE clause was a hardcoded +/-0.02 degree box (~2.2km N-S, ~2.1km E-W at HK
-- latitude), so all four callers were silently lied to:
--
--   /api/restaurants/nearby   asked  300m  -> got ~2km
--   /api/dishes/suggest       asked 1000m  -> got ~2km
--   src/lib/restaurant.ts     asked   50m  -> got ~2km   ("normalized name within ~50m")
--   tableRestaurantResolve    asked AUTO_RADIUS_M -> got ~2km
--
-- Found 2026-08-07 from a field report: a dish photographed in Wan Chai offered a
-- restaurant list that looked like it came from Central. It had not -- the list was
-- correctly distance-ORDERED, but the dead radius let the 8 nearest rows reach
-- 1791m, and since /api/restaurants/nearby returns [...dishi, ...google] the eight
-- distant own-restaurants pushed the genuinely-nearby Google results below the
-- fold. RatingStack then optimistically commits rich[0], so the dish was
-- auto-attributed to a shop 270m away. An audit of live rows found worse: 酸甜醬烤魚
-- had been committed to a restaurant 1836m away.
--
-- The dedup caller is the one that mattered most. restaurant.ts documents its rule
-- as "normalized name within ~50m, either language" and was matching names across
-- ~2km instead -- enough to fuse two branches of one chain into a single
-- restaurant row, which would quietly destroy the same-dish-at-different-places
-- execution comparison the product is built on (CLAUDE.md, "COMPARISON IS THE CORE
-- PRODUCT DNA"). Tightening dedup can only produce MORE distinct rows, never fewer,
-- which is the direction this codebase already prefers: a wrong merge costs a
-- dish's history, a duplicate costs one tap.
--
-- HOW: the bounding box stays as a cheap prefilter but is now SIZED FROM radius_m,
-- with a true great-circle filter doing the real work. The prefilter divides by
-- cos(lat) on BOTH axes, so it is never tighter than the circle it wraps -- a
-- prefilter that clipped a valid row would reintroduce the same class of silent
-- wrongness in the opposite direction. greatest(cos, 0.1) keeps it finite near the
-- poles.
create or replace function nearby_restaurants(
  user_lat double precision,
  user_lng double precision,
  radius_m double precision default 300,
  max_results int default 8
)
returns table(
  id uuid, name text, name_zh text, lat double precision, lng double precision,
  address text, area text, distance_m double precision
)
language sql
stable
as $function$
  select q.id, q.name, q.name_zh, q.lat, q.lng, q.address, q.area, q.distance_m
  from (
    select r.id, r.name, r.name_zh, r.lat, r.lng, r.address, r.area,
      2 * 6371000 * asin(sqrt(
        pow(sin(radians(r.lat - user_lat) / 2), 2) +
        cos(radians(user_lat)) * cos(radians(r.lat)) *
        pow(sin(radians(r.lng - user_lng) / 2), 2)
      )) as distance_m
    from restaurants r
    where r.lat is not null and r.lng is not null
      and abs(r.lat - user_lat)
            < (radius_m / 111320.0) / greatest(cos(radians(user_lat)), 0.1)
      and abs(r.lng - user_lng)
            < (radius_m / 111320.0) / greatest(cos(radians(user_lat)), 0.1)
  ) q
  where q.distance_m <= radius_m
  order by q.distance_m asc
  limit max_results;
$function$;
