# Dishi — Decisions & Done Log

Archive of shipped backlog items, moved out of `docs/BACKLOG.md` to keep that
file to open work only. Full original rationale/amendments preserved
verbatim — this is where "why we did it this way" lives once something's
done. If a done item needs to re-open (a real regression, not just "could be
better"), copy it back to BACKLOG.md with a note; don't edit history here.

Organized chronologically, oldest first, in the same batches BACKLOG.md
carried them in.

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
and a 某年某月某日 date in 食記. (Item 1 — picker + no-photo card UI polish,
Sonnet — still open in BACKLOG.md.)

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
