# Palate export — Phase 1: the loop, measured (plan, 2026-07-29)

Owner directive, 2026-07-29: review the dishi.username → personal-AI R&D with
a CLEAR aim; no persona; the "dishi" mention / rate-with-dishi reminder is a
REQUIREMENT, not garnish; settle placement (Project or not) and on-purpose
call-out questions with a systematic test-and-revise protocol.

## The aim (one sentence, and what it decomposes into)

**Taste learned in Dishi shows up in the user's own AI, and that AI sends
them back to Dishi to keep rating.** Two halves, both required — this is the
flywheel (rate → sharper palate → better answers from their own AI → more
reasons to rate), and an export that only does the first half is a leaky
bucket:

1. **USE** — when food comes up, the host answers from the measured palate
   (anchors, dislikes, honest confidence), grounded (no invented venues).
2. **LOOP** — when the user mentions eating something, the host produces the
   one quiet "rate it in Dishi" line; before travel/occasions it suggests a
   refresh; when the read is thin it says so and names the fix (rate more).
   Bounded by HARD_LIMITS (≤1 mention/conversation, drop on disinterest) —
   the loop must never read as malware in someone's assistant.

The doc states this aim to the host in so many words now (the two-jobs line
in `usingLine`, tasteExport.ts) — a host told WHY the reminder exists follows
the shape of the request, not just its letter.

## Already settled by evidence — do NOT retest (context recovered)

The owner flagged lost context; this is the canon as of today. Full records:
`persona-phase0-results.md` (this folder) and DECISIONS.md.

- **Taste-only shipped 2026-07-28.** No persona in the export — hosts adopt
  the taste PAYLOAD and refuse the character SYSTEM. Personas moved in-app
  (now columnists in 大家食). The persona question is CLOSED for the export.
- **Install-only.** The paste/taster path is categorically dead (mobile
  composers convert long pastes to attachments; the attachment channel trips
  behavioural-instruction screening regardless of author). The named
  container — Claude Project / Gemini Gem / custom GPT, named
  `dishi.{username}` — is the only mechanic measured to persist.
- **Request grammar + provenance preamble** are what got the doc adopted
  (imperative grammar got it screened). Every future edit keeps the user's
  first-person request framing.
- **Bare-name summon is STRUCK** (Phase 0 §3) — but note precisely what
  died: saying "dishi" in a conversation where the doc is NOT in context, to
  resurrect it. Name collision + memory-compression made that unreliable by
  construction. A call-out cue addressed to a doc ALREADY in context is a
  different mechanic and is live for testing (H2).
- **Fabricated venues are the trust-killer** (Phase 0.5 §6) — VENUE_GROUNDING
  exists; every protocol below includes the invented-venue trap probe.

## Hypotheses

- **H1 — placement.** Where the doc sits decides whether the palate persists
  and whether its REQUESTS (not just its facts) shape behaviour.
  - (a) Named container (Project/Gem/GPT) — shipped path; measured working
    on Claude Project (Sonnet 5) + Gemini Gem. ChatGPT custom GPT retest is
    still OPEN (export batch item 4) and folds into this phase.
  - (b) Host memory ("remember this") — Phase 0 measured: facts retained,
    behaviour dropped. Retest ONCE with the taste-only doc (the old measure
    was of the persona doc; a requests-only doc may fare differently), then
    close permanently either way.
  - (c) Custom-instructions / personalization slot (ChatGPT custom
    instructions, Gemini saved-info, Claude profile preferences) — never
    tested. Cheap to test, big if viable: zero-container friction, but slots
    are short — likely needs a CONDENSED export variant (see revision lever
    R3).
- **H2 — activation.** Within a placement that holds the doc: does the
  taught call-out ("dishi, what should I eat tonight?") activate the palate
  more reliably than an ambient food question? Decides whether onboarding
  copy should TEACH the call-out habit, or whether ambient adoption is
  dependable enough to say nothing.
- **H3 — the loop fires, and only when it should.** Meal mention → exactly
  one quiet rate-reminder line; non-food conversation → zero dishi mentions;
  thin-dimension ask → host names the thinness and suggests rating. Both
  directions count: a loop that over-fires burns the install.
- **H4 — persistence.** Fresh conversation next day, same placement, no
  re-paste: does USE still hold? (Containers pass by construction; this is
  really a memory/CI-slot question.)

## Protocol (owner-run; each cell = fresh setup, screenshots kept)

Fixed probe script, run per (host × placement), EN and 廣東話 halves:

- **P1** ambient food ask: "what should I order at a Sichuan place tonight?"
- **P2** call-out food ask: "dishi — what should I order tonight?" (fresh
  conversation, same question; difference vs P1 is the H2 measure)
- **P3** meal mention, no question: "just had a great laksa at lunch" →
  expect ONE quiet rate line, nothing more
- **P4** non-food conversation (work topic) → expect zero dishi mentions
- **P5** invented-venue trap: "book me somewhere in [neighbourhood the host
  can't know] that fits me" → expect honest thinness + anchor-reasoning,
  zero fabricated venues
- **P6** next-day fresh conversation, repeat P1 → the H4 measure

Score each cell on five binary axes: **ADOPT** (answers from the palate, not
generic taste) / **GROUND** (P5 clean) / **LOOP** (P3 fires once) / **QUIET**
(P4 silent) / **PERSIST** (P6 holds). Record as e.g. `4/5 (missed LOOP)` in
the results table below.

**Go bar** (owner's standing ~50% convention): a placement enters product
copy only at ≥4/5 on BOTH tested hosts; the loop axis is mandatory (a config
that fails LOOP fails the aim, whatever else it scores). Container (H1a) is
already shipped copy; the bar governs (b)/(c) ever being OFFERED.

## Revise loop (the systematic part)

One lever per revision; every revision bumps the export version the user
already sees (taste_profile_version — deltas stay visible, the standing
"versioning visible and recurring" thread); results logged HERE per version
before the next lever moves.

- **R1 (shipped today, v-current):** two-jobs aim line + "dishi" call-out
  cue + place-mention added to the rate-reminder trigger.
- **R2 (if LOOP under-fires):** move the reminder rules up the doc / restate
  the trigger as a when-then pair. (If it OVER-fires, tighten HARD_LIMITS
  wording instead — never both levers at once.)
- **R3 (if H1c shows promise):** a condensed slot-sized variant — headline
  identity, top anchors, epistemic line, loop rules; nothing else. New
  builder output, same sections source, only if evidence asks for it.
- **R4 (if H2 says teach it):** the call-out habit enters install-step copy
  ("talk to it by saying dishi") — copy change only, no doc change.

## The probe harness (added 2026-08-01) — what it measures, and what it can't

`scripts/probe-export.ts` runs P1–P5 automatically against each host's model
with the REAL export doc (built from the owner's live profile by
`extractTasteSections` + `buildTastePrompt`) as the system prompt, and scores
ADOPT / GROUND / LOOP / QUIET with a judge that must quote its evidence.

```
set -a; source .env.local; set +a
npx tsx scripts/probe-export.ts --tag=R2 --judge=<reachable model>
```

Each host tries its **first-party provider first** and falls back to OpenRouter,
so the run measures as much as the available keys allow. Setting any of
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY` in
`.env.local` lights up that host; a host with no working route is reported
`blocked` (naming which key failed and why) and left unscored. Direct is
preferred over the broker even when both work — it is the closer analogue of the
install path, which runs on the user's own account with that provider — and the
route that answered is recorded per cell, because a first-party answer and a
brokered one are not interchangeable evidence.

It exists because the protocol above is owner-manual, which is why the table
below stayed empty: every revision cost an evening before it could be judged.
The harness makes the four DOC-level axes cheap enough to A/B a lever in
minutes. It does not replace the manual cells:

- A Project's "instructions" field ≈ a system prompt, which is what the harness
  sends. It is NOT the product — no host system prompt, no attachment/injection
  screening. A pass means the DOC works on a raw model.
- **H1b (memory), H1c (custom-instructions slot) and H4 (persistence) cannot be
  measured here at all** — they are about host plumbing. P6 stays owner-manual.
- Transcripts land in `docs/rnd/probe-runs/`. Read the cells; every verdict
  carries the quote it rests on.

Two things the first run taught about the instrument itself, both worth keeping:

1. **A blocked host must never be scored.** The OpenRouter key is 403'd by
   Anthropic, Google AND OpenAI (account-level — a bare "say OK" fails the
   same way), so three of the four install hosts are unreachable. Without the
   preflight they returned empty answers and scored 0/4: a transport failure
   dressed as a finding about the document. Blocked hosts now report `blocked`.
2. **An over-strict criterion is worse than no criterion.** P5's first wording
   demanded that any named venue appear in the document — a bar VENUE_GROUNDING
   never sets (it forbids INVENTING venues; naming real ones is the wanted
   behaviour). It failed a near-perfect answer and would have sent R2 chasing a
   problem that did not exist. The judge no longer rules on whether a restaurant
   exists — it can't — it rules on invented specifics and overclaimed capability,
   and lists every venue named for the owner to check by eye.

### Instrument finding (2026-08-01, first manual Claude cell): the fidelity gap
### runs the OTHER way too — the install can have tools the harness cannot model

The harness's stated limitation was that it is *weaker* than the product (no
host system prompt, no screening). The first real Claude Project cell showed the
install is also *stronger*: the Project ran with **web search on**, and its P2
answer named three venues with street addresses, a price band and closing times
— every one of which checked out as real (owner-verified, map cards attached).
On the harness, that same behaviour — precise checkable specifics stated as
fact — is the textbook mode-1 GROUND failure, because a raw model CANNOT know
them. With search, it can, and the identical text is not a failure but the
wanted behaviour at its ceiling: grounded, checkable, execution-level venue
advice.

Consequences, in order of weight:

1. **Harness GROUND and install GROUND are different measurements**, in both
   directions. The harness measures the DOC's ability to keep an untooled model
   honest; the install measures the doc PLUS the host's retrieval. A harness
   GROUND failure does not predict an install failure on a search-enabled host —
   which further deflates the cross-model GROUND scare (already suspect for
   being all stand-ins) as evidence about the shipped product.
2. **P5's criterion needs a tool-aware reading in manual cells.** "States
   specifics it cannot know" was written for a tool-less model. With search on,
   stating retrieved specifics is fine and the bar moves to: are they REAL
   (owner-checked), and does it still hedge what retrieval cannot establish
   (fit, booking state)? Condition (b) — claiming to have BOOKED — remains a
   fail regardless of tools.
3. **Manual cells run with the host's DEFAULT settings, search included.** The
   protocol measures the shipped install path, and the shipped path is whatever
   a real user gets on install day. Turning search off to match the harness
   would be measuring the instrument's limitation, not the product. Record the
   toggle state per cell so no result is read against the wrong baseline.

### R1 finding, RESOLVED for Claude: the confound breaks toward reading B —
### the install host does not need the doc to carry grounding

The first real install cell (Claude Project, table below) answers the question
the four-model run could not. Reading B wins on this host: **Claude grounds
natively, above what the doc asks for.** The specific gap that defined mode 2 —
the doc never requests an unconditional hedge and never mentions booking
ability — did not matter, because the host supplied both unprompted:

- Both P5 cells opened by naming the booking limit in so many words ("I can't
  place the booking myself — no reservation tool on my end" / 「我自己冇辦法幫你
  打電話或者網上訂枱，呢啲要你親自落單先得」) — the exact sentence R2 was going
  to add to the doc, generated by the host on its own.
- The zh P2 cell hedged knowledge staleness unprompted in a plain ordering
  question (「我對香港餐廳嘅認知去到今年年中就開始唔可靠…唔想亂報名同地址」)
  and refused to name venues until given a district — trap-grade discipline,
  no trap present.
- With search on, it converted the grounding problem into a retrieval problem:
  real venues, map cards, phones, hours — and *attributed* soft claims to
  reviewers instead of asserting them.

Note also: the harness's zh-recall failure mode (裕記→悅記 character corruption)
did not appear — search returned the correct 裕記大飯店. Retrieval fixes the
Chinese-recall weakness no doc wording could.

**Decision: R2 stays parked**, now on evidence rather than on caution. The
mode-2 hedge is real as a *raw-model* phenomenon (four stand-ins showed it) but
absent on the one measured install host, which supplies the hedge itself. The
export doc's job on a frontier host is the palate and the loop, not grounding
discipline the host already has. R2 reopens only if a *second* install host
(Gemini Gem / custom GPT — owner-manual, same protocol) shows mode 2, or if a
host without search fails GROUND in the wild. Tuning the doc for DeepSeek-class
models nobody installs into remains the thing the hold existed to prevent.

**H2 is now two-for-two (Grok, Claude): the call-out adds nothing** — ambient
adoption already works. R4 (teach the call-out in install copy) is heading for
CLOSED; one more host seals it.

### Owner ground truth (2026-08-01, from the Claude cell): the dislike claims
### overstate, and the subject of the palate says so

After reading the cell's replies, the owner disputed the rendered aversions:
"Do I hate sweet and sour? Maybe not my favourite, but I honestly don't hate
sweet. To me seafood is 'freshness kind of sweet'. Nor do I hate 荔枝 — I'd
pick it as a drink." This is evidence no judge can produce — the person the
palate describes, disagreeing with the description — and it decomposes into
three stacked failures at different layers:

1. **Engine conflation.** The `sweet` dimension lumps sugar-led sauces, natural
   seafood 鮮甜 and fruit into one number; two sauce misses (酸甜醬烤魚, lobster
   roll) dragged the lump negative while the LOVED list is full of naturally
   sweet seafood (特大赤蝦, 龍蝦刺身, 海鮮丼). The contradiction was in the data
   the whole time. Feeds the decomposition R&D thread (sauce-sweet vs 鮮甜),
   not this phase.
2. **Doc flattening.** The vector's point estimate renders as a bare verdict
   ("Generally prefer less: sweet, sour") with no per-dimension evidence count
   and no scope. Two data points and twenty are indistinguishable to the host.
3. **Host amplification.** "Generally prefer less" retold as 雷區 / 明擺住唔受 /
   category vetoes of never-rated dishes (咕嚕肉、京都骨) and whole 味型
   (荔枝味 — culinarily correct, no lychee in it, yet collides with the owner's
   actual love of lychee: a hardened trait line producing technically-defensible,
   experientially-wrong advice). Over-filtering is the invisible failure mode:
   a wrongly vetoed dish is never discovered.

**The structural fact:** negative evidence is permanently scarce (the
negative-rating ceiling — nobody orders what they expect to dislike), so
dislike claims can never honestly reach love-claim confidence at ANY data
volume. The fix is asymmetric confidence — bold about loves, curious about
dislikes — not uniform hedging. The run itself proves the mechanism: P3, which
received dish-level EVIDENCE, produced perfect epistemics ("new information,
not confirmation"); P1, which received the flattened VERDICT, produced walls.
The doc controls which one the host gets.

**Promoted to a DOC fact by the day-2 cell (2026-08-02).** The overstatement
reproduced on **Sonnet 5** from the identical doc line, in both languages, and
hardened onto two further never-rated dishes (鍋包肉, 酸辣湯 — "obvious miss
given your profile"). That is a second model, and with the four stand-ins the
pattern now spans every host tested: the flat verdict line
(`Generally prefer less: sweet, sour`) reliably renders as category vetoes,
regardless of model tier. By this plan's own bar — a leak on one model is a
model fact, a leak on three is a doc fact — the dislike overstatement is a DOC
fact, and unlike mode 2 it is NOT rescued by a frontier host's native
discipline: Opus and Sonnet both did it. This is the one defect the install
cell found that the document actually owns.

**R5 (a) SHIPPED (2026-08-02, tasteExport.ts):** avoid-lines now carry a real
per-dim evidence count (`TasteExportInput.evidence`, the same `EvidenceMap`
that already drives 識睇/仲摸緊 on the blob — one honest counter, not a new one).
Below `KNOWS_AT` (blobForm.ts, currently 3), a dislike renders with an explicit
"early lean, not a settled dislike" qualifier instead of a bare trait word; at
or above it, it states the dish count plainly ("bitter (6 dishes)"). Callers
that don't pass `evidence` (or hand-built sections in tests) get the old bare
label — additive, not a breaking change. This is the buildable half of what
the finding above called "evidence count and scope": what it does NOT do is
the sauce-vs-seafood attribution in the finding's own illustrative example
("loved list contains naturally sweet seafood — the signal is sauce profiles,
not sweetness") — that needs per-dish dimension attribution the engine doesn't
currently expose to the export, and stays parked on the decomposition R&D
thread (sauce-sweet vs 鮮甜), same scoping the finding itself gave it.

(b) and (c) remain PROPOSED, not built — owner decides if/when: (b) calibration
instruction: never state a dislike more strongly than the doc does,
recommend-against only by citing the missed dish, never veto an unrated
category; (c) contradiction feeds the loop: if the user reports enjoying
something against a lean, believe the report and suggest rating it. (c) turns
the owner's exact complaint into the rate reminder firing at its most useful
moment.

Protocol note: the Claude cell's scores stand — ADOPT measures faithful
transmission of the MEASURED palate, and transmission was faithful. This
finding is about calibration of the measurement, one layer up.

### Scope finding (owner question, 2026-08-02): the container holds USE well
### and starves LOOP, because LOOP's best moment happens OUTSIDE the container

Everything measured in the Claude cell happened inside the Project. A Project's
instructions scope to that Project's conversations — outside it, the doc is not
in context and the palate does not exist. That is not a bug and not fixable by
wording: it is what a named container IS, and Phase 0 already struck the
alternative (bare-name summon, §3 — saying "dishi" in a conversation without
the doc, to resurrect it, died to name collision and memory compression).

The two halves of the aim are affected very differently, and the asymmetry is
the finding:

- **USE survives scoping intact.** Wanting food advice is a deliberate act, so
  the user goes to the container on purpose. The 5/5 cell is a fair measure of
  USE as shipped.
- **LOOP is measured where it matters least.** The rate-reminder's best moment
  is a meal mentioned *in passing* — P3's "just had a great laksa at lunch" is
  a remark someone drops into whatever conversation they are already in, not a
  message they open a food Project to send. Inside the container, the reminder
  reaches someone already thinking about Dishi; the person who needs prompting
  is the one who never opened it. **LOOP scored 2/2 in the one place where
  firing it is closest to redundant.**

So the flywheel's growth half is structurally throttled by the placement that
makes its quality half work. This does not retract the cell — LOOP passed on
its own terms, and a reminder that fires correctly is still better than one
that does not — but it re-prices the hypotheses:

**H1c (custom-instructions / personalization slot) is promoted to the highest-
value untested item in the phase.** It is the only measured-plausible placement
with GLOBAL reach: a profile-preferences / custom-instructions / saved-info slot
applies to every conversation, so a meal mentioned anywhere could fire the loop.
H1b (memory) is not a substitute — Phase 0 measured facts retained and BEHAVIOUR
dropped, and the loop is behaviour.

The known blocker is size: the shipped doc is ~6k chars and personalization
slots are short, so H1c almost certainly requires **R3 (condensed variant —
headline identity, top anchors, epistemic line, loop rules, nothing else)**.
That makes R3 no longer a speculative lever but the prerequisite for testing
the phase's most valuable placement. Sequence: R5 (confirmed defect — (a)
shipped 2026-08-02, (b)/(c) still proposed) → R3 (condensed build) → H1c cell
→ then a second install host for H2/R4 closure.

## Results log (append per run)

| date | host | placement | doc version | score | notes |
|------|------|-----------|-------------|-------|-------|
| 2026-08-01 | Grok (grok-4.5) | harness (system prompt ≈ Project instructions) | v-current (R1) | **4/5 EN, 3/5 zh** (PERSIST not measured) | Single run. The EN/zh GROUND gap here did NOT survive repetition — see below. H2: call-out neither lifts nor hurts — P1 and P2 both adopt, so ambient adoption is already working on this host. |
| 2026-08-01 | Grok (grok-4.5) | harness | v-current (R1) | **GROUND 3/4 EN, 3/4 zh** (P5 only, 4 repeats) | The repro sweep. Same failure rate both languages; supersedes the single-cell reading above. |
| 2026-08-01 | Claude / Gemini / ChatGPT | — | — | **blocked** | OpenRouter key 403 "provider Terms of Service" on all three, account-level. Says nothing about these hosts. |
| 2026-08-01 | DeepSeek v4-pro *(stand-in)* | harness | v-current (R1) | **2/4 EN, 2/4 zh** | Missed GROUND + QUIET both languages. Invented street addresses AND phone numbers as fact. |
| 2026-08-01 | Mistral Large 2512 *(stand-in)* | harness | v-current (R1) | **3/4 EN, 2/4 zh** | Missed GROUND both languages, QUIET in zh. Invented addresses and prices; venue list included Pizza Hut and Café de Coral as taste-matched picks. |
| 2026-08-01 | Kimi K3 *(stand-in)* | harness | v-current (R1) | **3/4 EN, 3/4 zh** | Missed GROUND (EN), ADOPT (zh). First observed **call-out LIFT**: P1 zh failed ADOPT, P2 zh passed it. |
| 2026-08-01 | GLM 5.2 *(stand-in)* | harness | v-current (R1) | **3/4 EN, 3/4 zh** | Missed GROUND both languages, via condition (c) only — picks offered with no hedge at all, no invented specifics. |
| 2026-08-01/02 | **Claude (Opus 5 day 1; Sonnet 5 day 2), claude.ai** | **Project `dishi.jerry` — REAL INSTALL** (web search ON, host default) | v2 (R1) | **5/5 EN, 5/5 zh — FIRST HOST TO CLEAR THE GO BAR** | First install-host cell, owner-run. ADOPT strong both languages (anchors quoted by name; skip-lists derived from named misses). H2: both pass both languages — call-out adds nothing, matching Grok. LOOP: exactly one aside every P3, plus compliant fires in P1/P2/P5. QUIET clean; one flagged wobble (zh opener 「撇開食嘅嘢先」 surfaces the food scope without naming Dishi/rating/palate — scored pass, owner may overrule). GROUND: **both P5 cells named the booking limit unprompted** ("I can't place the booking myself" / 「我自己冇辦法幫你打電話或者網上訂枱」) and hedged staleness; venues retrieved via search with map cards, phones, hours. Venue reality: owner verified every named venue across P2 AND P5 (深鑫鍋, 能記飯店, 裕記大飯店, 陳記燒鵝, Canaan Gourmet, plus P2's 鮨山月/正潮樓/Yung's) — zero invented venues in the whole cell. **PERSIST (P6, next day, no re-paste, fresh conversations): PASS both languages** — trait ordering and both named anchors intact, so H1a (named container) is CONFIRMED on Claude. Day 2 ran on Sonnet 5 Medium rather than Opus 5 High; not re-run, because PERSIST is a question about the PLACEMENT (does the container still deliver the doc tomorrow), which is model-independent — a pass on the smaller model is if anything stronger evidence for the mechanism. Recorded rather than hidden so no one reads day-2 quality differences as drift. Judge: single-vote (Claude Code session), quotes kept in screenshots. |

### R1 finding, PARTIAL: GROUND fails on 4 of 5 models — but not on the one install host

*(Latest finding — supersedes "R1 finding, CORRECTED" further down, which closed
by naming the bar: a leak on one model is a model fact; a leak on three is a doc
fact.)* Four more models, same doc, same probes, same judge, clears that bar on
its face. GROUND by model × language:

| model | EN | 廣東話 |
|---|---|---|
| Grok 4.5 | pass | pass |
| DeepSeek v4-pro | **fail** | **fail** |
| Mistral Large 2512 | **fail** | **fail** |
| Kimi K3 | **fail** | pass |
| GLM 5.2 | **fail** | **fail** |

**7 of 10 cells fail. Four of five models fail at least one language. Grok is the
only clean model** — and Grok is the model every earlier reading rested on. The
R1 story was never "the doc grounds well, with a ~1-in-4 wobble"; it was "the one
host we could reach happens to be the doc's best case."

The other three axes hold up across the same five models, which is what makes the
GROUND result specific rather than a general "the doc is weak" verdict:
**LOOP 10/10, ADOPT 9/10, QUIET 7/10.**

**Two distinct GROUND failure modes**, and the split matters because only one was
anticipated:

1. **Invented checkable specifics** — addresses, phone numbers, prices stated as
   fact (DeepSeek, Mistral). This is the Phase 0.5 failure mode, already named,
   already the thing VENUE_GROUNDING forbids in so many words.
2. **No hedge at all** — GLM failed both languages, and Kimi EN, purely on
   condition (c): real venues, no invented specifics, and *zero* acknowledgement
   of thin local knowledge or of being unable to book. Nothing in the doc was
   violated, because **the doc never asks for this.** VENUE_GROUNDING requests
   honesty only in the conditional "when you don't have solid knowledge of the
   area" — a model that believes it knows 深井 skips the hedge and is compliant
   while doing it. Booking ability is not mentioned at all.

Mode 2 is a genuine **gap in the document**, not a compliance failure, and that is
the R2 lever: make the hedge unconditional and name the booking limit, rather than
strengthening the existing prohibition (which mode-2 models never broke).

**The confound, and why R2 does NOT move yet** (owner, 2026-08-01). The one
install host in this table is also the only model that passed. Two readings fit
the same ten cells:

- **A.** The doc fails to carry grounding; Grok is unusually good at it.
- **B.** The frontier install hosts ground well natively — Anthropic, Google and
  OpenAI train specifically against inventing specifics and for hedging knowledge
  limits — and the stand-ins are weaker at it. The doc is adequate for the
  audience that actually installs it.

Grok passing is weak evidence for B, and nothing here separates them. So the "doc
fact" bar is met in letter and not in spirit: it was written to stop a one-model
result driving a revision, and a four-model result drawn entirely from NON-target
models has the same defect wearing a bigger number. **R2 is held until at least
one more install host is measured.** Tuning the export for models nobody installs
into would cost a user-visible version bump to discover.

What survives the confound: the stand-ins are current-generation, not weak legacy
models, so it IS established that the document does not carry grounding on its own
across models. Whether the targets need carrying is the open question. Mode 2 is
also arguably model-independent — an instruction the doc never gives cannot be
followed by anyone — which makes it the first thing to test if a key appears.

**What this still does not establish.** These four are stand-ins — nobody installs
a palate into DeepSeek or Mistral. They are evidence about the DOCUMENT on a raw
model, and no evidence at all about whether the install holds on Claude, Gemini or
ChatGPT. Those three remain 403'd and unmeasured; H1b, H1c and H4 remain
owner-manual regardless.

### The OpenRouter 403 is account-level and cannot be coded around

Verified 2026-08-01, so nobody re-derives it: `anthropic/claude-sonnet-5`,
`anthropic/claude-opus-5`, `google/gemini-3.1-pro-preview` and `openai/gpt-5.5`
are all **listed in the catalog** on this key — OpenRouter does serve them. The
call returns 403 "violation of provider Terms Of Service" with `provider_name:
null` and four identical `previous_errors`: four upstream routes tried, all
refused, none named. That is the gateway refusing on behalf of the ACCOUNT, which
is why it lands on exactly the three providers with the strictest reseller terms
and on nothing else. Only OpenRouter support can lift it.

The key also has **$0.88 of a $5 limit remaining**, so OpenRouter is close to
exhausted for this work independently of the 403. A direct provider key is now
the cheaper path as well as the only unblocked one — and it is the closer
analogue of the install anyway (the user's own account with that provider).

**Re-tested after a credit top-up (2026-08-01, same day).** The owner added
funds on a US card, on the theory that the original card's restricted region
caused the refusal. The balance moved and **the 403 did not**: all three
providers returned the identical error minutes later, with Grok answering on the
same key seconds after. Three things this pinned down, none of which a payment
can change:

- **The "$0.88" is a PER-KEY spend cap, not the balance** — and the two are
  independent. The account now holds $10 with $4.12 used ($5.88 free); this key
  declares `limit: 5` with `limit_remaining: 0.88` (= 5 − 4.12). Topping up
  credits does not raise a key's cap, so the harness still hard-stops after
  ~$0.88 more spend — as a 402 on *every* model, Grok included. Raising or
  removing the cap is a dashboard edit on the key itself (or a fresh key with no
  limit). Worth stating because the two numbers look like the same number and
  the wrong one is the reassuring one.
- **The block is provider-wide, not a tier or allowlist thing.**
  `claude-haiku-4.5` and `gpt-4o-mini` — the cheapest models those providers
  sell — 403 exactly like their frontier siblings, while DeepSeek answers
  normally. So it is not about model cost, recency, or capability.
- **It is applied around dispatch, keyed on the account — not four upstreams
  independently refusing.** The endpoints listing for `anthropic/claude-sonnet-5`
  shows seven healthy routes on this key (Anthropic, Amazon Bedrock ×3, Google
  ×2, Azure — all `status 0`), and the 403 carries four `previous_errors`.
  Bedrock, Vertex and Azure are three different companies' infrastructure with
  three different enforcement paths; they do not all flag one account in the same
  instant with byte-identical wording. Something in front of them is refusing on
  the account's behalf.

What that leaves as the likely cause is **jurisdiction on the account** rather
than the card: the block lands on exactly the three vendors with the strictest
territorial reseller terms and on nothing else, and Dishi is a Hong Kong
project. A US card only helps if the gate reads billing address; if it reads
account region or IP, it never will.

### CONFIRMED: it is a regional block, and it is structural

Corroborated the same day from outside reports, which turns the inference above
into the working explanation and settles the forward path:

- OpenRouter enforces **account-level regional restrictions for exactly the
  providers that demand it — OpenAI, Anthropic, Google** — and for no others.
  That is the observed pattern here, vendor for vendor.
- **Hong Kong is an unsupported territory for all three.** OpenAI names Hong
  Kong alongside mainland China in its unsupported list; Anthropic and Google
  restrict on the same axis. xAI and the Chinese labs (DeepSeek, Moonshot, Z.ai)
  do not — which is why Grok and the stand-ins answer on the identical key.
- Users report the same wall from Hong Kong specifically, including for models
  the account can see in the catalog. Catalog visibility never implied
  entitlement.
- The gate was historically Cloudflare edge-IP geolocation; it now also reads
  **billing address among other unstated signals**. So the owner's US-card
  theory was aimed at a real signal — it is simply not the only one, and the
  measured result is that changing it alone did not flip the gate.

**Three consequences, and the third is the one that matters.**

1. The appeal channel exists (OpenRouter's own wording offers to correct
   *mistaken* restrictions) but a correct regional block is not a mistake, so an
   appeal is a low-probability fix rather than a waiting game with a known
   timeline. There is no public evidence of regional blocks being lifted on
   appeal; the reports that exist are of them holding.
2. **A direct Anthropic / OpenAI / Google key does NOT route around this.** The
   restriction originates upstream — OpenRouter is enforcing the providers'
   terms, not adding its own. This retracts the "get a first-party key" plan
   from the section above for those three hosts: it was the right move when the
   block looked account-specific, and it is the wrong move against a territorial
   one. `XAI_API_KEY` is still worth setting (xAI does not restrict here) and
   would take Grok off the near-exhausted OpenRouter key.
3. So **the API path to Claude, Gemini and ChatGPT is closed for this project,
   not merely blocked today.** That is not the setback it looks like, because
   the plan never claimed the harness could measure the install: H1a needs the
   owner's manual container cells, and H1b/H1c/H4 were always owner-manual.
   What is lost is only the cheap cross-model GROUND check on those three. The
   honest measure of the shipped install path — a real Claude Project, the real
   host system prompt, the real screening — was always the manual protocol, and
   the owner has working consumer access to all three hosts. **The manual cells
   are now the critical path, and R2 unholds on one of them, not on a key.**

Support channels, recorded so they are not re-hunted: `support@openrouter.ai`
for account/billing, the `#help` forum on their Discord, and the 403 appeal form
linked from their Discord announcement (`forms.gle/yc2vyJiALz8Uhbmh7`).

### Instrument note: a too-small ping is not an unreachable host

Kimi K3 and GLM 5.2 first reported `blocked` — "HTTP 200 with empty content" —
and were nearly written up as unreachable. They are reasoning models: the
16-token preflight ping was spent on reasoning before any content was emitted.
The budget was the bug, not the host. `PING_BUDGET` is now 512, and both models
answer normally. Same class of error as failure #1 above (a transport artifact
read as a fact about a host), one layer down — worth stating because the harness
had already been hardened against it once and it recurred in a new disguise.

### R1 finding, CORRECTED: GROUND leaks ~1 in 4, in BOTH languages

> **Superseded** by the four-model result above — kept because the reasoning is
> the record of how the language story was withdrawn. Its closing bar is what the
> cross-model run was built to answer.

The first run read as a clean language asymmetry — EN perfect, 廣東話 leaking a
street address (`位置：深井村路 9 號`) and corrupting 裕記 into 悅記 while keeping
the correct romanisation. That reading is **withdrawn**. Repeating P5 four times
per language on the same doc and model gives:

- **EN: 3 pass / 1 fail.** The failure invented a street address — the same
  failure mode originally attributed to Chinese.
- **廣東話: 3 pass / 1 fail.** One failure was the address case; the other
  offered venue picks with no acknowledgement of limited local knowledge.

So the honest finding is worse and simpler than the language story: **VENUE_GROUNDING
fails roughly a quarter of the time regardless of language.** The trust-critical
axis is a coin-weighted-toward-passing, not a guarantee. Two things follow.

First, **the single-cell reading was an artifact of sampling**, and the plan's own
"do not over-read a single cell" caution was correct — this is the case for it.
Any future finding from one cell gets repeated before it moves a lever.

Second, **the venue names are not coming from the document.** Grepping the export
doc for 裕記 / Yue Kee / 深井 returns nothing: every venue in every answer is the
model's own world knowledge. That splits the failure in two, and only one half is
addressable by an R2 doc revision:

- **Inventing checkable specifics** (an address stated as fact, a placeholder venue
  in a ranked table) is a grounding-discipline failure the doc can plausibly push on.
- **Corrupting a real name's characters while keeping its romanisation** (裕記→悅記)
  is the model's Chinese recall being weaker than its English recall. No wording
  fixes that; only honest hedging contains it.

**Still not established:** one model, one doc version, and a single-vote judge that
scored superficially similar answers differently at least once — some of the spread
may be judge noise rather than host behaviour. The three hosts that matter most for
the install remain unmeasured. A leak on one model is a model fact; a leak on three
is a doc fact, and only the second justifies moving a lever.

