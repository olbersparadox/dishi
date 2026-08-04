# Data audit — what vision extracts vs what the engine actually uses

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
