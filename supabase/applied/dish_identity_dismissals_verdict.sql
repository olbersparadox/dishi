-- Applied 2026-07-22 (dish-identity confirm card, 係咪同一味？).
-- The dismissals table becomes the pair VERDICT record, not just a denial
-- list. 'different' — the human said these are two dishes; permanent, never
-- re-asked (re-asking reads as the app not listening; the negative record is
-- as load-bearing as a merge). 'unsure' — 唔肯定; blocks re-asks only within
-- a cooldown window (30 days, the same rhythm as DUEL_RECENT_DAYS), then the
-- pair may be asked again.
--
-- Chosen over a sibling table (the backlog item asked the implementer to
-- propose and flag the tradeoff): the GET path already reads this table
-- symmetrically per pair, and a verdict IS a property of the pair decision —
-- a second table would re-implement the same unique key with a worse join.
-- The tradeoff accepted: 'unsure' rows are refreshed in place (created_at is
-- the cooldown clock), so there is no history of repeated 唔肯定 answers —
-- fine, because nothing consumes that history.
-- Existing rows were all real denials, so the default backfills them
-- correctly as 'different'.
alter table dish_identity_dismissals
  add column if not exists verdict text not null default 'different'
    check (verdict in ('different', 'unsure'));
