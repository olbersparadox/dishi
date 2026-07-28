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

## The three streams — map, sync'd 2026-07-28 (Fable review)

Development runs as three streams. Named here because their items are NOT
independent — all three converge on one keystone:

1. **Engine** — calibration + R&D toward authentic taste learning.
   The canonical dish catalog (KEYSTONE) SHIPPED 2026-07-28 — see
   DECISIONS.md. NEXT: the DATA-acquisition move — recent R&D keeps
   returning "model fine, data too thin"; the solo corpus is now the
   binding constraint.
2. **dishi.name** — identity, attachment, sharing (taste-rank + messenger
   share; there is NO social graph, settled). Taste-only export SHIPPED
   2026-07-28. `dishi.me/[username]` SHIPPED 2026-07-28, and its placeholder
   is CLOSED the same day: 貼文 (per-dish opt-in), the 大家 feed tab and the
   dishi.persona daily job all shipped (`82fc26f`, `8299392`, `cd1aca2`) —
   anchors are now posts, and negative posts are publishable by owner call.
   See DECISIONS.md, "貼文 + 食記 feed + dishi.persona daily picks".
   **Messenger share SHIPPED 2026-07-28** (all six items — see DECISIONS.md,
   "Batch: sharing"): the link-only tier, the per-dish permalink with real OG
   cards, bookmark-as-signup, dish share from 食自己, and the Taste AI share
   swipe. `/i` is CLOSED by it. The stream-2 chain is now COMPLETE end to end:
   taste-only export ✅ → public page ✅ → posts / 食記 feed ✅ →
   messenger share ✅. NEXT for this stream is the recorded pool-starvation
   watch (below) plus the still-missing messenger brand assets. The [S] chop-wiring fix (independent of all of it) SHIPPED
   `1edcd19`, 2026-07-28. Two remainders carried into DECISIONS.md, not lost:
   personas' cold-start payoff no longer waits on owner-published menus —
   the EDITORIAL batch (2026-07-29, below) is the cold-start answer, with
   menus/picks growing alongside; and a POPULATED feed has no pixel proof
   until a second claimed user posts.
3. **UX/UI** — polish + the 書面化 register shift. No open corrections from
   the 2026-07-28 review.

**The keystone.** The canonical dish catalog serves all three streams: it
unblocks execution-level signal (stream 1's recorded aim), sharpens
taste-rank distribution (stream 2's only channel), and hosts the
decomposition veto. Sequence it first; nothing in streams 1–2 that depends
on cross-venue identity should be designed as if it might not exist.

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

## Cross-venue dish identity — DECIDED, moved

(The 2026-07-27 finding that the execution slider is structurally blocked —
dish identity is scoped to one restaurant — plus the Phase 0/Phase 1 R&D that
answered it: moved verbatim to DECISIONS.md, "Cross-venue dish identity: the
catalog approach — GO". The build lives below as the KEYSTONE item under
"Ready to build".)



## Ready to build — specs are decided, no open questions

(KEYSTONE — canonical dish catalog (cross-venue dish identity): SHIPPED
`80c0ff0` + `ea2d6be` + `493a314`, 2026-07-28, backfilled live — 61/70
resolved, first genuine cross-venue groups exist (sushi-platter ×5 across 3
venues). Full entry, the two build-time design corrections (category rule →
residue rule; veto exemption for string-anchored landings), and open
remainders moved to DECISIONS.md, "KEYSTONE build: canonical dish catalog —
SHIPPED". The Phase 2 menu-corpus eval and the eat-one-dish-at-3-4-shops
ground truth remain owner-side — both live in the data-acquisition item
under "Later / standing".)

(Persist `ingredients` on dishes — split out 2026-07-28: SHIPPED `8d12c50`,
see DECISIONS.md. Unblocks the parked protein/base affinity work whenever
it's designed — no longer waiting on its own column.)

(Retire the ask-for-name card for claimed users — the username's table
payoff, found unwired: SHIPPED `1edcd19`, 2026-07-28 — see DECISIONS.md.)

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
- [ ] **[F] Protein + base affinity map — PARKED PENDING DATA (2026-07-28).**
  Owner insight 2026-07-27: names decompose as
  `[key ingredient] + [method] + [base]` and preference is readable from the
  slots. R&D (`docs/rnd/dish-decomposition.md`): method IS already modelled
  (6 of the 18 dims) but starved by construction — a method dim fires once
  per dish while flavour dims fire on nearly all, so `fried` sits at 6
  ratings of evidence vs `rich` at 54; protein and base are modelled
  NOWHERE. Shape when unparked: a separate affinity map on the
  `cuisine_affinity` precedent, NOT new vector dims — the framing is
  comparative within a family ("beef over pork", "rice over noodles"), a
  like-rate, and ~10 sparse one-fire-per-dish dims would dilute the vector.
  Parked because 51 ratings over ~6 proteins / ~9 methods / ~6 bases leaves
  every cell in single digits — the R&D answer is "cannot tell", not "no
  effect"; needs several hundred ratings. The [S] persist-`ingredients`
  item under "Ready to build" is its prerequisite and is NOT parked.
- [ ] **[Owner] Data acquisition is the binding constraint on engine R&D —
  named 2026-07-28 review.** Recent R&D keeps concluding "model fine, data
  too thin": decomposition Section A unanswerable, `MIN_SCORED_DIMS`
  provisional on one palate, method dims starved. Further modelling has
  diminishing returns until data grows. Three cheap moves, all owner-side:
  (1) eat one common dish at 3–4 shops and log each — the first cross-venue
  ground truth, composes with the catalog; (2) menu photos into
  `scripts/menu-corpus/` for the Phase 2 eval; (3) the dense-neighborhood
  scan push above — still a strategy line with no operational plan; it
  needs one. After the catalog ships, the next engine block should be a
  data move, not another model refinement.
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

## 1b. `/i` intent-landing route — ❌ CLOSED 2026-07-28, unbuilt

Closed by its own stated condition ("if nothing claims it by the time the
share chain ships, close it") at the sharing design session — the share
batch needs no separate landing route, and its CONTRACT (unauth → login →
return with intent preserved, nothing commits on tap) is honoured by that
batch's bookmark-as-signup item instead. Original spec kept below for the
WHY; do not build from it.



Receives `do=cook|trip|hunt|ate&dish=<n>` from persona-issued links. v1
minimal: authenticated landing, shows what the persona wants to record
("Spoon 想幫你記低：{dish} — 加入去搵清單？"), explicit confirm creates the
entry, nothing commits on tap (contract already promised in the struck
LINK_RITUAL text). Unauth → login → return with intent preserved. When it
ships, DO NOT resurrect LINK_RITUAL: the taste-only rewrite (2026-07-28)
removed the house-rules assembly entirely — the const is deleted and the
taste-only contract test pins persona machinery OUT of the doc. This item's
original consumer (persona-issued links) no longer exists; before building,
it needs re-justification against the surfaces that remain (messenger share,
the public page, QR entry). If nothing claims it by the time the share chain
ships, close it.

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

## 1. Rewrite the export as TASTE-ONLY — ✅ SHIPPED 2026-07-28

(Full entry, verbatim, in DECISIONS.md under this batch heading — "Taste-only
export shipped". The doc now carries the palate alone, headed by the claimed
dishi.username; the carousel became the install-identity surface; the persona
apparatus is out of the export path, with the voices intact in persona.ts for
their in-app home. Item 4 of the Phase 0.5 batch — the owner's ChatGPT
custom-GPT re-test — stays open, now against the taste-only doc.)

The self-surfacing test plan below remains OPEN and binding on future design.

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
  **SHIPPED 2026-07-27/28** (`09fcb8f`, refinements through `ac9df3b`):
  schema live, validation, `/api/username`, `/api/buddy` identity block, the
  inline claim under the ink blob, the rename sheet, the claim counted as
  chance 1. **But the table payoff was found unwired (2026-07-28 review):**
  the ask-for-name card still fires for claimed users — see the [S] wiring
  item under "Ready to build". Nothing else below has started. See
  DECISIONS.md, "dishi.username — claim at v1 + one free rename".
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

*(2026-07-29: the sourcing amendment below is RE-SCOPED — not weakened — by
the editorial batch near the end of this file: §6 bans fabricated VENUES;
dish-level editorial with no venue claim is outside its blast radius. The
venue rule itself survives verbatim.)*

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

## One feed, three author types — ✅ SHIPPED 2026-07-28

(Full entry moved verbatim to DECISIONS.md, "貼文 + 食記 feed + dishi.persona
daily picks" — with the architecture review that preceded it, the negative-post
reversal, the consent correction on persona sourcing, and the two open
remainders. 食家 stays PARKED and needs no new surface when it unparks.)

## One feed, three author types — the shipped spec, kept for the WHY (owner + review, 2026-07-26)

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
- Persona voice is CONTENT, not UI chrome (guard added 2026-07-28): when
  Spoon/CK/Kiki move in-app as 食記 authors, the 書面化 register pass must
  not flatten their voices — Kiki is deliberately Cantonese-forward. A copy
  sweep that treats persona lines as UI copy would sand them down.


# Batch: dishi.persona editorial — columnists in 大家食 (owner design session, 2026-07-29)

**The owner's ask, verbatim in substance:** Spoon / CK / Kiki must be ALIVE in
大家食 — both to fill the feed initially and to lead by example, showing future
users how to write creatively about food. Posts are precomputed, written in
each persona's own voice, from mixed sources. Full cadence is minimum
1/persona/day — but NOT yet: the product is still in development, so this
ships as SAMPLES first, with the daily automation designed and documented but
switched off. The feed stays chronological (the 2026-07-28 interim stands).

## Settled inputs (owner, 2026-07-29 — do not re-litigate)

- **Personas are COLUMNISTS, not reviewers.** They write about DISHES (the
  world's canon, trends, technique); users write about MEALS they actually
  ate. That contrast is the "lead by example": personas model how to talk
  about food, users answer with where they ate it. A persona never claims a
  verdict on a specific venue's execution.
- **The §6 guard is re-scoped, not weakened.** Phase 0.5 §6's measured failure
  was FABRICATED VENUES with prices — actionable claims a person could walk
  into. A dish-level editorial post makes no actionable claim; there is
  nothing to walk into and nothing to pay. The surviving hard rule: **if a
  post names a venue it is a real, Places-verified one, and prices are never
  invented.** Most editorial posts name no venue at all.
- **Mixed sources, all of them in play** (the owner explicitly wants the full
  mix, not one channel — see the source ladder below).
- **Every post needs a real food shot** with rights we can actually use.
  AI-generated food photos are REJECTED outright — synthetic food in a
  taste-authenticity app poisons the brand.
- **Review is IN-FEED, not a separate page.** Generated posts land `pending`,
  visible only to the editor (profiles.is_persona_editor), rendered in the
  real card with approve/discard. Reviewing the exact pixels users will see
  is the point; an admin list would hide photo crop, line length, and voice
  in context. Scales unchanged to the daily pipeline (cron writes pending).
- **No LLM in the read path — binding amendment holds.** Voice is written at
  PRECOMPUTE, per the carve-out personaDaily.ts always reserved, behind the
  grounding validator (below).

## Source ladder (in order of reliability; mix freely)

1. **Wikimedia Commons + Wikipedia — the backbone.** Every famous dish on
   earth: facts (origin, ingredients, method) + CC/PD photos. Attribution
   recorded per image and rendered as a discreet credit. Volume sustains
   3/day for years without repeats. Legally boring, structurally stable.
2. **Owner drop folder — the topper, never an obligation.** Owner drops a
   photo + one fact line when they feel like it; pipeline persona-izes.
   Zero rights questions, real HK material, and it is literally the owner
   seeding the creative culture users should imitate.
3. **Social as SIGNAL, never as ASSET.** Crawl/monitor for WHICH dish people
   are talking about (Google Trends, Reddit API, food-press RSS — stable,
   ToS-clean); the photo and facts then come from licensed pools (source 1).
   Never scrape platform photos (each is someone's copyright) and never
   build brittle scrapers against IG/Threads/小紅書.
4. **Later, for venue-pointed HK posts:** Google Places photos (licensed for
   display alongside place data) — the legal photo path the day a persona
   points at a real HK venue.

## Beats — each persona OWNS one (editorial identity, not a hash)

- **Spoon — 世界慾望誌.** The world's dishes worth slowing down for; senses
  first, verdict second, origin as seduction. Backbone source.
- **CK — 簡單做啱咗.** The humble-dish canon done correctly; technique wisdom
  as observation, the decorated version damned with faint praise.
- **Kiki — 講緊乜.** The trend beat — the ONLY one wired to social signal.
  Her hard rule already polices it: no hype without receipts, where a receipt
  is a NAMED source ("Reddit 條 thread 爆咗"), never an invented count.
  Recency claims ("this week") only when the signal is actually fresh —
  sample posts use timeless phrasing.

Three beats also de-risk supply: if trend listening proves flaky, Spoon and
CK run forever on the licensed backbone and the feed never starves.

## The grounding validator (contract, enforced in code + tests)

A voiced line is REJECTED unless every factual token traces to its grounding
pack: no digits or currency not present in the pack, no Latin proper nouns
outside the pack's vocabulary, no venue/price patterns at all. Register rules
ride along: CK zero emoji; Kiki 2–4; Spoon no exclamation clusters. Lives in
`src/lib/personaEditorial.ts` with vitest coverage. Hand-authored sample
lines pass through the SAME validator — the contract holds regardless of who
(or what) wrote the text.

## Cadence + pipeline (designed now, switched on later)

- Full cadence: **1/persona/day (3/day total)**, staggered so the feed reads
  as people, not a batch job — Kiki morning, CK lunch, Spoon night. A dish
  name never repeats within 90 days.
- **Decouple writing from posting:** harvest + voice in monthly batches
  (LLM at precompute, validator-gated, images re-hosted to Supabase storage
  with attribution); the daily cron only flips queued rows live at stagger
  times. No LLM in the daily path — an API outage cannot empty the feed.
  Queue-depth + failure visibility reuse persona_runs.
- The existing persona_items daily-picks job (real posted dishes) KEEPS
  running alongside — editorial fills the feed; picks surface real
  community material as it grows.

## Items

1. **Schema + validator + in-feed review + 6 samples — ✅ SHIPPED 2026-07-29**
   (`1827108`, `6bc679c` — full entry moved to DECISIONS.md, "dishi.persona
   editorial", including the live-verified publish flow and what was left
   pending for the owner's own review pass.)
2. **Daily automation — LATER, owner flips it on when the product stage is
   ready.** Harvest script (Commons category walk + trend signal), LLM voice
   pass behind the validator, cron publish at stagger times. Do NOT build
   until the owner asks; the design above is the spec.
3. **Open, owner decision someday, not blocking:** whether persona authorship
   carries a quiet disclosure marker (on the persona's profile surface, not
   on every card).

# Batch: sharing — messenger share + per-dish links — ✅ SHIPPED 2026-07-28

All six items shipped (`d9f26b7`, `ee619ed`, `810f776`, `8a3ffbc`, `3515ba4`,
`98492e9`, `a5f8f09`). Full entry — the settled inputs, the recorded
pool-starvation risk, and the three build-time corrections — moved verbatim to
DECISIONS.md under the same heading.

The messenger brand marks are IN (`public/msg-logos/*.svg`, official glyphs
extracted from simple-icons, no runtime dep) — the earlier "assets still
absent" follow-up is closed. Corrections applied on owner review, recorded
here because each was a real defect and not a preference: the row had shipped
as a text label instead of the agreed four marks; the identity line was
re-labelling itself per panel instead of staying fixed; and the dots' touch
targets overlapped, so tapping back to panel 1 silently did nothing.
