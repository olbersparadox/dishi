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
   feed it.** Encourage rating, full stop: every rating is a feeding, old
   photos count in full. The balance to strike is long-term grooming AND
   the instant gratification of rating something *new* — the same
   breadth-over-depth shape the taste engine already learns by. (A first
   draft read this as recency-weighting old photos down; **rejected by the
   owner 2026-08-06** — see Decision 3. Do not re-propose eaten-date
   discounting.)

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

## Decision 2 — time IS the metabolism: a continuous-time EMA on the feeding clock

Today `domain_evidence` is a lifetime sum — deliberately pure, replayable,
no wall-clock decay (the accumulator's own comment: "absence fades belongs
at read time"). Keep the purity, add the clock:

```
node record:  { v, at }                    // evidence v, as of time `at`
decay(v,Δt) = v · 2^(−Δt / HALF_LIFE)      // HALF_LIFE ≈ 120 days, tunable
on event(t): v = decay(v, t − at) + weight ; at = t
at read(now): ev = decay(v, now − at)
```

- **The event clock is FEEDING time — the rating's `created_at`.** The
  creature is fed by the act of rating; a 2023 photo rated tonight feeds at
  full strength tonight. This is also the simpler build: the replay walk
  already runs in rating order, so no re-sort, no second walk, no
  eaten-date plumbing. (First draft keyed this to `eaten_at`, which
  pre-decayed album backfills; rejected — see Decision 3.)
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
  crustacean" stays present-tense: a lobster year of feeding followed by a
  crab year migrates the claw.
- Atrophy therefore means exactly what the owner specified: **the creature
  hasn't been FED that node lately** — no ratings carrying it, whatever the
  meals' vintage. Keep rating anything and nothing starves.

## Decision 3 — instant gratification is NOVELTY, not recency (owner correction, 2026-08-06)

The first draft of this section weighted evidence by eaten-date, so old
album photos arrived pre-decayed. **The owner rejected that** — old photos
must count in full; the product's goal is to encourage rating, and a
backfilled photo rated today is a real feeding. Recorded here so no future
session re-proposes eaten-date discounting.

What the owner actually pointed at is the taste engine's own learning
shape: **breadth beats depth**. Applied to the body:

- **The creature is fed by ratings.** Full weight per feeding, no source
  multiplier, no vintage multiplier. Equal-weight logging holds trivially —
  neither source nor eaten-date ever enters the formula.
- **New information is loud; repetition is quiet — by saturation, not by
  bonus.** The stage ramps are saturating curves, so the *first* evidence
  of a node buds visibly that day (your first 鵝 dish: a wing nub tonight),
  while the 20th crab dish barely moves an already-formed claw. This is the
  same evidence-saturation shape the engine already uses everywhere (absF,
  the 銘's stroke tiers). No novelty multiplier is needed — **saturation IS
  the novelty bonus**, and it cannot be farmed, because only genuinely new
  nodes have steep ramp left.
- **Breadth is structurally enforced**, not just encouraged: one dish holds
  one rating (unique per user+dish — re-rates revise history and replay
  rebuilds, never double-feed), and a mixed dish splits its weight across
  the domains it hits. The only way to grow MORE body is to eat and rate
  more *kinds* of things — which is the palate the engine most wants to
  learn from anyway. Creature incentives and engine incentives point the
  same direction.
- **Album onboarding becomes a growth spurt, deliberately.** Backfilling
  fifty old photos is fifty full-strength feedings — the founder-effect
  body forms fast, which is exactly the "look what it already knows about
  me" moment onboarding needs.
- The engagement pull survives without any discounting: atrophy runs on
  the feeding clock, so a body stays vivid only while its owner keeps
  rating — anything, from anywhere. 「You feed it」 is literally the
  mechanic.

## Decision 4 — the sub-node build plan (what unblocks the lab gestures)

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

## Decision 5 — composing the many-limbed body

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

## Decision 6 — one node, many parts: expression choice (owner, 2026-08-06)

A sub-node is not one gesture — it is a POOL. Cow → legs · tail · horns ·
ears. Fish → fins · forked tail. Chicken → wings · splayed feet · legs.
When a node earns expression, something must choose WHICH part grows, and
that choice is a possibility multiplier — the owner: a seafood eater with
fins and tentacles has a steak; "either cow legs could grow OR a cow tail…
creating more possibilities is the goal."

A part REPRESENTS the animal eaten — it is never a receipt for the cut on
the plate. (A plate-names-the-part rule — eat 牛尾, grow a tail — was
proposed and **REJECTED by the owner, 2026-08-06**: too strict, too
inflexible, and most parts have no dish that names them — nobody eats a
"pig tail" or a "fish tail" dish. Do not re-propose part-morpheme
detection.)

Under the one law the choice may never be rolled — the seed only touches
micro-texture. The fork resolves by data:

1. **The body's own composition chooses — vacancy first.** Expression
   flows to the family whose anchor slot is least occupied on THIS body at
   THIS moment. The owner's example resolves exactly here: a seafood body
   already wearing a fish tail meets steak evidence → the tail slot is
   taken, so the cow expresses as LEGS. A pork-legged body meeting the
   same steak grows a cow TAIL instead. The order of a life's eating
   shapes the body — path-dependent morphology, per-user divergence,
   zero dice.
2. **Ties break by fixed per-node priority** (cow: legs > tail > ears >
   horns — locomotion before ornament), keeping replay deterministic.

Cross-node slot contention keeps the existing rules: one tail slot, the
dominant claimant wins it (the framework's 尾 row already reads "dominant
sub-node of the largest animal domain"), and the loser expresses through
its other parts. If the fish later atrophies and sheds, the slot frees —
and deep cow evidence may claim it at the next crossing. The body
rearranges over seasons, never all at once.

Evidence accounting: evidence lives at the NODE; parts are how the node
SPENDS it. Depth unlocks breadth-of-parts — at 萌/成, one part; at 精, a
second may bud, so a deeply-lived cow eventually stands on legs AND swings
a tail. On atrophy the most recently budded part sheds first — the
longest-standing expression of a node is the last to go.

Guards:
- **Replay determinism holds** — every input to the choice (body
  composition at the crossing, the priority order) is itself a pure
  function of prior history. A re-rate may legitimately re-route an
  expression; that is replay healing anatomy, as designed.

## Decision 7 — the two reward loops, and the bridge between them

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
| G1 | Timed accumulator v2 + `domainsAsOf` adapter, on the existing rating-order replay walk (feeding clock — no re-sort, no eaten-date plumbing) | invisible (adapter passes legacy through) | pure-function arithmetic on a well-tested pipeline; harness gets an as-of time-travel slider | ~85% |
| G2 | Gate redesign in the renderer (bud/form/articulate ramps, prominence dial, paling) | YES — owner reviews on /dev-creature with time-travel before it ships | the "does decay FEEL right" unknown lives here; tune HALF_LIFE + floors on the harness | ~75% |
| G3 | Sub-node detectors (air, lamb, sea fish/cephalopod with the 魚香 tripwire, field splits) + the 田雞-matches-雞 guard + unit tests | invisible (fills bags nothing reads yet) | vocabulary quality; misfiring family stays off | ~85% |
| G4 | Gesture ports, one per round, owner sign-off each, **with the Decision 6 expression rules** (vacancy → priority): **prawn pincers first** (detector already live), then 翼 variants (detector from G3-air), then 尾 tails, 鰭 fins, 耳/角… | YES, one element at a time | the standing working method; port checklist exists | ~70–85% per round |
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
3. **罪角 / time-of-day** — the one new data source; explicitly deferred
   until called. (G3+)
4. **Crowding review** — after G2+first ports, a harness pass on a
   deliberately maximal body (all 7 domains lived) to confirm the prominence
   budget reads as character, not chaos. (during G4)
