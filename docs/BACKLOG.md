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

(`scripts/seal-rows.json` — real eating data in a public repo: DECIDED and
cleared from HEAD 2026-07-26 (gitignored, untracked, `build-seal-fixture.ts`
rebuilds it from the DB). The history rewrite was considered and DECLINED —
the blob is not re-identifiable, a rewrite cannot un-publish it anyway, and it
would break every clone plus the Project re-sync. Full reasoning and the
conditions that would reverse it are in DECISIONS.md. Nothing remains open.)


(dishi — your AI palate (export redesign): §5 remainder SHIPPED `18761d7`
2026-07-24, closing the item — full entry moved to DECISIONS.md. Owner review
of the whole shipped feature is still deferred ("later"), outside code.)


(Seal reveal + band calibration batch, 2026-07-24 — ALL items shipped, full
entries in DECISIONS.md: reveal render fix `a2cbc9e`, every-seal-preserved +
`displayed_at` safety net `4a2ab8f`, band diagnosis `e79c822`/`0d851e0`,
contentScore divisor fix `e8ccb4e`. One remainder is OPEN, below.)

(The `dislike`-band remainder is CLOSED — per-user quantile banding `8432890`
reached it without fitting anything; full entry in DECISIONS.md.)

- [ ] **[F] `MIN_SCORED_DIMS = 10` is provisional.** The one fitted constant
  in contentScore, chosen on 36 seals from ONE palate; floors 8/9/10 differ by
  1-2pp on 113 within-cuisine pairs, which is within noise. Re-run
  `scripts/simulate-seal-bands.ts` once more than one person has sealed
  predictions and re-pick. Conservative today by design (no ranking
  regression), so this is a refinement, not a defect.

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

  **The decision needed:** whether to introduce a second, cross-venue dish
  concept (a canonical dish above the per-restaurant identity), and if so how
  it resolves — 乾炒牛河 is one dish nationally but the string appears with
  dozens of spellings and qualifiers. This is entity resolution at a harder
  altitude than the existing 3-gate pipeline, which had a restaurant's menu as
  its bounding context. Do NOT build from this line; it needs a design session.

## Ready to build — specs are decided, no open questions

(Carb-tripwire follow-up: honest vector re-score — SHIPPED 2026-07-22, see
DECISIONS.md.)

(佢哋整得點？ — the 1-10 execution slider: SHIPPED `575c153` (data + learning),
`15a9399` (UI on the 對決 chassis), `d0d689c` (tests), then `bc312bd`, `8b31fb1`,
`550c738`. Found still-open on a 2026-07-26 audit and closed — full spec, both
owner-confirmed extensions, and its superseded ancestor entry are in
DECISIONS.md.)

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
(A flick can't say "the dish is fine, this place cooked it badly" — SUPERSEDED
by the execution slider, which shipped 2026-07-26. Never built as a binary
question. Full entry, kept for the WHY, in DECISIONS.md.)

## Table Mode continuation — Fable-tier, in dependency order

- [ ] **[F] 3b. Guest (no-account) table participation** — new auth
  surface, needs its own design session first. Spec below.
- [ ] **[F] 5. 檯友回音 (Table Echo)** — item 4 (companion edges) SHIPPED
  2026-07-22 (see DECISIONS.md), so this is now unblocked. Spec below.

## Later / standing

- [ ] **Strategy: consumer scan density.** One dense neighborhood before
  expanding. Not a code item. **"No friend graph" STANDS — SETTLED
  2026-07-27.** This line was briefly reversed (2026-07-26, asymmetric follow
  + creator/audience) and the reversal is withdrawn. There is no social graph
  in Dishi: distribution is by TASTE-RANK (posts enter the same ranked pool as
  persona content) plus messenger share. A graph's only job was distribution,
  and both channels cover it without one. (An earlier version of this line
  called **bookmark → 待評** "the only mechanic that generates
  same-dish-different-restaurant pairs" — CORRECTED 2026-07-27, see the
  ordering note in the VISION section: that blockage is in dish identity
  resolution, not distribution.) The public page at `dishi.me/[username]` is
  unaffected and needs no graph. See DECISIONS.md decisions 2 and 4 under "Identity,
  connection, and export positioning", and the VISION entry at the end of this
  file.
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

---

# Batch: export positioning (2026-07-26)

## 1. Rewrite the export as TASTE-ONLY — *(Fable — the doc IS the surface)*

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

**Self-surfacing — test plan before it is designed into anything (owner,
2026-07-26).** The owner's export plan included "the AI appears by itself at
taste / food / trip-planning moments." Phase 0.5 §5 already measured why that
is the fragile half: hosts take the taste PAYLOAD and decline the standing
behavioural instruction. It is therefore **not a requirement**, and the copy
constraint above stands — do not promise it.

What would have to be measured before any design depends on it:

- Does a summoned-by-name doc ever surface unprompted in a LATER session on
  the same host, without being asked? Phase 0.5 tested fresh-session topical
  asks (neither host re-adopted the persona) but not longitudinal ambient
  behaviour inside an installed Project/Gem/GPT.
- Per host, separately — the payload/costume split was host-dependent, so a
  single pass proves nothing about the others.
- What the failure looks like to a user who was PROMISED it and doesn't get
  it. That, not the capability itself, is the reason the copy constraint is
  hard: an unkept ambient promise reads as the product being broken.

Until those exist, teach ONE summon path and treat ambient surfacing as an
unclaimed bonus.

---

# VISION — dishi.username: identity, connection, publishing — *needs Fable architecture review before ANY code*

Filed 2026-07-26. Until now this existed only in the owner's Claude Project
conversation and was recorded nowhere in the repo. **This is a vision entry,
not a spec:** nothing here is buildable as written, and the review that turns
it into specs has not happened.

**Settled inputs (do not re-litigate these in review)** — DECISIONS.md,
"Identity, connection, and export positioning": username at v1 unlock with
exactly ONE free rename ever (settled 2026-07-26 — no conditions, no milestone
schedule); **NO social graph — distribution is by taste-rank plus messenger
share (settled 2026-07-27, decision 2)**, so 貼文 is PUBLISHING and copy says
公開 never "friends"; the public taste page at `dishi.me/[username]` IS the
dossier, no third artifact, viewable without login, no eaten dates, companions
never, and the two hard rules (a dossier never enters the recipient's engine;
never visible during a rating flow).

## The sequencing test

Not generic product sense — the two recorded directions:
"Direction: what the taste engine is FOR" (2026-07-24) and "Direction:
comparison is the core product DNA" (2026-07-26). **Every mechanic below is
judged on whether it moves toward EXECUTION-level signal.** A mechanic that
only adds engagement does not qualify, however social it is.

## Ordering, corrected from the owner's original

- **bookmark → 待評 is valuable, but it is NOT what unblocks the execution
  slider — CORRECTED 2026-07-27.** The earlier version of this line claimed
  bookmark was "the only part of this vision that generates
  execution-comparison substrate," on the premise that a recommendation is how
  a person comes to eat 乾炒牛河 somewhere new. **That premise was invented in
  review, never verified, and is wrong** — 乾炒牛河 is on every corner in Hong
  Kong and nobody needs a guide to find it at a second restaurant. Repeat
  eating of common dishes across venues is a high base-rate behaviour that
  needs no mechanic at all.

  The "ZERO dish identities eaten at two restaurants" measurement was also
  misread as behavioural evidence. Re-measured 2026-07-27 on the same corpus
  (50 ratings, 20 restaurants, one tester, 7 days): **46 of 50 rated dishes
  carry NO `dish_identity_id`, and only 3 identity rows exist in the entire
  database.** The same dish eaten at ten restaurants would currently record as
  ten unrelated dishes. The slider's payoff is blocked at the IDENTITY layer,
  not the distribution layer.

  Bookmark keeps real value — it drives logging volume, biases toward dishes
  worth comparing, and produces dish-level demand signal. It is simply not the
  gate it was recorded as.

- **The username goes ahead of the train, deliberately (2026-07-26).** It
  earns its place alone because it retires the ask-for-name card in table
  entry and replaces the email-derived handle that was leaking address local
  parts onto chops — value that does not depend on sharing existing.
  **NOT shipped: backend only, uncommitted.** Schema (applied live),
  validation, `/api/username`, and the `/api/buddy` identity block are built;
  the UI is being redesigned to the owner's placement (inline `dishi.[box]`
  under the ink blob, not the modal that was first built). Nothing else below
  has started. See DECISIONS.md, "dishi.username — claim at v1 + one free
  rename".
- **The release train is post + bookmark + messenger share — there is no
  follow/invite in it (settled 2026-07-27).** Half-shipping still leaves the
  app incoherent: an identity with nothing to share, or sharing with no
  identity. But the train got smaller, not just reordered — no follow table,
  no accept flow, no invite-acceptance state to make "stick" through signup.
  A shared link lands on a public page that needs no relationship to work.

- **Personas-on-scan is DEMOTED** from the owner's original first position.
  The owner has since replaced LLM-on-demand with backend-precomputed daily
  content; the amendments below are binding on whatever it becomes.

- **食家 tier: PARK ENTIRELY.** Influence metrics are gameable, and elevating
  humans as advisors creates an incentive to rate for visibility rather than
  honestly — which corrupts the exact signal the engine rests on. It needs
  its own design session, well after everything else, and it needs a standing
  rule of its own analogous to "never sell placement or ranking influence."

## Daily persona content — amendments (owner + review)

- **Shared precomputed pool, ranked per user at read time with
  `contentScore`.** No LLM in the read path.
- **Ranking is what makes it Dishi.** Identical content for everyone is a
  magazine, and a magazine is where Dishi has no edge.
- **Every item gets a bookmark affordance**, or the feature is pure
  consumption and generates nothing.
- **Placement: 食記 or a home surface — NOT under table-order entry.** A
  person holding a menu is in a moment of intent; do not interrupt it with
  browsing content.
- **Sourcing must be Places-verified, never LLM-recalled venue names.**
  Phase 0.5 §6: a persona invented 滿福樓, 中華小館 and 豪隍點心茶居 with
  prices, in character, convincingly. Precomputing that batches the failure
  and ships it daily to everyone.
- **An unattended daily job needs a visible failure path** and a legitimate
  "no good picks today" state. Silence and stale content are both worse than
  an honest empty.

## One feed, three author types — the content surface (owner + review, 2026-07-26)

Resolves the open "personas move to menu scan or 食記?" question and folds it
together with user posts. **They are ONE surface, not two features that
happen to look alike.**

**The structure.** A second tab in 食記. One card type. The author is always a
`dishi.X` entity — the owner's own framing: *a persona is treated the same as
any other dishi user.* Three author types feed the same card:

1. **`dishi.persona`** (Spoon / CK / Kiki) — precomputed daily content, ranked
   per user. Available on day one.
2. **`dishi.<any user>`** — opt-in posts from any user, surfaced by taste-rank
   rather than by relationship (decision 2, settled 2026-07-27). NOT "friends"
   — there is no friend concept; a post reaches whoever the ranking matches.
3. **`dishi.<食家>`** — PARKED ENTIRELY (see the ordering note above:
   influence metrics are gameable). Slots into the same card with no new
   surface whenever it is eventually designed.

**Why one surface and not two.** Three things fall out of it:

- **Cold start.** With no social graph (decision 2), the feed's content comes
  from ranking, not relationships — and ranking still needs something to rank.
  Personas are what make it non-empty before enough users are posting. This is
  the strongest argument for the merge: not tidiness, but the only way the
  feed has content on day one.
- **One bookmark path.** Every card bookmarks into 待評 regardless of author,
  so a single affordance serves persona content, user posts, and 食家 content
  at once. Note the corrected claim above: bookmark drives logging volume and
  demand signal, but it is NOT the execution slider's missing input — that
  blockage is in dish identity resolution.
- **食家 needs no new build.** When the tier is eventually unparked it is a new
  author type, not a new screen.

**Placement is settled and menu scan is RULED OUT.** 食記, per the amendment
above: a person holding a menu is in a moment of intent, and browsing content
must not interrupt it. The owner's original plan placed this under table-order
entry; that is superseded.

**Every amendment in "Daily persona content" above is binding on this card** —
precomputed pool ranked per user with `contentScore` (no LLM in the read
path), bookmark affordance on every item, Places-verified sourcing only, and a
visible failure path with an honest empty state.

**Still open (needs the Fable architecture review this section's heading
requires, before any code):**

- The card's own anatomy — what a persona item shows vs what a user post
  shows, given they share one shape. User posts carry dish + restaurant +
  photo; persona items carry a pick with a reason. How much divergence the one
  card can absorb before it stops being one card.
- Whether the author line (`dishi.X`) is the primary identity on the card or a
  byline under the dish.
- **Ranking user posts is the load-bearing unknown.** `contentScore` ranks
  DISHES against a taste vector; it was never built to rank posts, and with no
  social graph the ranking IS the distribution — if it is weak, posts reach
  nobody and the bookmark loop never starts. Persona content can fall back to
  a curated pool; user posts cannot. This is the piece most likely to need
  real design rather than reuse.
- Bookmark counter as a like-equivalent (owner's plan) — whether a visible
  count is safe here, or whether it recreates the rate-for-visibility
  incentive that got the 食家 tier parked. Decision 2 accepts this risk
  explicitly; the review decides the affordance.
