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
  trimmed jsonb;
  result jsonb;
begin
  select coalesce(menu_items, '[]'::jsonb) into current_items
    from table_sessions where id = p_session_id for update;

  if current_items is null then
    raise exception 'no such table session';
  end if;

  current_len := jsonb_array_length(current_items);
  room := greatest(p_max_total - current_len, 0);

  if room = 0 then
    return current_items;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into trimmed
    from (select elem from jsonb_array_elements(p_items) elem limit room) sub;

  update table_sessions set menu_items = current_items || trimmed
    where id = p_session_id
    returning menu_items into result;

  return result;
end;
$$;
