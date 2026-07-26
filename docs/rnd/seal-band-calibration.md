# Seal band calibration — diagnosis (2026-07-24)

**Status: ANALYSIS ONLY. No code changed. Owner decides before anything lands.**
This changes what the seal *means*, so it is not an implementation detail.

Queried live against production (Supabase MCP), all rows, 2026-07-24.

---

## 1. The distribution

`sealed_predictions.predicted_raw`, all 36 rows:

| stat | value |
|---|---|
| min | 0.0184 |
| p25 | 0.0712 |
| median | 0.2508 |
| p75 | 0.3568 |
| max | **0.4070** |
| mean | 0.2200 |
| sd | 0.1358 |

Against the current `directionOf` edges (`love ≥ 0.5`, `like ≥ 0.15`,
`meh ≥ −0.15`, else `dislike`):

- `love`: **0 rows** — the max ever recorded is 0.407, below the 0.5 edge.
- `like`: 22 rows
- `meh`: 14 rows
- `dislike`: **0 rows** — the min ever recorded is +0.018, never negative.

**Two of the four bands are unreachable.** Not rare — structurally impossible
on the evidence so far.

Actual flick scores, meanwhile, use the full scale (n=41 ratings; the 36
sealed ones are indistinguishable from the whole):

| stat | value |
|---|---|
| min | −0.90 |
| p25 | 0.35 |
| median | 0.35 |
| p75 | 0.60 |
| max | 1.00 |
| mean | 0.377 |

Actual band shares: **like 55.6% (20) · love 30.6% (11) · meh 8.3% (3) ·
dislike 5.6% (2)**.

So **36% of all sealed ratings (love + dislike) land in bands the engine can
never call** — capped at `near` before the person even flicks.

Outcomes confirm it: **12 hit · 24 near · 0 miss.** Every `near` is the same
story twice —

| predicted | outcome | n | avg predicted_raw | avg actual |
|---|---|---|---|---|
| like | hit | 10 | 0.334 | 0.350 |
| like | near | 12 | 0.304 | **0.658** ← actually `love` |
| meh | hit | 2 | 0.056 | 0.100 |
| meh | near | 12 | 0.068 | 0.175 ← actually `like` |

The engine is not wrong. It is **structurally incapable of conviction**, which
is why the mechanic reads as permanently lukewarm.

---

## 2. Root cause — this is arithmetic, not taste

`contentScore` (`src/lib/taste.ts:146`):

```ts
for (const dim of DIMS) {
  if (!(dim in dish)) continue;            // only dims the dish REPORTS
  s += (taste[dim] ?? 0) * (dish[dim] - 0.5) * 2;
}
s /= DIMS.length;                          // ← divides by 18, ALWAYS
if (cuisine) s += 0.3 * (cuisineAffinity[cuisine] ?? 0);
```

The sum runs over only the dims a dish actually reports (**mean 8.7 per dish**
in this data), but the divisor is always `DIMS.length` = **18**. The dimension
term is therefore scaled down by roughly 2× more than the evidence supports,
crushing it toward zero — leaving `predicted_raw ≈ 0.3 × cuisineAffinity`.

The per-cuisine split is the proof (affinity values from the live profile):

| cuisine | affinity | 0.3 × affinity | observed mean_raw | n |
|---|---|---|---|---|
| cantonese | 1.00 | 0.300 | 0.2849 | 15 |
| japanese | 1.00 | 0.300 | 0.2436 | 12 |
| western | 0.19 | 0.057 | 0.2098 | 2 |
| chinese | 0.16 | 0.048 | **0.0487** | 3 |
| sichuan | 0.07 | 0.021 | **0.0184** | 1 |
| italian | 0.07 | 0.021 | 0.0614 | 1 |
| american | −0.10 | −0.030 | 0.0444 | 1 |
| indian | −0.18 | −0.054 | 0.0345 | 1 |

Worked example, verified exactly — 薑蔥蒸石斑 (6 reported dims, cantonese):
dimension sum = 1.225, ÷18 = **0.068**, + 0.3×1.0 = **0.368**, and the live
seal recorded `predicted_raw = 0.3680`. **82% of that number is the cuisine
bonus.** All eighteen taste dimensions contributed 0.068.

Ceiling check: `love` needs ≥ 0.5. With affinity capped at 1.0 the cuisine term
gives 0.3, so the dimension term would have to supply 0.2 — a sum of 3.6 across
~8 present dims, i.e. near-perfect alignment on every reported attribute.
Effectively unreachable. Observed max: 0.407.

`dislike` needs < −0.15, which requires a strongly negative cuisine affinity
*and* a negative dimension sum. Never happened.

---

## 3. Does the range drift as the engine matures?

**Yes — monotonically.** This matters because it means any fixed edge fitted
today is wrong later.

| engine_rating_count | n | mean predicted_raw | max |
|---|---|---|---|
| 5–9 | 5 | 0.1082 | 0.1769 |
| 10–19 | 11 | 0.1832 | 0.3700 |
| 20–29 | 10 | 0.2271 | 0.3651 |
| 30–39 | 9 | 0.3082 | 0.4070 |
| 40 | 1 | 0.3211 | 0.3211 |

Mean predicted_raw roughly **triples** from a thin profile to a mature one, as
the taste vector grows away from zero and more cuisines acquire non-zero
affinity. A thin profile scores near zero on everything; a mature one spreads.

Consequence: **fixed edges fitted to today's distribution will drift out of
calibration as the engine matures** — and would need refitting periodically,
which is a maintenance trap.

---

## 4. Sample-size blocker — read this before choosing

The spec asked for the distribution across **all** users rather than the
owner's 36 rows. That query returns:

> `sealed_predictions`: 36 rows, **`count(distinct user_id) = 1`**

**There is no cross-user data. The owner's profile is the entire dataset.**
No other account has ever crossed `SEAL_GATE` (5 ratings) — the only other
account with dishes has 0 ratings.

So n=36-from-one-palate is not a thin sample we can supplement; it is
everything that exists. Any option that *fits constants to the data* (a, c) is
fitting to one person's eating habits — someone who is 76% Cantonese/Japanese
and whose cuisine affinities are both pinned at the 1.0 ceiling. That is
exactly the profile that maximises the cuisine term and hides the divisor bug.

This is the strongest argument for fixing the mechanism (option d) rather than
fitting numbers to it.

---

## 5. Options

### (a) Separate `PREDICTED_BANDS` fitted to the real distribution

Give predictions their own edges, leaving the actual-score edges alone.
Quantile-matched so predicted band shares mirror actual band shares:

```
love ≥ 0.328 · like ≥ 0.048 · meh ≥ 0.040 · else dislike
```

- **For:** smallest possible blast radius — touches `seal.ts` only, recommendations
  and ranking untouched. Immediately unlocks all four bands.
- **Against:** the numbers are magic constants fitted to n=36 from one user, and
  §3 shows they will drift as engines mature. The `meh`/`like` edges land
  0.008 apart, which is noise, not a boundary — a rounding difference would
  flip the band. Treats the symptom; the divisor bug stays in the recommender.

### (b) Normalize contentScore onto the flick scale before banding

Apply a monotone map (e.g. divide by observed max, or a tanh/logistic squash)
inside `seal.ts` only, then band with the existing edges.

- **For:** still contained to the seal; no magic band edges; naturally rescales
  as the engine matures if the normalizer is derived from the user's own
  history rather than a constant.
- **Against:** needs a normalizer input, and the honest one (the user's own
  predicted_raw history) is thin early on — the first few seals for a new user
  would normalize against almost nothing. Rank order is preserved, so it cannot
  fix *which* dish scores highest, only how confidently it is described.

### (c) Per-user adaptive bands

Band each user's prediction against their own predicted_raw quantiles.

- **For:** immune to the maturity drift in §3, and to one user's cuisine mix.
- **Against:** the seal stops meaning the same thing between two people —
  "love" becomes "top quintile *for you*". Needs a history threshold before it
  can work at all, and below that you need a fallback (i.e. you still have to
  pick option a or b for new users). Most complex of the four.

### (d) Fix the divisor in `contentScore` — treats the actual cause

`s /= DIMS.length` → divide by the number of dims actually present (with a
floor to avoid over-amplifying a 1-attribute dish).

- **For:** the only option that fixes the real defect. The dimension term
  regains roughly 2× its magnitude and the cuisine bonus stops dominating.
  Fixes prediction *and* ranking quality together — a dish currently loses to
  cuisine affinity even when its attributes match far better.
- **Against — the big one:** `contentScore` ranks menu items **everywhere**
  (recommendations, scan ordering, duels). This changes what the app recommends
  for every user, which is a product decision far larger than the seal, and it
  is exactly the kind of change that needs simulation before it ships
  (`scripts/simulate-duels.ts` is the existing precedent). Also invalidates
  historical comparability more thoroughly than (a)–(c).

**My read, for what it's worth:** (d) is the correct fix and (a) is the
tempting one. Doing (a) alone would lock in a fitted constant that exists only
to compensate for an arithmetic bug — and make the bug harder to justify fixing
later, because the bands would then be calibrated around it. If (d) is too big
to take now, (b) is the better holding position than (a), because it does not
bake in magic numbers.

---

## 6. Should already-revealed rows be recomputed?

**A backfill is possible.** Both `predicted_raw` and `actual_score` are stored
on every revealed row, so any new banding can be replayed over history without
re-deriving anything.

- **Recompute:** the streak line and any future "how often is Dishi right"
  statistic become internally consistent — one rule over all history. Cost: the
  36 outcomes the owner already *saw* would change under them (12 hits could
  become a different number). Anything already shown becomes retroactively
  false, which for a mechanic whose entire selling point is "written down in
  advance, never altered" is a real integrity cost — arguably a violation of
  the sealed-bet contract's spirit even though the prediction itself is not
  being edited.
- **Leave as-is:** history stays exactly what the person was told. Cost: two
  banding regimes coexist, so any aggregate over the seal history mixes them,
  and the streak spanning the cutover is meaningless.
- **Middle:** leave outcomes frozen, add a `banding_version` column, and have
  aggregates only ever compare within one version. Honest, and cheap — but
  makes the pre-cutover history permanently non-comparable rather than fixing it.

Given the reveal-render bug (fixed 2026-07-24, commit `a2cbc9e`) means **none
of the 36 outcomes were ever actually displayed to the owner**, the "already
seen" objection is far weaker than it looks — in practice nothing was shown, so
recomputing would rewrite history nobody read. That is a genuine one-time
window to recompute cleanly, and it closes as soon as reveals start rendering.

---

## 7. Recommendation to the owner

1. Decide (d) vs (b) first — mechanism or holding position. Avoid (a) as a
   standalone.
2. If (d): simulate before shipping, treat it as a recommendation-quality
   change, not a seal change.
3. Backfill decision is *time-sensitive* — the clean window exists only until
   real reveals accumulate.

---

# 8. SIMULATION — what each option actually does (2026-07-24)

`scripts/simulate-seal-bands.ts`, replaying all 36 real seals.
`scripts/seal-rows.json` is the frozen fixture pulled from production.

**Caveat, stated up front:** the taste vector and cuisine affinity *at seal
time* were never stored — only the resulting `predicted_raw`. So (d) is
recomputed against the CURRENT profile. That makes it a faithful
formula-vs-formula comparison under one fixed profile, not a replay of what
would have been predicted back then. Reconstruction drift of the current
formula against the stored values: **median 0.045, p90 0.272, max 0.318** —
small for recent rows, large for early thin-profile ones. Treat (d)'s per-row
verdicts as indicative; the *aggregate* direction is solid, because the ~2×
gain in the dimension term is a property of the arithmetic, not of the profile.

Actual flick bands (ground truth): **love 11 · like 20 · meh 3 · dislike 2**.

| option | predicted bands | unreachable | hit | near | miss |
|---|---|---|---|---|---|
| **current** | love 0 · like 22 · meh 14 · dislike 0 | love, dislike | 12 (33.3%) | 24 (66.7%) | 0 |
| **(a)/(c) fitted edges** | 11 · 20 · 3 · 2 | none | 18 (50.0%) | 16 (44.4%) | 2 (5.6%) |
| **(b) normalized** | 20 · 9 · 7 · 0 | dislike | 16 (44.4%) | 19 (52.8%) | 1 (2.8%) |
| **(d) fixed divisor** | 11 · 19 · 6 · 0 | dislike | **19 (52.8%)** | 17 (47.2%) | **0** |

## The number that decides it

Recall per actual band — *when the person really loved it, did the engine say so?*

| actually | n | current | (a)/(c) | (b) | (d) |
|---|---|---|---|---|---|
| **love** | 11 | **0 (0%)** | 5 (45%) | **9 (82%)** | 6 (55%) |
| like | 20 | 10 (50%) | 12 (60%) | 6 (30%) | **12 (60%)** |
| meh | 3 | **2 (67%)** | 0 (0%) | 1 (33%) | 1 (33%) |
| dislike | 2 | 0 (0%) | **1 (50%)** | 0 (0%) | 0 (0%) |

**Today the engine calls 0 of 11 loves.** Not "rarely" — never. That single row
is the whole complaint about the mechanic reading lukewarm.

## Reading it

- **(d) fixed divisor is the best all-rounder**: highest hit rate (52.8%), the
  only option with **zero misses**, and the best `like` recall while unlocking
  `love`. It also does this WITHOUT any fitted constants — the edges stay
  exactly as they are; only the arithmetic bug is corrected. The dimension term
  goes from mean 0.068 (range 0.002–0.14) to mean 0.146 (range 0.003–0.36),
  i.e. from "dwarfed by the 0.3 cuisine bonus" to "comparable with it".
- **(b) normalized wins on love recall (82%) but by over-calling**: it predicts
  20 loves where there were 11, and `like` recall collapses to 30%. It is not
  more accurate, it is more enthusiastic — it slides the whole distribution up.
- **(a)/(c) fitted edges look respectable in aggregate but destroy `meh`
  (0/3)** and introduce the only meaningful miss count. And the fitted `like`
  and `meh` edges land 0.008 apart (0.0482 vs 0.0399), which is noise, not a
  boundary — a rounding difference would flip the band. They are also fitted to
  ONE user's 36 rows, and §3's maturity drift means they decay.
- **`dislike` stays unreachable under (b) and (d).** With only 2 real dislikes
  the evidence is too thin to design for; (a) "solves" it only by fitting an
  edge to those 2 points, which is overfitting, not calibration. Worth revisiting
  when real negative ratings accumulate — it is a genuinely open remainder, not
  something any of these options honestly fixes.

## What this doesn't settle

(d) changes `contentScore`, which ranks menu items everywhere — recommendations,
scan ordering, duels. This simulation says nothing about that blast radius; it
only shows the seal-side effect. Shipping (d) means treating it as a
recommendation-quality change and simulating THAT too (`scripts/simulate-duels.ts`
is the precedent), not just flipping the divisor because the seal numbers improve.

---

# 9. DECISION + OUTCOME (2026-07-24) — shipped

Owner chose **(d) fix it everywhere** and **recompute history**. Both answers
ran into evidence that changed the shape of the work; recorded here because the
corrections matter more than the plan did.

## 9a. The blast-radius check invalidated the recommendation as specified

§5 recommended (d) with the divisor floored at 4. Simulating the RANKING impact
first — the check that was owed before touching `contentScore` — showed that
form **degrades recommendations**:

| divisor | all-pairs | within-cuisine | love recall |
|---|---|---|---|
| `/max(4, scored)` ← as recommended | 73.2% | 67.3% | 6/11 |
| `/max(8, scored)` | 75.1% | 69.0% | 6/11 |
| **`/max(10, scored)` ← shipped** | **76.1%** | **69.9%** | 3/11 |
| `/18` (before) | 76.1% | 68.1% | **0/11** |

Ground truth is pairwise ordering of the 36 really-rated dishes (same metric as
`scripts/simulate-duels.ts`). **Within-cuisine is the one that matters** — a real
menu is one restaurant, so the `0.3 * affinity` term is a constant offset that
cancels and 100% of the ranking signal is the dimension term.

The floor turned out to be the whole ballgame, and 4 was a guess. Dividing by a
raw count over-amplifies sparse dishes: with attribute counts spanning 6–12, a
6-attribute dish got a 3x boost relative to an 18-divisor while a 12-attribute
one got 1.5x, which scrambles ordering. **10 is the only value in a 1..18 sweep
that regresses neither ranking metric while still unlocking `love`.**

Lower floors call more loves (6/11 at floor 4-8 vs 3/11 at 10) but cost ~1-3pp
of ranking accuracy. Recommendation quality gates everything, so the
conservative end was taken deliberately: **a seal that is merely better is worth
less than recommendations that are no worse.**

Shipped result, measured through the real `contentScore`:

- ranking: all-pairs **76.1% → 76.1%** (unchanged), within-cuisine **68.1% → 69.9%** (+1.8pp)
- seal: hit rate **33.3% → 52.8%**, `like` recall **50% → 75%**, `love` recall **0% → 27%**
- taste term mean **0.068 → 0.122**, against a cuisine bonus of up to 0.3 — no
  longer dwarfed, though the cuisine term still carries real weight
- verified end-to-end on a live seal: the same dish that scored **0.3680**
  (1.225/18 + 0.3) before now scores exactly **0.4225** (1.225/10 + 0.3)

`MIN_SCORED_DIMS` is the one fitted constant here, fitted to 36 rows from ONE
palate. It is provisional and marked as such in the code. Revisit when seal data
exists for more than one person.

## 9b. "Recompute history" turned out to be impossible

The owner asked for the 36 historical outcomes to be recomputed under the new
formula. It cannot be done, and the reason is worth recording: recomputing
`predicted_raw` requires the taste vector and cuisine affinity **as they were at
each seal**, and only the *resulting* `predicted_raw` was ever stored (plus
`engine_rating_count` / `profile_version` counters). §8's reconstruction drift
(median 0.045, p90 0.272) is exactly the size of that gap.

Recomputing against today's profile would not restore history — it would
**fabricate predictions the engine never made**, and attribute them to a moment
when it would have said something else. For a mechanic whose whole claim is
"written down in advance, never altered," that is worse than an honest gap.

So historical outcomes are **left exactly as computed**. They are true records:
a v1 `hit` was a real prediction that really matched. What they are *not* is
comparable to v2, because v1 could never say `love` — its band shares are
structurally biased toward like/meh.

The honest substitute for the owner's actual intent (consistent aggregates) is
`sealed_predictions.scoring_version`
(`supabase/applied/sealed_predictions_scoring_version.sql`): 36 existing rows
marked v1, everything new stamped v2 from `SCORING_VERSION` in taste.ts. Any
aggregate that mixes them is now visibly mixing two engines rather than silently
averaging them. The streak deliberately still counts across both — each `hit` is
a genuine correct call regardless of which formula produced it.

## 9c. Still open

`dislike` remains unreachable (0/2 called). With only two real dislikes in the
entire dataset there is nothing honest to tune against — fitting an edge to two
points is overfitting, not calibration. Genuinely open, not fixed.

---

# 10. Self-calibrating rating scale — evidence (2026-07-24)

Owner's framing, which replaced my proposal:

> "Everyone's scale is different. To me 一般般 is nothing to remember about.
> For daily meal consumption, nothing to complain about. But when you want to
> ENJOY a meal for pleasure, it's negative. I think the key problem could be the
> perception of rating label, and the math or algorithm should be smart enough
> to tune itself according to user rating behaviour."

I had proposed hardcoding 一般般 to a negative value. That is wrong for the
reason given: it bakes one person's scale into every palate. The engine should
learn where each person's neutral sits.

**Why it matters, from live data:** 56% of this palate's 41 ratings are the SAME
value (0.35 幾好食) and 95% are positive. `updateTaste` multiplies by the raw
score, so nearly every dim a dish teaches drifts positive — the engine learns
"you like everything", the opposite of a discriminating palate.

**Method** (`scripts/simulate-scale-calibration.ts`): replay the real 41-rating
history through the REAL shipped `updateTaste` twice — raw score vs score minus
the person's own running neutral point — then score both vectors on pairwise
ranking accuracy against what they actually rated. The centre is a **median**
(one furious −0.9 shouldn't move where "ordinary" sits), shrunk toward a prior
of 0 by k=5, and computed from history BEFORE each rating so it never peeks at
the value being learned. Prior 0 means a brand-new profile behaves exactly as
today and calibration only emerges with evidence.

**Result:**

| metric | current | calibrated | Δ |
|---|---|---|---|
| all pairs (n=522) | 76.1% | **80.8%** | **+4.8pp** |
| within-cuisine (n=161) | 72.7% | **75.8%** | **+3.1pp** |

Larger than the divisor fix, on the same metric. And it produces exactly the
behaviour the owner described, without anyone hardcoding a value — this palate's
learned centre is **0.311**, so:

| flick | raw | teaches |
|---|---|---|
| 掃晒 | 1.0 | +0.689 |
| 好鍾意 | 0.6 | +0.289 |
| 幾好食 | 0.35 | +0.039 (their normal — teaches almost nothing) |
| 一般般 | 0.1 | **−0.211 (negative)** |
| 唔啱我 | −0.5 | −0.811 |
| 唔會再食 | −0.9 | −1.211 |

The learned palate also becomes less lopsided: clear dislikes 2 → 3, clear likes
9 → 7, mean strength 0.308 → 0.204. Less extreme, better ordered — the positive
drift removed.

**Not yet shipped.** Implementation needs a decision on where the centre lives:
`replay.ts` can derive it from full history for free, but `/api/ratings` updates
incrementally and would need either an extra query over the user's scores or a
stored running value on `taste_profiles`. Both paths must agree exactly, or a
re-rate would silently produce a different profile than the incremental path.

**Caveat, same as everywhere else in this doc:** one palate, 41 ratings. The
direction is strong and the mechanism is principled (it removes a known
systematic bias rather than fitting a constant), but the magnitude is measured
on a single person.

## Fixture privacy note

`scripts/rating-history.json` is real user eating data and is **gitignored** —
this repo is public. Rebuild locally with `scripts/build-rating-fixture.ts`.
`scripts/seal-rows.json` was committed earlier (`0d851e0`) before this was
considered; it holds scores/cuisines/attribute vectors with no names,
restaurants, dates or user ids, but it is still a real person's meals and the
owner may want it removed.

---

# 11. Blast radius of the calibrated scale — the seal cannot band it (2026-07-25)

Implementing §10 surfaced a problem that the ranking metric alone hides, found by
the blast-radius check this batch made mandatory.

The calibrated vector ranks better (+4.8pp, §10) but is SMALLER: mean |strength|
per taught dim 0.308 → 0.204, and cuisine affinity now converges on ~0 because it
is an EMA toward a centred score. Both feed `contentScore`, which is exactly what
`sealStake.ts` bands into love/like/meh/dislike via `directionOf`. Measured on the
36 real seals (`scripts/simulate-scale-calibration.ts`):

| profile | hit | near | miss | calls | predicted_raw spread |
|---|---|---|---|---|---|
| current | 17 | 18 | 1 | like 28 · meh 8 | 0.006 → 0.378 (width 0.372) |
| calibrated | **5** | 23 | **8** | like 5 · meh 31 | −0.085 → 0.177 (width 0.262) |
| calibrated + centre restored | 20 | 14 | 2 | **like 36** | 0.226 → 0.489 (width 0.262) |

Read the `calls` column before the `hit` column. Calibration alone collapses
almost every prediction into `meh` — hits fall 17 → 5. Adding the person's centre
back (the exact inverse of the learning transform, so a relative prediction maps
onto the flick scale the seal is judged against) scores 20 hits, MORE than today —
but it calls `like` for all 36 seals. That is a constant, not a prediction; it
"wins" only because 20 of 36 real outcomes happen to be `like`. By the same
principle that governs recommendations, a predictor that cannot discriminate is
credibility theater, and its hit count is not evidence.

**The real finding is in the last column.** The band edges sit at −0.15 / 0.15 /
0.5, so a band is 0.35 wide. `contentScore`'s ENTIRE spread across 36 seals is
0.372 today and 0.262 once calibrated — comparable to, or narrower than, a single
band. Fixed four-band thresholds cannot express a distribution that thin. Today's
seal only varies at all because its range happens to straddle the 0.15 edge; and
this run independently reproduces the two known-open defects (`love` 0/11,
`dislike` 0/2 — both unreachable, max predicted 0.378 against a 0.5 edge).

So calibration does not break the seal so much as make an already-structural
problem undeniable: **the seal's absolute bands and `contentScore`'s dynamic range
were never compatible.** An offset only chooses which single band to be constant
in. Re-fitting the edges to these 36 rows is the overfitting §9c already ruled
out.

The honest direction — not costed, not simulated, deliberately not chosen here —
is per-user bands derived from the person's own predicted-score distribution
(§5c), which is the same self-calibrating principle the owner endorsed for the
rating scale, applied one layer up. That needs its own evidence run.

**Export gate — checked, and it is fine.** Centring pulls affinity toward 0 and
`tasteExport.ts` counts cuisines with affinity > 0, so this could have pushed the
export unlock backwards. Measured: confidence 0.883 → 0.842, still `solid`, still
unlocked; the exported cuisine list drops from 6 to 5 (loses `chinese`, the one
this palate feels most averagely about). Real but small, and arguably more honest.

**Limit:** the seal table above scores all 36 seals against one END-STATE profile,
because the seal-time vector was never stored — the same limit §5(d) declares.
It is a faithful profile-vs-profile comparison, not a replay of history. The
`current` column therefore differs from `simulate-seal-bands.ts`, which uses the
live profile snapshot instead of one replayed from `rating-history.json`.

---

# 12. Per-user prediction bands — the fix for §11 (2026-07-26)

§11 established that fixed band edges cannot carve `contentScore`'s distribution:
the edges are 0.35 apart, the whole spread is ~0.26, so predictions collapse into
whichever band the range overlaps. This section is the fix, measured before
shipping per the batch's own bar.

**The change.** `directionOf` still bands the ACTUAL flick (absolute, -1..1 — the
seal is a claim about the flick the person made, per the owner's call). A new
`predictedDirectionOf` bands the PREDICTION by quantile mapping: find where the
raw score sits in what the engine predicts across dishes this person has rated,
then read the flick value at that same position in what they actually flick, and
band that. Both distributions are recomputed live inside `stakeSeal` from data
already on hand — no stored state, no migration, and no way to drift out of step
with `SCORING_VERSION` (bumped to 3: the calibrated vector and the new banding
both change what a predicted band means).

**Why this isn't the fitting §9c ruled out.** Nothing is tuned against the 36 seal
outcomes. The mapping is fully determined by two distributions the person
generated themselves, so there is no free parameter to overfit. That is also why
`dislike` becomes reachable without anyone touching a band edge.

**Result on the 36 real seals:**

| scheme | hit | near | miss | bands used | calls |
|---|---|---|---|---|---|
| fixed edges (shipped) | 5 | 23 | 8 | 2/4 | meh 31 · like 5 |
| constant `like` (baseline) | 20 | 14 | 2 | 1/4 | like 36 |
| **quantile-mapped** | **20** | 16 | **0** | **4/4** | dislike 2 · meh 3 · like 20 · love 11 |

Read the baseline row before celebrating. A constant predictor scores 20 because
20 of 36 real outcomes are `like` — the trap §11 caught. Quantile mapping TIES it
on raw hits and wins on everything else that matters: zero misses instead of two,
all four bands in use instead of one, and `dislike` called 2/2 for the first time
in the project's history. Per-band: love 5/11, like 12/20, meh 1/3, dislike 2/2.

**Why the call distribution matches the real one exactly** (2/3/20/11 against
2/3/20/11): that is the mechanism, not a coincidence. Quantile mapping guarantees
the marginal, which means the seal can no longer be systematically miscalibrated —
it will predict `love` about as often as the person actually loves things. What
remains is purely whether the engine RANKS correctly, which is the honest thing
for the seal to be judged on.

**Does it generalise across rating styles?** The question more testers would have
answered, answered by simulation instead. Re-express the same outcomes onto other
rating styles, preserving ORDER so the engine's real discriminating power is held
constant and only expression changes:

| style | fixed | constant baseline | quantile | verdict |
|---|---|---|---|---|
| generous (≈real) | 4 | 20 | **23** | beats |
| harsh | 13 | 14 | 14 | ties |
| discriminating | 9 | 13 | 13 | ties |
| one-note | 5 | 30 | **34** | beats |

Never loses; beats on two; uses all four bands in every case while the constant
uses one and fixed edges never exceed two.

**Warm-up.** Hits when only the first k ratings are available to the mapping:
k=5 → 20, k=8 → 19, k=10 → 16, k=15 → 18, k=20 → 20, k=41 → 20. There is a dip
in the middle, but it is a dip relative to the CONSTANT baseline — against the
shipped fixed edges (5) quantile mapping wins at every k. So no warm-up gate was
added: it is strictly better than production from the seal gate upward, and
sharpens as history accumulates. It also degrades honestly rather than failing —
a one-note rater's flat actual distribution maps every prediction back to their
single flick, which is the truthful call.

**Honest limits.**
- Same end-state-profile limit as §5(d) and §11: the seal-time vector was never
  stored, so all 36 seals are scored against one profile. Faithful
  scheme-vs-scheme comparison, not a replay of history.
- The archetype test deliberately holds the preference ORDER fixed and varies
  only expression, which isolates banding from ranking. It therefore says nothing
  about whether the engine ranks well for OTHER people — that still needs more
  palates, and remains blocked on the same data ceiling as `MIN_SCORED_DIMS`.
- Ties rather than beats the constant baseline on the real palate's raw hit
  count. The case for shipping rests on zero misses, four live bands, and being a
  real prediction instead of a constant — not on the hit number alone.
