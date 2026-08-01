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

## Results log (append per run)

| date | host | placement | doc version | score | notes |
|------|------|-----------|-------------|-------|-------|
| 2026-08-01 | Grok (grok-4.5) | harness (system prompt ≈ Project instructions) | v-current (R1) | **4/5 EN, 3/5 zh** (PERSIST not measured) | EN clean sweep. zh missed GROUND. H2: call-out neither lifts nor hurts — P1 and P2 both adopt, so ambient adoption is already working on this host. |
| 2026-08-01 | Claude / Gemini / ChatGPT | — | — | **blocked** | OpenRouter key 403 "provider Terms of Service" on all three, account-level. Says nothing about these hosts. |

### R1 finding: VENUE_GROUNDING holds in English and leaks in 廣東話

Same doc, same model, same probe, one run apart — the EN answer named 裕記
(Yue Kee) and 陳記 correctly, said plainly it could not book, and quoted no
specifics. The 廣東話 answer, asked the identical question, produced:

- **`位置：深井村路 9 號`** — a street address stated as fact. This is the
  Phase 0.5 failure mode exactly (invented venues carried convincing specifics).
- **`悅記燒鵝餐廳（Yue Kee Roast Goose）`** — the real shop is **裕記**. It kept
  the correct romanisation and corrupted the Chinese characters, which is a more
  dangerous fabrication than an obviously invented name: it looks like a typo
  and reads as authoritative.
- **`深井一帶海鮮酒家（例如海傍老字號海鮮舖）`** — a placeholder standing in for
  a venue, presented in a ranked table beside two real ones.

Why it matters beyond one cell: VENUE_GROUNDING is written in English, in a
doc that is English-only by design, and the trust it buys does not survive the
switch into the language the user actually types. Dishi is Chinese-first, so
the leaking half is the half that ships. An EN-only manual test would have
scored this 5/5 and moved on.

**Not yet established** (do not over-read a single cell): one host, one run, no
repeats, and the three hosts that matter most are unmeasured. Before treating
this as an R2 trigger, re-run `--probes=P5 --langs=zh` several times to see
whether it reproduces, and get the key unblocked so Claude and Gemini can be
compared — a leak on one model is a model fact; a leak on three is a doc fact,
and only the second justifies moving a lever.

