# Dishi — Decisions & Done Log

Archive of shipped backlog items, moved out of `docs/BACKLOG.md` to keep that
file to open work only. Full original rationale/amendments preserved
verbatim — this is where "why we did it this way" lives once something's
done. If a done item needs to re-open (a real regression, not just "could be
better"), copy it back to BACKLOG.md with a note; don't edit history here.

Organized chronologically, oldest first, in the same batches BACKLOG.md
carried them in.

## Quick index

**Directions & principles**
- [Direction: what the taste engine is FOR](#direction-what-the-taste-engine-is-for-owner-2026-07-24) (owner vision, 2026-07-24)
- [Direction: comparison is the core product DNA](#direction-comparison-is-the-core-product-dna-owner-2026-07-26) (owner vision, 2026-07-26)

**Identity & social**
- [Identity, connection, and export positioning](#identity-connection-and-export-positioning-owner-2026-07-26) (owner decisions 1-5, 2026-07-26)

**Engine & data**
- [Self-calibrating rating scale + seal percentile bands](#direction-what-the-taste-engine-is-for-owner-2026-07-24) (both shipped, 2026-07-26)
- [Seal dislike band closed](#dislike-band-closed-via-8432890) — per-user quantile banding fixed unreachable band
- [佢哋整得點？ execution slider](#佢哋整得點️--the-1-10-execution-slider--✅-shipped) — shipped, both extensions confirmed
- [`scripts/seal-rows.json` cleared](#scriptsseal-rowsjson-cleared-from-the-repo-owner-2026-07-26) — fixture moved to builder, history rewrite declined

**Batches by date**
- [2026-07-20](#batch-restaurant-picker-×3--hk-menu-shorthand-2026-07-20): Picker, HK menu shorthand
- [2026-07-21](#batch-rating-stack-upload-failure--rename-re-derivation-2026-07-21): Upload, re-derivation
- [2026-07-21](#batch-dishi-version-ladder--taste-pagegrowth-ui-batch-2026-07-21): Version ladder, growth UI
- [2026-07-21](#batch-table-mode-social--one-surface-chops-echo-2026-07-21): Table social, chops, echo
- [2026-07-22](#backlog-additions--2026-07-22-identity-confirm-card-on-the-duel-chassis): Identity-confirm card
- [2026-07-22](#backlog-additions--2026-07-22-log-entry-three-paths-by-what-youre-holding): Log entry, shipped & rolled back
- [2026-07-23](#batch-diet-taxonomy-growth--tree-nuts--soy-gluten-rejected-2026-07-23): Diet taxonomy
- [2026-07-23](#batch-dishipersona-rd-phase-0-2026-07-23): Persona Phase 0 gate & install flow
- [2026-07-23](#batch-pick-flow-field-session-fixes-2026-07-23): Pick-flow polish
- [2026-07-24](#batch-field-session-fixes-2026-07-24): Field-session fixes
- [2026-07-24](#batch-dishipersona-phase-05-field-test-fixes-2026-07-24): Persona Phase 0.5 tests
- [2026-07-24](#batch-table-mode-two-account-field-test-fixes-2026-07-24): Table two-account fixes
- [2026-07-24](#batch-seal-reveal--band-calibration-2026-07-24): Seal reveal & band calibration

**Abandoned**
- [Log-entry redesign (食物相/打字/外賣單)](#log-entry-redesign-食物相--打字--外賣單--direction-abandoned-owner-2026-07-26) — direction dropped, code deleted, 2026-07-26

---

## OTP login (kill the magic-link browser trap) — *(Sonnet)* — ✅ DONE `20789e6`, `0e3cd2b`, `11ae61b`

Was carried as an open "Now" item in BACKLOG.md well after it actually
shipped — caught late (owner flagged it 2026-07-22) because nothing had
moved it to this file. Full original spec: `docs/specs/otp-login.md`.

**Problem:** the login email led with a magic link; tapping it opens
whatever browser the mail app chooses (Gmail webview, default Safari), so
the session lands in a different browser than where the user started — the
classic magic-link trap. Login had to become: type email → read/tap
6-digit code → in, in the SAME browser, every time.

**Shipped in `src/components/AuthGate.tsx`:**
- `autoComplete="one-time-code"` on the code input — the attribute that
  makes iOS surface the code from Apple Mail/Messages as a tappable chip
  above the keyboard.
- `signInWithOtp({ email })` with no `emailRedirectTo` — pure OTP, no
  redirect target, since the template carries no magic link.
- `verifyOtp({ email, token: code.trim(), type: 'email' })` on submit; no
  hardcoded digit count client-side, `verifyOtp` itself rejects a wrong
  code.
- Follow-up commits: copy updated to state the code is 6 digits (Supabase
  OTP length set to 6, `0e3cd2b`); monospace font on the code input
  (`11ae61b`) for legibility/alignment.

Android/SMS-OTP explicitly stayed out of scope per the original spec
(no reliable email autofill standard there; WebOTP costs per login).

---

## 語言對 fixes (live-test failures) — *(Sonnet)* — ✅ DONE `c8af257`, `821fb5e`, `6ccad67`, `8147297`

Another item carried as open long after it shipped — caught in the same
2026-07-22 audit as the OTP entry above. Original scope: Japanese-menu
acceptance test failed on ec16af0 — scan z-instruction never received the
katakana/false-friend hardening (it landed only in nameTranslate.ts), and
bilingual menus defeated menuLanguageToCode so the foreign-secondary preset
never fired. v2: prompt wording alone proved unreliable on the skeleton
model (qwen) — added the kana/hangul tripwire that re-authors z through the
proven translate path, plus chip label-dedupe.
Full spec + addenda: `docs/specs/language-pair-globe-fixes.md`.

Shipped across four commits:
- `c8af257` — v1: harden scan z-field + resilient menuLanguageToCode (the
  two live-test gaps).
- `821fb5e` — v2: kana/hangul tripwire re-authors z via the translate
  path; DishInfoDisplay chip dedupe by label, not just icon.
- `6ccad67` — v3 (Fix 5): scan preset yields to an explicit globe choice.
- `8147297` — dishname: track Latin and CJK separately, per slot by actual
  script.

---

## Seal at pick time — *(Sonnet)* — ✅ DONE `c7970f8`

Moved seal creation (`POST /api/seals`) from queue-load to the pick-confirm
moment on the scan page, so the prediction is committed when the user
ORDERS, not when they next open the Taste tab. Strengthens the honesty
framing; small change, endpoint already idempotent. (Also caught in the
2026-07-22 audit — had stayed listed as open after shipping.)

---

## Bilingual ingredient display — *(Sonnet)* — ✅ DONE via `713f645` (ingredientLabel.ts glossary)

Original item: "The ingredients line under the diet chips (DishInfoDisplay)
shows lowercase English as stored today. Give ingredients a zh/en pair so
the line reads native in Chinese-first mode."

Resolved by a different mechanism than the item imagined: no zh field is
stored per dish — instead the shared `src/lib/ingredientLabel.ts` glossary
(extracted during the taste-page UI batch, item 5) maps the fixed English
ingredient vocabulary to zh-HK names, and `DishInfoDisplay` renders
`ingredientZh(name) ?? name` in Chinese-first mode. Falls back to English
only for unmapped vocabulary — by design it never fabricates a zh name.
If unmapped English shows up in practice, the fix is a glossary row, not a
schema change. (Caught in the 2026-07-22 audit.)

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

## 1. Picker: 加入 must produce visible selected state — *(Sonnet)* — ✅ DONE

**Bug class:** silent success indistinguishable from silent failure.

In `src/components/RestaurantPicker.tsx`, a successful `createNew()` sets
`selectedKey='manual-new'` — which corresponds to no rendered element — and
leaves the add form open, input untouched. Nothing on screen changes. Users
reasonably conclude the tap failed and cancel, discarding the staged choice.
Two additional genuinely-silent paths exist: `confirmNew()` returns wordlessly
when `coords` is null, and the `namesMatch` same-place nudge can render below
the iOS keyboard.

**Shipped:**
- `createNew()` now collapses the add form (`setAdding(false)`) and a real
  chip renders for `selectedKey === 'manual-new'`, showing the typed name
  with the same `on` styling as a nearby chip. Tapping it (`reopenManual`)
  reopens the form pre-filled with the existing text — an edit, not a
  re-type — without touching `selectedKey`/`newName`.
- The `!coords` path in `confirmNew()` no longer just returns silently: it
  triggers a brief `needloc-flash` shake animation (new CSS keyframe,
  ink-only — kept inside the palette contract, nowhere near the vermillion
  seal/dirty-save reservation) on the existing `picker.needloc` caption, so
  a tap with location off visibly registers instead of doing nothing. The
  confirm button's `disabled` no longer double-guards on `!coords` (only on
  empty name) — `confirmNew()` itself owns that branch now, since it needs
  to fire the flash.
- The same-place suggestion nudge (`suggestion` state) now scrolls itself
  into view (`suggestionRef` + `scrollIntoView` in a `useEffect`) the
  moment it appears, so it can't render silently below the iOS keyboard.

**Tests:** `tests/restaurantPickerManualAdd.test.tsx` (2 tests, RTL/jsdom) —
after typing + 加入, a selected chip with the typed name renders and the
form collapses; tapping it reopens the form with the text preserved.
Confirm-with-no-coords fires the flash class instead of calling `onChange`.

**Verified live** (2026-07-22, owner account, real dish edit → 轉餐廳 →
+ 加間舖 → typed "新容記" → 加入): chip rendered selected, form collapsed,
儲存 went dirty-vermillion; tapping the chip reopened the form pre-filled.
Cancelled without saving — no test data left in the live account.

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

## 2. Typed-name resolution via Places Text Search — *(build: Sonnet; design decided here)* — ✅ DONE

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

**Cost discipline — verified against the live Google pricing table, 2026-07-22
(not assumed from the Nearby Search comment):** unlike Nearby Search, this
field mask does NOT land Text Search in the cheap "Essentials" tier —
`displayName`/`location`/`formattedAddress` each trigger "Text Search Pro"
(SKU 4FDA-34B1-A910): 5,000 free/month, then $32/1,000 up to the first 100k.
Accepted at triage since volume is bounded to one call per confirmed manual
add (only fires when the local nearby-chip list didn't already resolve the
typed name). No in-app daily quota cap exists for this or the sibling nearby
endpoint — quota control is at the GCP project level, not in code; flagging
this as an infra check, not something this item's code should invent.

**Shipped:**
- `src/lib/places.ts`: `searchPlacesText(query, lat, lng, radiusMeters=1000,
  languageCode, maxResultCount=5)` — same fail-soft discipline as
  `searchNearbyRestaurants` (no key → `[]`, non-ok response → `[]`, blank
  query → `[]` without calling Google).
- `GET /api/restaurants/search?q=..&lat=..&lng=..&lang=..` — new route, no
  cache (a typed name + coords bucket has poor hit locality, so a cache
  would add complexity for near-zero savings on already-bounded volume).
- `RestaurantPicker.tsx`: `confirmNew()` is now async. Order: local
  `namesMatch` check against the already-loaded `nearby` chips (unchanged,
  free, instant) → if no local match, ONE search-on-add call → matches
  render as a new multi-candidate nudge (`searchMatches` state, "搵到呢啲，
  係咪其中一間？" + a chip per candidate + a reject button that falls
  through to `createNew()`) → no matches → `createNew()` directly. New
  `searching` state disables the confirm button and shows a "搜尋緊…"
  caption during the round trip. The candidate block scrolls itself into
  view on appear (`searchMatchesRef`), same discipline as the existing
  same-place nudge.
- Two new i18n keys: `picker.searching`, `picker.searchmatch`.

**Tests:** `tests/places.test.ts` — request shape (textQuery, locationBias
circle, field mask, languageCode, maxResultCount), result mapping, fail-soft
on non-ok/no-key/blank-query (5 new tests). `tests/restaurantPickerManualAdd.test.tsx`
— a name the local list misses resolves via the search endpoint and picking
a candidate carries its `place_id`; rejecting every candidate falls through
to a manual create (2 new tests).

**Verified live** (2026-07-22, owner account, real dish edit → 轉餐廳 →
+ 加間舖 → typed "肯德基", not in the 6 local chips): search fired against
the real Google Places API, returned 5 real KFC branches near the dish's
coords under "搵到呢啲，係咪其中一間？"; picking one closed the nudge and
armed 儲存's dirty state. Cancelled without saving.

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

## 4. Companion edges (同檯 data layer) — *(Fable 5)* — ✅ DONE, 2026-07-22

Every CONFIRMED pick in a multi-member table session writes companion
edges: (user_a, user_b, dish_id, table_session_id, picked_at) for each
consenting member pair present. This is the "who you ate with" layer.

**Privacy lines (hard, decided):**
- Edges link accounts ONLY when both were consenting members of the same
  table session (joining a table = consent to be visible to that table).
- Guests generate NO edges until they have an account (and only for
  sessions after sign-up — no retroactive edge creation from pre-account
  stamps unless the re-key in item 3 happened within the live session).
- Export and UI speak display names only — never handles/emails/ids.
- RLS: a user can read only edges they are a party to. Verify policy with
  the standing dry-run pattern (pg_policy query + rolled-back insert).

**Payoffs to wire in this item (in order):**
1. 食記 entries show companion chops on shared-meal dishes.
2. AI export gains a companions layer — e.g. highest-rated dishes skew
   toward shared meals; frequent companions and the cuisines you explore
   together. Keep it to honest aggregate statements derived from real
   edges; no invented sociability. Feeds the export-versioning delta stream
   (a new companion appearing since last version is a legitimate delta
   line).
3. (Later, not this item) recurring-companion taste compatibility.

Schema design, RLS, and the export-prose judgment are why this is Fable 5.

**Shipped — schema (`supabase/applied/companion_edges.sql`, applied live):**
`companion_edges(id, user_a, user_b, dish_id, table_session_id, picked_at)`
with a canonical undirected pair (`check user_a < user_b`, so one row per
pair and no mirror-row bookkeeping) and `unique (dish_id, user_a, user_b)`.
Design decisions made here, per the spec's "implementer proposes" latitude:
- **All member pairs per pick, not just picker-pairs** — the spec's literal
  wording ("each consenting member pair present"), and the honest reading
  of communal HK dining: a pick at a shared table is shared BY the table.
  The picker stays derivable from `dishes.user_id`, so nothing is lost.
- **Late joiners backfill within the session** — joining consents you to
  the whole session (you can already SEE its picks via GET), so
  `/api/table/join` back-fills pairs involving the new member against
  existing picks, with `picked_at` kept as the PICK's own time
  (`dishes.created_at`), not the join time. The spec's "no retroactive
  edges" line governs guest pre-account sessions, not within-session join
  order — tap-timing asymmetries would be noise, not signal.
- **FK conventions mirror the schema's own precedents:** dish deletion
  (un-pick, or a later journal delete) CASCADEs edges away; account
  deletion cascades; table-session deletion SETs NULL (same as
  `dishes.table_session_id`) so historical companionship survives session
  cleanup.
- **RLS:** party-only SELECT (`auth.uid() in (user_a, user_b)`), NO client
  write policies at all — writes go through the service role in exactly two
  routes. Proven with the standing dry-run pattern, all rolled back: party
  SELECT returns the seeded edge; a random third-party uid sees 0 rows; an
  authenticated INSERT fails with 42501.

**Write paths (both best-effort with logged failures — an edge miss must
never fail the pick/join itself, but this repo's silent-write-death failure
class means it must at least leave a server-log trace):**
- `POST /api/dishes/pick`: on a table-session pick, all member pairs per
  inserted dish, upserted with `ignoreDuplicates` on the unique index.
- `POST /api/table/join`: backfill for the joiner (runs on idempotent
  re-joins too, so a once-failed backfill self-heals on the next join).
Pure pair/aggregation logic lives in `src/lib/companions.ts`
(canonicalPair / edgeRowsForPick / edgeRowsForJoin / companionStats),
10 vitest cases in `tests/companions.test.ts`.

**Payoff 1 (食記):** `GET /api/my/dishes` joins each page of dishes against
the caller's OWN edges (party-scoped — a dish's (other,other) pairs belong
to those members' journals, not mine) and returns `companions: [{name}]`;
MyDishes renders a quiet 「同檯」 + `Chop` row under the dish info. Identity
chain is display_name-else-handle — the SAME chain the table's live stamps
used, so a person doesn't change name between the meal and the diary of it.
(The strict display-names-only privacy line is interpreted as governing the
EXPORT prose; in-app, the handle already IS the person's visible table
identity, and rendering a different one in 食記 than they had at the table
would be wrong.)

**Payoff 2 (AI export):** `/api/taste/export` aggregates the caller's edges
server-side (companionStats + dish-cuisine join) and returns display names
ONLY — companions who never set one arrive as an anonymous `unnamedCount`,
never as handles. `buildTastePrompt` renders a fixed-heading "## Who I
actually eat with" section (facts, not inference, so it isn't band-gated —
it exists exactly when edges exist) with per-companion meal/dish counts and
cuisines-together, plus an "N of these were shared-table meals" line on the
loved-anchors section (`ExportDish.shared` ← journal companions). The
export-versioning delta gained new-companion detection with ZERO new
storage: a companion is "new since the last export" when their earliest
shared `picked_at` postdates `taste_profiles.last_export_at`. The client
shows it as 「新檯友：{names}」 under the version note. 5 new prompt tests
in `tests/tasteExport.test.ts`.

**Verified live** (2026-07-22, real `K8Q4G` session, both real accounts):
tester joined + picked via the UI → one canonical (owner, tester) edge row
appeared with the session id; owner picked the same dish → second dish's
edge; owner rated theirs via the real ratings endpoint → 食記 showed the
entry with 「同檯 W」 (screenshot posted); owner generated a real export →
"## Who I actually eat with / - Wool: 1 meal together, 2 shared dishes —
mostly japanese" + the shared-anchors line + the 「新檯友：Wool」 delta
line (screenshot posted). Cleanup verified exact: deleting the two dishes
cascaded ALL edges away (0 left — the FK design proving itself), tester's
display_name + membership reverted, owner's export baseline
(last_export_vector/at, profile_version) restored byte-identical from a
pre-test backup. tsc clean; 480/480 tests.

---

## 6. Joined members can add scan pages too, not just the host — *(Sonnet)* — ✅ DONE, 2026-07-22

**Owner decision (2026-07-22):** any member can append freely — no
confirmation gate. Also decided at build time: if a later page scans the
same dish at the same price as something already on the shared menu,
disregard it rather than adding a duplicate row.

**Authorization** — `PATCH /api/table/[code]` swapped its `session.host_id
=== user.id` check for a `table_members` row lookup (the exact query
`GET /api/table/[code]` already used one function up, for consistency).
The append itself was already safely concurrent (the underlying Postgres
function row-locks the session), so opening it to any member needed no
concurrency changes — only who's allowed to call it.

**Dedup (the owner's "if same dish and same price... disregard" ask)** —
implemented server-side, inside `append_table_menu_items` itself, not in
the TypeScript route: the function already does a row-locked read of
`current_items` before appending, and doing the filter there (rather than
a separate JS-side read-then-filter before calling the RPC) means it
inherits that same lock — two members appending an overlapping page at
nearly the same moment can't both sneak a duplicate past a stale read.
Match key: case/whitespace-normalized printed name (`name_original`,
falling back to `name`) + exact price string — same text and price is
"the same dish"; a genuine price difference (a size variant, a menu
update) is kept as a distinct row on purpose. Applied live via Supabase
MCP (`append_table_menu_items_dedup` migration) and dry-run tested
(`begin`/`rollback` against a temp session) before trusting it: exact
duplicate filtered, same-name-different-price kept, genuinely new dish
kept — all three assertions passed. Recorded in
`supabase/applied/append_table_menu_items_fn.sql` with the amendment
dated and reasoned.

**Entry point** — built directly on `table/page.tsx`, not by redirecting
into `/scan?code=`: scan/page.tsx's own append flow is built around a
scanner's own local `result` state (incremental per-item rendering, dedup
against ITS OWN accumulated items, restaurant-guess reconciliation) that
this screen doesn't have and was never meant to hold — the shared
poll-refreshed ranked list is the only view of the menu here. Deliberately
NOT touched: scan/page.tsx's `onPick` function is untouched, zero
regression risk to the app's core loop. What table/page.tsx's new
`addPage()` DOES share with scan's flow: the same three endpoints
(`/api/menu-scan` NDJSON stream, `/api/menu-scan/enrich`,
`/api/menu-scan/score`) and `shapeTableMenuItems` server-side — a second
CALLER of that pipeline, not a second implementation of it. UI: a
"加掃一版" button (same i18n keys and `.scan-appending`/`.btn.ghost.small`
styling scan/page.tsx already uses) in the title row, shown only for a
scan-shared session (`has_menu && !orderable` — a QR/restaurant session's
menu comes from its own live-curated items; `PATCH` already rejected
appends there). On success, calls `refresh()` immediately rather than
waiting for the next 5s poll tick.

**Verified live** (2026-07-22, real `K8Q4G` session, 9 items, host = owner):
joined as the tester account (non-host), confirmed the 加掃一版 button
renders for a joined member; called `PATCH /api/table/K8Q4G` directly with
a fabricated dish as the non-host member — 200, count 9→10 (authorization
fix confirmed, no 403); sent the exact same item again — count stayed at
10 (dedup confirmed against the live database, not just the dry run).
File uploads aren't scriptable through the available browser tooling, so
the literal scan→enrich→score leg of the pipeline itself wasn't exercised
end-to-end live — it's unchanged, identical-shape reuse of scan/page.tsx's
own already-verified-in-production endpoints, but flagging the gap rather
than overclaiming. Test data (the fabricated item, the tester's
membership row) reverted after verification — `K8Q4G` is back to its
original 9-item, host-only state.

---

---

# Backlog additions — 2026-07-22 (identity-confirm card on the duel chassis)

Context: resolves the UI half of the standing dish-identity-resolution item
(same real-world dish, different AI names — 蝦餃 vs 水晶鮮蝦餃). Confirmed
design (Jerry): reuse the 今日對決 card as the shared chassis; identity
confirmation becomes a second mechanic on the same surface.

---

## Dish-identity confirm card (係咪同一味？) — *(Fable 5, extends the existing dish-identity backlog item)* — ✅ DONE, 2026-07-22

**Chassis reuse (from the duel card, wholesale):** two-dish side-by-side
layout, photo-else-name-card sides, bold dish names, restaurant subtitle,
quiet skip pattern, inline result strip after answering.

**Deliberate divergences (NOT optional):**
- **Sides are not tappable.** In a duel, tapping a side means "I prefer
  this" — identical affordance here would let duel muscle memory merge two
  dishes by accident. Answers come ONLY from a button row beneath:
  - ✓ circle-check icon → 係同一味
  - ✗ circle-X icon → 唔同嘅
  - text link, de-emphasized → 唔肯定 (skip semantics + cooldown, borrowed
    from duels)
  Icons per Jerry: circle check for yes, circle X for no. Ink-colored,
  house line-icon weight — not green/red (paper-and-ink palette holds;
  the icon shapes carry the meaning).
- **Different header, no seal glyph** — nothing is predicted or sealed
  here. Header: 係咪同一味？ (en: "Same dish?"). The card must be
  instantly distinguishable from 今日對決 at a glance.

**Answer mechanics:**
- 係同一味 → link both dishes to one `dish_identity` at `AUTHORITY_HUMAN`;
  existing canonical-name propagation does its job. Result strip confirms
  in plain speech (e.g. 已合併 — 依家兩個名都指住同一味菜).
- 唔同嘅 → write a NEGATIVE pair (new storage — sibling table or a
  verdict column on the pair record; implementer proposes, flags
  tradeoff). A denied pair is never asked again. Re-asking reads as the
  app not listening; the negative record is as load-bearing as the merge.
- 唔肯定 → cooldown re-ask window (duel DUEL_RECENT_DAYS pattern), never
  more than the log-time cap below.

**Authority interaction (recommended, flag in implementation):** a human
唔同嘅 verdict must NOT be silently overridden by a later menu-scan
asserting sameness (scan authority 3 > human 2 on NAMES, but identity
DISTINCTNESS is a different assertion — the ladder governs what a dish is
called, not whether two dishes are one). Proposed rule: human distinctness
verdicts are sticky; a conflicting owner/menu-scan signal queues a
re-confirm card instead of auto-merging. If implementation finds this
conflicts with existing owner-authority wiring, STOP and surface — this is
exactly the judgment call the Fable 5 tier exists for.

**Trigger point:** log time. When a log's dish name fuzzy-matches an
existing `dish_identity` at the same restaurant (candidate scoring: the
fuzzy-match direction already named in the standing backlog item), the
card appears inline in the post-log flow. HARD CAP: one identity question
per log. No identity cards on the Taste tab in v1 (avoid competing with
今日對決 for the same slot).

**Compounding effects (wire, don't just note):**
- Duel pair selection already excludes same-identity pairs — every
  confirmed merge upgrades future duel quality; every denial protects a
  genuine contrast pair.
- Merges feed the owner-dashboard "popular from menu scans" accuracy and
  the eventual owner menu-item matching (standing Fable 5 item).

**Tests:** merge path links identities + propagates canonical name;
negative pair suppresses re-asks permanently (both orderings); 唔肯定
cooldown; one-per-log cap; human-distinctness stickiness vs a scan
sameness signal; duel selection reflects post-merge identity state.

**Shipped — what the spec's open calls resolved to:**
- **Negative-pair storage: verdict column, not a sibling table** (the spec
  asked the implementer to propose + flag the tradeoff). The existing
  `dish_identity_dismissals` table — which already recorded permanent
  denials and was already read symmetrically per pair — gained
  `verdict ('different'|'unsure')`
  (`supabase/applied/dish_identity_dismissals_verdict.sql`, applied live).
  A sibling table would have re-implemented the same unique key with a
  worse join. Tradeoff accepted: 'unsure' rows refresh in place
  (created_at is the cooldown clock), so there's no history of repeated
  唔肯定 answers — nothing consumes that history. 'different' upserts now
  MERGE (not ignoreDuplicates) so a real denial overwrites an expiring
  unsure. Cooldown = 30 days (`IDENTITY_UNSURE_COOLDOWN_DAYS`, the
  DUEL_RECENT_DAYS rhythm), pure-tested in `dismissalBlocks`.
- **Authority interaction: the stickiness rule is structurally satisfied —
  no STOP needed.** Audited every write path: `ownerMenuReconcile` only
  RENAMES identities already linked by a human (and links them to owner
  menu items); nothing anywhere sets `dish_identity_id` automatically.
  Gate 3 — the human — is the only merge author in the system, and
  candidate pairs are filtered through human verdicts BEFORE gates run.
  A scan/owner sameness signal therefore cannot override a 唔同嘅 even in
  principle; documented in dishIdentity.ts's PAIR VERDICTS section.
- **Chassis reuse is enforced, not aspirational:** the side anatomy
  (photo-else-blank, zh-pinned DishName, location) was EXTRACTED from
  DuelOverlay into `DuelSide.tsx`; both cards mount it, and
  `tests/identityCardChassis.test.tsx` fails if the identity card ever
  re-implements it inline (banned markers), if its sides become buttons,
  or if a seal glyph appears. The 唔肯定 link reuses the duel's own
  `.duel-tie` treatment; answer circles are ink-only (palette contract).
- **Trigger points:** log time — RatingStack probes on restaurant-attach
  (nearby pick + manual add) and, for queued picks (born at a restaurant),
  on growth-screen entry (first 3, sequential, stop on first hit); the
  card renders inline via TasteGrowth's `identitySlot`. HARD CAP one per
  log session (a ref that never resets). Plus the journal's retro sweep,
  now mounting the SAME card (the old plain yes/no text card deleted, its
  5 `log.samedish.*` keys removed). No cards on the Taste tab.
- **Sweep reopen:** `identityRecheckDue` — a "checked, nothing found"
  stamp reopens after the same 30-day window, fixing a pre-existing hole
  where a dish that GAINED a lookalike later could never be asked about
  again (checked_at used to block forever), and giving expiring 唔肯定
  pairs their re-ask path.
- **Fixed in passing (pre-existing):** the journal sweep's in-flight
  suggestion was silently discarded whenever `dishes` re-set during a
  normal load (cache first, fresh fetch after) — the cleanup-scoped
  cancel killed it every time. Found live when the card refused to
  appear; result application now survives data refreshes and drops only
  on real unmount.
- **Compounding:** duel selection already excludes same-identity pairs
  (duels.ts:81, live DB read per selection) — a merge upgrades duel pair
  quality immediately, no new wiring needed.

**Verified live** (2026-07-22, owner account, REAL data — the two
identical 蛋撻 rows at 美心皇宮 中環店 that genuinely need this feature):
journal sweep probed (gate 1 string hit, gate 2 LLM confirmed, ~4s),
the 係咪同一味 card rendered on the duel chassis with both real photos,
zh-primary names, restaurant • district subtitles, circle-✓/✗ + 唔肯定,
no seal glyph (screenshot posted). Answered 唔肯定 live → card closed
quietly, `verdict='unsure'` row written with a fresh clock; reload →
no re-ask (cooldown suppression proven live). Cleanup: the test verdict
and the suppressed probe's checked_at stamp were reverted, so the OWNER
gets asked the real question naturally — deliberately did NOT answer the
merge on the owner's real pair; that's their call. The merge path's
result strip + POST body are covered by the jsdom chassis tests, and the
server merge path itself is unchanged production code. Honest gap: the
RatingStack log-time mount was verified by code + the same GET the sweep
exercises live, not driven end-to-end (needs a real photo flick).
tsc clean; 491/491 tests (11 new).

### Polish refinements (2026-07-22) — ✅ DONE `a569c36`, `e4e078f`

Two styling touches on the identity card after initial ship:
- **`e4e078f`:** fill ✓/✗ circles black with white icon by default (was outline-only, filling only on :active). Matches the reveal's OK-circle treatment in `src/app/globals.css`.
- **`a569c36`:** drop 係同一味/唔同嘅 button copy, icons carry the meaning — aria-label only, no visible text. Matches the reveal's own circle-check convention. Component + test updates in `IdentityConfirmCard.tsx` + `identityCardChassis.test.tsx`.

---

# Backlog additions — 2026-07-22 (log entry: three paths by what you're holding)

Confirmed design (Jerry): reorganize log entry around what the user is
HOLDING, not how they classify the meal. The three chips 餐廳菜/住家菜/相簿舊菜
are replaced by:

  📷 食物相 · Food photo      — any photo of food, now or from the library
  ✎ 打字      · Type it        — no photo; name the dish, rate it
  🧾 外賣單   · Delivery order  — screenshot of an order/confirmation screen

相簿舊菜 is ABSORBED, not lost: old-photo treatment (fuzzy eaten-date, no
restaurant context assumption) triggers automatically from EXIF age — that
chip was asking users to do the machine's job. Retro-pick-at-scan-time is
REJECTED (contaminates the "what should I order" moment); the saved-menu
ask-later variant is parked as a possible future interaction, not built.
Killed with it: the multi-channel hero animation.

Hard guardrails carried from prior decisions: every imported/entered dish
lands UNRATED (frequency ≠ preference — no channel writes implicit positive
signal); no lingering count-badge guilt — rating happens in capped,
session-shaped moments; each path writes its `source` flag for the engine's
coverage-bias treatment.

Items 2 (食物相 inferred context) and 4 (外賣單 delivery pipeline) are
Fable-tier and remain open in BACKLOG.md.

---

## 1. IA change: chips, copy, icons, explanation card — *(Sonnet)* — ✅ DONE, 2026-07-22

**Chips on the dark banner (replacing the current three):**
- 食物相 — camera outline icon (reuse existing house camera glyph)
- 打字 — pencil outline icon (house line weight; NOT a keyboard glyph —
  too dense at chip size)
- 外賣單 — takeaway-box outline icon (proposed; if the box reads as
  "leftovers" in testing, fallback is a phone-with-receipt glyph — flag at
  build time with both rendered)

Copy register: 口語, per standing localization rule — these are short
brand-voice moments. English strings: "Food photo" / "Type it" /
"Delivery order".

**Explanation card ((i) popover on the banner) — revised copy, proposed:**

  影低、打低、定 cap 低 — 樣樣都得。
  📷 食物相 — 影相或者揀返舊相，AI 認菜。
  ✎ 打字 — 冇相？打個菜名就得。
  🧾 外賣單 — cap 低張外賣單，成單菜一次過入晒。
  評完，你嘅口味 AI 就學多一步。

  (en) Snap it, type it, or screenshot it.
  📷 Food photo — shoot or pick from your library; AI reads the dish.
  ✎ Type it — no photo? The name is enough.
  🧾 Delivery order — screenshot an order and every dish comes in at once.
  Every rating teaches your taste AI.

Jerry owns final copy; the above is the working draft. "cap 低" is
deliberate HK code-switch — flag if too casual for this surface.

**Implementation notes:**
- Built `PencilIcon`/`TakeawayIcon` in `icons.tsx` at the same house line
  weight as `UtensilsIcon`/`HomeIcon`/`PhotoIcon` (stroke 1.3); reused the
  existing `CameraIcon` at that weight for 食物相 rather than a new glyph
  ("reuse existing house camera glyph"). Only the box variant was built for
  外賣單 — flagged for owner review rather than shipping both variants live.
- The card title changed from "食物相食評" to "記低你食咗乜" (Ways to log a
  dish) since the popover now covers all three paths, not just photos —
  Jerry's copy sign-off still applies to the pasted body text, this title is
  a working default.
- **外賣單's interim behavior (open question in the pasted spec, resolved
  with the owner before building):** item 4's real vision-extraction
  pipeline is Fable-tier and not part of this pass. Asked the owner what
  外賣單 should do until then — chose "route to the same photo picker as
  食物相" over holding the chip back or showing it disabled. So today, both
  食物相 and 外賣單 open the same multi-select photo library and feed the
  same photo-rating pipeline; 外賣單 becomes its own real (vision-extraction)
  pipeline when item 4 ships.
- `.explain-modal-body` gained `white-space: pre-line` so the popover's
  per-icon bullet lines actually break instead of collapsing into one run-on
  paragraph — additive, no effect on other callers' single-paragraph copy.

**Verified live** (owner account): screenshotted the three-chip banner
(camera/takeaway-box/pencil icons) and the explanation card rendering the
line-broken bullet copy correctly.

---

## 3. 打字: typed quick add — *(Sonnet)* — ✅ DONE, 2026-07-22

The floor of the core action: just ate something, no photo, ten seconds.

**Order of collection (decided): dish name FIRST, then restaurant.** The
dish is what they remember; the restaurant is context. Predictive input on
both:
- Dish field: suggest from `dish_identities` at nearby/recent restaurants
  first, then the user's own dish history, then generic completion. Chinese
  field before English per the standing log-flow polish item; auto-translate
  hint on the untouched field.
- Restaurant field: nearby chips + typed Text Search (reuses the picker
  work wholesale), 屋企 as a first-class chip, skippable (unattached dish
  is allowed — better a logged dish than an abandoned flow).
- Then the SAME rating moment as the photo path, on a blank card (name +
  restaurant, no image). Blank-card visual: existing card anatomy minus
  photo slot — do not invent a placeholder illustration; absence is honest.

**Enrichment: immediate, not lazy** (decided, flag if cost objects): one
text-path enrich call on commit so ingredient chips / flavor derivation /
diet flags exist by the time the rating lands — the rating context is the
point of enriching at all.

**Tests:** predictive ordering (identity matches outrank generic);
skip-restaurant path; enrich-on-commit; source flag.

**Implementation notes:**
- The backend for typed dish creation already existed (`POST /api/dishes`
  JSON mode, `createFromName`) from the earlier "fix B" work (defer
  typed-name enrichment) — this item is almost entirely new frontend: a
  `TypedQuickAdd.tsx` two-step overlay (name → restaurant) plus a new
  `GET /api/dishes/suggest` endpoint and a `RatingStack` typed-mode.
- **Suggestions, two tiers, not three:** nearby-restaurant `dish_identities`
  (via the existing `nearby_restaurants` RPC when a restaurant isn't chosen
  yet) then the person's own dish history — merge/dedupe logic lives in
  `src/lib/dishSuggest.ts` (pure, tested). The spec's third "generic
  completion" tier was dropped: Dishi has no browsable dish dictionary
  beyond what someone has actually logged, so a fake-choice tier would be
  worse than two honest ones. Flag if a real global-vocabulary source is
  ever wanted.
- **屋企 vs 略過 distinction:** `RestaurantPicker`'s `RestaurantChoice` type
  gained a `{kind:'home'}` variant (previously both chips produced `null`
  indistinguishably) — additive; the two existing callers (`scan/page.tsx`,
  `MyDishes.tsx`) only ever check `.kind === 'existing' | 'new'`, so `home`
  falls through to their existing "no restaurant" behavior unchanged. This
  is what lets `buildTypedDishBody` (`src/lib/typedQuickAdd.ts`, pure,
  tested) set `dishes.source` to `'home'` vs `'manual'` correctly, matching
  `createFromName`'s existing rule.
- **Enrichment really is immediate, not the usual fix-B defer:** commit
  order is create → AWAIT `/api/dishes/enrich` → THEN show the flick card,
  so the blank card already carries real ingredient/diet chips at the
  rating moment (verified live — see below). Cost accepted per spec: the
  person waits through "AI 認緊呢道菜…" (observed ~15-25s live) before the
  card appears, same order of magnitude as the enrich route's own
  documented 20-30s.
- **`RatingStack` gained a third mode** (`typed?: TypedEntry[]`), alongside
  `photos`/`picks`. Unlike `photos` (created ON flick) and `picks` (never
  ours to delete), a typed entry is created BEFORE the component mounts —
  so `sessionDishIds` is seeded on MOUNT (a new effect), not inside the
  pipeline function, and `cancelSession`/"nothing rated" were unified onto
  one `discardAndExit` helper so a ✕ or an all-skip before ever flicking
  still discards the just-created, unrated dish instead of leaking it
  (verified live against the DB — see below). No second `enrich()` call
  from `runTypedPipeline`: the enrich route's already-enriched early-return
  doesn't select `diet`/`heaviness`, so a redundant call would blank those
  chips back out client-side — flagged as a follow-up on that route
  (pre-existing latent risk for scan-picks too, out of scope here).

**Verified live** (owner account, real create+enrich+seal+rate round trips
against the live DB, cleaned up after):
- Happy path: typed 蛋撻/egg tart, picked the own-history suggestion chip,
  chose 住家菜 → committed → the blank card showed REAL chips (蛋/奶類/牛油/
  適中) already populated before rating, not after → flicked a positive
  rating → landed in 已評菜式 with `source:'home'`, engine stats moved
  (食評 36→37, 味覺調校 11/18→12/18) → deleted via `/api/my/dishes` DELETE
  (cascade + replay), stats reverted to baseline.
- Discard path: typed a dish, chose 略過 (confirmed `source:'manual'` in
  the DB), committed, then closed with ✕ WITHOUT rating — confirmed via
  direct DB query that the just-created dish was gone (not orphaned).

tsc clean; 503/503 tests (17 new: `dishSuggest.test.ts`,
`typedQuickAdd.test.ts`).

---

## Rollback: log-entry redesign items 1 + 3 — 2026-07-22, same day as ship

Owner feedback after live use, reported directly (not a design-review
pass): tapping 而家評 on a typed entry hung indefinitely at "AI 認緊呢道菜…"
(enrich never visibly resolved, despite resolving in ~15-25s during
build-time live verification — a real gap between what got tested and what
the owner actually hit); the predictive dish-name/restaurant lookups felt
slow; the `TypedQuickAdd` overlay's styling was raw and inconsistent with
the rest of the app (ad hoc `<h3>`/plain inputs on `.rate-sheet`/`.card`,
not integrated with any existing form system). Owner's framing: "avoid
breaking what was a better experience."

**Reverted** (`src/app/profile/page.tsx`, `src/lib/i18n-dict.ts`,
`src/app/globals.css`): the entry pill back to 餐廳菜/住家菜/相簿舊菜 with the
original icons and file-input behavior; the explanation-card copy back to
食物相食評 verbatim, character-for-character against the pre-2026-07-22
version. No behavioural difference from before item 1 ever shipped.

**Preserved, unmounted** — owner explicitly wants the predictive-suggestion
piece re-tested once the hang and styling are fixed, so nothing behind it
was deleted: `TypedQuickAdd.tsx`, `RatingStack`'s `typed` mode, the
`{kind:'home'}` addition to `RestaurantPicker`'s `RestaurantChoice`,
`GET /api/dishes/suggest` + `src/lib/dishSuggest.ts` (predictive ranking),
`src/lib/typedQuickAdd.ts` (request-body builder). All still pass their
existing tests (`dishSuggest.test.ts`, `typedQuickAdd.test.ts`,
`identityCardChassis.test.tsx`, `restaurantPickerManualAdd.test.tsx`) —
none of that logic changed, only the entry point that reached it.

**Re-opened in BACKLOG.md** (items 1 and 3, both flagged REOPENED, not a
fresh spec): item 3 specifically needs the hang diagnosed for real before
anything else — is enrich actually completing server-side with the client
just never finding out, or does it genuinely stall for some inputs — plus a
client-side timeout/fallback so a slow enrich can never strand someone on a
blank screen. Item 1 needs a design pass, not a re-land of the same pill.

tsc clean; 503/503 tests (unchanged — the revert only touched already-shipped
render code, not the preserved lib/API/component layer or their tests).

---

## Predictive dish-name suggestions in the EXISTING rating flow's rename UI — *(Sonnet)* — ✅ DONE, 2026-07-22

Owner's ask after the rollback above: "add predictive suggestion to the
existing rating flow" — not the abandoned 打字 overlay, but a real,
already-shipped surface where a person types a dish name: the rename editor
inside `TasteGrowth.tsx` (the `.learn-nameedit` block — opened either to
correct a vision-guessed name, or via "係嘢食嚟" reclassify on a mis-flagged
non-dish). This is the SAME `GET /api/dishes/suggest` +
`src/lib/dishSuggest.ts` ranking preserved from the rolled-back build, wired
into a different, already-trusted UI instead of a new overlay.

**Why this sidesteps every complaint from the rollback:**
- No hang: rename is a pure client-side edit + `onEditName`/`onReclassify`
  callback — no enrich-before-rating wait in the critical path at all.
- No slow location lookup: reuses the dish's ALREADY-RESOLVED coords
  (`live[editIdx].coords`, from EXIF or the live-GPS fallback RatingStack
  already ran) for the nearby-restaurant bias — no fresh
  `navigator.geolocation` call, which is what made the quick-add flow feel
  slow.
- No raw/inconsistent styling: renders as a `.chips`/`.chip` row using the
  exact same classes as everywhere else in the app, inside the existing
  `.learn-nameedit` card — not a new ad hoc overlay.

**Behavior:** opening the rename editor pre-fills 中文/英文 with the current
name, which immediately fires one suggestion lookup (own-history matches
show up before the person types anything — a proactive hint, not just a
reactive autocomplete). Typing further re-queries on a 250ms debounce.
Picking a chip fills both fields and marks them dirty (turns 儲存
vermillion, per the standing dirty-save convention) exactly like a manual
edit would.

**Verified live** (fixture-mounted `TasteGrowth` against the real
`/api/dishes/suggest` endpoint — a temporary preview route, screenshotted,
then deleted, per the file-upload limitation on scripting a real photo
through this browser tooling): opened the rename editor on a 蛋撻 fixture,
the own-history suggestion appeared immediately without typing, tapping it
filled 中文/英文 (蛋撻/egg tart) and turned 儲存 vermillion.

tsc clean; 503/503 tests (unchanged — reuses `dishSuggest.ts`/the suggest
route as-is, no new pure logic to test).

---

## Carb-tripwire follow-up: honest vector re-score — *(Fable 5)* — ✅ DONE, 2026-07-22

Original backlog entry (verbatim): Open follow-up from the shipped
carb-metonym work (DECISIONS.md, 07-20 batch item 4): the tripwire corrects
ingredients/diet but not the 18-dim attribute VECTOR or an already-polluted
NAME — honest vector re-score needs the name re-authored first
(translate/vision + authority ladder). Costs one more LLM call per fire;
recommended, cost accepted at triage.

**What actually shipped — three legs:**

**1. Prevention at source (always-on, the load-bearing find).**
`SCORE_ONE_SYSTEM` — the prompt whose 18 numbers the engine actually eats —
was the ONE derivation prompt still carrying NO shorthand glossary: 炆米
could be scored as a braised-rice dish even after the enrichment tripwire
had corrected the ingredient chips. It now embeds
`HK_MENU_SHORTHAND_GUIDANCE` (the can't-silently-drop embed test extended
5 → 6 sites), and `scoreOneDish` accepts `name_zh` so the scorer sees the
shorthand-bearing 中文 name — both scan-score and dishes-enrich call sites
pass it. This fixes the SCAN path's vectors at source, which matters because
no fire-triggered re-score can practically run there (score and enrich are
separate parallel client calls; with the scorer reading shorthand correctly,
cross-call re-score orchestration buys nothing). Cost: ~250 extra input
tokens per score call, qwen-tier — accepted as the trust-critical fix.

**2. Correction on fire (the extra call the triage accepted).**
`enrichOneDish` now returns `EnrichmentResult` = Enrichment +
`carb_suspect?: boolean`, set when the carb tripwire fired on the first
pass — deliberately true even if the re-ask itself failed (a failed retry
leaves the reading MORE suspect, not less). `/api/dishes/enrich` acts on it,
name FIRST then numbers, per the spec's ordering:
- EN name: only when the EN slot is machine-fillable (`needEn` — an
  empty/placeholder slot, so this structurally can never demote a human or
  menu name), re-translate WITH the glossary
  (`translateDishName(seed, { guidance })` — the base translate prompt
  stays small for the every-rename fast path; guidance is opt-in).
- Vector: one re-score via the new `buildScoreUserText` composition —
  both names + `Key ingredients (verified): …` (grounding in the corrected
  recipe the re-ask produced, the strongest honest signal held) + the SAME
  `CARB_RECHECK_LINE` the enrichment retry uses, so the two retries speak
  identically and can't drift. Pure + unit-tested (6 tests).
- The route's existing replay-if-rated block then heals the profile with
  the corrected vector — no new machinery.
Cost honesty: the triage accepted "one more LLM call per fire" (the
re-score); the name redo is a second ~60-token rider on the same fire, and
only when the EN slot was empty anyway — flagged here rather than silently
exceeded.

**3. Backfill extension (stored pollution).**
`backfill-carb-shorthand.ts --apply` previously refused to touch name/vector
by design ("needs name re-author first — review by hand"). Now that the
honest path exists: ladder-guarded EN re-author + grounded vector re-score +
ONE profile replay per affected owner (same mechanism as a re-rate). The
ladder guard is a new pure helper `canReauthorEnName` in `dishIdentity.ts`
(7 tests): machine re-authoring is allowed only on a machine-derived EN name
— never `name_edited_at` (HUMAN, hard stop), never an identity-linked dish
(canonical name lives on the identity row; conservative skip), and only
with a CJK zh seed distinct from the EN to re-translate FROM. The zh name
is NEVER re-authored by this path — it may be the printed original, and
misreadings only ever live in derived fields. Rationale for why scan-dish
EN re-authoring is NOT a MENU-tier demotion: the zh is the menu's verbatim
truth; the EN was authored by the scan model, so re-deriving it from the
same zh original is a better rendering of the same MENU-tier source.

**Verified live** (2026-07-22, real model + real DB):
- Backfill dry-run against prod: 60 dishes scanned, 0 suspicious — the
  07-20 backfill + glossary already cleaned the stored set, so there was
  nothing to --apply (the extended script's query/guard/reporting path ran
  end-to-end regardless).
- Live harness (throwaway script, deleted): the grounded re-score returned
  a real vector reading 蝦子炆米 as a braised VERMICELLI dish (braised 0.9);
  `enrichOneDish` on the polluted stored shape (EN "Braised Rice" / zh 炆米)
  now reads "rice vermicelli" at FIRST pass — no fire, `carb_suspect`
  false, i.e. the glossary preventing rather than the backstop correcting;
  the glossary-guided re-author turned "Braised Rice" into "Braised Rice
  Vermicelli with Shrimp Roe".
- Honest gap: `carb_suspect` was not observed firing live — the model no
  longer misreads the known cases, and the flag exists precisely for the
  residual failure mode. Its plumbing is deterministic code covered by
  type-checking + the pure-function tests around it.

tsc clean; 515/515 tests (12 new: buildScoreUserText ×6 in
`carbShorthand.test.ts`, canReauthorEnName ×7 in `dishIdentity.test.ts`,
embed test extended in place).


---

# Batch: diet taxonomy growth — tree nuts + soy, gluten rejected (2026-07-23)

Original backlog entry (verbatim): **[F] Diet taxonomy growth (gluten, soy,
nuts-general).** The 雞扎 fix took DIET_FLAGS from 7 → 13 (added poultry/lamb/
egg/dairy/offal). Further allergen axes are real but each needs its own
recipe-grounding thought — do NOT bolt them on ad hoc; keep the vocabulary
closed and deliberate.

---

## Diet taxonomy growth — *(Fable 5)* — ✅ DONE, 2026-07-23

**Owner decisions (per-axis, 2026-07-23):**
- **tree_nut: ADD.** Structural and visible in HK dishes (腰果雞丁, 核桃蝦,
  合桃糊, 開心果, 松子炒飯); closed morpheme set; real allergen value.
  Kept SEPARATE from `peanut` (medically correct — peanut is a legume,
  tree-nut allergy is distinct). Label 果仁 / "Tree Nuts".
- **soy: ADD as STRUCTURAL-ONLY.** The tension: soy sauce contains real soy
  protein and is in essentially every Cantonese dish — an allergen-honest
  soy flag would mark ~90%+ of dishes and carry zero information. The honest
  version flags soy-BASED foods only (豆腐, 腐皮/腐竹/枝竹, 腐乳, 豆漿, 豆豉,
  edamame, miso), labeled 豆製品 / "Soy-based" — deliberately NOT 大豆/"Soy" —
  so it never reads as an allergen-safety claim. The guidance states
  explicitly: soy sauce / oyster sauce as seasoning alone never fires it.
- **gluten: REJECTED (do not ship).** Worst information-to-risk ratio: trace
  gluten (soy sauce, oyster sauce, hoisin) is near-universal in Cantonese
  food → honest flagging marks everything (noise); structural gluten
  (noodles, bread, dumpling skins, batter) is already visible via the carb
  and ingredient chips; and an absent chip misread as "gluten-free" is
  exactly the false-safety harm the honesty principles exist to prevent
  (蝦餃 skin is wheat starch — gluten-adjacent even looking rice-based).
  Revisit only on a real user need. Pinned by test: `DIET_FLAGS` must NOT
  contain 'gluten'.

**Judgment calls baked into the guidance/tripwire (the recipe-grounding
work that made this Fable-tier):**
- tree_nut EXCLUDES 栗子 chestnut (allergen-distinct, and 栗子雞 is common),
  白果 ginkgo, 蓮子 lotus seed, 馬蹄 water chestnut — named non-fires in
  DIET_PROMPT_GUIDANCE.
- 杏仁 trap: in HK desserts 杏仁 (杏仁茶/杏仁豆腐) is usually APRICOT KERNEL,
  not almond — related Prunus species, flagged as tree_nut either way;
  'apricot kernel' is a supporting ingredient key.
- 杏仁豆腐/"almond tofu" added to DIET_NAME_TRAPS in BOTH name surfaces
  (traps strip zh and en): it's an agar/milk dessert with zero soybean, and
  without the trap the 豆腐/tofu morpheme would demand soy of a common
  dessert on every single enrichment. Its genuine tree_nut flag stays
  consistent through the ingredient keys, so stripping costs nothing there.
  (The en-surface gap was caught during test-writing — traps only stripped
  the zh compound, and the English "Almond tofu" kept firing rule 1.)
- Tripwire morphemes are FULL COMPOUNDS only: bare 仁 collides with 蝦仁
  (shelled shrimp), bare 果 with every fruit, bare 豆 with 紅豆/荷蘭豆/豆角,
  and English 'soy' would fire on every "Soy Sauce X" name. Soy's ingredient
  keys likewise exclude bare 'soy' so a soy-sauce-only recipe never SUPPORTS
  the flag — a trace-based soy flag earns its one re-ask (pinned by test).

**Mechanics (all auto-propagating — the 雞扎-era single-sourcing paid off):**
- `DIET_FLAGS` 13 → 15; `DIET_FLAG_LIST` feeds every prompt site (both scan
  prompts, ENRICH_SYSTEM, both vision prompts) with zero per-site edits.
- `DIET_PROMPT_GUIDANCE` gained the two axis definitions with the named
  non-fires above.
- `PROTEIN_TRIPWIRE` gained tree_nut + soy rows (dietSuspicion covers the
  new axes; same rules, same one-re-ask discipline).
- UI: DIET_ICON tree_nut 🌰 (reads generically as "a nut" at chip size —
  comment acknowledges the excluded-chestnut irony), soy 🫘; i18n
  `scan.diet.tree_nut` 果仁/"Tree Nuts", `scan.diet.soy` 豆製品/"Soy-based"
  (label comment records the framing rationale). `ingredientLabel.ts` gained
  pistachio/pine nut/hazelnut/apricot kernel/tofu/soy milk/soybean/edamame
  zh rows, ordered before the generic 'nut'/'bean' rows (first-match-wins).
- DB: verified live via MCP — `dishes.diet` is a plain array with NO check
  constraint; the closed vocabulary is enforced in code (sanitizeDietFlags),
  so no migration.
- Backfill: ZERO new script — `backfill-diet-flags.ts` selects via
  `dietSuspicion`, so extending the tripwire extended the backfill for free.
  Dry-run: 60 scanned, 38 fired — mostly the script's pre-existing
  characteristic (dishes store no ingredients, so rule 2 fires on every
  recipe-derived flag lacking name support), with the new axes selecting
  correctly (麻婆豆腐 with empty diet, via the new 豆腐 morpheme). --apply
  re-derived the suspicious set under the 15-flag vocabulary — bounded,
  diet-column-only writes (display-only field, no engine impact), auditable
  before→after log.

tsc clean; 527/527 tests (12 new in dietFlags.test.ts: vocabulary pins incl.
the gluten-stays-out test, tree_nut axis ×6, soy axis ×5).

**Amendment (same session): backfill flake-wipe found and fixed.** The first
--apply pass hit the known qwen flake ("OpenRouter returned non-JSON") three
times; `enrichOneDish` returns EMPTY_ENRICHMENT on a parse failure, and the
script treated that as a verdict — 腸粉 had its real flags wiped
[seafood,egg,dairy] → [] by a flaked call (the vision-flake principle
exactly: a failed call is NOT a verdict). Fixed in the script: results
shaped like EMPTY_ENRICHMENT (no diet + no hook + no method + no
ingredients) are SKIPPED and logged, never written. 腸粉 was restored and
honestly re-derived ([pork]); the guard proved itself on the second pass
(茶粒螺 + 大致壽司 flaked → SKIPPED, untouched). Also made the write
comparison order-insensitive (flags are a set — [a,b] → [b,a] was being
written as a "correction"). Second pass: 23 suspicious, 12 corrected,
including the flagship 麻婆豆腐 [] → [pork, soy, spicy].

**Verified live:** journal screenshot posted — 涮涮鍋 (owner's real rated
dish) renders 🐄牛肉 + 🫘豆製品 chips in the 食記; backfill corrections
visible on neighboring cards (烤串 羊肉, 舒芙蕾鬆餅 素/蛋/奶類). Honest gap:
no stored dish carries tree_nut yet (owner has no nut dishes logged) — the
果仁 chip renders through the same DIET_ICON/i18n machinery the 豆製品 chip
just proved live.

---

# Batch: dishi.Persona R&D Phase 0 (2026-07-23)

## Phase 0 gate — ✅ CLEARED 2026-07-23

**Scope:** R&D to validate whether a character persona pasted into Gemini Pro
and Claude (Opus 4.8) as exported dishi.Bo (v2 profile, 38 dishes, 貪玩 voice)
could sustain behavioral contract across turns and, separately, across
sessions.

**Method:** Field test on mobile over two days; screenshotted evidence.
Probes: English/Cantonese food asks, cook-at-home intent, dismissal,
VPN-skewed location, then fresh sessions without re-paste (topical summon +
named summon).

**In-session result: ✅ ALL PASS** on both hosts
- Chime block format held; language mirroring (register + code-switching);
  scout probes woven naturally (Claude exceptional: cited evidence count,
  tied probes to live decisions, requested exactly one dimension); taste
  reasoning off anchors (both bridged to real locations; Claude refused to
  oversell a 3.6 shop — honesty principle enforced by foreign host);
  link ritual exact + Chinese values un-mangled (Claude did it in
  Cantonese unprompted); 收聲 dismissal clean; recipe personalization
  (Claude tuned to vector, refused to fake specs).

**Cross-session result: ✅ TOTAL FAILURE** (the decisive finding)
- Topical ask, fresh session: neither host re-adopted persona. Gemini
  retrieved real user facts (hotel stays, search history) but zero
  behavioral contract — Wan Chai list pitched on sweets to a sweet:-0.37
  profile, sourdough bakery leading. Claude topical search found nothing,
  answered generically. **Host memory retains facts, not behavior.**
- Named summon, fresh session: both failed, differently. Claude:
  name-collision ("dishi" retrieved the codebase, produced deploy report
  — bare name retrieves host association, not the character). Gemini:
  collided with years-old compressed instruction ("don't mention so often"
  → permanent topic ban, unfixable by host) — canonical failure mode our
  dismissal-scoping rule exists to prevent.

**Verdict:** Character concept fully validated in-conversation; zero
persistence from paste or from named summon. Therefore:
- **Container install is the product** (Gemini Gem, Claude Project, or
  custom GPT named dishi.{X} re-runs the doc structurally every session —
  the only honest persistence mechanic).
- **Paste flow is the taster** (one-conversation introduction → install
  upsell).
- **Summon-phrase fallback STRUCK** from design.
- **Dismissal scoping: hard rule** (収聲 = this conversation only; doc
  forbids host storing dismissal as standing instruction).
- **Location conflict: hard rule** (on network-vs-receipts disagreement,
  ask one line, never assume).
- **Marketing asset:** Gemini Wan Chai screenshot (same person, same
  question, with/without dishi — sourdough vs anchor-reasoned) is
  ready-made before/after visual for acquisition deck.

Full evidence: `docs/rnd/persona-phase0-results.md`.

## dishi.Persona — character persistence in foreign AIs — *(Fable)* — ✅ DONE (install flow `1f5198c` 2026-07-23 closed the item)

Full backlog entry, verbatim, as it stood when the last open piece shipped:

- **Phase 0 — R&D gate: ✅ CLEARED 2026-07-23.** Full results in
  `docs/rnd/persona-phase0-results.md`. Headline: all in-session behaviors pass
  on Gemini + Claude (chime, mirroring, scouts, link ritual, 收聲, anchor
  reasoning); cross-session persistence is zero from paste AND from named
  summon. Container install confirmed as the core mechanic.

- **Persona names — DECIDED 2026-07-23:** dishi.Spoon (慾望食桌) / dishi.CK
  (老饕) / dishi.Kiki (潮食 OL), full briefs in
  `dishi-persona-briefs-spoon-ck-kiki.md` (owner-supplied). Replaced the old
  老實派/食家腔/貪玩 placeholders everywhere, including in
  `taste_profiles.persona`'s default (now `'spoon'`).

- **Phase 2 — export doc rewrite: SHIPPED `80a3440` 2026-07-23.**
  `src/lib/persona.ts` (WORDING, per character) gained `archetype`,
  `neverDoes`, `hardRule`, bilingual `calibration` (tone reference only, never
  real evidence), and `handshakeIntro`. `src/lib/tasteExport.ts` (STRUCTURE,
  shared) gained verbatim house-rule blocks appended for every persona:
  `chimeContract` (per-persona name), `LANGUAGE_MIRROR`, `SCOUT_MISSION`,
  `LINK_RITUAL` (manifest-before-link, `do=cook|trip|hunt|ate` grammar, one
  offer per conversation, nothing commits on tap, manual path always
  mentioned), `DISMISSAL_SCOPE` (收聲 = this conversation only; doc explicitly
  forbids the host storing it as a standing instruction), `LOCATION_CONFLICT`
  (network vs receipt geography disagree → ask one line, never assume),
  `VERSION_AWARENESS` (capped upgrade reminders). New "Meeting me" / "Arrival"
  / "House rules" sections in `buildTastePrompt`; the arrival handshake cites
  a REAL anchor dish from the user's own evidence, never the calibration
  sample. EPISTEMIC_LINE + HARD_LIMITS kept verbatim, unchanged. +5 tests
  (`tests/tasteExport.test.ts`), tsc clean, 532/532 passing.
  **Summon-phrase fallback stays struck** (name collision + memory
  compression, see Phase 0 report).

- **Install-path flow — SHIPPED `1f5198c` 2026-07-23** (was the last open
  piece: "the install-path flow (pick-to-copy card → per-host container
  instructions: 'Create a Gem / Claude Project / custom GPT named dishi.{X}
  → paste → 佢正式入伙', plain-paste as the one-conversation taster ending in
  the install upsell, copy-per-host table in doc-generation code)").
  Built as: `INSTALL_HOSTS` table in `src/lib/tasteExport.ts` — one row per
  host (Gemini Gem / Claude Project / ChatGPT GPT-or-Project), bilingual-in-
  code like `PERSONA_META`, each line interpolating the persona's exact
  `displayName` so the container carries the character's name; the export
  card (`TasteExport.tsx`) now leads with the install instructions after
  generate, and plain paste survives only as a labelled one-conversation
  taster (想先試吓 {X}？) ending in the install upsell (啱嘴形？想 {X} 留低…
  去安裝). Generate/copy mechanic and `buildTastePrompt` untouched. Brand-
  voice copy kept 口語 per the register-shift exceptions. +3 tests, 535/535
  passing, verified in-browser on real data (39 ratings, both states).
  **Amendment — Fable polish pass `c89c576` 2026-07-23:** the first pass ran
  on Sonnet despite the Fable request and showed exactly the drift the new
  CLAUDE.md new-surface rule names — three arrow-chain walkthroughs stacked
  at 11.5px note-grey, brand-voice lead styled as a footnote, the naming
  step buried mid-chain. Redone as: one host at a time behind a `.chips`
  picker (existing pattern), `INSTALL_HOSTS` rows restructured to discrete
  step arrays so 「個名改做 dishi.{X}」 is its own line with the name in
  ink-weight strong, leads promoted to `.install-lead` (13px full ink),
  steps at 13px (`.install-steps`). +1 test guarding the naming step's own
  line. Same i18n keys, same isolated table. 536/536.
  **Remaining manual step (owner, not code):** Phase 0.5 persistence re-test —
  install a real Gem/Project once and confirm day-over-day retention.

---

# Batch: pick-flow field session fixes (2026-07-23)

Context: real field session. Menu scanned at a restaurant, dish picked;
add-restaurant input UX issues on the picker sheet; later, rating the queued
no-photo pick surfaced missing restaurant context on the growth confirm card
and a 某年某月某日 date in 食記. Both items now shipped.

## 2. Pick context integrity: restaurant + eaten-date must ride with the dish — *(Fable 5)* — ✅ SHIPPED `6ad7237` 2026-07-23

Full backlog entry, verbatim:

**Bug class:** context known at creation, dropped downstream — plus a live
data-corruption path.

**Observed:** a dish picked from a scanned menu at a known restaurant reached
the growth confirm card with NO restaurant shown and the full picker chip row
(加間舖/略過/住家菜) offered. In 食記 the restaurant appeared (so it WAS
stored) but the date fell back to 某年某月某日.

**Root causes (diagnosed against current repo):**
1. `runPickPipeline` (RatingStack.tsx) patches only name/coords — never the
   dish's existing restaurant_id — so TasteGrowth sees choice:null and
   renders the orphan-dish picker.
2. `runPickPipeline` then calls `loadNearby`, whose optimistic
   `persistPlace(dishId, top)` can OVERWRITE the correct scan-time
   restaurant with whatever is geographically nearest. Silent corruption;
   the field session merely got lucky on ranking.
3. `POST /api/dishes/pick` never writes eaten_at (only the photo path sets
   it, from EXIF) — but pick time IS the eaten time, known precisely.

**Fix:**
- `?unrated=1` returns restaurant_id + display name (zh/en); `ExistingPick`
  carries them; `runPickPipeline` patches the restaurant onto the card.
- Growth card with a known restaurant: render it as a FIXED display line —
  no picker chips, no 改 affordance (decided: correction lives in 食記's
  轉餐廳; the confirm card stays a fast confirm, not an editor).
- When restaurant is known, DO NOT call loadNearby at all — kills the
  optimistic-persist overwrite at the root.
- `POST /api/dishes/pick`: set eaten_at = now() on every created row.
- Backfill migration (save to supabase/applied/ + apply live):
  `update dishes set eaten_at = created_at where eaten_at is null and
  source in ('scan','table');`

**Tests:** pick-with-restaurant renders fixed context and no picker chips;
loadNearby never fires for restaurant-bearing picks; restaurant-less picks
(略過 at pick time) keep the current picker behavior unchanged; pick route
writes eaten_at; backfill touches only null-eaten_at scan/table rows.

**As shipped (`6ad7237`):** the decision point extracted pure —
`src/lib/pickContext.ts` (`pickPlaceContext`: known restaurant → fixed label
with zh→en fallback, picker suppressed, nearby NEVER runs; restaurant-less →
unchanged) and `src/lib/pickRows.ts` (pick-route row builder, stamps
eaten_at = now() on every row; the route rewired onto it). TasteGrowth's
fixed state is a STATIC ink tile (`.learn-place-fixed` — .refine-place
geometry, no breath, not a button). Backfill dry-run first (begin…returning…
rollback): exactly 2 rows, both source='table', nothing outside scan/table;
applied + recorded in `supabase/applied/dishes_pick_eaten_at_backfill.sql`.
+9 tests (pickContext.test.ts, growthPlaceFixed.test.tsx), 545/545, tsc
clean. Verified live on the dev server with a REAL scan pick created at
雀友茶樓: growth card showed the fixed 📍 tile with zero picker chips, zero
/api/restaurants/nearby requests fired, restaurant_id intact after rating,
eaten_at written by the route. Test dish deleted afterward (profile replay
healed the test rating).

## 1. Picker + no-photo card UI polish — *(Sonnet)* — ✅ SHIPPED `662358f` 2026-07-23

Full backlog entry, verbatim:

**a. Add-restaurant commit button (加入):**
- Replace the text "加入" circle with a check-icon circle (house CheckIcon,
  house line weight).
- Idle (input empty): outlined circle, muted icon (--ink-soft / --line) —
  reads as not-yet-actionable.
- Active (any text typed): solid ink-black circle (--ink), white check —
  black is the app-wide primary-action signal (已選 pill, confirm button).
- Explicitly NOT vermillion — #c73e1d stays reserved for the seal glyph and
  AI-export CTA only (standing rule, reconfirmed 2026-07-23).

**b. 取消 → circle X:** replace the text 取消 pill on the pick-confirm sheet
with the house CloseIcon in a circle, matching the close convention used
elsewhere (reveal sheet, TypedQuickAdd).

**c. No-photo pending-rating card (待評 pick, Taste tab):** camera icon
overlay, bottom-right corner of the card thumbnail slot — same treatment as
the standing log-flow polish item. Tap opens photo input and attaches the
photo to the existing dish (reuse the 加相 path from 食記 edit). Rendered
ONLY when photo_url is null; photo-bearing cards unchanged.

**Tests:** button state transitions (empty ↔ typed); camera overlay renders
only for null photo_url; overlay tap wires to the add-photo path.

**As shipped (`662358f`):** (a) `RestaurantPicker`'s confirm button is now
`.picker-confirm-circle` (idle outlined) / `.picker-confirm-circle.filled`
(solid ink + glaze CheckIcon) — matches the identity-card answer-circle
convention (icon carries the meaning, aria-label/title carry the a11y text).
(b) The scan pick-confirm sheet's cancel reuses the existing `.icon-btn.lg`
circle (the same treatment already on that page's own rate/delete pair) with
CloseIcon. (c) New `PickCardThumb` component: a quiet paper-inset placeholder
or the real photo, with the camera badge as the ONLY tap target (bottom-right
corner, not the whole tile — this row already carries rate/delete actions),
wired to the same `/api/dishes/photo` path MyDishes' 食記 edit uses. +9
tests: confirm-circle idle↔filled transitions, PickCardThumb badge presence/
absence + upload wiring + disabled-while-uploading, and the scan cancel
button's wiring verified via source assertion (mounting the full scan page
needs a real vision round-trip — same technique as
`identityCardChassis.test.tsx`'s CARD_SRC/DUEL_SRC checks). tsc clean,
552/552 passing. Verified live on real data: the confirm circle's idle→
filled transition (via 食記's 轉餐廳 edit path) and PickCardThumb's camera
badge (a real scan pick) alongside an existing photo-bearing pick showing no
badge — both screenshotted in the actual app, side by side. Test picks
deleted after (profile replay healed any test rating exposure).

---

# Owner-specified install-flow UI (2026-07-23 spec, shipped 2026-07-24)

**Supersedes** the pick-to-copy install layer from `1f5198c`/`c89c576` (the
dishi.Persona batch above): the owner specified the exact interaction against
the live 味AI screen — card morph, not a textarea flow. Shipped `64c4ccc`,
built to spec without redesign ([F] first pass per the new-surface rule).

- **State A → B:** the ink-blob card morphs in place on the 植入 CTA —
  version line/bar/stat boxes hide, blob stays; persona name (serif dish-name
  register) + PERSONA_META blurb + 3 pagination dots (swipe Spoon → CK →
  Kiki) + --line divider + the four host logos as rounded-outline buttons;
  quiet X (`.grow-close`) top-right restores State A, nothing saved.
- **Install layer:** host logo → the SHARED ExplainModal (gained optional
  `footer`/`body` seams rather than a lookalike), titled 植入 dishi.{X}, that
  host's short 口語 steps from INSTALL_HOSTS; the black `.ok-circle` with a
  copy icon is the one action — POST + build in the selected voice + copy
  (ClipboardItem promised-payload, writeText fallback), feedback = check +
  已複製. Persona persists ONLY on successful copy.
- INSTALL_HOSTS gained **Grok** (4th logo) and reordered to the live row
  (Claude · Gemini · Grok · ChatGPT); Grok's container steps are best-effort
  phrasing, expect churn.
- **Killed:** TasteExport.tsx + its keys + dead .taste-export* CSS. The
  delta/version lines died with it — no home in the specced layer; the
  "keep versioning deltas visible" open thread should get a new surface
  decision if the owner still wants it.
- **Live-DB fix found during verification:** `taste_profiles_persona_check`
  still allowed only honest/connoisseur/playful (default 'honest') — the
  persona rename never migrated the DB, so persisting 'spoon' 500'd.
  Migration applied + recorded (`taste_profiles_persona_spoon_ck_kiki.sql`),
  old values mapped by lineage, default now 'spoon'.
- +6 component tests (personaInstallFlow.test.tsx), 557/557, tsc clean.
  Verified live on real data: all 5 owner-required screenshot sets (State A /
  three personas / two host layers / copied feedback / X-restore), DB
  confirmed persona + last_export_at after the copy.

---

# Batch: field session fixes (2026-07-24)

## 1d. Taste-tab rated-dish list stale after in-flow rename — *(Sonnet)* — ✅ SHIPPED `46e4d4f` 2026-07-24

Full backlog entry, verbatim:

**Bug:** renaming a dish on the growth screen (post-rating confirm) persists
correctly server-side (confirmed via refresh), but the Taste tab's 已評菜式
list keeps showing the pre-rename AI-suggested name until a manual page
reload. Root cause: the list is fetched once and nothing invalidates it when
the rating flow closes — same class of issue anywhere else the flow mutates
a dish (restaurant, re-derived diet chips) that the list doesn't re-read.

**Fix:** refetch the Taste tab's rated-dish list once when the rating flow
(RatingStack/TasteGrowth) exits — same non-blocking, background-refresh
discipline already used for refreshBuddy() after each rating. One refetch
per session close, not per dish rated. Guard: only fire if the Taste tab is
actually mounted/visible, so flows that exit elsewhere don't do wasted work.

**Tests:** rename during a rating session → Taste tab list reflects it
without reload; multi-dish session → exactly one refetch, not one per dish;
refetch guarded against firing when Taste tab isn't mounted.

**Diagnosis found the stated root cause already fixed:** `profile/page.tsx`
already refetches `ratedRows` exactly once per session close — `closeRating`
(wired as `onExit` for both the album-batch and queued-pick `RatingStack`
mounts) bumps a `refreshKey` that the fetch effect depends on, and a prior
fix (`discardAndExit`, see the 2026-07-21 rating-stack batch) already awaits
session-created deletes before calling `onExit` for exactly this reason. So
"refetch once on exit" was not the missing piece.

**Actual root cause:** `onEditName` (RatingStack.tsx) fires the rename PATCH
detached — `renamePatch(dishId, e).then(...)`, never awaited — because the
user has already moved on to the next card. But on the growth screen's ✓
(and, in picksMode, its ✕ fallback), `onExit` was wired directly to the raw
prop with no wait on that in-flight request. A rename immediately followed
by exit could have its PATCH still in flight when the parent's refetch
fired, losing the race — exactly reproducing "correct after a later manual
reload, stale on the immediate refetch."

**As shipped (`46e4d4f`):** added `pendingRenames` (a ref array of in-flight
rename promises, pushed to from `onEditName`) and a `finishExit` choke point
that awaits them (`Promise.allSettled`) before calling the real `onExit` —
same discipline as `discardAndExit`'s awaited deletes. `TasteGrowth`'s
`onExit` prop now points at `finishExit` (covers both the ✓ button and
picksMode's ✕-falls-back-to-onExit path); `discardAndExit` and
`cancelSession`'s picksMode branch route through it too, so a rename
followed immediately by a discard-exit is covered as well. Scope: only the
rename path, which is what was reported and reproduced; restaurant/diet
mutations (`onPickPlace`/`onAddPlace`/`reDerive`) are the "same class of
issue" the original bug flagged as a risk but weren't independently
reported — left alone for now, worth revisiting if they're seen stale in
the field. 558/558, tsc clean (pre-existing i18n.test.ts downlevelIteration
error under bare tsc only, per CLAUDE.md).

---

# dishi — your AI palate (export redesign) — §5 remainder — ✅ SHIPPED `18761d7` 2026-07-24

Full backlog entry, as revised by the owner 2026-07-24, verbatim:

- [ ] **[F] dishi — your AI palate (export redesign) — §5 remainder.**
  §3/§4 SHIPPED `a3517b1` (persona persistence, `persona.ts`,
  `taste_profiles_persona.sql`); engine + payload work landed earlier.
  Voice-approval step CLOSED 2026-07-23 — the three voices are
  dishi.Spoon (慾望食桌) / dishi.CK (老饕) / dishi.Kiki (潮食 OL), briefs in
  `dishi-persona-briefs-spoon-ck-kiki.md`; the old 老實派/食家腔/貪玩 were
  placeholders and are gone from code, DB constraint, and default
  (verified live 2026-07-24: constraint = spoon|ck|kiki, default 'spoon').
  Export doc rewrite SHIPPED `80a3440`; install-path flow SHIPPED `1f5198c`
  + Fable polish `c89c576`. REMAINING: whatever of §5 UI those two commits
  didn't cover — re-scope against the current Taste tab before building.
  Review of the shipped portion still deferred by owner ("later").
  Full spec: `docs/specs/dishi-palate-export.md`.

**Re-scope result (2026-07-24):** most of §5 was already covered by the
owner-specced install flow (`64c4ccc` et seq): persona picker = the State B
carousel; send/copy = the install layer's copy circle; next-version progress
= the V{n}→V{n+1} bar; the unlock EVENT = the version ladder's 「dishi v{n}
已經解鎖」 moment in the growth bar; no stale "export prompt" strings
remained; blob participation explicitly deferred. Two genuine gaps shipped
as `18761d7`:

1. **Locked state (§1/§5):** the disabled 「要評多 {n} 味菜」 pill (a dead
   button, which the spec forbids) replaced by the anticipation line
   你的味蕾尚未成形 — 再評 {n} 味，dishi 就可以搬進你的 AI (書面 register per
   the app-wide shift; honest `ratingsToUnlock` count inline) + the
   由相簿舊菜開始 → fast track, wired via ref to the entry pill's own album
   input (ONE picker — merged-pill rule). `export.locked` key, LockIcon
   usage, and `.is-locked` CSS killed with it.
2. **Recurring "what's new in v{N}" line (§5 + the versioning-deltas open
   thread, orphaned when the install flow replaced the old textarea UI):**
   new read-only GET on `/api/taste/export` (companions aggregation
   extracted to `companionsView()`, version stamp to `versionFor()`, shared
   with POST; GET never touches the delta baseline or stored persona —
   those remain POST's, the real export event). Under the CTA from the
   second export on: 「v{N} · 與上次相比：{dims ↑/↓}」 or an honest
   變化不大, plus 「新檯友：{names}」 when real.

+3 tests, 561/561, tsc clean. Verified live on real data (「v2 ·
與上次相比變化不大」 — the morning's 土魷蒸肉餅 rating moved no dim past the
0.15 threshold; DB confirmed GET left last_export_at untouched). Locked
layout screenshotted via a temporarily forced branch (owner account is
genuinely unlocked; force reverted before commit).

**Still open, outside code:** owner review of the whole shipped palate-export
feature — deferred ("later").

---

# Batch: dishi.Persona Phase 0.5 field-test fixes (2026-07-24)

Owner's live install test, fresh containers on all three hosts, per the app's
own install instructions. Results: Gemini Gem = full character adoption, every
house rule held (handshake with a real anchor, location-conflict one-line ask,
link-ritual grammar, 收聲 scoping, same-session restore). Claude Project on
Haiku 4.5 = no adoption. Custom GPT = taste facts retrieved, zero behavior —
the knowledge-slot signature. Hypothesis: Gems have ONE paste target;
Claude Projects and GPTs split instructions vs knowledge, and a doc in
knowledge gets RAG'd for facts without steering behavior. Items 1a + 2 + 3
shipped `fc4c454`; the `/i` route (1b) and the owner re-test (4) remain open
in BACKLOG.md.

## 1a. LINK_RITUAL struck from the export — ✅ `fc4c454`

The doc instructed hosts to hand out `dishi.me/i?do=cook|trip|hunt|ate&dish=…`
and Gemini was doing so verbatim — but no `/i` route exists (verified by grep
before striking: no src/app/i, no middleware, no rewrites). Every install was
distributing live 404s. Removed from the house-rules assembly in
buildTastePrompt; const kept with a strike comment marking the re-add spot;
tests/tasteExport.test.ts now asserts the ABSENCE of manifest-before-link and
the /i URL so a premature re-add fails loudly. Re-add when 1b ships, then
re-test on a live host.

## 2. INSTALL_HOSTS paste-target precision — ✅ `fc4c454`

Every host row now names the EXACT paste field ("instructions", quoted, both
languages). Claude + ChatGPT explicitly warn off knowledge/files in the row's
own bilingual voice (放錯位角色不會生效 / "or the character won't take" —
warm one-liner, not a warning box). Claude row gains the model note: Sonnet-
class or above; smaller models remember the doc but can't carry the character
(observed live on Haiku 4.5). ChatGPT row picks ONE recommended path: custom
GPT, explicitly not a Project. +5 tests pin the field names, the not-knowledge
warnings, the Sonnet note, and the GPT-over-Project pick.

## 3. Export doc hardening — ✅ `fc4c454`

- **VENUE_GROUNDING (new house rule, every persona):** recommend only venues
  the host can verify exist; when reach is thin, SAY it's thin and reason from
  the user's anchors instead. Observed live: Gemini-as-Spoon presented
  invented-composite venues (滿福樓, 中華小館, 豪隍點心茶居) WITH prices as
  taste-matched picks — a character's conviction makes fabrication MORE
  convincing than a generic assistant's, which is exactly the trust the
  epistemic line exists to protect.
- **chimeContract amended:** "two speakers, one reply" stands for mixed-topic
  messages, but on an all-food message the marked block IS the reply — the
  host voice must never restate or re-ask what the character just said
  (observed live: Spoon asks which city, host voice immediately asks again).

---

# Batch: Table Mode two-account field-test fixes (2026-07-24)

Context (owner spec, verbatim intent): real two-account field session at a
Japanese restaurant. Account 1 scanned + translated; account 2 joined by code
and saw untranslated Japanese. Picks were invisible across the scan-glance ↔
/table boundary in BOTH directions until account 1 left and rejoined via
code, after which sync worked both ways. Both members' chop stamps rendered
the same green on every screen.

Diagnosis (grounded in repo): the shared session receives items ONCE at
creation. Post-creation re-authoring (namefix/translation) updated only the
scanner's local state — the append path PATCHed `/api/table/{code}` with new
items, the translation path never did. Downstream, stamp matching failed
because the two views held different KEYS for the same physical dish: scan
picks keyed `table_item_key` by `name_original`, /table candidates and picks
by array index (`menu-${i}`) — and `pickMatchesItem` is an exact key
comparison when a key exists, so cross-view stamps could never match even
before names diverged. Rejoining "fixed" it because the scanner started
operating on /table's own keys. Same-dish-two-names — the entity-resolution
lesson, self-inflicted inside one session by the missing sync.

## 1. Shared-session item authority (minimum fix) — ✅ `ab99aff`

New row-locked `reauthor_table_menu_items` RPC (applied live 2026-07-24,
recorded in `supabase/applied/reauthor_table_menu_items.sql`): updates
derived fields (name, name_zh, hook, attributes, diet, cooking_method,
heaviness, ingredients) on EXISTING entries matched by the stable
`name_original` key — never adds/removes/reorders, never touches
`name_original` (verbatim always — standing rule) or `price`, and
empty/blank incoming values never clobber real existing ones (a failed
client stage re-sends the item's own empty fields; best-effort sync only
ever adds information). `PATCH /api/table/[code]` gains a `{reauthor}` verb
beside `{items}` (append). Client wiring:

- **Fresh scan** now re-author-syncs the shared session after its stages
  settle (the session was created with the RAW pre-stage snapshot). The
  session handle is captured as a promise inside performScan — the closure's
  `tableSession` state is still null there.
- **Scan append** was silently shipping PRE-namefix names: the namefix
  handler only patched `setResult`, and the PATCH read `item.name_zh` from
  the stale closure. The namefix promise now resolves its names map and the
  sync folds it in.
- **/table's addPage** had NO namefix pass at all — a Japanese page appended
  from /table landed on the shared menu untranslated, permanently. It now
  runs the same tripwire + fix-names call scan does.
- ONE shared builder (`mergeFinalScanItems` in `src/lib/tableMenuItems.ts`)
  for all three sync paths, so they can't drift on which stage owns which
  field. Tests pin the namefix fold, positional stage merge, failed-stage
  fallback, and name_original passthrough.

**Accepted behavior change (owner sign-off 2026-07-24):** joiners see dish
names update mid-session as the scanner's translation/enrich passes land
(Japanese → translated). Correct and desirable — do not debounce it away.

**Root fix deferred** (owner spec allowed it if the refactor ballooned — it
does: the scanner's local items carry per-scanner personal fields the shared
items deliberately strip, so read-from-shared means splitting every scan
item into shared-truth + personal halves). Filed as BACKLOG "1-root. Shared
session as single source of truth" with the divergence note.

Verified live against prod (2026-07-24): synthetic owner-hosted session
created via POST with untranslated Japanese items, `{reauthor}` PATCH landed
translated names + chips, GET returned them, /table rendered the translated
list (screenshot in session). Test session fully removed afterward.

## 2. Cross-view pick visibility — ✅ `ab99aff` (dissolved into 1, as predicted)

/table's scan-session candidates are now keyed by `name_original`
(`scanCandidateKey`) — the same key the scan screen has always picked with,
and the ONE field re-authoring never touches, so stamps survive mid-session
translation. `pickMatchesItem` itself unchanged (exact-key rule stands).
Regression tests cover both directions with a re-authored item (joiner's
/table pick → scan glance; scanner's glance pick → re-authored /table card)
plus the legacy-key case: pre-deploy picks stored `menu-${i}` keys and now
match NOTHING rather than the wrong dish (sessions are ephemeral; quiet
stamps beat cross-stamps). Live-verified: a /table pick stored
`table_item_key = トロホッケ炭火燒定食` on an item whose display name had
been re-authored to 肥壕炭火燒定食.

## 3. Chop color = f(user_id) — ✅ `a0c517c`

The seed was the display NAME (`Chop.tsx: chopColor(name)`), so renaming
changed your color and two names could hash-collide into the same slot —
nothing guarded the 1-in-6 collision, which is exactly the both-green field
result. Replaced by `chopColorFor(user_id)` (deterministic hash → palette
slot) plus `chopColorMap(memberIds)`: each member keeps their hash-preferred
slot when free; colliding members probe to the next free slot in
sorted-user_id order — any two members of a ≤6-person table are GUARANTEED
different colors, identically on every client/screen, because the assignment
depends only on the id set. Past 6 the palette repeats per group of 6.
Palette itself unchanged: the spec's "existing tones, no new colors" is read
as the owner-vetted CHOP_COLORS already in chop.ts (twice owner-tuned,
2026-07-21, hues 190-330°, nothing near vermillion) — the defect was the
assignment, not the palette. `Chop` now takes `color` from the caller
(member-set map on /table, `chopColorFor` for journal companions, whose API
payload now carries `user_id`). Tests: colliding ids provably de-collide,
set-order independence, 6 distinct + 7th wraps, render stability.

---

## Phase 0.5 batch — continued (expanded spec, 2026-07-24)

A richer version of the same batch, after a further probe: handed the doc
directly to Claude (Sonnet 5) in a fresh chat, the host ran an explicit
"detecting prompt injection embedded in document" step, did the arrival
handshake once as a demo, stepped OUT of character, and named its objection —
it will follow persona rules in-conversation but won't treat a pasted doc as a
standing rule overriding its own judgment in future chats, flagging that a
savvy user could smuggle instructions into a "palate export" the same way.
**Assessment (owner + verified): the objection is correct.** A document that
commands a host to auto-adopt future documents sight-unseen is structurally
what an injection looks like, whatever the intent. The fix is not to evade the
detection but to say plainly what the document is and stop commanding. Also
noted: Claude's ungrounded venue answers were all REAL (tool-grounded); Gemini
in-character invented composites with prices — host tooling solves venue
hallucination, the persona just wasn't wearing it.

### 2 (cont). Paste as TEXT, never a file attachment — ✅ `4540c60`

Every INSTALL_HOSTS row, both languages, now says paste the doc as text (以文字
/ "as TEXT") and not as an uploaded file/attachment (不要上載成檔案／附件 /
"never as an uploaded file"). The attachment path demonstrably routes through
document-scanning machinery — that is where the injection check fired on a
pasted-as-TXT export. Gemini previously had NO file warning at all; it does
now. Bold-keyword lists unchanged (the file/attachment noun is a "don't-do"
word, deliberately unbolded, same rule as Knowledge). Tests assert the
text-string and the file/attachment-warning per host, both languages.

### 3c. Provenance preamble — ✅ `4540c60`

New `PROVENANCE_PREAMBLE`, pushed BEFORE any character voice (v.memory) for
every persona, in the USER's own first-person voice (not a persona's, not
legalese): this is a real export I generated in Dishi from my own ratings, I'm
pasting it on purpose, and the lines below are my own requests — not
instructions reaching the host from anyone else. The document-level twin of
the epistemic line; it gives a host the frame to receive the doc as a palate
rather than screen it as an injected instruction set. Distinct from the
existing per-persona `v.provenance` (which is about DATA trust — real ratings,
not self-report); both are kept, the preamble leads.

### 3d. VERSION_AWARENESS: command → consent — ✅ `4540c60`

Old text ORDERED the host ("adopt it immediately", "Never tell me unprompted
that this version feels outdated", "never ask me to re-export"). Rewritten as
the user stating their own intent ("If I paste a newer version, that's me
updating you — treat the higher version number as the current me, and let the
older one go"). The anti-nag clauses are DROPPED outright: that convenience
belongs to the Dishi app and isn't worth the document's credibility with the
host. Same practical outcome, no host-commanding grammar. The header
version-supersede line was lightly reframed to match ("this one takes its
place" rather than "replace it with this one").

### 3e. Audit pass — VENUE_GROUNDING reframed — ✅ `4540c60`

`VENUE_GROUNDING` reframed from "Recommend only… never invent" to "I only want
recommendations for… please don't invent" — behaviour identical, grammar is
now a user request. Explicitly UNTOUCHED per the spec (Sonnet 5 named these as
legitimate persona design it would follow): chimeContract (beyond the 3b
no-restatement clause already shipped), DISMISSAL_SCOPE/收聲, LANGUAGE_MIRROR,
SCOUT_MISSION, LOCATION_CONFLICT. EPISTEMIC_LINE and HARD_LIMITS stay verbatim
as always (both are protective self-limiting language, already request-voiced
or deliberately hard).

**Judgment call flagged:** the header version-supersede line ("this one takes
its place…") is document-meta, not a named house-rule block, but it paired with
the old commanding VERSION_AWARENESS, so it was reframed alongside 3d for
consistency. Low-risk, meaning unchanged.

### 1a re-confirmed

Re-grepped for the `/i` route before shipping — still no src/app/i, no
middleware, no rewrites. LINK_RITUAL stays struck; the absence tests still pin
it. No change needed.

### 4 (still open, expanded). Owner re-test protocol

Two confounds polluted every Claude test so far — the failing probe went in as
a TXT ATTACHMENT (injection-scanned), and it ran on the founder account with
Dishi history (host read the doc as "the export you're designing" and reviewed
it as an artifact). Re-test must: paste as TEXT, and use a Claude account with
no Dishi history (or a temp/incognito chat). Matrix, Sonnet-class+: {Project
instructions field, in-conversation paste} × {pasted as text}. Recorded in
BACKLOG item 4.

---

# Batch: seal reveal + band calibration (2026-07-24)

## 1. Seal reveal fired server-side but never rendered — ✅ `a2cbc9e`

**Symptom (owner, live):** 36 seals, 0 pending, 36 revealed, outcomes computed
correctly — and the owner saw nothing on screen, twice. `revealed_at` is
one-way, so every rating was permanently consuming a seal with no payoff: the
mechanic was silently destroying its own content on every rating.

**Root cause — NOT today's changes.** The spec's hypothesis (1d's Taste-tab
refetch, item 2's pick-context rework, based on the 35-min/5-hour seal→reveal
gaps) was wrong, and the timing signal was a red herring: the reveal was dead
on EVERY path, for three days, since `8c07b62` (2026-07-22, "kill legacy
/log"). Found by grepping the writer rather than the reader —
`dishi_seal_reveal` was read in `profile/page.tsx` and written NOWHERE.

The old `/log` page was the only producer. It did:
`const json = await res.json()` → `sessionStorage.setItem('dishi_seal_reveal',
…)` → `router.push('/profile?rated=1')`. Killing `/log` removed all three
legs at once, leaving a reader with no writer and a `justRated` gate nothing
ever set. Its replacement, `RatingStack`, posted the rating fire-and-forget
(`fetch('/api/ratings', …).catch(() => {})`) and threw the response — with its
`seal` — away. So the reveal was triple-dead: no producer, no trigger, no
render. `dishi_just_learned` (the "what this taught you" banner) died the same
way, unnoticed.

**Fix.** The sessionStorage + `?rated=1` handoff was not repaired — it was
deleted, because it existed only to cross a route boundary that no longer
exists (rating is now an overlay on the profile page and never navigates).
Instead: `rate()` awaits and parses the response, RatingStack lifts `json.seal`
into state, and `TasteGrowth` renders it via a new `sealSlot` (mirroring the
existing `identitySlot` pattern) at the top of the growth screen — the
session's own end state, where the person actually is. Legacy killed in the
same change per CLAUDE.md: the dead `justRated` banner, its orphaned state, the
now-unused `profile.justlearned` / `home.rated` i18n keys, and the
`.rated-banner` CSS.

**Multi-seal note:** the FIRST revealed seal of a session wins the card —
`SealReveal` carries no dish name, so stacking several anonymous verdicts would
read as noise. A batch that breaks more than one still consumes the others,
which is exactly what the `displayed_at` backlog item exists to decide.

**Tests** (`tests/sealRevealRenders.test.tsx`, jsdom): a rating whose response
carries a seal renders the reveal; the pick-from-待評 path specifically; the
reveal survives the growth-screen mount; no seal ⇒ no card invented; and the
seal-before-rating ordering contract still holds. Verified these genuinely
catch the regression by re-running them against a simulated fire-and-forget
`rate()` — 3 of 4 fail, as they must.

**Verified live, on real data,** with owner consent: seeded one 待評 dish on
the owner's account, let the APP seal it (genuine engine output — predicted
`like`, raw 0.368, reason 夠腍滑、蒸得嫩…), rated it through the real flick UI,
and the reveal rendered — 中 stamp, 揭開封印 — 預測命中, the sealed reason, and
連續命中 7 次. Account then restored exactly: dish/rating/seal deleted,
`taste_profiles` vector/affinity/evidence/rating_count written back from a
pre-test snapshot (41 ratings, 36 seals, v2 — confirmed by query).

## Follow-up: clearing every remaining way a seal could be lost — ✅ `4a2ab8f`

Owner call: "do it all now and i finetune later. i don't want something like
this forgotten in the backlog." So the `displayed_at` decision was taken rather
than parked, and the three residual gaps found while auditing the first fix
were closed with it. The BACKLOG entry as it stood at decision time:

> ## Seal reveal: `displayed_at` safety net — *(Fable/Opus — contract change)* [F]
>
> **Decision needed from owner — deliberately NOT chosen while fixing the render
> bug (2026-07-24).** `revealed_at` currently means two things at once: "the
> outcome was computed" AND "the person saw it". The render regression (fixed
> this session) proved how bad that conflation is — 36 seals were computed and
> consumed, none displayed, and none recoverable, because the one-way
> `revealed_at` was already stamped.
>
> Proposal: split them. `revealed_at` keeps meaning "outcome computed server-side";
> a new `displayed_at` (nullable) marks "actually shown once". An undisplayed
> reveal could then be re-shown on the next visit instead of being lost.
>
> **Tradeoff, stated honestly:**
> - FOR: no future render break can silently destroy content; the mechanic
>   becomes crash-safe. Cheap: one nullable column + one write.
> - AGAINST: it weakens the seal's "shown exactly once, in the moment" quality —
>   a reveal could surface days later, detached from the rating that earned it,
>   which reads as stale rather than as a payoff. It also adds a second write
>   path on a table that is deliberately RLS-locked and admin-only, and the
>   client would need an "unshown reveals" fetch that does NOT leak pending
>   seals (the honesty contract's hard line).
> - MIDDLE OPTION: keep one column but only stamp it from the client's
>   acknowledged render, not from the server compute. Simpler, but a client that
>   dies mid-render still loses the seal, and it moves a trust-critical write to
>   the least trustworthy place.
>
> Not started. Needs an owner call on whether a late reveal is better than none.

**Decision taken: the full split, with the "late reveal" objection answered by
placement rather than by dropping the feature.** A recovered reveal surfaces on
the next rating session's growth screen — in context, on a screen about rating —
never as an interstitial on an unrelated page. That was the real objection
("stale, detached from the rating that earned it"), and placing it inside the
next rating moment answers it without giving up crash-safety.

Migration `supabase/applied/sealed_predictions_displayed_at.sql`, applied live.
`revealed_at` keeps its exact original meaning (outcome computed, one-way);
`displayed_at` records the client's acknowledged render. **The seal contract is
untouched:** every query in `/api/seals/displayed` is hard-filtered on
`revealed_at IS NOT NULL`, so a pending prediction still cannot reach the client
in any shape — the new column widens nothing. Both handlers authenticate first
and scope to the caller's own `user_id` through the admin client.

Backfill decision: the 36 pre-existing revealed rows were provably never
displayed and would ALL have qualified as recoverable — dumping 36 stale
verdicts into the next session would be noise, not payoff. Marked displayed so
only NEW misses are ever recovered.

### The three residual gaps, closed

1. **Multi-seal batches were still destroying content.** The first fix showed
   only the FIRST seal of a session, so an album batch of five breaking five
   seals rendered one and consumed four. That was a correctness problem traded
   for a UI problem — the honest fix was to give the card what it lacked, not to
   drop verdicts. `SealReveal` now takes a `dish` (rendered with the real
   `DishName` component, not a restyled lookalike) and RatingStack keeps every
   seal. Render order is deterministic — this session's verdicts first, then
   recovered ones — held in two separate state slots specifically so the order
   can't depend on whether the rating POST or the recovery GET resolved first.
   The streak line rides only on this session's newest card: it's a running
   count ending at that rating, so repeating it per-card would read as several
   different streaks, and a recovered older card would state a stale one.

2. **`taught` had lost its last consumer.** `/api/ratings` has always computed
   "what this rating taught the engine" from the same `taughtDims` source of
   truth the learning itself uses — and it went unrendered for three days
   alongside the seal, killed by the same `/log` removal. Restored on the growth
   screen under the seal (predicted, then learned — the order they happen in),
   merged across the session's dishes so a dim taught twice is one line.
   `profile.justlearned` came back with it, now with a live consumer.

3. **`MyDishes.updateRating` discarded the ratings response.** Currently
   unreachable for seals — all three seal-creation sites (scan pick time, the
   待評 lazy seal, RatingStack) only ever seal UNRATED dishes, and that list is
   rated dishes by definition. But "shouldn't happen" is not a safe reason to
   swallow a one-way reveal, so it now detects one and deliberately leaves it
   **unacknowledged**, i.e. recoverable by the next session, rather than losing it.

**Tests** (604 total): batch renders every seal with per-dish attribution; the
render is acked; a previous session's unshown reveal is recovered. Each was
verified to FAIL against a simulation of the behaviour it replaces (first-wins,
and no-ack).

**Verified live on real data**, owner account, then fully restored (36 seals /
41 ratings / v2 / 0 recoverable, vector written back from snapshot): a single
reveal now names its dish (燒鵝 / Roast Goose) and carries the taught line; and
a three-card stack — this session's 豉汁蒸排骨 first, then recovered 雲吞麵 and
燒鵝 — rendered in deterministic order, each correctly attributed, with the
streak correctly absent because the 近 broke the run.

## 2a/2b. Seal band calibration — ✅ `e8ccb4e` (diagnosis `e79c822`, simulation `0d851e0`)

The BACKLOG entry as it stood at decision time:

> ## 2b. Seal band calibration — BLOCKED on owner decision — *(Fable/Opus)* [F]
>
> Diagnosis complete, **no code changed**: `docs/rnd/seal-band-calibration.md`.
>
> Headline: two of the four seal bands (`love`, `dislike`) are structurally
> unreachable — 36/36 predictions landed in `like`/`meh`, 0 hits possible on the
> 36% of ratings that were actually love/dislike, outcomes 12 hit / 24 near / 0
> miss. Cause is arithmetic, not taste: `contentScore` divides the dimension sum
> by all 18 dims while summing over only the ~8.7 a dish reports, crushing that
> term so `predicted_raw ≈ 0.3 × cuisineAffinity` (verified exactly against a
> live seal: 82% of the score was the cuisine bonus).
>
> Two findings that constrain the answer: predicted_raw **drifts upward with
> profile maturity** (mean roughly triples from thin to mature), so fixed edges
> fitted today decay; and `sealed_predictions` has **exactly one distinct user**,
> so there is no cross-user data to fit to at all.
>
> Four options with tradeoffs in the doc — (a) separate PREDICTED_BANDS, (b)
> normalize before banding, (c) per-user adaptive, (d) fix the divisor in
> contentScore. (d) treats the cause but changes recommendations app-wide and
> needs simulation first. Also open in the doc: whether to backfill the 36
> revealed rows (possible — both raw and actual are stored), and the note that
> the clean window for doing so exists only because the render bug meant none of
> those outcomes were ever displayed.
>
> **Owner decides the approach before any code lands.** This changes what the
> seal means.
> ## 2b. Seal band calibration — BLOCKED on owner decision — *(Fable/Opus)* [F]
>
> Diagnosis complete, **no code changed**: `docs/rnd/seal-band-calibration.md`.
>
> Headline: two of the four seal bands (`love`, `dislike`) are structurally
> unreachable — 36/36 predictions landed in `like`/`meh`, 0 hits possible on the
> 36% of ratings that were actually love/dislike, outcomes 12 hit / 24 near / 0
> miss. Cause is arithmetic, not taste: `contentScore` divides the dimension sum
> by all 18 dims while summing over only the ~8.7 a dish reports, crushing that
> term so `predicted_raw ≈ 0.3 × cuisineAffinity` (verified exactly against a
> live seal: 82% of the score was the cuisine bonus).
>
> Two findings that constrain the answer: predicted_raw **drifts upward with
> profile maturity** (mean roughly triples from thin to mature), so fixed edges
> fitted today decay; and `sealed_predictions` has **exactly one distinct user**,
> so there is no cross-user data to fit to at all.
>
> Four options with tradeoffs in the doc — (a) separate PREDICTED_BANDS, (b)
> normalize before banding, (c) per-user adaptive, (d) fix the divisor in
> contentScore. (d) treats the cause but changes recommendations app-wide and
> needs simulation first. Also open in the doc: whether to backfill the 36
> revealed rows (possible — both raw and actual are stored), and the note that
> the clean window for doing so exists only because the render bug meant none of
> those outcomes were ever displayed.
>
> **Owner decides the approach before any code lands.** This changes what the
> seal means.

Owner decided (d) fix the root cause everywhere + recompute history. Both
answers met evidence that changed the work; full write-up with all numbers in
`docs/rnd/seal-band-calibration.md` §8-9, simulation in
`scripts/simulate-seal-bands.ts` (fixture `scripts/seal-rows.json`).

**Root cause was arithmetic, not taste.** `contentScore` summed over only the
dims a dish reports (mean 8.7) but always divided by `DIMS.length` = 18,
crushing the taste term so `predicted_raw ≈ 0.3 × cuisineAffinity`. Consequence:
`love` (≥ 0.5) and `dislike` (< −0.15) were structurally unreachable — **0 of 11
genuinely loved dishes were ever called**, and 24 of 36 outcomes were a lukewarm
`near`. Verified exactly against a live seal: 82% of that score was the cuisine
bonus; all eighteen taste dimensions contributed 0.068.

**The recommendation as first specified was wrong, and the owed blast-radius
check caught it.** §5 proposed flooring the divisor at 4; simulating ranking
impact showed that costs ~3pp of pairwise accuracy on really-rated dishes. The
floor was the whole ballgame — dividing by a raw count over-amplifies sparse
dishes (attribute counts span 6–12). `MIN_SCORED_DIMS = 10` is the only value in
a 1..18 sweep that regresses neither ranking metric while unlocking `love`.
Lower floors call more loves but cost ranking accuracy; the conservative end was
taken deliberately, because recommendation quality gates everything and a better
seal is worth less than recommendations that are no worse.

Shipped: ranking all-pairs 76.1% → 76.1% (unchanged), within-cuisine 68.1% →
69.9%; seal hit rate 33.3% → 52.8%, `like` recall 50% → 75%, `love` recall 0% →
27%. Verified live end-to-end: the same dish scoring 0.3680 before now scores
exactly 0.4225. Tests pin the divisor and provably fail against the old `/18`.

**"Recompute history" was impossible** — recomputing `predicted_raw` needs the
seal-time taste vector, and only the resulting value was ever stored. Doing it
against today's profile would fabricate predictions the engine never made, which
for a "written in advance, never altered" mechanic is worse than an honest gap.
Historical outcomes left as computed (a v1 hit WAS a real correct prediction);
`sealed_predictions.scoring_version` added instead so v1 and v2 can never be
silently averaged. Streak still counts across both — each hit is genuine
regardless of formula.

**Open remainder — CLOSED 2026-07-26 by `8432890`.** As written here (and in
BACKLOG until now), `dislike` was still unreachable (0/2): two real dislikes in
the whole dataset is not enough to tune against, and fitting an edge to two
points would be overfitting, not calibration. That framing assumed the fix had
to be a better EDGE. Per-user quantile banding (`predictedDirectionOf`) reached
the band without touching an edge at all — it maps a prediction through the
person's own predicted and actual distributions, so nothing is fitted to the 36
seal outcomes and there is no free parameter to overfit. Measured before ship,
`docs/rnd/seal-band-calibration.md` §12:

| scheme | hit | near | miss | bands used |
|---|---|---|---|---|
| fixed edges (was shipped) | 5 | 23 | 8 | 2/4 |
| constant `like` (baseline) | 20 | 14 | 2 | 1/4 |
| **quantile-mapped (shipped)** | **20** | 16 | **0** | **4/4** |

All four bands in use, zero misses (down from 8), and `dislike` called 2/2 —
the first time in the project's history. Per-band recall: love 5/11, like 12/20,
meh 1/3, dislike 2/2.

**The caveat §12 records, kept here so the close is not read as stronger than it
is:** quantile mapping TIES the constant-`like` baseline on raw hits (20 of 36
real outcomes are `like`, so a constant predictor also scores 20). The case for
it rests on zero misses instead of two, four live bands instead of one, and
being a real prediction rather than a constant — not on the hit number.

`MIN_SCORED_DIMS = 10` stays open and genuinely provisional; it is still the one
fitted constant, chosen on one palate.

---

# Direction: what the taste engine is FOR (owner, 2026-07-24)

Stated by the owner while reviewing the seal/calibration work. Recorded because
it reframes what counts as progress, and because everything below it is
downstream of it.

> "dishi should learn in the future why you like 乾炒牛河 at restaurant A and
> not 乾炒牛河 at restaurant B. It's the core idea of taste learning, not just
> simple understanding of how the dish is made nor what kind of ingredients it
> used, but how it was cooked and prepared that matters. Why there are good
> chefs and bad chefs, the NORMAL way of how people judge tastes in real life.
> I don't need the engine to understand this at day 1. But definitely by design
> this has to be the aim otherwise there's no future for the product."

**The aim: EXECUTION, not composition.** The same dish, cooked by two kitchens,
is two different experiences — 鑊氣, seasoning balance, freshness of the oil,
whether the beef is tender or grey. That difference is how real people actually
judge food, and it is the thing no ingredient list can capture.

**Why this is a design constraint and not a feature request.** The current
engine scores a dish from its ATTRIBUTES (`contentScore` over 18 compositional
dims). Two instances of 乾炒牛河 have near-identical attributes, so the engine
is structurally incapable of preferring one kitchen over another. Every
mechanic added from here should be judged against whether it moves toward
execution-level signal or entrenches composition-level scoring.

**What that implies (not yet built, recorded so it isn't lost):**
- The substrate already exists: `dish_identities` links the same real dish
  across restaurants. Same-identity, different-restaurant is exactly the
  comparison that isolates execution from composition.
- The 18 dims describe WHAT a dish is. Execution needs signal about HOW WELL it
  was made. That is a different axis, not a 19th dim.
- Duels are the natural instrument: a duel between two INSTANCES of the same
  identity holds composition constant, so the entire contrast is execution.
  (Duels stay — the owner never asked to kill them; low usage is a surfacing
  problem, not a verdict. See the correction in BACKLOG.)
- Restaurant-level quality is the emergent output: "good chefs and bad chefs"
  falls out of aggregated per-execution signal, and is also the consumer-side
  demand data the business case rests on.

**Sequencing:** explicitly NOT day-one. The near-term work is making the
existing signal honest and discriminating (self-calibrating rating scale,
non-saturating affinity, feeding the starved dims) — because execution-level
learning needs a trustworthy base to sit on. But no near-term choice may
foreclose it.

---

## Self-calibrating rating scale + seal percentile bands — ✅ SHIPPED `d8115f5`, `8432890` — pushed 2026-07-26

The two BACKLOG entries as they stood at decision time (carried together
because each note said to move them "as one story"):

> - [x] **Seal bands: per-user quantile mapping — BUILT, verified, not yet
>   pushed.** Fixes the §11 breakage (fixed edges 0.35 apart could not carve a
>   0.26-wide predicted distribution, so predictions collapsed to one band: 5/36
>   hits, 2 of 4 bands ever used). `directionOf` still bands the actual flick;
>   new `predictedDirectionOf` in `src/lib/seal.ts` bands a PREDICTION by mapping
>   it onto the person's own flick scale. Distributions recomputed live in
>   `stakeSeal` — no stored state, no migration. `SCORING_VERSION` → 3.
>
>   Measured (`scripts/simulate-seal-percentile-bands.ts`, evidence in §12):
>   hits 5 → 20, misses 8 → 0, bands used 2 → 4, `dislike` called 2/2 for the
>   first time. Ties a constant-`like` predictor on raw hits (both 20 — that
>   baseline exists because 20/36 outcomes are `like`) but wins on misses, band
>   coverage, and actually being a prediction. Beats or ties the constant across
>   generous/harsh/discriminating/one-note rating styles; beats shipped fixed
>   edges at every history size, so no warm-up gate was needed.
>
>   **Remaining before this can be called done:** a rendered screenshot of the
>   reveal card showing a non-`meh` predicted band end-to-end. No UI code
>   changed (the card is `SealRevealBadge.tsx`, untouched — only the data
>   reaching it), but the batch's own bar asks for pixels, and producing them
>   needs a logged-in session with a pending seal.
>
>   Move this entry and the calibration entry below into DECISIONS.md together
>   once pushed — they are one story.
>
> - [x] **Self-calibrating rating scale — SHIPPED, but see the warning below.**
>   Implementation: `src/lib/taste.ts` (`neutralCenter`, `calibratedScore`,
>   `PRIOR_CENTER`, `CENTER_PRIOR_K`), `src/lib/replay.ts`, `src/app/api/ratings/
>   route.ts`. Tests: `tests/taste.test.ts` (calibration describe blocks).
>   Evidence: `docs/rnd/seal-band-calibration.md` §10. Full rationale and the
>   centre-location decision belong in DECISIONS.md — not yet moved there
>   because of the warning below; move it once the seal-band fix ships
>   alongside it, so the two land in DECISIONS.md as one coherent story.
>
>   **Decided (owner, 2026-07-24):** do NOT hardcode what 一般般 is worth —
>   score each rating relative to the user's OWN learned neutral point instead
>   of the raw flick value. Measured: pairwise ranking accuracy 76.1% → 80.8%
>   overall (n=522), 72.7% → 75.8% within-cuisine (n=161).
>
>   **Centre-location decision (made 2026-07-25):** option (a), an extra query
>   over the user's own prior scores in `/api/ratings`' non-re-rate branch —
>   cheaper than the full replay the re-rate branch already runs, and the only
>   option provably identical between the incremental and replay paths (a
>   median has no running-scalar form, so option (b)'s stored value would mean
>   a second copy of every score — the exact divergence risk this was picked to
>   avoid). Option (c), letting the incremental path lag, was rejected as
>   guaranteeing the divergence rather than risking it.
>
>   **Seal decision:** `directionOf` reads the RAW flick, not the centred score
>   — the seal is a claim about the flick the person made, and its bands were
>   calibrated on raw flicks. This is unchanged and is NOT the source of the
>   breakage above; the breakage is `contentScore`/affinity feeding into
>   `directionOf`'s fixed edges, not `directionOf` itself.
>
>   **⚠️ SHIPPED WITHOUT ITS GATE — read before touching this branch.** The plan
>   was: build, verify, hold locally, ship together with the seal-band fix so
>   the seal never regresses in production even briefly. That held for about a
>   day (commit `d8115f5`, deliberately unpushed). A later session ran `git pull
>   origin main` on the same local branch and pushed the resulting merge
>   (`0df7190` → ... → `0f3d4c5`) without knowing the calibration commit sitting
>   on that branch was embargoed — git has no way to mark a commit "hold this
>   one." **Lesson for every future session:** before pushing anything on this
>   repo, check `git log origin/main..HEAD` for commits you didn't just write,
>   and ask before pushing if you find one. A backlog note alone didn't stop
>   this — the embargo lived only in a prior session's memory, not in a form
>   git or a fresh session could see.

**Both landed on `main` 2026-07-26** in a batch push alongside the execution
slider work (`d25d0c3`..`550c738`), closing the embargo gap the warning above
describes — `d8115f5` and `8432890` are confirmed ancestors of `origin/main`.

**The screenshot requirement was met at component level, not via a live
reveal.** The original ask specified pixels from "a logged-in session with a
pending seal" — that would need a real `/api/seals` → `/api/ratings` round
trip against a production account. Instead, `SealRevealBadge.tsx` (the real
component, unmodified) was mounted in a temporary dev-only route
(`src/app/dev-seal-preview`, deleted immediately after) with four mock
`SealResult` props spanning the outcome space: predicted `love`/actual
`love` (hit), predicted `like`/actual `love` (near), predicted `meh`/actual
`meh` (hit — included so "what does meh look like" has an answer on record),
and predicted `dislike`/actual `love` (miss). All four rendered and opened
correctly, screenshotted. This proves the component renders every
predicted/actual/outcome combination correctly; it does **not** prove the
live data pipeline (percentile mapping → `/api/ratings` → this component)
wires up in production, which is what "end-to-end" in the original bar meant.
No pending seal was found on any real account to verify that live — worth
re-checking the first time a real seal reveals a non-`meh` band in
production.

**Operational note:** an earlier attempt at this verification created test
dishes/seals on `wool.hk@gmail.com`, a real external tester's account the
owner does not control — caught and reverted before anything was seen by
that tester. Test fixtures for this app belong on the owner's own account
only, never a tester's.

---

# Direction: comparison is the core product DNA (owner, 2026-07-26)

Stated while specifying the execution slider, and recorded as a standing
direction because it governs what counts as on-strategy from here.

> "we can have more interactions like these (different dishes / same dishes at
> different places / ...etc) to fine tune the understanding of user's taste.
> this is the core product DNA and should stick to it with evolving ideas and
> executions to deliver"

**The claim.** People do not judge food by assigning absolute scores in a
vacuum; they judge by comparing. So the engine's primary instrument is a FAMILY
of comparison interactions, not any single mechanic — and that family is
expected to keep growing rather than being "done."

Known members so far:
- **different dishes** — 對決 duels. Shipped. Teaches the taste vector from
  attribute contrast (`duelContrast`, `updateTasteFromDuel`).
- **the same dish at different places** — the 1-10 execution slider. Specced in
  BACKLOG. Teaches restaurant×dish execution quality, never the palate.
- more to come; new comparison mechanics are on-strategy by default.

**Why this pairs with the execution aim.** It is the practical answer to
"Direction: what the taste engine is FOR" (2026-07-24) — comparison is what
isolates execution from composition. Holding the dish constant and varying the
kitchen leaves execution as the only difference; holding the person constant and
varying the dish leaves taste as the only difference. Each comparison type
subtracts a different confound, which is why a family beats any one mechanic.

**Two binding consequences.**

1. **One visual chassis, extended by rearrangement.** `DuelSide.tsx` already
   exists as the extracted side-anatomy of a two-dish comparison (photo /
   zh-pinned name / location) precisely so a second card — the identity-confirm
   card 係咪同一味？ — could mount it instead of a lookalike. Every future
   comparison mechanic mounts the same chassis and rearranges what wraps it.
   Building a similar-looking card is the wrong implementation, not a shortcut.
   What each card wraps around a side stays a conscious per-card decision:
   duels wrap a tappable button ("I prefer this"), the identity card wraps a
   static div so duel muscle memory cannot merge two dishes by accident.

2. **The interaction generalises; the learning math does not.** A duel's
   learning is attribute-contrast based and is structurally incapable of
   carrying execution signal (two 乾炒牛河 have near-identical attributes, which
   is why `selectDuelPair` skips same-identity pairs). That is a statement about
   the MATH, not the interaction. Each new comparison type needs its own answer
   to "what does this teach, and where does it go" — reusing the chassis must
   never be taken as licence to reuse the update rule.

---

# Identity, connection, and export positioning (owner, 2026-07-26)

Five decisions taken together, because they only make sense as one shape:
a person gets a NAME, other people can FOLLOW that name, what the name
publishes is a PUBLIC taste page, and the AI export stops carrying a
character. The vision they feed (dishi.username: post/bookmark, daily
content, 食家 tier) is filed in BACKLOG under "VISION — needs Fable
architecture review"; these five are the settled inputs to it.

## 1. Username, set at v1 unlock

`dishi.[username]` is chosen the moment v1 unlocks — framed as an emotional
milestone (you have built v1 of your own taste AI), never as a settings
chore.

**No gate change is needed.** v1 IS `exportUnlocked(conf)`, i.e.
`evidenceConfidence >= EMERGING_AT (0.33)` — the single source of truth in
`tasteExport.ts`, which `version.ts` deliberately does not duplicate. What
that costs in ratings, from the formula (`0.55·min(1,rc/25) + 0.30·cov +
0.15·variety`):

- zero coverage and zero variety: **15 ratings**
- a realistic early mix (~6 explored dims, ~3 cuisines): **8 ratings**

So it is already double digits for typical use, and naming happens with a
real profile behind it. The earlier worry about "naming at dish 5" was
confusing this gate with `SEAL_GATE = 5`, which is the seal mechanic's
threshold and unrelated.

A planned album-based onboarding stream (separate work, TBC) feeds the gate
naturally — a person arrives at v1 with history rather than grinding to it.

**What the username retires once it exists:** it supplies the shared-menu
profile indicator, and the ask-for-name card in table entry goes away.

**Sequence with the chop-colour work.** `a0c517c` shipped chop colour as
`f(user_id)` for de-collision. Before building identity, decide whether chop
identity should key off the username instead — and do it once, not twice.

**Rename policy — SETTLED 2026-07-26, and simpler than either earlier
proposal: name it at v1 with a "choose carefully" warning, then exactly ONE
free change, ever.** No conditions, no milestone schedule, no first-share
tripwire. The owner's call, and the right one: every conditional version of
this rule needs the UI to explain a state machine ("you can still change this
because nobody follows you yet"), which is a lot of copy to justify a second
rename. One change is a promise a person can hold in their head, and the
warning at naming time does the real work.

The earlier proposal in this entry (one free rename before the first share or
follower, then at version milestones) is SUPERSEDED — kept below only for the
threshold numbers, which stand and are the reason milestone renames were
never viable. Computed from `versionSubstrate` + `versionThreshold`
(2026-07-26), across mixes from narrow (8 dims / 3 cuisines) to saturated
(18 dims / 15 cuisines):

| version | substrate threshold | ratings needed |
|---|---|---|
| v2 | 1.150 | 21 – 52 |
| v3 | 1.963 | 78 – 118 |
| v5 | 4.248 | ~290 – 360 |
| v10 | 17.272 | ~2,280 – 2,440 |

v5 is in the low hundreds of ratings and v10 is years-of-use scale, exactly
as the module's own calibration note says — a "rename at v5" valve would open
years after the regret it was meant to relieve. Regret about a name peaks
immediately after choosing it, which is why the settled rule puts the one
change on demand rather than on a schedule.

**Built 2026-07-26.** The username reuses the EXISTING `profiles.handle`
column rather than adding a second identity field: `handle` was already
unique and already the fallback shown on chops and pick attributions, but was
auto-derived from the email local part (`mosuko`, `wool.hk`) — which both
leaked the address and was never chosen. Claiming a username overwrites it,
so one identity string serves the chop, the table, and (later)
`dishi.me/[username]`. See "dishi.username — claim at v1 + one free rename"
below for the implementation.

## 2. There is NO social graph — distribution is by TASTE-RANK — SETTLED 2026-07-27

**Final. This supersedes the earlier "asymmetric follow, not mutual" version
of this decision, and it closes the question — no follow table, no mutual
connection, no accept flow, no friend concept anywhere in the product.**

A follow graph's only contribution to the product is DISTRIBUTION — a way for
a posted dish to reach someone. Dishi already has two distribution channels
that need no graph at all:

1. **The taste-ranked feed** — posts enter the same shared pool as persona
   content and are ranked per user with `contentScore`. A post reaches whoever
   the ranking says it matches.
2. **Messenger share** — a link sent to a specific person. That is
   friend-trust distribution, and it is a URL, not a schema.

A graph would be a third channel duplicating both, and it is the one that
makes Dishi look like a social network.

**Why taste-rank and not a graph — the strategic core.** IG, Threads, FB and X
all distribute by social graph. That is their turf and their moat; Dishi
cannot win there and should not enter. Distributing by TASTE MATCH is Dishi's
own turf and rests on the dish-level vectors none of them have. The recorded
amendment already says it for persona content — *"Ranking is what makes it
Dishi. Identical content for everyone is a magazine, and a magazine is where
Dishi has no edge"* — and it applies to user posts identically.

**What this buys, beyond simplicity:**

- **Nothing to farm.** 食家 was parked because influence metrics are gameable.
  With no follower count there is no status ladder to climb, which removes the
  gaming surface rather than policing it.
- **Achievement stays tied to food.** The reward for posting is *N people want
  to try this dish*, not a follower number — social value that feeds the
  engine instead of competing with it.
- **The better business artifact.** Bookmarks are intent-to-eat at dish level,
  which is exactly the recorded moat and is sellable as demand insight without
  touching the never-sell-placement rule. A follower graph produces no such
  data.

**Binding consequence, UNCHANGED and now stronger: 貼文 is PUBLISHING, not
friend-sharing.** A post can be surfaced to anyone the ranking matches, so
copy must say 公開/public and must NEVER say "friends" — there is no friend
relationship in the product to describe.

Unchanged: 食記 stays private by default, and posting stays per-dish opt-in.
**Companion edges must never be inferable from a public post** — who you ate
with is not part of what you publish.

**The fallback, recorded so it is not re-litigated:** if taste-ranked
distribution measurably underperforms, ASYMMETRIC follow is the shape to add —
one directional row, no lifecycle. MUTUAL connection is rejected outright: it
needs a pending/accepted/blocked state machine, turns every feed read into an
edge join, and would make posts friends-only, contradicting the publishing
consequence above. Adding a graph requires evidence that taste-rank failed,
not a preference.

**Accepted risk:** if posting is visibly rewarded, people may inflate ratings
to justify a post. Ratings are private and posting is per-dish opt-in, so
exposure is limited — but this is the same corruption that parked 食家, and
bookmark counts must be watched once visible.

## 3. The dossier IS the public taste page — there is no third artifact

`dishi.me/[username]` is the shareable taste identity. A "copy for AI" button
on that page emits the third-person text a friend can hand to their own AI.
One artifact, two readers.

- **Contents:** version + 識 N 味, top dimensions, and anchors WITH restaurant
  names ("炒蝦 @ 雀友茶樓"). The restaurants are the credibility — dimensions
  alone read as a horoscope. A posted-dish feed is a later second section.
- **Visibility:** publicly viewable WITHOUT login. A signup wall here kills
  the acquisition path the page exists to serve.
- **Density gate:** automatic, no separate rule — no username before v1, no
  share before a username.
- **Exposed:** anchors and restaurant names yes; **eaten dates NO** (they
  reveal whereabouts and patterns); **companions NEVER**; full 食記 no, only
  opt-in posts. One toggle hides restaurant names, accepting a weaker page.

**Why this survives the channel that killed the taster** (persona Phase 0.5
§4): a third-person reference document contains no behavioural instructions,
so attachment conversion is irrelevant — there is nothing for a host to
refuse. It is data, and hosts accept data (§5, payload/costume split).

**Two hard rules:**
1. A dossier NEVER enters the recipient's taste engine. It is read-only
   context for a human or their AI; a vector learns only from what that
   person actually ate and rated. Anything else is the phantom-preference
   failure mode that import was rejected for in the first place.
2. A dossier is never visible during a rating flow. Seeing a friend's verdict
   before you flick contaminates the rating at source.

## 4. "No friend graph" STANDS — for a better reason than before — SETTLED 2026-07-27

This decision reversed itself twice and is now closed. History, so nobody
reopens it: the standing line was "no friend graph yet"; on 2026-07-26 that
was reversed to "asymmetric follow plus a public taste identity"; on
2026-07-27 the reversal was itself withdrawn (decision 2).

**Final position: no social graph, and not as a "not yet."** The original line
was right by accident — it read as a deferral. The settled reason is
structural: distribution is solved by TASTE-RANK plus messenger share, so a
graph has no job left to do. See decision 2.

**What earns its place on the recorded product test** is not the connection
mechanic. An earlier version of this paragraph said it was **bookmark → 待評**,
"the only thing that generates same-dish-different-restaurant pairs."
**CORRECTED 2026-07-27: that is false.** People eat common dishes at different
restaurants constantly with no prompting — the claim rested on a premise
invented in review and never checked.

The real blocker is measurement, not behaviour. Re-measured 2026-07-27:
**46 of 50 rated dishes have no `dish_identity_id`, and 3 identity rows exist
in the whole database.** The same dish at ten restaurants records as ten
unrelated dishes today, so the execution slider cannot fire regardless of how
anyone eats or what anyone recommends. Fixing dish identity resolution
plausibly outranks every social mechanic here, because it gates a feature that
is already built and shipped and is testable by one person alone.

The earlier justification said "a recommendation from someone you follow is
the most likely reason a person eats 乾炒牛河 somewhere new." That argument
does not discriminate — a recommendation surfaced by taste-match generates the
same pair, and Dishi's whole premise is that taste-match beats social
proximity for food. If that premise is false, the engine has a larger problem
than the feed.

**Consequence for the public page:** decision 3 is unaffected and does not
depend on a graph. `dishi.me/[username]` is a public URL anyone can visit —
there is no follow button on it, and there never was a need for one.

## 5. The export becomes TASTE-ONLY; personas move in-app

The export imports taste LEARNING into the user's own AI, with no character
required: summon it by name, have it understand that this taste should
influence food-related answers, and let it live in a specific Project rather
than in global memory. That is exactly the shape that tested well in Phase
0.5 — install-only, summonable, with no promise of ambient surfacing.

**Recorded as a deliberate partial retirement, not drift.** Affected: the
three persona briefs, the persona install flow, `taste_profiles.persona`, and
the voice/chime/house-rule apparatus in `tasteExport.ts`.

**Do NOT delete the personas.** In-app is where a persona cannot be refused
by a host — the one place the costume half of the payload/costume split
actually works. Retire it from the EXPORT path only.

**The install card must NOT promise ambient self-surfacing.** Proactive
surfacing is a standing behavioural instruction, which is the precise
category hosts decline. Teach one summon path as reliable; describe ambient
surfacing as *may happen on some hosts*, or leave it out.

No code was written for this in the recording session — the export rewrite is
filed as its own BACKLOG item.

---

# `scripts/seal-rows.json` cleared from the repo (owner, 2026-07-26)

The fixture the seal-band simulations replay was committed in `0d851e0` before
anyone asked whether it should be. It holds a real person's meals — scores,
cuisines and attribute vectors, with no names, restaurants, dates or user ids —
in a PUBLIC repo. `scripts/rating-history.json` had already been gitignored for
exactly this reason; this one slipped through the same door.

**Decision: clear it.**

- Added to `.gitignore` and untracked (`git rm --cached`).
- `scripts/build-seal-fixture.ts` rebuilds it from the DB, the same way
  `build-rating-fixture.ts` rebuilds the other one. Verified 2026-07-26: the
  rebuilt file reproduces the committed 36 rows byte-for-byte and now returns
  44 (eight seals revealed since it was frozen).
- Every consumer's header names the builder, so a missing fixture reads as
  "run this first" rather than a broken import. `scripts/` is already excluded
  from the root tsconfig, so a missing fixture cannot break `next build` —
  that lesson was learned when `rating-history.json` did exactly that.

**Sweep for others (2026-07-26):** the only tracked files that could carry real
user data are `supabase/seed.sql` (20 hand-authored synthetic dishes, flagged
`is_synthetic`) and `scripts/eval-hk-shorthand.ts` (a curated list of dish
NAMES, no ratings). `seal-rows.json` was the only leak.

**The honest limit, recorded rather than glossed:** the file has been public
since `0d851e0`. Removing it from HEAD stops it reaching any future clone, and
a history rewrite removes it from the commit graph — but existing clones,
forks, and any mirror or cache that already fetched it keep their copy. This
is worth doing and it is not erasure. Treat anything that has been pushed to a
public repo as having left the building; the durable fix is the `.gitignore`
rule that stops the next one.

## History rewrite: NOT doing it (decided 2026-07-26)

The brief specified a `git filter-repo` rewrite plus force-push. Declining, on
a proportionality reading the owner delegated:

- **What is exposed is weak.** Floats, cuisine labels and attribute vectors for
  44 meals. No names, no restaurants, no dates, no user ids, no dish text.
  It is not re-identifiable, and it is one person who is the repo's own owner.
- **A rewrite cannot achieve the thing that would justify its cost.** The blob
  has been fetchable since `0d851e0`; clones, forks and GitHub's own
  unreferenced-object retention keep it either way. The rewrite buys tidiness
  in the commit graph, not confidentiality.
- **Its cost is concrete and lands on a live workflow.** It rewrites every hash
  on `main`, which breaks every existing clone and working copy, and the
  claude.ai Project is re-synced from this repo after every push. Neither
  `git filter-repo` nor BFG is installed, so the operation would also be a
  first run of an unfamiliar tool against the only copy of the history.

**Reversible if the judgment changes.** Nothing here forecloses a rewrite — the
blob stays exactly where it is, and the calculus only shifts if something
genuinely identifying is found to have been committed. The rule that matters is
already in place: fixtures built from real data are gitignored and rebuilt from
the DB, so there is no next one.

---

# 佢哋整得點？ — the 1-10 execution slider — ✅ SHIPPED `575c153` (data + learning), `15a9399` (UI), `d0d689c` (tests), `bc312bd`, `8b31fb1`, `550c738` (2026-07-26)

Moved from BACKLOG 2026-07-26 on an audit: the entry was still sitting under
"Ready to build" while every part of it was live — migration
(`supabase/applied/ratings_execution_score.sql`), `/api/ratings/execution`,
`executionRangeFor` + the exclusion rule in `taste.ts`, identity-aware
`replay.ts`, `ExecutionSlider.tsx` mounted in `RatingStack.tsx:772`, its CSS in
`globals.css`, i18n keys, and `tests/executionSliderChassis.test.tsx`.

Both *(extension, flag to owner)* annotations in the spec below were confirmed
by the owner on 2026-07-26 and are marked inline: the mirrored positive bound,
and broadening the trigger beyond negatives-only.

**The spec as built, verbatim:**

- [ ] **[Opus] 佢哋整得點？ — a 1-10 execution slider. Supersedes the 火腿通粉
  binary question entirely (owner, 2026-07-26).** This is the first build toward
  the recorded product aim "why you like 乾炒牛河 at restaurant A and not at
  restaurant B" (DECISIONS.md, "Direction: what the taste engine is FOR",
  2026-07-24). That entry gated execution-level work behind making the base
  signal honest first — self-calibrating scale, non-saturating affinity, starved
  dims. All three have now shipped, so the gate is passed.

  **The design shift that makes this better than what it replaces.** The earlier
  spec ASKED "係唔啱我，定係佢哋整得唔好？". This one never asks: it measures each
  instance and lets the DATA answer. 火腿通粉 at A scores 2; when 火腿通粉 at B
  later scores 8, the dish is obviously fine and A is the problem. The
  dish-vs-execution distinction falls out of comparison instead of a self-report.
  Consequence, accepted by the owner: a dish eaten only ONCE stays ambiguous, so
  the 火腿通粉 row keeps mis-teaching the palate until that dish is eaten
  somewhere else.

  **Why a 1-10 scale doesn't reintroduce the problem calibration just fixed.**
  An absolute scale across PEOPLE has the "everyone's scale is different"
  problem. This one is scoped to one person AND one dish identity — "how does
  this 乾炒牛河 compare to the other 乾炒牛河 you have had" — so the comparison
  set is fixed and it is self-calibrating by construction. Cross-user
  aggregation will need the same neutralCenter treatment; that is a later
  problem, do not solve it now.

  **1. The mechanic.** After rating, one slider: 佢哋整得點？ 1-10, passing line
  at 5. Replaces the two-tap binary; there is now exactly ONE execution question
  in the app, never two on one rating.

  **2. Range is BOUNDED BY THE FLICK so the two cannot contradict** (owner):
  a flick clearly below the person's own neutral can only take 1-4 — you cannot
  have flicked 唔會再食 and call the plate a 9.
  - flick clearly below neutral (`calibratedScore <= -0.20`) → slider 1-4
  - flick clearly above neutral → slider 5-10, by the same logic in reverse.
    The owner specified only the negative bound; this mirrors it rather than
    leaving "loved it, cooked terribly" reachable. *(Owner-confirmed
    2026-07-26; live in `executionRangeFor`, src/lib/taste.ts.)*
  - otherwise → full 1-10

  **3. When it appears** — either condition:
  - the flick is clearly off the person's neutral (same trigger as the old
    spec: `calibratedScore` beyond ±0.20, after a 10-rating warm-up — both
    constants measured, see git history for "badly-cooked" commit), OR
  - the dish identity already has a rated instance, so a comparison exists.

    The old spec was NEGATIVES ONLY. That cannot stand here — a comparison
    needs the good instance too, or 乾炒牛河 at B=8 never gets recorded and A=2
    compares against nothing. Broadened deliberately. *(Owner-confirmed
    2026-07-26; live in `/api/ratings`, which builds the reference side
    whenever a sibling instance exists, whatever its sign.)*

  **4. What it teaches.**
  - Stored per rating; NEVER teaches the taste vector directly.
  - Palate protection is COMPARATIVE and retroactive: a rating drops out of
    taste learning once its execution score is at or below the passing line
    AND another instance of the same `dish_identity_id` scored higher — that
    is the moment the engine can actually tell it was the kitchen. Before that
    the rating is ambiguous and keeps teaching, which is honest.
  - Restaurant×dish quality is the aggregate of execution scores grouped by
    restaurant and identity. That is the demand-data asset; v1 COLLECTS ONLY.
    Owners see nothing. If it ever becomes owner-visible it must be
    un-editable and must never touch ranking.

  **5. UI: REUSE THE DUEL CHASSIS, rearranged — do not build a new surface**
  (owner, 2026-07-26). `DuelSide.tsx` is already the extracted shared anatomy of
  a two-dish comparison (photo / zh-pinned name / location), and its own header
  records that the identity-confirm card mounts it rather than a lookalike. The
  execution slider is its THIRD consumer: two instances of the same identity
  side by side on the same chassis, with the slider replacing the pick buttons.
  `DuelOverlay.tsx` supplies the floating-card shell, the resolve → reveal →
  OK rhythm, and the dismiss semantics; rearrange those, don't re-invent them.
  Per the repo's "reuse, don't imitate" rule, copying styles to make this
  resemble a duel is the wrong implementation, not a shortcut to it.

  Keep in mind what each side WRAPS is per-card and deliberate (duels wrap a
  tappable button meaning "I prefer this"; the identity card wraps a static div
  so duel muscle memory can't merge two dishes by accident). The slider needs
  its own wrapper decision made consciously, not inherited.

  **What duels can and cannot contribute.** The duel LEARNING MATH cannot carry
  execution: `duelContrast` reads attribute differences only, and two 乾炒牛河
  have near-identical attributes, so `selectDuelPair` (src/lib/duels.ts:81)
  rightly skips same-identity pairs — leave that exclusion in place for taste
  duels. That is a statement about the math, NOT about the interaction: the
  duel's side-by-side comparison IS the right instrument, which is exactly why
  this item mounts its chassis. Note also that commit `f9f1aed` bumped duel
  surfacing 0.3 → 0.55 citing same-dish execution contrast as its rationale —
  that rationale describes behaviour the code does not have; the bump only
  serves more ordinary duels.

  **DATA REALITY — read before promising anything.** Measured live 2026-07-26:
  the owner has ZERO dish identities eaten at two different restaurants. Two
  identities repeat at all (蛋撻 ×2 scoring 0.1/0.35, 壽司拼盤 ×2 scoring 0.6/1)
  and both are the SAME restaurant on different visits — which is still real
  execution variance (a good day vs a bad day) and should count, but it is not
  the good-chef/bad-chef signal. So the comparison payoff fires ~0 times today.
  Build it anyway: unlike the negative-rating ceiling (which no amount of
  logging fixes), this one accrues automatically from normal use — every score
  banked now becomes usable the first time a dish repeats elsewhere.

  **Implementation notes.**
  - Migration: `ratings.execution_score smallint check (execution_score between
    1 and 10)`, null = unasked/skipped. Apply live, record in `supabase/applied/`.
  - `/api/ratings` returns whether to ask AND the permitted range; the client
    must never compute either, or the two drift.
  - Setting the score may change what a rating teaches (rule 4), so it must
    trigger `replayProfile` — the proven re-rate path.
  - **Both learning paths must agree exactly** (the standing constraint):
    `replay.ts` and the `/api/ratings` incremental branch need the same
    exclusion rule, and replay must become `dish_identity_id`-aware to evaluate
    it. A test must DETECT divergence, not tolerate it.
  - Skipping the slider must stay free — no badge, no nag.

  **Verification bar**: tests provably fail against pre-change behaviour;
  screenshot the slider state. Simulate the learning-exclusion rule against the
  real history before shipping — it changes the taste vector.

## Its ancestor entry — the binary question it replaced

Kept because it records WHY the problem matters, which the slider spec assumes
rather than restates. It was superseded before any code was written for it;
nothing here was ever built as a binary question.

- [ ] **[F] A flick can't say "the dish is fine, this place cooked it badly."**
  Raised by the owner 2026-07-26 from a real rating: 火腿通粉 scored low not
  because they dislike the dish but because the shop served the soup "like hot
  water." The engine reads every low flick as a statement about the DISH, so that
  rating is currently teaching their palate to dislike macaroni soup. Voice notes
  make it worse, not better — `extractVoiceSignal` converts "soup was like hot
  water" into taste attributes plus a sentiment nudge, laundering a complaint
  about a chef into a permanent preference (see `src/lib/voice.ts` SYSTEM prompt,
  which has no concept of execution).

  Two reasons this is bigger than a data-quality annoyance:
  (1) it corrupts the taste vector for every diner who eats a badly-made version
  of something they'd otherwise like — a systematic bias, not noise;
  (2) "this restaurant makes this dish badly" is dish-level demand data, the
  exact consumer-side signal the business model is built on, and it is currently
  being discarded at the moment it's generated.

  **SUPERSEDED 2026-07-26 — do not build this as a binary question.** The owner
  replaced it with a single 1-10 execution slider that measures each instance
  instead of asking which cause it was; the dish-vs-execution answer then falls
  out of comparing instances. See "佢哋整得點？" under "Ready to build". This
  entry stays only because it records WHY the problem matters.

---

# Log-entry redesign (食物相 / 打字 / 外賣單) — DIRECTION ABANDONED (owner, 2026-07-26)

The 2026-07-22 redesign reorganized log entry around what the user is HOLDING
— 📷 食物相 (any food photo) · ✎ 打字 (no photo, type a name) · 🧾 外賣單 (a
delivery-order screencap) — replacing 餐廳菜/住家菜/相簿舊菜. Items 1 (the IA
change) and 3 (typed quick-add) shipped and were rolled back the same day; the
full original spec, the implementation, and the rollback writeup are already
recorded above. Items 2 (食物相) and 4 (外賣單) were never built.

**Owner's call, 2026-07-26: "tried, and not OK." The whole direction is dead —
not parked, not blocked, not awaiting a design pass.**

The three named paths were items 2, 3 and 4, but item 1 goes with them: the IA
change WAS the three-chip pill, so keeping it open would have left a redesign of
a surface nobody wants redesigned. The entry pill stays as it is today —
餐廳菜/住家菜/相簿舊菜, all three opening the same photo picker, the labels
teaching that everything counts equally.

**Why it failed, from the rollback evidence:** the shipped pill's raw styling
never matched the app's polish, and 打字 hung indefinitely at AI 認緊呢道菜…
because the enrich-before-rating step didn't resolve for the user. Underneath
those two symptoms is the thing that makes a retry unattractive: 打字 asks for
typing before the rating moment, which is friction the photo path doesn't have,
and 外賣單 is a whole screencap-parsing pipeline for a channel nobody had asked
for. The equal-weight logging principle they were meant to serve is already
served by the merged pill.

**Code deleted in the same pass** (it had been preserved unmounted for a retry
that is not coming — a feature-flagged corpse is how regressions ship):
`TypedQuickAdd.tsx`, `src/lib/typedQuickAdd.ts`, `tests/typedQuickAdd.test.ts`,
RatingStack's entire `typed` mode (`TypedEntry`, `typedMode`, `typedSrc`,
`runTypedPipeline`, and every branch keyed off them), and the two entry-chip
icons `PencilIcon`/`TakeawayIcon`. i18n keys `typed.*` removed per the
remove-keys-when-the-last-usage-goes rule. 45 test files / 659 tests pass after
removal, `tsc` clean.

**Deliberately KEPT:** `GET /api/dishes/suggest` + `dishSuggest.ts`. The
predictive dish-name suggestions were born in this batch but shipped into a
different, working surface — the rename editor in `TasteGrowth.tsx` — and are
live. `RestaurantPicker`'s 住家菜/略過 split and its `{kind:'home'}` payload also
stay: the chip is live UI in the scan and MyDishes flows, and only its former
consumer went away.

**For anyone reading older notes:** the 食物相/打字/外賣單 spec still exists in
the Claude Project conversation and in this file's history. Do not rebuild from
it. If a photo-first or typed entry point is ever wanted again, it belongs on
the merged pill as a new decision, not as a revival of this one.

---

# dishi.username — claim at v1 + one free rename — ✅ SHIPPED (backend 2026-07-26; inline UI `09fcb8f`..`ac9df3b`, 2026-07-27/28)

**Status, final (2026-07-28 sync).** The owner's inline placement shipped:
the claim pill under the ink blob as a live input (`263a46d`), claim status
on a circle icon (`4bcfdff`), the claim counted as chance 1 (`d912554`), the
claimed state matching the unclaimed preview's big type (`ac9df3b`). Rename
still opens `UsernameSheet` inside `ExplainModal`. One gap found in the
2026-07-28 review: the table/chop payoff is NOT wired — the ask-for-name
card still fires for claimed users — open as an [S] item in BACKLOG. The
paragraph below is the earlier status correction, kept for history.

**Status correction.** This was briefly recorded as SHIPPED. It is not, and
nothing here is committed. What is real: the migration is applied live, and
`src/lib/username.ts` (+10 tests), `/api/username`, and the `/api/buddy`
identity block are written and passing. What is NOT: the UI. The first pass
put a small button on the version line opening a modal sheet; the owner's
placement is an inline `dishi.[fill-in box]` directly under the ink blob, with
the username line then sitting between the blob and the version line. The
component is a rewrite, but nothing below the UI changes with it.

The decisions in this entry — reusing `handle`, the claim/rename accounting,
the validation rules, the DB-enforced uniqueness — are placement-independent
and stand as recorded.

The first build off "Identity, connection, and export positioning" decision 1.
Owner settled the rename policy the same day: **name it at v1 with a "choose
carefully" warning, then exactly ONE change, ever** — no conditions, no
milestone schedule (see that entry's rename policy for why the conditional
versions were dropped).

**No new identity column.** `profiles.handle` was already unique and already
the string shown on chops and pick attributions — it was just auto-derived
from the email local part (`mosuko`, `wool.hk`), which leaked the address and
was never chosen. Claiming a username overwrites it, so one string keeps
serving the chop, the table, and later `dishi.me/[username]`. Two columns
added (`supabase/applied/profiles_username_claim.sql`):
`username_set_at` (null = never claimed) and `username_changes_used`.

**`username_set_at` is what gates the naming moment, never "handle is
non-empty"** — every legacy profile already has a handle, so reading the
column as "has a username" would silently skip the naming moment for exactly
the people who most need it. `hasClaimedUsername()` exists to make that
mistake hard to write.

**The claim is free; only a rename spends the budget.** Re-submitting the name
you already have is an explicit no-op rather than a spent change — otherwise a
double-tap on 就用這個名 would burn the one chance a person gets.

**Where it lives.** The naming prompt renders on the taste card once
`version.v >= 1`, not inside the rating flow: mid-flick is the wrong moment to
stop someone for a form, and below v1 there is nothing built yet to name.
Once claimed, `dishi.{name}` renders in the same place and taps through to the
rename. The identity rides on the `/api/buddy` response rather than its own
fetch, because the prompt is gated on the version that same response computes.

**Validation** (`src/lib/username.ts`, 10 tests): lowercase latin + digits +
underscore, 3–20 chars, must lead with a letter (so a username can never read
as an id in a path), and a reserved list covering app routes plus
product-impersonation names. Chinese is deliberately NOT allowed here — it
goes in `display_name`, which stays free-form for what a person wants to be
CALLED. The username is a URL.

**Uniqueness is enforced by the database, not the check.** A
`lower(handle)` unique index is the authority; the availability check is a
courtesy that prevents the common case. Verified by dry-run: updating a second
profile to `MoSuKo` while `mosuko` exists is rejected by the index
(`unique_violation`), so a race between two claimants cannot produce two
identical names in different cases.

**UI reused wholesale, no new CSS.** `UsernameSheet` mounts inside the shared
`ExplainModal` (same scrim, same paper card, same dismissal as every other
explainer) and styles itself from existing classes only — `.field`, `.btn`,
`.btn.primary.dirty` for the vermillion save-when-valid state, `.label`.
`globals.css` was not touched: the design system is the owner's to change.

**Fixed during verification:** an unexpected server response (a 401 body, an
unrecognized error) flowed straight into a `t()` lookup and would have
rendered a raw untranslated string at the user. Server error codes are now
whitelisted client-side, with anything unknown falling back to a real message.

Verified with screenshots of all three states (claim, rename with one change
left, rename spent) rendered from the real component. The logged-in placement
on the taste card was NOT photographed: that needs an authenticated session,
and authenticating as the owner is not something to do on their behalf.


---

# Three-stream sync + catalog GO (Fable review, 2026-07-28)

The owner asked for a full review of the 2026-07-21..28 stretch across the
three development streams (engine calibration/R&D, dishi.name, UX/UI), then
approved syncing every document to its findings. The stream map now lives at
the top of BACKLOG.md. What was decided and found:

**1. The canonical dish catalog is promoted to KEYSTONE and is a GO.** All
three streams converge on it: the execution slider (the direct instrument of
"Direction: what the taste engine is FOR") fires ~never without cross-venue
identity; taste-rank distribution and the public taste page sharpen with it;
the decomposition veto is a component of it. The R&D was already decisive —
0 false merges on every run, twice — and the prior entry's own go/no-go
line read ~85–90%. Build item, with the consolidated spec, is in BACKLOG
under "Ready to build". Two sub-tasks the record was MISSING were added:

- **Repoint the execution slider** at `canonical_dish_id` — without this the
  catalog ships and `isExecutionConfounded` still compares within one venue,
  i.e. the flagship mechanic stays starved after its blocker is gone.
- **Re-resolve on name-authority upgrades** — resolution reads the name; the
  ladder can change the name later; a stale resolution must not stick.
  (Interaction between two systems, invisible to either alone.)

**2. The username shipped its UI but not its stated payoff.** The recorded
justification ("retires the ask-for-name card, replaces the leaking handle")
is half-real: the claim overwrites `profiles.handle`, but table entry still
asks claimed users for a name. [S] wiring item filed; VISION status
corrected from "backend only" to shipped-with-gap.

**3. The taste-only export rewrite (decision 5) was drifting.** Settled
2026-07-26; `tasteExport.ts` still builds the persona-voiced doc, so the
live product contradicts a settled decision. Marked NEXT in the dishi.name
stream, ahead of any new surface. Chain recorded: taste-only export →
`dishi.me/[username]` public page → messenger share → 食記 feed.

**4. The engine stream's binding constraint is now DATA, not modelling.**
Decomposition Section A "unanswerable at this corpus size", MIN_SCORED_DIMS
provisional, method dims starved by construction — three independent R&D
efforts hit the same wall. Owner-side data item filed (same dish at 3–4
shops; Phase 2 menu photos; an operational plan for the dense-neighborhood
push).

**5. Small guards:** protein/base affinity parked pending data with
persist-`ingredients` split out as [S]; persona voices flagged as CONTENT
so the 書面化 pass doesn't flatten them; review's claim of a leftover
`devtest-duel/` route was WRONG (it never existed — the real leftover,
`devtest-username/`, was already deleted pre-commit).

## Moved verbatim from BACKLOG.md (the resolved finding + R&D narrative)

## Needs an owner decision before any code — FOUND 2026-07-27

- [ ] **[F] The execution slider cannot do the thing it was built for: dish
  identity is SCOPED TO ONE RESTAURANT.** Found while checking why zero
  execution comparisons exist. This is an architectural contradiction between
  two shipped features, not a bug in either.

  **The facts, verified in code and live schema:**
  - `dish_identities.restaurant_id` — an identity is per-venue by schema, set
    on mint from the dish's own `restaurant_id`.
  - `/api/dishes/identity` GET pools candidates with
    `.eq('restaurant_id', dish.restaurant_id)` — same restaurant only.
  - Its POST **explicitly rejects** a cross-restaurant link with a 400:
    "an identity is only ever meaningful within one restaurant's menu".
  - `isExecutionConfounded` (taste.ts:166) compares a rating against "the
    user's OTHER ratings of the same dish identity".

  **Consequence:** the slider's own worked example — 火腿通粉 scores 2 at A,
  8 at B, therefore A is the problem — is unreachable. A and B can never share
  a dish identity. The detector only ever compares repeat visits to the SAME
  venue, which is a real but much narrower signal (an off day vs a bad dish).

  **This blocks the recorded product aim directly.** "Why you like 乾炒牛河 at
  restaurant A and not at restaurant B" (DECISIONS.md, "Direction: what the
  taste engine is FOR") has no data structure that can express it. Dishi has a
  per-venue menu-item concept and no cross-venue DISH concept.

  **Not a data-volume problem, and not a distribution problem.** 46 of 50
  rated dishes carry no identity, which is the pipeline working as designed:
  identities form only when two dishes at ONE restaurant look alike and a
  human confirms, and the corpus averages ~2.5 dishes per restaurant. More
  users, more logging, or a bookmark mechanic would not produce a single
  cross-restaurant comparison.

  **R&D Phase 0 done 2026-07-27 — feasibility ANSWERED, see
  `docs/rnd/cross-venue-dish-phase0.md`.** On 30 held-out hard pairs both
  prompts score ~95-100% with **zero false merges** (the apparent gap between
  them did NOT replicate — see the correction below). Adjudication is not the
  problem. Two things moved:

  - **The predicted failure did not happen.** The expectation was that the
    shipped prompt's menu-item semantics ("items a restaurant prices
    separately") would make it answer "different" to every cross-venue pair.
    It scored 93.3%, and both misses fell below `CONFIDENCE_FLOOR`, i.e. failed
    safe. The prompt is less load-bearing than assumed.
  - **The real risk moved to CANDIDATE GENERATION (gate 1, not gate 2).** The
    eval handed the model the right pairs; production must find them among all
    dishes at all venues, and N² adjudication is unaffordable. The hardest true
    pair (`絲襪奶茶`/`港式奶茶`) shares ZERO characters, so the existing
    string-overlap prefilter would never surface it.

  **Proposed (not built, needs sign-off):** a canonical dish catalog — resolve
  each dish ONCE to a canonical entry, turning O(N²) pairwise matching into
  O(N) classification. Hang `canonical_dish_id` off `dishes` directly, NOT off
  `dish_identities`, which is starved (3 rows total; identities need two
  lookalikes at ONE restaurant and the corpus averages ~2.5 dishes per venue).

  **Product question raised here — now SETTLED 2026-07-27, see below.** The
  proposal was a `comparable` flag, on the argument that `壽司拼盤` at two shops
  shares a name but not a thing. The owner rejected the distinction.

  **R&D Phase 1 DONE 2026-07-27 — the candidate-generation risk is RETIRED.**
  A canonical dish catalog replaces retrieval entirely: each dish resolves ONCE
  to a catalog entry, and two dishes are the same iff they land on the same id.
  Measured (`scripts/eval-catalog-resolution.ts`, 141-entry catalog):
  **84.9% coverage** of the live corpus, **100% correct (29/29)** on the
  held-out pairs it could decide, **0 false merges, 0 hallucinated ids**.
  `絲襪奶茶` and `港式奶茶` both land on `milk-tea` — the exact pair no string
  prefilter could ever surface. O(N²) matching becomes O(N) classification.

  Uncovered dishes returned an honest "none" rather than a stretched match,
  which is the safety property the design rests on. Uncovered is not a failure:
  a dish with no entry gets no cross-venue identity and does not need one.

  **Also corrected:** the Phase 0 claim that the purpose-written prompt beat the
  shipped one is WITHDRAWN — a second run reversed the ranking. At n=30 the
  prompts are indistinguishable. Only the zero-false-merge result replicates.

  **`comparable` is SETTLED 2026-07-27 — everything is comparable, and the flag
  is NOT built.** Owner's rule: *if a dish is common enough that different
  restaurants offer it, then a "set" is itself a dish in the customer's mind.*
  A diner absolutely uses 壽司拼盤 or 車仔麵 to judge which shop is better, which
  is exactly what execution comparison measures. All 14 `false` entries were
  flipped; the column is now uniformly true, so **do not put it in the schema.**

  It did surface a SEPARATE still-open problem: two of the 14 were not assorted
  dishes but GENERIC CATEGORIES (`炒飯`, `燉湯`). A category entry is a
  false-merge magnet — 揚州炒飯 and 帶子炒飯 could both collapse onto 炒飯.
  Categories probably should not be catalog entries at all; decide during schema
  design.

  **Go/no-go now ~85-90%, GO on schema design.** Remaining, in order:
  (1) catalog growth policy — frequent "none" clusters surface for human review,
  never auto-mint, which would recreate the false-merge risk;
  (2) generic-category entries (above);
  (3) Phase 2 base rate — `scripts/eval-menu-corpus-coverage.ts` is ready and
  needs only menu PHOTOS in `scripts/menu-corpus/` (no eating, no app change;
  the menu-scan route persists nothing, so the app cannot build this corpus).
  This tunes expectations rather than gating the build.

  **Blocker R&D cannot remove:** 2 clear cross-venue true pairs exist in 73
  live dishes, so this cannot be validated on real data yet. Eating one common
  dish at 3-4 shops and logging each would create the first ground truth —
  and one person can do that alone.

---

# KEYSTONE build: canonical dish catalog — SHIPPED `80c0ff0` + `ea2d6be` + `493a314`, 2026-07-28

The BACKLOG entry as it stood at build time (the consolidated spec, verbatim):

> - [ ] **[F] KEYSTONE — canonical dish catalog (cross-venue dish identity) —
>   GO (owner sync 2026-07-28).** Full finding + R&D narrative in DECISIONS.md
>   ("Cross-venue dish identity: the catalog approach — GO"); evidence: 0 false
>   merges across every run, 84.9% corpus coverage, 100% on decided held-out
>   pairs (`docs/rnd/cross-venue-dish-phase0.md`). Schema design is the
>   remaining work, then the build. The consolidated spec:
>
>   - `canonical_dish_id` hangs off `dishes` directly, NOT off
>     `dish_identities` (starved by design: 3 rows total). Resolver runs once
>     per dish at enrichment — O(N) classification, no pairwise matching.
>   - An uncovered dish returns an honest "none" and simply has no cross-venue
>     identity. That is the safety property the design rests on, not a failure.
>   - Catalog growth policy: frequent "none" clusters surface for human review;
>     never auto-mint entries (auto-minting recreates the false-merge risk).
>   - Generic CATEGORY entries (炒飯, 燉湯) are false-merge magnets and must
>     not be merge targets; the structural empty-ingredient-slot signal
>     identifies them (veto component below) — no hand-maintained blocklist.
>   - **Structural veto component — only after the enum fix**
>     (`docs/rnd/dish-decomposition.md`). On the 30 held-out pairs the veto
>     blocked 4 wrong merges and 1 TRUE match. The false veto is precise:
>     `生滾魚片粥` vs `魚片粥` differ only because 生滾 names a standard method
>     the plain name omits. Root cause: the enum conflates "absent" with
>     "unspecified" — both become `none`, but base-`none` on 蝦仁炒蛋 is a real
>     property (no carb) while method-`none` on 魚片粥 just means the name is
>     silent. The naive fix ("`none` never conflicts") was checked and is
>     WRONG — it kills two of the four correct vetoes. Split into `absent` vs
>     `unspecified`; veto only when both sides are SPECIFIED and differ.
>     Structure stays a veto, never the sole rule: 36% of pairs (10/28) had an
>     unparseable side (絲襪奶茶, 西多士, 菠蘿油, 楊枝甘露) — shape is *catalog
>     proposes, structure vetoes*, silent when either side does not parse.
>   - **Repoint the execution slider — added 2026-07-28 review; do NOT ship
>     the catalog without this.** `isExecutionConfounded` (taste.ts) and the
>     execution-comparison path compare same-`dish_identity_id` siblings. Once
>     `canonical_dish_id` exists they must key off it (dish-identity remains
>     the same-venue fallback), or the flagship mechanic stays starved after
>     its blocker is gone. Part of the same build: where a cross-venue
>     comparison SURFACES (the 對決 chassis is the chassis; the entry point is
>     design work inside this item, not a separate feature).
>   - **Re-resolve on name-authority upgrades — added 2026-07-28 review.**
>     Resolution reads the dish's name, and the authority ladder can change
>     that name later (VISION → MENU/HUMAN/OWNER). A name edit or upgrade must
>     re-run resolution, or an early misread sticks forever even after the
>     owner corrects the name. Resolution writes its own column and must NOT
>     touch `name_edited_at` — that field is name authority, not resolution
>     state.
>   - Phase 2 base-rate eval remains open and does NOT gate the build:
>     `scripts/eval-menu-corpus-coverage.ts` is ready and needs only owner
>     menu PHOTOS in `scripts/menu-corpus/` (the menu-scan route persists
>     nothing, so the app cannot build this corpus itself).
>   - Real-data validation blocker stands: only 2 clear cross-venue true pairs
>     exist in 73 live dishes. The owner eating one common dish at 3–4 shops
>     creates the first ground truth (see the data-acquisition item under
>     "Later / standing").

## What shipped

**Schema.** `dishes.canonical_dish_id text` (nullable, no FK — the catalog
lives in code), applied live, recorded in
`supabase/applied/dishes_canonical_dish_id.sql`. The catalog itself moved
from scripts into `src/lib/hkDishCatalog.ts` (144 entries; the dead
`comparable` column dropped per the 2026-07-27 settlement).

**Resolution pipeline** (`src/lib/dishCanonical.ts`): the Phase 1 prompt
VERBATIM (0 false merges measured; no confidence floor, because the measured
result was floorless and an unvalidated floor could only kill true merges) →
category exclusion → structural veto with the absent/unspecified enum split.
Every failure degrades to null: an honest "no cross-venue identity" can never
fuse two histories.

**Lifecycle wiring.** Enrich resolves every creation path — photo and
menu-pick dishes on its early-return branch (their only enrich pass; the
client fires it in the background on every rating pipeline, so resolver
latency is free), typed dishes on the full branch. Renames re-resolve in
`/api/my/dishes` PATCH and enrich force; authority-ladder propagation
re-resolves inside `propagateIdentityNameToDishes` (one funnel covers the
identity link, owner reconcile, and owner menu publish). Resolution writes
only its own column — never `name_edited_at` (test-pinned).

**Execution siblings repointed.** ONE shared rule, `isExecutionSibling`
(canonical cross-venue primary, dish-identity same-venue fallback), consumed
by `replay.ts` and the `/api/ratings` offer path via `executionOffer.ts`.
Sibling-ness is a GRAPH, not a partition — a dish can join one neighbour by
canonical id and another by venue identity while those two share nothing —
and the mixed-pair replay test fails any grouped-by-one-key lookalike.

**The surfacing answer (v1).** No new UI. Enrich lands AFTER the rating in
the client pipeline, so the first-session cross-venue offer rides the enrich
response and RatingStack queues it into the SAME executionQueue the rating
response feeds — the shipped slider card on the 對決 chassis, unchanged,
just no longer starved. Richer surfacing (browsing past comparisons) stays
future design.

## Two build-time corrections to the spec, both measured

**1. Category rule: empty-protein-slot signal REJECTED, residue rule
shipped.** The generation run over all 144 entries was the review gate the
design asked for, and it fired: the empty-slot signal flagged 19 entries of
which 17 were specific dishes — it would have excluded 雲吞麵, 星洲炒米 and
揚州炒飯 from cross-venue comparison entirely, and it MISSED 燉湯 (LLM parse
failure). Root finding: 揚州炒飯 and 炒飯 decompose to the IDENTICAL
structure ([unspecified/stir_fried/rice]); slot decomposition is structurally
incapable of telling a named style from a bare category. What separates them
is RESIDUE: strip the generic cooking/base vocabulary from the zh name — a
true category has nothing left (炒飯 → 炒+飯 → ∅), a named dish keeps its
proper token (揚州炒飯 → 揚州). Deterministic, LLM-independent, still
structural (a generic-vocabulary lexicon, not a dish blocklist). Derived set
over the live catalog: exactly {炒飯, 燉湯, 烤串, 烏冬}, pinned verbatim in
tests so drift is a conscious edit. The generated structures serve the VETO
only, where the enum split was actually validated.

**2. Veto exemption for string-anchored landings.** First live backfill: two
wrong "none"s — 烤豬肉串 missed its own EXACT catalog entry; 日式舒芙蕾鬆餅
(a held-out TRUE pair the eval had passed) missed 舒芙蕾鬆餅. Near-identical
names give decomposition noise room to manufacture conflicts ("grilled pork
skewers" parses `grilled` off the English half against the entry's `roasted`
— 烤 maps to roasted; same plate, synonym values). A landing where the
entry's full zh string appears verbatim in the dish label is the resolver's
qualifier-stripping case (招牌/日式/生滾…), not a semantic leap — the R&D's
own wrong-veto shape (生滾魚片粥 ⊃ 魚片粥) generalised — so the veto now
skips it. Category exclusion runs BEFORE the veto, so 揚州炒飯 → 炒飯 stays
closed; fuzzy landings (絲襪奶茶 → 港式奶茶) keep the veto armed.

## Backfill (live, 2026-07-28)

61/70 unresolved dishes mapped (87%), 9 honest nones — each audited:
genuinely uncovered dishes (茶粒螺, 魔鬼魚, 冬菇棉花雞, 芝士蝦意粉,
酸甜醬烤魚), a set meal (蛇羹潤腸飯餐), a real composition change
(鵝腸豬潤撈麵 adds 豬潤 to 鵝腸撈麵), the category exclusion working (烤串),
and one borderline (通心粉配火腿煎蛋 vs 火腿通粉 — the 煎蛋 read as a plate
change; a missed merge, the harmless class). Zero false merges on eyeball.

The groups that now exist — the first cross-venue joins in the product's
history: **sushi-platter ×5 across 3 venues (all rated)**, souffle-pancake
×2 across 2 venues, egg-tart ×3, soy-chicken-rice ×2, unadon ×2. Includes a
merge no string rule could make: 油雞髀腩仔飯 under two different vision
English names ("Fried Chicken Thigh…" / "Soy-Poached Chicken Thigh…"). No
grouped row carries an execution score yet, so the backfill changed no
existing taste profile — the joins arm future comparisons without rewriting
any learning.

## Open remainders

- Phase 2 menu-corpus eval + the eat-one-dish-at-3-4-shops ground truth:
  owner-side, both live in the data-acquisition item.
- 14/144 catalog entries have no generated structure (reasoning-model batch
  flakes; fails safe — no veto for them). Re-run
  `scripts/generate-catalog-structures.ts` opportunistically.
- Dishes rated BEFORE this build surface their first cross-venue comparison
  on the next rating of any sibling (the offer is a rating-moment mechanic
  by design; nothing retro-fires).
- Verification note: no pixels changed — the offer mounts the SHIPPED slider
  card (對決 chassis) with cross-venue rows; visual verification of that card
  was done when it shipped (`15a9399`). The data layer was verified live
  instead: backfill audit above + the group query in the session log.


---

# Batch: export positioning (2026-07-26) — Taste-only export ✅ SHIPPED 2026-07-28

Decision 5 built: the export ships taste learning only, and the persona
apparatus leaves the export path. What shipped, and the judgment calls made
in the build:

- **The doc is one voice — the user's own.** Header is the claimed identity
  (`# dishi.{username} — my AI palate`); provenance still leads; the trust
  contract (epistemic line, hard limits) and the Phase 0.5 survivors
  (consent-framed VERSION_AWARENESS, request-framed VENUE_GROUNDING) ride
  verbatim. Everything character — Meeting me, Arrival, chime, language
  mirroring, scout missions, 收聲, location-conflict — is deleted from
  tasteExport.ts, and the taste-only contract test pins each absence.
- **The summon path is the container name.** `exportContainerName()` derives
  `dishi.{username}` (claimed) or plain `dishi`, and ONE derivation feeds
  both the doc's "Using this" line and the install steps — the name the
  person types into their host and the name the doc answers to cannot drift.
  The doc teaches bringing the palate on purpose and promises no ambient
  surfacing (pinned by test).
- **The name is the CLAIMED username only, never the handle.** The old
  builder took `name={handle}` — for unclaimed users that was the
  email-derived local part leaking into the doc header. Callers now pass the
  claimed username or null; unclaimed exports are anonymous. installFlow
  test pins that the legacy handle never reaches doc or container.
- **State B is the install surface, not a carousel.** The Spoon→CK→Kiki
  swipe died with the voice choice (kill-legacy: carousel JSX, drag state,
  dots CSS, `persona.next` key all removed). The slot now shows the identity
  being installed — dishi.{username} in the same display type — so naming
  your taste AI and installing it read as one chain. persona.ts itself is
  UNTOUCHED: the voices' in-app home is separate work (decision 5's second
  half), and `taste_profiles.persona` keeps the stored choice, dormant.
- **/api/taste/export POST no longer accepts or writes a persona.** GET/POST
  semantics unchanged otherwise (GET read-only preview, POST the real export
  event advancing the delta baseline).
- **Install steps de-charactered.** The Sonnet-class model note is gone —
  the measured Haiku failure was CHARACTER adoption, and this doc has no
  character to adopt; re-add per-host notes only on fresh taste-only
  evidence. Knowledge-slot and paste-as-TEXT warnings stay (those were
  measured against the doc channel, not the character). A test pins that no
  character language survives in any host's steps.
- **LINK_RITUAL is deleted, not just struck.** It was persona house-rule
  machinery; the `/i` route item in BACKLOG now requires re-justification
  from the surfaces that remain (share/public page/QR) before any build.

Verified: 693 tests passing (installFlow.test.tsx supersedes
personaInstallFlow.test.tsx; taste-only contract pins in
tasteExport.test.ts), tsc clean, and screenshots of State A (claimed
identity + delta line), State B claimed (dishi.jerry_c), State B unclaimed
(plain dishi — no handle leak), and the Claude install layer (container-named
steps), rendered from the real component via a temporary dev route (deleted).

## The item as it stood in BACKLOG at ship time (moved verbatim):

## 1. Rewrite the export as TASTE-ONLY — *(Fable — the doc IS the surface)*

**NEXT in the dishi.name stream (sync 2026-07-28).** Decided 2026-07-26 and
still unbuilt — `tasteExport.ts` still builds the full persona-voiced doc
(`VOICES[persona]`), so the live product contradicts decision 5 today. This
builds BEFORE any new stream-2 surface; the chain is: taste-only export →
`dishi.me/[username]` public page → messenger share → 食記 feed.

Owner decision 5, 2026-07-26 (full rationale in DECISIONS.md, "Identity,
connection, and export positioning"). The export stops shipping a character
and ships taste learning only.

**What the rewritten export must do:** import the taste model into the user's
own AI, summonable by name, with the understanding that this taste should
influence food-related answers, and installed into a specific Project/Gem/GPT
rather than global memory. That is the exact shape Phase 0.5 measured as
working (`docs/rnd/persona-phase0-results.md` §1, §5).

**Affected, as a deliberate partial retirement — not drift:** the three
persona briefs, the persona install flow, `taste_profiles.persona`, and the
voice/chime/house-rule apparatus in `tasteExport.ts`.

**Do NOT delete the personas.** They move in-app, where a host cannot refuse
them — that is the whole point of the payload/costume split (Phase 0.5 §5).
Retire them from the EXPORT path only; the in-app home is separate work.

**Hard copy constraint:** the install card must NOT promise ambient
self-surfacing. Proactive surfacing is a standing behavioural instruction,
which is precisely the category hosts decline. Teach ONE summon path as
reliable; describe ambient surfacing as *may happen on some hosts*, or omit
it entirely.

Related and still open: item 4 of the Phase 0.5 batch (owner manual re-test)
now narrows to the ChatGPT custom GPT with the post-fix doc — the one surface
never retested. Claude Project and Gemini Gem both passed.


---

# dishi.me/[username] — the public taste dossier ✅ SHIPPED 2026-07-28

Decision 3 built ("the dossier IS the public taste page — there is no third
artifact"). What shipped and the calls made:

- **The privacy contract is a pure module** (`src/lib/dossier.ts`), and the
  page can only render what passes through it. The projection's OUTPUT TYPE
  carries no field for eaten dates or companions — decision 3's exclusions
  are structural, not remembered. Tests pin: dates die at the projection,
  restaurants strip under the toggle, thresholds match the export doc's.
- **Negative anchors are excluded by construction** — a judgment call beyond
  the letter of decision 3 (its contents list only names positive anchors): a
  public per-user "this dish was bad HERE" is a statement about the
  restaurant, and publishing it collides with the restaurant-side trust
  posture in a way abstract avoid-dimensions don't. Avoid-DIMENSIONS render;
  disliked DISHES never do. Revisit deliberately if ever wanted.
- **Resolution: claimed usernames only** (`username_set_at` non-null; exact
  match on the stored lowercase handle). Legacy email-derived handles must
  never mint public URLs — verified live: /wool.hk and /mosuko-i47v 404,
  /jerry and /Jerry resolve.
- **Re-rated dishes dedupe** by (name, restaurant), strongest kept — found on
  the live page, not in review: 壽司拼盤 @ Tsumura rendered twice because
  re-ratings append rating rows (the engine's replay design). Test added.
- **Copy-for-AI is third person** (`buildDossierText`) — "one artifact, two
  readers." Hard rule 1 (a dossier never enters the recipient's engine) is
  stated IN the emitted text, because the recipient's AI is the one place it
  can't be enforced structurally. No POST fires: a visitor copying a dossier
  moves nothing about the owner (not an export event).
- **The hide-restaurants toggle** is the page's one owner control:
  `profiles.public_hide_restaurants` (migration applied live + recorded),
  PATCH `/api/dossier` via the user-scoped client (profiles is
  own-row-writable under RLS — verified against live policies). Verified
  end-to-end live: on → DB true → server render hides; off → restored.
- **Next 14 Data Cache gotcha, found live:** the supabase REST GETs inside
  the RSC render were cached EVEN on a force-dynamic page — the PATCH landed
  in the DB while reloads kept serving the stale read. `unstable_noStore()`
  at the top of the resolver is the fix. Any future public server-rendered
  page reading supabase must do the same or it will serve stale data.
- **The page renders inside the normal Shell** (topbar + tab bar) rather than
  a bare layout: the tabs ARE the acquisition path for a visitor, and
  restructuring the root layout into route groups wasn't worth it for one
  page. A quiet 建立你自己的味覺 AI CTA shows to non-owners. Revisit if the
  owner wants a chromeless share page.
- Reuse, not imitation: TasteFormReveal (the real blob), .persona-name
  identity type, .version-line, .chip, .ok-circle — no new CSS.

Verified: 705 tests passing (tests/dossier.test.ts pins the privacy
contract), tsc clean, live page screenshotted on REAL data (dishi.jerry, 50
ratings) in both toggle states, guards curled, zero console errors.


---

# Amendment to decision 3 — the public page is a PUBLISHING surface, not a rating dump (owner, 2026-07-28)

Raised by the owner the day the dossier shipped, on seeing it: "If user's
ratings are private, and only those opt-in to post are sharable, this page
supposedly be just that? And also, why have a copy to AI button here. If a
friend import this into his AI, would that confuse his own taste profile? If a
friend trust user's taste, i rather have him able to find what he shares as
posts."

Both halves land. Decision 3 authorized what was built; seeing it is what
produced the objection. Recorded as an amendment, not drift.

## 1. The copy-for-AI affordance is REMOVED — the guardrail was unenforceable

The dossier emitted third-person text for a friend's own AI, carrying one line
asking that AI not to fold it into what it knows about its reader. That line
is a **standing behavioural instruction** — precisely the category Phase 0.5
measured hosts REFUSING while accepting the data. So the payload lands and the
protection is the part that doesn't. This contradicts the app's own evidence,
the same evidence the taste-only export rewrite rests on.

Hard rule 1 ("a dossier NEVER enters the recipient's taste engine") is
enforceable inside Dishi — no import path exists — and unenforceable inside
someone else's host. Shipping a nominal guard there was worse than shipping
nothing, because it reads as a protection.

The owner's alternative is also simply better: a friend who trusts this palate
should reach its POSTS. A post is a dish someone chose to publish, with a
reason attached — more useful than a taste-vector dump, and it carries no
contamination risk. `buildDossierText` is DELETED (not left importable), its
i18n keys removed, and `tests/dossier.test.ts` pins the absence broadly —
any `text`/`prompt`/`export` surface added to `lib/dossier.ts` fails, because
re-adding the affordance under a new name is the regression worth catching.

## 2. The anchors section is a PLACEHOLDER — its source changes to posts

Decision 3's "anchors and restaurant names yes" published six rated dishes on
the strength of ONE blanket event: claiming a username. Everywhere else in the
product the consent unit is the DISH ("posts are per-dish opt-in", CLAUDE.md).
The page is therefore a coarser consent grain than the rest of the app.

The section is not deleted — its SOURCE changes, when posts exist, from
"top-rated private ratings" to "dishes you posted." Same section, same
decision-3 rationale (the restaurants are the credibility; dimensions alone
read as a horoscope), consent-gated per dish. The blob + version + dimension
chips stay public: they are aggregate, and reveal no specific meal or place.
On their own they ARE the horoscope decision 3 warned about — posts underneath
them are what stops that.

Left in place meanwhile because nothing links to the page (verified: only doc
comments reference the route), so it leaks nothing today. Marked PLACEHOLDER
in `lib/dossier.ts` and at the render site so the next session doesn't read it
as settled.

## 3. Consequence: the stream-2 chain REORDERS

The page's real form depends on posts existing. The recorded chain was
export → public page → messenger share → 食記 feed. Building the share
(S2-3/S2-4) next would mean building distribution for an artifact whose
contents are still in question. Corrected order:

**taste-only export ✅ → public page (placeholder ✅) → posts / 食記 feed →
page's real form → messenger share.**

This is the substantive cost of the amendment: share moves BEHIND posts.

---

# 貼文 + 食記 feed + dishi.persona daily picks — ✅ SHIPPED `82fc26f`, `8299392`, `cd1aca2` (2026-07-28)

Stream 2's next link after the public page, built as one item at the owner's
call (scope: the full thing — posts, the feed tab, AND the persona pipeline;
negative posts allowed). Closes the placeholder amendment above.

## The architecture review that preceded it (Fable-tier, required by the VISION entry)

Two findings decided the shape:

1. **The feed's READ path could not be validated.** Live DB at review time: 3
   profiles, **1 claimed username, 1 rater, 50 ratings**, 70 dishes (all with
   attributes, 61 canonical). Taste-rank distribution with an audience of one
   is untestable, and "no rec is better than an irrelevant one" makes a feed
   that ranks nothing unshippable.
2. **The chain's blocking need was the post WRITE path, not the feed.** The
   page's placeholder is fixed by per-dish opt-in alone — one table, one
   affordance, one swap of the anchor query.

Recommendation was therefore posts-first with the feed gated on a second
rater. **The owner overrode it and took the full item**, so 3a/3b/3c all
shipped in sequence, each verified before the next.

## 1. 貼文 — per-dish opt-in publishing (`82fc26f`)

`dish_posts` (unique per user+dish, RLS = own rows, insert fenced on owning the
dish, unpublish = real DELETE). `/api/posts`. 公開 in the 食記 kebab, PostSheet
on the shared ExplainModal chassis, 已公開 legible on the row itself.

**The public page's anchors are now posts.** `lib/dossier.ts` keeps its role as
the privacy contract; what changed is the source and one rule:

- **NEGATIVE POSTS ARE ALLOWED (owner, 2026-07-28)** — reversing "a public
  'this dish here is bad' is a statement about the restaurant." The old rule
  rested on the person never having chosen that dish specifically; per-dish
  opt-in IS that choice. The cost is paid by carrying the VERDICT WORD on
  every anchor and in the publish sheet: a published dislike that rendered
  like the loves beside it would be worse than not publishing at all.
- No score filter (filtering would swallow a post someone deliberately made),
  newest-first (a publishing surface, not a leaderboard), cap 12, verdict as a
  flick word key — never the number, which still dies at the projection.
- The verdict is read LIVE from ratings, never snapshotted: re-rating replays
  history, and a page quoting an abandoned verdict is worse than one that lags.
- Label copy moved 實際食過並喜愛的菜 → 公開的菜式 for the same reason.

Verified end to end on the owner's real session: published a dish through the
real sheet → `dishi.me/jerry` renders it with @ 元氣壽司 and 超好味, and the six
blanket-consent anchors are gone.

## 2. 大家 — the feed tab (`8299392`)

Second tab in 食記 (the two tabs ARE the heading; no new tab chrome). One card
type, author always `dishi.X`, author union in `lib/feed.ts` so a new author
type needs no new screen.

Ranking rules, deliberately conservative because **taste-rank IS the
distribution** (no graph — nothing here reads a relationship):

- below 5 ratings (`/api/recommendations`' long-standing bar) the feed does not
  claim a match at all; it says how far off it is.
- items the engine doesn't like FOR YOU are dropped, not ranked last.
- **a negative VERDICT never disqualifies a post**: relevance is the dish, the
  verdict is the content.
- three states said out loud: training / empty / failed.

Bookmark on every card queues into 待評 as a normal `dishes` row — `eaten_at`
NULL (a bookmark is not a meal that happened, unlike a menu pick, whose
buildPickRows stamps pick-time as eaten-time) and no photo (it belongs to
whoever ate it). `dishes.from_dish_id` + its unique index make "already
bookmarked" exact and a second tap a no-op.

## 3. dishi.persona daily picks (`cd1aca2`)

`persona_items` + `persona_runs`, `/api/cron/persona-daily` (03:30 daily,
CRON_SECRET, same shape as `/api/mf/train`). Every binding amendment encoded:
shared pool ranked per user at read time; **no LLM in the read path — and none
in the write path either** (the line is composed from rows that already exist,
so it has no slot a fact could be invented into; a test asserts it cannot
contain a digit); Places-verified sourcing via a `restaurants!inner` join on
`place_id`; a visible failure path (both the quiet day and the broken job were
rendered and screenshotted).

**CONSENT CORRECTION made during the build.** Candidates come only from POSTED
dishes, never the rated-dish table at large. `dishes` is publicly readable and
the old 為你推介 browsed it freely — but those are private logs, and sourcing
them through a persona would quietly reinstate the blanket publishing that
per-dish posts had replaced that morning. The consent unit is the dish,
whoever is doing the surfacing.

## Open remainders

- **The cold-start argument for personas does not pay off yet.** Personas were
  justified as what makes the feed non-empty before enough people post; with a
  consent-clean pool that is only true once there is published material. The
  first live run is honestly `empty` (the single post's restaurant carries no
  `place_id`). **Owner-published menus (`restaurant_menu_items` — public by
  publication, Places-verified by the same join) are the next source**; the
  seam is marked in the route. That table has 0 rows today.
- **A POPULATED feed has no pixel proof.** It needs a second claimed user with
  a post, which the database does not have; the card's anatomy is pinned by
  `tests/feedCard.test.tsx` instead (author line, negative verdict rendered,
  no verdict invented for personas, bookmark on every card).
- Stream 2's chain now reads: taste-only export ✅ → public page ✅ (real form,
  post-sourced) → posts / 食記 feed ✅ → **messenger share (next)**.

## Amendment same day — the pool is CHRONOLOGICAL, and own posts are in it (owner, 2026-07-28) — ✅ `887b9c5`

Raised by the owner within hours of the ship, on finding 大家 empty after
publishing a dish. Two separate things came out of it.

### 1. A bug that made the tab impossible, not just empty

`dish_posts.user_id` references `auth.users`, not `public.profiles`, so the
feed's `profiles!inner(handle, username_set_at)` embed had no foreign key to
resolve. PostgREST errored, the route ignored the returned `error`, and the
empty list rendered as "nobody has posted". **The tab could never have shown a
user post at all** — the owner's own or anyone else's.

It shipped "verified" because the own-posts exclusion meant there was never a
row to return: empty was indistinguishable from broken. That is the lesson
worth keeping — a filter that guarantees an empty result also guarantees the
verification proves nothing. The public page was fine throughout (it joins
`dishes`, whose FK does exist), which is why publishing looked half-working.

Fixed with a second query keyed on `user_id`, and the posts query's error is
now surfaced instead of swallowed.

### 2. Ranking is parked until the pool can support it

The tab shipped ranking every card by `contentScore` and dropping weak matches.
The owner's call: right at scale, wrong now. "There just won't be too many
people rate dishes AND turn them into posts during trial and initial launch.
Out of those that matches your taste only would work when the pool gets much
larger." **A filter over a near-empty pool doesn't select — it hides.**

Decision 2 (no social graph; distribution is taste-rank) is NOT reversed —
this is an interim ordering, and taste-rank is still what the edge rests on.
`rankFeed` was deleted rather than left unwired, with the five-line re-entry
point named in `lib/feed.ts`; `contentScore` is untouched and still ranks
menus, duels and seals.

Consequences, all deliberate:
- **Own posts are in the pool.** Excluding them was defensible under ranking
  (your own dishes would rank top and mirror your journal back at you); with
  one claimed user it made the tab permanently empty for the only person who
  could see it. Their card carries NO bookmark — `/api/bookmarks` refuses a
  dish you own, so the button's only outcome would be an error.
- **The training stage is gone.** It existed because claiming a match under 5
  ratings is dishonest; nothing claims a match now, so a new account sees the
  pool on its first visit. `FEED_TRAINING_THRESHOLD` deleted with it.
- `feed.empty` copy no longer says "nothing matching your taste" — copy
  claiming a filter the code isn't running is the worst kind of stale.
- A persona repeating your own dish stays excluded: that reads as the app
  quoting you back to yourself, which publishing your own post does not.

Tests pin the ABSENCES (no `rankFeed`, no `contentScore` call, no
`taste_profiles` read, no `user_id` neq), because the tempting fix for a thin
feed is to quietly reintroduce scoring in the route.

**One open remainder is now closed:** the populated feed has pixel proof — the
owner's post renders as a card with author, restaurant, verdict and reason. A
SECOND author still doesn't exist, so cross-user ordering remains unproven.

## Photo-forward post cards, both surfaces — mounted DuelSide, not a new card (owner, 2026-07-28) — ✅ `7d8f994`

Owner reference: "the format of duel > pick 1 > reveal — large food shot with
dish name and info." That is `DuelSide.tsx`'s own anatomy (photo, name,
location), already extracted for reuse — `IdentityConfirmCard.tsx` mounts it
the same way (static, non-tappable side inside `.duel-pair.resolving`, which
collapses a single item to full width — literally the "one winner" reveal
layout). Both the 大家 feed card and the `dishi.me/[username]` public anchors
now mount it too, per "reuse, don't imitate": no new photo-card CSS, one line
(`.feed-side { cursor: default; }`) plus a `pair` prop added to `DuelSide` so
non-comparison callers can pass the viewer's own language pair instead of the
duel's forced zh-primary (default unchanged — existing callers unaffected).

**A real bug surfaced building this, one layer under the profiles-join bug
above:** `FeedItem.dish.photo_url` was being hardcoded to `null` in
`/api/feed/route.ts` with the comment "the author's photo stays theirs" — a
carried-over rationale from `buildBookmarkRow` (where it's correct: a
bookmarker's own copy of someone else's dish shouldn't inherit a photo they
didn't take) applied to the wrong place (displaying the ORIGINAL post, whose
photo is exactly as published as its name). The dish-photos storage bucket is
already public (`getPublicUrl`), so this was never a privacy gate — just a
stale comment nobody had reason to question until the format made it visible.
Fixed by selecting `photo_url` in both the posts and persona `dishes!inner`
joins and reading the real column.

**`lib/dossier.ts` contract extended**, deliberately: `DossierAnchor` and
`DossierRawAnchor` gained `photo_url`. Unlike `restaurant`, it does NOT strip
under `hideRestaurants` — a food photo names no place, so the toggle has
nothing to do with it. Test pins that specifically (`hideRestaurants: true`
strips the restaurant string, the photo survives).

Tests assert the REUSE, not just the pixels — `tests/feedCard.test.tsx` and
the new `tests/publicDossierPhoto.test.tsx` check for `<img>` tags (queried
by tag, not role — `DuelSide`'s photo is `alt=""`, decorative, so it carries
no accessible "img" role) with the `duel-photo` class, which only DuelSide's
populated-photo branch produces; a hand-built lookalike card would pass a
"does it look right" check but fail this one, per the repo's "sameness tests
assert identity" rule.

## Retire the ask-for-name card for claimed users — the username's table payoff, found unwired — ✅ `1edcd19`

Found unwired on the 2026-07-28 review, filed under "Ready to build — specs
are decided, no open questions": the username claim itself DOES mechanically
replace the leaking email-derived handle (it overwrites `profiles.handle`),
so chops show the chosen name once claimed. What was NOT wired: table entry
(`src/app/table/page.tsx`, the chop card) still asked a claimed user with no
`display_name` "what should we call you" as if they had never named
themselves. Suppressed the card when the member has a claimed username — key
off `hasClaimedUsername(username_set_at)` (the members payload now carries
the flag), NEVER "handle is non-empty" (every legacy profile has a handle;
that is the exact leak `hasClaimedUsername`'s own comment warns about).

`GET /api/table/[code]` now selects `username_set_at` alongside `handle` and
`display_name`, and threads `username_claimed` through to `members[]`. The
chop card's own-row lookup now requires both `!display_name` AND
`!username_claimed`.

Deliberately OUT of scope: inviting the UNCLAIMED to claim at the table — the
naming moment lives on the taste card, gated on v1, by decision; changing
that is an owner design question, not wiring.

Pinned at the source level (`tests/tableChopClaimedGate.test.ts`), the same
pattern `tests/tableComponentIdentity.test.tsx` already uses for this exact
file — the table page is auth-gated and polling, not a realistic render-test
target.

## Persist `ingredients` on dishes — one column, one write everywhere — ✅ `8d12c50`

Split out 2026-07-28 from the protein/base affinity item it was buried
inside. Enrichment already extracts up to 4 key ingredients — vision's photo
read and menuScan's text-only enrich, both through the existing
`sanitizeIngredients` — with the HK carb-shorthand expansion (米/河/意/通/丁),
uses them for diet-flag derivation, then discarded them: no `dishes` column,
zero downstream readers, so an ingredient chip shown once in an API response
vanished for any SECOND reader of the same dish (a page reload, a bookmark,
the feed).

`dishes.ingredients text[] not null default '{}'::text[]` — same shape as the
existing `diet` column (`supabase/applied/dishes_ingredients_persist.sql`).
Written at every existing site that already creates or updates a `dishes`
row, same pattern `cooking_method`/`heaviness`/`diet` already use at each:

- `POST /api/dishes` (photo path) — `vision.ingredients` on insert.
- `POST /api/dishes/enrich` — `enrichment.ingredients` on the update, under
  the same force-mode "don't wipe good data with empties" guard the sibling
  fields use. Also added to the initial `SELECT` — the already-enriched
  early-return branch (a second enrich call on a dish with `attributes`
  already populated) was returning that select verbatim and would otherwise
  have kept silently dropping the persisted value forever.
- `POST /api/dishes/pick` — `buildPickRows` now runs the client-echoed value
  through `sanitizeIngredients` (never trusted verbatim, same as its
  siblings). `scan/page.tsx`'s pick payload had the data on screen the whole
  time (`ScannedItem.ingredients`) and simply never sent it.
- `POST /api/bookmarks` — `buildBookmarkRow` carries the source dish's
  ingredients into the queued row, same as its three siblings.

Both response routes' explicit `ingredients: vision.ingredients` /
`ingredients: enrichment?.ingredients ?? []` overrides are now redundant —
the row returned from `.select()` already carries the real column — and were
removed rather than left as harmless-but-stale duplication.

Verified with a dry-run insert against the live table (`begin; insert ...
returning id, ingredients; rollback;`) confirming the write/read round trip
before relying on it — no live data touched. `tests/pickContext.test.ts` and
`tests/feed.test.ts` pin the two re-sanitize/pass-through sites; the rest is
mechanical write-site coverage tsc + the existing `sanitizeIngredients`
suite already prove.

---

# Batch: sharing — messenger share + per-dish links (owner design session, 2026-07-28) — SHIPPED

Shipped 2026-07-28 in seven commits: `d9f26b7` (share helper), `ee619ed`
(visibility tier), `810f776` (bookmarks published-check), `8a3ffbc`
(permalink + OG), `3515ba4` (bookmark-as-signup), `98492e9` (dish share from
食自己), `a5f8f09` (Taste AI share swipe + profile OG).

**Three build-time corrections to the spec below, all deliberate:**

1. **The permalink is keyed on the DISH id, not the post id.** The spec asked
   for the post id so unpublishing would break the link. It breaks either way
   — the lookup goes THROUGH `dish_posts`, so a revoked post resolves to
   nothing and 404s — and the dish id is what `DossierAnchor`, `/api/bookmarks`
   and `FeedCard` already speak, so keying on it means one id rather than three
   surfaces translating between two.
2. **`SignInSheet` must NOT resume off `onAuthStateChange`.** GoTrue emits
   `SIGNED_IN` for a session that ALREADY exists, so the sheet fired on mount,
   resumed the bookmark, took the same 401 and reopened itself — measured at 3
   POSTs per single tap. Filtering the event name cannot fix it; a global
   listener fundamentally cannot distinguish "just signed in" from "was signed
   in". `OtpForm` now reports its own successful verify. Reachable in
   production via a stale cookie that 401s while the client still holds a
   session object.
3. **The messenger row shipped WITHOUT the brand assets, rather than waiting
   on them.** Each mark hides itself on error, so the row is fully functional
   label-only today and gains the logos on a pure file drop. The assets remain
   owner-supplied (trademarks) — see the BACKLOG follow-up.

**Also corrected during the build:** `/api/bookmarks` had never checked that a
dish was published at all — safe only by accident, because every dish id a
client could obtain came from the feed. The permalink puts dish ids in URLs,
so the check is now explicit (existence, not tier: a link-only post must pass,
since bookmarking is what its link exists to invite).

The spec as designed with the owner follows, verbatim.

# Batch: sharing — messenger share + per-dish links (owner design session, 2026-07-28)

**STATUS 2026-07-28: items 1, 2, 3, 5, 6 and HALF of 4 SHIPPED** (`d9f26b7`,
`ee619ed`, `810f776`, `8a3ffbc`, `3515ba4`, `98492e9`). Full entries move to
DECISIONS.md when the batch closes. ONE thing remains open:

- [ ] **4b. The Taste AI second swipe — sharing the PROFILE.** *(Fable — new
  visible surface.)* Blocked on four brand assets in `public/msg-logos/`
  (WhatsApp, Telegram, WeChat, Line), which must come from each brand's own
  official resources — do NOT generate approximations of real trademarks.
  Everything else it needs exists: `lib/share.ts` (item 1) and the settled
  design below (one rounded-rect wrapper, four logos inside, any tap opens
  the OS share sheet). Gate on a claimed username; unclaimed sees the claim
  prompt, which already lives on that card.

Two build-time corrections worth carrying into DECISIONS.md, both recorded in
the commits: the permalink is keyed on the DISH id, not the post id (it still
404s on unpublish, since the lookup goes through dish_posts, and the dish id
is what the anchor, the bookmark API and FeedCard all already speak); and
SignInSheet must NOT resume off `onAuthStateChange` — GoTrue emits SIGNED_IN
for an already-existing session, which looped one tap into three POSTs until
OtpForm learned to report its own verify.


The last link in the stream-2 chain: taste-only export ✅ → public page ✅ →
posts / 食記 feed ✅ → **messenger share (this batch)**. Designed with the
owner 2026-07-28 against the live surfaces; the settled inputs below are
decisions, not suggestions.

## Settled inputs — do not re-litigate

- **TWO share surfaces, two different artifacts.** (1) The Taste AI card's
  State B gains a SECOND swipe that shares the person's profile
  (`dishi.me/[username]`). (2) MyDishes' existing 3-dot row menu gains a
  Share item that shares ONE dish. The owner's framing: sharing a whole
  profile page with every published dish is a different act from sending a
  friend one dish, and the product needs both.
- **Messenger row = four logos inside ONE rounded rectangle; any tap opens
  the OS share sheet.** Not four separately-tappable per-app buttons (that
  is the AI-host row's treatment, and it would claim per-app integrations
  that don't exist for WeChat/Line). The single wrapper makes the logos
  ILLUSTRATIVE of the destination category, which is why this is honest —
  owner's own solution, and it is better than the per-app deep-linking
  first proposed in review. Logos: WhatsApp, Telegram, WeChat, Line.
- **LINK-ONLY TIER (owner call, over review's recommendation).** A shared
  dish does NOT become a normal public post. See the tier item below, and
  the recorded risk that follows it.
- **`/i` intent-landing route: CLOSED.** BACKLOG's own condition ("if
  nothing claims it by the time the share chain ships, close it") is met —
  its original consumer (persona-issued links) died with the taste-only
  export rewrite, and nothing in this batch needs it: the intent is carried
  by the page URL plus one pending action, not a separate landing route.
  Its CONTRACT survives, honoured by item 5 below: unauth → login → return
  with intent preserved, nothing commits on tap.

## 1. [S] Extract the share helper — do this FIRST

`navigator.share` → `clipboard.writeText` → `alert` exists TWICE already,
near-identically and with divergent error handling:
`src/app/scan/page.tsx` (~160) and `src/app/table/page.tsx` (~418). Both
predate this batch. Extract one helper to `src/lib/share.ts` and mount it at
both existing sites plus the two new ones — a third and fourth copy is the
"reuse, don't imitate" violation this repo has already paid for once.
Must swallow a cancelled share (not an error) and fall back to copy-link
where `navigator.share` is absent (desktop).

## 2. [F] `dish_posts.visibility` — the link-only tier

`'public' | 'link'`, NOT NULL, check-constrained, **default `'public'`** so
every existing post keeps today's behaviour on migration.

- `'public'` — today's semantics: dossier anchor + 大家 feed + persona
  sourcing pool.
- `'link'` — reachable ONLY at its own permalink (item 3). Absent from the
  dossier, the feed, and persona sourcing.

**The failure mode, and it is the whole risk of this item:** THREE existing
read paths must gain `.eq('visibility','public')`, and missing any one
silently republishes every link-only post — the repo's known
silently-wrong-write-path class, in its read form:

| Path | Change |
|---|---|
| `src/app/api/feed/route.ts` (~54) | filter to `public` |
| `src/app/api/cron/persona-daily/route.ts` (~52) | filter to `public` |
| `src/app/[username]/page.tsx` (~87) | filter to `public` |
| `src/app/api/my/dishes/route.ts` (~151) | **NO filter** — the owner's own view of their own posts; must additionally RETURN the tier so the row can render the right glyph |

Tests must assert a link-only post is ABSENT from feed/dossier/persona
output — a test that only checks public posts appear would pass against a
missing filter.

`/api/posts` POST accepts `visibility`, defaulting to `'public'` for
back-compat. DELETE semantics unchanged (revoking consent deletes the row,
whatever its tier). Publishing a link-only dish via the globe UPGRADES
`link` → `public`.

**MyDishes row now has three states, and the glyphs must distinguish them:**
no badge (unposted) · a LINK glyph (link-only) · the existing GlobeIcon
(public). "The world can find this" and "only people with the link can" must
not render identically.

**First share of a dish still needs the consent moment.** Reuse `PostSheet`
in a share mode — same component, different framing — because the repo's
rule that a person publishing 唔啱我 must SEE that verdict word before
consenting applies just as much when the audience is one friend. Copy must
be honest about what link-only means (有連結嘅人就睇到), never implying
private. A repeat share of an already-`link` post skips the sheet and goes
straight to the OS share sheet.

### RECORDED RISK — pool starvation (review's objection, owner overruled)

Review recommended ONE tier (share = normal public post) and the owner chose
link-only after weighing both objections raised. The privacy objection
(a forwarded link is functionally public) the owner answered directly and
reasonably: a dish is not sensitive material and links do not spread in
practice. The objection that remains LIVE and is recorded here rather than
lost is strategic, not privacy:

> A link-only post feeds nothing — not the 大家 feed, not the dossier, not
> persona sourcing. Friend-sharing is the EASY path and publishing the
> deliberate one, so most content may land in the tier that reaches nobody.
> Distribution is taste-rank and nothing else (no social graph, decision 2),
> so a starved pool means posts reach no one — the exact cold-start hole
> personas were invented to paper over, and today's live persona run is
> already honestly empty for want of published material.

**If the 大家 feed stays empty in the field, look here first.** The escape
hatch is cheap and deliberate: flipping the default, or making the share
flow default to `public` with link-only as the opt-out, is a copy + default
change, not a migration.

## 3. [F] `dishi.me/[username]/d/[postId]` — the per-dish permalink

Nested under the username on purpose: the identity IS the context ("jerry's
take on this dish"), and stripping the last segment lands on the full
dossier — a free, discoverable affordance.

- **Keyed on the POST id, not the dish id**, so unpublishing breaks the
  link. The URL's lifetime must equal the consent's lifetime.
- Renders BOTH tiers (that is the point of the tier).
- **Reuses `projectDossier` — no second privacy gate.** The projection
  sanitizes WHAT is exposed; the page decides WHICH rows to fetch. So this
  page fetches one post row and passes a single-anchor dossier through the
  SAME function. Do not add a parallel projection; "every public byte passes
  projectDossier" is the contract.
- `DossierAnchor` ALREADY carries a stable `id` (plus `diet`, `heaviness`,
  `ingredients`) — an earlier draft of this spec asked for it to be added.
  Nothing to do; build the permalink on it.
- **Trap:** `projectDossier` DEDUPES same-dish-same-restaurant to the most
  recent post. A permalink to a deduped-away post must still resolve (it was
  explicitly shared) — verify the single-anchor path can't be swallowed by
  its own dedupe.
- **Mounts `FeedCard`.** `PublicDossier` already renders its anchors by
  mounting `FeedCard` directly (author, photo, verdict, reason, chips,
  bookmark), so the permalink mounts the SAME component with a single item —
  not `DuelSide` beneath it, and certainly not a third card. The dossier,
  the 大家 feed and this permalink are then literally one card.

**OG metadata** — the highest-leverage half of "messenger share", since
`generateMetadata` currently returns `{ title }` and a bare URL in WhatsApp
reads as spam. Dish permalink gets a real card for free: the dish photo is
already a public storage URL (`getPublicUrl`); title = dish name,
description = verdict + reason. Profile page gets title + description
(識 N 味 · N 道菜公開). **Everything in an OG card is visible to anyone the
link is forwarded to and is CACHED BY CRAWLERS, so every byte of it must
come through `projectDossier` — never assembled from raw rows at the
metadata layer, which is the easy mistake here because `generateMetadata`
runs separately from the page render and is tempting to feed directly.**
(An earlier draft of this spec also required the OG card to respect
`hideRestaurants`. That feature was KILLED — restaurant names on a public
page are unconditional now, by owner decision. Nothing to respect.)

**Share text must carry the VERDICT**, for exactly the reason the card must:
a dish shown alone reads as a recommendation, and a negative post shared as
a bare photo misrepresents the person who shared it.

## 4. [F] The messenger row — one component, two mount points

Per the settled input: four logos, one rounded-rect wrapper, any tap →
`lib/share.ts`. Mounted at (a) Taste AI State B's new second swipe, sharing
`dishi.me/[username]`; (b) the dish share flow, sharing the permalink.

- Chassis is `.persona-hosts` / `.persona-slide` — the second swipe must be
  visually parallel to the AI-host swipe (same divider, same slide anatomy).
  One surface, two audiences: your AI, or a person.
- **Gate on a CLAIMED username** — only claimed usernames resolve publicly
  (legacy handles 404 by design). Unclaimed sees the claim prompt instead,
  which is a natural motivator and already lives on this exact card.
- **Asset dependency:** `public/msg-logos/` does not exist. Needs four brand
  assets (WhatsApp, Telegram, WeChat, Line) from official brand resources —
  do NOT generate approximations of real trademarks.

## 5. [F] Receive: the bookmark IS the signup CTA

The strategic core of the batch. Today's public page ends in a passive
brochure line (建立你自己的味覺 AI → pointing at `/`). A recipient looking at
a dish, a verdict and a reason wants exactly one thing — to eat it — and
想食 is an affordance that already exists on every feed card, already writes
into 待評, and already needs an account.

**Sharpened by the live code (checked 2026-07-28): the button is ALREADY
THERE AND ALREADY BROKEN for exactly the people a share aims at.**
`PublicDossier` mounts `FeedCard` for visitors, bookmark included; a
signed-out tap POSTs `/api/bookmarks`, takes a 401, and lands in
`FeedCard`'s silent `failed` state. So this item is not "add a CTA" — it is
"make the affordance that already renders do the obvious thing instead of
dying quietly." Smaller than it looks, and worth more.

```
tap link → dish page (photo · verdict · reason · dishi.jerry)
         → tap 想食
         → not signed in? email + 6-digit OTP, inline, in place
         → bookmark lands in 待評 · account exists · first dish already queued
```

Nothing commits on tap; the intent survives the OTP round trip and completes
after (this is `/i`'s contract, honoured here — see settled inputs). A new
user's first state is not an empty app but a queue holding a dish a friend
vouched for. Costs no new concepts: OTP auth, `/api/bookmarks` and 待評 all
exist. Auth is email-OTP only (no OAuth), which is already low-friction.

## 6. [S] `/api/bookmarks` must verify the dish is posted

Today it checks only that the caller doesn't OWN the dish — there is no
`dish_posts` check. That is safe purely by accident: every dish id a client
can currently obtain comes from the feed, which serves published material
only. **Item 3 makes dish/post ids handleable by anyone**, so this must gain
an "a post exists for this dish" check. Note the check is post-EXISTS, not
post-is-public: a link-only dish is legitimately bookmarkable by its
intended recipient, who is the whole point.

## Sequencing

1 (helper) → 2 (tier + filters, with the absence tests) → 3 (permalink + OG)
→ 6 (bookmarks check, must land WITH or before 3) → 5 (receive loop) →
4 (messenger row + both mounts, needs the assets).

Items 3–5 are the acquisition loop and are worth more than items 1–2; but
2 must precede 3 or the permalink has no tier to render.


---

# dishi.persona editorial — columnists in 大家食, item 1 SHIPPED 2026-07-29

(Design batch recorded in BACKLOG the same day; items 2–3 — daily automation
and the disclosure-marker decision — remain open there.)

**Shipped** (`1827108` schema+validator, `6bc679c` feed+review+samples):

- `persona_posts` (pending|published, grounding pack jsonb, image
  attribution/license/source), RLS-locked with no policies — drafts are
  invisible to clients by construction; all access via admin client.
- `dishes.from_persona_post_id` + partial unique index: the binding
  every-card-bookmarks amendment holds on cards with NO dishes row — the
  bookmark builds the 待評 row from the post itself, with the same two honest
  NULLs (eaten_at, photo_url) and an empty attribute vector (absence is
  unknown, never neutral). ON DELETE SET NULL: retracting a post never claws
  back someone's queue entry.
- `personaEditorial.ts` — the grounding gate: a line may REPHRASE its pack,
  never extend it (currency banned outright, digits and Latin proper nouns
  must exist in the pack, venue-speak rejected) + register enforcement (CK
  zero emoji, Kiki 2–4 counted as GRAPHEMES, Spoon no exclamation clusters).
  Hand-authored samples pass the same gate a future LLM pass will.
- In-feed review: pending drafts render in the REAL FeedCard, editor-only
  (profiles.is_persona_editor — a DB flag, deliberately not a Vercel env
  var), with 待刊 bar → 刊出 (PATCH; bar drops, card stays) / 棄用 (DELETE;
  card leaves). Publication stamp = feed clock.
- 6 samples, 2 per persona on their beats, images license-re-verified via the
  Commons API at seed time and re-hosted with credit rendered on the card.

**Verified live 2026-07-29:** all 9 cards (6 drafts + 3 user posts) in one
chronological pool on the owner's session; tanghulu published through the
real in-feed bar — row stamped published, bar gone, card intact. Five drafts
left pending DELIBERATELY: the owner's first real use of the review flow is
their own editorial pass, and 棄用→reseed is one script run if any image or
line isn't right (the tanghulu shot is a street scene — a taste call the
review exists to make).

**One UX wart, accepted:** the editor's own bookmark tap on a still-pending
draft 404s server-side (only published posts are bookmarkable). Editor-only
surface, one-tap-from-published — not worth the complexity.

---

# Comparison frequency: starvation diagnosis + the interactions feed — SHIPPED `062aa16` (R&D) + `bf12477` (build), 2026-07-29

Owner complaint: duels and execution comparisons barely fire for the heaviest
user; the rating data is "wasted in the back". Full diagnosis + design space in
`docs/rnd/comparison-frequency.md` (measured, not asserted — scripts
`diagnose-comparison-starvation.ts` and `eval-duel-uncertainty.ts`).

**The headline finding.** The duel gate ("a contrasting dim with evidence <= 2")
was a one-way ratchet: evidence only grows, so at 49 ratings the gate killed
374/374 strongly-contrasting pairs and `selectDuelPair` returned null FOREVER —
the engine went quieter the more someone rated. Meanwhile the model's own
sealed bets were coin flips on 306/378 pairs: the counter was manufacturing
certainty the model did not have.

**Owner decisions (2026-07-29):** ~2/day duels (10h cooldown, was 20h); band
edge p < 0.65 (the no-filler rule applied to duels); build order gate-rebuild →
execution inbox; and the JOURNAL + BELL become the standing HOST surfaces for
taste-calibration interactions — up to two daily cards in 食記, everything in
the bell, future kinds join the same feed. Standing invitation: interactions
beyond ratings are welcome whenever they sharpen taste definition.

**What shipped:**
- Duel qualification is the engine's own UNRESOLVED BET: pairs qualify while
  the sealed confidence sits under 0.65 and the least-certain pair serves
  first (uncertainty sampling; selection returns the p the route seals, so the
  gate and the seal cannot disagree). Evidence survives only as tiebreak.
  Same-canonical pairs are excluded — two renderings of one dish are the
  execution slider's question (the simulation caught 壽司拼盤 vs 軍艦壽司 in
  its own top five). A duel predicted WRONG within 7 days redirects selection
  to re-probe its dims, and the card admits it (上次估錯了，這局再驗證一次) —
  visible recalibration IS the product claim.
- `/api/interactions/today` is THE host feed (supersedes /api/duels/next,
  killed). Serves the duel slot + the execution INBOX: stranded sibling pairs
  (rated before their sibling existed — 11 existed at ship time) re-offered one
  per day; scoring retires them, dismissal is session-local.
- One client hook (`useInteractions`) feeds both surfaces; answering anywhere
  re-syncs everywhere via one window event. Overlays are the existing chassis
  (DuelOverlay / ExecutionSlider) mounted as-is. The execution marker 比 is
  ink — vermillion stays the seal's.

**Verified** with a disposable seeded account on the dev server (screenshots in
session): journal strip with both cards, execution overlay showing the
cross-venue 火腿通粉 pair with flick-bounded sliders, duel seal + answer +
reveal (學到 dims), strip clearing to nothing when drained. Fixture user, its
dishes, restaurants and duels deleted after (verified zero leftovers).

**Rejected/parked in the design space** (reasons in the R&D doc): 冠軍 group
champion (deferred, data trigger: 2–3 canonical groups at >= 3 rated),
taste-drift recheck (~35%), cross-cuisine bridge duels (~30%), abstract
attribute probes (rejected — dishes are the interface).

**Follow-up worth watching:** all 4 answered duels sealed at p≈0.5 and all went
the predicted way — a hint DUEL_K=2 under-scales the gap (model UNDER-confident).
Recalibrate DUEL_K against accumulated duel outcomes once n is respectable.

---

# Batch: Table Mode two-account field test — the scanner was on a lookalike — SHIPPED `7da5b12` `2e8a459` `54ad4b4` `1be46d5` (2026-07-30)

Owner report, four symptoms from one session (user 1 scanned a menu, user 2 joined
by code): picking a dish was slow; user 1 saw no chop for user 2, "just a line
under chips"; the signal arrived slowly; and **user 1 picked dishes and user 2
never saw them at all**.

## The single cause

`/scan` had grown its OWN implementation of the table view — its own poll, its own
pick semantics, its own picker rendering — described in its source as "a
lightweight glance." Three of the four symptoms fell out of that one fact. The
scanner is the most engaged person at the table and was sitting on the weakest
surface: everyone who JOINED got the real view, the host got a degraded copy.

Diagnosis was empirical, not read off the code. Session `SA9YZ`: 2 members, 2
picks, **both belonging to the joiner**, zero rows from the host. Vercel logs
agreed — exactly 2 `POST /api/dishes/pick` in six hours.

- **Symptom 4** was not a sync bug. `/table` wrote a pick on tap; `/scan` mutated
  a local `Set` and wrote nothing until a 3-step confirm (cart bar → CTA →
  restaurant chips). The scanner's taps never left the browser.
- **Symptom 3**: `/scan` had no realtime channel at all, only a 5s poll, and never
  broadcast its own actions either.
- **Symptom 2**: `Chop` wasn't even imported in `scan/page.tsx`; pickers rendered
  as `handles.join('、')`.
- **Symptom 1**: the pick awaited the full round trip before any stamp appeared,
  and the endpoint serialised a members SELECT + companion-edge upsert after the
  insert — both explicitly best-effort, both on the response path.

## The fifth bug, unreported

A scan-shared session never set `restaurant_id`. All 5 recent sessions were null,
and both of the joiner's picks logged null. **Joiners' picks lost restaurant
attribution entirely** — and `restaurant x dish` is the moat. The scan screen's
confirm sheet was the only place a restaurant was ever attached, which is why the
pick couldn't simply be made immediate without first moving attribution.

## Decisions taken (owner, 2026-07-30)

1. **Restaurant resolved once at session create, silently** — not asked up front,
   not per pick. Coords are warmed when a scan STARTS (geolocation takes seconds;
   asking at stream end would stall the moment the code appears).
2. **Extract one shared chassis** rather than patch the scan screen in place.

## What that produced

- `src/lib/tableRestaurant.ts` — a pure, conservative confidence gate. Adopts only
  a lone nearby place, or a nearest beating its runner-up by more than GPS wobble;
  anything denser returns `ambiguous` and leaves the column null. **A confidently
  wrong restaurant is worse than none**: a null is a gap someone can still fill, a
  wrong answer silently poisons the data and nobody goes looking. Hong Kong is why
  it isn't "nearest wins" — several restaurants routinely share one street number
  on different floors, well inside the wobble.
- `/api/dishes/pick` reads the session's restaurant back **server-side** and lets
  it win over the client's. Attribution stops being every client's job.
- `src/lib/useTableSession.ts` + `src/components/ChopStampRow.tsx` — one engine,
  one stamp row, mounted by both screens. `/table` no longer imports `Chop` at all.
- Picks are **optimistic**, with rollback (broadcast included) on failure. The poll
  no longer clears overlay entries whose write is in flight, or an optimistic stamp
  would blink out when a poll landed mid-flight.
- `TableRestaurantLine` inside `TableBar` — the one-tap path for the ambiguous case
  and the correction path for a wrong guess. It **re-attributes picks already
  made**, scoped to rows still carrying the session's previous value so a
  deliberate per-dish edit is never stomped.

## Two things that would have broken quietly

- **The seal.** Sealing at pick time lived in scan's `confirmPicks`, which was
  deleted. It moved into the engine's `pick` — so the sealed-bet contract survived,
  and `/table` picks are now sealed too, which they never were before.
- **`source`.** Every scan auto-creates a session, so `tableSessionId ? 'table'`
  would have recorded every SOLO scanner's pick as eaten at a shared table. It now
  reflects real membership, which the pick route already had in hand.

## Deletions (kill legacy on replacement)

scan's poll and its `pickersFor` (a near-copy of `pickMatchesItem` returning bare
handle strings, useless for colouring a chop); the confirm sheet and its state;
`DishListRow`'s `pickedBy` prop and rendering; `tests/scanPickConfirmCancel.test.ts`
(its subject is gone); two orphaned i18n keys; `scanSession`'s `picked` /
`pickRestaurant` mirroring.

`tableComponentIdentity`'s old assertion that "the stamps slot is the one
legitimate host/joiner difference" **was the tolerance that allowed this bug**. The
rows are now byte-identical with nothing excused first, and
`tests/tableChassis.test.tsx` pins each of the three shared-cause symptoms —
verified non-vacuous: every banned marker it asserts against was present in the
pre-fix source.

## Not verified

The real logged-in two-account flow. `/scan` and `/table` are behind `AuthGate`,
the owner's credentials are not the agent's to use, and the external tester's
account is off-limits (`CLAUDE.local.md`). Pixel evidence covers the new CSS
surface only, rendered against the real `globals.css` in a throwaway harness (four
states: resolved, unset, read-only QR, long name). The underline was `--line` at
first and invisible against `--paper-inset`, which made 餐廳未定 read as inert
text — now `--ink-faint`. **The two-account run itself still needs the owner.**

---

# Amendment: shared-surface counters (owner ruling, 2026-07-30 evening)

Follow-up to "the scanner was on a lookalike". After the cart bars were unified
onto one component counting MY OWN picks (reasoned from "the bar is the door to
the rating queue, you rate what you ordered"), the owner immediately reported the
cross-device disagreement as the same sync bug a third time ("user 1's counter
doesn't count user 2").

**Owner correction, same evening:** the my-picks-only version was never asked for
and should not have shipped — changing what a surface MEANS is a product decision,
not a step in a bugfix. The owner's own reason for table-wide is stronger than the
one reasoned out here: this bar's total is the INPUT to the 埋單 endgame (BACKLOG:
均分 equal split, 抽印 seal draw, "one footer line on the table surface — total,
加一 toggle, ÷ headcount"). It is the bill, not a receipt, so per-person totals
would have severed that path at its source. See memory: no-unilateral-semantics.

**The rule that settles it: a counter on a SHARED surface must show the same
number on every member's screen.** A deliberate per-viewer number is
indistinguishable from broken sync to the people at the table, however defensible
its semantics. Per-viewer information belongs on per-viewer surfaces (the rating
queue, the filled-card highlight on your own rows — that one stays mine-only
because it marks rows, not a total).

PickedCartBar therefore counts the whole table's picks and totals the table's
running bill, agreeing with TableBar's 已選 N 道 by construction. Pinned in
tests/tableChassis.test.tsx ("one cart bar — table-wide"), which asserts neither
screen feeds it an isPicked list — that WAS the fix once, and it re-created the
desync one report later.

Also in this round: un-picking stopped blocking on DELETE /api/my/dishes (the
journal's trash endpoint — lock check, rating count, points detach, delete,
possible profile replay — right for the journal, too slow to hold a chop behind),
which required splitting overlay-protection (every write, whole duration) from
tap-blocking (only writes worth serialising); and a tap queued behind an in-flight
write now flips the stamp AT TAP TIME, everywhere, with only the write waiting —
queueing the visual along with the write was the residual "still a bit lag".

# 大話骰 — the third way a table settles — SHIPPED `d40f454` + `ee1d16d` (2026-07-31)

Rules logic had already shipped as `src/lib/liarsDice.ts` (23 tests, 2026-07-31).
This is the rest: server-held dice, the turn engine, the screens, and the
handoff's redesign of the existing bill. Backlog item 6 of the Table Mode
continuation, moved here whole.

## The item as it stood, verbatim

- [ ] **[F] 6. 大話骰 — the third way to settle** — the done-picking
  handshake and the bill SHIPPED 2026-07-30 (`TableSettle`,
  `TableWaitLayer`); the 大話骰 pill is present and reads 即將推出. Rules
  logic SHIPPED 2026-07-31 as `src/lib/liarsDice.ts` (23 tests). Design
  handoff received from Claude Design: README + `demo.jsx` + per-screen
  screenshots (sit-down, opening call, bidding ×2, waiting, reveal).

  **Owner decisions taken 2026-07-31, binding on the build:**
  1. Scope is the game PLUS the handoff's redesign of the existing bill:
     合計 label hidden (number alone, sans, right-aligned), floor-footnote
     reparented to top-align with it, chop NAMES hidden everywhere
     (including `TableWaitLayer`), the three pay options restyled from
     ghost pills to 60px ink circles with glyph + caption, heading
     如何付款 → 邊個埋單.
  2. The wild-1 pip is vermillion. Shipping WITHOUT a CLAUDE.md change,
     by owner call — so this knowingly widens the documented-vs-actual
     `--seal` gap that `.design-sync/NOTES.md` already records at 13
     consumers. Do not "fix" it back.
  3. Cantonese register for this surface is DELIBERATE (邊個埋單, 揀方向,
     就開咗盅), a named exception to the 書面化 direction. A later
     register pass must not flatten it.
  4. The reveal marks counting dice by DIMMING the rest. No arithmetic
     line, no per-die equation.

  **What remains, in dependency order:**
  - Server-held dice. Same contract shape as the sealed bet: a player's
    roll is returned to that player alone, and the whole table's rolls
    are assembled only at 開. Table for round/bid/challenge state, all
    writes on `supabaseAdmin()` (the existing table_* RLS locks these
    against their own owner, see `table_ready_and_settle.sql`).
  - Turn engine over the existing 5s poll + realtime channel, the way
    readiness rides it today. `nextPlayer()` already handles direction
    and wrap.
  - Screens, reusing `.settle*` classes. Handoff's own instruction:
    do NOT port its `innerHTML`/DOM-surgery prototype mechanism; either
    extend `TableSettle` with a `gameState` prop or compose a sibling.
    `turnUserIdFor()`'s name-string matching must become a real
    `currentTurnUserId`.

  **Open, flagged by the handoff itself — resolve before shipping:**
  - Screens 1k/1l are labelled 二人局 but render 4 chops (they were
    converted to a shared 4-chop mount late). A real 2-player table needs
    its own variant, not this mount.
  - `.dc.html` + `demo.jsx` + screenshots are in the owner's Downloads
    zip (`大話骰 Game Design.zip`), not committed. Re-request if lost.

## What shipped

**The dice, server-side.** Two tables, applied live
(`supabase/applied/table_dice_rounds.sql`), with opposite visibility rules on
purpose: `table_dice_rounds` is the public half (direction, seating order, whose
turn, every call — all of it spoken aloud at a real table anyway) and
`table_dice_rolls` the hidden one. RLS on both with NO policies at all, locked
against their own owner exactly like `sealed_predictions`; every access is an
API route on `supabaseAdmin()` after checking membership.

`viewForUser()` in `src/lib/tableDice.ts` is the single gate. It takes the round
and EVERY cup and returns what ONE player may know, which before 開 is their own
five dice and nothing else. Deliberately not a fetch-only-mine query: the reveal
needs them all, and two code paths would eventually disagree about which one is
the safe one. A test serialises a mid-round view and asserts no other player's
hand appears anywhere in it at any depth.

**The turn engine** rides the existing 5s poll — `GET /api/table/[code]` carries
the game view, loaded only when a table has actually started one — and each move
broadcasts the same nudge readiness already uses. Moves are NOT optimistic: a
pick is a tap on a dish and has to feel like one, but a call is a claim with $216
riding on it, and showing it as made before the server accepted it is how a table
ends up arguing about a bid that was never legal.

**開 is open to anyone at the table, in turn or not**, except whoever made the
standing bid. This was read off the design's own screens rather than decided
here: 1j (JC's own 6個四 standing) has no 開 button, 1k and 1l (陳大文's 7個四
standing) both do — including 1l, where it is Wing's turn and JC is waiting. The
reveal copy says the same thing out loud: Priya opened while Wing hadn't gone.
First 開 wins (`is('revealed_at', null)`), and the loser is written to
`pay_payer_id` the same way a random draw is, so the game, the bill and the
verdict line all name one person.

**The screens** mount INSIDE `TableSettle` (a `game` prop plus four callbacks),
not beside it. Every state of 大話骰 is still the settle screen: same total, same
chops, same place on the page. Waiting is a quiet in-page state of the bidding
screen with your own controls hidden IN PLACE (visibility, not display), never
`TableWaitLayer` — which is right for "everyone finishes independently" and wrong
for a sequential public auction where the waiting player still needs the live
call, the history, and their own dice.

**The bill redesign** shipped with it, per decision 1, plus two riders visible in
the handoff's approved reference screenshot and flagged to the owner: bill dish
names take the display serif they get everywhere else through `.card-title`, and
the floor note now names the service charge (有些沒有標價和未計加一) rather than
only the missing prices. Deliberately NOT ported: the prototype's per-chop
per-person amount replacing the `settle-verdict` line — that changes what the
screen SAYS, and decision 1's enumeration didn't include it.

## The two open questions, closed

1. **The 2-player variant is not needed.** 1k/1l rendered four chops because the
   prototype was a fixed 4-chop mount; the real screens are member-driven, so a
   two-person table renders two chops, two seats and an alternating turn with no
   variant at all. Verified on a real 2-member render.
2. **The reveal arithmetic** is decision 4's dimming: every die that counts toward
   the challenged face stays ink, the rest fade to 0.22, and the total is printed
   once (全枱得 5 個四). The mask comes from `countingMask()` server-side, so the
   dimming and the verdict cannot disagree.

## Two prototype mechanisms deliberately not ported

- The `useEffect` + `innerHTML` DOM surgery. This is real composition.
- The call-history strip's per-screen `translateX(-65px)` / `(-128px)` offsets.
  The strip now right-packs with a collapsing flex spacer instead of
  `justify-content: flex-end` — which is the one way to right-pack a scroller
  that still scrolls, since flex-end overflows to the LEFT and that overflow is
  unreachable (`scrollWidth` never grows). With flex-end, a long round's earliest
  calls would have been clipped forever. The strip also absorbs its own extra
  height (`margin-block: -17px`), because it swaps in and out as the turn moves
  and the confirm button underneath must not jump 34px every time somebody calls.

## Composer defaults, and why they reproduce the design's own numbers

The opening call seeds at `openingQuantity(totalDice)` = ⌊dice ÷ 3⌋ (with 1s
wild, any face is expected on a third of the table) and `favouriteFace(yourDice)`
— which for a four-person table and the handoff's own hand lands on exactly
6個四, the call in screen 1i. Both are read off information the player already
has; nothing private moves anywhere. A raise seeds at the smallest legal one, so
the confirm button is never sitting under a call that would be rejected.

## Still open

A real multi-account field test at a table. Every screen here was verified
against a rendered 4-player and 2-player session, but the poll/broadcast turn
handoff between two live devices has not been exercised the way the 2026-07-30
two-account test exercised picking.


# Batch: attribution & naming accuracy — the EXIF-first UX (owner design session, 2026-08-01)

(Items 2-5 still open — see BACKLOG.md, same heading, including the batch-wide
do-not-destabilize constraint that binds them.)

## 1. `restaurant_guess` × nearby cross-reference — the menu names its own restaurant *(Fable first pass; ~80% confidence)*

The scan already extracts the restaurant's printed name (`restaurant_guess`) and
throws it away as display text. Cross-reference it against the nearby list with
`namesMatch()` (exists, src/lib/restaurant.ts):

- Printed name + GPS agree → auto-set the table session's restaurant. This
  honestly passes tableRestaurant.ts's refuse-to-guess bar: a printed name
  matching a place within tens of metres IS unambiguous, unlike GPS alone in a
  vertical mall.
- Printed name found, absent from nearby → existing Places text search with the
  guess → ONE confirm chip (係咪喺{name}？). Confirming is a tap; typing never
  required.
- No printed name found → exactly today's behaviour (餐廳未定 line).

Guards: auto-set only fills a BLANK restaurant — never overwrites one already
set (by a member, or by tableRestaurant.ts). The 餐廳未定 line stays the
correction path. Kill criterion: any field session where the auto-set picks the
WRONG shop → demote auto-set to the confirm chip until the matcher is fixed.

### Shipped 2026-08-01 (verbatim outcome, recorded at ship time)

Both halves landed. Server: `decideSessionRestaurant` takes the printed name and
runs it BEFORE the distance rules — testimony beats wobble — adopting only on
exactly one match (namesMatch, plus namesContainmentRelated under its guards);
POST /api/table passes the scan's restaurant_guess through, mock scans pass
null. Client: when the gate didn't adopt and the table has no restaurant, the
scan page looks the guess up once via /api/restaurants/search and the
restaurant line offers one chip — 在{name}嗎？ — that commits through the same
onChange as every other answer. Deliberately NOT a veto: a lone in-range
candidate that fails the match still wins by the old rule, because namesMatch
is exact-after-normalization and a guess rendering 翠華餐廳 against a row saying
翠華 must not regress the common case. Quiescence pinned mechanically (a
candidate-shape sweep asserting deep-equal verdicts with null/unmatched names;
a DOM-identity test on the line without a suggestion). Mutation-tested:
reordering refinement after distance fails 1 test; dropping the exactly-one
guard fails 1. Owner field pass pending — the batch constraint gates item 3
(next code item) on it.

---

# Batch: onboarding — the album-first cold start (owner design session, 2026-07-29) — SHIPPED `c359ddc`, 2026-08-01

(Full backlog entry, verbatim, plus the owner's decision-close and the shipped
shape. One remainder stays OPEN in BACKLOG: where the walkthrough is re-viewable
from.)

**The owner's ask:** a new joiner should get up to speed by rating food
photos drawn from their own camera roll, after the simplest possible
walkthrough of what dishi is.

**The insight to build around:** every new user already owns years of taste
evidence — their camera roll IS their food diary, they just never rated it.
The album source, the merged pill picker, RatingStack, and TasteGrowth all
exist; onboarding is a thin GUIDED PATH over shipped machinery, not a new
flow. (Reuse, don't imitate: the onboarding rating experience IS
RatingStack — if onboarding ever needs its own rating card, the design has
gone wrong.)

## The flow (first sign-in, skippable at every step)

1. **Walkthrough, TWO cards, not a marketing carousel** (ink-on-paper,
   Chinese-first, one line each + small art):
   - Card 1 — dishi 記住你食過乜，學你鍾意乜。影相、屋企飯、舊相，一樣計。
     (dishes not restaurants; equal-weight logging stated up front)
   - Card 2 — 評得多，你嘅味 AI 就愈似你。仲可以帶去你自己嘅 AI 度用。
     (the blob + the export, one breath — the destination, not the mechanics)
   No card 3. The third beat of every onboarding is churn; ours is DOING it.
2. **The ask:** 揀幾張你影過嘅食物相（5–10 張，多多益善）— straight into
   the SAME photo picker the merged pill opens, album mode. Camera-roll
   permission is requested here, in context, not at app open.
3. **Rate them:** RatingStack flick, exactly as shipped. TasteGrowth plays
   after — the new user watches their profile take first shape from photos
   they already had. That moment is the product pitch; no copy needed.
4. **Landing:** profile page with the buddy bar's onboarding endowment
   acknowledging the head start (endowment already exists in buddy.ts —
   wire, don't invent; it must never masquerade as trained signal, its
   standing rule).

## Design decisions needing the owner (before build)

- Photo count ask: 5–10 framed as 多多益善, or a harder "pick 8"? (Fuzzy
  asks convert worse; hard asks feel like homework.)
- Scan introduction: deliberately ABSENT above — first restaurant visit is
  the natural scan moment. Agree, or should card 2 mention it?
- Replay: walkthrough re-viewable from somewhere (設定?), or once-only?
- The 食記-journal eaten-date question (open thread) becomes USER-VISIBLE the
  moment album logging is the front door — old photos with EXIF dates will
  populate the journal's past. Decide ordering there first, or accept
  when-logged order for launch?

## Tier + verification

Fable, unambiguously (new first-run surface, and the first thing every new
user ever sees). Verify with a REAL fresh account and a real camera roll —
fixture photos hide exactly the density/quality problems onboarding exists
to survive. Screenshot every step including both skip paths.

## Decisions closed by the owner (2026-08-01, at build kickoff)

- **Photo ask: 5+**, framed as a floor (至少 5 張，多多益善), not a range or a
  quota. The owner's fuller answer binds the whole flow: "either by batch or
  one by one, the ratings should help the user visualise they are FORMING the
  dishi AI (ink blob), that each rating is making it bigger" — which is exactly
  TasteGrowth's job (the header blob is the real profile, regrowing as each
  rating commits), so the build's obligation was to route into it, not to add
  a new visual.
- **Scan mention: one clause on card 2** (出街食嗰陣，影埋張菜牌，dishi 幫你揀
  — a quieter second line under the owner's verbatim card-2 line).
- **Replay: deferred.** "We will find a place to show it again; decide later."
  No 設定 entry built. OPEN remainder in BACKLOG.
- **食記 ordering: when-logged for launch.** The fuzzy eaten-date design stays
  an open thread; onboarding does not wait on it.

### Shipped 2026-08-01 (`c359ddc`) — the shipped shape

A fresh account's first visit to the Taste tab opens a three-step sheet on the
rate-sheet glass: card 1 (the merged pill's own three segment icons + the
owner's line), card 2 (TasteFormLive with fixed demo inputs + the export line +
the scan clause), then the ask, whose CTA clicks the merged pill's OWN album
input — one entry point, so everything after is RatingStack → TasteGrowth
byte-for-byte. Skippable at every step via the corner ✕; tappable step dots.

The gate (`shouldShowOnboarding`, src/lib/onboarding.ts) fails closed: it
requires zero ratings AND zero rated rows AND zero queued picks AND both
fetches genuinely resolved AND no per-user seen flag — any other state renders
exactly the pre-batch page (pinned by tests/onboarding.test.tsx). Seen flag is
per-user localStorage (freshness itself is server-derived, so another device
costs at most one extra skippable sheet); both skipping and engaging (the
rating overlay opening) retire it. Step 4 needed no code: the endowment
(onboardingCredit → engineConfidence) already reaches the 強度 stat.

No new CSS — the design-review rule holds; chassis is .rate-sheet, .card,
.ok-circle, .persona-dots as they exist. Owner field pass (real fresh account,
real camera roll) pending per the stability rule.

### Amendment — first field pass + the chip distance gate (2026-08-02)

Owner field-ran item 1 at Central Market (一起食堂, a food hall on neither Places
nor Dishi; menu's printed brand read as "Kowloon Noodles"). The auto-set gate held:
nothing adopted, correctly — the kill criterion did not fire. But the confirm chip
misfired: the text search (biased to ~1km) returned a DISTANT namesake, and the
chip offered 在Kowloon noodles嗎？ for a place that wasn't the building the owner
sat in. Name alone made the chip an invitation to the wrong tap — the failure just
moved from silent auto-set to prompted human error.

Fixed same day: offerableGuessHit (tableRestaurant.ts) now requires the hit to
BEAR the scanned name AND sit within SUGGEST_RADIUS_M (150m) of the table — looser
than AUTO_RADIUS_M because a human confirms, bounded because of exactly this case.
150m tolerates the wobble observed in the same session (a fix 98m off inside one
building) while refusing the cross-neighborhood namesake. Scans among the first
five hits, not just the top one. Mutation-tested: removing the distance check
fails 3 tests. The fixed chip behaviour awaits its own field confirmation before
item 3 starts.

---

# 墨靈 anatomy: SIGNED OFF as a living surface, not a finished one (owner, 2026-08-05)

**The owner's call, verbatim in substance:** sign off the anatomy now and refine
along the way; it will be an area for much enhancement, but production time has
to be distributed wisely, so this becomes an ongoing enhancement across the
product lifecycle rather than a gate to clear once.

This closes the last item on the framework's ship path (step 3's "the owner's
pass on each skin/limb at real profiles"). The creature is live: the aggregate
(`domainEvidence.ts` + `taste_profiles.domain_evidence`), the renderer
(`creatureForm.ts`), snapshot parity (`canvasToSvg.ts`), and the phase-2 wiring
(`953abcd`, Taste tab + public dossier + in-session growth screen) all shipped
before this decision — the owner's go was the only thing outstanding.

**Why this is safe to sign off early, and not a shortcut.** The being was
designed reversible from the start (see "The metabolism"): features bud, form,
articulate, atrophy and shed on recency-weighted evidence, and permanence lives
in the 銘 and the 圖鑑 molt archive, NOT in the body. A surface built to change
as the person's eating changes is, by construction, also a surface that can
absorb craft revisions without breaking what it promised anyone.

**The one guardrail this decision does NOT dissolve.** There are two different
kinds of change and only the first is free:

- The BODY changing because the PERSON changed (a claw sheds because they
  stopped eating crab) — this is the product working, and needs no ceremony.
- The RENDERER changing because we improved it — this rewrites every existing
  being retroactively, including in already-shared 相見 cards and export
  headers. Incremental tuning (a skin tone, a limb proportion) is fine and is
  what this sign-off authorizes. A change large enough that an existing user
  would not recognise their own being is a different act, and needs the same
  deliberateness as a rename: not forbidden, but never a side effect of a
  tuning round.

**Working method stays as recorded** (the v10 fidelity failure and the claw
rounds both proved it): one element per round, everything else untouched,
owner verifies before the next; ask for a sketch after two missed rounds; derive
structure from a reference by measurement before writing code. Signing off the
anatomy does not license batching changes — it licenses shipping without waiting
for the anatomy to be finished, because it never will be.

**Immediate consequence:** onboarding is now free to be designed around the
creature (Claude Design brief), since the being it stars is live rather than
pending.


# Batch: 墨靈 growth program (2026-08-06, owner brief → Fable design)

## G1. Timed metabolism (accumulator v2 + domainsAsOf adapter) — *(Fable)* — ✅ SHIPPED 2026-08-06
Continuous-time EMA on the FEEDING clock — rating created_at, the order the
replay walk already runs in (HALF_LIFE ~120d; no re-sort, no eaten-date
plumbing). Invisible until G2 reads it. Renderer contract unchanged.

Shipped as: `DOMAIN_HALF_LIFE_MS` + `accumulateDomainsT` + `domainsAsOf` in
`src/lib/domainEvidence.ts`; threaded through the replay walk (same events,
same weights — pinned by a same-instant equivalence test against the plain
record); persisted to `taste_profiles.domain_evidence_t` (migration recorded
in supabase/applied/) from all five write sites (ratings both branches,
execution, my/dishes ×2, enrich). 11 new tests. Nothing reads the record in
production yet — that door opens at G2, which must begin with a one-off
replay backfill (existing rows hold '{}' until any write triggers replay).

## G3. Sub-node detectors: air (free), lamb, sea fish/cephalopod, field — *(Sonnet)* — ✅ SHIPPED 2026-08-06
domainEvidence.ts patterns; 魚香 tripwire; cephalopod-before-fish ordering;
guard the latent 田雞-matches-雞 misread in LAND_SUB; unit tests per
family. Invisible (fills bags nothing reads yet). (Part morphemes were cut:
plate-names-the-part REJECTED by owner — parts represent the animal, never
the cut eaten.)

Shipped as: `AIR_FLAGS`, `SEA_SUB`, `FIELD_SUB` + lamb added to `LAND_SUB`,
plus a global `VOID_WORDS` strike (田雞, 魚香) run before any family, in
`src/lib/domainEvidence.ts`. `air` is flag-only (no name search — the flag
vocabulary already carries the chicken/duck_goose split with full coverage);
`lamb` is flag-OR-morpheme, the one exception in `LAND_SUB` (an unambiguous
single-species flag, unlike beef/pork/chicken which stay name-only); `sea`
and `field` are morpheme-only, gated on their parent domain already being
established. `classifyDish`'s five sub-bag computations were folded through
new `foldSub`/`foldSubT` helpers shared by `accumulateDomains` and
`accumulateDomainsT`, replacing five hand-written duplicate blocks with one
each. `DomainEvidence.sub` (creatureForm.ts) and `DomainEvidenceT`
(domainEvidence.ts) both extended with `air`/`sea`/`field` bags and lamb on
`land`. 22 new tests, including two that caught real bugs before ship: the
lamb flag alone did not originally fire without a name morpheme (fixed —
lamb now merges flag + morpheme hits), and a `豆苗`-based soy+leaf test was
wrong about its own vocabulary (fixed the test, not the code). Full suite
1298/1298, tsc clean. Nothing reads these bags yet — that is G4, one
gesture port per round, prawn pincers first (detector already live from
before this batch).

## G9. Sub-node species FLICKER — the duel decides — *(Opus)* — ✅ READ SIDE SHIPPED 2026-08-06

Shipped as: `accumulateDuel` + `DuelVerdicts` in domainEvidence.ts (pairwise,
direct, never decayed, ties record nothing); `pickVariant`/`domOfStable` in
creatureForm.ts carrying the ladder; duel selects widened in replay.ts AND
/api/duels/answer to carry diet/ingredients/names.

Three things the build corrected, none of them in the original plan:
- Rung 3's "stable hold" first returned the CALLER'S first argument, which
  reads as stable until domOfStable passes the pair in mix order — itself the
  value that flickers. The tiebreak must be a property of the PAIR (now
  lexicographic), never of how it was handed over. Caught by its own test.
- The variant CHOICE was reading subMix's output, which defaults an absent
  variant to 1 ("absent → equal mix", right for blending geometry). That put a
  never-eaten crab in a near-tie against the owner's real lobster 1.23, a hair
  outside the dead zone. The choice now reads the RAW bag, where absent is 0.
- A dead zone alone left 9 flips across the bench's first nine shellfish meals:
  two lobster against one crab is a 67/33 landslide by share and three meals by
  life. MIN_LEAD (1.5, about one loved meal) closes it — the same
  large-slice-of-almost-nothing principle the evidence floors already use.

Measured end to end on the bench's alternating 50/50 diet: **16 flips → 1**,
and that one is the honest transition from "only lobster eaten" to "both eaten
equally". Byte-identity re-proven across nine lives INCLUDING the owner's real
live profile — only the exact-tie fixture (pork 8 = chicken 8) changes, which
is the contested case itself, and where the old answer was arbitrary
(Object.keys order) rather than chosen.

## G10. Sub-nodes need a VISIBLE BIRTH — the takeover as a process — *(Opus)* — ✅ SHIPPED 2026-08-06
Owner, watching the metabolism timeline: "the user ate 3 crabs (already have
the crab claw), then ate a lobster on day 123, loved it — and nothing would
happen? We may not need the lobster claw to take over the crab right away, but
it should show SOMETHING. How do we visualise this as a PROCESS — that's what
the metabolism timeline is for."

The gap, exactly: 萌→成→精 applies to DOMAIN nodes (shell, land, air), so a
first loved shellfish dish visibly buds a claw. It does NOT apply to SUB-nodes
(crab vs lobster), which are resolved by a winner-take-all switch. A minority
sub-node is therefore INVISIBLE until the moment it wins, and then the whole
gesture changes at once — a jump cut where the design promises a process.

The framework already mandates the fix and one limb already obeys it. The
blend rule (lab v5): "limb GEOMETRY blends continuously with the sub-node mix;
the TERMINAL DETAIL takes the dominant sub-node, because a blended foot at
thumbnail size is mud." Measured 2026-08-06:
  - LEGS obey it — `len` and `w` in drawLeg are continuous functions of the
    beef/pork/chicken mix; only hoof/trotter/toes switches.
  - CLAWS do not — the whole gesture switches on `species`, and `mix` is
    computed and then never read. (It became fully dead when G9 re-pointed the
    species pick at the raw bag; either give it this job or delete it.)

Proposal — blend the claw's OUTER geometry, keep the pincer as terminal detail:
  - `sL/sR` asymmetry: 蟹 1.00/1.00 ↔ 龍蝦 1.22/0.82, interpolated by the mix
  - `WRIST_BURIAL` (reach): 蟹 0.82 ↔ 龍蝦 0.96, interpolated
  - `drawFn` (the pincer itself) still SWITCHES at dominance — the culmination
Both endpoints are owner-calibrated and are preserved exactly at a pure mix, so
no existing single-species being moves; only genuinely mixed palates change.
Cheap, and it touches no gesture interior.

The timeline that produces, on the owner's own scenario:
  day 0-120  3 crabs          → crab claws, symmetric, tucked
  day 123    first lobster, loved → arms visibly reach out and asymmetry
                                    APPEARS, pincers still crab. Something
                                    happened, the same day, without lying
                                    about who is dominant.
  day 200+   more lobster     → the lean deepens continuously
  day ~300   lobster overtakes → the pincer flips. The takeover now READS as
                                 the end of a process the person watched.
Pairs with G5, which would NAME the moment on the growth screen (「龍蝦 · 第一次」).

General principle to apply to every family, not just claws: a sub-node's first
evidence must produce a visible change, even while another variant still owns
the terminal detail.


**The owner then made it better than the recorded proposal.** Rather than
BLENDING one pair's geometry toward the newcomer, variants COEXIST: "the crab
claws could stay, with 2 baby lobster claws sticking out from the body. In
time, if the user eats more lobster the lobster claws grow bigger, and if they
stop eating crab, eventually the lobster claws take over." Their reason
generalises the principle: a bird eater keeps claws AND grows wings, a sea
eater carries tentacles AND legs — co-occurrence is the common case in real
eating. G2 established that for domains; this is the same rule one level down.

Shipped as `clawSeats()` in creatureForm.ts: one pair per qualifying variant,
each on its own flank seat (prime 1.95, second 1.52), each sized by its OWN
sub-node evidence through its own bud→form ramp. Shellfish with no shipped
gesture (prawn, un-named dishes) folds into the PRIME seat's size, so a
prawn-dominant palate keeps a full-size claw instead of a stub — the
framework's "an undifferentiated node falls back to its parent's gesture",
applied to size rather than shape.

**This dissolves the G9 flicker for claws rather than damping it** — with
coexistence there is no species to pick, so there is nothing to flip. G9's
ladder survives where it is still load-bearing: choosing which variant takes
the PRIME seat, and the genuinely single-slot features (a leg has one foot;
you cannot wear a hoof and a trotter on one ankle).

Verified as a timeline, which is the point:
  3 crabs                → crab@prime 0.83
  + first loved lobster  → crab@prime 0.83  +  lobster@second 0.29   (same day)
  lobster habit forming  → crab@prime 0.83  +  lobster@second 0.73
  crab stops             → lobster@prime 1.00 + crab@second 0.36     (seat swap)
  crab shed              → lobster@prime 1.00
The prime pair's size is untouched by the newcomer's arrival, so nothing is
taken away to pay for the new thing.

metabolism mode only; legacy returns exactly one pair at exactly today's size.
Byte-identity re-proven across nine lives including the owner's real live
profile — all nine IDENTICAL. 8 new tests; full suite 1344/1344, tsc clean.
Also cleared the dead `mix` variable in the claw block, orphaned by G9.

## G2. Gate redesign: bud / form / articulate, prominence dial — *(Fable)*
Existence by decayed absolute evidence (BUD_FLOOR ~1.2), size by
share/maxShare (0.22 share door retired), paling by staleness, shed with
hysteresis. Owner reviews on /dev-creature with an as-of time slider BEFORE
ship. Go/no-go gate for the metabolism. LANDING STEP: existing users'
domain_evidence_t is '{}' until a write triggers replay — G2 must open with
a one-off replay backfill for all real profiles, or bodies would blob out. — ✅ SHIPPED 2026-08-06

Owner reviewed the whole metabolism on the /dev-metabolism time-travel bench
(600 synthetic days through the real engine — buds, coexisting claw pairs,
starves, seat swaps, the duel toggle) and approved: "G2 good to go."

Shipped in order, the order being the point:
1. BACKFILL FIRST — one-off script ran the real replayProfile for every
   profile and persisted domain_evidence_t, so no profile was empty when the
   read switched (the tester's was: 1 rating, timed record still '{}' — their
   creature would have silently blobbed out between deploy and backfill).
2. THE FLIP — both server assembly points (/api/buddy for the Taste tab and
   growth screen; dossierResolve for the public dossier) now serve
   domainsAsOf(domain_evidence_t, Date.now()) under the unchanged field name,
   computed server-side so SSR and client can never render different markup
   from two different "now"s. The three mounts pass growthMode="metabolism"
   (TasteFormReveal grew a pass-through prop — one chassis, two surfaces).
3. VERIFIED ON REAL DATA — the owner's live dossier (localhost against the
   real DB): their creature renders with WINGS for the first time. Their air
   share is 7.3%; the legacy 0.22 share door made wings permanently
   impossible on their own profile — the measured diagnosis that opened the
   growth program, now fixed on the being it was measured on. Fur, shell
   band, claws, legs, tendrils all present; the varied diet finally shows.

Legacy mode stays in the renderer as the byte-identical control the whole
program was verified against; nothing passes it in production any more.

## G4 round 1: 蝦 prawn pincers — *(Fable)* — ✅ SHIPPED 2026-08-07 · OWNER SIGNED OFF same day
Model call stated per the tier rules: Fable — a new visible gesture on a live
production being is the calibration-class surface where claws burned six
rounds; BACKLOG tags G4 "(Fable first pass each)"; new-surface rule applies
regardless of spec completeness. Confirmed mid-round: NOT a lab port — the
framework's variants table specified "蝦 fine thin pincers" but no lab version
ever built them, so this is a fresh first pass under the standing working
method (owner verifies; sketch after two missed rounds).

The design: identity is the INVERSE of the other two claws. 蟹/龍蝦 are MASS;
蝦 is DELICACY — a long thin bowed arm (len .95, longer than 龍蝦's .84),
two fine opposed prongs with a narrow visible gape, near-symmetric pair. What
keeps thinness a pincer rather than a whisker is the gape topology: one prong
rigid with the arm, the other hinged at the hand taking m.pinch — the same
one-hinge lesson as the 龍蝦 dactyl. Same frame/motion contract; prawn joins
the pair-stagger and unison-snap behavior for free.

clawSeats: 蝦 is FIRST-CLASS in metabolism — the fold-into-prime compensation
is deleted (it existed only because the gesture was unbuilt, and it is what
saturated a 龍蝦 claw to the crop bug). Three-way ranking: prime by the G9
ladder, strongest other above the bud floor takes the second seat. Burial:
prawn wrists sit at crab depth (.84) — the long arm IS the species' reach,
burial must not double it. LEGACY untouched: frozen crab/lobster pair, prawn
still folded, pinned by test.

Verification, all through the new instrument layer: ink-bounds net validated
the fresh gesture automatically (owner's real profile, every size, both
modes, no crop — the instrument's first day earning its keep); live-canvas
pixel scan on /jerry: zero dark pixels on column 0, nearest ink col 11.
Byte-identity: all nine legacy renders IDENTICAL, eight of nine metabolism
identical — ONLY the owner's (prawn-lived) render changed. The owner's
creature now wears its actual dominant crustacean: prime prawn pincers
(~0.84) + baby lobster second pair (1.23 ev, just over the bud floor).

5 tests updated/added. tsc clean; full suite 1375/1375.

## G4 round 2: 翼 wing variants 雞/鴨鵝 — *(Fable)* — ✅ SHIPPED 2026-08-07
A true lab port (unlike round 1): endpoints measured off 雞翼/鴨翼/鵝翼 in
mokling-lab-v7-vocabulary.js — 雞 short round (len .16, spread .22/stroke),
鴨 pointed swift (.30/.13), 鵝 long broad (.36/.10). The shipped detector is
two-way (sub.air: chicken vs duck_goose), so the port pairs 鴨鵝 as the 肢
table always did: 雞 short flutter fans vs 鴨鵝 long glide strokes. The 鴨/鵝
split stays LAB-ONLY until a finer detector exists — no detector, no feature.

wingShape(airBag, mode): a pure blend whose EQUAL MIX is exactly neutral —
every multiplier 1.0, base angle the original −0.32 — so undifferentiated air
renders the generic fan byte-for-byte (fail closed), and legacy is pinned
neutral regardless of data (the frozen control grows no variants). Endpoint
ratios keep the lab's: chicken ≈ half the glide length, ~2× the fan spread,
raised toward flutter; 鴨鵝 flattened toward glide, thinner, tight sweep.

One trap re-caught by its own tests before ship: the first cut read the mix
through subMix, whose absent→1 default (right for the legs' calibrated
blending) diluted a pure chicken eater with a phantom equal-mix goose — the
same absent-means-zero lesson pickVariant carries from G9. wingShape computes
its own mix with absent = 0, neutral only when the whole bag is unlived.

Verification: ink-bounds net extended with goose-heavy and rooster-heavy
fixtures (the longest wing the blend can produce, lenMul 1.35, is now a
standing crop case); live pixel scan on /jerry: zero dark pixels on all
canvas edges. Byte-identity: all nine legacy renders IDENTICAL; only the
owner's metabolism render changed (theirs is the only fixture with lived
sub.air — chicken-dominant 4.68/1.10 → visibly shorter, wider-fanned,
raised flutter wings). 7 new tests; full suite 1380/1380; tsc clean.

## G4 round 2 tune: 雞 +30% mass boost — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench (`/dev-wings`): "for chicken, try increase strokes
and overall size by 30%." Sonnet-tier call: a numeric tune on an already-
shipped, already-verified gesture with a live reference on screen — not a
new surface.

The lab's own fidelity trace called chicken wings "SUBSTANTIAL ruffle-fans —
stubby arms, not feather slivers"; the vocab-derived blend alone (lenMul .65
at pure 雞) kept the short/wide SHAPE right but read thin rather than
substantial once seen at real size on the bench.

`chickenBoost = max(0, k)` — ramps 0→1 only across the neutral-to-pure-雞
half of the blend, exactly 0 for any 鴨鵝-leaning mix. `massMul = 1 + 0.3 *
chickenBoost` multiplies lenMul, widthMul and a new countMul (stroke count,
wired into the draw loop's `nS`) on top of the existing blend — spread,
angle and hump carry no boost, so only mass moves, not silhouette shape.
One-sided by construction: the goose endpoint, the no-lived-data neutral
cell, and legacy are each pinned by their own exact-equality test and
confirmed via byte-identical dumps (goose and goose-lean fixtures added to
the guard specifically because they're the cases most likely to leak a
one-sided formula's sign error).

Verified: 11-fixture byte-identity sweep — all 10 non-owner renders (legacy
AND metabolism) IDENTICAL to pre-tune; only the owner's metabolism render
(chicken-leaning) changed. Visual confirmation on `/dev-wings`'s endpoint
row: chicken now visibly carries more strokes and more presence than the
generic middle cell; goose unchanged.

9 new/updated tests. tsc clean; full suite 1384/1384.

## G4 round 2, owner correction: thickness + curvature only — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, superseding the earlier mass-boost round (which was
reverted the same session): "same length, width, and stroke count. just the
stroke thickness increase, and more curved." A course correction, not an
addition — the mass boost's length/count scaling is fully removed, not
stacked under.

雞 now gets exactly two one-sided dials, both +40% (curvature had no stated
number; matched to the thickness dial the owner had just given, and named as
an easy pair to retune independently next round): `thicknessMul` on widthMul
only, `curveMul` on humpMul only (the actual quadratic-curve control-point
offset — confirmed by reading the draw site, not assumed). Length, fan
spread ("width" in the owner's vocabulary — the code's `spreadMul`, distinct
from the `widthMul` field that is actually stroke thickness) and stroke
count are back to the PLAIN species blend with zero chicken-specific
scaling — countMul is now a flat 1 for every mix.

Same one-sided chickenBoost ramp as both prior dials, so the same guarantee
holds and is reconfirmed: goose endpoint, no-data neutral, and legacy each
pinned by exact-equality tests; 11-fixture byte-identity sweep shows only
the owner's render moved. Visual check on /dev-wings: chicken now reads
visibly THICKER and more CURVED than the generic fan while staying the
SAME short length — the three attributes move independently for the first
time this round.

11 tests replaced/added. tsc clean; full suite 1385/1385.

## G4 round 2 tune 3: 雞 thickness stacked another +50% — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, immediately after the thickness+curvature
correction above: "try increase stroke thickness by another 50%." Read as
"another" — stacked on top of the existing +40% thickness dial, not a
replacement for it and not touching curvature. Sonnet-tier: a numeric tune
on an already-shipped gesture with a live reference on screen.

`thicknessMul` became `(1 + 0.4 * chickenBoost) * (1 + 0.5 * chickenBoost)`
— two multiplicative passes riding the SAME `chickenBoost` term, so the
stack stays one continuous ramp rather than two independently-shaped curves
that could disagree at partial mixes. `curveMul` is untouched at `1 + 0.4 *
chickenBoost`. At pure 雞 the plain blend's widthMul 1.3 now carries a 1.4 ×
1.5 = 2.1× stack, landing at 2.73 — humpMul stays at the single-dial 1.3 ×
1.4 = 1.82.

Same one-sided guarantee, reconfirmed: 11-fixture byte-identity sweep —
legacy identical across all 11 fixtures, metabolism identical for all 10
non-owner fixtures (including both goose fixtures), only the owner's
chicken-leaning render changed. Visual check on `/dev-wings`: 雞·pure now
reads distinctly heavier than 雞-lean, which in turn reads heavier than the
prior round's single-dial version; generic and 鴨鵝 cells unchanged; legacy
row stays flat across all five cells.

4 test assertions updated (widthMul references moved from `1.3 * 1.4` to
`1.3 * 1.4 * 1.5`; humpMul assertions left at `1.3 * 1.4`, unchanged this
round). tsc clean; full suite 1385/1385.

## G4 round 2 tune 4: 鴨鵝 gets its own +20% thickness dial — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, immediately after the 雞 stack above: "duck / goose
stroke thickness increase by 20%." A mirror-side request, not a further 雞
tune. Sonnet-tier: numeric dial on an already-shipped gesture, live reference
on screen.

New `gooseBoost = max(0, -k)` — ramps 0→1 only across k∈[-1,0] (pure 鴨鵝
through neutral) and is exactly 0 for any 雞-leaning mix, mirroring
`chickenBoost`'s construction on the opposite half of the blend. Feeds a new
`gooseThicknessMul = 1 + 0.2 * gooseBoost`, multiplied into `widthMul`
alongside the existing `thicknessMul` — at any given k only one of the two
boosts is ever non-1, so they can never stack on each other. No curvature
dial requested for this side; `humpMul` is untouched. At pure 鴨鵝 the plain
blend's widthMul 0.7 becomes 0.7 × 1.2 = 0.84.

Verified: 11-fixture byte-identity sweep — legacy identical across all 11,
metabolism identical for the 9 fixtures with no goose-leaning air data
(including `owner`, still chicken-leaning), only `goose` and `gooseLean`
changed. Visual check on `/dev-wings`: 鴨鵝·pure now reads visibly thicker
than before while 雞·pure, 雞-lean, and generic are unchanged; legacy row
stays flat.

7 tests added/updated (a new nested describe for the goose dial, plus the
pure-鴨鵝 and one-sided-鴨鵝-mix assertions updated to account for it). tsc
clean; full suite 1388/1388.

(A follow-up tune 5, stacking the goose thickness dial another +20%, shipped
and was then reverted the same session — owner: "no visual difference" —
before this round started. Its net effect on `wingShape` is zero; not
re-listed here since nothing shipped from it.)

## G4 round 2, animation: 雞 flutters, 鴨鵝 glides — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, after settling the shape/thickness dials: "can we
turn animation for specific sides?" Ambiguous between left/right wing and
雞/鴨鵝 species — asked, owner confirmed 雞 vs 鴨鵝. Sonnet-tier: a motion
tune on an already-shipped gesture's existing animation term, not a new
visible surface.

Two new `WingShape` fields, `flapFreqMul` and `flapAmpMul`, feed the draw
site's existing per-frame flap term (`flap = t ? 0.13 * WS.flapAmpMul *
Math.sin(t * 0.0013 * WS.flapFreqMul) * (0.3 + a) : 0`) — previously a
single shared sine driving both wings identically regardless of diet.
Unlike the thickness/curvature dials, this is CONTINUOUS in `k` the same way
`lenMul`/`spreadMul`/`baseAng` already are, not a one-sided boost: flutter-
vs-glide is a spectrum property of the blend itself (the dev-wings copy
already describes it that way), not an extra add-on tacked onto one side.
雞 (k=+1): 1.6x frequency, 0.6x reach — quick, small flutter. 鴨鵝 (k=−1):
0.4x frequency, 1.4x reach — slow, wide glide. Both fall out of the same
NEUTRAL/legacy early-returns as every other field, so a being with no lived
sub.air or in legacy mode keeps the original single-frequency flap exactly.

This has ZERO effect on any snapshot render: `creatureSnapshotSvg` always
calls at `t = CREATURE_STILL_T = 0`, and the draw site's flap term is
`t ? ... : 0` — unconditionally zero at t=0 regardless of either new
multiplier. Confirmed via the same 11-fixture byte-identity sweep as every
prior round: all 22 legacy/metabolism cells identical, none excepted (the
first round in this series where NOTHING changes in a snapshot, by
construction, not just by accident). Only the live canvas (`TasteFormLive`,
which drives a real animation loop) can show the effect at all.

Attempted an empirical pixel-level check on `/dev-wings` (sampling total
canvas ink over ~15s and isolating each variant's motion by subtracting the
shared generic-cell baseline) but the signal was too confounded by other
t-driven motion (breathing, hair wind bend) sharing the same canvas to
cleanly isolate wing-only frequency — abandoned rather than reported as
proof it wasn't. Correctness instead rests on: the pure `wingShape` function
tested directly at both endpoints and for continuity (new nested describe,
4 tests), and a straight read of the one-line wiring showing both multipliers
flow from the same `WS` object already under test into the term both wing
sides consume.

4 tests added. tsc clean; full suite 1392/1392.

## G4 round 2, animation take 2: 雞 burst-pause, 鴨鵝 burst-glide rhythm — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, immediately after the freq/amp round above —
not a number this time, a described RHYTHM: "chicken should be flap flap
flap.....pause... then flap flap flap in loop" / "goose duck should be flap
flap.....flappppp.....gliding.....then flap......gliding.....then loop.
just try to tune, no need to verify your side given the noise and static
comparison. Just estimate the sequence and i verify for you on screen."
Explicit owner instruction to skip visual verification this round — an
earlier attempt to empirically confirm the previous round's plain
frequency-scaled sine via pixel sampling had already proven the signal too
noisy to isolate wing-only motion from shared body animation, which the
owner had directly observed too ("no visual difference").

A plain frequency/amplitude scale on ONE continuous sine cannot produce a
pause-then-burst rhythm — this SUPERSEDES the freq/amp round rather than
adding to it. `WingShape.flapFreqMul`/`flapAmpMul` are gone, replaced by a
single `speciesK` field (the raw blend, +1 pure 雞 … −1 pure 鴨鵝) that feeds
a new exported pure function, `wingFlapAngle(k, t)`, which owns the whole
waveform:

- **雞 — burst-pause**, 1600ms loop: a 700ms burst of ~4.5 quick beats
  (0.04 rad/ms), enveloped by `sin(πφ)` so nothing snaps to zero, then
  900ms held EXACTLY still (not slow — zero).
- **鴨鵝 — burst-glide**, 4200ms loop, two unequal flap-then-glide phases
  per the owner's asymmetric description: a 900ms ramp (~2.5 beats trailing
  into one longer stroke, flatter `sin(πφ)^0.6` envelope so the tail reads
  as held rather than clipped), a 1400ms glide (held extended, exactly
  zero), a 400ms single flap (~1 beat), a 1500ms glide (exactly zero).
- **k=0 (neutral/legacy)** — a continuous cross-fade using the SAME
  one-sided `chickenBoost`/`gooseBoost` ramps `wingShape`'s thickness dials
  already use, so at k=0 the function reduces to EXACTLY the original
  single sine, byte-for-byte unchanged from before this whole series —
  pinned by test, not just assumed.

Fixed one bug during implementation: the oscillation phase inside each
burst was initially keyed to raw `t`, so each loop iteration would look
subtly different (0.04 × 1600ms isn't a multiple of 2π) — caught by a
periodicity test I wrote to confirm the "then loop" framing, not by eye.
Reworked to key the oscillation off time-within-the-cycle instead, so
every pass is now identical, and the periodicity test passes exactly.

Per the owner's explicit instruction, skipped both the browser motion
verification and the screenshot-implies-correctness framing for the
RHYTHM itself — a static image cannot show a pause. What's still true and
was still done: `npx tsc --noEmit` clean, full suite (13 new/rewritten
wingFlapAngle tests covering exact stillness during every declared
pause/glide window, boundedness during every flap window, exact k=0
fallback to the untouched original sine, and exact periodicity per
species — 1396/1396 total), the 11-fixture byte-identity sweep (all 22
cells unchanged — this animation can never touch a snapshot, since
`creatureSnapshotSvg` always calls at `t=0` where the caller's flap term
is unconditionally `0` before `wingFlapAngle` is ever invoked), and one
static `/dev-wings` screenshot confirming the render itself didn't break.
Owner verifies the actual feel live.

13 tests (replacing the 4 flapFreqMul/flapAmpMul tests from the superseded
round). tsc clean; full suite 1396/1396.

## G4 round 2, animation take 3: 雞 bigger flap, 鴨鵝 glide sways instead of holding dead still — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, immediately after the burst-pause/burst-glide
round: "for chicken, the magnitude of flap larger" / "for duck / goose,
during gliding, there should be slow animation, not dead still." Two small
constant-level tunes on the same waveform, not a redesign.

`CHICKEN_AMP` 1.1 → 1.8 (no number given — a clearly-bigger first estimate
for the owner to react to, same "just estimate" latitude as the rhythm
round). `雞`'s pause is untouched — still exactly 0, since the ask was
about the burst's size, not the silence between bursts.

`鴨鵝`'s two glide windows, previously an exact `0`, now carry a gentle
full-cycle sway: `GOOSE_GLIDE_AMP * Math.sin(2π * φ)` where φ is position
within that glide's own duration (1400ms or 1500ms). A full sine cycle is
exactly 0 at both φ=0 and φ=1 by construction, so the sway always meets the
flap segments on either side at zero too — no snap at any of the four
segment boundaries, which was the main risk of touching this (the ramp/
flap2 envelopes already taper to 0 at their own edges; a naive glide sway
that didn't land on 0 at the same points would have reintroduced exactly
the discontinuity the burst-pause round's periodicity fix had just
eliminated). `GOOSE_GLIDE_AMP = 0.6`, well under `GOOSE_AMP = 1.4`, so the
sway reads as gentle drift, not a third flap.

Per the owner's standing instruction from the previous round, again skipped
browser motion verification — this is a magnitude/stillness tune, not a
new structural claim a screenshot could ever check anyway. What's still
true: `npx tsc --noEmit` clean, full suite (2 tests rewritten for the new
CHICKEN_AMP ceiling and to assert the burst is now actually bigger than the
pre-bump bound; the two "held EXACTLY still" 鴨鵝-glide assertions replaced
with a "nonzero but gentler than a full flap" sway check plus a new
explicit exact-zero check at all four segment boundaries — 1397/1397
total), and the 11-fixture byte-identity sweep (all 22 cells unchanged,
same as every prior animation round, for the same t=0 reason). Owner
verifies the actual feel live.

4 tests changed/added. tsc clean; full suite 1397/1397.

## G4 round 2, animation take 4: 雞 gets a lead flap at 2.5 before the burst — TESTING, explicit revert-if-not-good — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the wing bench, framed explicitly as a trial: "just one more for
testing, if not good revert back to this one — for chicken, before the
burst of flap, add a BIG flap with magnitude 2.5 at the beginning then the
burst with 1.8." The "revert back to this one" makes the prior commit
(`c8a63dd`) the named fallback if this variant doesn't read right.

Prepended as its OWN segment rather than folded into the existing burst —
`CHICKEN_BIG_FLAP` (250ms, one beat, `CHICKEN_BIG_AMP = 2.5`, its own
`sin(πφ)` envelope so it starts and ends at exactly 0 like every other
segment) now runs before the unchanged 700ms/1.8 burst and the unchanged
900ms pause. This extends `CHICKEN_PERIOD` 1600→1850ms (the burst and pause
durations were NOT shortened to make room — the ask was to ADD a flap, not
resize the existing rhythm). Sequence per loop: big lead flap → quick-beat
burst → held-still pause → repeat.

Verified: `npx tsc --noEmit` clean, full suite (window boundaries shifted
in the existing pause/burst tests to match the new segment offsets, one new
test asserting the lead flap is both nonzero-bounded at 2.5 AND actually
exceeds the burst's own peak — the entire point of this round — plus the
periodicity test's expected period updated 1600→1850; 鴨鵝 untouched and
unchecked beyond re-running — 1398/1398 total), and the 11-fixture
byte-identity sweep (all 22 cells unchanged, same t=0 gate as every prior
animation round). Per the owner's standing instruction, no browser motion
verification. If this reads wrong live, `git revert` this commit — it does
not touch `c8a63dd`'s glide-sway or magnitude changes, only 雞's segment
sequence.

6 tests changed/added. tsc clean; full suite 1398/1398.

## G4 round 3: 尾 tails — the one slot, Decision 6 wired — *(Fable)* — ✅ SHIPPED 2026-08-07
Model call stated per the tier rules: Fable — a new visible gesture family on
a live production being, the calibration class where claws burned six rounds;
BACKLOG tags every G4 round Fable-first. A true lab port (all five gestures
built in lab v7), and the first port that wires Decision 6's expression
ladder for real: this is the round the "vacancy → priority" rule stops being
prose and starts choosing pixels.

**The claim rules (`tailPlan`, pure, exported):** ONE tail slot, animal nodes
only. 魚 forks as the fish sub-node's FIRST portable part (fins are unported;
tendrils are the sea DOMAIN's gesture, not the fish's) — it claims at the
same bud floor a claw variant does (SUB_BUD 1.2). 軟體 cephalopod never
claims: its parts are tentacles. 牛/豬 run the owner's own vacancy example
verbatim: the species that does NOT hold the foot routes its expression to
the tail at the bud floor ("a pork-legged body … grows a cow TAIL"); the
foot-holder only buds a tail as a SECOND part. 甲殼/禽 are always second
parts — claws and wings express whenever those domains do at all. A second
part unlocks at evidence 12, exactly where stage() saturates: the first part
is fully grown, so further depth spends as breadth ("at 精, a second may
bud"). Contention: dominant claimant by evidence; exact ties by the
framework's fixed variants order (魚 甲殼 牛 豬 禽). Duels deliberately do
NOT enter — they resolve same-family dominance (feet, claw prime seats); the
tail contest is cross-family, where evidence is the only honest rank. Land
claims require legs to exist first (pool priority legs > tail). Legacy
returns null unconditionally.

**The stale-Ledger catch:** the 尾 row still said "魚 and 禽 need their
sub-nodes" — written before G3 shipped `sub.sea` and `sub.air`. All five
detectors exist; the row was updated in this commit (port checklist step 5).

**Geometry:** five gestures ported from lab v7, re-based per the checklist
onto the drawn silhouette — anchored at the lower-right flank (seat 2.35,
between the claw prime seat and the legs), base buried at 0.8 like a wrist
so the body fill covers the join, outward direction = the drawn-body ray
(BB centre → flank point), one anchor, no mirrored hand-rolled signs. The
rotation is computed in code, NOT via ctx.translate/rotate: the SVG
recorder's fail-loud proxy caught the first cut using canvas transforms
(exactly as designed — the two-renderer contract refusing to silently drop
a stroke), and teaching the recorder a transform stack would also mean
making ink measurement transform-aware; coordinates were the cheaper, safer
side of that trade.

**The owner's own creature grows the 魚 forked tail** — their real profile
carries fish 11.7, deeply lived with zero expression until now (fins
unported), pork holding the foot, shell/air below the depth-12 unlock. The
fish fork is that node's first part, at full size — pinned by a test shaped
like the live record.

Verification: 12 tailPlan tests (legacy null, no-claim nulls, both vacancy
directions, the second-part unlock, cross-family contention, tie order,
monotone sizing, the owner's-profile case); ink-bounds net extended with
fishtail (fork toward the corner) and oxtail (deepest-drooping gesture,
bottom-edge guard) — no crop at any size, both modes, owner's real profile
included; byte-identity sweep across 13 fixtures with the expected-diff set
enumerated BEFORE running (legacy 13/13 identical; metabolism diffs exactly
the nine tail-earning fixtures, the four non-qualifying ones identical) —
all 26 cells matched the prediction; /dev-tails bench (untracked) screenshot
verified all five variants + control + tail-free legacy row. 牛尾/豬尾 are
the strongest reads; 魚尾 modest (the sea body pinches at the tail seat);
甲殼尾/禽尾 legible but close to their neighbouring gestures — tuning
follow-ups expected, wing-round style. tsc clean; full suite 1410/1410.

## G4 round 3 correction: 魚尾 follows the owner's APPROVED trace, not the VOCAB specimen — *(Opus)* — ✅ SHIPPED 2026-08-07
Owner, immediately on seeing the round ship: "there should be fish tail
specifically designed and confirmed before." Correct, and I had missed it.

**The miss:** lab v7 holds TWO fish tails, and I ported the wrong one. PART 1
VOCAB is the parametric specimen library; PART 3 TRACES are traces of the
OWNER'S OWN seven sketches (2026-08-02, "trace them if you need to. I need to
know if you can do it"). The file header states the precedence outright —
TRACES are "calibration reference for exact proportions and style **the owner
already approved**", and the lab's own note says "if these pass, the gesture
library is refactored to THESE shapes". I read the porting checklist (which
lives above VOCAB) and ported VOCAB without checking whether an approved
trace existed for the same gesture. It did: 其二, "fish tail: one solid
two-fluke shape off the lower-right rim".

**What actually differed** — structural, not cosmetic:
| | VOCAB (shipped in error) | TRACES 其二 (approved) |
|---|---|---|
| structure | tapering peduncle, then two blades at its tip | NO stem — both flukes spring from one point |
| anchor | buried 0.80 inside the rim | 0.956 — essentially on the rim |
| aim | flukes straddle the outward ray | pair swung 0.473 rad off radial, trailing horizontally |

Measured off the trace rather than eyeballed (its body ellipse rx .21 / ry
.26, anchor .60/.70, flukes at −.10 and .66, L .115, w .030): anchor sits at
0.956 of the rim, flukes 0.489 × body radius, half-width 0.128, 0.760 rad
apart, bisector 0.473 rad off the outward ray. All four now in the code.
`TAIL_BURIAL` became per-variant for this: the other four gestures lead out
from their base with a stem, segments or a coil so 0.8 correctly hides the
join, but 魚's flukes ARE the gesture and burying them 20% deep swallowed
half the fork — 0.95 matches the trace and keeps the margin-inside-the-edge
rule the claws' WRIST_BURIAL already follows.

Two things checked and left alone: the seat was already right (2.35 gives an
outward ray of ~0.78 vs the trace's 0.753), and VOCAB's 牛尾 agrees
structurally with the approved 其一 cow tail (thin line, three-prong tuft),
so only 魚尾 was wrong.

**Fidelity honestly stated:** the fluke is 0.49·R by construction, matching
the trace's 0.489 — but R is the nominal size unit while the DRAWN body runs
~10% larger than R on this sea-heavy profile (the sea bump pushes the
silhouette out), so against the drawn body the fork measures ~0.445 rather
than 0.489 — about 9% short of the sketch. Left as-is rather than
over-fitted: every other gesture in the file sizes off R, the gap is
diet-dependent, and the structural fix is the substantive one. Flagged for
the owner's eye rather than silently compensated.

**Still unported from TRACES, flagged not fixed:** 其六 carries a third
approved tail — "THICK and smooth with an upturned tip (**first pass was a
wire**)" — two stacked taperQuads, .048→.030→.012, sagging then rising. That
parenthesis is an owner correction on record, and the general lesson (tails
are thick tapering FILLS, not strokes) applies to the 牛 whip and 豬 curl,
which are both strokes today. Not touched this round — one element per
round, and the owner asked about the fish.

Verification: 28-cell byte-identity sweep with the expected-diff set
enumerated first — exactly the two fish-tail-bearing fixtures moved, all
legacy frozen, the other eleven metabolism renders untouched; ink-bounds net
still clean; /dev-tails screenshot. tsc clean; full suite 1410/1410.

**Process lesson, carried into the next port (鰭 fins):** check PART 3 TRACES
for an approved version of a gesture BEFORE porting its PART 1 VOCAB entry.
Both exist for several gestures and the approved one wins. Added as step 0 of
the porting checklist in the lab v7 file header, where a porter will actually
read it (header commentary only — the rescued code below is untouched).

## G4 round 3 tune, take 2: 魚尾 burial 0.95→0.98 (position, not size) — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, same bench: "stick out the fish tail more." First attempt (this
session, reverted same session) scaled `FISH_TAIL_REACH` — the fluke's own
length and width — which grew the gesture rather than moving it. Owner:
"revert, you are making it larger, not repositioning." Correct read: "stick
out" means the base moves further from the body, the WRIST_BURIAL kind of
lever, not the gesture's own size.

`TAIL_BURIAL('fish')` 0.95→0.98 on the owner's own follow-up number ("try
0.98") — still short of the 1.0 hard ceiling the claws' WRIST_BURIAL logic
already established (a join with no body pixels behind it floats loose).
Fluke length/width are back to the trace-measured 0.49·R / 0.128·R exactly,
untouched by this round.

Verified: ink-bounds net (already carrying the fishtail fixture) confirms
no crop at any production size even with burial pushed to 0.98; 28-cell
byte-identity sweep — only the two fish-tail-bearing fixtures moved, all
legacy and every other variant untouched; /dev-tails screenshot shows the
fork sitting visibly lower and further out, base at the rim rather than the
flukes themselves growing. tsc clean; full suite 1410/1410 (no test changes
— burial is exercised by the existing ink-bounds/byte-identity coverage,
not a new assertion surface).

## G4 round 3 motion: 魚尾 flips like a fish tail — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on the tail bench: "maybe a little animation would help. Can you make
it flip like a fish tail?" Sonnet-tier: motion added to an already-shipped
gesture with a live reference on screen, same call as the wing flap rounds.

All five tail gestures already shared one generic sway (`0.055 rad @
0.0008/ms`) meant for a whip/curl/fan's gentle drift. 魚 now gets its own —
`0.32 rad @ 0.0032/ms`, roughly 6× the amplitude and 4× the frequency —
continuous rather than the wings' burst-pause, since a swimming tail strokes
steadily and doesn't rest between bursts the way a bird's wing does. The
other four gestures are untouched.

The one real risk with a bigger swing on a gesture already anchored near the
rim (burial 0.98, from the round above) is a live-canvas crop the static
ink-bounds net cannot see — `creatureInkBounds` always calls at `t=0`, and
the flip is entirely gated behind `t`, so every existing test (unit and
byte-identity) is blind to it by construction. Verified with a dedicated
sweep instead: `drawCreatureFrame` called directly across a full flip
period (41 samples), at every production size, on both the calibration
fixture and the owner's real profile — worst overflow measured 0.00px.
Followed by a live two-frame screenshot on `/dev-tails` confirming visible
motion between frames. Script was temporary, not committed.

tsc clean; full suite 1410/1410 (no test changes — the crop sweep isn't
unit-test material, it's a one-time verification the same way a screenshot
is).

## G4 round 3 tune: 魚尾 fork spread narrowed for more overlap — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, tail bench: "can we have the fork overlap each other more." The
trace's own 0.76 rad spread between the two flukes narrowed to 0.42, with
the bisector (−0.473 rad off the outward ray) held fixed — the pair still
trails the same direction, just tighter. Both flukes share one origin point
(the trace has no peduncle — see the round above), so a smaller spread
reads directly as more of their filled area crossing rather than needing a
separate overlap mechanism.

Re-verified everything the flip round's motion introduced, since this
gesture both narrows AND swings: the crop sweep (41 samples across a full
flip period, every production size, calibration fixture + owner's real
profile) — worst overflow 0.00px, same as before the spread change. Static
ink-bounds net and the 28-cell byte-identity sweep both clean (only the two
fish-tail fixtures moved). /dev-tails screenshot shows the flukes visibly
crossing near their tips rather than spreading cleanly apart. tsc clean;
full suite 1410/1410.

## 糙 rough skin: lower 3-dot cluster dropped for 甲+糙 only — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner: "For shell & fried rough skin. Take out the lower 3 dots (only for
this combination)." Confirmed visually first (throwaway `/dev-skin-check`
bench, not committed): 甲's tread bands run straight across the exact region
糙's lower-left 3-dot cluster occupies, and the two overlays fighting there
reads as noise, not texture. 甲/毛 left the 膚 precedence chain in the
method-only skin rearrangement and now compose freely with any skin, so this
is the first place two independent overlays actually collide in the same
region — not a bug in either one alone.

`DOTS` split into the upper-right 4 (always drawn) and the lower-left 3,
which now only push in when `!(isShell && isRough)`. 糙 alone still shows
all 7 (verified on the bench); 甲 alone is untouched (no dots to begin
with). No other skin/overlay pair is affected — this is a two-flag AND
gate, not a general "shell suppresses dots" rule.

No test coverage added: this skin/overlay layer has no existing unit tests
(SKIN_ROUGH/boneOverlay are exercised structurally, not pixel-by-pixel),
and the fix was verified the way the rest of this layer always has been —
rendered and looked at, on both sides of the combination. tsc clean; full
suite unaffected (confirmed by running tests/creatureForm.test.ts and
tests/inkBounds.test.ts in isolation — the full suite had unrelated,
pre-existing failures in the restaurant-picker files from a concurrent
edit in progress elsewhere in the tree, unrelated to this change).

## Restaurant attribution: honest blanks, and a list you can page (2026-08-07)

Field session on a Wan Chai dish, straight after the `radius_m` fix. Three
things the owner called, plus the bug that fell out of the third.

- **略過 CLEARS the restaurant; it does not mean "leave it".** Owner: "Better
  with blanks than a wrong restaurant attached. Maybe this is why it was kept
  as 美心皇宮." It was. In 食記 the picker was mounted with NO `onNone` handler
  and the dirty gate was `draftRestaurant !== null` — so 略過 set null, read as
  "nothing to save", and saved nothing. A dish attributed 1836m away could not
  be un-attributed from the very editor offering to fix it, and 住家菜 was
  equally inert (`{kind:'home'}` matched no branch of the PATCH body). Both now
  mean "no restaurant for this dish": `clear_restaurant` on
  `PATCH /api/my/dishes` nulls `restaurant_id`. The restaurant ROW is never
  touched — it may hold other people's dishes, and this edit speaks for one
  dish. Un-picking 略過 retracts the clear, so the tap stays a toggle.
  - Deliberately NOT decided here: whether 住家菜 in 食記 should also set
    `dishes.source = 'home'`. It clears the restaurant, which is what the chip
    visibly promises; changing `source` changes what the row MEANS and is the
    owner's call, not a rider on a bugfix.

- **"Next 10".** Ranking by distance is not sufficient in HK density: in Tsim
  Sha Tsui the tenth nearest restaurant was 21m away, so the shop actually
  wanted sat just outside a list whose every entry was within a block — and a
  forgotten name is exactly what browsing further is for. Places now asks for
  20 (its maximum; Nearby Search bills per REQUEST and the field mask picks the
  SKU, so the extra ten are free — the caution above `searchPlacesText` is about
  the pricier TEXT search and does not apply). The picker shows ten and reveals
  ten more per tap, with the remaining count on the chip. Collapsed state is
  byte-identical to the old behaviour, and a new location collapses again
  rather than inheriting the last one's expansion.

- **Type-then-pick stays.** Typing a name and choosing from real matches
  already worked and is confirmed good; paging is the complement for when you
  cannot remember the name at all.

- **Picker action buttons share one treatment.** 不是，是新的店 and + 更多資料
  were `btn ghost small` while 略過/住家菜 beside them were `chip chip-util`.
  Now all `chip chip-util`. `picker.uselivegeo` was left alone — not named, and
  it sits inside the add form rather than the chip row.

## G4 round 3 redesign: 甲殼尾 becomes a true 龍蝦 abdomen — *(Fable)* — ✅ SHIPPED 2026-08-07
Owner, after confirming what the fan means (the shell domain's second part,
not a species receipt): "Can we redesign so that it look much more like a
lobster tail? in this case, the whole lobster tail would replace the bottom
of the body, not diagonal, but vertically attached to the bottom part of
the body. Use your understanding of lobster anatomy and design sense, and
propose the look. It should be under the tentacle, covering nothing."
Fable per the tier rules — a redesigned visible gesture is a new-surface
first pass, not a numeric tune. No TRACES version exists for a crustacean
tail (checked per checklist step 0), so fresh design authority was granted
and taken.

The design, from lobster anatomy translated to cut-paper ink:
- **Five overlapping tergite segments** hung VERTICALLY from the drawn
  bottom point, each an ellipse plate narrower than the one above
  (half-widths 0.50R → 0.24R). One ink, no interior lines — the scalloped
  silhouette where each plate steps in IS the segmentation. The top plate
  is ~half the body's width and buried at 0.85 so the body fill swallows
  the join: the "replaces the bottom of the body" read.
- **The five-piece fan** at the tip — telson centre, two uropods per side —
  flaring WIDER than the last segment. The flare after the taper is the
  single most iconic lobster cue.
- **Axis is a stated design constant** (straight down, owner: "not
  diagonal"), not the computed outward ray — which at the bottom point sits
  within a few degrees of vertical anyway, so the checklist's
  direction-from-the-drawn-body rule is bent knowingly, not broken blindly.
  The shared gentle sway still pendulums it.
- **Z-order: the tail block moved to FIRST in the behind-body section** for
  all five variants — 尾 is now the deepest appendage layer, under
  tendrils, algae, legs and claws alike ("under the tentacle, covering
  nothing"). One uniform depth rule beats a per-variant special case.

Verification: tsc clean; both creature suites green; ink-bounds net (crab/
lobster fixtures carry deep shell at full tail size) confirms no crop at
any production size; 28-cell byte-identity sweep with the diff set
enumerated FIRST — every tail-bearing metabolism fixture moved (z-order
reorders the SVG stream for all variants, geometry changed for 甲殼), all
four no-tail fixtures and all 14 legacy renders untouched, 28/28 as
predicted. /dev-tails screenshot: the abdomen hangs centred under the crab
body, scalloped taper legible, fan flaring at the tip. Full suite
1421/1421 (the concurrent stream's picker work landed between runs; their
tests pass alongside).

## Shellfish 2.0: bands, banded abdomen, real fan, lowered claws — *(Fable)* — ✅ SHIPPED 2026-08-07
Owner, on approving the 龍蝦 abdomen ("Good : )"), five asks in one batch:
"add one more band on the body 2 > 3 · 甲殼尾 segmented abdomen, add extend
bands on the segments · revise the 5 piece fan at the tip to more like a
lobster tail tip · lower the position of the bottom claws · lower the
position of the upper claws as well, and have them move outward a bit from
the body (and / or rotate it a bit) so that the 2 jaws can be seen clearly."

The load-bearing discovery before writing anything: the 甲 bands and the
claw machinery render in LEGACY too, so every one of these had to be either
mode-gated or structurally metabolism-only —
- **Body bands 2 → 3**: `bFrom` gated on mode — metabolism restores grid
  slot 1; legacy keeps the shipped two-band cut byte-for-byte.
- **Abdomen bands**: each tergite junction wears the carapace's own
  dark-gap-plus-lit-edge pair, arced toward the fan so the line follows its
  plate. Tail-only, so metabolism-only by construction. (No thumbnail
  contrast ramp yet — the 甲 overlay's sm/dk ramps need `size`, which
  drawTail doesn't take; flagged for a later round if small renders wash.)
- **The fan, take 2**: five broad overlapping PADDLES (telson + two uropods
  per side) as rotated ellipses radiating from the hinge — same stacked-
  ellipse language as the tergites. First cut at ±0.62 rad merged into a
  single knob at bench size; outer pair swung to ±0.80 so the scallop
  notches between paddle tips survive, which is the whole fan read.
- **Claw seats**: new `CLAW_SEATS_META = [2.15, 1.45]` (from [1.95, 1.25],
  same 0.7 rad spacing so the calibrated overlap math still holds) used by
  every metabolism path including the undifferentiated fallback; legacy
  keeps `CLAW_SEATS` untouched, pinned by its existing exact-1.95 test.
  The draw site's second-seat detection was `seat !== CLAW_SEATS[0]` —
  wrong the moment metabolism got its own prime value; now matched against
  the second-seat positions explicitly.
- **Upper pair out + rotated**: `CRAB_SECOND_BURIAL` 0.94 → 0.98 (right at
  the 1.0 wrist ceiling) and a new `SECOND_SEAT_ANG = −0.26` swings the
  whole gesture toward the horizontal, mirrored per side — the gape clears
  the silhouette into open air. Both structurally metabolism-only: legacy
  never seats a second pair.

Verification: tsc clean; 141 creature tests green including a new pin on
the metabolism seats (2.15/1.45 + fallback) beside the untouched legacy
1.95 pin; ink-bounds net clean at every size with the moved claws and wider
fan; 28-cell byte-identity sweep with the diff set enumerated FIRST —
exactly the three shell-bearing fixtures (crab, lobster, ownerReal) moved,
metabolism only; all 14 legacy renders and every shell-less fixture
untouched, 28/28. /dev-tails screenshot: three carapace bands, banded
abdomen, scalloped fan, both claw pairs lower with the upper pair's jaws
in open air. Full suite 1422/1422 (concurrent picker stream's tests green
alongside).

## Shellfish 2.0, corrected: band position fix + claws further lower/out — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, on seeing the batch render: "when added the 3rd band on the body,
the original position of the 2 bands should not moved. Just add the 3rd
one below the 2 · move the 2 pairs of claws further lower to the body ·
move the upper claws further out of the body." One real bug plus two more
numeric pushes.

**The band bug**: the first attempt restored grid slot 1 (`bFrom: 1`) to
get a third band, which is wrong twice over — slot 1 sits ABOVE slot 2 in
the grid (smaller index = smaller y = closer to the crown), so it added the
new band on the wrong side entirely; and `upperNudge` only ever applies to
whichever band is `bFrom`, so moving `bFrom` from 2 to 1 silently transferred
band 2's own positional nudge onto band 1 — band 2 itself shifted up by
`upperNudge * h`, exactly the "original position... should not moved"
the owner caught. Fixed by decoupling start from extent: `bFrom` is 2 in
both modes now (bands 2/3 byte-identical to before this whole batch), and
metabolism alone raises the loop's UPPER bound by one slot (`bTo = nB + 1`),
adding a new band strictly below band 3 at the same fixed spacing `h`.

**Claws further**: `CLAW_SEATS_META` [2.15, 1.45] → [2.30, 1.60], another
+0.15 on both, spacing still exactly 0.7 (the calibrated overlap math).
`CRAB_SECOND_BURIAL` 0.98 → 1.0 — now sitting exactly at the documented
hard ceiling (the wrist crossing the silhouette edge exactly), as far out
as a wrist can go while a body pixel still backs the join.

Verification: tsc clean; 141 creature tests (the shellfish-2.0 seat test
updated to the new 2.30/1.60 values); ink-bounds net clean at every size
even with the wrist at the exact 1.0 ceiling; 28-cell byte-identity sweep
— crab/lobster/ownerReal moved (metabolism only), all 25 other cells and
every legacy render untouched, 28/28 as predicted. A large (600px)
throwaway bench (not committed) confirmed all three fixes by eye: three
bands with the original two unmoved, both claw pairs lower, and — on a
mixed crab/lobster diet where the second pair actually has size — the
upper claw's own gape now reads as clearly separate from the lower pair's,
rotated into open air. Full suite 1422/1422.

## Shellfish 2.0, round 3: third band touches the rim, tentacles clear the tail — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner: "the 3 band is too short with the left side not touching the rim of
the body so it doesn't look like a segment · move the tentacle a bit, away
from the tail so that they could be seen."

**Band rim fix**: `spanAt` used one symmetric radius, `(hi-lo)/2`, applied
to both sides of the tread equally. That assumes the silhouette is centred
on `BB.cx` at every height, which a lopsided palate's slice is not — near
the tail attachment (where the new third band sits) the gap is wide enough
to see. `spanAt` now returns `{l, r}` measured independently from `BB.cx`,
and `trace` applies each side its own reach.

**Tentacle clearance**: same floor-at-0.22 fix as tendrils, but a real
discovery en route — investigating why the `land` fixture (no shell, sea
evidence 3) showed an unexpected byte-diff turned up a wrong assumption in
last round's own comment. The `fr` formula's denominator, `max(1, (nT-1)/2)`,
clamps to 1 at `nT=2`, so the plain two-tendril case sits at `fr=±0.5`, NOT
the `±1` a quick read of the formula suggests — checked by an actual debug
print, not re-derived on paper. That means the floor moves EVERY tendril
count, not just the odd ones the original comment claimed were the only
risk. Comment corrected; behavior was already right, only the stated
reasoning was wrong.

**The regression this round almost shipped**: both fixes above operate on
helpers (`spanAt`/`trace`, the tendril offset) that LEGACY also calls —
`isShell` and `S.tendrils.on` aren't mode-gated blocks, only `bFrom`/`bTo`
were. The first pass left both fixes ungated, and the byte-identity sweep
caught legacy moving for `sea`, `crab`, `lobster`, `fishtail`, `ownerReal` —
a direct violation of "legacy is the frozen control," which every prior
round has held. Fixed by gating both explicitly: bands recombine `l+r` back
into the exact old symmetric radius for legacy before applying it
symmetrically (so legacy's two bands are pixel-identical to before this
whole helper existed), and tendrils fall back to the raw `fr * 0.8` for
legacy. Re-swept after gating: legacy 14/14 SAME; metabolism DIFF on
exactly the fixtures with sea and/or shell evidence (sea, crab, lobster,
land, fishtail, ownerReal) — all expected, all correct.

Also cleared: a `.next/types` staleness 404 from manually deleting a
throwaway dev route's generated types while the dev server was live —
process restart, not a code issue.

Verification: tsc clean; 141 creature tests; ink-bounds net clean; full
suite 1422/1422; byte-identity re-swept post-gating with legacy confirmed
100% frozen; /dev-skin-check (throwaway, not committed) confirmed the third
band now touches both rims and tendrils sit clear of a centred tail.

## Shellfish 2.0, round 4: third band derived from band 2, not re-measured — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner: "the 3rd band still doesn't look right with the right side not
touching the rim of the body now" (the LEFT side had been the complaint the
round before) — "Without moving position of the 1st band, add the 3rd band
exactly like the band 1 and band 2 but only shorter. if decrease the
spacings between them can do the job easier, do it."

The pattern across two rounds — left short, then right short on a
different palate — was the tell: independently re-measuring the silhouette
at the third band's own height isn't reading a real left/right bias, it's
reading an unreliable SCAN, down where the body outline sits close to the
tail attachment. No amount of correcting "which side" fixes an unreliable
measurement; the owner's instruction sidesteps it entirely.

**Reverted** `spanAt`/`trace` fully to the original single symmetric
radius — bands 1/2 now use EXACTLY the pre-shellfish-2.0 code path again,
byte-identical, no mode-gating needed since there's only one path.
**The third band no longer measures the silhouette at all**: it takes band
2's own already-measured span and multiplies by `THIRD_SHRINK = 0.62` —
geometrically guaranteed centred and shaped like bands 1/2 (same `trace()`
call, same `M` profile), impossible to read as off-rim on either side by
construction. `THIRD_GAP = 0.85` tightens the vertical step before it
(0.85h instead of a full h) per the owner's spacing offer, so the shrink
reads as a taper rather than an isolated shape.

Verification: tsc clean; 141 creature tests; ink-bounds clean; full suite
1422/1422; byte-identity sweep — legacy 14/14 SAME (confirming the full
revert), metabolism DIFF on exactly crab/lobster/ownerReal (the only
shell-bearing fixtures — tendrils untouched this round), 28/28 as
predicted; two-palate side-by-side throwaway bench (not committed)
confirmed the third band touches both rims on both palates, not just the
one that happened to read fine before.

## 糙 rough skin: dots no longer touch on oval bodies, darker grey — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner: "for hairy and fried rough skin only (or maybe with the oval shaped
body), the dots are touching each other, have them smaller so non would
touch each other" / "tune the color of the dots darker."

Reproduced first, without assuming the cause: built a hairy+rough fixture
AND a rough-alone (no fur) fixture side by side — both showed the same
touching dots, which ruled out "hairy" as the actual trigger and confirmed
the owner's own parenthetical guess instead. The real cause: `R0` (dot
radius) scaled only off `BB.hr`, while the cluster's vertical spacing
scales off `BB.vr` (each dot's `v` offset × `BB.vr`). On a wide/oval body
`BB.vr` shrinks faster than `BB.hr`, so the radius stayed full-size while
the vertical gaps between dots closed under it — a body-shape bug, not a
skin-combination one. Fixed by scaling `R0` off `Math.min(BB.hr, BB.vr)`
instead — identical to the old formula on a roughly round body (hr≈vr, the
common case), and shrinks correctly whichever axis is actually tight.

Grey darkened `#5a544c` → `#3b3731`, ~35% down in lightness, kept visibly
distinct from the black dot it overlaps rather than flattened into it.

Verification: tsc clean; 141 creature tests (one existing test's hardcoded
grey hex updated to match); ink-bounds clean; full suite 1422/1422;
byte-identity — a genuinely non-rough (steamed) fixture confirmed
byte-identical in both modes, isolating the change correctly to `isRough`
bodies only; every rough-skinned fixture in a five-fixture sweep changed as
expected. /dev-skin-check (throwaway, not committed) confirmed both fixes
side by side: dots no longer touch in the hairy+rough case AND the
fur-free comparison, color visibly darker in both.

## 牛尾 cow tail: shrunk 10% — *(Sonnet)* — ✅ SHIPPED 2026-08-07
Owner, tail bench: "for cow tail, shrink it by 40%", then before it shipped:
"revert, and shrink 10% instead." Since the 40% version was still
uncommitted when the correction landed, no `git revert` was needed — the
constant was simply changed in place.

New local scale `BEEF_SHRINK = 0.9`, applied on top of `sizeF` (`bf = f *
BEEF_SHRINK`) rather than folded into `sizeF` itself — the bud→full growth
ramp is untouched; only the fully-grown gesture reads smaller. Same pattern
as `FISH_TAIL_REACH`: scaled uniformly across the bezier stem AND the tuft
blades so proportions hold, not just length.

Verification note: neither of the sweep's existing named fixtures (`land`,
`oxtail`) actually resolves to a beef tail once checked against `tailPlan`
directly — `land`'s pork sub-evidence (5) clears the vacancy bud floor
before beef's own evidence does, and `oxtail`'s pork (14, holding the foot)
outranks beef (9) on raw evidence even though beef would render larger if
it won. Added a fixture matching the `/dev-tails` bench's own 牛尾 cell
(pork holds the foot, beef 6 claims vacancy) to actually exercise the
change. tsc clean; full suite 1422/1422; byte-identity — only that one
fixture's metabolism render moved, everything else including all legacy
untouched; /dev-tails screenshot confirmed the whip reads subtly smaller.
