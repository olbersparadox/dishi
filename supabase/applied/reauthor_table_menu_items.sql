-- Applied 2026-07-24. Table Mode two-account field test: a joiner saw the
-- scanner's UNTRANSLATED Japanese menu all session, because the shared
-- session receives items exactly once at creation — every later re-author
-- pass (kana/hangul namefix translation, enrichment chips, scoring
-- attributes) only ever patched the scanner's LOCAL view. This is the
-- update-side sibling of append_table_menu_items: row-locked (for update) so
-- a re-author serializes against concurrent appends, and by construction it
-- can ONLY update derived fields on EXISTING entries matched by the stable
-- printed-name key (name_original, same normalization as the append dedup) —
-- it never adds, removes, or reorders entries, and never touches
-- name_original (verbatim always — standing rule) or price. Empty/blank
-- incoming values never clobber real existing ones: a failed client-side
-- stage re-sends the item's original empty fields, and best-effort sync must
-- only ever add information. Dry-run tested (begin/rollback) 2026-07-24:
-- translation adopted, empty-fields item left intact, ghost item ignored.
create or replace function reauthor_table_menu_items(p_session_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_items jsonb;
  result jsonb;
begin
  select coalesce(menu_items, '[]'::jsonb) into current_items
    from table_sessions where id = p_session_id for update;

  if current_items is null then
    raise exception 'no such table session';
  end if;

  select coalesce(jsonb_agg(
    case when upd.elem is null then existing.elem
    else existing.elem || jsonb_build_object(
      'name', case when nullif(trim(upd.elem->>'name'), '') is not null then upd.elem->'name' else existing.elem->'name' end,
      'name_zh', case when nullif(trim(upd.elem->>'name_zh'), '') is not null then upd.elem->'name_zh' else existing.elem->'name_zh' end,
      'hook', case when nullif(trim(upd.elem->>'hook'), '') is not null then upd.elem->'hook' else existing.elem->'hook' end,
      'attributes', case when upd.elem->'attributes' is not null and upd.elem->'attributes' <> '{}'::jsonb then upd.elem->'attributes' else existing.elem->'attributes' end,
      'diet', case when upd.elem->'diet' is not null and upd.elem->'diet' <> '[]'::jsonb then upd.elem->'diet' else existing.elem->'diet' end,
      'cooking_method', case when nullif(trim(upd.elem->>'cooking_method'), '') is not null then upd.elem->'cooking_method' else existing.elem->'cooking_method' end,
      'heaviness', case when nullif(trim(upd.elem->>'heaviness'), '') is not null then upd.elem->'heaviness' else existing.elem->'heaviness' end,
      'ingredients', case when upd.elem->'ingredients' is not null and upd.elem->'ingredients' <> '[]'::jsonb then upd.elem->'ingredients' else existing.elem->'ingredients' end
    ) end
    order by existing.ord), '[]'::jsonb)
  into result
  from jsonb_array_elements(current_items) with ordinality as existing(elem, ord)
  left join lateral (
    select u.elem from jsonb_array_elements(p_items) as u(elem)
    where lower(trim(coalesce(nullif(u.elem->>'name_original', ''), u.elem->>'name', '')))
        = lower(trim(coalesce(nullif(existing.elem->>'name_original', ''), existing.elem->>'name', '')))
    limit 1
  ) as upd on true;

  update table_sessions set menu_items = result where id = p_session_id;
  return result;
end;
$$;
