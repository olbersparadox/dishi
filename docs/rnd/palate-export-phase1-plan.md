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

