-- Applied live 2026-07-24 (Supabase MCP), then recorded here.
--
-- WHY: `revealed_at` was carrying two meanings at once — "the outcome was
-- computed server-side" AND "the person saw it". Because it is one-way, a
-- render bug meant every rating permanently consumed a seal with nothing on
-- screen: 36 seals computed, 36 stamped, 0 ever displayed, none recoverable
-- (see docs/DECISIONS.md, "seal reveal + band calibration", commit a2cbc9e).
--
-- Splitting the two makes an undisplayed reveal recoverable instead of
-- destroyed: `revealed_at` keeps its original meaning and stays one-way,
-- `displayed_at` records the client's acknowledged render.
--
-- HARD LINE (the seal contract): displayed_at must NEVER be used to widen what
-- the client can see. Rows with revealed_at IS NULL remain invisible to their
-- own owner by RLS — that invisibility IS the seal. The recovery query is only
-- ever `revealed_at IS NOT NULL AND displayed_at IS NULL`.

alter table sealed_predictions add column if not exists displayed_at timestamptz;

comment on column sealed_predictions.displayed_at is
'When the reveal was actually SHOWN to the person. revealed_at means only "outcome computed server-side" and is one-way; splitting the two is what makes an undisplayed reveal recoverable instead of destroyed (2026-07-24, after a render regression consumed 36 seals with nothing on screen). Never used to gate visibility of PENDING rows — those stay invisible by RLS, which is the seal contract.';

-- Backfill. The 36 pre-existing revealed rows were provably never displayed
-- (the render path was broken for all of them), so they would ALL qualify as
-- recoverable — but dumping 36 stale verdicts on the next rating session would
-- be noise, not payoff, and each is detached from the rating that earned it.
-- Mark them displayed so only NEW misses are ever recovered.
update sealed_predictions
set displayed_at = revealed_at
where revealed_at is not null and displayed_at is null;
