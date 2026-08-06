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

- [ ] **[F] 未食 hypothetical duels (menu-preference probes) — proposed
  2026-07-29, ~60% go.** The comparison family's first BEYOND-RATINGS member
  (owner invited: anything that sharpens taste definition may live in the
  interactions feed). A duel over two CATALOG dishes the person has NOT
  eaten — "邊樣你會點？" — on the same chassis. Supply becomes effectively
  infinite (144 entries × pairs) and selection can target exactly the dims
  the profile is thinnest on, which real eating can't be steered toward.
  The open engine question that gates it: a hypothetical pick is WEAKER
  evidence than an eaten experience, so it needs its own (lower) learning
  weight and probably its own evidence channel — sizing that weight is an
  R&D pass, not a constant to guess. Decide: run that R&D next, or wait
  until the real-rating interaction loop has bedded in?
- [ ] **[F] Aversion probes (內臟/生食/辣度 tolerance) — proposed 2026-07-29,
  ~45% go.** Direct dish-photo questions ("呢啲食唔食？") filling the
  aversion side the AI export needs most (negative-rating data ceiling is a
  recorded gotcha — aversions barely appear in eaten-and-rated data because
  people don't order what they avoid). Must be designed to not feel like a
  survey; below the bar until that design exists.

  **Amendment (owner, 2026-08-01, from the first Claude install cell):** both
  items above gain a selection principle and live evidence. The owner, reading
  the install-cell replies, disputed the rendered dislikes ("I honestly don't
  hate sweet — seafood is freshness kind of sweet") and supplied the case that
  proves the mechanism: the lobster roll miss was EXECUTION, not preference —
  ordered out of longing for the best-rated-worthy one he had in Japan, sunk by
  a sour-dressing/mayo rendition — and the export doc's flat miss-list then
  caused the host to steer him AWAY from the register ("your lobster roll
  rating suggests that register isn't where you get your money's worth", P5 EN,
  plan doc). One misfiled rating produced confidently wrong advice inside the
  flagship surface. Owner's directive: "if there's anything unsure or any
  direct signal from user would help us understand more, we could post it out
  as question. We don't always need to use their own ratings for the
  interactions." Two consequences for these items: (1) selection should be
  CONTRADICTION-DRIVEN, not just thinness-driven — the engine's most valuable
  questions are where its evidence internally conflicts (loved list full of
  鮮甜 seafood vs a sweet-aversion read; a missed dish from a loved family) —
  a detected contradiction is a ready-made, non-survey-feeling question with
  known payoff; (2) add an execution-disambiguation probe to the family: a
  one-off miss on a dish the person sought out is ambiguous between "dish" and
  "rendition", the shipped execution slider only resolves it after a SECOND
  rating of the same dish elsewhere, and an elicited answer resolves it
  immediately. (Note the superseded flick-level binary in DECISIONS.md before
  designing this — it must not regress into that.) Raises the effective go
  odds of both items; still needs the owner's explicit go before any code.

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

(6. 大話骰 — the third way to settle: SHIPPED `d40f454` + `ee1d16d`, 2026-07-31.
Server-held dice behind one viewForUser gate, the turn engine on the existing
poll, the screens inside TableSettle's own chassis, and the handoff's redesign
of the bill. Both of the handoff's open questions closed. Full entry, with the
four binding owner decisions, in DECISIONS.md.)

## Later / standing

(Comparison frequency batch — unresolved-bet duel gate, /api/interactions/today
feed, journal 今日 cards + bell hosting, execution inbox: SHIPPED `062aa16` +
`bf12477`, 2026-07-29 — see DECISIONS.md "Comparison frequency". Two watches
remain open below.)

- [ ] **[F] 冠軍 group champion — data-gated (decided 2026-07-29).** N-way
  "邊間係你嘅冠軍?" over a canonical group's rated instances, on the duel
  chassis. Trigger: 2–3 canonical groups reach >= 3 RATED instances (today
  only sushi-platter). One group makes it a gimmick; the moment should feel
  earned. Design pass then build.
- [ ] **[F] DUEL_K recalibration watch.** All 4 answered duels sealed at
  p≈0.50–0.52 and ALL went the predicted way — a hint the model is
  UNDER-confident (K=2 under-scales the content-score gap). n=4 proves
  nothing. Once ~30+ duel outcomes exist, fit K to observed hit rates
  (predicted_p vs reality) and re-check the p<0.65 band edge with it.

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
**→ ABSORBED 2026-07-29 into palate-export Phase 1** (batch at end of file;
plan + results table in `docs/rnd/palate-export-phase1-plan.md`). The two
confounds below remain binding on every Phase 1 run — they are protocol now,
not history.

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

**Scope narrowed 2026-07-30** (see DECISIONS.md, "the scanner was on a
lookalike"): the PICK half of this divergence is gone. Picks, stamps, realtime
and pick/unpick now live in one shared engine (`src/lib/useTableSession.ts`)
that both screens mount, so the scanner no longer holds a private copy of who
picked what. What remains open is exactly the hard part this item was always
about: `result.items` itself, i.e. splitting each scan item into a shared-truth
half (names/chips/attributes) and a personal half (match/reason/fire/raw_score)
so the list can read from the session. The chassis is the place that merge
belongs when someone takes it on.

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
ride along: CK zero emoji; Kiki 2–4; Spoon no exclamation clusters.
**Amendment 2026-07-29 (owner voice pass):** em-dashes (「——」/「—」) are
banned outright, all personas, both languages — three voices sharing one
pivot habit collapse into one author. Each persona pivots with punctuation
it owns: Spoon a full stop and a short sentence, CK a colon or a dry second
clause, Kiki an emoji beat. Voice length: long enough to carry character
(the first samples were too short to be anyone); the beats section is the
differentiation contract — Spoon dwells inside the eating, CK tells you
what the dish proves about kitchens, Kiki receipts-verdict-tip. Lives in
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

# Batch: palate-export Phase 1 — the loop, measured (owner directive 2026-07-29)

The full plan (aim, settled evidence, H1–H4, probe script, go bar, revision
levers) lives in `docs/rnd/palate-export-phase1-plan.md` — that file is the
spec AND the results log; read it before touching the export. The aim in one
line: **taste learned in Dishi shows up in the user's own AI, and that AI
sends them back to Dishi to keep rating.** No persona (closed); the dishi
mention/reminder is load-bearing flywheel, bounded by HARD_LIMITS.

## Items

1. **R1 instruction rewrite — ✅ SHIPPED 2026-07-29.** Two-jobs aim line,
   the "dishi" call-out cue (addresses a doc in context — NOT the struck
   bare-name summon), place-mention added to the rate trigger. Pinned in
   tasteExport tests.
2. **Phase 1 runs — OWNER-RUN, manual.** The probe script per host ×
   placement cell; results appended to the plan doc's table. Absorbs the old
   export-batch item 4 (ChatGPT custom GPT retest) as one H1a cell.
3. **R2–R4 revision levers — gated on results.** One lever per version; no
   code until a run asks for it.

# Batch: 埋單 table endgame — fun reasons to order together (owner ideas session, 2026-07-29)

**The owner's ask:** easy, fun mechanics for a group picking dishes together
after a menu scan — equal split, random pick, casual multiplayer, loser pays —
explicitly scoped small ("nothing too much to lose our focus"), the point
being MORE day-1 reasons to open table order, for traction and stickiness.

**Why the bill moment is the right wedge:** every group meal ends with the
same ten seconds — 邊個俾錢？點分？— and today that moment belongs to a
calculator app or awkwardness. If dishi owns it, table order gets opened at
the END of meals too, not just the start, and the person who opens it is
showing dishi to the whole table. It is the cheapest recurring multi-person
moment in the product.

**Hard scope guards (do not drift):**
- dishi NEVER moves money. It declares outcomes (who pays / who owes what);
  settling is Payme/FPS/cash, outside the app. No payment integrations, no
  balances carried between meals, no debt ledger. The moment it stores "A
  owes B", it is a payments product with a social graph — both off-strategy.
- No new social surface: everything lives inside the existing table session
  (same members, same lifecycle). Companion edges already record who was
  there; these mechanics ADD no relationship data beyond what picks record.
- Vermillion stays reserved: the seal stamp is the one place these games may
  use it (and 抽印 does, legitimately — it IS a seal).

## The menu — smallest first (each independently shippable)

1. **均分 (equal split) — the utility floor, zero game.** The table session
   already knows the picked dishes and their menu prices: one footer line on
   the table surface — total, 加一 service toggle, ÷ headcount, per-head
   figure rounded UP to the dollar (the HK convention; remainder note shown
   so nobody thinks it lied). No design questions worth a session; ships as
   a Sonnet-tier edit ONLY because it is a line on an existing surface — any
   richer treatment makes it a new surface and re-tiers to Fable.

2. **抽印 (the seal draw) — random pick / loser pays, dishi-native.** One
   tap: every member's name on screen, the vermillion 印 stamps DOWN on one
   of them — 今餐佢請 (or the softer default: 佢負責埋單收錢). One stamp
   animation, server-side draw (crypto-random, all members equal weight,
   result recorded in the session so re-taps can't reroll). Guests
   participate (they have session membership; no account needed to lose).
   This is the "casual multiplayer" ask satisfied in ONE interaction —
   ten seconds of theatre, zero rules to learn, screenshots itself.

3. **賭邊碟最正 (back-a-dish) — the strategic one: the bet that manufactures
   ratings.** At pick time (or any time before rating), each member secretly
   backs ONE picked dish as the table's eventual favourite. Backs are SEALED
   (the honesty contract pattern — server-side, RLS-locked, the client may
   only know a back exists). After the meal, members rate as normal; when
   all backers' shared dishes are rated (or the Echo 48h timeout — same
   clock, same rules), reveal: the dish with the table's highest mean wins,
   whoever backed it eats free / everyone else splits their share (table
   decides the stake up front — bragging rights is a valid stake and the
   copy's default).
   - **Why this one matters beyond fun:** it gives every member a REASON to
     rate at the table (no rating, no reveal — the same lever the sealed
     bet already proved solo), and it is comparison-DNA (backing = predicting
     the table's comparative verdict). It composes with 檯友回音: same
     sealed-reveal machinery, same timeout, reveal screens can stack.
   - Build AFTER Echo (item 5 above) — it reuses Echo's reveal conditions
     wholesale; building it first would mean building Echo's plumbing under
     a different name.

## Sequencing + tiers

均分 (1) any time, tiny. 抽印 (2) next — new visible surface, Fable first
pass, but small. 賭邊碟最正 (3) after 檯友回音 ships. Items 2 and 3 need an
owner GO on copy register (how playful is 今餐佢請 allowed to be) before
build; item 1 needs no decision.

# Batch: onboarding — the album-first cold start (owner design session, 2026-07-29)

(SHIPPED `c359ddc` 2026-08-01 — full entry, the owner's four decision-closes,
and the shipped shape moved to DECISIONS.md under this heading. Owner field
pass with a real fresh account still pending. ONE remainder open:)

- [ ] **[F] Walkthrough replay entry point.** Owner call at build kickoff:
  "we will find a place to show it again; decide later." The sheet is
  currently once-per-user (per-device seen flag); no 設定 entry exists. Decide
  where re-viewing lives when it matters.

---

# Batch: attribution & naming accuracy — the EXIF-first UX (owner design session, 2026-08-01)

**The thesis (owner):** the most user-friendly rating path is EXIF-from-photos,
because it rides on existing behaviour — shoot the dish, forget it, rate later
from the couch. The one flaw is dish-name accuracy. Menu-scanning at the
restaurant is the OPPOSITE: it breaks normal behaviour, so it must pay for
itself in utility (translation, ingredients, table order, bill games), and its
restaurant attribution must cost the user nothing, because nobody but the
founder will ever type a restaurant name.

**The flywheel these four items form:** menu scans build per-restaurant dish
vocabularies (`dish_identities`, per-restaurant, authority-laddered) → those
vocabularies make EXIF album naming accurate → accurate naming makes
dishes-first / attribute-later viable → micro-confirmations clean residual
errors, and every new scan retro-cleans its restaurant's history. The flywheel
only spins with scan density — one more reason for the one-dense-neighborhood
strategy.

## ⚠️ Batch-wide constraint: DO NOT DESTABILIZE THE BASE (owner, 2026-08-01, binding)

The owner's exact worry, recorded as a rule: "I keep finding bugs to fix and I
really don't want to screw things up by building more. This UX is crucial — it
just needs NOT to ruin the good stuff we spent so much time on."

Every item in this batch is therefore bound by:

- **Additive-only.** New signals may FILL blanks and OFFER confirmations; no
  item may change what an existing working path does when the new signal is
  absent, low-confidence, or errors out. Absent signal ⇒ byte-identical
  behaviour to today, enforced by a test per item.
- **Fail closed, silently.** A cross-reference miss, a vision-match miss, or a
  Places hiccup produces today's behaviour, never an error state the user sees.
- **One item per session, shipped and field-verified before the next starts.**
  No batch-implementing. Each lands with its own tests + screenshots + a real
  field pass by the owner before the next item is touched.
- **The authority ladder is load-bearing.** Items 3 and 4 write names; every
  write goes through `nameAuthority()` upgrade-only semantics. A constrained
  vision match adopts an identity (VISION-tier dish adopting a MENU-tier name),
  never edits one; nothing here may ever touch `name_edited_at`.
- **Kill criteria are pre-agreed.** Each item names its rollback condition
  below. If it fires, the item reverts to backlog rather than being patched
  forward in place.

## (item 1 shipped 2026-08-01 — full entry moved to DECISIONS.md, same batch heading)

## 2. iOS EXIF device test — 10 minutes, no code, gates item 4's design *(owner, manual — PARTIAL RESULTS 2026-08-02)*

Verify on the owner's phone which photo paths preserve GPS EXIF by the time the
server sees the file: (a) picked from camera roll, (b) captured live through the
in-app file input. Belief to check: roll picks keep location (with permission),
live captures on iOS Safari get GPS stripped. Record the result HERE. If live
captures carry no GPS, at-table photo slots cannot self-attribute and item 4's
cluster backfill (one member's fix covers the session) becomes the design, not
an optimization.

**Results (owner field run, 2026-08-02, Central Market):**
- **B1 — library pick, Safari: GPS SURVIVES.** Rated 1h+ later at home; the
  place row seeded from the restaurant's location, not the owner's.
- **B3 — library pick, home-screen standalone: GPS SURVIVES** (same as B1).
- **B2 — in-app live capture: INVALID AS RUN, and unanswerable on that path.**
  The photo went into a to-rate PICK's photo slot, which (a) shows the session's
  fixed restaurant and never runs the nearby guess (pickPlaceContext, by
  design), and (b) never reads EXIF at all — addPickPhoto normalizes first
  (canvas re-encode strips metadata) and /api/dishes/photo stores only the URL.
  The at-table photo SLOT therefore cannot self-attribute REGARDLESS of what
  iOS does — item 4's cluster backfill is the design for slot photos, settled.
  What B2 still has to answer is the narrower question: does an in-app 拍照
  capture through the LOG PILL (the album flow, where readPhotoMeta reads the
  original file) carry GPS? **Retest:** log-pill 拍照 at any restaurant with
  location on, rate immediately (fine — dishes.lat/lng is written from EXIF
  only, never from the live-GPS fallback), then open that dish in 食記 →
  轉餐廳: 「📍這張相片拍攝地點附近」= survived; 「這張相片沒有位置」= stripped.
- Test A same session: gate correctly refused to auto-set (real place 一起食堂
  is on neither Places nor Dishi); the confirm chip misfired on a distant
  namesake → fixed same day, see item 1's amendment in DECISIONS.md.

## 3. Identity-constrained vision naming — match before guessing *(Fable; R&D, above the ~50% bar only where a menu exists)*

`inferDish` (src/lib/vision.ts) is context-blind today: photo bytes only. When
EXIF/GPS yields restaurant candidates, fetch their `dish_identities` and give
vision the shortlist: match against the known menu FIRST, open-guess only on
no-match. A match adopts the identity and its menu-authority name (the menu's
own words, not a paraphrase). Two independent layers:

- **3a (cheap, do first):** pass locale context ("taken in Kwai Fong, Hong
  Kong") even with no menu — activates regional dish vocabulary. Measure on the
  owner's own album backlog before judging.
- **Field evidence (owner, 2026-08-02, first real session):** the exact miss
  this item exists for, end to end. The owner scanned 一起食堂's menu (KE7KK,
  和風牛肉烏龍麵 among the items), then photographed that very dish; the album
  flow's vision guessed 豚骨拉麵/"pork ramen" from pixels alone, and the owner
  had to type the correct name BY COPYING IT OFF THE MENU THEY HAD ALREADY
  SCANNED an hour earlier. The right name sat in the DB; EXIF placed the photo
  ~100m from the scan's coords within ~2h; nothing joined them. Two design
  constraints this run adds: (1) the shortlist source can't be only the
  restaurant's identities — the restaurant may not exist yet (一起食堂 didn't);
  RECENT NEARBY SCAN SESSIONS (coords + recency window on table_sessions'
  menu_items) must be a shortlist source too. (2) Match on the zh name — the
  menu's verbatim truth — not the English: the same menu paired 和風牛肉烏龍麵
  with "Pork Belly Noodles" (loose printed English or a scan mistranslation;
  unverified which), so menu English is not reliable as a match key.
- **3b (the real one):** the constrained match. Success probability high
  (~75%+) where the restaurant has identities, unchanged accuracy where it
  doesn't — the ceiling grows with scan density by design. Never blocks: the
  identity fetch rides the existing enrich round-trip, and a fetch failure
  degrades to today's context-free call.
- **MEASURED 2026-08-02** (`scripts/eval-vision-naming.ts`, 54-case album
  backlog, live model — full readout in `docs/rnd/vision-naming-context.md`):
  **3a is closed** (paired +2/−0 of 26, both regressions were judge noise —
  no standalone ship, fold the locale line into 3b's context for free) and
  **3b is a GO** — 5/5 completed adoptions where the truth was on the
  shortlist, including 和風牛肉烏龍麵 itself adopted EXACT past four
  adversarial 烏龍麵 neighbours, and 8/10 correct refusals where it wasn't.
  One genuine kill-class event in the eval (土魷蒸肉餅 adopted a neighbour
  menu's 冬菇馬蹄蒸肉餅), so v1 keeps adoption on the existing edit
  affordances and the kill criterion below stays armed. Wiring plan (next
  session): scan coords onto `table_sessions`, shortlist fetch before
  `inferDish` in `/api/dishes` (absent ⇒ byte-identical, test-enforced),
  server-side verbatim-zh adoption taking both languages from the menu item.

- **BUILT 2026-08-02, awaiting the owner's field pass** (the batch rule's last
  gate — moves to DECISIONS.md once that passes). `nameShortlist.ts` (pure,
  17 tests) + `nameShortlistFetch.ts` (time-boxed, fails closed) +
  `visionUserText()` in vision.ts; `table_sessions` gained `scan_lat/lng` and
  `dishes` gained `name_from_menu_at`
  (`supabase/applied/table_sessions_scan_coords.sql`, applied live).
  Verified end-to-end against the LIVE db and the REAL field photo: with the
  scan located, the shortlist returns 30 items, and the same photo that reads
  牛肉烏冬/豚骨拉麵 context-blind comes back 和風牛肉烏龍麵 and adopts it.
  - **Two deviations from the plan above, both deliberate, both toward
    caution.** (1) **No auto-linking of `dish_identity_id`** — dishIdentity.ts
    is explicit that the human is the only merge author in the system (gate 3),
    and a wrong merge permanently fuses two dishes' rating histories, whereas a
    wrong NAME costs one tap. Adopting the name alone delivers everything the
    field miss asked for. (2) **Only the zh is adopted**, not both languages:
    the menu's stored English is itself scan-model-authored and was measurably
    wrong on this very dish, while vision's English is a fresh rendering of the
    now-correct dish — the same reasoning `canReauthorEnName()` already records.
  - **Operationally inert until the next scan.** `scan_lat/lng` is new, so
    every EXISTING session contributes nothing; the feature starts working from
    the next menu scanned with location on. Backfilling KE7KK's coords from the
    field record is a one-line owner call, not something taken unilaterally.
  - **What the field pass has to answer:** scan a menu with location on, then
    photograph one of its dishes through the log pill and rate it — does the
    name arrive as the menu's words? And does anything get adopted WRONG (the
    kill criterion; `name_from_menu_at` marks every adoption so this is
    answerable after the fact, and each log prints one `naming-shortlist` line).

Kill criterion: if the match layer ever adopts a WRONG identity in field use
(worse than a wrong free-text guess, because it looks authoritative), gate
adoption behind the item-5 two-name pick instead of auto-adopting.

- **FIELD PASS FAILED, GO WITHDRAWN, 2026-08-04/05** — the kill criterion above
  fired on the first real dish. Full readout in
  `docs/rnd/vision-naming-context.md`; replay harness
  `scripts/diagnose-daaiye-miss.ts`, shortlist probe
  `scripts/probe-picker-viability.ts`. Item stays OPEN and **parked at the
  owner's instruction — no code changed, nothing reverted, nothing shipped.**
  Four findings, in the order they landed:
  1. **The 08-02 GO was measured on a model production has never run.** That
     eval ran inside the 26-day local/prod `OPENROUTER_MODEL` divergence
     (`9253b5a`): it scored `qwen3.7-plus` (thinking) while prod ships
     `qwen3-vl-32b-instruct` (non-thinking). Re-run on the correct model
     (`--edited-only`, n=20): **3/5 adoptions wrong**, vs 1/16 on the
     08-02 numbers.
  2. **Neither eval measured production's actual shortlist.** The harness
     proxies session coords from the linked restaurant; production requires
     real `scan_lat`, which only exists post-wiring. 4 of the 10 shortlisted
     cases return an EMPTY list under the real rule, including BOTH correct
     adoptions. The only clean production measurement is the 大爺燒鵝 field
     replay: baseline 燒鴨叉燒飯 3/3 (matching what prod returned), with the
     real 40-name shortlist **大爺燒鵝雙拼飯 3/3 — ADOPTED-WRONG,
     deterministic.** Production's own lookup silently never fired (the 1.5s
     budget failing closed is the leading suspect), which is the only reason
     that wrong name isn't in the DB.
  3. **GPS cannot separate HK restaurants, and no radius fixes it.** From one
     dish photo: CCQHK 4m (Japanese), J4RKV 24m (rice-noodle), VYGX4 **102m —
     the correct 大爺燒鵝 menu**. Three unrelated shops inside phone-GPS error,
     so the 250m union mixes them (sashimi dishes handed a roast-goose menu)
     and nearest-session scoping would be actively *worse*. `restaurant_id`
     IS an exact join (dish and session both `126efbb2`) — but it resolves
     client-side AFTER `inferDish`, so auto-adoption is structurally stuck
     with the noisy signal while anything on the growth card gets the clean
     one free.
  4. **Two separable defects.** Contamination (wrong restaurant's menu) is
     fixable by scoping; forced-matching when the dish is on no menu is not
     fixable by prompt — the model cannot tell "don't recognise it, but it's
     on the list" from "don't recognise it, and it isn't". The field dish was
     a 自選雙拼飯 (build-your-own) which the menu names for no single dish, so
     scoping would NOT have rescued it.

  **Options when this is picked up again** (owner reviewed 2026-08-05, no
  decision taken): (A) kill 3b; (B) ship auto-adopt as built — **ruled out**,
  it's wrong 3/5 on the only honest measurement; (C) **menu picker on the
  growth card** — the leading candidate, because it is the only design that
  runs after `restaurant_id` is known and so gets the clean menu, it fails
  safe (an ignored suggestion), it keeps the one-tap-beats-typing UX win, and
  it dissolves the 1.5s-budget bug by loading after the card renders;
  (D) item-5 two-name pick — inherits the GPS problem, since the candidate is
  chosen pre-vision; (E) lean on the existing at-the-table pick flow, which is
  already 100% accurate and needs no code.

  **Open question before building any of them:** how often is the dish
  actually ON the nearby menu? Owner's own logs are not a valid sample — he
  orders delivery and works from home, where normal users eat out daily; the
  1-in-9 menu-availability figure measured on his 57 photo dishes says
  nothing about HK. Sequencing note: making a scanned menu a lasting property
  of the RESTAURANT (rather than of an ephemeral `table_sessions` row) is the
  prerequisite that would make a picker fire often enough to dogfood, and it
  is the same thread as "consumer scan density: one dense neighbourhood
  first". `dish_identities` + `ownerMenuReconcile` are already half of it.

  **Also parked: seeding menus from the web** (owner idea, 2026-08-05). Would
  fix DENSITY, not naming (a scraped menu still says 自選雙拼飯). Ranked by
  data quality: delivery platforms (foodpanda/Deliveroo/KeeTa) give structured
  dish names + prices with no OCR at all, but breach ToS, get blocked, and
  carry the wrong menu subset for HK dine-in; Google Places is the licensed
  path; restaurants' own sites support a defensible "claim your page to
  correct it" posture; OpenRice/Maps user photos have the best coverage and
  the weakest rights — and the existing house rule ("never scrape platform
  photos", source ladder above) already speaks to that. Real cost is entity
  resolution (binding a scraped menu to the right `place_id`), not OCR. Real
  prize is the "claim your page" hook: an owner opening a page that already
  has their menu, slightly wrong, is a far easier sell than a blank one.
  Cheap next step if revisited: walk ~30 restaurants on one lunch strip and
  measure how many have a findable menu online at all, whether it matches the
  DINE-IN menu, and how many dishes are namable vs template items —
  `scripts/menu-corpus/` + `eval-menu-corpus-coverage.ts` already score it.

  **Also parked: switching the vision call to the Anthropic API** (owner
  question, 2026-08-05). Splits by failure mode. Abstention (the forced-match
  half) very likely improves — the owner's own eval already showed the
  THINKING Qwen at 1/16 wrong adoptions vs 3/10 non-thinking on this exact
  task, and Claude Opus 5 runs adaptive thinking by default. Raw 燒味
  recognition (油雞 vs 燒鴨, 燒腩仔 vs 叉燒) is genuinely uncertain — Qwen is a
  Chinese model on its home turf, and Claude is not automatically better at
  Cantonese BBQ; the honest edge is high-res vision (2576px vs 1568px tier)
  and the ability to give it crop/verify tools. Cost is smaller than it looks
  because dish naming is ONE call per photo (~$0.012/photo on Sonnet 5,
  ~$0.03 on Opus 5 vs ~$0.001 on Qwen) — the scan pipeline, which is the
  latency-critical multi-item path, could stay on Qwen. Neither fixes finding
  3 or 4. Decidable for ~$1–2: `eval-vision-naming.ts` already runs against
  any model via `OPENROUTER_MODEL` and Anthropic models are on OpenRouter, so
  it is an env-var change, not an integration — but the local key is $5-capped
  with ~$0.24 left and 403s on Anthropic models, so it needs a top-up first.

## 4. Dishes-first, attribution backfilled *(Fable; design depends on item 2's result)*

The owner's delay-the-restaurant-ID instinct, made concrete. Machinery that
already exists and gets reused, not rebuilt: `dishes` coords columns,
photo-attach-after (/api/dishes/photo), scoped re-attribution (table PATCH).
Additions:

- EXIF-carrying photo lands on a restaurant-less dish → run item 1's confirm
  retroactively at RATING time (engagement peak), one chip, never a form.
- **Cluster backfill:** a table session is a location cluster — one member's
  single EXIF photo or GPS fix attributes every dish in the session, via the
  existing scoped re-attribution (fills blanks / matches previous value only,
  never stomps a hand-edit).
- Photo slots on to-rate cards stay the capture mechanism; this item is why
  they're enough: slot alone just accumulates unattributed photos.

## 5. Micro-refinement channels — the comparison family does data QA *(collect evidence first; build after 1/3/4)*

Ranked; each respects the elicitation principle (ask only where evidence
conflicts) and one-question-max-per-rating-moment:

- **Name confirm on the growth screen:** vision's name is already on screen at
  the engagement peak — make it tappable; confirm/fix upgrades VISION→HUMAN.
  Cheapest signal per interaction in the whole list.
- **Two-name pick when vision is torn** between candidates (common once 3b
  supplies a menu): 係邊碟？ Two chips. This IS the comparison family applied
  to identity.
- **Menu-scan retroactive reconcile:** new scan at a restaurant reconciles its
  PAST vision-named dishes against the fresh menu — ownerMenuReconcile is the
  template (exact free, LLM fuzzy capped, fails closed). Users are asked
  nothing; history cleans itself.
- **Location duel** (呢碟喺邊間？) only when GPS genuinely can't separate two
  neighbours.
- **Photo-to-pick matching** at a table: "which pick is this photo of?" links a
  photo to a menu-named item.
- The execution slider (already backlogged) quietly doubles as identity
  confirmation across venues.

## 7. Server-side scan restore — the durable fix for cross-context loss *(later; evidence from 2026-08-02)*

The scan mirror moved sessionStorage → localStorage (24h freshness window) after
iOS process death ate a real session within an hour of the owner's first field
run. localStorage survives process death but NOT the iOS storage split: Safari
and the home-screen app are separate worlds, so a menu scanned in one can never
appear in the other, and a second device obviously gets nothing. The durable fix
is server-side: every scan already creates a table session whose menu_items live
in the DB, so "restore my active scan" is a query (sessions where I'm a member,
created within N hours), not new storage. Would also make the scan tab and /table
genuinely the same session view. Not urgent while solo; becomes urgent the first
time a tester scans in Safari and opens the home-screen app.

## 6. Album auto-confirm persists the nearest shop with no confidence gate *(needs an owner decision — field evidence 2026-08-02)*

Field-caught alongside item 2: the album rating flow auto-confirmed AND persisted
三多麵食 (98m away) for a dish eaten at 一起食堂, a place on no source. RatingStack's
loadNearby takes the nearest row unconditionally ("auto-confirm + persist the
nearest (correctable)") — the same nearest-wins rule the TABLE gate was explicitly
built to reject, writing wrong attribution silently at any distance. The
conservative philosophy (tableRestaurant.ts: wrong is worse than blank) hasn't
been applied here. Decision needed: adopt the same AUTO_RADIUS_M/AUTO_MARGIN_M
gate for album auto-confirm (leave the chips offered, just don't pre-pick), or a
looser album-specific threshold, or keep nearest-wins because album correction
friction is lower. Do-not-destabilize applies: whatever changes must leave the
chips themselves untouched.

## Sequencing (settled with the analysis, 2026-08-01)

1 (highest certainty, kills the typing problem) → 2 (de-risks everything
downstream, no code) → 3a → 3b → 4 → 5 items individually as evidence arrives.
Each step field-verified by the owner before the next begins, per the batch-wide
constraint above.

# Batch: 墨靈 taste lifeform (owner R&D session, 2026-08-02)

Direction settled in the R&D lab (docs/rnd/mokling-lab-v1.html + artifact
"墨靈 · Taste-Form R&D Lab", versions first-lab / speciation-v2 / creature-v3):
the taste form becomes a grown ink lifeform (creature = the living being,
銘 logogram = its DNA). Design framework: docs/rnd/mokling-framework.md.

## 1. Data audit: what vision extracts vs what the engine actually uses — *(Fable, no code until reviewed)*

**Audit delivered 2026-08-04 → docs/rnd/data-audit.md — awaiting owner review.**
Headline: `diet` flags are the sleeper (100% coverage incl. historical rows, and
the 15-flag vocab is a protein/domain vocabulary); ingredients gap is historical
photo rows only; domain evidence is computable today with no new extraction.

Owner (2026-08-02): "i'm surprised Vision has carried so little data over…
all data is relevant for R&D really… especially for food. Please make a note
to review how much data are we actually using, and what else we could be using."

Initial inventory from this session (verify against live schema before acting):
- **Extracted AND stored on dishes, but never aggregated per user / never
  learned from:** `ingredients` (up to 4, vision.ts, stored column),
  `cooking_method` (enum, photo path), `heaviness`, `diet`. Display/dedup only.
- **Parsed but ephemeral:** dishStructure.ts protein/method/base enums
  (beef/pork/chicken/duck_goose/fish/shellfish/egg/tofu_veg + bases) — used
  ONLY as canonical-merge vetoes; never persisted per dish, never per user.
- **Extracted and fully used:** 18-dim attributes, cuisine (affinity EMA).
- **Never extracted:** portion/temperature/sauce family, ingredient beyond 4,
  price-vs-satisfaction, repeat-order signal (derivable from ratings table).

The audit deliverable: one table (signal → extracted? stored? aggregated?
learned from? shown to user?) + a recommendation of which gaps feed (a) the
creature's domain evidence, (b) recommendation quality, (c) the palate export.
Note the creature's coarse domains (sea/land/air/field) are computable TODAY
from stored `ingredients` + dishStructure protein parse over rating history —
no new extraction needed for phase 1.

## 2. 墨靈 phase 1 — domain evidence aggregate + creature skeleton — ✅ CLOSED 2026-08-05

Everything in this item shipped: the aggregate (`domainEvidence.ts` +
`taste_profiles.domain_evidence`, 2026-08-04), the renderer
(`creatureForm.ts`), snapshot parity (`canvasToSvg.ts`), and the wiring into
all three production surfaces (`953abcd`). The last gate — the owner's pass on
the anatomy — was given 2026-08-05 as a STANDING sign-off: ship now, refine
along the way, anatomy is an ongoing enhancement for the product's lifetime,
not a milestone. Full entry + the one guardrail it does not dissolve (renderer
changes vs the body changing with the person) in DECISIONS.md, "墨靈 anatomy:
SIGNED OFF as a living surface".

Anatomy refinement continues under the recorded working method (one element per
round, owner verifies before the next, sketch after two missed rounds) — that
is ordinary ongoing work now, not a backlog gate.

# Batch: 墨靈 growth program (2026-08-06, owner brief → Fable design)

Design doc: `docs/rnd/mokling-growth-rnd.md` — read it before touching any
item; each step below is additive and fails closed to today's behavior.
Owner's brief: sub-nodes so lab gestures go live; growth with coexisting
limbs (claws AND wings) and atrophy/shed from absence or negatives; both
reward loops (long-term grooming + instant bud-on-rating); 「You are what
you eat」 — recency via eaten-date, never a source multiplier (equal-weight
logging holds).

## G1. Timed metabolism (accumulator v2 + domainsAsOf adapter) — *(Fable)*
Continuous-time EMA over eaten_at (HALF_LIFE ~120d), replay domain-walk
re-sorted on eaten-date, eaten-date PATCH triggers rebuild. Invisible until
G2 reads it. Renderer contract unchanged.

## G2. Gate redesign: bud / form / articulate, prominence dial — *(Fable)*
Existence by decayed absolute evidence (BUD_FLOOR ~1.2), size by
share/maxShare (0.22 share door retired), paling by staleness, shed with
hysteresis. Owner reviews on /dev-creature with an as-of time slider BEFORE
ship. Go/no-go gate for the metabolism.

## G3. Sub-node detectors: air (free), lamb, sea fish/cephalopod, field — *(Sonnet, spec in doc)*
domainEvidence.ts patterns; 魚香 tripwire; cephalopod-before-fish ordering;
unit tests per family. Invisible (fills bags nothing reads yet).

## G4. Gesture ports, one per round, owner sign-off each — *(Fable first pass each)*
Prawn pincers FIRST (detector already live today). Then 翼 雞/鴨鵝 variants,
尾 tails, 鰭 fins, 耳/角. Port checklist in mokling-lab-v7-vocabulary.js.

## G5. Instant-reward surface: growth delta in rating response → TasteGrowth line — *(Sonnet)*
「蟹爪 大咗少少」 naturalist copy, never numbers. Feeds the later absorb beat.

## G6. 圖鑑 molt archive: replay-derived molt_log, archive surface, shed ceremony — *(Fable)*
