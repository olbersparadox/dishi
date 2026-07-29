# R&D: comparison interactions aren't firing — diagnosis + design space

Owner complaint (2026-07-28): duels and execution comparisons barely appear
for the product's heaviest user (49 ratings). "The interaction is being
wasted in the back… trying to show (and REALLY DO) that we are trying to
understand their tastes." Comparison is the core product DNA; a comparison
engine that goes QUIETER as someone rates MORE is upside down.

Scripts: `scripts/diagnose-comparison-starvation.ts` (gate attrition),
`scripts/eval-duel-uncertainty.ts` (replacement-gate simulation). All numbers
below are measured on the live corpus, not asserted.

## Diagnosis — where every interaction dies

Live state: 49 ratings, **4 duels ever served** (all four answered — demand
saturates supply), **0 execution scores ever recorded**.

### 對決 duels: the uncertainty gate has permanently shut off

`selectDuelPair` requires a contrasting dim with **evidence ≤ 2**. Evidence
counters only ever grow (+1 per taught dim per rating), and at 49 ratings the
owner's LOWEST dim is bitter:3 (median dim ~10, top dims 45–52). Gate-by-gate
attrition over 1,176 possible pairs:

| gate | pairs killed |
|---|---|
| cuisine unknown | 48 |
| cuisine mismatch | 743 |
| lifetime cap / same identity / served | 6 |
| contrast < 0.3 | 5 |
| **uncertainty (evidence ≤ 2)** | **374 — every survivor** |
| **qualify today** | **0** |

Production `selectDuelPair` returns null and will return null **forever** —
no rating the owner ever makes can bring a dim back under 2. The engine shuts
off at roughly rating ~15–20 for any active user, i.e. precisely when a user
has proven they'll engage. This is a design bug, not a tuning problem:
observation COUNT was standing in for CERTAINTY, and it is a one-way ratchet.

### The count-gate was also measuring the wrong thing

The engine's own sealed bets say it is NOT certain. For every duel it already
computes a predicted winner + confidence (`sigmoid(DUEL_K·|sA−sB|)`). Over
the 378 contrast-qualified live pairs:

| sealed confidence | pairs |
|---|---|
| p < 0.55 (coin flip) | 306 |
| 0.55–0.65 (leaning) | 72 |
| ≥ 0.65 (confident) | **0** |

The model cannot call ONE same-cuisine pair confidently, while the evidence
gate claims everything is settled. The count-gate was manufacturing certainty
the model does not have. (Footnote: all 4 answered duels sealed at p≈0.50–0.52
and all went the predicted way — a hint the model is UNDER-confident, i.e.
`DUEL_K = 2` under-scales the score gap. n=4 proves nothing; recalibrate
DUEL_K against accumulated duel outcomes once n is respectable.)

### Execution comparison: fuel exists, the ignition moment is gone

Post-catalog, **11 of the 49 ratings have a live sibling comparison** (same
canonical dish or same venue identity, rated). But the offer fires ONLY in
the `/api/ratings` response at rating time — for dishes rated before their
sibling existed, the moment never comes again until a re-rate. The solo
anchor (warmup 10, |calibrated| ≥ 0.35) is also mis-fit to real flicks: the
owner's median |calibrated| is **0.03** (flicks cluster at the learned
neutral), so ~75% of ratings can never anchor. Result: 0 execution scores
ever, with 11 comparisons stranded in the back.

### Surfacing: everything hides behind the bell

Duels surface only in the NotificationBell (plus a rare once-per-session
auto-surface), max one per ~day (20h cooldown). Even with supply fixed, the
ceiling is one quiet interaction per day.

### A gap the simulation itself caught

The new-rule stream's #4 pick was 壽司拼盤 vs 三文魚卵及海膽軍艦壽司 — the
SAME canonical dish (both `sushi-platter`). The duel selector excludes
same-`dish_identity_id` pairs but predates `canonical_dish_id`. Same-canonical
pairs are execution comparisons ("which rendering was better?"), not 對決
("which dish do you prefer?") — the selector must exclude them, which also
routes that fuel to the right mechanic.

## The fix for duels: qualify by the unresolved bet, not the counter

**Proposal.** Drop the evidence-count qualification. A pair qualifies when it
(a) passes all structural gates (same cuisine, contrast ≥ 0.3, not same
identity, **not same canonical dish**, caps/history), and (b) the sealed bet
is genuinely uncertain (predictedP below a band edge, ~0.65). Serve the LEAST
certain qualifying pair first; keep the existing info-score as tiebreak.
Uncertainty sampling on the model's own prediction — no new state, uses the
sA/sB the route already computes for the seal, and structurally cannot
ratchet shut (something is always the least-certain pair; the band edge
preserves "never a filler duel" if the model ever does become confident).

**Measured on live data:** 378 qualifying pairs today; honouring lifetime
caps and no-repeats greedily, a **58-duel stream ≈ 8 weeks at one/day** from
the current 49 ratings alone, growing with every new rating. First five all
read as real questions (金錢肚 vs 蒜蓉粉丝蒸扇贝, 牛肉粥配生蛋 vs
蛇羹潤腸飯餐, …).

The narrative also becomes honest: the engine duels precisely where its bet
is a coin flip, the reveal shows what it believed, and a wrong bet visibly
recalibrates. That IS "really doing" taste understanding, surfaced.

## Design space: more interactions from existing ratings

Evaluated against: comparison DNA, the one shared chassis
(DuelSide/DuelOverlay), no-filler rule, and what actually exists at ~50
ratings. Go probabilities per the house ~50% bar.

**A. Execution comparison inbox (retro-ask) — GO, ~85%.** The 11 stranded
sibling comparisons become servable: a bell item (the surface duels already
own) offers one pending "佢哋整得點？" pair for already-rated siblings with
no execution scores — same ExecutionOverlay, same queue, zero new UI. Fuel:
11 today, +1 per future sibling rating, plus every backfill-created group.
This is the cheapest possible "we noticed you've had this at two places."

**B. Duel gate replacement + same-canonical exclusion — GO, ~80%.** As
above. Optionally raise frequency cap from 1/day (20h) to 2/day (~10h
cooldown) — supply supports it (owner call; see decision points).

**C. Surprise rematch — GO with B, ~70%.** When a sealed duel prediction was
WRONG, priority-select a follow-up pair contrasting the dims that moved most,
with copy that admits the miss ("上次估錯咗 — 再嚟一鋪"). A selection-priority
tweak + one copy line on top of B, not a new mechanic. Makes the learning
loop visible, which is the owner's exact ask.

**D. 冠軍 group champion — DEFER until 2–3 groups have ≥3 rated instances,
~60% when it fires.** "蛋撻食過三間 — 邊間係冠軍?" N-way pick on the duel
chassis, producing an execution ORDERING sharper than sliders. Today only
sushi-platter (5 rated) qualifies; one group makes a feature feel like a
gimmick. Revisit as eating data grows — the moment should feel earned.

**E. Taste-drift re-verification ("仲係咁諗?") — PARK, ~35%.** Resurfacing
old strong opinions measures drift, but it isn't comparison-shaped, the
journal already allows re-rating, and at pre-launch data volume "old" barely
exists. Below the bar.

**F. Cross-cuisine bridge duels — PARK, ~30%.** 743 pairs die at the
same-cuisine gate, but cross-cuisine answers are dominated by cuisine
preference and teach content dims almost nothing ("梗係揀壽司唔揀沙律"). The
same-cuisine rule is the no-irrelevant-rec principle applied to duels. Only
revisit if supply starves after B — measured, it does not.

**G. Abstract attribute probes (脆定腍?) — REJECT.** Dishes are the
interface; abstract dim questions duplicate the TasteForm blob surface and
break the food-forward feel.

## Recommended build order + decision points for the owner

1. **B + C** (duel gate replacement, same-canonical exclusion, wrong-bet
   rematch priority) — one build, engine-side, Fable-tier.
2. **A** (execution inbox via the bell) — second build, mostly wiring, the
   biggest visible "we're paying attention" per line of code.
3. **D** parked with an explicit data trigger (2–3 groups at ≥3 rated).

Decision points:
- **Frequency cap:** keep 1/day, or raise to 2/day now that supply sustains
  it? (Recommend 2/day with the second slot only when a NEW qualifying pair
  appeared since the last — keeps "never filler" intact.)
- **Band edge:** ship at p < 0.65 (measured: everything qualifies today, so
  it only bites once the model sharpens) — or no band at all (pure
  least-certain-first)? Recommend the band: it is the honest version of
  "no rec is better than an irrelevant one" for duels.
- **Solo anchor threshold** (|calibrated| ≥ 0.35 excludes the median flick):
  recommend LEAVING it — solo anchors are the weakest interaction, and A+B
  spend the same attention on real comparisons instead.
