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
  expanding. Not a code item. **The "no friend graph at this stage" half of
  this line is REVERSED (owner, 2026-07-26)** — and reworded rather than
  deleted, because what was chosen is not a friend graph: asymmetric FOLLOW
  plus a public taste page (`dishi.me/[username]`), a creator/audience model,
  deliberately not mutual. Reason it is now on-strategy: it is the only
  mechanic that generates same-dish-different-restaurant pairs, the substrate
  the execution slider needs and does not have (ZERO such pairs exist today).
  See DECISIONS.md, "Identity, connection, and export positioning", and the
  VISION entry at the end of this file.
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

---

# VISION — dishi.username: identity, connection, publishing — *needs Fable architecture review before ANY code*

Filed 2026-07-26. Until now this existed only in the owner's Claude Project
conversation and was recorded nowhere in the repo. **This is a vision entry,
not a spec:** nothing here is buildable as written, and the review that turns
it into specs has not happened.

**Settled inputs (do not re-litigate these in review)** — DECISIONS.md,
"Identity, connection, and export positioning (owner, 2026-07-26)": username
at v1 unlock with a first-share/first-follower rename escape; asymmetric
follow, so 貼文 is PUBLISHING and copy says 公開 never "friends"; the public
taste page at `dishi.me/[username]` IS the dossier, no third artifact,
viewable without login, no eaten dates, companions never, and the two hard
rules (a dossier never enters the recipient's engine; never visible during a
rating flow).

## The sequencing test

Not generic product sense — the two recorded directions:
"Direction: what the taste engine is FOR" (2026-07-24) and "Direction:
comparison is the core product DNA" (2026-07-26). **Every mechanic below is
judged on whether it moves toward EXECUTION-level signal.** A mechanic that
only adds engagement does not qualify, however social it is.

## Ordering, corrected from the owner's original

- **bookmark → 待評 is the HIGHEST-value item and must not be last.** It is
  the only part of this vision that generates execution-comparison substrate:
  a friend's recommendation is the most likely way a person eats 乾炒牛河
  somewhere new. The execution slider shipped with a comparison payoff that
  fires ~0 times today (ZERO dish identities eaten at two restaurants,
  measured 2026-07-26) — bookmark is its missing input, not a nice-to-have.

- **Treat username + follow/invite + post/bookmark as ONE release train.**
  Half-shipping leaves the app incoherent: an identity with nothing to share,
  or sharing with no identity.

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
