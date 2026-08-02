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
- 榖 base (rice/noodle/congee/bread) — probably 膚-register texture rather
  than anatomy; decide in phase 2

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
- How reversible is a body plan? (Proposal: grafts accumulate, the base plan
  never flips — a sea-born being that turns carnivore becomes an amphibian,
  not a retroactive mammal. Path is biography; biography does not rewrite.)
- Does the creature ever appear to OTHER users outside an explicit share
  (e.g. beside a 貼文)? Default no until decided.
