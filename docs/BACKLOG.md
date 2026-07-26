# Dishi Backlog

Single source of truth for OPEN work only. Triage/specs happen in the Claude
Project; execution happens in Claude Code. When an item ships: move its full
entry (rationale + amendments) into `docs/DECISIONS.md` with the commit hash,
don't just delete it — that file is where "why we did it this way" lives.
When a new item is decided anywhere: add it here and push.

Model tier per item: **[S]** = Sonnet (well-specified build) · **[F]** = Fable/Opus
(design decisions, entity resolution, diagnosis).

Audited 2026-07-22 against git history + live code (four items found
falsely open and archived: OTP login, 語言對 fixes, seal at pick time,
bilingual ingredients — see DECISIONS.md).

## Now — in progress

(Self-calibrating rating scale + seal percentile bands — SHIPPED `d8115f5`,
`8432890`, pushed 2026-07-26 — see DECISIONS.md.)

- [ ] **[owner decision, IN PROGRESS elsewhere] `scripts/seal-rows.json` is
  real eating data in a PUBLIC repo.** Committed in `0d851e0` before this was
  considered. Scores, cuisines and attribute vectors — no names, restaurants,
  dates or user ids, but still a real person's meals. `scripts/rating-history.json`
  was gitignored for this reason. Decide: leave it, or strip it from the repo
  (history rewrite) and make `simulate-seal-bands.ts` rebuild it like the other
  fixture does.
  **2026-07-26: owner is already working this in a separate session, blocked
  on a Fable build slot.** Don't duplicate — check for a resolving commit
  before picking this up.


(dishi — your AI palate (export redesign): §5 remainder SHIPPED `18761d7`
2026-07-24, closing the item — full entry moved to DECISIONS.md. Owner review
of the whole shipped feature is still deferred ("later"), outside code.)


(Seal reveal + band calibration batch, 2026-07-24 — ALL items shipped, full
entries in DECISIONS.md: reveal render fix `a2cbc9e`, every-seal-preserved +
`displayed_at` safety net `4a2ab8f`, band diagnosis `e79c822`/`0d851e0`,
contentScore divisor fix `e8ccb4e`. One remainder is OPEN, below.)

- [ ] **[F] Seal `dislike` band is still unreachable.** The divisor fix
  unlocked `love` (0/11 → 3/11 called) but `dislike` remains 0/2. There are
  only TWO real dislikes in the entire dataset, so there is nothing honest to
  tune against — fitting a band edge to two points is overfitting, not
  calibration. Needs more negative ratings before it can be worked on; do not
  "fix" it by fitting. See docs/rnd/seal-band-calibration.md §9c.
- [ ] **[F] `MIN_SCORED_DIMS = 10` is provisional.** The one fitted constant
  in contentScore, chosen on 36 seals from ONE palate; floors 8/9/10 differ by
  1-2pp on 113 within-cuisine pairs, which is within noise. Re-run
  `scripts/simulate-seal-bands.ts` once more than one person has sealed
  predictions and re-pick. Conservative today by design (no ranking
  regression), so this is a refinement, not a defect.

## Ready to build — specs are decided, no open questions

(Carb-tripwire follow-up: honest vector re-score — SHIPPED 2026-07-22, see
DECISIONS.md.)

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
  - *(extension, flag to owner)* flick clearly above neutral → slider 5-10, by
    the same logic in reverse. The owner specified only the negative bound;
    this mirrors it rather than leaving "loved it, cooked terribly" reachable.
  - otherwise → full 1-10

  **3. When it appears** — either condition:
  - the flick is clearly off the person's neutral (same trigger as the old
    spec: `calibratedScore` beyond ±0.20, after a 10-rating warm-up — both
    constants measured, see git history for "badly-cooked" commit), OR
  - the dish identity already has a rated instance, so a comparison exists.

    *(extension, flag to owner)*: the old spec was NEGATIVES ONLY. That cannot
    stand here — a comparison needs the good instance too, or 乾炒牛河 at B=8
    never gets recorded and A=2 compares against nothing. Broadened
    deliberately.

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

## Needs an owner decision before any code

(dishi.Persona — character persistence in foreign AIs: install flow SHIPPED
`1f5198c` 2026-07-23, closing the item — full entry moved to DECISIONS.md.
Only the owner's manual Phase 0.5 persistence re-test remains, outside code.)
- [ ] **[F] 食記 ordering for album logs.** Old camera-roll photos have a fuzzy
  eaten-date; decide: order journal by when-eaten vs when-logged, and how to
  capture an approximate eaten-date at log time without adding friction.
  Design conversation first — do not build straight from this line.
(Diet taxonomy growth — DECIDED + SHIPPED 2026-07-23: tree_nut + structural-only
soy added (13 → 15), gluten deliberately rejected. See DECISIONS.md.)
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

## Table Mode continuation — Fable-tier, in dependency order

- [ ] **[F] 3b. Guest (no-account) table participation** — new auth
  surface, needs its own design session first. Spec below.
- [ ] **[F] 5. 檯友回音 (Table Echo)** — item 4 (companion edges) SHIPPED
  2026-07-22 (see DECISIONS.md), so this is now unblocked. Spec below.

## Log entry redesign — three paths by what you're holding

Confirmed design (Jerry), 2026-07-22: replaces 餐廳菜/住家菜/相簿舊菜 with
📷 食物相 / ✎ 打字 / 🧾 外賣單 — organized by what the user is HOLDING, not how
they classify the meal.

Items 1 and 3 shipped 2026-07-22, then were ROLLED BACK the same day on
owner feedback — see DECISIONS.md for both the original build and the
rollback writeup. The entry pill is back to 餐廳菜/住家菜/相簿舊菜 (old copy
restored verbatim). Items 2 and 4 are blocked again pending item 1's
redesign.

- [ ] **[S] 1. IA change: chips, copy, icons, explanation card — REOPENED.**
  Owner feedback on the shipped version: the new pill's raw styling didn't
  match the rest of the app's polish. Needs a design pass before rebuilding
  — not a re-land of the same implementation. Original spec still in
  DECISIONS.md for reference; icons (`PencilIcon`/`TakeawayIcon`) already
  exist in `icons.tsx` if reused.
- [ ] **[F] 2. 食物相: merged photo path with inferred context.** Blocked on
  item 1. Spec below.
- [ ] **[S] 3. 打字: typed quick add — REOPENED.** Owner-reported, live:
  tapping 而家評 hung indefinitely at "AI 認緊呢道菜…" (enrich-before-rating
  never resolved for the user, despite resolving in ~15-25s during build-time
  verification — needs real diagnosis, not just a longer timeout: check
  whether the enrich call actually completes server-side, add a client-side
  timeout/fallback so a slow or stuck enrich can't strand the person on a
  blank screen); the overlay's raw ad hoc styling (plain `<h3>`/inputs on
  `.rate-sheet`/`.card`) didn't match the app. Code is PRESERVED, unmounted,
  for the retry: `TypedQuickAdd.tsx`, `RatingStack`'s `typed` mode,
  `RestaurantPicker`'s `{kind:'home'}` addition, `typedQuickAdd.ts` (body
  builder) — still have passing tests. Don't just re-enable the old UI —
  diagnose the hang first.
  (The predictive dish-name suggestion piece — `GET /api/dishes/suggest` +
  `dishSuggest.ts` — SHIPPED 2026-07-22 into a DIFFERENT, already-working
  surface instead: the rename editor in `TasteGrowth.tsx`. See DECISIONS.md.
  It's live in the app now; only the 打字 entry point above is still open.)
- [ ] **[F] 4. 外賣單: delivery screencap path.** Blocked on item 1. Spec
  below.

## Later / standing

- [ ] **Strategy: consumer scan density.** One dense neighborhood before
  expanding; no friend graph at this stage. Not a code item.
- Brainstormed, NOT confirmed (do not build): weekly recap card · web push
  re-entry triggers · revisit prompt ("would you order it again?") · 地雷
  dealbreaker probe · 排個名 restaurant mini-ranking · tempt-duel at scan time ·
  cold-start popularity ranking for profileless users · reverse taste import.

Done items, with full rationale and amendments, live in `docs/DECISIONS.md`.

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

**Build order:** 1 → 2 → 3 → 6 → 4 done (`2f5b39b`, `5ca23a0`, `4c0deed`,
2026-07-21; items 6 and 4, 2026-07-22 — full rationale + amendments in
`docs/DECISIONS.md`). Item 5 (檯友回音) is now unblocked. Photo avatars,
companion compatibility scores, and any table-level gamification are
explicitly OUT of this batch.

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

(Items 1 and 3 shipped 2026-07-22 — full spec + implementation notes moved
to DECISIONS.md.)

---

## 2. 食物相: merged photo path with inferred context — *(Fable 5)*

The merge lives or dies on ONE rule: context becomes INFERRED, never a
form. After photo selection the app guesses from EXIF timestamp + location
+ photo content and surfaces a single one-tap confirm row, guess
preselected:

  喺邊食㗎？  [大爺燒鵝?]  [屋企]  [第二度]

- Fresh photo + coords near a known restaurant → that restaurant
  preselected (nearby machinery + Text Search from the picker work).
- No coords / indoor-home signals → 屋企 preselected.
- EXIF age past threshold → old-photo treatment automatically: fuzzy
  eaten-date UI, NO restaurant guess asserted (per the standing camera-roll
  item), 第二度 opens the picker.
- Proceeding without touching the row accepts the guess. If implementation
  finds itself adding a second required question, STOP — the old chips were
  better than a form; surface the problem instead.

**Rating flow: unchanged.** The existing photo rating moment is the
reference experience; this item only changes how context attaches.

**Tests:** inference matrix (fresh+located / fresh+unlocated / old EXIF);
one-tap acceptance path; old-photo fuzzy-date trigger; source flags.

---

## 4. 外賣單: delivery screencap path — *(Fable 5)*

Scope: the IN-THE-MOMENT chip (food just arrived, screenshot the order,
2–3 dishes enter as blank cards). The mass history-import remains a
SEPARATE cold-start moment (previous discussion) and is not this item.

**Pipeline:** screenshot → vision extraction (new prompt variant on the
scan pipeline: itemized order lines, quantities ignored, platform chrome
ignored, restaurant name string captured) → one blank card per dish →
restaurant auto-attach: resolve the extracted restaurant string via Places
Text Search with location bias; attach on high-confidence match with a
one-tap confirm chip, else fall to the picker. Order date, if visible on
screen, becomes the eaten-date (editable); else now.

**Rating flow: instruction interstitial (per Jerry), then the capped
stack.** After import, ONE screen states plainly what happened and what
happens next — proposed copy:

  入咗 {n} 味菜。而家評唔評都得 —
  評一味，口味 AI 就準一步。
  [評住先]  [遲啲先]

遲啲先 exits cleanly; the dishes sit in 待評 with NO badge, no counter
nagging. 評住先 opens the existing rating stack capped at ~5 per session
(session-shaped, not backlog-shaped). HK menu-shorthand glossary applies to
extraction (delivery listings use the same metonyms).

**Tests:** extraction fixture (foodpanda + Keeta screenshot layouts, zh +
en); restaurant auto-attach confidence gating; date capture; cap
enforcement; no-badge assertion.

---

Items 1 and 3 (Sonnet — the IA + the floor) shipped 2026-07-22, old chips
removed in that PR — see DECISIONS.md. Remaining: 2 → 4 (Fable 5); each
path's verification includes screenshots of the real flow before "done".

---

# Backlog additions — 2026-07-23 (pick-flow field session fixes)

(Both items shipped — item 2 `6ad7237`, item 1 `662358f`, both 2026-07-23.
Full entries moved to DECISIONS.md.)

---

# Backlog additions — 2026-07-24 (field session fixes)

(Item 1d shipped `46e4d4f`, 2026-07-24. Full entry moved to DECISIONS.md.)

---

# Batch: dishi.Persona Phase 0.5 field-test fixes (2026-07-24)

Context: owner installed Spoon on all three hosts per the app's own install
instructions, fresh containers. Gemini Gem: full character adoption, all house
rules held (handshake w/ real anchor, location-conflict one-line ask, link
ritual grammar, 收聲 scoping, same-session restore). Claude Project (Haiku
4.5): no adoption. Custom GPT: taste FACTS retrieved, zero behavior — the
knowledge-slot signature. Working hypothesis: Gems have one paste target
(instructions); Claude Projects and GPTs split instructions vs knowledge, and
the doc landed in knowledge, which RAGs facts but doesn't steer behavior.

(Items 1a, 2, 3 — LINK_RITUAL strike, INSTALL_HOSTS paste-target precision,
VENUE_GROUNDING + chime no-restatement — SHIPPED `fc4c454` 2026-07-24, full
entries in DECISIONS.md. Open below: the `/i` route + the owner re-test.)

## 1b. `/i` intent-landing route — *(Fable — new surface, first pass)*

Receives `do=cook|trip|hunt|ate&dish=<n>` from persona-issued links. v1
minimal: authenticated landing, shows what the persona wants to record
("Spoon 想幫你記低：{dish} — 加入去搵清單？"), explicit confirm creates the
entry, nothing commits on tap (contract already promised in the struck
LINK_RITUAL text). Unauth → login → return with intent preserved. When it
ships, re-add LINK_RITUAL to the house-rules assembly in
`src/lib/tasteExport.ts` (the strike comment marks the exact spot; the
house-rules test pins the absence and will fail until inverted back) and
re-test on a live host.

## 4. Owner re-test (manual, no code — listed for tracking)

After the expanded Phase 0.5 deploy (provenance preamble + consent framing +
paste-as-text copy). **Two confounds have polluted every Claude test so far —
remove BOTH:**

- **Paste as TEXT, never a file attachment.** The failing probe went in as a
  TXT attachment, which routes through document-scanning (where the injection
  check fired); Phase 0's passing tests were pasted text. The install copy now
  says this, but the manual re-test must actually follow it.
- **Use a Claude account with no Dishi history** (or a temporary/incognito
  chat). On the founder account the host reads the doc as "the export you're
  designing" and reviews it as an artifact instead of receiving it as a user's
  palate — this skewed three consecutive tests.

Matrix, Sonnet-class or above: {Claude Project instructions field,
in-conversation paste} × {pasted as text}. Probe: chime format, arrival
handshake, one house rule (收聲), one taste-anchored rec. Verdict decides
whether the provenance/placement hypothesis closes Phase 0.5 or a per-host
redesign item opens. Record either way in
`docs/rnd/persona-phase0-results.md`.

---

# Batch: Table Mode two-account field-test fixes (2026-07-24)

(Items 1-minimum, 2, 3 — shared-session re-author sync + namefix on /table's
addPage, name_original pick keys both views, chop color = f(user_id) with
per-set de-collision — SHIPPED `ab99aff` + `a0c517c` 2026-07-24, full entries
in DECISIONS.md. Open below: the item-1 root fix.)

## 1-root. Shared session as single source of truth for a scan-shared menu — *(Fable)*

Design intent from the batch spec: once a tableSession exists, the shared
session's items ARE the menu, and the scanner's local view READS from it
(the 5s glance poll already fetches the full state) instead of holding a
divergent copy that has to be re-synced after every re-author pass. Deferred
because the divergence is structural, not cosmetic: the scanner's local
items carry per-scanner personal fields (match/reason/fire/raw_score — the
whole incremental streaming/scoring render) that the shared items
deliberately never store (shapeTableMenuItems strips them as misleading for
the group), so "read from shared" means splitting every scan item into a
shared-truth half (names/chips/attributes, owned by the session) and a
personal half (scoring, owned by the scanner) and merging them per render —
a real refactor of scan/page.tsx's result state, not a data swap. The
shipped minimum fix (reauthor PATCH after the stages settle, one shared
mergeFinalScanItems builder for all three sync paths) makes divergence
self-healing rather than permanent; this item removes the copy entirely so
nothing CAN diverge between passes. When it lands, the reauthor sync in
scan/page.tsx's performScan shrinks to the append case (or goes entirely,
if append also reads back from the session).
