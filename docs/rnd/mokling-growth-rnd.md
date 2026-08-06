# 墨靈 growth R&D — the metabolism made real

*Drafted 2026-08-06 (Fable) from the owner's brief. Status: PROPOSAL — nothing
here is built until the Ledger in `mokling-framework.md` says so. This doc is
the design; the framework doc stays the authority on what exists.*

## The brief (owner, 2026-08-06, compressed)

1. Build the missing **sub-nodes** (wings, legs, tails, fins, antennae,
   tentacles…) so the LAB-ONLY gestures can go live.
2. Design **growth**: maximum variety AND authenticity. Claws and wings
   **coexist** — eating chicken after a crab history grows wings *beside* the
   claws, never instead of them. Limbs **shrink and fall off** only from long
   absence or repeated negatives.
3. A diet spans many domains — the body must show the **combined intake**.
4. **Both reward loops at once**: long-term grooming (baby → mature beast,
   attachment through effort) and instant gratification (ate crab → rated →
   claw appears). The owner will fund extra visual build to deliver both.
5. Product angle: **「You are what you eat」 — dishi.username IS what you
   feed it.** Freshly-eaten dishes should shape the body more than old
   backfilled photos, because current eating reflects the current you.

Most of the *concept* already exists in `mokling-framework.md` — the owner
specified 萌→成→精→萎→蛻, "negatives carve, absence fades", and the 圖鑑 molt
archive on 2026-08-02. What this doc adds is the missing *mechanics*: the
gate redesign that makes coexistence real, the time model that makes 萎/蛻
real, and the build order.

---

## Diagnosis: the share gate punishes exactly the diet we want to reward

Today a feature exists only when its domain holds **>0.22 of total evidence**
(plus the absolute floor). Shares are zero-sum — so the more *varied* the
diet, the fewer features pass. This is not hypothetical; it is measured on
the owner's own 60 rated dishes (ship-path step 2 notes):

> sea 31.7% · land 22.3% · shell 20.3% · field 9.6% · **air 7.3%** · 藻 4.4% · 菌 4.4%
> → grows tendrils and claws, and **nothing else, ever**. Legs sit a hair
> under the gate; wings are unreachable at 7.3% no matter how much chicken
> is eaten, unless the rest of the diet shrinks.

The owner's ask — "eating chicken should also grow a pair of wings" — is
precisely the case the shipped gate forbids. A seven-domain HK eater
(everyone) has ~14% uniform share; almost nothing clears 22%. **The share
gate makes variety read as poverty.** That is the central thing to fix.

The lab history explains why the gate exists, and both failure modes must
stay dead (framework, tree rule 1):

- gate on raw counts alone → one stray prawn dish gave a carnivore fins;
- gate on share alone → two veg dishes out of five gave a dessert eater
  full fronds ("a large slice of almost nothing is not evidence").

The redesign below keeps both protections — but moves them to the right
places.

## Decision 1 — existence by absolute evidence; prominence by share; safety by decay

Split what the old gate conflated:

| question | answered by |
|---|---|
| does the limb EXIST? | **absolute lived evidence** (decayed — see Decision 2) |
| how BIG / DOMINANT is it? | **share**, as a continuous dial, never a door |
| is it honest? | the floors + decay: stale or trivial evidence sinks below the bud floor on its own |

Per-node stages, all driven by the node's **decayed** evidence `ev` and the
body's share picture:

```
萌 bud          ev ≥ BUD_FLOOR (~1.2)      a small nub. Share-independent.
                                           One LOVED first dish (weight 1.5)
                                           buds immediately — the owner's
                                           "1 lobster rating → a little limp
                                           growing". One neutral dish (0.5)
                                           does not.
成 formed       ev ≥ FORM_FLOOR (~5)       the real limb — today's absF floor,
                                           unchanged.
精 articulated  ev ≥ ~12 AND top-2 share   segmented, larger, own idle gesture,
                                           terminal detail.
萎 atrophy      (emergent)                 decay pulls ev back down the same
                                           ramps — the limb shrinks through
                                           formed → bud continuously, and
                                           PALES with time since the node
                                           last saw an event.
蛻 shed         ev falls through            only for limbs that reached 成:
                SHED_FLOOR (~0.7)           a witnessed release + 圖鑑 entry.
                                           A bud that fades unformed just
                                           reabsorbs silently — no ceremony
                                           for a nub. Hysteresis (shed floor
                                           < bud floor) stops flicker.
```

Size composes as:

```
size = base × stageRamp(ev) × (0.6 + 0.4 × share/maxShare)
```

so the dominant node reads dominant (full size), minor-but-real nodes read
present (≥60%), and nothing is denied existence for being a minority of an
honest appetite. **The 0.22 share door is retired.** Share's zero-sumness —
the bug at the existence level — becomes the *feature* at the prominence
level: only two or three nodes can ever be visually dominant at once, which
is the natural crowding budget.

Why the lab's failure modes stay dead:

- *Stray prawn dish:* one neutral dish (0.5) never buds; one loved dish
  (1.5) buds a **nub**, which — under Decision 2 — decays below the bud
  floor in a few weeks if never repeated. The lab's version of this failure
  granted a **permanent, full-size** feature; a temporary honest nub is not
  a failure, it is the instant-gratification loop working.
- *Dessert eater's 40% share:* share no longer grants anything. Two veg
  dishes ≈ ev 1–3 → at most a bud, and a fading one.

**Decay is what makes low floors safe.** These two decisions only work as a
pair — that is the core insight of this design.

## Decision 2 — time IS the metabolism: a continuous-time EMA over eaten-dates

Today `domain_evidence` is a lifetime sum — deliberately pure, replayable,
no wall-clock decay (the accumulator's own comment: "absence fades belongs
at read time"). Keep the purity, add the clock:

```
node record:  { v, at }                    // evidence v, as of time `at`
decay(v,Δt) = v · 2^(−Δt / HALF_LIFE)      // HALF_LIFE ≈ 120 days, tunable
on event(t): v = decay(v, t − at) + weight ; at = t
at read(now): ev = decay(v, now − at)
```

- **The event clock is `eaten_at ?? created_at`** — when the dish was
  *eaten*, falling back to when it was logged. The domain walk in `replay.ts`
  sorts by this clock (the palate walk keeps its own rating order — the
  palate learns in the order you *judged*; the body lives on when you *ate*).
- **Weights are unchanged**: `0.5 + calibrated score`, split across the
  domains a dish hits; negatives still subtract, floored at zero; sub-bags
  still positive-only. So "**negatives carve** (immediately, at event time),
  **absence fades** (slowly, by half-life)" — the two curves the metabolism
  spec demands, from one mechanism each.
- **Still a pure function** — of (history, asOf). Replay rebuilds it
  identically; a rename or backdate heals the body exactly as it heals the
  palate. `renderAsOf = now` is just the newest input.
- **Storage**: a v2 record `{nodes: {sea:{v,at},…}, sub:{shell:{crab:{v,at}…}…}}`
  plus a read adapter `domainsAsOf(record, now): DomainEvidence` that emits
  the plain numbers the renderer already eats. **The renderer contract does
  not change**; snapshot parity and every creature test are untouched. A
  legacy record passes through undecayed — fails closed to today's behavior.
- Sub-bags decay on the same clock, so "which crustacean is your
  crustacean" stays present-tense: a lobster year followed by a crab year
  migrates the claw.
- Implementation notes: the replay dish select needs `eaten_at`; the
  eaten-date PATCH route must trigger the same profile rebuild a rename
  does (backdating now moves the body).

### Why this delivers 「You are what you eat」 without breaking equal-weight logging

CLAUDE.md's hard principle: restaurant, home, and album logging all count
the same — don't privilege the restaurant path. The owner's ask — fresh
dishes should out-grow old camera-roll backfills — sounds like a conflict.
It isn't, once the weight hangs on **when it was eaten, not where it came
from**:

- An album photo of a 2023 dinner enters at its 2023 eaten-date and arrives
  **already decayed**: it still writes biography (founder effect at
  onboarding, 圖鑑, the lifetime record) but barely moves the present body.
  Which is true: it reflects who you were.
- A menu-scan dish rated tonight — or a **home-cooked dish eaten tonight** —
  lands at full strength. Home cooking is not disadvantaged; *old eating* is.
- **Source never appears in the formula.** No grow-factor multiplier by
  path, ever — the principle survives because time does all the work the
  owner wanted a source-multiplier for.

Scanning and rating fresh meals becomes the only way to feed the
present-tense body — the engagement pull the owner wants — while the app
never has to say (or code) that one logging path is worth more.

Open sub-question (existing open thread): a backfilled album dish with *no*
EXIF date currently gets `created_at` = full present weight. Acceptable
default (the user can backdate via the existing eaten-date control, which
then honestly ages it); revisit if backfill-heavy onboarding distorts young
bodies.

## Decision 3 — the sub-node build plan (what unblocks the lab gestures)

Extends `domainEvidence.ts` exactly along its existing patterns (flags
first; morphemes only ever *split* a domain the flags established; most
-specific-first with strike-out). New `DomainEvidence.sub` bags:

| bag | detector | cost | unblocks (from the v7 vocabulary) |
|---|---|---|---|
| `sub.air = {chicken, duck_goose}` | **flags only** — `FLAG_DOMAINS` already reads them separately and discards the split | trivial | 翼 variants (雞 short round / 鴨鵝 long glide), 鴨 webbed feet, 禽 fan tail |
| `sub.land += {lamb}` | `lamb` flag (exists, unmapped) + morphemes 羊/lamb/mutton | trivial | 羊 pointed ears |
| `sub.sea = {fish, cephalopod}` | morphemes, only when `sea` established. **Order load-bearing**: strike 魚香 (fish-fragrant — no fish!) to nothing first; then cephalopod (八爪魚/章魚/魷/墨魚/octopus/squid/calamari — all contain 魚, so they must consume it); then fish (魚, fish, 三文, salmon, 吞拿, tuna, 刺身, sashimi, 鰻/鱔, eel, 鱈, cod, 鯛, 鯖/saba, 油甘/hamachi) | a careful vocabulary + tests | 鰭 fins, 魚 forked tail; 觸 tentacle variants |
| `sub.field = {leaf, root, soy}` | soy from the `soy` flag (free); 葉 (菠菜 芥蘭 生菜 白菜 通菜 西洋菜 spinach lettuce kale choy broccoli 西蘭花…), 根 (薯 蘿蔔 蓮藕 芋 山藥 番薯 potato carrot lotus taro yam…) | vocabulary + tests | 葉 plant-part variants, 根 stout base |
| time-of-day | `created_at` hour — the one genuinely new data source | deferred | 罪角 (owner's explicit call needed) |

Notes:
- Bivalves (蠔/帶子/蜆/青口) stay generic `sea` — tentacles are earned by
  cephalopods specifically; a wrong tentacle is worse than no tentacle.
- `prawn` pincers are **READY TODAY** — detector shipped (`SHELL_SUB.prawn`),
  only the gesture is missing. Cheapest visible win in the whole program.
- Fish-via-morphemes is chosen over persisting the `dishStructure.PROTEINS`
  parse for phase 1 (no schema change, same pattern as SHELL_SUB, testable);
  persisting the parse stays the phase-2 upgrade if morpheme reliability
  disappoints (framework tree rule 4: a misfiring detector stays off).

Detectors ship **before** any gesture port, invisibly — they only fill bags.
Gesture ports then follow the standing one-element-per-round method, each
using the four-step checklist already written into
`mokling-lab-v7-vocabulary.js`, owner sign-off between rounds.

## Decision 4 — composing the many-limbed body

Coexistence is already structural (independent per-family blocks in the
renderer); what needs rules is *crowding*, since Decision 1 lets more
families pass:

1. **Anchor slots are exclusive per family** (formalizing what the renderer
   mostly does): wings at shoulder, claws low-forward flank, legs at the
   bottom arc, fronds at the crown flanks, tendrils/tails trailing low,
   ears/horns crown (checked against the face vocabulary — the 牛耳-reads-
   as-eyes collision is documented). Two families never bid for one anchor.
2. **The prominence budget is automatic**: share/maxShare scaling means at
   most 2–3 families render near full size; everything else is a bud or a
   60%-scale minor limb. A 7-domain body is a silhouette with one or two
   loud statements and a fringe of small honest detail — not seven equal
   shouts.
3. **Blend rule stands** (lab v5): within a family, geometry blends with the
   sub-mix, terminal detail takes the dominant sub-node.
4. **精 is rationed by rank** (top-2 share), so articulation — the loudest
   visual register — cannot appear on five limbs at once.

## Decision 5 — the two reward loops, and the bridge between them

**Instant (the same event, three beats):**
1. *Bud-on-first-love* — Decision 1 makes a first loved crab dish grow a
   visible nub that day. This is the owner's exact scenario, delivered by
   the gate redesign itself, no extra surface needed.
2. *The growth screen names the anatomy* — `/api/ratings` already computes
   the next domain record in-line; return a `growth` delta (nodes whose
   stage or size-tier moved) and let `TasteGrowth` speak it in app register:
   「蟹爪 大咗少少」·「翼芽 冒咗出嚟」. Naturalist notes, never numbers
   (attachment-loop trap list).
3. *The absorb beat* (attachment loop #2, unbuilt) — the being visibly
   swallows the ink of the rating in-session. Ships later; the delta from
   (2) is its data feed.

**Long-term (weeks → months):**
- Per-limb 萌→成→精 progression and the global Fibonacci stages
  (墨點→初形→成形→深養) — the "baby → mature beast" arc. **No numeric
  levels, ever** (research trap list) — "level 10" is *shown*, as an
  articulated, many-storied body, not written as a number.
- 圖鑑 molt archive — with Decision 2, stage-crossing history becomes a
  **pure function of rating history**: the replay walk detects crossings as
  it goes (decay crossings between events have closed-form times), so the
  archive is deterministic, healable, and impossible to fake — the same
  honesty class as the 銘. Persisted as a `molt_log` beside
  `domain_evidence` for cheap reads; rebuilt by replay.
- 蛻 shed ceremony + 相見/share surfaces — the grooming payoff stays
  show-off-able without a social graph (framework's share-image section).

**The bridge:** the instant moment *is* the first step of the long arc made
visible — today's nub is the seed of next month's articulated claw — and
decay closes the loop from the other side: only continued eating keeps a
limb prominent, so the long arc keeps generating instant moments. One
mechanism, both loops. (Absence stays guilt-free: paling and slow atrophy,
"the palate moved on", plus the absence-forgiveness rehydrate beat — never
streaks, never death.)

## Ship path (each step additive, fails closed to today's behavior)

| # | step | visible? | risk notes | est. success |
|---|---|---|---|---|
| G1 | Timed accumulator v2 + `domainsAsOf` adapter + replay domain-walk on eaten-date; eaten-date PATCH triggers rebuild | invisible (adapter passes legacy through) | pure-function arithmetic on a well-tested pipeline; harness gets an as-of time-travel slider | ~80% |
| G2 | Gate redesign in the renderer (bud/form/articulate ramps, prominence dial, paling) | YES — owner reviews on /dev-creature with time-travel before it ships | the "does decay FEEL right" unknown lives here; tune HALF_LIFE + floors on the harness | ~75% |
| G3 | Sub-node detectors (air, lamb, sea fish/cephalopod with the 魚香 tripwire, field splits) + unit tests | invisible (fills bags nothing reads yet) | vocabulary quality; misfiring family stays off | ~85% |
| G4 | Gesture ports, one per round, owner sign-off each: **prawn pincers first** (detector already live), then 翼 variants (detector from G3-air), then 尾 tails, 鰭 fins, 耳/角… | YES, one element at a time | the standing working method; port checklist exists | ~70–85% per round |
| G5 | Reward surfaces: `growth` delta in the rating response + TasteGrowth line; absorb beat later | YES | small plumbing + copy | ~85% |
| G6 | 圖鑑: molt-log emission from replay, then the archive surface + shed ceremony | YES | new surface design | ~75% |

G1→G2 is the go/no-go gate for the whole metabolism: if decayed growth
doesn't feel alive on the harness, G3–G6 still stand on their own (sub-nodes
and gestures work fine on undecayed evidence — they just inherit the old
share gate until G2 lands).

## Owner decisions needed (before the step that consumes them)

1. **HALF_LIFE** — default 120 days ("stable day-to-day, transforms over
   seasons"). Tuned live on the G2 harness slider. (before G2 ships)
2. **BUD_FLOOR 1.2 / SHED_FLOOR 0.7** — i.e. one *loved* dish buds, one
   neutral one doesn't; shed only after having formed. (G2)
3. **No-EXIF album backfills = full present weight** — accept default, or
   prompt for a rough date at album onboarding? (G1, low stakes)
4. **罪角 / time-of-day** — the one new data source; explicitly deferred
   until called. (G3+)
5. **Crowding review** — after G2+first ports, a harness pass on a
   deliberately maximal body (all七 domains lived) to confirm the prominence
   budget reads as character, not chaos. (during G4)
