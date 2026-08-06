-- Applied live 2026-08-06 (G1 of the 墨靈 growth program).
-- Why: docs/rnd/mokling-growth-rnd.md Decision 2 — the metabolism needs a
-- TIMED evidence record ({v, at} per node, continuous-time EMA on the feeding
-- clock) so 萎 atrophy / 蛻 shed can be computed at read time. Written
-- alongside the plain lifetime `domain_evidence`, which stays the record the
-- renderer reads until G2 lands. Additive; nothing reads it yet; fails closed.
alter table taste_profiles
  add column if not exists domain_evidence_t jsonb not null default '{}'::jsonb;
