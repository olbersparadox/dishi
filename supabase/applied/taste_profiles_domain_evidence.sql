-- Applied live 2026-08-04 (Supabase MCP), then recorded here per the repo's
-- migration workflow.
--
-- WHY: 墨靈 ship-path step 2 — the per-user 骨 domain aggregate. The creature
-- renderer (src/lib/creatureForm.ts) has always accepted a DomainEvidence
-- record; nothing produced or stored one, so no user could ever grow anatomy.
-- This is where it lives, beside the vector it is a sibling of.
--
-- SHAPE: { sea, land, air, shell, field, algae, fungus?: number,
--          sub?: { shell?: {lobster,crab,prawn}, land?: {beef,pork,chicken} } }
-- Liking-weighted evidence per domain (src/lib/domainEvidence.ts): exposure
-- counts, liking amplifies, dislike carves.
--
-- NOT NULL DEFAULT '{}' is load-bearing: an empty record is exactly the signal
-- creatureForm.hasAnatomy() reads as "this person has no lived domain evidence,
-- render today's blob". So every existing row is correct the moment the column
-- exists — the feature fails closed for everyone until their next re-rate
-- rebuilds it, with no backfill required and no behaviour change on read.
--
-- Rebuilt (never incrementally patched) by src/lib/replay.ts on every rating,
-- re-rating and rename, exactly as vector/evidence/cuisine_affinity are — so a
-- corrected dish name heals the creature's anatomy the same way it heals the
-- palate, and the value stays a pure function of rating history.
alter table public.taste_profiles
  add column if not exists domain_evidence jsonb not null default '{}'::jsonb;

comment on column public.taste_profiles.domain_evidence is
  '骨 domain evidence: what the palate lives on (sea/land/air/shell/field/algae/fungus + sub-node mixes). Produced by src/lib/domainEvidence.ts, rebuilt by replay.ts on every re-rate/rename exactly like vector and cuisine_affinity. Empty {} means no lived domain evidence, which the creature renderer reads as "draw the plain blob".';
