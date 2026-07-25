-- Applied live 2026-07-24 (Supabase MCP), then recorded here.
--
-- WHY: contentScore's divisor was corrected the same day (src/lib/taste.ts —
-- it summed over the ~8.7 dims a dish reports but always divided by all 18,
-- crushing the taste term so predicted_raw was roughly 0.3 * cuisineAffinity
-- and the seal's `love` band was unreachable: 0 of 11 genuinely loved dishes
-- were ever called). See docs/rnd/seal-band-calibration.md.
--
-- The owner asked for the 36 historical outcomes to be RECOMPUTED under the new
-- formula. That turned out to be impossible, and this column is the honest
-- substitute: recomputing predicted_raw needs the taste vector + cuisine
-- affinity AS THEY WERE at each seal, and only the RESULTING predicted_raw was
-- ever stored (plus engine_rating_count / profile_version counters). Recomputing
-- against today's profile would not restore history — it would fabricate
-- predictions the engine never made, which is worse than an honest gap.
--
-- So historical outcomes are left exactly as they were. They are true records:
-- a v1 `hit` WAS a real prediction that really matched. What they are not is
-- comparable to v2, because v1 could never say `love` — its band shares are
-- structurally biased toward like/meh. This column makes that boundary explicit
-- instead of letting an aggregate silently average two different engines.

alter table sealed_predictions add column if not exists scoring_version smallint not null default 2;

comment on column sealed_predictions.scoring_version is
'Which contentScore formula produced predicted_raw. 1 = pre-2026-07-24 (summed over the dims a dish reports but divided by all 18, crushing the taste term so predicted_raw was roughly 0.3*cuisineAffinity and the love/dislike bands were unreachable). 2 = divides by max(MIN_SCORED_DIMS, scored). Rows are NOT comparable across versions: a v1 hit was a real correct prediction, but v1 could never say love, so v1 band shares are biased toward like/meh. Never mix versions in an aggregate without saying so.';

-- The 36 pre-existing rows were all written by v1.
update sealed_predictions set scoring_version = 1 where sealed_at < '2026-07-25';
