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

- [ ] **[F] Carb-tripwire follow-up: honest vector re-score.** Open
  follow-up from the shipped carb-metonym work (DECISIONS.md, 07-20 batch
  item 4): the tripwire corrects ingredients/diet but not the 18-dim
  attribute VECTOR or an already-polluted NAME — honest vector re-score
  needs the name re-authored first (translate/vision + authority ladder).
  Costs one more LLM call per fire; recommended, cost accepted at triage.

## Needs an owner decision before any code

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
- [ ] **[F] 5. 檯友回音 (Table Echo)** — item 4 (companion edges) SHIPPED
  2026-07-22 (see DECISIONS.md), so this is now unblocked. Spec below.

## Log entry redesign — three paths by what you're holding, build order 1→3→2→4

Confirmed design (Jerry), 2026-07-22: replaces 餐廳菜/住家菜/相簿舊菜 with
📷 食物相 / ✎ 打字 / 🧾 外賣單 — organized by what the user is HOLDING, not how
they classify the meal. 相簿舊菜 is absorbed (fuzzy eaten-date triggers
automatically from EXIF age, not a chip); retro-pick-at-scan-time rejected;
multi-channel hero animation killed. Full spec below.

- [ ] **[S] 1. IA change: chips, copy, icons, explanation card.** Spec below.
- [ ] **[F] 2. 食物相: merged photo path with inferred context.** Depends on
  item 1. Spec below.
- [ ] **[S] 3. 打字: typed quick add.** Depends on item 1. Spec below.
- [ ] **[F] 4. 外賣單: delivery screencap path.** Depends on items 1-3
  (new blank-card + rating-cap machinery). Spec below.

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

---

## 1. IA change: chips, copy, icons, explanation card — *(Sonnet)*

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

## 3. 打字: typed quick add — *(Sonnet)*

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

Build order: 1 → 3 (Sonnet, ships the IA + the floor), then 2 → 4
(Fable 5). Old chips and their routes are deleted in item 1's PR — per
CLAUDE.md, superseded views do not remain importable, and each path's
verification includes screenshots of the real flow before "done".
