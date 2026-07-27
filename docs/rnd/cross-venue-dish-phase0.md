# Cross-venue dish resolution — R&D Phase 0 (2026-07-27)

**Question:** the execution slider needs "the same DISH at two restaurants," but
`dish_identities` is scoped to ONE restaurant by schema and by an explicit 400
guard in `/api/dishes/identity`. Before designing a cross-venue concept, is the
resolution even feasible?

**Answer: yes, adjudication is solved. Candidate generation is the open risk.**

Eval: `scripts/eval-cross-venue-dish.ts` (manual, makes real LLM calls).

## Result

30 held-out hard pairs, 15 true-same / 15 true-different, live model
(`qwen/qwen3.7-plus`):

> ⚠️ **The A-vs-B DIFFERENCE below was withdrawn in Phase 1 as run-to-run
> noise.** A second run reversed it (A 100%, B 96.7%). At n=30 the two prompts
> are indistinguishable. Read the arms as "both ~95-100%", not as a ranking.
> What replicates is the zero-false-merge column.

| arm | accuracy | precision | recall | false merges |
|---|---|---|---|---|
| A — shipped within-restaurant prompt, verbatim | 93.3% | 100% | 86.7% | **0** |
| B — purpose-written cross-venue prompt | 100% | 100% | 100% | **0** |

**Zero false merges in both arms** — the only dangerous error class, since a
wrong merge permanently fuses two dishes' rating histories.

## The hypothesis that was WRONG

Going in, the expectation recorded in the eval header was that arm A would fail
badly: its rules encode MENU-ITEM semantics ("any two items a restaurant would
price and serve separately" = different), and two restaurants always price
their own 乾炒牛河 separately. By the letter of that rule, arm A should have
answered "different" to everything.

It scored 93.3%. The model resolves the *intent* of the prompt against the
obvious purpose of the question, not the literal rule. **The prompt was less
load-bearing than predicted.**

Both arm A misses were recall failures in the SAFE direction, and both landed
under the shipped `CONFIDENCE_FLOOR = 0.75`:

- `絲襪奶茶` vs `港式奶茶` — conf 0.62. Two names for one drink with no shared
  characters.
- `白灼蝦` vs `白灼海蝦` — conf 0.70.

So the live pipeline would have declined both rather than mis-merged them. (Arm
B recovered both in THIS run — but see the Phase 1 correction: that advantage
did not replicate.)

## Method note — the first run was contaminated, and its number was discarded

The first test set shared most of its pairs with arm B's own worked examples
(乾炒牛河/濕炒牛河, 燒鵝/燒鵝髀飯, 蒜蓉黃油蝦/蒜蓉魷魚絲, 菠蘿包/菠蘿油,
烤串/烤豬肉串, 魚蛋粉/魚蛋河 …). It scored a meaningless 100% — an open-book
exam. The set was rebuilt so no dish appears as an example in EITHER prompt;
the contaminated set is kept in the script as
`RETIRED_CONTAMINATED_CASES` so the error stays on the record.

## What this does and does NOT establish

**Established:** given a PAIR of names, same-vs-different is decided at high
accuracy with no false merges, including adversarial cases — one-character
differences that flip the dish (`車仔麵`/`公仔麵`), no-shared-character synonyms
(`絲襪奶茶`/`港式奶茶`), shared-token different-protein traps
(`蜜汁叉燒`/`蜜汁燒排骨`), and word-order variants (`蝦仁炒蛋`/`滑蛋蝦仁`).

**NOT established — and this is now the real risk: CANDIDATE GENERATION.**
The eval handed the model the right pairs. Production has to FIND them. Within
a restaurant the pool is bounded (≤200 dishes, one menu); across all venues it
is unbounded, and N² adjudication is not affordable. Note that the hardest
positive in the set, `絲襪奶茶`/`港式奶茶`, shares **zero characters** — so a
string-overlap prefilter of the kind `candidateMatches()` uses would never
surface it as a candidate at all. Gate 1, not gate 2, is where this breaks.

**Other caveats:** n=30, so 100% should be read as "≥88% at 95% confidence,"
not literally perfect. Single model, single run, no variance measurement. The
test set and arm B's prompt were written by the same author, so shared blind
spots are possible even with string-level holdout.

## Proposed architecture (NOT built — needs owner sign-off)

Pairwise matching is the wrong shape at this altitude. Instead:

**A canonical dish catalog.** Each dish resolves ONCE to a canonical entry
(`乾炒牛河 / beef chow fun`), turning O(N²) pairwise adjudication into O(N)
classification. Cross-venue grouping then becomes a trivial join, and the
expensive LLM step happens once per dish rather than once per pair.

Why a fixed catalog is sufficient rather than limiting: **the long tail does
not need this feature.** Only dishes that RECUR across venues can be
execution-compared, and those are exactly the common ones. A catalog of a few
hundred common HK dishes covers the cases that matter; a one-off dish has
nothing to compare against by definition.

**Layering:** keep `dish_identities` (per-restaurant menu item) exactly as it
is and add `canonical_dish_id` on `dishes` directly — NOT above identity.
Identity only forms when two dishes at one restaurant look alike and a human
confirms, which with ~2.5 dishes per restaurant in the live corpus almost never
happens (3 identity rows exist in total). Hanging canonical resolution off
identity would inherit that starvation.

## Open product question that outranks the engineering

**Not every dish is execution-comparable, and the schema should say so.**
`壽司拼盤` at two shops is the same *name* but not the same *thing* — the
composition varies per shop, so "who makes it better" is barely meaningful.
`乾炒牛河`, `蝦餃`, `菠蘿油`, `雲吞麵` are standardized and genuinely
comparable. A canonical dish probably needs a `comparable` flag, and the
execution slider should only promise its A-vs-B payoff for dishes that carry
it. This is a product judgement, not an accuracy problem, and it should be
settled before the catalog is designed.

## Go / no-go

Against the standing ~50% bar: **technical feasibility ~80-85%, recommend GO on
Phase 1 (candidate generation), not on a build.**

Adjudication is proven. The catalog pattern is well-understood. The residual
risk is concentrated in candidate generation and in catalog coverage — both
measurable in a Phase 1 that needs no schema change:

1. Enumerate a candidate HK dish catalog and measure what share of the live
   corpus it covers.
2. Test retrieval (normalized key + embeddings) on the held-out pairs,
   especially the zero-shared-character cases that defeat string overlap.
3. Only then design the schema.

**Prerequisite the R&D cannot supply:** the live corpus has 2 clear cross-venue
true pairs in 73 dishes, so this feature cannot be validated on real data yet.
Deliberately eating one common dish (乾炒牛河, 蝦餃, 菠蘿油) at three or four
shops and logging each would create the first real ground truth — and unlike
anything in the social plan, one person can do it alone.

---

# Phase 1 — catalog resolution (2026-07-27)

**Question:** Phase 0 left candidate generation as the open risk. Can a
canonical catalog replace retrieval entirely?

**Answer: yes. The risk is retired.** Eval: `scripts/eval-catalog-resolution.ts`
against `scripts/hk-dish-catalog.ts` (141 entries at run time).

## Results

| measurement | result |
|---|---|
| Coverage of the live 73-dish corpus | **84.9%** (62/73) |
| Held-out pairs the catalog could decide | 29/30 |
| Correct, where it decided | **100%** (29/29) |
| **False merges** | **0** |
| Hallucinated / invalid catalog ids | **0** |

**The decisive result: `絲襪奶茶` and `港式奶茶` both resolve to `milk-tea`.**
That is the pair Phase 0 identified as provably unreachable by any
string-overlap prefilter — zero shared characters. Catalog resolution gets it
without a retrieval step at all, because there is no retrieval step to defeat.
Routing both sides of a pair through the catalog reproduced the pairwise
verdicts exactly, including every adversarial case (`車仔麵`/`公仔麵`,
`蜜汁叉燒`/`蜜汁燒排骨`, `蝦仁炒蛋`/`滑蛋蝦仁`).

Complexity drops from O(N²) pairwise adjudication to O(N) classification: one
LLM call per dish, ever, instead of one per candidate pair per check.

## CORRECTION to Phase 0 — the arm A/B difference was NOISE

Phase 0 reported arm A (shipped prompt) 93.3% vs arm B (cross-venue prompt)
100% and read that as arm B being better. A second run of the identical script
returned **arm A 100%, arm B 96.7%** — reversed.

At n=30 the two prompts are statistically indistinguishable; both sit around
95-100% with zero false merges in every run. **The Phase 0 conclusion that the
purpose-written prompt was an improvement is withdrawn.** Neither the ranking
nor the gap survives a second sample. Single-run comparisons at this sample
size should not be reported as differences again.

What DOES replicate across runs, and is the finding that matters: **zero false
merges, every arm, every run.**

## What the coverage misses look like

The 11 uncovered dishes were honest `"none"` answers, not wrong matches — the
model declined rather than stretching to a near neighbour, which is the safety
property the whole design depends on. They fall in three groups:

- **Compound plates** — `油雞髀腩仔飯`, `蛇羹潤腸飯餐`, `鵝腸豬潤撈麵`. A protein
  combination over a carb; effectively unbounded in variety.
- **Genuinely rare items** — `茶粒螺`, `魔鬼魚`, `冬菇棉花雞`.
- **Real catalog gaps** — `豬肉烏龍麵`, `火鴨翅`, and (from the pair set)
  `蒸水蛋`. These three were added after the run; **the 84.9% figure is
  PRE-patch** and was not re-measured.

Uncovered is not a failure mode. A dish with no catalog entry simply gets no
cross-venue identity, and by the design's own logic it does not need one —
rare dishes have nothing to compare against.

## Catalog growth — the one unsolved design question

A hand-written catalog does not scale on its own. `"none"` must have a path to
becoming an entry, and that path must not auto-mint (auto-minting recreates the
false-merge risk this design exists to avoid). Proposed: `"none"` dishes stay
uncanonical, frequent `"none"` clusters surface for periodic human review, and
only review promotes a cluster to a catalog entry. Cost is bounded because the
review is per-DISH-TYPE, not per dish.

## Revised go / no-go

**~85-90%, recommend GO on schema design.** Both original risks are retired:
adjudication works, and catalog resolution removes retrieval entirely with zero
false merges across every run.

Remaining, in order:

1. **The `comparable` flag is still an open PRODUCT question** and should be
   settled before the schema. `壽司拼盤` at two shops shares a name but not a
   thing. Flags in `hk-dish-catalog.ts` are a proposal for review, not settled.
2. **Catalog growth policy** (above) — design, not research.
3. **Still unvalidatable on real data.** 2 clear cross-venue pairs in 73 live
   dishes. Eating one common dish at 3-4 shops and logging each remains the
   fastest way to create real ground truth, and one person can do it.

---

# Owner decisions + Phase 2 setup (2026-07-27)

## 1. `comparable` is SETTLED — everything is comparable, and the flag dies

**Owner's rule: if a dish is common enough that different restaurants offer it,
then a "set" is itself a dish in the customer's mind.** 壽司拼盤 and 車仔麵 vary
in composition shop to shop, but a diner absolutely uses them to judge which
restaurant is better — which is exactly what execution comparison measures.

All 14 `comparable: false` entries were flipped to true; the catalog is now
uniformly true.

**Consequence: do NOT put a `comparable` column in the schema.** It would be
true for every row. The question was worth asking and is now answered; carrying
the field forward would be dead weight.

**Separate problem the flag was MUDDLING — still open.** Two of the 14 were not
assorted dishes but GENERIC CATEGORIES: `炒飯` (fried rice) and `燉湯`
(double-boiled soup). A category entry is a false-merge magnet — 揚州炒飯 and
帶子炒飯 are different dishes that could both collapse onto 炒飯, which is the
exact dangerous error this design exists to prevent. Categories should probably
not be catalog entries at all, with the resolver returning "none" instead. The
Phase 2 resolver prompt now says so explicitly; the catalog entries themselves
have NOT been removed. Decide during schema design.

## 2. Cost and latency — the steady state is a backend match, as hoped

Owner asked whether the catalog means no extra LLM request per menu scan or
rating. Accurate answer:

- **Comparison itself is always free.** Two dishes are the same iff
  `canonical_dish_id` matches — an integer comparison, never a model call. This
  is the part that matters at read time, and it costs nothing.
- **Resolution costs one call per unique dish NAME, ever — not per scan, not
  per rating.**
- **It need not be a NEW request.** `enrichOneDish` (src/lib/menuScan.ts:437)
  already makes a `callClaude` per dish today. The canonical id becomes another
  field in that existing call's output: same request, same latency, marginal
  extra tokens.
- **An alias table then removes even that.** Once `日式舒芙蕾鬆餅 →
  souffle-pancake` is resolved, store it; every later occurrence of that string
  is a DB lookup. On a normalized key (fold 繁/簡, strip 招牌/例牌/大細) the hit
  rate climbs quickly, because menu names repeat heavily across venues.

So the end state is a backend string match with no LLM and no added load time.
It is not that on day one: a genuinely novel spelling still costs one call.

## 3. Phase 2 — testing at scale WITHOUT more users

**Correction to an assumption made in conversation:** "scan 20 menus in the app
and you'll have hundreds of names to test against" is WRONG. The menu-scan
route persists nothing — scanned menus live in memory only
(`src/lib/scanSession.ts`, deliberately: they must die on refresh), and only
dishes the user PICKS become rows. `restaurant_menu_items` is empty; the 73
dishes are the entire real name corpus in the DB.

**What actually works: run the scan pipeline offline on menu PHOTOS.**
`scripts/eval-menu-corpus-coverage.ts` calls the same `scanMenuSkeleton` the
app uses, straight off image files — no app change, no DB writes, no picking,
and no eating. Photograph shop windows and takeaway flyers; 15-20 menus is a
real sample. Vision results are cached so re-running the analysis is free.

It measures the three things still unknown:

1. **Coverage at real scale**, weighted by how often a name actually appears.
2. **The cross-venue base rate** — how often the same canonical dish appears
   across different menus. This is the number the entire feature rests on, and
   it is the one previously guessed at rather than measured.
3. **Resolution consistency** — which distinct spellings fold onto one id,
   printed in full for eyeballing, because every one of those merges would
   become permanent.

**On synthetic data:** rejected as evidence. A mock corpus would be generated
by the same model family doing the resolution, so shared blind spots would
flatter the result. Usable as a smoke test only. Real menus are strictly better
and barely more effort.

**Still needs eating, later:** execution comparison itself needs ratings, so
eating one common dish at 3-4 shops remains necessary — but for a different
question than coverage, and after the schema exists.
