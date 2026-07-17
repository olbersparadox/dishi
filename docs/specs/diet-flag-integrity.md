# Spec: Diet-flag integrity v2 (the 雞扎 problem)

**Tier:** Sonnet (design decided here; implementation from this spec).
**Priority:** top of Now — trust-critical. 雞扎 currently shows 豬肉+牛肉 chips
and no chicken. Users read chips as an ingredient list; one absurd chip and they
stop believing every chip in the app.

## Design principle (do not regress to v1)

Chinese food names lie at the surface: 菠蘿包 has no pineapple, 田雞 (frog)
contains 雞, 牛油(果) contains 牛. Therefore **string matching may never author
a flag** — the same lesson dishIdentity.ts encodes for dish matching. Strings
are only a TRIPWIRE that triggers a knowledge-based re-check. The food
knowledge lives in the enrichment LLM; the fix is grounding it and verifying it.

## Root causes

1. `DIET_FLAGS` cannot express poultry — schema forbids the right answer.
2. Enrichment prompt lets the model assert flags directly from a name, with no
   recipe grounding and no verification.
3. Flag list hand-duplicated across 3 prompt strings (menuScan.ts + vision.ts x2).
4. The already-harvested `ingredients` field is never displayed — the knowledge
   that would make dishes look SMART is sitting unused in the data.

## Changes

### 1. Taxonomy: 7 → 13 flags
`DIET_FLAGS`: add `chicken`, `duck_goose`, `lamb`, `egg`, `dairy`, `offal`.
i18n (zh/en): 雞肉/Chicken 🐔 · 鴨鵝/Duck & Goose 🦆 · 羊肉/Lamb 🐑 ·
蛋/Egg 🥚 · 奶類/Dairy 🥛 · 內臟/Offal (pick a tasteful emoji or none).
Emoji mapping wherever the existing 7 are mapped. Keep the vocabulary CLOSED.

### 2. Recipe-grounded enrichment (all 3 prompt sites)
Restructure the diet portion of the prompts (menuScan enrich, vision main,
vision anchored) to a chain:
1) List the dish's REAL typical ingredients as classically prepared (this
   feeds the existing `ingredients` output — keep its 4-item cap).
2) Derive diet flags ONLY from that ingredient list — never from surface words
   in the name.
3) Include the trap classes verbatim as guidance: "菠蘿包 contains no
   pineapple; 田雞 is frog, not chicken; 牛油 is butter, not beef. Figurative
   names are common — reason from the recipe, not the characters."
Also: build the flag list in every prompt from `DIET_FLAGS.join(', ')` —
single source of truth, ends the hand-duplication.

### 3. Tripwire + re-ask (strings never author)
New pure function `dietSuspicion(name, name_zh, flags, ingredients): boolean`
in `src/lib/menuScan.ts` (exported, unit-tested). Raises suspicion when:
- a protein morpheme in the name (雞/牛/豬/蝦/魚/羊/鴨/鵝/蛋 or EN equivalents)
  has no corresponding flag AND no corresponding ingredient, OR
- a protein FLAG exists with no support in either the name or the ingredients.
On suspicion at enrichment time: ONE re-ask of the same enrich call with an
appended line: "Double-check the diet flags against the dish's classic recipe;
correct any flag that does not belong." Accept the re-ask's answer as final —
even if the tripwire would still fire (菠蘿包 legitimately keeps no pineapple-
related change; the tripwire is advisory, never authoritative).
Budget: max 1 retry per dish; skip retry entirely in mock mode.

### 4. Surface `ingredients` in DishInfoDisplay
Quiet text line under the chips: "雞肉 · 火腿 · 魚肚 · 冬菇" style ( · joined,
card-meta styling). Only when non-empty. Ingredients are lowercase English in
storage today — display as-is for now; bilingual ingredient names are a
separate, later item (note in BACKLOG, do not build).

### 5. Bounded backfill for stored rows
One-off script (`rnd/` or `scripts/`): run `dietSuspicion` over stored dishes
and restaurant menu items; re-enrich ONLY the suspicious subset (bounded LLM
cost). Report counts before/after. Run manually once after deploy; not a cron.

### 6. Tests (`tests/dietFlags.test.ts`)
- dietSuspicion fires: 雞扎+[pork,beef]+no chicken anywhere → true.
- dietSuspicion does NOT fire: 燒賣+[pork]+ingredients [pork,shrimp] → false;
  菠蘿包+[]+ingredients [flour,butter,sugar] → false (no pineapple flag exists
  to contradict); 田雞 with flags []+ingredients [frog legs] → MUST NOT demand
  chicken (this is the key anti-regression case — encode it).
- Flag sanitizer accepts the 6 new values; i18n parity for new keys.

## Acceptance
- tsc clean; npm test green.
- Manual: 雞扎 rescanned → 🐔 chip + ingredients line showing the classic
  recipe; 菠蘿包 scanned → no meat chips, no false additions.

## Out of scope (BACKLOG notes)
- Bilingual ingredient display.
- Further taxonomy growth (gluten, soy, nuts-general) — needs its own pass.
