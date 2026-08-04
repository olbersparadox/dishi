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
| 骨 body plan | ingredient DOMAIN shares (sea / land / air / field / 菌 / 藻) | slow, reversible over seasons | silhouette family + appendage grammar: tendrils, leg-nubs, wing fans, fronds, caps, ribbons — **built, lab v3–v6** |
| 膚 skin & edge | method dims (already learned: 炸烤燜蒸生焗) | medium | edge/surface treatment: 炸 crusted granular rim, 蒸 wet sheen, 烤 sear marks, 燜 heavy sag, 生 translucent wash, 焗 risen dome — **built, lab v6** |
| 姿 motion & temperament | flavor + method dims (辣甜酸苦鮮鹹 / 濃清) | medium | motion signature AND static posture: 辣+炸烤 → jagged edge, forward lean, quick darts; 蒸生+清 → smoothed contour, upright, slow drift; 燜+濃 → low centre of mass, heavy settle; 甜 → round springy profile — **built, lab v6** |
| 脊 spine | vertebrate share of the diet | slow | a dorsal ridge (lit crest + shadow) on vertebrate-fed bodies; crab and mushroom eaters have none — **built, lab v6** |
| 銘 DNA | the full 18-dim vector + evidence + domain record | exact, always current | the written logogram: outward strokes = love, inward = dislike, stroke count = evidence, silence = fog — **built, lab v3** |

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

## The full stroke vocabulary (built, lab v7)

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
| 膚 skins | 毛 hairy · 滑 smooth wet · 糙 rough seared · 甲 plated · 軟 sagging | fur mammals at depth · 蒸/生 · 烤/炸 · 甲殼 · 燜 |
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
4. **Rough skin is dark pits**, not pale specks. **Shell is graphic nested
   bands.** **Sear marks are faint scorches**, not grey dashes.
5. **Translucent things are pale grey** — tentacles, fins, antennae. Not black.
6. **Eyes are small and close together.** Anything else reads as a cartoon.
7. **Never centre a line down a round body** — it reads as a seam splitting the
   creature. (Killed the first spine twice: once as a zipper, once as a seam.)
8. **Wings leave from the SHOULDER, angled out.** Attached high and aimed
   skyward, both sides merge into one jagged crest above the head.

9. **No gradients.** The house style is cut-paper ink: flat shapes with crisp
   edges. A radial fade reads as 3D shading and breaks the register (owner,
   2026-08-02: *"too much gradient and doesn't fit this style"*).
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
   replay.ts on re-rates), persisted with taste_profile_version.
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
   in tests/creatureForm.test.ts). Still owed before production: snapshot
   (SVG) parity — two renderers, one being — and the owner's pass on each
   skin/limb at real profiles.
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
