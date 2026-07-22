# Dishi — Decisions & Done Log

Archive of shipped backlog items, moved out of `docs/BACKLOG.md` to keep that
file to open work only. Full original rationale/amendments preserved
verbatim — this is where "why we did it this way" lives once something's
done. If a done item needs to re-open (a real regression, not just "could be
better"), copy it back to BACKLOG.md with a note; don't edit history here.

Organized chronologically, oldest first, in the same batches BACKLOG.md
carried them in.

---

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
- [x] Vision reliability: retry unparseable responses + honest "couldn't read"
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
- [x] **[F] Queued picks (待評菜式) rate through the NEW flow.** ✅ DONE `ca65a8a`.
  The rate icon opened `/log?rate=<id>` (the old single-dish page); it now opens
  RatingStack in `picksMode` — flick card → growth screen, same as the album path.
  **Owner chose (a):** ✕ on a pick is a plain close, the flicked rating stands, and
  correction goes through 重新評分 in 食記 (which replays full history, so it's
  engine-correct and never re-seals). (b) — a real un-rate — was rejected because
  sending a dish back to 待評 with its prediction ALREADY REVEALED lets the re-rating
  be made with dishi's guess in hand, which corrupts the sealed-bet contract and makes
  the streak gameable. Two independent guards ensure a pick is never deleted:
  `cancelSession` early-returns in picksMode, and no `onCancel` is passed to
  TasteGrowth (its `onCancel ?? onExit` fallback makes ✕ close-and-keep).
  `?unrated=1` now also returns `photo_url`/`lat`/`lng` for the card + nearby seed.

---

# Batch: restaurant picker ×3 + HK menu shorthand (2026-07-20)

Context: real field session at Tin Wan, 2026-07-20 ~13:49 HKT. 新容記 (well-known,
user was standing in it) absent from the picker chips; typing it and tapping 加入
produced no visible result; Vercel logs confirm `/api/dishes/pick` was never
called — the picks were lost. Same scan: 干炒牛河 shipped with a 飯 ingredient
chip and the literal English "Dry Fried Beef River"; a separate menu's 炆米 came
out as 炆飯.

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

---

# Batch: rating-stack upload failure + rename re-derivation (2026-07-21)

Context: real field session, 2026-07-21 ~02:34 HKT, onboarding growth screen
(建立個人化口味 AI / RatingStack + TasteGrowth). Five photos rated. Vercel logs:
first photo's `POST /api/dishes` rejected **413** at the platform edge at
18:34:24 UTC (body over the ~4.5MB serverless cap — never reached the route);
the other four succeeded seconds later. Rename PATCH on dish 2 succeeded
(18:36:10, 200) and `/api/dishes/enrich` fired after it (18:36:22, 200), yet
the ingredient chips never changed.

---

## 1. Photo upload size cap + failed-card honesty — *(Sonnet)* — ✅ DONE `b6d3c58` (unified on normalizePhoto; failed card = notice + retry, no queued-rename needed since edit UI is absent on failed cards)

**Two root causes, one card:**
- The 413 happens at Vercel's edge (~4.5MB serverless body limit — not
  raisable), so oversized photos fail before any code runs.
- `RatingStack.runPipeline` marks the card `status:'failed'`, but TasteGrowth
  renders a failed card nearly identically to a healthy one: photo + score
  word + empty name pill + place chips. No error, no retry. Then
  `onEditName`/`onPickPlace` hit `if (!gd?.dishId) return;` — the user's
  typed name silently goes nowhere. (Same silent-failure shape as the picker
  加入 bug and the historical `dishes.source` constraint — this class keeps
  recurring; fix the instance AND keep the pattern in mind.)

**Changes:**
- **Client-side downscale before upload.** Shared util (check what the /log
  flow does today and unify — do not fork a second resize path): longest edge
  ~2000px, JPEG re-encode, target well under the cap (~3MB ceiling). Applies
  to RatingStack and any other photo POST that lacks it.
- **Failed card states its failure.** Reuse the existing honesty copy pattern
  (`log.visionfail.*` distinguishes "nobody ever looked" from "looked and said
  not food" — this is the former). Show a retry affordance; the File object is
  still in memory in `prepared`, so retry = re-run `runPipeline` for that
  index with the (now downscaled) file.
- **No silent no-ops on a dishId-less card.** Rename/place actions on a
  failed card either (a) are visibly disabled with the failure notice, or
  (b) queue locally and auto-apply after a successful retry. Prefer (b) for
  the rename — the person already typed the name; don't make them re-type.
- The 413 response never reaches route code, so the fix is client-side
  detection: `!res.ok` already catches it — the gap is presentation, plus
  prevention via downscale.

**Tests:** unit test the downscale util (dimension + size ceiling); component
test that a failed card shows the failure state and that rename-on-failed
queues and applies after retry.

---

## 2. Rename → REAL re-derivation (kill the simulated re-enrich) — *(Fable 5)* — ✅ DONE `b6d3c58` (force mode + enrichGen; PATCH reanalyzeAnchored left in place — name-seeded result lands after it, so the typed name wins; route/component tests skipped — repo has no route/component test infra, glossary+eval pinned instead)

**Root cause chain (all three layers confirmed in code):**
1. `/api/dishes/enrich` early-returns when `dish.attributes` is non-empty —
   built as first-time-only enrichment. A post-rename call is a guaranteed
   no-op. Worse, the early-return path returns NO `ingredients` (the
   pass-through only exists on the full-run path).
2. `RatingStack.onEditName` patches `name`/`name_zh`/`diet` from the PATCH
   response but ingredients never flow into `live` state.
3. `TasteGrowth.reReenrich` is an acknowledged simulation (see its own
   comment): blanks the chips, waits 720ms, restores the OLD `ing`. The UI
   performs a re-analysis that never happened — an honesty violation by the
   product's own standards.

**Decided behavior — typed name is the derivation seed.** After a human
rename, re-derivation reasons from the NEW name (text enrichment path), not
from the photo. This follows the existing name-authority ladder
(`AUTHORITY_HUMAN > AUTHORITY_VISION`): the person just told us what the dish
IS; a photo-anchored re-analysis (`reanalyzeAnchored`) can keep contradicting
them (the 鴨-beats-油雞 failure observed live). The photo remains support
evidence, never override. If implementation finds `reanalyzeAnchored` inside
the PATCH cascade writing photo-derived fields AFTER this change, resolve in
favor of the typed name and note what moved.

**Changes:**
- `/api/dishes/enrich`: accept `{ force: true }` (or a sibling
  `re-derive` action — implementer's call, one endpoint preferred). Force
  mode: re-run `inferCuisineFromName` + `scoreOneDish` + `enrichOneDish`
  seeded from the CURRENT (post-rename) name, overwrite
  attributes/diet/cooking_method/heaviness, and ALWAYS return `ingredients`
  — including on any remaining early-return path.
- **Profile heal:** the existing rating learned from the old attributes. The
  route already contains the correct pattern (replayProfile + taste_profiles
  upsert when a rating exists) — ensure force mode runs it too. This is the
  re-rating-corruption lesson applied to attribute changes: replay, never
  layer.
- `RatingStack`: `onEditName`/`onReclassify` call enrich with force after the
  rename PATCH resolves; patch `ingredients`, `diet`, `heaviness`,
  `enriched` from the response into `live` state.
- `TasteGrowth`: delete the 720ms `setTimeout` simulation. `reenriching`
  becomes data-driven: set true when the rename commits, cleared when the
  live row's post-rename enrichment lands (compare against a
  rename-generation counter, not field equality — the new ingredients could
  coincidentally match the old). Chips animate out on commit, in on real
  arrival. Remove the `p.ing.length === 0` guard's early return for the
  live path — a just-named dish with no prior chips is exactly the case that
  NEEDS a first derivation.
- Sim mode (snapdemo, no auth) keeps the timeout animation — it's honest
  there because the whole screen is declared a demo.

**Cost note:** force mode = one extra `scoreOneDish` + `enrichOneDish` per
rename. Renames are rare and human-initiated; acceptable. No debounce needed
beyond ignoring stale in-flight responses (generation counter).

**Tests:** route test — force mode overwrites and returns ingredients;
replay runs when a rating exists. Component test — rename sets
`reenriching`, old chips never reappear, new chips land from the live patch.

---

## 3. Glossary addition: 油雞 false-friend — *(rider on the shipped shorthand glossary; Sonnet)* — ✅ DONE `b6d3c58`

Observed live: 油雞髀 rendered as "Fried Chicken Thigh" — 油雞 is soy-poached
chicken (豉油雞), not fried; 油 here is the poaching liquor, not deep-frying.
Add to the existing HK shorthand/false-friend guidance (one line, both the
scan glossary and translate guidance if they're separate constants), plus one
fixture row in the shorthand eval set: 油雞髀 → poached/soy chicken, cooking
method NOT fried.

While in there: quick pass for siblings of the same shape — 白切雞 (poached,
not "white cut" literalism is fine but method = poached), 手撕雞 (shredded,
not "hand-torn" as method), 風沙雞 (fried garlic crumb, not "wind-sand").
Add only ones that fit in a line or two; the glossary must stay compact to
stay obeyed.

---

# Batch: dishi version ladder + taste-page/growth UI batch (2026-07-21)

Context: field session 09:40–09:44 HKT on the 味 AI page and growth screen.
Product decision (Jerry, confirmed): "Level" becomes "Version" — same growth
substrate, better framing for this product. Versions are UNBOUNDED (v99,
v123, …), early ones unlock fast, later ones need progressively more signal.
The habit loop: every new version unlock → export to your AI. Deep version
semantics and per-version perks are EXPLICITLY DEFERRED to a design session
with Jerry — do not invent perks; build the mechanical scaffold only.

---

## 1. Unbounded version ladder (replaces Levels) — *(Fable 5)* — ✅ DONE `89c36f3` (v1≡export-unlock structural; substrate (rc/25)^0.75 + capped dims + uncapped cuisines; gaps 0.65×1.25^n; ratchet column version_unlocked applied live; 13 tests incl. pacing snapshot)

**Core:** new pure module function `versionForProfile(inputs) →
{ version, progress, nextAt }` alongside the existing buddy math.

**Constraints (hard):**
- **v1 ≡ export unlock.** "dishi v1 已經解鎖" and "can export" must be the
  same fact, derived from the same number — never two thresholds that can
  disagree. Anchor v1 to the existing `UNLOCK_CONFIDENCE` signal level.
- **Unbounded + monotone.** Confidence saturates at 1.0, so versions cannot
  ride the confidence scale forever. Substrate: cumulative honest signal
  (the same inputs evidenceConfidence weighs — ratings, explored dims,
  distinct cuisines — accumulated, not saturated). Diversity keeps its
  outsized weight; the 30th identical ramen still teaches ~nothing.
- **Early-easy, later-hard.** Threshold spacing grows (geometric or
  quadratic — implementer's judgment): v2 within roughly a good first week
  of normal use; by v10+ each version is a real undertaking. Tune against
  Jerry's live account as the reference curve (25 flicks / 8 cuisines /
  10 explored dims ≈ should sit at v1, partway to v2).
- **Replay-safe + ratcheted.** Version must be recomputable from ratings
  history (no drift, same principle as profile replay). RECOMMENDED (flag,
  Jerry has not ruled): achieved version RATCHETS — it's an unlock history,
  so deleting a rating never demotes; the progress bar toward next version
  reflects live signal and may dip. Note the tradeoff in code comment.
- **Naming:** "dishi v{n}" everywhere. Animal level names (Hatchling…) exit
  the UI. Keep or delete `CONFIDENCE_LEVELS` internally as implementation
  convenience, but nothing user-facing speaks Levels.
- **Export unification:** the export's own version stamp (`export.delta`
  v{v} copy) becomes the SAME number — dishi v2 unlock generates the v2
  export with visible deltas since v1. This is the profile-versioning
  engagement loop from the standing backlog, now with its unlock trigger.

**UI (from the screenshots):**
- 「V{n}」 label left of the 識咗/摸緊 line; 「V{n+1}」 at the bar's right
  end; bar spans full stat-line width and shows progress between the two
  version thresholds (not raw confidence).
- Unlock-moment copy 「Taste AI 1.0 Ready 喇」 fires ONCE at first v1
  unlock, then steady-state 「dishi v{n} 已經解鎖」 + dynamic
  progress-to-next copy. Kill the "Taste AI 1.0" naming.
- Export CTA copy → 「dishi v{n} 植入」, font size/weight matched to the
  locked-state 「再評多 {n} 味就生成到」 line. Vermillion stays — this
  button is one of its two sanctioned uses.

**Tests:** curve monotonicity; v1==export-unlock equivalence; ratchet
behavior; replay determinism; early-version pacing snapshot (so a future
curve tweak is a conscious diff, not an accident).

---

## 2. Auto-seal on version unlock — *(fold into item 1, Fable 5)* — ✅ DONE `89c36f3` (shared stakeSeal helper, strongest |contentScore| unrated dish, honest no-op when none; /api/seals refactored onto the same core)

At the moment a new version unlocks, the engine stakes ONE sealed
prediction (reuse `sealed_predictions` wholesale — no new tables/UI): its
strongest-confidence call about a dish direction the user hasn't confirmed
yet. Every "dishi v{n} 已經解鎖" ships with the engine putting its
reputation on the line; reveal follows the existing seal reveal flow.

**Known gap (Jerry, explicit):** users don't yet understand what the seal
IS. Ship the mechanic, then schedule a deep-dive review on delivering /
educating the essence of it — capture reveal-rate + streak data meanwhile
so that review has numbers. Do not add explanatory UI beyond existing copy
in this pass.

---

## 3. Tappable stat boxes with explainer layer — *(Sonnet)* — ✅ DONE `713f645` (scrim+sheet pattern, 書面語 copy grounded in real buddy.ts/tasteExport.ts semantics)

引擎強度 / 滑動 / 菜系 / 味覺調校 each tappable → popover/sheet, same
presentation pattern as the globe & notification icons. Four short
bilingual blurbs, written from the REAL engine semantics (書面語 register,
these are explainers):
- 引擎強度: how much signal the taste vector is built on — ratings ×
  variety × cuisines; diversity counts extra; this number gates nothing
  falsely (it IS the version substrate).
- 滑動: total dishes rated.
- 菜系: distinct cuisines with real ratings.
- 味覺調校: of 18 tracked dimensions, how many have crystallized into an
  actual preference (clear of noise) — stricter than 識咗, which only needs
  enough evidence to trust a reading.
Copy drafted at build time from `buddy.ts`/`tasteExport.ts` semantics; must
stay true if thresholds move (reference constants, don't hardcode claims).

---

## 4. Growth screen: REAL blob, not the dev mockup — *(Sonnet)* — ✅ DONE `713f645` (blobForm.ts sampleForm/formToSvgPath, seeded from the live /api/buddy vector/evidence/ratingCount, userId threaded through)

The growth screen's header circle is a static dev-mock blob. Replace with
the real `blobForm` render seeded from the live profile
(`${userId}:v${profileVersion}` — note: profileVersion ties into item 1's
version number once unified), updating as ratings commit during the
session. A new user's blob will be small and plain — that is correct
behavior, not a regression. Remove the mock asset so it can't return.

---

## 5. Absorb-effect words in Chinese — *(Sonnet)* — ✅ DONE `713f645` (extracted the existing DishInfoDisplay ingredient→zh glossary to src/lib/ingredientLabel.ts, shared by both; note: dishes never actually carried a zh ingredient field — that premise was inaccurate, this glossary is the real source)

The learned-attribute absorb animation mostly emits English tokens
("seaweed", "rice"). When app language is zh: dimension words use the
existing `dim.*` zh labels; ingredient words use the ingredient zh names
already carried on the dish. English only when no zh label exists. (The
9:41 screenshot shows 奶類 + "rice" side by side — mixed register, fix.)

---

## 6. Small UI batch — *(Sonnet, one pass)* — ✅ DONE `713f645` (chip contrast in growth-screen location row; root-caused + fixed the black-banner bleed-through: backdrop brightness() can't lift true black, swapped the glass tint for a real paper-alpha wash)

- 加間舖 / 略過 / 住家菜 chips: darker text color (current --ink-soft on
  glaze reads too faint on the dark-banner overlay context).
- Black banner's blurred backdrop: lighten / lower alpha — currently too
  dark, crushes the header area (9:42 screenshot).

---

Deferred by decision: version semantics deep-design, per-version perks
(fun factor, smarter AI instructions per taste), seal education — all
Jerry+Claude design sessions, not implementation tickets.

---

# Batch: Table Mode social — one surface, chops, echo (2026-07-21)

Context: field session 18:41 HKT, two-person table R4E87. The joiner still
renders the PRE-redesign table layout (score rings, old cards) while the host
sees the new 你的最佳選擇 list — two products stapled together. Confirmed
design (Jerry): one shared surface; chop-first identity (photos later);
realtime pick stamps; companion data layer; 檯友回音 echo rider; guests
without accounts CAN stamp picks (friction kills tables) but generate no
companion edge / echo until sign-up — a deliberate conversion hook.

Strategic frame: two people picking at one table generates PAIRED dish-level
demand data no POS or QR vendor can see. Social is where the moat compounds.

Items 4, 5, 6, and 3b (guest participation) are still open — see BACKLOG.md.

---

## 1. One shared table surface — *(Sonnet)* — ✅ DONE `2f5b39b`

Delete the joiner's legacy view. Every member of a table session renders the
SAME new 你的最佳選擇 list (讀到 N 道菜 header, numbered rows, price, chips,
footer bar). Per-person differences are limited to:
- ranking blend when 2+ taste profiles are present (existing 有兩個或以上口味
  檔案入檯 behavior keeps its engine semantics — presentation unifies, math
  doesn't change in this item);
- your own picks highlighted as yours.
The old table components are removed, not feature-flagged — they must not be
reachable. 離開 / invite / table code chrome carries over onto the unified
header.

**Tests:** joiner and host snapshot the same component tree for the same
session state.

Shipped as scan's own settled-list grammar (scan-item/scan-rank rows, no
rings) ported onto the table's group_match data — math untouched, only the
render changed. `unanimous` turned out to be trivially true for a small/
single-member table (every profiled member's raw score clears a low floor),
so the 🔥 mark is capped to the top 3 by group_match — the same discipline
scan already applies to its own fire winners (there: top 2 by raw_score) —
found and fixed during live testing, not spec'd. Component-tree snapshot
tests were dropped for the same reason every later item's spec'd test
plan changed: **this repo has no component/DOM test harness** (confirmed
against the b6d3c58 precedent) — verified live in the browser instead
(a real table session, screenshotted, then cleaned up).

**Amended (owner correction, 2026-07-21):** the above was a false DONE. The
"unified surface" was a second, hand-styled component that imitated scan's
settled-list look rather than importing it — the exact failure mode this
repo's UI-verification rule now names ("reuse, don't imitate"). Re-fixed
for real: extracted `src/components/DishListRow.tsx` and
`src/components/TableBar.tsx` verbatim from scan/page.tsx's own settled-row
and table-glance JSX; scan and table both now import and call these same
components (scan passes its host-only `fire`/`reason`/`pair` extras, table
passes `stamps`), and the old inline table row/card markup — cuisine chip,
剛剛選了 feed card, inline 揀呢個/已選 button, fire logic — was deleted
from table/page.tsx outright, not flagged off. Root-caused a real backend
bug along the way: `POST /api/table`'s JSON share-path was silently
dropping `diet`/`cooking_method`/`heaviness`/`ingredients` when a scan
shared itself as a table, which the 測試菜A/B seed fixture (itself missing
those fields) had masked in the original item-1 testing — fixed in
`src/app/api/table/route.ts` and `src/app/api/table/[code]/route.ts`.
Added the component/DOM test harness this repo lacked (`@testing-library/react`
+ jsdom, scoped to one file, `vitest.config.ts` alias) —
`tests/tableComponentIdentity.test.tsx` renders `DishListRow` through both
call sites and asserts identical output modulo the stamps slot, plus
source-level assertions that would fail (and were confirmed to fail,
against the pre-correction commit) if a second implementation reappears.
Verified live against the real `R4E87` session (32-dish scanned menu, not
the seed fixture): host view and a second, separately-authenticated joiner
(test account) both render the same 你的最佳選擇 header, `TableBar`, and
numbered rows, with a live pick round-tripping to a filled card + chop
stamp for the joiner.

**Amended (owner review of the live screenshot, 2026-07-21):** that same
screenshot showed real crowding once a real 32-dish/3-member session filled
the screen — a text 離開 button squeezed into the table bar, a
member-roster chip row that only repeated names the per-dish stamps
already carry, and a redundant 「{name} 也選了」 text line stacked under
every stamp. Fixed: 離開 moved to an icon-only button (new `LeaveIcon` in
`icons.tsx`) on the title row instead of the table bar; the roster row
deleted outright; `DishListRow`'s `pickedBy` text is simply no longer
passed from table's call site (the prop and its rendering stay — scan
still uses it — table just stops feeding it), so a picked dish shows only
its chop stamp(s), no repeated name text.

**Amended (owner call, 2026-07-21): killed `/table`'s standalone landing
screen (一齊食).** It only ever duplicated the join-by-code box scan/page.tsx
already shows front and center — same endpoint, same destination — and had
had zero inbound links since losing its nav tab (its one non-duplicate
capability, starting a table with no menu / an unenriched raw photo, wasn't
worth a second UI). `/table` with no `?code=` now redirects to `/scan`;
`Landing` deleted from table/page.tsx along with its now-unused
`PhotoPicker`/`normalizePhoto` imports; the dead front-door link removed
from scan/page.tsx. `POST /api/table`'s multipart/form-data branch (its
only caller) deleted too — the route is JSON-only now. Orphaned i18n keys
(`table.title`, `table.blurb`, `table.start`, `table.start.blurb`,
`table.starting`, `table.readingmenu`, `table.open.full`, and the
already-stale `table.itemsread` from the item-1 correction above) and the
matching `.table-open-link` CSS removed. `/table?code=` still lands
correctly on the session view — verified live.

---

## 2. Chop identity (名印) — *(Sonnet)* — ✅ DONE `5ca23a0`

Avatar = a small ink 印章 bearing the first character of the display name
(first letter if Latin), deterministically styled from user id (seeded
variation in border/rotation/weight — same user always renders the same
chop). One-time setup on first table join or first social surface: type a
display name, done. No photo upload infra in v1; photo override is a later
item.

**Hard constraint:** chops render in INK (--ink on --glaze), never
vermillion. Vermillion remains reserved for the seal glyph and the AI-export
CTA. Do not ship a red chop no matter how good it looks — this is the one
place the temptation will be strongest.

- Display-name uniqueness NOT required; disambiguate by chop styling + full
  name on long-press/tap.
- Existing auto-handles (mosuko-i47v) become the fallback display name until
  the user sets one; prompt once, never nag.
- New table: `profiles.display_name` (or equivalent — implementer verifies
  current profile table shape via Supabase MCP before migrating). Migration
  saved to `supabase/applied/` per standing pattern.

**Tests:** deterministic chop render for fixed id; fallback name path.

`src/lib/chop.ts` (chopGlyph + deriveChopStyle, seededRandom-based — reuses
blobForm.ts's existing hash rather than a new one) + `src/components/Chop.tsx`.
`profiles.display_name` added (`supabase/applied/profiles_display_name.sql`).
"Never nag" implemented as a device-local `dishi_chop_prompt_dismissed`
localStorage flag (no server-side "dismissed" state — the handle fallback is
a fully valid permanent choice). Vermillion constraint honored: the ONLY red
in this feature is the pre-existing dish-edit dirty-save convention on the
SAVE button, never the chop glyph itself. 9 tests. Verified live: saved a
real display_name, confirmed via direct DB query, then reverted it and the
test table session — nothing left in the live account.

**Amended `94b0680` (owner review, 2026-07-21):** the per-user rotation/
variable-radius/border-weight above shipped as spec'd, but read as the
app's separate 印 ink-seal motif rather than Table Mode's own clean look —
swapped for a plain uniform circle with initials, no shape variation.
`deriveChopStyle`/`ChopStyle` deleted (unused after the swap); `chopGlyph`
unchanged. 4 tests removed with it (432 total). The spec's "disambiguate by
chop styling... on long-press/tap" no longer applies — every chop looks
identical now, so disambiguation (if it's ever needed) would have to be
full-name-on-tap alone.

---

## 3. Realtime pick stamps — *(Sonnet)* — ✅ DONE `4c0deed` (signed-in members only — see below)

Tapping 揀呢個 stamps your chop onto the dish row with a small physical
"thunk" (scale+settle, ~200ms, respects prefers-reduced-motion) and
broadcasts via Supabase Realtime on the table session channel so every
member sees it land live. Un-picking lifts the stamp.

- A dish stamped by 2+ members gets the 全檯啱 treatment made PROMINENT —
  convergence is the emotional payoff; the UI celebrates overlap, not
  individual totals. Footer keeps running count + price.
- Multiple chops on one row: overlap-fan layout, capped visual stack with
  +N overflow.
- Guests (no account): may stamp; their chop uses their session handle.
  Their picks are session-scoped only (see item 4 for what they do NOT
  generate). On sign-up mid-session, their stamps re-key to the new account.
- Offline/late-join reconciliation: on channel join, fetch current pick
  state, then apply deltas — no ghost stamps.

**Tests:** realtime channel mock — stamp broadcast/receive, un-pick, late
join reconciliation, guest re-key on sign-up.

**Scoped down before starting, with the owner's sign-off:** this app has NO
anonymous-access path anywhere — every route requires a real Supabase
session (AuthGate + `auth.getUser()` 401 everywhere). Guest participation
means designing a new session-identity + RLS model from scratch, which is
an [F]-tier architecture decision, not a Sonnet side-effect of a stamps
feature. Split out as its own item (3b), see BACKLOG.md — build the rest
now.

Shipped: `src/lib/tableStamps.ts` (stampsFromPicks/mergeStamps/
applyStampEvent, pure + 16 tests — the realtime "channel mock" from the
spec's own test plan, since this repo has no component/DOM harness). The
5s poll is the source of truth; broadcasts are a pure latency overlay
cleared on every fresh poll, which IS the late-join/offline reconciliation
the spec asked for — a client that missed a broadcast just self-heals on
its next poll, no separate reconciliation code needed. Un-pick added (the
picked button is now tappable, not a terminal disabled state) via the
existing `DELETE /api/my/dishes` — no new deletion path. 全檯啱 now fires
on either the item-1 predicted blend OR 2+ real stamps. Verified live with
two browser tabs on one session: pick/un-pick in one tab landed in the
other with zero reload.

---
