# Dishi Backlog

Single source of truth for outstanding work. Triage/specs happen in the Claude
Project; execution happens in Claude Code. When an item ships: check it off with
the commit hash. When a new item is decided anywhere: add it here and push.

Model tier per item: **[S]** = Sonnet (well-specified build) · **[F]** = Fable/Opus
(design decisions, entity resolution, diagnosis).

## Now

- [ ] **[S] 語言對 fixes (live-test failures).** Japanese-menu acceptance test
  fails on ec16af0: scan z-instruction never received the katakana/false-friend
  hardening (it landed only in nameTranslate.ts), and bilingual menus defeat
  menuLanguageToCode so the foreign-secondary preset never fires. v2: prompt wording alone is unreliable on the skeleton model (qwen) — add the
  kana/hangul tripwire that re-authors z through the proven translate path, plus
  chip label-dedupe.
  Full spec: `docs/specs/language-pair-globe-fixes.md`.
- [ ] **[F] dishi — your AI palate (export redesign).** Replace "prompt export"
  with a persona: the user's palate, unlocked (not given) once the engine
  genuinely knows enough, written in a user-chosen voice, leveling up as the
  engine learns — each version visibly knows MORE (dishes, dates, places,
  home-cook patterns). Unified confidence-as-level bar with honest endowed
  progress on day 1; day-1 export locked, album-logging tutorial as the fast
  path to first unlock. Engine-adjacent (buddy level rebase) — use Opus.
  Full spec: `docs/specs/dishi-palate-export.md`.
- [ ] **[S] OTP login (kill the magic-link browser trap).** Code-as-hero email,
  `autoComplete="one-time-code"` for iOS keyboard autofill, code entry as the
  primary login path. Mostly template + a few lines; verifyOtp path already
  exists. Full spec: `docs/specs/otp-login.md`.

## Next

- [ ] **[S] Bilingual ingredient display.** The ingredients line under the diet
  chips (DishInfoDisplay) shows lowercase English as stored today. Give ingredients
  a zh/en pair so the line reads native in Chinese-first mode. Deferred out of the
  diet-flag-integrity work; needs its own small vocabulary/translation pass.
- [ ] **[F] Diet taxonomy growth (gluten, soy, nuts-general).** The 雞扎 fix took
  DIET_FLAGS from 7 → 13 (added poultry/lamb/egg/dairy/offal). Further allergen
  axes are real but each needs its own recipe-grounding thought — do NOT bolt them
  on ad hoc; keep the vocabulary closed and deliberate.
- [ ] **[S] Seal at pick time.** Move seal creation (`POST /api/seals`) from
  queue-load to the pick-confirm moment on the scan page, so the prediction is
  committed when the user ORDERS, not when they next open the Taste tab.
  Strengthens the honesty framing; small change, endpoint already idempotent.
- [ ] **[F] 食記 ordering for album logs.** Old camera-roll photos have a fuzzy
  eaten-date; decide: order journal by when-eaten vs when-logged, and how to
  capture an approximate eaten-date at log time without adding friction.
  Design conversation first — do not build straight from this line.

## Later / standing

- [ ] **Strategy: consumer scan density.** One dense neighborhood before
  expanding; no friend graph at this stage. Not a code item.
- Brainstormed, NOT confirmed (do not build): weekly recap card · web push
  re-entry triggers · revisit prompt ("would you order it again?") · 地雷
  dealbreaker probe · 排個名 restaurant mini-ranking · tempt-duel at scan time ·
  cold-start popularity ranking for profileless users · reverse taste import.

## Done (recent, for context)

- [x] **語言對 — the globe picker (language-pair dish names)** — pair state +
  globe UI + on-the-fly translation; persisted dishes.names cache + scan prompt
  hardening; foreign-scan preset + printed-original fidelity rule + langPair
  tests. `c28ae7a`, `d7112a5`, `ec16af0` (supersedes the standalone
  multilingual-scan-hardening idea; also absorbs the old "taste export recurring
  loop" open question — that loop is now designed into the palate export above)
- [x] **對決 — pairwise taste duels** — learning math (pairwise logistic on the
  attribute contrast) with a 揀唔落 tie signal, active pair selection, GET/POST duel
  API (prediction sealed server-side), header notification bell + floating card,
  merged into replay. Simulation-tuned: the spec's p-formula flatlined the error
  signal (contentScore ÷18 → p≈0.5), corrected to the un-normalized Bradley-Terry
  logit (K 4→2); tie weight tuned to 0.2. Sim (5 seeds × 30 users): overall ranking
  no degradation, low-evidence-dim sign accuracy +2.2pp. `3291d42`, `d590264`
- [x] Vision reliability: retry unparseable responses + honest "couldn’t read"
  card for true failures (was silently logging "Unknown dish" as is_dish:true).
  `82089d8`, `b1e76c4`
- [x] Diet-flag integrity fix (雞扎 problem) — taxonomy 7→13, recipe-grounded
  enrichment, dietSuspicion tripwire, ingredients line surfaced, bounded backfill
  script. `52fd013`
- [x] Three-path log entry (餐廳菜/屋企煮/相簿舊相) — landed in the same commit
  as the diet-flag fix. `52fd013`
- [x] Sealed-bet mechanic end-to-end + RLS/admin-client fix (印 stamp live in prod)
- [x] Scan persistence across tab switches (`src/lib/scanSession.ts`)
- [x] Taste tab redesign: black radar, bold top-3, progress bar, stat sizing
- [x] Owner menu authority tier + `tests/ownerMenuReconcile.test.ts`
- [x] dishes.source constraint widened live (fixed silent no-photo log failure)


# Backlog additions — 2026-07-20 (restaurant picker ×3 + HK menu shorthand)

Context: real field session at Tin Wan, 2026-07-20 ~13:49 HKT. 新容記 (well-known,
user was standing in it) absent from the picker chips; typing it and tapping 加入
produced no visible result; Vercel logs confirm `/api/dishes/pick` was never
called — the picks were lost. Same scan: 干炒牛河 shipped with a 飯 ingredient
chip and the literal English "Dry Fried Beef River"; a separate menu's 炆米 came
out as 炆飯.

---

## 1. Picker: 加入 must produce visible selected state — *(Sonnet)*

**Bug class:** silent success indistinguishable from silent failure.

In `src/components/RestaurantPicker.tsx`, a successful `createNew()` sets
`selectedKey='manual-new'` — which corresponds to no rendered element — and
leaves the add form open, input untouched. Nothing on screen changes. Users
reasonably conclude the tap failed and cancel, discarding the staged choice.
Two additional genuinely-silent paths exist: `confirmNew()` returns wordlessly
when `coords` is null, and the `namesMatch` same-place nudge can render below
the iOS keyboard.

**Changes:**
- On `createNew()`: collapse the add form and render the typed name as a
  selected chip in the chip row (same `on` styling as picking a nearby chip),
  with a small affordance to reopen/edit. `selectedKey='manual-new'` now maps
  to a real element.
- Tapping the manual chip again reopens the form pre-filled (edit, not
  re-type).
- The `!coords` early-return must speak: the `picker.needloc` line already
  exists — ensure it is visible *at the moment of the tap* (e.g. brief
  highlight), not just passively present.
- When the same-place nudge (`picker.sameas`) appears, scroll it into view /
  ensure it isn't under the keyboard (`scrollIntoView` on mount is
  acceptable).

**Tests:** component test — after typing + 加入, the chip row contains the
typed name with selected styling and the form is collapsed; reopening
preserves the text.

---

## 2. Typed-name resolution via Places Text Search — *(build: Sonnet; design decided here)*

**Problem:** Nearby Search is capped at 10 prominence-ranked results; in dense
HK a well-known spot routinely misses the cut. Manual adds then create
`place_id`-less rows — exactly the fragmentation the restaurant-identity work
(backlog: restaurant identity resolution) exists to prevent.

**Design (confirmed): search-on-add, not typeahead.** When the user taps 加入,
FIRST call a new endpoint `GET /api/restaurants/search?q=..&lat=..&lng=..`
which runs Places Text Search (New, `places:searchText`) with:
- `locationBias` circle at the picker's coords (~1km radius),
- same minimal field mask as `places.ts` (`places.id,places.displayName,places.location,places.formattedAddress`),
- `languageCode` from the app language, `maxResultCount` ~5.

Then:
- **Match(es) found** → show them via the existing same-place nudge UI,
  extended to hold multiple candidates ("係咪呢間？" + chips). Picking one goes
  through the normal Google-chip path → carries a real `place_id` → server
  dedup works.
- **No match / user rejects all** → `createNew()` as today (manual,
  `place_id`-less — still allowed, never blocked).

Rejected alternative: live search-as-you-type. Every keystroke-debounced query
is a billed call with no cache locality; search-on-add is exactly one call per
add attempt and slots into the existing nudge UX.

**Cost discipline (mirror the places.ts comment):** implementation MUST verify
in the current Google pricing table which SKU tier this field mask lands
Text Search in, and note it in the code comment. Volume is bounded (one call
per manual add), no cache needed. Confirm the existing daily quota cap covers
the new endpoint.

**Tests:** endpoint unit test with mocked fetch (bias + field mask asserted);
picker test for the multi-candidate nudge path and the reject→manual path.

---

## 3. Nearby list: distance ranking, no Google cap — *(Sonnet)* — ✅ DONE `d661536`

Two changes in `src/app/api/restaurants/nearby/route.ts` + `src/lib/places.ts`:

1. `rankPreference: 'DISTANCE'` on the `places:searchNearby` body — the 10
   Google slots become the *nearest* 10, not the most prominent 10. (With
   DISTANCE ranking, check the API's requirements: `radius` +
   `rankPreference` interplay per current docs — adjust the
   `locationRestriction` accordingly if the API rejects the combination.)
2. Remove the `slice(0, 8 - dishi.length)` squeeze entirely. Show ALL Dishi
   rows (RPC already caps at 8) plus ALL deduped Google results (max 10).
   Explicit product decision: no combined cap — the chip row wraps; a longer
   honest list beats a short wrong one.

**Cache note:** bump/namespace the `places_cache` bucket key (e.g. suffix
`:v2`) so pre-change prominence-ranked cached results don't serve for up to
12h after deploy.

**Tests:** update nearby route test — no slicing; assert `rankPreference` is
sent.

---

## 4. HK menu shorthand: 炆米 ≠ 炆飯 — carb metonym integrity — *(Fable 5)* — ✅ DONE `ca6ed92`

Glossary (4a) + carbSuspicion tripwire (4b) + tests/eval/backfill (4c) shipped.
FOLLOW-UP still open: the tripwire corrects ingredients/diet, not the attribute
VECTOR or an already-polluted NAME — honest vector re-score needs the name
re-authored first (translate/vision + authority ladder). Recommended next; costs
one more LLM call per fire.

**Priority: high, trust-critical** — same family as diet-flag integrity. The
scan misreads HK menu metonyms where the carb is named by single-character
shorthand: 米 = 米粉 (rice noodles), 河 = 河粉, 意 = 意粉, 通 = 通粉,
丁 = 出前一丁, 治 = 三文治, 多/西多 = 西多士. Observed in production:
炆米 → "炆飯"; 干炒牛河 → 飯 ingredient chip + "Dry Fried Beef River".
A wrong carb pollutes the English name, ingredient chips, diet-adjacent
reasoning, AND the 18-dim attribute vector — bad data straight into the taste
engine.

**Design principles (carried over from diet-flag v2 — do not regress):**
- Strings never author; they only trip a re-check.
- `name_original` ("o") stays verbatim always — misreadings may only ever
  live in derived fields, which are correctable.

**Three legs:**

### 4a. Prompt glossary
New shared constant `HK_MENU_SHORTHAND_GUIDANCE` (in `nameTranslate.ts`
alongside `ZH_FROM_MENU_GUIDANCE`, or `menuScan.ts` — implementer's call, one
place only). Content: expand HK shorthand *before* deriving anything —
compact glossary of the metonyms above plus 齋 prefix, 底 (麵底/飯底), and
the explicit trap that 米 in a cooked-dish name means 米粉, not rice, while
粟米/蝦米/米芝蓮 do NOT (component words, not shorthand). English names must
be the *known dish* name, never character-literal ("beef chow fun", not
"beef river"). Inject into all relevant prompt sites: both `SCAN_PROMPTS`
members, `ENRICH_SYSTEM`, and the vision prompt sites — extend the existing
`SCAN_PROMPTS` embedding test to assert the new constant is present in each,
so it can't silently drop (the mechanism that already guards the z-rule).

### 4b. Mechanical tripwire: `carbSuspicion()`
Pure, exported, unit-tested function in `menuScan.ts`, modeled on
`dietSuspicion`: fires when the printed/zh name carries a noodle morpheme
(米 in dish position, 河, 麵/面, 粉, 意, 通, 丁) but derived
ingredients/name say rice — or the reverse. Requires a `CARB_NAME_TRAPS`
neutralization list first (粟米, 蝦米, 米芝蓮, 河內?, 沙河?, …) — this list
is the judgment-heavy core and why this item is Fable 5; curate it against
real HK menu vocabulary, err toward neutralizing (worst case of a missed
fire is status quo; worst case of a false fire is one harmless re-ask).
On suspicion at enrichment: ONE re-ask with an appended correction line,
mirroring `DIET_RECHECK_LINE`.

### 4c. Regression fixture + bounded backfill
- Vitest table for `carbSuspicion` covering: 干炒牛河, 蝦子炆米, 星洲炒米,
  肉醬意, 火腿通, 餐蛋丁, 西多, 蛋治, and the neutralized non-fires
  (粟米斑塊飯, 蝦米), etc.
- Manual eval script `scripts/eval-hk-shorthand.ts` (pattern:
  `backfill-diet-flags.ts`): runs the live enrich path over the fixture
  set, prints derived carb/ingredients vs expected — run by hand after
  prompt changes, not CI.
- One-off backfill: run `carbSuspicion` over stored `dishes`, re-enrich only
  the suspicious subset, dry-run first, `--apply` to write. Same auditable
  before/after output as the diet backfill.

**Open question for implementation (flag, don't decide silently):** whether
the tripwire should also gate the *attribute vector* re-score, or only
name/ingredients — re-scoring costs a second LLM call per fire. Recommend
yes (the vector is what the engine eats) but surface the cost when building.
