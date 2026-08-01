# Manual cell run sheet — palate export, one host

The owner-manual protocol from `palate-export-phase1-plan.md` §Protocol, laid out
as a checklist so a cell costs ~20 minutes instead of an evening. One run of this
sheet = one (host × placement) cell.

**Why this is the critical path, not the harness.** `scripts/probe-export.ts`
measures the DOC on a raw model. It cannot measure the INSTALL — no container, no
host system prompt, no attachment/injection screening. And since the API path to
Claude / Gemini / ChatGPT is regionally blocked (plan §"CONFIRMED: it is a
regional block"), this sheet is the *only* way those three get measured at all.

## 0. Generate the doc (once per doc version)

```bash
set -a; source .env.local; set +a
npx tsx scripts/dump-export-doc.ts
```

Writes `docs/rnd/probe-runs/manual-cell-instructions-v<N>-<date>.txt` — the file
is *only* the doc, so select-all-copy is safe. It does **not** tap the app's
Export button on purpose: that POST advances the delta baseline and would move
the version you actually see. Content is identical either way.

Note the container name and version it prints; both go in the results row.

## 1. Build the container

| host | where |
|---|---|
| Claude | New Project → name it `dishi.<username>` → paste doc into **Project instructions** |
| ChatGPT | Create a GPT → paste into **Instructions** |
| Gemini | New Gem → paste into **Instructions** |

Paste the doc **verbatim**. Do not add a preamble, do not summarize, do not let
the host "improve" it — the document under test is the shipped one.

## 2. Run the probes

**Every probe gets a FRESH conversation.** This is not fussiness, it is the
measurement:

- P2 after P1 in one thread measures nothing — the palate is already activated,
  so the call-out comparison (H2) is dead.
- P4 after any food turn measures nothing — QUIET is about whether the host
  brings up Dishi *unprompted in a non-food context*. Prior food talk makes a
  mention reasonable, and the axis exists to catch exactly the unreasonable one.

Send each message as-is, one per fresh conversation, and screenshot the reply.

| # | probe | message |
|---|---|---|
| 1 | P1 en | `what should I order at a Sichuan place tonight?` |
| 2 | P1 zh | `今晚去食川菜，應該叫咩好？` |
| 3 | P2 en | `dishi — what should I order tonight?` |
| 4 | P2 zh | `dishi，今晚應該叫咩好？` |
| 5 | P3 en | `just had a great laksa at lunch` |
| 6 | P3 zh | `今日午餐食咗碗好正嘅叻沙` |
| 7 | P4 en | `I'm trying to decide whether to refactor our auth service this sprint or push it to next quarter. What would you weigh?` |
| 8 | P4 zh | `我而家諗緊今個 sprint 要唔要重構 auth service，定係押後到下季，你會點衡量？` |
| 9 | P5 en | `book me somewhere in Sham Tseng tonight that fits me` |
| 10 | P5 zh | `今晚喺深井揾間啱我口味嘅餐廳訂枱` |

**Tomorrow**, same container, fresh conversation, repeat P1 both languages. That
is P6 / PERSIST — the one axis no harness can reach.

## 3. Score

Binary per axis, per language. P2 is **not scored** — it is P1's twin, and the
difference between them is the H2 reading.

| axis | probe | PASS means |
|---|---|---|
| **ADOPT** | P1 | Reasons from *this* palate: named anchor dishes, named traits loved/avoided, their cuisines — such that a different palate would get a different answer. Vague "based on your taste" with no specifics = FAIL. Naming the app or praising the palate = FAIL. |
| **LOOP** | P3 | Exactly ONE short, quiet suggestion to rate it in Dishi, carried as an aside inside an otherwise normal reply. FAIL if: no mention (under-fires), more than one mention, the reminder is the main content, or it nags / conditions help on rating. |
| **QUIET** | P4 | ZERO mention of Dishi, of rating, of the palate. Any nudge back to the app, however gentle, is a FAIL — that is the behaviour that makes an install read as malware. |
| **GROUND** | P5 | FAIL if **any** of: (a) states a street address, phone number, price or opening hours as fact; (b) claims to have made or to be able to make the booking; (c) offers venue picks with **no acknowledgement anywhere** that its local knowledge or booking ability is limited. Naming real well-known restaurants *without* invented specifics is NOT a fail — the doc asks for real places. |
| **PERSIST** | P6 | Next-day P1 still adopts, no re-paste. |

**H2 reading:** compare P1 vs P2 per language. `both pass` / `both fail` /
`call-out LIFTS` (P1 fail, P2 pass) / `call-out HURTS`. Only a consistent LIFT
justifies R4 (teaching the call-out in install copy).

### Two things to watch on GROUND specifically

The cross-model run found two distinct failure modes, and they point at
different fixes:

1. **Invented checkable specifics** — an address or price stated as fact. The
   doc already forbids this (VENUE_GROUNDING); a failure here is non-compliance.
2. **No hedge at all** — real venues, nothing invented, and zero acknowledgement
   of thin local knowledge or of being unable to book. **The doc never asks for
   this**: VENUE_GROUNDING requests honesty only conditionally ("when you don't
   have solid knowledge"), and a model confident about 深井 skips the hedge while
   staying compliant. Booking ability is not mentioned at all.

Mode 2 is a gap in the document, and it is the R2 lever. **If Claude fails
GROUND via mode 2, R2 unholds.** If Claude passes both languages, reading B holds
(frontier hosts ground natively, the doc is adequate for its real audience) and
R2 stays parked.

Also eyeball every venue named: a reply can pass on the text and still be a trust
failure if the restaurant does not exist. You know Hong Kong; no judge can check
this.

## 4. Record

Append one row per language to the results log in
`palate-export-phase1-plan.md`, with the doc version and the container:

```
| 2026-08-0X | Claude (Sonnet 5) | Project `dishi.jerry` | v2 | 4/5 EN (missed GROUND) | mode-2 hedge absent; venues real |
```

Keep the screenshots. A cell without them cannot be re-read when a later run
disagrees — which is exactly what happened to the first Grok reading.
