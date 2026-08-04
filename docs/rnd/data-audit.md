# Data audit — what vision extracts vs what the engine actually uses

> **STATUS: owner-signed-off 2026-08-04.** The ingredients backfill it
> recommended was approved and run the same day (see "Backfill" at the end).
>
> ℹ️ This document briefly reported a LIVE PRODUCTION OUTAGE. **That report was
> wrong — production was healthy throughout.** The real finding was a 26-day
> local/production model divergence; see "The env divergence" below, which is
> worth reading for the diagnostic failure as much as the fix.

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

# The env divergence — what the "outage" actually was (2026-08-04)

**There was no production outage. Production was healthy the entire time.**
This section replaces an earlier one that reported a live outage; that report
was wrong, and the way it went wrong is the useful part.

## The finding

`OPENROUTER_MODEL` has been set in Vercel since **2026-07-09** to
`qwen3-vl-32b-instruct`, a NON-thinking vision model. `.env.local` (untouched
since 2026-07-07) never received the variable, and `openrouter.ts` carried
`process.env.OPENROUTER_MODEL || 'qwen/qwen3.7-plus'` — so **every local run,
probe, eval and A/B for 26 days silently exercised a THINKING model that
production had not used since July.**

Nothing broke on Aug 2. What changed around then was the provider's
thinking-token accounting: `max_tokens` began bounding thinking+answer
together, so the local-only model started spending its whole budget on
reasoning and returning empty completions. That looked exactly like a
production outage and was diagnosed as one — for hours — while production
served scans normally.

## The evidence that settled it

- Production runtime logs, during the same hours: `model=qwen3-vl-32b-instruct`,
  `scan-telemetry lang=japanese items=9 enrich=p50:3342 fail:0of9`,
  `lang=chinese items=6 fail:0of6`. Zero failures.
- Owner field test: a Japanese menu scanned end-to-end with full chips,
  heaviness, and a personalised hook line — the exact surfaces reported dead.
- Local, same minutes, same code: `inferDish -> "Unknown dish"`,
  `enrichOneDish -> []`.

## Why it took a field test to catch

Every local probe shared one hidden variable (the local env), so ~20
"independent confirmations" were one measurement repeated. The falsifying
instrument — `scan-telemetry` in Vercel logs — is prescribed in CLAUDE.md as
step ONE of any scan diagnosis, and was reached for last. **A claim about
production requires production telemetry; local probes can only ever support a
claim about local.**

## What was changed in response

1. `.env.local` now pins `OPENROUTER_MODEL` to production's value.
2. **The fallback is deleted.** An unset `OPENROUTER_MODEL` now `console.error`s
   `FATAL CONFIG` and throws, rather than silently choosing a different brain.
   (The shout matters: callers turn exceptions into a quiet `null`, which is the
   same silent-degradation shape that hid this for 26 days.)
3. `scan-telemetry` now logs `model=` beside the scan's own numbers, so
   environment drift is visible at a glance in the logs that already exist.
4. The reasoning A/B comment in `openrouter.ts` is annotated: it measured
   qwen3.7-plus, i.e. **not the shipped model**, so its conclusions do not
   describe today's app. Today's model is non-thinking and has no reasoning
   behaviour to tune.

## What this invalidates

Every measurement in this document's earlier "outage" section, and the entire
model/reasoning sweep run on 2026-08-04, was performed against qwen3.7-plus —
not the shipped model. `scripts/eval-flag-discipline.ts` remains valid as an
instrument (it reads `OPENROUTER_MODEL`, so it now measures the real thing),
but its recorded RESULTS are void. Notably, its "candidate" arm
`qwen3-vl-32b-instruct` was production's own model being benchmarked against
baselines that model had itself written.

**No production change is needed. No reasoning flip, no model change, no cap
change.**

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
