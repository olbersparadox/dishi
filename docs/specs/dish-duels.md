# Spec: 對決 — pairwise taste duels

**Tier: [F] — use Opus/strongest model in Claude Code.** This touches the taste
engine's learning math and requires simulation-based verification, not just
tests. **DB is already live**: `dish_duels` table applied via Supabase MCP on
2026-07-17 (SQL at bottom — record it in `supabase/applied/dish_duels.sql`).

## Why

Flick ratings are absolute judgments — noisy (mood, hunger, scale drift).
Pairwise choices ("which would you eat first?") are far more stable, and each
answer teaches the vector along the CONTRAST between two dishes — isolating
dimensions a single rating can't untangle. Pairs are chosen ACTIVELY to resolve
the engine's own uncertain dims (the 摸緊 set), and the engine seals a
prediction of the winner before asking — merging the duel with the sealed-bet
mechanic: every duel both refines the engine AND proves it's learning.

## Learning math (`src/lib/taste.ts`)

New exported pure function, in the house conventions:

```ts
updateTasteFromDuel(
  taste: TasteVector, evidence: EvidenceMap,
  winner: DishVector, loser: DishVector,
): TasteVector
```

- Centered presence per dim: `c_d = (dish[d] - 0.5) * 2`, but ONLY for dims
  present AND >= LEARN_CUTOFF (identical murmur rule to taughtDims); absent or
  sub-cutoff dims contribute 0 to that dish's side.
- Contrast: `x_d = cWinner_d - cLoser_d`. Dims with x_d === 0 teach nothing.
- Pre-update predicted win prob: `p = sigmoid(K * (sW - sL))` where s uses the
  existing `contentScore` with the user's CURRENT vector and an empty affinity
  map (same-cuisine pairing makes affinity cancel; passing {} keeps it pure).
  K = 4 (contentScore lives in roughly -0.5..0.5; K=4 maps meaningful gaps to
  meaningful probabilities — verify in simulation, tune if needed).
- Update per contrast dim:
  `taste[d] = clamp(taste[d] + DUEL_WEIGHT * alpha_d * (1 - p) * x_d, -1, 1)`
  where `alpha_d = max(0.08, 1 / ((evidence[d] ?? 0) + 2))` (same as
  updateTaste) and `DUEL_WEIGHT = 0.6`.
  The (1 - p) factor is the point: confident correct predictions barely move
  the vector; upsets teach a lot.
- Evidence: new `bumpEvidenceFromDuel` bumps +1 ONLY for dims with
  |x_d| >= 0.3 (a duel that genuinely contrasted that dim).
- Cuisine affinity: NOT updated by duels (same cuisine on both sides — no
  signal).

## Replay (`src/lib/replay.ts`)

`replayProfile` becomes a merged-timeline replay: fetch ratings AND answered
duels (winner not null), merge by created_at/answered_at ascending, apply each
event through the real functions (rating -> updateTaste+bumpEvidence+affinity;
duel -> updateTasteFromDuel+bumpEvidenceFromDuel). Duels use dishes' CURRENT
attributes — corrections heal duel learning exactly as they heal ratings.
Skipped duels replay as nothing.

## Pair selection (server-side, in the GET route)

Candidates: user's rated dishes with non-empty attributes. Same cuisine
required. Exclusions: same dish_identity on both sides; any pair (either
order) already answered; pair served/skipped within 30 days; any dish already
appearing in 3+ lifetime duels.

Score each remaining pair: `info = Σ_d (1 / (1 + evidence[d])) * |x_d|`
Require at least one dim with |x_d| >= 0.3 where evidence[d] <= 2 (a genuinely
uncertain, genuinely contrasted dim) — otherwise the pair doesn't qualify.
Serve the max-info pair. **If nothing qualifies, serve nothing** — the card
simply doesn't appear. Never a filler duel.

## API (`src/app/api/duels/route.ts` — follow the seals route pattern)

All `dish_duels` I/O via `supabaseAdmin()` (table is RLS-locked with no
policies — predicted_winner must be invisible until answered; that hiddenness
IS the seal).

- `GET /api/duels/next`: if an unanswered, unskipped served duel < 24h old
  exists, return it (ids + names + name_zh + photo_url of both dishes, NEVER
  predicted fields). Else run pair selection; if a pair qualifies, compute
  prediction (winner by sign of sW - sL, p as above), insert the row, return
  the pair. If none qualifies or last answered/skipped duel < 20h ago, return
  { duel: null }.
- `POST /api/duels/answer` { duel_id, winner_dish_id | skip: true }:
  - Validate ownership + unanswered. Skip: set skipped_at, done.
  - Answer: set winner + answered_at; apply updateTasteFromDuel +
    bumpEvidenceFromDuel to taste_profiles (do NOT bump rating_count — duels
    are not ratings; leveling/XP unchanged in v1).
  - Return the reveal: { predicted_correct: boolean, predicted_p,
    learned: [{dim, dir}] } (learned = contrast dims actually moved, same
    shape as profile.justlearned).

## UI (Taste tab)

Card between the log-entry row and 待評嘅菜, only when GET returns a duel:
- Header: 今日對決, with the 印 stamp glyph (a prediction is sealed).
- Two dishes side by side: photo if present else name card; dish names bold
  per house rule; restaurant name small under each.
- Question: 而家俾你揀，食邊樣先？ / "Right now — which would you eat first?"
- Tap a dish -> POST answer -> inline reveal strip: 估中咗 🎯 / 估錯咗 (+ what
  it just learned, dim chips with ↑↓, reusing justlearned rendering).
- Quiet skip link: 揀唔落 (posts skip; card disappears; no guilt copy).
- i18n keys for all of the above, zh + en.

## Simulation verification (REQUIRED before merge — house rule for engine math)

Script in `rnd/` or `scripts/` (node --experimental-strip-types style, like
prior engine work): synthesize N=30 users with ground-truth taste vectors;
generate dish pools with realistic sparse attributes; simulate noisy flicks
(existing pipeline) with and without interleaved duels (selection logic as
specced). Measure held-out pairwise ranking accuracy overall AND on
low-evidence dims. Acceptance: duels improve low-evidence-dim accuracy
measurably and never degrade overall accuracy. Tune K and DUEL_WEIGHT if the
defaults underperform; report final numbers in the commit message.

## Tests (`tests/duels.test.ts`)

- updateTasteFromDuel: moves contrast dims toward winner; (1-p) scaling —
  confident-correct prediction moves less than upset; murmur dims ignored;
  clamping; empty-contrast pair is a no-op.
- bumpEvidenceFromDuel only bumps |x|>=0.3 dims.
- Pair selection: excludes answered pairs both orders; enforces same cuisine,
  lifetime cap, contrast+uncertainty floor; returns null when nothing
  qualifies.
- Replay: merged timeline order respected; skipped duels inert; deleting a
  dish removes its duels from replay (cascade — test at logic level).

## Acceptance

- tsc clean; npm test green; simulation numbers reported.
- Manual: duel card appears on Taste tab (given enough rated same-cuisine
  dishes), answer triggers reveal with prediction verdict, profile's radar
  reflects new learning, no card when data is thin.

## Migration (already applied live — record as supabase/applied/dish_duels.sql)

```sql
create table if not exists dish_duels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_a uuid not null references dishes(id) on delete cascade,
  dish_b uuid not null references dishes(id) on delete cascade,
  predicted_winner uuid references dishes(id) on delete set null,
  predicted_p real,
  winner uuid references dishes(id) on delete cascade,
  skipped_at timestamptz,
  served_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table dish_duels enable row level security;
create index if not exists dish_duels_user on dish_duels(user_id, answered_at);
create index if not exists dish_duels_user_pair on dish_duels(user_id, dish_a, dish_b);
```
