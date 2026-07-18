-- Applied live to Supabase 2026-07-19 (project yuwfhtpyrvdopmexhpwd).
-- Why: the AI-palate export (spec §3) lets the user choose the VOICE their palate
-- speaks in. Persist that choice so a re-export re-renders in the same persona and
-- the picker restores it. Three voices in v1 (老實派/食家腔/貪玩); the check keeps the
-- set closed (Level-10 粗口 mode etc. are a later, deliberate addition). Default
-- 'honest' = 老實派, the plainest voice, so an un-chosen profile has a sane baseline.

alter table public.taste_profiles
  add column if not exists persona text not null default 'honest'
  check (persona in ('honest', 'connoisseur', 'playful'));
