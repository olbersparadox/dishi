# Dish-name decomposition — R&D (2026-07-27)

**Owner's hypothesis:** a Chinese dish name decomposes as
`[key ingredient] + [cooking method] + [base/carb]`, with two consequences —
(A) taste preference is readable from those slots, and (B) two dishes are the
same only if all three match, so a slot conflict can veto a wrong merge.

Eval: `scripts/eval-dish-decomposition.ts` (manual, real LLM calls).

## What the engine already does — and the gap

**Cooking method is ALREADY modelled**: 6 of the 18 taste dims are methods
(`fried, grilled, braised, steamed, raw, baked`). So "lots of 炒 likes → prefers
that method" is live today.

But it is structurally starved. Live evidence counts (one palate, ~50 ratings):

```
rich 54 · tender 51 · fresh 48 · umami 48 · salty 47 · chewy 40 · sweet 31 · creamy 30
steamed 11 · baked 10 · grilled 9 · braised 7 · raw 7 · fried 6
```

Flavour dims fire on nearly every dish; a method dim fires once per dish. Method
therefore accumulates ~6x less evidence BY CONSTRUCTION — `fried` sits at 6 in a
corpus full of HK food.

**Protein and base are NOT modelled at all** — no dimension, no affinity map,
nothing. And `ingredients` (up to 4 key ingredients, with the careful HK carb
shorthand expansion 米/河/意/通/丁) IS extracted during enrichment, but there is
no `ingredients` column on `dishes` and zero references in `taste.ts`,
`buddy.ts` or the ratings route. It is computed, used to derive diet flags, and
discarded. **The signal the owner describes is already being produced and thrown
away.**

## Section A — is protein/base preference visible today? NOT ANSWERABLE

Not a script failure, a corpus limit: 51 ratings spread over ~6 proteins,
~9 methods and ~6 bases leaves every cell in single digits (largest n=6). No
parsing improvement changes that. **This question needs several hundred ratings
before it can be asked**, and the answer here is "cannot tell", not "no effect".

## Section B — the structural VETO works, with a precise failure mode

30 held-out identity pairs (the Phase 0 set), both sides parsed independently:

| outcome | count |
|---|---|
| both sides parse | 18 |
| at least one side UNPARSEABLE | 10 |
| slot conflict, correctly blocks | 4 |
| slot conflict, **WRONGLY blocks** | **1** |
| no conflict, veto silent | 13 |

**Correct vetoes** — all four are cases a name-similarity matcher could plausibly
get wrong:

```
蝦仁炒蛋   vs 蝦仁炒飯    base    none    vs rice
生炒糯米飯 vs 糯米雞      protein none    vs chicken
白灼蝦     vs 椒鹽蝦      method  boiled  vs deep_fried
滑蛋蝦仁   vs 滑蛋牛肉    protein shellfish vs beef
```

**The one wrong veto is the finding:**

```
生滾魚片粥 [fish/boiled_soup/congee]  vs  魚片粥 [fish/none/congee]
```

`生滾` names the standard cooking method that the plain name omits. The slots do
not CONFLICT — one is simply unstated.

**Root cause: the enum conflates "absent" with "unspecified".** Both collapse to
`none`, but they mean opposite things:

- base `none` on 蝦仁炒蛋 = genuinely NO carb. A real property, and a real
  conflict against `rice`.
- method `none` on 魚片粥 = the name does not say. Not a conflict against
  anything.

The naive fix ("`none` never conflicts") is WRONG — checked against these
results, it removes the false veto but also kills two of the four correct ones
(蝦仁炒蛋/蝦仁炒飯 and 生炒糯米飯/糯米雞 both hinge on a `none`). The real fix is
to split the value: `absent` vs `unspecified`, and veto only when both sides are
SPECIFIED and differ.

## Structure cannot be the sole rule — measured, not asserted

**10 of 28 pairs (36%) had at least one unparseable side.** Non-compositional
names are common in HK: 絲襪奶茶, 西多士, 菠蘿油, 楊枝甘露, 老婆餅, 螞蟻上樹.
The catalog handles those; structure cannot see them at all.

So the shape is **catalog proposes, structure vetoes** — the veto runs only when
both sides parse, and stays silent otherwise.

## Recommendation

1. **Protein + base as a separate affinity map, NOT new vector dims.** Follow
   the existing `cuisine_affinity` precedent (already outside the 18-dim
   vector). The owner's framing is comparative within a family — "beef over
   pork", "rice over noodles" — which is a like-rate, not an EMA presence dim.
   Adding ~10 one-fires-per-dish dims to a vector whose method dims already sit
   at 6-11 evidence would dilute, not enrich.
2. **Persist `ingredients`.** It is already computed and discarded; storing it
   costs one column and unblocks all of the above.
3. **Structural veto: worth building, after the `absent`/`unspecified` split.**
   Not before — the current enum produces a known false-veto class.

## Method notes

- `qwen/qwen3.7-plus` is a REASONING model: token cost scales with items per
  call. At BATCH=6/maxTokens=6000 nearly every batch exhausted the budget before
  emitting content and all three `callClaude` retries failed. BATCH=2 with
  maxTokens=16000 ran with 2 failed batches out of 30. Any future eval on this
  model should start small.
- Section A's numbers were additionally degraded by that failure (15/51 names
  parsed), but its conclusion rests on the corpus size, not the parse rate.
