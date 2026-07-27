-- Applied live 2026-07-28 (canonical dish catalog build — cross-venue dish identity).
-- Why: dish_identities is scoped to ONE restaurant by schema, so the execution
-- slider could never compare the same dish across venues (the recorded product
-- aim). Each dish resolves ONCE against the curated catalog in
-- src/lib/hkDishCatalog.ts; two dishes are the same iff they land on the same id.
-- Evidence: docs/rnd/cross-venue-dish-phase0.md (0 false merges, 84.9% coverage).

-- Cross-venue dish identity: which canonical HK dish this row IS, if any.
-- The catalog itself lives in code (src/lib/hkDishCatalog.ts) — curated,
-- human-reviewed, never auto-minted — so this is a text id with no FK.
-- NULL = unresolved or honestly uncovered; both are safe states (a dish with
-- no canonical id simply has no cross-venue identity and joins nothing).
-- Written ONLY by the resolver (enrich / rename / propagation paths); it is
-- resolution state, not name authority, and never touches name_edited_at.
alter table dishes add column canonical_dish_id text;

-- Sibling lookups: "my other ratings of this same canonical dish".
create index dishes_canonical_dish_id
  on dishes (canonical_dish_id) where canonical_dish_id is not null;
