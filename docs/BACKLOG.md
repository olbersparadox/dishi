# Dishi Backlog

Single source of truth for OPEN work only. Triage/specs happen in the Claude
Project; execution happens in Claude Code. When an item ships: move its full
entry (rationale + amendments) into `docs/DECISIONS.md` with the commit hash,
don't just delete it — that file is where "why we did it this way" lives.
When a new item is decided anywhere: add it here and push.

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

- [ ] **[F] Persona rethink (老實派 / 食家腔 / 貪玩) — dedicated design session.**
  The in-card picker was REMOVED from the export card (2026-07-21): as a row of
  chips it wasn't doing anything a user could feel. Open design question: where
  and how does a persona actually interact with the user? If the character is
  only "alive" after export inside the user's own AI, the whole feature needs a
  dedicated session to design and build (voice in the exported prompt is already
  implemented — `persona.ts` voices + persistence are kept, default 'honest').
  Also open: the 貪玩 blurb "鬼馬、生動、港式抵死" is defined by its Cantonese
  cheek — 書面化 would be a rename/reframe, decide in the same session.
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

Done items, with full rationale and amendments, live in `docs/DECISIONS.md`.

---

# Backlog additions — 2026-07-20 (restaurant picker ×3 + HK menu shorthand)

Context: real field session at Tin Wan, 2026-07-20 ~13:49 HKT. 新容記 (well-known,
user was standing in it) absent from the picker chips; typing it and tapping 加入
produced no visible result; Vercel logs confirm `/api/dishes/pick` was never
called — the picks were lost. Same scan: 干炒牛河 shipped with a 飯 ingredient
chip and the literal English "Dry Fried Beef River"; a separate menu's 炆米 came
out as 炆飯.

(Items 3-4 of this batch shipped — see `docs/DECISIONS.md`.)

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

# Backlog additions — 2026-07-21 (Table Mode social: one surface, chops, echo)

Context: field session 18:41 HKT, two-person table R4E87. The joiner still
renders the PRE-redesign table layout (score rings, old cards) while the host
sees the new 你的最佳選擇 list — two products stapled together. Confirmed
design (Jerry): one shared surface; chop-first identity (photos later);
realtime pick stamps; companion data layer; 檯友回音 echo rider; guests
without accounts CAN stamp picks (friction kills tables) but generate no
companion edge / echo until sign-up — a deliberate conversion hook.

Strategic frame: two people picking at one table generates PAIRED dish-level
demand data no POS or QR vendor can see. Social is where the moat compounds.

**Build order:** 1 → 2 → 3 done (`2f5b39b`, `5ca23a0`, `4c0deed`, 2026-07-21,
signed-in members only — full rationale + amendments in `docs/DECISIONS.md`).
Then 4 → 5 (Fable 5). Item 5 must not start before 4's session/consent model
is merged. Photo avatars, companion compatibility scores, and any table-level
gamification are explicitly OUT of this batch.

---

## 3b. Guest (no-account) table participation — *(Fable 5)* — split out of item 3, 2026-07-21

Item 3's spec included "guests (no account) may stamp; their chop uses their
session handle... on sign-up mid-session, their stamps re-key to the new
account." Not built — deliberately, with the owner's sign-off before item 3
started.

**Why this is its own item, not a Sonnet afterthought:** this app has NO
anonymous-access path anywhere today. Every page is wrapped in `AuthGate`;
every API route does `supabase.auth.getUser()` and 401s without a real
session. "Guests may stamp" means designing, from scratch:
- how a guest's identity/handle is minted and where it lives for the
  duration of a table session (a cookie? an anonymous Supabase auth user?
  something table-session-scoped only?);
- what a guest is and isn't allowed to write under RLS — right now RLS
  assumes every writer is `auth.uid()`-backed;
- the re-key transaction on sign-up: a guest's existing stamps/picks need
  to move to their new real account without duplicating, orphaning, or
  losing anything, and without letting a malicious client claim someone
  else's guest stamps as their own.

That's a new auth surface with real security implications — the kind of
contract-touching, systemic decision that goes to the strongest model per
the standing model-tier convention (see CLAUDE.md's Model selection
section), not a UI side-effect of a stamps feature. Needs its own design
session before any code.

---

## 4. Companion edges (同檯 data layer) — *(Fable 5)*

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

---

## 5. 檯友回音 (Table Echo) — sealed mutual reveal — *(Fable 5, after item 4)*

The duel-class mechanic (standing directive: surface these when they fit —
this one hits all three criteria: fun, genuinely refines the engine,
near-zero new UI).

After the meal, every member who shared a picked dish gets the normal
rate-this-dish prompt — but for shared dishes, each verdict is SEALED until
all sharing members have rated (or a 48h timeout lapses), then reveals side
by side: 佢話超好味，你話麻麻地.

- Reuses `sealed_predictions` reveal UI wholesale; new seal type
  (`kind: 'echo'` or sibling table — implementer proposes, flags tradeoff).
- Engine value: two independent ratings of the SAME physical dish instance
  — the highest-density signal Dishi can collect; also begins separating
  dish-quality variance from taste variance (log it as such for the engine,
  even if not yet consumed).
- Sealing must be real: the other member's rating is not readable via any
  API before reveal conditions are met (RLS-enforced, not client-hidden —
  this is exactly the class of bug the sealed_predictions RLS incident
  taught us to test with dry-run queries).
- Timeout path: if only one member ever rates, their rating unseals to
  themselves normally at 48h; no nagging pushes.
- Quiet strategic note: echo teaches the seal mechanic through social use —
  capture reveal-open rates alongside the item-2 (version auto-seal)
  metrics for the deferred seal-education review.

**Tests:** RLS proof that an unrevealed echo rating is unreadable by the
counterpart; reveal on completion; timeout unseal; no echo for guest or
solo picks.

---

## 6. Joined members can add scan pages too, not just the host — *(Sonnet)* — raised 2026-07-21

Today only the host can grow a shared table's menu — and only from their own
`/scan` tab. A joined member can't contribute a page at all, structurally:
joining via a code drops you straight onto `/table`'s session view, which
has zero camera/scan capability (removed with the standalone landing screen,
see `docs/DECISIONS.md` item 1's correction). Real scenario this blocks:
someone else at the table is holding the drinks menu, or page 3 of a
multi-page menu, and has no way to add it without physically handing their
phone to the host.

Two genuinely separate pieces:
- **Authorization** — trivial. `PATCH /api/table/[code]` (the append
  endpoint built 2026-07-21) currently checks `session.host_id ===
  user.id`; swap for "is a `table_members` row for this session." The
  append itself is already safely concurrent (the underlying Postgres
  function row-locks the session for the append, so simultaneous
  contributors from different members serialize instead of racing) —
  built with multi-contributor use already in mind.
- **Entry point** — the real work. `/table`'s session view has nothing to
  extend; this needs a new "add a page" action reachable from there, which
  then has to drive the same scan → Stage-2 enrich → score → push pipeline
  `/scan`'s own append flow runs today, just triggered from a different
  screen with no pre-existing `result`/`tableSession` local state to build
  on.

**Open product question before building — needs owner's call:** should
*any* member be able to append freely once authorization opens up, or does
an unmoderated multi-contributor menu risk someone dropping in a wrong or
junk photo with no one positioned to catch it? Host-only was a deliberately
simple, safe default; opening it trades that safety for the realism of
"everyone can pitch in." Worth deciding the trust model before writing the
entry point, since it shapes whether "add a page" needs any confirmation
step or can just fire-and-merge like the host's own does.
