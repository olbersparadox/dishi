-- Applied via Supabase MCP on 2026-07-16. Links a dish_identity to the owner menu
-- item it adopted its name from, so an owner rename can re-point it (see
-- ownerMenuReconcile.ts + restaurant/menu PATCH).
alter table dish_identities
  add column if not exists owner_menu_item_id uuid
  references restaurant_menu_items(id) on delete set null;

create index if not exists dish_identities_owner_menu_item
  on dish_identities (owner_menu_item_id) where owner_menu_item_id is not null;
