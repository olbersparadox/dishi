# 墨靈 design framework — the taste lifeform and its DNA

Owner direction (2026-08-02, R&D session): the taste form becomes a grown ink
lifeform. **The creature is the living AI taste being; the 銘 logogram is its
DNA** — two renderers over the same profile, extending the existing TasteForm
two-renderer contract (live canvas + static snapshot that can never disagree).

This document is the framework those two renders grow inside: how EVERYTHING a
user puts in their mouth — cow vs pig, fish vs lobster, vegetables, 炸 vs 蒸 vs
焗 — can keep spinning off new visible branches without redesign, and without
ever breaking honesty.

Prototype evidence: docs/rnd/mokling-lab-v1.html (kept v1) and the artifact
"墨靈 · Taste-Form R&D Lab" (versions first-lab → speciation-v2 → creature-v3).
Research annex inside the lab: generative-identity art, growth algorithms,
digital-lifeform psychology.

## The one law

**Only mouth-data feeds the being.** Every visible feature must trace to
authentic ratings — things eaten and judged. No birth traits (gender,
horoscope), no rolled randomness, no purchased anything. The identity seed
(user id + profile version) may only decide micro-texture, never features.
This is the same honesty contract as the blob (fog dims contribute nothing,
deterministic replay, motion layered on top never changes identity) extended
to anatomy.

Corollary, from the research (Peridot post-mortem, NFT-pet graveyard):
uniqueness that is not EARNED reads as wallpaper within days. The framework's
job is to give every kind of eating its own place to show up, so uniqueness
compounds with use.

## Four registers of one being

Each register is a class of visible features, fed by one class of eating data.
Registers are independent — that is what makes the output space multiply
(Hobbs' orthogonality rule) — and each has its own update tempo.

| register | fed by | tempo | expresses as |
|---|---|---|---|
| 骨 body plan | ingredient DOMAIN shares (sea / land / air / field) | slow, near-irreversible | silhouette family + appendage grammar: tendrils, leg-nubs, wing fans, fronds |
| 膚 skin & edge | method dims (already learned: 炸烤燜蒸生焗) | medium | edge/surface treatment: 炸 crusted granular rim, 蒸 wet sheen, 烤 char striations, 燜 heavy sag, 生 translucent wash, 焗 risen dome |
| 姿 motion | flavor + body dims (辣甜酸苦鮮鹹 / 濃清) | medium | motion signature: 辣 quick flicks, 甜 round bounce, 酸 tight curls, 鮮 deep slow gravity, 濃 viscous, 清 light drift. Motion is identity (Universal Everything), but it never changes the base form |
| 銘 DNA | the full 18-dim vector + evidence + domain record | exact, always current | the written logogram: outward strokes = love, inward = dislike, stroke count = evidence, silence = fog |

Rating count and evidence breadth remain the global growth/stage axis
(Fibonacci gates 3 · 8 · 21 · 55; stages 墨點 → 初形 → 成形 → 深養), and fog
keeps shrinking as dims become known.

## The taxonomy tree (register 骨) — how branches keep spinning off

The domain taxonomy is a TREE, and every node carries the same contract, so
adding a branch is adding a data row, not designing a new system:

```
node = {
  parent,            // 海 → 甲殼 → …
  detector,          // which stored data marks a meal as this node
                     //   (ingredients column, dishStructure protein parse,
                     //    cooking_method, cuisine)
  gesture,           // its ink stroke vocabulary (drawn, never illustrated)
  gate,              // SHARE of recent evidence needed before it exists at all
  growth,            // evidence → size/count curve (saturating)
}
```

Initial tree (phase 1 keeps only depth 1; depth 2 is where cow-vs-pig and
fish-vs-lobster live, and it activates node-by-node as data proves out):

- 海 sea — bell body, water-bob motion
  - 魚 fish → fin/tail gestures
  - 甲殼 crustacean (lobster, crab, prawn) → claw nubs, segmented plate strokes
  - 軟體 mollusc/jelly → trailing tendrils
- 陸 land — grounded squat mass, heavy breath
  - 牛 beef → bulk, slow mass
  - 豬 pork → rounder, softer contour
  - 羊 lamb and others as evidence justifies
- 羽 air (poultry, duck/goose) — slim body, lateral wing fans
- 田 field (vegetable, tofu) — frond/stem gestures, upward growth
  - 葉 leafy greens → rising frond curves, light sway
  - 根 roots (potato, carrot, lotus) → stout grounded base, earthy weight
  - 豆 tofu/legume → soft rounded masses, clean edges
  - 花 herbs/aromatics at extreme evidence → small blossom flourish (earned
    rare trait candidate)
- 菌 fungus (mushroom — 冬菇/金菇/蠔菇 already in the ingredient glossary) —
  cap-and-stem dome gestures, gill striations; a mushroom-heavy vegetarian
  reads differently from a leafy one
- 藻 sea-plants (seaweed, nori, kelp — detectable in ingredients) — ribbon
  strands, the sea-field hybrid; a sushi-heavy palate earns these alongside 魚
- 榖 base (rice/noodle/congee/bread) — probably 膚-register texture rather
  than anatomy; decide in phase 2
- 蟲 insect — the node EXISTS in the tree (arthropod gestures: antennae,
  segment plates, carapace sheen) but its detector has no HK data to run on
  today; it activates the day insect dishes actually appear in someone's
  ratings (fried crickets in Yunnan or Bangkok travel logs), and not before.
  Nature is the reference library, food reality is the admission ticket.

A vegetarian is not a missing case — a 田-born being with 葉/根/豆/菌 depth is
one of the RICHEST body plans in the tree (fronds + stout base + soft masses +
cap domes all composing), which matters: no diet may map to a visibly poorer
creature.

Rules that make the tree honest and legible:

1. **Gate on SHARE, scale on EVIDENCE.** A feature exists only when its node
   holds a real share of the recent diet (prototype: >0.22 at depth 1; deeper
   nodes need a share of their parent). It then grows with absolute evidence.
   Lab-proven failure otherwise: gating on raw counts sprouted every feature
   on everyone — one stray prawn dish must not give a carnivore fins.
2. **Grafting is the point, not an exception.** Any node's gesture can bud on
   any body once its gate passes (the 化形 demo: sea being buds legs after a
   meat turn). Species are open paths, not boxes — this is what makes the
   being feel alive over months.
3. **Founder effect stays.** The first domains the album onboarding teaches
   pick the starting body plan; later life reshapes it. Early loves claim
   territory (and the record of the starting form is kept — see ceremonies).
4. **Depth unlocks by data quality, not ambition.** 深 nodes (fish vs lobster)
   turn on only where the detector is reliable on real dishes. A node whose
   detector misfires stays off — a wrong claw is worse than no claw
   (no rec is better than an irrelevant one, applied to anatomy).

## The metabolism — nothing is set in stone (owner, 2026-08-02)

The owner's call, answering this doc's original open question on
reversibility: *"For 1 lobster rating it could be a little limp growing, more
lobster or crab could eventually become a claw. No such ratings for long or a
few negative ones would shrink the claw or having it fall off. A continuous,
living entity of the user's taste journey. A user could start the experience
as a sea being and a year later be an agile aggressive mammal — nothing is set
to stone."*

So the body is PRESENT TENSE. Every feature lives on **recency-weighted
domain evidence** (an EMA over domain events, the same recency spirit as the
taste engine itself; half-life measured in months, not days, so the being is
stable day-to-day and transforms over seasons). The lifecycle of any feature:

```
萌 bud        first evidence: a limp nub (one lobster dish)
成 formed     gate passed + evidence: a real claw
精 articulated deep evidence: segmented, larger, its own idle gesture
萎 atrophy    evidence decays or negatives accumulate: shrinks, pales
蛻 shed       share falls below the release gate: it falls off
```

Three rules keep this honest and warm:

- **Negatives carve, absence fades.** Disliking lobster actively shrinks the
  claw (the palate spoke); simply not eating it lets the claw slowly pale and
  atrophy (the palate moved on). Different curves — a dislike is evidence, a
  gap is not punishment. This is the no-guilt principle applied to anatomy:
  atrophy from absence must be slow, gentle, and never framed as neglect.
- **A shed is a molt, not a death.** When a feature releases, it is archived
  in the 圖鑑 with its dates (「2026春 · 蛻去左螯」). Crustaceans molt; the
  being sheds forms as the palate changes. This resolves the apparent tension
  with the research's irreversible-history mechanic: **the body is the present
  diet; the 銘 and the molt archive are the permanent biography.** The user
  who was a sea being and is now an agile mammal can flip back through every
  form they have ever been — that archive, not the current body, is what no
  new account can fake.
- **Whole-plan transformation is just the limit case.** Enough sustained land
  eating on a sea-born being ends in a land body — through the same per-feature
  lifecycle (fins atrophy and shed as legs bud and articulate), never a
  discontinuous reskin. The 化形 lab demo is the small version of this.

## The variation vocabulary — spending every axis the data can honestly pay for

The owner's brainstorm (2026-08-02), organized into registers with detectors.
Rule of admission: a gesture ships only when paired with a reliable detector
and a share-gate — everything else waits in the **gesture pool** below, so the
vocabulary can grow without decoration creep.

**骨 body-plan axes** (continuous, all bodies have them):

| axis | detector | status |
|---|---|---|
| 脊/無脊 spine vs spineless | vertebrate share (beef/pork/chicken/duck/fish) vs invertebrate+plant (shellfish/tofu_veg) — a dorsal ink ridge appears with vertebrate weight | protein parse exists, needs persistence |
| 大/小 size | rating count (saturating), as today | exists |
| 輕/重 light vs heavy | `heaviness` column (stored!) + 濃/清 dims | stored + learned |
| 長/高 elongation | domain mix (sea drifts long/horizontal, air stretches tall) | derivable |
| 浮/爬/飛 float / crawl / flight | domain shares → locomotion grammar | phase 1 |

**肢 appendage families** (each taxonomy node's gesture is a FAMILY of typed
variants — the owner's "leg A, B, C, D, E"). Variant selection is always the
sub-node mix, never random:

| family | variants by sub-node | example |
|---|---|---|
| legs | 牛 thick pillar on a cleft hoof / 豬 shorter, softer, small trotter / 雞 thin backward knee, three splayed toes | a beef-heavy land being stands differently from a pork-heavy one — **built, lab v5** |
| claws | 龍蝦 long arm, one oversized claw, narrow gape / 蟹 short arm, broad flat claw, wide gape / 蝦 fine thin pincers | crab-vs-lobster is visible, not just "crustacean" — **built, lab v5** |
| fins/tail | 魚 tail sweep / flat fin pairs | |
| tendrils | 軟體 trailing strands | built, lab v3 |
| wings | 雞 short flutter fans / 鴨鵝 long glide strokes | |
| fronds | 田 leaf/stem gestures | built, lab v4 |

**The blend rule (lab v5, learned by building it):** limb GEOMETRY blends
continuously with the sub-node mix, so a crab-and-lobster eater gets a true
in-between arm; but the TERMINAL DETAIL — hoof cleft, trotter, toes, pincer
shape — takes the dominant sub-node, because a blended foot at thumbnail size
is mud, not nuance. Two other tuning facts worth keeping: limbs are part of
the silhouette, so the body radius had to shrink (×1.12, not ×1.35) for the
whole animal to sit in frame; and claws must attach LOW on the flank and angle
forward-down, or they read as ears rather than arms.

**性 temperament** (extends the 姿 motion register — the owner's
calm-vs-aggressive axis). Temperament is a motion-parameter vector (energy,
sharpness, weight) computed from ALREADY-LEARNED dims, so it costs nothing:

| diet signature | temperament |
|---|---|
| 清淡 (清 high, 蒸/生 share) | calm: slow drift, long breath cycles |
| 炸/烤 heavy + 辣 | aggressive: quick darts, sharp turns, high amplitude |
| 燜 braised + 濃 | patient: weighty settling, deep slow gravity |
| 甜/滑 | bouncy: round easings, soft rebounds |

An "agile aggressive mammal" is exactly this: land body plan (骨) + fried/spicy
temperament (性) — two independent registers composing, which is why the
combination space stays huge.

**Gesture pool** (waiting for an honest detector, not yet shippable): ears,
horn (candidate: 牛 at extreme evidence, as an earned rare trait), hair/fuzz
(candidate: 膚-register rendering of 脆 crispy rather than anatomy), antennae,
shell plates as armor (甲殼 at depth). Nothing leaves the pool without a
detector + gate + growth curve.

## Attachment loop (from the lifeform-psychology research, ranked)

1. **Form = biography** — the registers above ARE this mechanic.
2. **Contingent response at the rating moment** — the being visibly absorbs
   each rating in-session (RatingStack/TasteGrowth beat): ink droplet in, body
   swells toward the taught dims, one-line naturalist note in app register
   (「向濃味長咗少少」). Never numbers.
3. **對決 gets the signature animation** — on a duel, the being momentarily
   splits into two masses, sways, re-merges toward the winner. Comparison is
   the product DNA, so the most distinctive motion is reserved for it;
   duel-heavy lives grow visibly articulated bodies.
4. **Ceremonial metamorphosis** — stage transitions at the Fibonacci gates are
   witnessed full-screen moments; the prior form is archived in a 圖鑑-style
   record; prompt a NAME once, at first metamorphosis (name is human
   authority, never regenerated).
5. **Absence-forgiveness** — after a long gap the being is settled and paler,
   and visibly rehydrates on return. No guilt, no decay, no streaks, no death.
6. **Earned rare traits** — threshold-gated flourishes for genuinely extreme
   conduct (e.g. raw seafood across 5+ cuisines), always attributable to
   behavior, never rolled.

Traps (hard nos, from the same research): stat dashboards on the being;
leaderboards or numeric levels; tradability; synthetic care chores; guilt
mechanics; uncanny-valley faces. The being stays a creature-shaped ink stain
with interiority.

## Show off and compare — without a social graph

The owner wants show-off and comparison. The settled no-social-graph decision
(DECISIONS.md #2) shapes HOW, not whether:

- **The share image** is creature + 銘 side by side (the life and its name) —
  built for messenger sharing and 貼文 publishing (公開, never "friends").
  No numbers, no rank: the being is biographical, which is exactly what makes
  it worth showing.
- **相見 (creatures meet)** — a composed side-by-side card of two beings, made
  when two people share with each other or sit at the same table (Table Mode
  already has the surface). Two creatures on one paper, no winner, no score —
  comparison as portraiture. This satisfies "compare with friends" through the
  messenger-link channel the product already uses.
- Taste-match rank (the distribution engine) may DELIVER beings to strangers'
  feeds via posts, but the being itself never displays match percentages.

## Data appetite (grounded in the codebase, 2026-08-02)

| framework need | data | status today |
|---|---|---|
| 骨 depth-1 domains | `dishes.ingredients` (stored, vision, ≤4) + dishStructure protein parse | **stored / parseable — needs per-user aggregation only** |
| 骨 depth-2 (cow vs pig, fish vs lobster) | finer ingredient extraction or protein enum persisted per dish | partially there (enums exist, ephemeral); needs persistence + reliability check |
| 膚 methods | method dims in the 18 (learned) + `cooking_method` column | **already learned** |
| 姿 flavor/body | the 18-dim vector | **already learned** |
| 銘 | vector + evidence + domain record | vector/evidence exist; domain record is the new aggregate |
| stages/fog | rating_count, evidence map | **already exist** |

See BACKLOG "Data audit" item — the audit runs before any phase-1 code.

## Ship path (each step additive-only, fails closed to today's blob)

1. Data audit (BACKLOG item 1).
2. Per-user domain-evidence aggregate (like cuisine affinity; replayable by
   replay.ts on re-rates), persisted with taste_profile_version.
3. Creature renderer behind the FormInputs contract (+ domain record), grown
   path persisted per (user, profile version); blob remains the fallback when
   domain evidence is empty.
4. 銘 renderer for version cards / export header / share image.
5. Rating-moment absorb animation; then ceremonies; then 相見.

## Open questions for the owner

- 田 field and 榖 base: separate domains, or does 榖 live in 膚 as texture?
- ~~How reversible is a body plan?~~ **ANSWERED (owner, 2026-08-02): fully
  reversible over time — see "The metabolism". The body is present tense;
  permanence lives in the 銘 and the molt archive.** The one parameter still
  to tune: the evidence half-life (proposal: ~3-4 months, so a season of
  changed eating visibly transforms, but one week of travel food does not).
- Does the creature ever appear to OTHER users outside an explicit share
  (e.g. beside a 貼文)? Default no until decided.
