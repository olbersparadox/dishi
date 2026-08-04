# Data audit — what vision extracts vs what the engine actually uses

> **STATUS: owner-signed-off 2026-08-04.** The ingredients backfill it
> recommended was approved and run the same day (see "Backfill" at the end).
>
> ⚠️ **The backfill uncovered a LIVE PHOTO-VISION OUTAGE — see the section at
> the end of this document. Photo dish logging is currently broken in
> production.** It is unrelated to the audit's findings but was found by it.

BACKLOG item 1 (owner, 2026-08-02: "i'm surprised Vision has carried so little
data over… review how much data are we actually using, and what else we could
be using"). Audited 2026-08-04 against the LIVE schema and the real pipeline
(per-source column population on real rows), not the repo's descriptive SQL.
**No code ships from this document until the owner has reviewed it.**

## The table

E extracted · S stored · A aggregated per user · L learned from · U shown to user

| signal | E | S | A | L | U | notes |
|---|---|---|---|---|---|---|
| 18-dim attributes | ✓ | ✓ `dishes.attributes` | ✓ taste vector (EMA + replay) | ✓ | ✓ blob/radar/menu match | the one fully-used signal |
| cuisine | ✓ | ✓ | ✓ affinity EMA | ✓ | ✓ | fully used |
| **diet flags** | ✓ | ✓ `dishes.diet`, **100% of enriched rows incl. all historical** | ✗ | ✗ | ✓ chips | **the sleeper.** The 15-flag vocabulary IS a protein/domain vocabulary: pork·beef·lamb·offal (陸), chicken·duck_goose (羽), seafood (海), shellfish (甲殼), veg·soy·peanut·tree_nut (田), egg, dairy, spicy |
| ingredients (≤4) | ✓ | ✓ column — but **photo rows predating the write lack it** (8/55 album vs 36/46 table, 3/3 scan) | ✗ | ✗ | ✓ chips + growth-screen absorb words | `vision.ts:27` comment "NOT a stored column" is STALE — it is, and `/api/dishes` writes it. Sole persisted signal for 菌 fungus (冬菇/金菇/蠔菇 in glossary) and 龍蝦-vs-蟹 depth |
| cooking_method | ✓ | ✓ (54/55, 38/46, 3/3) | ✗ | ~ (method DIMS learned separately via attributes) | ✓ | column itself only display/dedup |
| heaviness | ✓ | ✓ 100% enriched | ✗ | ✗ | ✓ | stored on every enriched dish, aggregated nowhere — 輕/重 axis + 脂角 candidate |
| dishStructure protein/base | ✓ parse at canonical-merge | ✗ | ✗ | ✗ | ✗ | ephemeral, exactly as the R&D memory says: computed then discarded. PROTEINS enum maps 1:1 onto the taxonomy; BASES (rice/noodle/congee/bread/pasta/dumpling_skin) is the 榖 register answer |
| eaten_at / hour-of-day | ✓ EXIF/now | ✓ 100% | ✗ | ✗ | ✓ 食記 | feeds 罪角 (the only time-of-day feature) — data already there |
| execution_score, voice_attributes | ✓ | ✓ ratings | — | ✓ read by replay | ✓ | fine |
| price | ✓ scan only | ✓ `restaurant_menu_items` | ✗ | ✗ | ✓ menus | not on photo dishes; price-vs-satisfaction not derivable for photo path |
| repeat-order signal | derivable (ratings × dish_identity) | — | ✗ | ✗ | ✗ | never derived; strongest un-mined rec signal |
| portion / temperature / sauce family | ✗ | — | — | — | — | never extracted; would need prompt changes |

## Pipeline discrepancies found while auditing

1. `vision.ts:27` says ingredients is "NOT a stored column" — stale; the live
   schema has `dishes.ingredients` and `/api/dishes` writes it. Comment should
   be fixed whenever that file is next touched.
2. `reviseDishFromPhoto` (name-correction re-derive) returns attributes/
   cuisine/diet/method/heaviness but **not ingredients** — a corrected dish
   keeps the wrong dish's ingredient chips. Minor today; matters once
   ingredients feed the creature.
3. Historical photo rows (47/55) predate the ingredients write. `diet` does not
   share this gap — it was backfilled — which is part of why it's the primary
   classifier signal below.

## Recommendations

### (a) Creature domain evidence — computable TODAY, no new extraction

Classifier per rated dish, first-hit priority:

1. **diet flags** (100% coverage, closed vocab, incl. historical rows) →
   depth-1 domains + 甲殼 directly;
2. **ingredients** (new rows + 8 legacy) → 菌 fungus, 藻 algae, and 龍蝦/蟹/蝦
   sub-nodes ('lobster'/'crab'/'crayfish'… already in menuScan's
   SEAFOOD_INGREDIENT_KEYS);
3. **name morphemes** — menuScan's PROTEIN_TRIPWIRE + SEAFOOD_MORPHEMES
   vocabulary (蟹/龍蝦/蝦/牛/豬/雞/鴨/鵝/羊…) re-used read-only on dish names;
4. **dishStructure parse** where a canonical merge already ran it.

Aggregate: per-user `domain_evidence` (the `DomainEvidence` shape already in
`creatureForm.ts` — liking-weighted counts + sub-node mixes), persisted with
taste_profile_version, **rebuilt inside `replay.ts` by widening the line-59
select** (`dishes(attributes, cuisine, …)` → `+ diet, ingredients, name,
name_zh, cooking_method, heaviness, eaten_at`) — replay-safe by construction,
recency half-life ~3–4 months per the metabolism rules.

Detector readiness by node: 海/陸/羽/田/甲殼 **ready** (diet flags);
牛/豬/雞/鴨鵝 **ready** (diet + morphemes); 龍蝦-vs-蟹 **mostly ready**
(ingredients + morphemes; undifferentiated "shellfish" falls back to parent —
which the framework already allows: a wrong claw is worse than no claw);
菌 **ready on new rows only**; 藻 **gap** (no seaweed morphemes in any vocab
yet — small closed list to add); 蟲 stays off per framework.

### (b) Recommendation quality

Un-mined, in value order: repeat-order signal (same identity re-rated / re-
logged = the strongest preference statement we hold); execution slider data as
per-venue quality prior (already stored, already replayed); heaviness×score as
a 濃/清 tiebreak on menu matching. None block the creature; separate items.

### (c) Palate export

Currently exports dims + cuisines + dishes only. Cheap, honest additions once
the aggregate exists: top-liked **ingredients** ("keeps coming back to 蟹,
冬菇"); **heaviness lean** (light-vs-heavy over rated history); domain shares
themselves ("eats sea-forward"). Diet flags must NOT export as allergies —
they are dish properties, not user constraints.

## Success probability (for the ~50% go/no-go bar)

- Phase-2 aggregate + creature wiring: **~85%** — mechanical fold over columns
  that exist, replay path identified, renderer already fails closed.
- Depth-2 龍蝦-vs-蟹 detector quality: **~65%** — morphemes+ingredients cover
  the common HK cases; ambiguous rows fall back to the parent node honestly.
- 藻/菌 full coverage without backfill: **~50%** — gated on ingredients, which
  historical photo rows lack; optional one-shot vision backfill of 47 rows
  would lift it, decision deferred to owner.

---

# ⚠️ LIVE OUTAGE: photo vision returns nothing (found 2026-08-04)

Found while running the ingredients backfill. **Unrelated to the audit's
findings — but it breaks the app's core logging flow, and it is live now.**

## Symptom

Every photo-vision call returns HTTP 200 with `content: null`. The model spends
its entire completion budget on reasoning tokens and emits no answer:

```
finish_reason: "length"   completion_tokens: 401
completion_tokens_details.reasoning_tokens: 400   content: null
```

`inferDish` treats a null as a failed call and returns the
`{ name: 'Unknown dish', vision_failed: true }` placeholder (vision.ts:141).
So **the next photo the owner logs will come back "Unknown dish"** with no
cuisine, no attributes, no diet flags — and, because attributes are empty, it
teaches the taste engine nothing.

## What was ruled out

| hypothesis | test | result |
|---|---|---|
| token budget too small | same call at 400 / 500 / 1500 / 3000 | reasoning consumed **the entire budget every time** (`reasoning_tokens == max_tokens`); never any content. Not a budget problem |
| one bad image | 5 different dish photos, newest first | 5/5 identical failure |
| one bad prompt | both `SYSTEM` (inferDish) and `ANCHORED_SYSTEM` | both fail identically |
| provider-specific, route around it | `provider: { ignore: ['Alibaba'] }` | **HTTP 404 "All providers have been ignored"** — `/models/qwen%2Fqwen3.7-plus/endpoints` reports exactly **1 endpoint, Alibaba**. The documented ignore-list lever does not exist for this model |
| our regression | `git log` on vision.ts / openrouter.ts | no relevant commit; last successful photo log was 2026-08-02 (3 rows, conf 0.95, ingredients present). Provider-side change, same shape as the degradation already documented in openrouter.ts |

`reasoning: { enabled: false }` **restores correct answers immediately**
(`finish: stop`, `reasoning_tokens: 0`, correct ingredients).

## Why this is not simply fixed with reasoning-off

The 2026-07-29 A/B recorded in `openrouter.ts` rejected reasoning-off for
production: the **diet-flag derivation discipline collapses** without it
(9/35 dishes broke the soy rule; カキフライ lost `shellfish` while its own
ingredient list still said "oyster"). Allergen flags feed the tripwires, so
that is a safety regression, not a style one.

Note the asymmetry, which is what made the backfill safe: **ingredient
extraction survived reasoning-off in that same A/B** — what broke was deriving
flags FROM the ingredients. The backfill writes only `ingredients` and never
reads or writes `diet`, so the one known casualty is out of its scope.

## The decision (owner's — not taken unilaterally)

`ignore: []` in openrouter.ts is a documented owner decision (2026-07-31) whose
own bar for re-arming is *"a provider seen failing vision calls repeatedly
across days… one bad answer is weather; the logs are climate."* This is one
day, and in any case exclusion is impossible (single endpoint).

**UPDATE, same day, after measurement — the original recommendation below is
withdrawn.** Two of its premises failed under test:

- "`enrichOneDish` still works" was FALSE — the text path fails identically
  (it was assumed, not tested; the probe that would have caught it took one
  minute). Scope is ALL LLM calls, not vision.
- Reasoning-off does NOT hold flag discipline on today's model. Re-ran the
  July A/B's question over 22 real rated dishes + 4 objective canaries
  (scripts/eval-flag-discipline.ts): identical flag sets 5/22, spurious `soy`
  added 8× (龍蝦刺身 and 炒蝦 flagged soy — the seasoning rule breaking,
  exactly the July failure), real protein/allergen flags lost 6× (蝦餃 lost
  pork), canaries 豉油雞 and 照燒雞 both FAIL on spurious soy. The one
  passing spot-check (カキフライ) was real but unrepresentative — the lesson
  is the same as ever: one case is weather.
- "Raise max_tokens" also dies, on LATENCY not cost: with an 8000 cap the
  real prompts ran past two minutes; enrich's budget is 12s and Vercel's 60s.
  (Cost was never the issue — reasoning tokens were ALWAYS billed; July's
  working calls already paid ~2394 thinking tokens each. Today's broken calls
  still bill a full cap of thinking and return nothing.)

**SECOND UPDATE, same day — every remaining door measured on the same
instrument** (scripts/eval-flag-discipline.ts: 22 rated dishes + 4 objective
canaries; the soy canaries verified against DIET_PROMPT_GUIDANCE's own text —
"soy sauce as a seasoning alone NEVER fires this flag"):

| configuration | identical | spurious soy | lost flags | soy canaries | p50 |
|---|---|---|---|---|---|
| qwen3.7-plus, reasoning off | 5/22 | 8 | 6 | both FAIL | **2.5s** |
| qwen3.7-plus, think budget 300 | 4/22 | 11 | 6 | both FAIL | 7.7s |
| qwen3.7-plus, think budget 600 | 4/19 | 7 | 5 | both FAIL | 12.6s |
| qwen3.7-plus, think budget 1000 | 7/19 | 7 | 4 | both FAIL | 19.5s |
| qwen3-vl-32b-instruct | 8/22 | 8 | 7 | both FAIL | 1.4s |
| qwen3-vl-8b-instruct | 1/22 | 12 | 14 | both FAIL | 1.0s |
| mistral-small-3.2 | 6/21 | 4 | 8 | both FAIL | 4.7s |
| google/openai/anthropic models | — | — | — | — | 403 (account wall, the Aug-1 ToS/regional block) |
| unbounded thinking (July's regime) | July's quality | — | — | passed then | **>2 min now** |

Findings that settle it:

- The endpoint DOES respect an explicit `reasoning: { max_tokens }` budget now
  (consumes exactly the budget, then answers — CallOpts extended to allow it).
  But capped thinking buys NOTHING: discipline is flat-to-worse across
  300–1000 while latency triples to octuples. July's discipline lived in
  UNBOUNDED thinking specifically, and that now costs minutes.
- No reachable configuration passes the soy-seasoning canaries today. The
  July A/B's premise — that a discipline-holding configuration exists to
  protect — no longer describes reality. Some STORED baselines are themselves
  noisy on the soy rule (花雕麻油雞湯麵 stored `soy`), so the identity column
  understates every arm; the canaries are the honest signal.
- **Recommendation: `reasoning: 'off'` globally.** It is not a trade against a
  working alternative anymore — it is the best point on every axis at once
  among options that exist: fastest (2.5s vs July's ~16s enrich), cheapest
  (~0 thinking tokens vs ~2400 billed per call in July), and its flag quality
  is comparable to every other reachable arm. Production's tripwire re-ask
  (dietSuspicion) stays as the safety net and fires on the suspicious rows.
  Owner's call — it reverses the 2026-07-29 verdict, but that verdict's
  premise is gone.

Ship path note: this does **not** block 墨靈 phase 2. Domain evidence is
computed from ALREADY-STORED columns over rating history, so the aggregate can
be built and backfilled while vision is degraded.

---

# Backfill — executed 2026-08-04

`scripts/backfill-ingredients.ts` (dry-run by default, `--apply` to write,
`--limit N` to bound a first pass). Owner-approved off this audit.

- **Scope:** 49 rows — 47 album + 2 table — every row that lacked `ingredients`
  AND had a photo. All 49 are rated, so all feed the aggregate. The other 8
  ingredient-less rows are unrated table picks with no photo: unreadable by
  vision and irrelevant to the aggregate, correctly skipped.
- **Writes `ingredients` and nothing else.** Re-deriving `attributes` would
  retroactively rewrite what the taste engine learned from these ratings (the
  vector is replayed over stored attributes), i.e. silently rewrite the
  person's palate. This script must never widen.
- **Guards:** anchored on each dish's stored name (may be human-corrected —
  HUMAN outranks VISION); an empty/failed read SKIPS rather than writes (the
  2026-07-23 lesson that wiped real diet flags); the UPDATE re-checks emptiness
  in its own predicate, so a re-run or a concurrent write can never overwrite
  real ingredients.
