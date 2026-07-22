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

- [ ] **[F] dishi — your AI palate (export redesign) — §5 remainder.**
  §3/§4 SHIPPED `a3517b1` (persona voices 老實派/食家腔/貪玩 + persistence,
  `persona.ts`, `taste_profiles_persona.sql`); engine + payload work landed
  earlier. REMAINING: §5 UI + the voice-approval step. Review of the shipped
  portion deferred by owner ("later"). Engine-adjacent — use Opus/Fable.
  Full spec: `docs/specs/dishi-palate-export.md`.

## Ready to build — specs are decided, no open questions

- [ ] **[F] Dish-identity confirm card (係咪同一味？).** Chassis reuse
  (duel card) + design confirmed by owner 2026-07-22; a few implementation
  judgment calls flagged inline (negative-pair storage shape, the
  human-distinctness-is-sticky authority rule) — full spec below (2026-07-22
  batch).
- [ ] **[F] Carb-tripwire follow-up: honest vector re-score.** Open
  follow-up from the shipped carb-metonym work (DECISIONS.md, 07-20 batch
  item 4): the tripwire corrects ingredients/diet but not the 18-dim
  attribute VECTOR or an already-polluted NAME — honest vector re-score
  needs the name re-authored first (translate/vision + authority ladder).
  Costs one more LLM call per fire; recommended, cost accepted at triage.

## Needs an owner decision before any code

- [ ] **[S] Table item 6 — joined members add scan pages.** Authorization
  is trivial; the entry point is real work. BLOCKED on the trust-model
  call: can any member append freely, or does an unmoderated menu need a
  confirmation step? Full spec below (Table Mode batch, item 6).
- [ ] **[F] Persona rethink (老實派 / 食家腔 / 貪玩) — dedicated design session.**
  The in-card picker was REMOVED from the export card (2026-07-21): as a row of
  chips it wasn't doing anything a user could feel. Open design question: where
  and how does a persona actually interact with the user? If the character is
  only "alive" after export inside the user's own AI, the whole feature needs a
  dedicated session to design and build (voice in the exported prompt is already
  implemented — `persona.ts` voices + persistence are kept, default 'honest').
  Also open: the 貪玩 blurb "鬼馬、生動、港式抵死" is defined by its Cantonese
  cheek — 書面化 would be a rename/reframe, decide in the same session.
- [ ] **[F] 食記 ordering for album logs.** Old camera-roll photos have a fuzzy
  eaten-date; decide: order journal by when-eaten vs when-logged, and how to
  capture an approximate eaten-date at log time without adding friction.
  Design conversation first — do not build straight from this line.
- [ ] **[F] Diet taxonomy growth (gluten, soy, nuts-general).** The 雞扎 fix took
  DIET_FLAGS from 7 → 13 (added poultry/lamb/egg/dairy/offal). Further allergen
  axes are real but each needs its own recipe-grounding thought — do NOT bolt them
  on ad hoc; keep the vocabulary closed and deliberate.

## Table Mode continuation — Fable-tier, in dependency order

- [ ] **[F] 3b. Guest (no-account) table participation** — new auth
  surface, needs its own design session first. Spec below.
- [ ] **[F] 4. Companion edges (同檯 data layer)** — schema + RLS +
  export-prose judgment. Spec below.
- [ ] **[F] 5. 檯友回音 (Table Echo)** — must not start before item 4's
  session/consent model is merged. Spec below.

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

---

# Backlog additions — 2026-07-22 (identity-confirm card on the duel chassis)

Context: resolves the UI half of the standing dish-identity-resolution item
(same real-world dish, different AI names — 蝦餃 vs 水晶鮮蝦餃). Confirmed
design (Jerry): reuse the 今日對決 card as the shared chassis; identity
confirmation becomes a second mechanic on the same surface.

---

## Dish-identity confirm card (係咪同一味？) — *(Fable 5, extends the existing dish-identity backlog item)*

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
