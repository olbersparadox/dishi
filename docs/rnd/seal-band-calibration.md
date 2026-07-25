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
