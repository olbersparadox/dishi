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

## Ledger — what exists and what does not (authoritative, 2026-08-05)

**Read this table before answering "is X built?" — never answer from the
prose below, and never from a grep of one file.** This section exists because
that failure actually happened: asked whether tails and fins were in the
framework, a grep of `creatureForm.ts` alone returned nothing and the answer
came back "not in the framework at all — deliberately." Both halves were
wrong. They are specified here AND were built in lab v7; what is true is only
that they were never ported. Status used to live as inline prose scattered
across 600 lines of this document plus BACKLOG plus DECISIONS plus the code,
so "what is built" could not be checked, only remembered. A ledger is the fix;
memory is not.

**Keep it current in the same commit that changes a status.** A stale ledger
is worse than none, because it will be trusted.

**How this was built, so it can be rebuilt the same way.** Statuses were
GATHERED cheaply (a Haiku subagent listing every status-claim comment in
`src/`, so the raw scan never entered an expensive context), then ADJUDICATED
against code — one targeted grep per claim, never a broad file read. That
order matters: gathering returns what the repo *says*, and what the repo said
was wrong in two places. Two files asserted "nothing passes `domains` yet"
while four production surfaces passed it, one of them 150 lines below the
comment. **Never author this ledger from stated statuses alone.**

Status vocabulary, chosen so each word names a different KIND of not-done —
the distinction that matters is what it would take to finish:

| status | meaning |
|---|---|
| **SHIPPED** | renders in production today |
| **PORT-GAP** | built in lab v6, silently dropped when v6 was ported — spec and lab code both exist |
| **LAB-ONLY** | built in lab v7, never ported. Code is rescued into `docs/rnd/mokling-lab-v7-vocabulary.js` (2026-08-05) but has never rendered in production |
| **READY** | gesture unbuilt, but the detector data already exists today |
| **NEEDS-DETECTOR** | needs a new sub-node aggregate before any gesture is honest |
| **DEFERRED** | deliberately unbuilt; detector already specified |
| **KILLED** | deliberately removed — do not restore |
| **DORMANT** | in the tree by design, no data will exist for a long time |
| **POOL** | no detector, no gate — waiting |

### 骨 appendages

| gesture | variants | status | unblocked by |
|---|---|---|---|
| 觸 tendrils | generic | **SHIPPED** | — |
| 螯 claws | 蟹 · 龍蝦 | **SHIPPED** (`creatureGestures.ts`) | — |
| 足 legs | 牛 · 豬 · 雞 | **SHIPPED** (`drawLeg`) | — |
| 翼 wings | generic fan | **SHIPPED** | — |
| 葉 fronds | generic | **SHIPPED** | — |
| 藻 ribbons | generic | **SHIPPED** | — |
| 菌 caps | generic | **SHIPPED** | — |
| 螯 pincers | 蝦 prawn | **READY** | detector exists (`SHELL_SUB.prawn`); only the gesture is missing |
| 角 horns | 牛 · 脂 · 罪 | **LAB-ONLY** | 牛 READY (`LAND_SUB`), 脂 READY (`heaviness`), 罪 needs a time-of-day read |
| 耳 ears | 豬 · 牛 · 羊 | **LAB-ONLY** | 豬/牛 READY (`LAND_SUB`); 羊 needs `lamb` added to the land sub bag |
| 尾 tails | 魚 · 甲殼 · 牛 · 豬 · 禽 | **LAB-ONLY** | 甲殼/牛/豬 READY; 魚 and 禽 need their sub-nodes |
| 翼 wings | 雞 · 鴨 · 鵝 | **LAB-ONLY** | 羽 sub-node — **the diet flags already distinguish `duck_goose` from `chicken`** |
| 足 webbed | 鴨 | **LAB-ONLY** | same 羽 sub-node |
| 鰭 fins | 尖 · 圓 · 帶 | **LAB-ONLY** | 魚 sub-node × method |
| 觸 tentacles | 八爪 · 魷 · 水母 | **LAB-ONLY** | 軟體 sub-node (ingredient words — the pattern 藻 already uses) |
| 葉 plant parts | 闊葉 · 針葉 · 根 | **LAB-ONLY** | 田 sub-node (豆 is free from the `soy` flag; 葉/根 need words) |
| 脊 spine | dorsal ridge | **KILLED** | drawing rule 10 — tried three ways, all read as a seam |
| 蟲 antennae · carapace | — | **DORMANT** | no HK data until insect dishes actually appear |
| whiskers · plated armour | — | **POOL** | no detector |

### 膚 (the ONE 膚 section — no other passage in this file carries 膚 status)

**膚 is METHOD-ONLY** (owner, 2026-08-05; completed 2026-08-06). One skin per
cooking method, six total. 甲 shell and 毛 hairy are 骨 body parts, not skins —
they have **LEFT the precedence chain entirely** and are now independent
overlays (`boneOverlay()`), drawn on top of whichever method skin is present.
Registers compose for real now: a steamed crab is soft AND armoured, a grilled
land eater char-branded AND furred.

`skinOf()` takes only `MethodShares` — it can no longer SEE domain evidence,
which is what structurally prevents 膚 from quietly re-acquiring a domain
dependency the way 軟 once did. That is the guarantee, not the comment above
it.

Draw order matters now in a way it did not before: while 甲/毛 sat in the skin
chain they were mutually exclusive with 糙, so nothing could overlap. As
independent layers they co-occur, so all four 膚 marks are drawn first and the
骨 overlays go on top.

| method | skin | status |
|---|---|---|
| 生 raw | 滑 smooth·wet + translucent wash + wet rim | **SHIPPED** — 生's alone |
| 蒸 steamed | 軟 soft (pale halo behind, dark core) | **SHIPPED** — pinned by `skinOf()` + tests |
| 炸 fried | 糙 rough — **owner's spec: one dot = a grey circle overlapping a black circle; 4 dots upper-right, 3 lower-left, none touching the rim** — plus crust nubs on the rim | **SHIPPED** |
| 燜 braised | 釉 glaze — **near-black rim, warmer pool inset from it, two speculars (long left flank, short hook upper-right)** — plus its body sag | **SHIPPED** |
| 焗 baked | 金 gold — **smooth top-to-bottom gradient, no marks at all**; tone stays in the house ink palette (the name is figurative, like 滑 "wet") — plus its risen dome | **SHIPPED** |
| 烤 grilled | 烙 char-brand — **diagonal grill-iron stripes, one shared raking-light gradient across all ridges** | **SHIPPED** |

All six method skins are shipped. Rules that stood while designing them,
kept as reference for any future retune: verify at 200px AND 72px; all six
must stay distinct at 72px; the collision risk sits inside the wet family
(生·蒸·燜) and the dry family (炸·焗·烤), not across them.

Known gap, deliberately not fixed here: the share > 0.5 gate has no absolute
evidence floor, so one steamed dish with no other method evidence draws a
full skin. And a mixed palate clears no gate at all — the owner's own
profile (top share 蒸 at 0.306) wears none of the six. Fix together, with the
owner, not per-skin.


### 姿 · 銘 · 面

| feature | status |
|---|---|
| 姿 temperament + static posture | **SHIPPED** |
| 銘 logogram (replaced the radar) | **SHIPPED** 2026-08-05 |
| 眼 eyes ← BREADTH (~14/18 dims at KNOWS_AT) | **DEFERRED** — detector specified, data already exists |
| 口 mouth ← CONVICTION | **DEFERRED** — detector specified, data already exists |

Eyes and mouth are the one area where "not built" is fully intentional and
fully designed: both detectors are named, both read data that exists today,
and the rule (either, not both) is settled. They are waiting on the owner's
call about WHEN, not on any engineering.

### Metabolism — the feature lifecycle

Specified as 萌 bud → 成 formed → 精 articulated → 萎 atrophy → 蛻 shed.
Only the first half exists:

| stage | status |
|---|---|
| 萌 bud · 成 formed | **SHIPPED** (the share + floor gates) |
| 精 articulated | **PARTIAL** — claws have their own idle gesture; no general articulation stage |
| 萎 atrophy | **NOT BUILT** — `domainEvidence.ts` is deliberately a pure function of history with NO wall-clock decay |
| 蛻 shed | **NOT BUILT** |
| 圖鑑 molt archive | **NOT BUILT** — this is what makes the being a biography rather than a snapshot |
| evidence half-life | **UNTUNED** — open question; proposal ~3–4 months |

This is the largest conceptual gap in the whole framework. "Nothing is set in
stone" is the owner's central metabolism direction, and today the body can only
grow — it never atrophies or sheds. A being that only accumulates is not the
present-tense body the design calls for.

### Surfaces and ceremonies

Every **NOT BUILT** row below was verified by grep against `src/` on
2026-08-05, not inferred from this document's own prose — the failure mode
this ledger exists to stop. Each returned zero non-harness files.

| surface | status |
|---|---|
| creature on Taste tab · public dossier · growth screen | **SHIPPED** (`953abcd`, via `TasteFormLive`) |
| SVG snapshot renderer (`TasteFormSnapshot` + `canvasToSvg.ts`) | **BUILT, PARITY-VERIFIED, UNUSED** — mounted only in dev harnesses; no production consumer exists yet |
| share image (creature + 銘 side by side) | **NOT BUILT** — renderer ready |
| version cards · export header | **NOT BUILT** — renderer ready |
| rating-moment absorb beat | **NOT BUILT** — `RatingStack.tsx` holds no reference to the being at all; the creature appears only afterwards, on the growth screen |
| 對決 split animation | **NOT BUILT** — the duel components reference no creature; ranked #3 in the attachment loop |
| ceremonial metamorphosis (Fibonacci gates) | **NOT BUILT** |
| 相見 two beings meet | **NOT BUILT** |
| absence-forgiveness (settled/paler, rehydrates) | **NOT BUILT** |
| earned rare traits | **NOT BUILT** |

**The snapshot row changes the roadmap and is worth reading twice.** The three
still-unbuilt static surfaces — share image, version cards, export header —
were assumed expensive because a being had to be drawable as a still. It
already is: the SVG renderer exists, matches the canvas within measured
tolerance, and is exercised by the parity panel. Those surfaces need a
consumer, not a renderer. Conversely, a renderer with no consumer is exactly
the thing that rots unnoticed, so its parity test is load-bearing.

### Detector layer — what unblocks what

The single highest-leverage table here: most LAB-ONLY gestures are NOT blocked
by missing data. They are blocked by sub-node aggregation that in several cases
is nearly free, because the flag or parse already exists and is simply not
recorded per user.

| sub-node | exists today? | unblocks |
|---|---|---|
| shell: lobster · crab · prawn | **YES** (`SHELL_SUB`) | claws ✓, prawn pincers, 甲殼 tail |
| land: beef · pork · chicken | **YES** (`LAND_SUB`) | legs ✓, 牛角, 豬/牛耳, 牛/豬 tails |
| land: lamb | no — the `lamb` flag exists, there is just no sub bag entry | 羊 ears |
| air: 雞 vs 鴨鵝 | no — **but `FLAG_DOMAINS` already reads `chicken` and `duck_goose` separately** | wing variants, webbed feet, 禽 tail |
| sea: 魚 fish | no — `dishStructure.PROTEINS` parses `fish`, but it is ephemeral (merge-veto only, never persisted) | fins, 魚 tail |
| sea: 軟體 mollusc | no — needs ingredient words, exactly the pattern `ALGAE_WORDS` already established | tentacle variants |
| field: 葉 · 根 · 豆 · 花 | no — 豆 is free from the `soy` flag; 葉/根 need words | plant-part variants |
| time-of-day | no — dishes carry timestamps, nothing reads the hour | 罪角, the framework's one genuinely new data source |
| 榖 base | **UNDECIDED** — skin texture or anatomy? | 田's base ingredients |

### Two structural risks, named so they stop being invisible

1. ~~The v7 drawing code exists only in the external artifact.~~ **RESCUED
   2026-08-05** → `docs/rnd/mokling-lab-v7-vocabulary.js`. Extracted by exact
   line range from the artifact, diffed byte-identical against the source, and
   confirmed to parse. This closes the loss risk but changes nothing about
   port status — every gesture in that file is still LAB-ONLY until it renders
   in `creatureForm.ts`. The file carries its own porting checklist (re-base
   off `stub()` onto the real silhouette, wire the named detector, add both
   gates, route direction through the real body — the same four steps the
   original v6 port got wrong at least once each). It also separates the
   PORTABLE gesture library (VOCAB — parametric, one closure per variant) from
   the seven ONE-OFF fidelity sketches (TRACES — calibration reference only,
   not an API); the framework doc above did not previously make that
   distinction, and conflating them would have meant porting hardcoded traces
   as if they took arguments.
2. ~~Production has no single `out(ang, L)` appendage helper.~~ **BUILT
   2026-08-05** → `out(ph, L)`, exported from `creatureForm.ts`, unit-tested
   in `tests/creatureForm.test.ts` (pins the exact invariant that failed in
   the lab: `out(ph)` and `out(TAU-ph)` must mirror in x and agree in y — two
   independently-signed copies is the bug, one shared formula is the fix).
   The lab's own `out()` implementation does not survive in the rescued
   artifact — it belongs to a v8/v9 pass the owner reverted before that
   snapshot — so this was built fresh from the framework's own specification
   (`x=cx+sin(ph), y=cy−cos(ph)` ⟹ outward at ph is `(sin ph, −cos ph)`) and
   checked directly against `bodyAt`'s placement formula in production.
   **Deliberately NOT wired into the six shipped appendages** (wings, fronds,
   algae, tendrils, claws, legs) — each was checked against the same mirror
   invariant by hand and none carries the bug, so their owner-tuned geometry
   was left untouched rather than refactored with no visible benefit. It
   exists for whatever ports next from `mokling-lab-v7-vocabulary.js`.

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
| 骨 body plan | ingredient DOMAIN shares (sea / land / air / field / 菌 / 藻) | slow, reversible over seasons | silhouette family + appendage grammar: tendrils, leg-nubs, wing fans, fronds, caps, ribbons — **built, lab v3–v6** |
| 膚 skin & edge | cooking-method dims — **METHOD-ONLY since 2026-08-05** | medium | one skin per method. **This row carries NO status** — the live table is the "膚" section in the Ledger. (This row's old prose listed lab-v6 treatments including one the owner had killed, and misled the Ledger once; registers here describe the concept only.) |
| 姿 motion & temperament | flavor + method dims (辣甜酸苦鮮鹹 / 濃清) | medium | motion signature AND static posture: 辣+炸烤 → jagged edge, forward lean, quick darts; 蒸生+清 → smoothed contour, upright, slow drift; 燜+濃 → low centre of mass, heavy settle; 甜 → round springy profile — **built, lab v6** |
| 脊 spine | vertebrate share of the diet | slow | a dorsal ridge (lit crest + shadow) on vertebrate-fed bodies; crab and mushroom eaters have none — **built, lab v6** |
| 銘 DNA | the full 18-dim vector + evidence + domain record | exact, always current | the written logogram: outward strokes = love, inward = dislike, stroke count = evidence, silence = fog — **shipped 2026-08-05, merged into the radar as one figure** (see ship path 4) |

**Registers must be genuinely independent** (the v6 range test proves it): a
dessert life is near-silent in 骨 — 榖 (flour, sugar, dairy) is SKIN in this
framework, not anatomy — and loud in 膚 and 姿, producing a smooth risen dome
with almost no appendages. One being can max one register and zero another;
that orthogonality is what multiplies the output space.

**Temperament must survive a screenshot.** It was specified as motion, but a
being is seen still far more often than animated (version cards, exports,
share images, a scrolling feed). So temperament also sets static posture:
edge sharpness, forward lean, and centre of mass. Motion layers on top and
still never changes identity.

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
  - 甲殼 crustacean (lobster, crab, prawn) → claw gestures (**gesture built +
    calibrated 2026-08-04, NOT shipped** — see "Claw implementation rules")
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

1. **Gate on SHARE **and** an absolute evidence FLOOR; scale on evidence.**
   A feature exists only when its node holds a real share of the recent diet
   (prototype: >0.22 at depth 1; deeper nodes need a share of their parent)
   **and** that node has been genuinely lived (prototype floor: ~5 events,
   ~3 for claws). It then grows with absolute evidence.
   Two lab-proven failures, one on each side of this rule: gating on raw
   counts alone sprouted every feature on everyone (one stray prawn dish gave
   a carnivore fins); gating on share alone gave a dessert eater with two
   vegetable dishes out of five domain events a full set of fronds, because
   two-of-five is 40%. **A large slice of almost nothing is not evidence.**
   Both gates, always.
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

## The full stroke vocabulary (built, lab v7 — NOT ported)

> **Status:** every row below is **LAB-ONLY** unless the Ledger at the top of
> this document says otherwise. "Built, lab v7" means built in the artifact,
> not in the repo: the production port took the **v6** body (ship path step 3),
> so tails, fins, horns, ears, webbed feet and every multi-variant version of
> wings/tentacles/plant-parts stayed behind. Read the Ledger for the per-row
> truth and for which of these are detector-blocked versus merely unbuilt.

Owner's expansion, 2026-08-02: "many different tails… fins… wings, chicken,
duck, goose… horn, beside from cow, could be heaviness, fat, evil food… ears…
leg/feet, duck… skin, hairy, hairless, soft, hard, shell, smooth, rough…
different kind of leafs… octopus tentacles." Each gesture below ships only
with the detector beside it. **No detector, no feature.**

| family | variants | earned by |
|---|---|---|
| 尾 tails | 魚 forked · 甲殼 segmented fan · 牛 tufted whip · 豬 curl · 禽 fan | dominant sub-node of the largest animal domain |
| 鰭 fins | 尖 swift pointed · 圓 whole-steamed round · 帶 eel ribbon | fish sub-node × method (生 raw / 蒸 / 烤) |
| 翼 wings | 雞 short round · 鴨 pointed swift · 鵝 long broad | poultry sub-node |
| 角 horns | 牛 curved pair · 脂 thick blunt · 罪 jagged | 牛 at depth · heaviness + 濃 · **炸 + heaviness after 23:00** |
| 耳 ears | 豬 floppy triangle · 牛 side flap · 羊 pointed | land sub-node |
| 足 feet | 牛 cleft hoof · 豬 trotter · 雞 splayed toes · 鴨 webbed | land sub-node + 鴨 of 羽 |
| 膚 skins | ⚠ SUPERSEDED ROW — the 2026-08-05 rearrangement re-keyed 膚 to method-only; the Ledger "膚" section is authoritative | (superseded) |
| 葉 plant parts | 闊葉 broad leaf · 針葉 herb sprig · 根 tuber · 藻帶 seaweed ribbon | 田 sub-nodes (葉/花/根) + 藻 |
| 觸 tentacles | 八爪 suckered curl · 魷 straight pair · 水母 fine strands | 軟體 sub-nodes |

Two notes from building it:

- **罪角 is the one genuinely new data source.** Late-night fried food is
  detectable TODAY — dishes carry timestamps — and no other feature in the
  framework uses time-of-day. It is also the most characterful trait in the
  set, which is a hint: *when* someone eats is as expressive as what.
- **Watch for semantic collisions.** The first 牛耳 was two dark ovals on the
  body and read unmistakably as EYES. Any gesture placed on the upper body
  must be checked against the face vocabulary below, because the eye reading
  wins every time.

## 眼 · 口 — the late, rare features

Owner, 2026-08-02: *"eyes would add much character… but I feel that it should
be later on, very high level features, that it finally gains the eyes,
exponentially more expressive. Same for mouth, teeth. But for this visual
style, either have a mouth or a pair of eyes, not together. Unless it's a
super rare case."* Agreed, and made exact — a face must be earned by what the
ENGINE achieved, never by tenure or rating count:

- **眼 eyes ← BREADTH.** They open as the fog retreats, when the engine knows
  most of the palate (~14 of 18 dims at KNOWS_AT). The being opens its eyes
  when it can finally *see* your whole taste. This gives fog — already the
  most honest thing in the visual system — its most expressive payoff.
- **口 mouth ← CONVICTION.** Strong loves and real dislikes; a decided palate.
  It grows a mouth when it has *bitten*. Teeth stay a few marks, never a grin.
- **Either, not both.** Whichever signal is stronger wins. Both only when
  breadth AND conviction are both extreme — genuinely rare, and it should
  stay that way, because the ordinary state must stay ordinary or the rare
  state means nothing.

## Drawing rules, calibrated against the owner's hand (2026-08-02)

The owner sketched seven beings. They corrected PROPORTION more than shape,
and these are now the renderer's rules — they matter more than any individual
gesture, because they are what makes the set look like one species of drawing:

1. **The body carries the silhouette; every appendage is a small accent that
   hugs it.** Limbs that sprawl read as a spider, not a taste organism. When in
   doubt, shorter and closer.
2. **Interior tone is a breath of light, not an object.** A flat highlight
   ellipse at readable alpha reads as a grey ball sitting inside the creature —
   it must be a soft radial fade, strong only where the skin justifies it.
3. **Hair is a dense fine fringe around the ENTIRE outline**, not sparse spikes.
4. **Shell is graphic nested bands.**
5. **Translucent things are pale grey** — tentacles, fins, antennae. Not black.
6. **Eyes are small and close together.** Anything else reads as a cartoon.
7. **Never centre a line down a round body** — it reads as a seam splitting the
   creature. (Killed the first spine twice: once as a zipper, once as a seam.)
8. **Wings leave from the SHOULDER, angled out.** Attached high and aimed
   skyward, both sides merge into one jagged crest above the head.

9. **No gradients — EXCEPT 金, by later owner decision.** The house style is
   cut-paper ink: flat shapes with crisp edges, and a RADIAL fade in
   particular reads as 3D shading (owner, 2026-08-02: *"too much gradient and
   doesn't fit this style"*). Overridden once, deliberately, on 2026-08-06:
   焗's 金 skin is a smooth vertical gradient, briefed with a reference. The
   rule still holds everywhere else — this is one named exception, not a
   licence to shade. (The body's own `inkFill` was always a near-flat linear
   ramp between three all-but-identical inks, which is texture, not shading.)
10. **脊 the spine is CUT.** Tried three ways — centred ticks read as a zipper,
    a centred line as a seam, off-centre as a scratch. A round ink body has no
    good place for a spine, and vertebrate-vs-invertebrate is already carried
    by which limbs exist. Deleted rather than kept faint: a feature that never
    reads is clutter, not subtlety.
11. **Wings take the arm station, or the ear station if claws already own the
    flank.** Two limbs must never contend for one attachment point.

## Claw implementation rules (gesture calibrated 2026-08-04 — NOT shipped)

**Status, stated exactly.** The 龍蝦 and 蟹 gestures are built, calibrated
against the owner's reference and tracings, and verified in a standalone
harness (`src/lib/creatureGestures.ts`, driven by the untracked
`/dev-creature` page). They are **not** in any production render:
`TasteFormLive` takes an optional `limbs` prop that nothing in the app passes,
so today's blob is byte-for-byte today's blob.

What blocked shipping, and where each blocker stands now:

1. **No data (STILL OPEN — the production gate).** There is no domain evidence
   anywhere — `DIMS` is 18 flavor/texture/body/method dims and carries no
   ingredient domain at all. The per-user domain-evidence aggregate is
   ship-path step 2 and does not exist. A first port invented a
   `vector.sea_crustacean` field, which meant the gate was permanently false
   and the claws never drew: **a feature keyed to a field that does not exist
   is not a shipped feature, and "the code is there" is not evidence —
   rendering it is.**
2. **The blob is not a body for anatomy (RESOLVED 2026-08-04 by the creature
   renderer).** Hanging the gesture on the blob alone scrambled its
   proportions — the blob's radius along the two claw axes differed by 33%,
   so the small claw protruded further than the big one and the 1.22 : 0.82
   龍蝦 asymmetry inverted. The fix was never a better mount point; it was the
   creature renderer itself (`src/lib/creatureForm.ts`): limbs attach to the
   DRAWN silhouette (flank/bottom points on the final pts), and the claw's
   size converts from the creature body's own half-width (re-measured on the
   real render: 44.6%/24.6% reach against the calibrated ~40/~25).

Core insight, hard-learned across 7 failed rounds: **topology is not a parameter.**
The claw must visibly PINCH, which means: (1) palm + fixed finger are ONE rigid
mass (never move); (2) ONLY the dactyl rotates about a single hinge. Earlier
versions had both halves fanning apart from the wrist (a leaf flapping, not a
claw closing). This could never be fixed by parameter tweaks — the structure
was wrong.

**Procedural geometry rules:**

1. **Rounded-corner triangles need per-corner rounding clamped.** A fixed radius
   on an acute apex eats the whole corner (rt = rad/tan(θ/2), so 24° apex gets
   only 1/5 the rounding a 90° corner gets). Clamp each corner to 68% of its
   shorter edge so tips can actually round without disappearing.
2. **Overlap is verified by connectivity, not eyeballed.** Drawings in flat ink
   hide whether shapes actually intersect (two separate triangles look like one
   from the outline alone). Flood-fill from each component to count connected
   components; if >1, the overlap failed.
3. **Corner rounding retracts the drawn edge.** At a 35° wrist corner, rounding
   retracts ~3.2× the radius along each edge. If a hinge is planted TOO shallow
   into an overlapped corner, rounding can un-bury it. Bury deep enough that
   the retraction can't escape.
4. **Mirror-don't-rotate for left-flank limbs.** When an appendage points left
   (negative cross-axis), negate the cross-axis when building local points — do
   NOT rotate the frame. Rotation swaps jaws/fingers vertically and reads as a
   vertical flip. Mirror preserves anatomy.

**Motion rules:**

- A claw rests OPEN (dactyl at REST_OPEN = 0.17 rad ≈ 10°), not breathing
  symmetrically. It PINCHES: snap shut in 18% of the snap window, release over
  the remaining 82% (asymmetric easing makes it snappy).
- The creature fires 2–3 snaps per ~7s cycle, then goes QUIET. 90% of the cycle
  is idle (motion is only a 0.01rad subtle breath). Sides are offset (the right
  fires 3, left fires 2, out of phase) so they never chop in unison.
- Motion is LAYERED: the dactyl rotates around its hinge, the palm never moves,
  the whole limb sways by 0.01rad max. Static geometry NEVER changes; honesty
  is preserved (motion on top = the creature's identity is immutable).
- **Recoil on the snap:** the whole limb kicks back (−0.02rad sway spike) during
  pinch, selling the kinetic snap.

**Gestalt tuning (for texture and legibility):**

- Tips rounded ~0.11L effective (clamped from 0.20L spec). Blunt-ended pincers,
  not needles. The roundness cost reach, so length was raised to pay for it.
- Small jaw on lobster (~0.65× the big), 1:1 pair on crab. Reach ~40%/25% of
  body width on lobster, ~60% (equal) on crab.
- Wrist angle from reference: 44° below horizontal for lobster pairs.
- **Limb attachment:** claws attach 0.24R–0.48R from body centre, angled forward-down.
  They must hug the silhouette; anything sprawling reads as ears.

**Crab vs lobster:** both species share one code path and one motion clock;
`drawClawPair` is the only entry point, because asymmetry, flank placement,
mirroring and the clock are each a way to get the gesture wrong by hand (the
first port passed the growth value as `scale` and got two equal claws). Species
selection needs the 甲殼 sub-node detector, which waits on the same aggregate.

**The bug that hid half the anatomy.** The body is built as
`x=cx+sin(ph), y=cy−cos(ph)`, so "away from the creature" at angle ph is
`(sin ph, −cos ph)`. Several appendages hand-rolled their own direction with
the sign inverted on one side, so wings and tails were drawn INTO the body and
buried under the fill — features that were coded, gated, and firing correctly,
but invisible. The owner spotted it from the renders alone ("a lot of stuff
mentioned but missing, I think there's a bug"). Every appendage now leaves the
rim through a single `out(ang, L)` helper. **Lesson: when a feature is present
in the data and absent on screen, suspect the geometry before the gate.**

**Gesture pool** (still waiting for an honest detector): antennae, whiskers,
plated armour at 甲殼 depth, and anything requiring ingredient reads finer
than the current 4-item list. Nothing leaves the pool without a detector +
gate + growth curve.

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
   replay.ts on re-rates), persisted with taste_profile_version. — **BUILT
   2026-08-04** (`src/lib/domainEvidence.ts` + `taste_profiles.domain_evidence`,
   migration recorded in supabase/applied/). Classifier reads columns that
   already exist: diet flags → depth-1 domains + 甲殼, ingredients → 菌/藻 and
   the crustacean sub-nodes, name morphemes → land/shell sub-nodes ONLY (a name
   never authors a domain; the rating is the evidence). Metabolism as
   arithmetic: `weight = 0.5 + calibrated score`, so exposure counts, liking
   amplifies and dislike CARVES; one meal's weight is SPLIT across the domains
   it hits, so a mixed dish never double-counts against the evidence floors.
   Execution-confounded ratings contribute exposure but no opinion — the person
   ate it, the flick was about the kitchen. Rebuilt (never patched) by
   replay.ts, so a rename heals anatomy exactly as it heals the palate, and the
   aggregate is a pure function of history with NO wall-clock decay
   ("absence fades" belongs at read time, against updated_at).
   Measured on the owner's real 60 rated dishes: sea 31.7% · land 22.3% ·
   shell 20.3% · field 9.6% · air 7.3% · 藻 4.4% · 菌 4.4%; sub-nodes
   prawn-dominant shell, pork-dominant land. Under the shipped gates that grows
   tendrils (0.94) and claws (0.46) and correctly grows NOTHING else — legs sit
   a hair under the 0.22 share gate, and 田/菌/藻 are below the absolute
   evidence floor. Both gates, always.
   **NOT YET RENDERED IN PRODUCTION** — the creature door stays shut until (a)
   the snapshot (SVG) renderer learns the same anatomy, per the two-renderer
   contract, and (b) the owner approves the first live being.
3. Creature renderer behind the FormInputs contract (+ domain record), grown
   path persisted per (user, profile version); blob remains the fallback when
   domain evidence is empty. — **BUILT 2026-08-04** (`src/lib/creatureForm.ts`,
   live canvas): the v6 lab body ported whole — body plan, 5 skins, posture/
   temperament, wings/fronds/ribbons/tendrils/caps/legs, calibrated claws.
   The body is the BLOB's own sampleForm silhouette with domain anatomy
   layered multiplicatively, so zero domain evidence degrades to exactly
   today's blob — "a new version of the ink-blob", one being, not a second
   renderer beside it. `TasteFormLive` takes optional `domains`; NOTHING in
   production passes it (blocked on step 2). Reviewed on the untracked
   /dev-creature harness across 8 scenario lives; temperament/skin detectors
   read the learned 18 dims (evidence-gated — fog stays silent, unit-tested
   in tests/creatureForm.test.ts). — **LIVE 2026-08-05.** Snapshot parity
   shipped (`canvasToSvg.ts`), phase-2 wiring shipped (`953abcd`: Taste tab,
   public dossier, in-session growth screen), and the owner's anatomy pass was
   given as a STANDING sign-off — ship now, refine along the way, the anatomy
   is ongoing work for the product's lifetime rather than a gate (DECISIONS.md,
   "墨靈 anatomy: SIGNED OFF as a living surface"). The guardrail that remains:
   the body changing because the PERSON changed is free; the RENDERER changing
   rewrites every existing being retroactively, so a change large enough that
   someone would not recognise their own being is a deliberate act, never a
   side effect of a tuning round.
4. ~~銘 renderer~~ **SHIPPED 2026-08-05. It did not become a new card — it took
   the radar's place.** `src/lib/logogram.ts` (geometry, 12 unit tests) +
   `src/components/TasteRadar.tsx` (render). Reached by tapping the
   creature/blob, exactly where the radar always was.

   The owner's ask was "replace the taste radar or merge with it somehow". It
   went out as a merge — 銘 ring around the radar polygon, sharing one compass
   and one radius, since `dimAngle(i)` and the radar's local `angleFor(i)` were
   the same expression over the same DIMS order — and then the owner cut the
   polygon and the vertex dots on sight. **That was the right call and the
   merged version should not be restored.** With the 銘 present the polygon was
   redundant (both encode magnitude per dim at a fixed seat) and it was the
   dishonest half of the pair: mapping -1..1 to a radius plots an unrated dim
   at mid-radius, indistinguishable from a measured neutral. A radar has no
   axis for evidence. The 銘 carries evidence in the ink, so silence is
   available as an answer.

   What honesty looks like on the shipped figure: a fog dim has no stroke, a
   faint label, and cannot be named a top taste (that callout is evidence-gated
   now — a high number off one tasting is a guess).

   Guide rings and spokes were removed with the polygon, then restored at half
   weight (`--line` at 0.5 opacity, 0.75px) on the owner's call: with silence a
   legitimate answer, a fog dim's spoke is the only thing tying its label to a
   place on the figure. At full weight they read as scaffolding left by the
   deleted chart; this faint they read as ruling under writing. Spokes then ran
   all the way OUT to touch the labels (owner) rather than stopping at the ring,
   which turns each one into a pointer naming its seat. Their stop distance
   scales with each label's own font size — a flat gap struck the larger
   called-out labels through the middle.

   Three calibrations, all measured on the owner's live profile, none reasoned
   — and all three invisible on harness fixtures:
   - the lab's linear `round(e/2)` stroke count saturates immediately on real
     data (14 of 18 dims past 12 ratings), so every mature seat drew the cap and
     the count stopped saying anything. Tiers, capped at 4.
   - the lab's long fine strokes read as FUR at production size, colliding with
     the creature's own hair register. The 銘 wants short heavy marks.
   - the lab bowed every strand by a fixed `0.06 * dir`, giving the whole figure
     one handedness — a combed fringe. The bow is signed and seeded per strand
     now, so strands curl both ways.

   **Motion (owner, 2026-08-05): the strands SWAY, like hair in a draught.**
   A first pass animated opacity and stroke-width — the owner's correction was
   exact and worth keeping: a fade is legible as blinking, not as flowing. What
   works is real movement. Each strand rotates about its OWN ROOT on the ring
   (`.ming-strand` in globals.css, CSS only, reduced-motion guarded), with
   animation-delay taken from its angle so the sway crosses the figure like
   wind over a field rather than every strand swinging together. The ring
   itself holds still — hair moves against a head that doesn't.

   Two things that had to be measured rather than assumed: strands are only
   10-30px long at production size, so small angles buy nothing (2.5° moved a
   tip 0.8px, invisible; the shipped 9-14° gives ~4-7px of tip travel). And
   amplitude is TRIMMED as reach grows, so long and short strands travel about
   equally — otherwise a strongly-loved dim would whip while a faint one
   stirred, and **motion would start encoding preference.** Motion carries no
   data here; it layers on top of the reading and never adds to it.

   **The rule that constrains all of it: nothing may move a strand off its
   compass seat.** A dim's angle IS its identity, shared with the blob and the
   creature. Rotating a strand about its own root is hair; rotating the FIGURE
   would silently render someone else's palate. Pivot-at-root is unit-tested
   (`rootX/rootY` must lie on the ring and match the path's own start point).

   Version cards / export header / share image still to follow — the renderer
   they need now exists.
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
- ~~Does 膚 belong to domain or to method?~~ ~~軟's register divergence?~~
  ~~Where does 烤 live?~~ **ALL ANSWERED (owner, 2026-08-05/06): 膚 is
  method-only; 甲/毛 move to 骨; 軟 re-points to 蒸; 糙/釉/金/烙 designed one
  at a time for 炸/燜/焗/烤.** All six method skins are shipped — see the
  "膚" section in the Ledger. Open: re-adding 甲/毛 as 骨 overlays now that
  the six are settled.
