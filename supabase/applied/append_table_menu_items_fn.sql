-- Applied 2026-07-21. Supports appending a scanned page to an EXISTING table
-- session's shared menu (previously an appended page only extended the
-- scanner's own local view, never the group's shared table — see
-- docs/BACKLOG.md's Table Mode entries). Row-locked (`for update`) so two
-- concurrent appends to the same session serialize instead of racing a
-- read-modify-write from the client and silently dropping one. Capped at
-- p_max_total (called with 40, matching POST /api/table's own existing cap)
-- so a session can't grow unbounded — ranking recomputes over the full
-- candidate list on every poll, so total item count has a real (if modest)
-- server-side compute cost.
--
-- Amended 2026-07-22 (Table Mode item 6 — any member can append, not just the
-- host): added a dedup pass against the CURRENT menu_items before appending.
-- Real menus reprint dishes across pages (a "chef's picks" sidebar repeating
-- a mains-page item), and once any member can add a page, an overlapping
-- photo is a realistic everyday occurrence, not just scanner carelessness.
-- Match key: case/whitespace-normalized printed name (name_original, falling
-- back to name) + exact price string — a dish is "the same" if its printed
-- text and price agree; genuinely different prices (a size variant, a menu
-- update) are kept as distinct rows on purpose. Dry-run tested (begin/
-- rollback) against a temp session: exact dupe filtered, same-name-different-
-- price kept, new dish kept.
create or replace function append_table_menu_items(p_session_id uuid, p_items jsonb, p_max_total int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_items jsonb;
  current_len int;
  room int;
  deduped jsonb;
  trimmed jsonb;
  result jsonb;
begin
  -- Row-locked read: serializes concurrent appends to the SAME session instead of
  -- racing a read-modify-write from the client (two appends landing at once would
  -- otherwise silently drop one).
  select coalesce(menu_items, '[]'::jsonb) into current_items
    from table_sessions where id = p_session_id for update;

  if current_items is null then
    raise exception 'no such table session';
  end if;

  -- Drop any incoming item that's the same dish (case/whitespace-insensitive
  -- printed name, falling back to the display name if name_original is blank)
  -- at the same price as something already on the shared menu.
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into deduped
  from jsonb_array_elements(p_items) elem
  where not exists (
    select 1 from jsonb_array_elements(current_items) existing
    where lower(trim(coalesce(nullif(existing->>'name_original', ''), existing->>'name', '')))
        = lower(trim(coalesce(nullif(elem->>'name_original', ''), elem->>'name', '')))
      and coalesce(existing->>'price', '') = coalesce(elem->>'price', '')
  );

  current_len := jsonb_array_length(current_items);
  room := greatest(p_max_total - current_len, 0);

  if room = 0 then
    return current_items;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into trimmed
    from (select elem from jsonb_array_elements(deduped) elem limit room) sub;

  update table_sessions set menu_items = current_items || trimmed
    where id = p_session_id
    returning menu_items into result;

  return result;
end;
$$;
