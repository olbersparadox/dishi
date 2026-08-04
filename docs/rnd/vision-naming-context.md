# Identity-constrained vision naming — R&D measurement (2026-08-02)

**Question** (BACKLOG, attribution & naming accuracy, item 3): vision's
`inferDish` is context-blind — photo bytes only. Does context fix its naming,
and can a nearby-menu shortlist make it adopt the menu's own words instead of
guessing? Two layers, judged separately per the item's own split:

- **3a** — locale context: one line, "taken near {district}, Hong Kong".
- **3b** — the constrained match: a verbatim-zh shortlist of menu items
  scanned near the photo's EXIF coords; match first, open-guess on no-match.

Eval: `scripts/eval-vision-naming.ts` (manual, real LLM calls, live prod model
`qwen/qwen3.7-plus`). Raw per-case output: `scripts/vision-naming-results.json`
(gitignored — real meals, public repo; rebuild by re-running).

## The field miss this measures

Owner, 2026-08-02, 一起食堂 (Central): menu scanned (session KE7KK, 31 items,
和風牛肉烏龍麵 among them), then that very dish photographed. The album flow
guessed 豚骨拉麵/"pork ramen" from pixels alone; the owner retyped the name by
copying it off the menu they had already scanned an hour earlier. The name sat
in the DB ~100m from the photo's EXIF coords; nothing joined them.

Two structural facts the live DB adds to the design (both now verified):

1. **`dish_identities` alone cannot be the shortlist source.** The whole table
   holds 3 rows; session KE7KK alone holds 31 verbatim zh names. Recent nearby
   scan sessions ARE the vocabulary at this stage — the item's design
   constraint (1), confirmed against live data.
2. **Menu English is not a match key.** The same KE7KK menu prints
   "Pork Belly Noodles" against 和風牛肉烏龍麵 and "Spicy Beef Noodles" against
   麻辣牛腱牛丸烏龍麵 — loose print or scan mistranslation, either way lossy.
   Match on `name_zh`, the menu's verbatim truth (design constraint (2)).

## Method

Ground truth: the owner's album backlog — every photo-logged dish with EXIF
coords (n=54). Two tiers scored separately: **EDITED** (n=20,
`name_edited_at` set — a human typed this zh name; real truth) and
**ACCEPTED** (vision's name kept; weak truth — acceptance is not verification,
so the signal there is a context arm FLIPPING an accepted answer, not exact
match). 18 cases have a non-empty shortlist.

Three arms on the same photos, shipped `SYSTEM` prompt byte-identical in all
three; context rides the user turn only (exactly how production would ship it
additively):

- **A** — `Identify this dish.` (reproduces the shipped path)
- **B** — + locale line from the dish/restaurant district.
- **C** — + shortlist block: numbered verbatim zh items, "if the photographed
  dish IS one of these, return its name EXACTLY as printed; if none is, ignore
  the list and identify freely — do not force a match."

Shortlist construction (production-shaped): union of (a) `dish_identities` of
restaurants within 250m of the photo's EXIF coords, (b) `menu_items` zh names
of table sessions within 250m and ±7 days of the eaten date. Sessions carry no
coords today (3b's wiring adds them at scan time); the eval proxies a linked
session's coords from its restaurant, and pins KE7KK to 一起食堂's
later-created row per the field record.

Scoring: normalized exact match on `name_zh`; non-exact answers get a
name-level LLM same-dish judgment (the cross-venue eval showed ~95%+ on
exactly this task — `cross-venue-dish-phase0.md`). Arm C additionally counts
**ADOPTED-WRONG** (returned a shortlist name that is not the dish) — the
pre-agreed kill-criterion class, because a wrong adoption wears menu authority.

## Results (run 2026-08-02, 54 cases, ~160 live calls)

A degraded-provider window (the known Alibaba/non-JSON class plus a local
network drop) failed a chunk of calls unevenly across arms, so the headline
percentages have uneven denominators. Every conclusion below therefore rests
on PAIRED per-case comparisons and the adoption bookkeeping, which survive
missing cells.

**Baseline reality (arm A, EDITED tier): 0/16 exact, 2/16 same-dish.** Where
the owner had to retype a name in the field, context-free vision re-fails on
the same photo — a selection effect (EDITED tier is conditioned on the shipped
pipeline having failed), but it kills the hope that re-rolling the dice fixes
anything. On ACCEPTED-tier photos vision was already right about half the time
and no arm broke a right answer.

**3a — locale line, paired A-vs-B (n=26 both-completed): +2 / −0.**
22 unchanged, 2 genuine improvements (海鮮意粉 MISS→EXACT, 海鮮丼 →豪華海鮮丼),
and the 2 apparent regressions are pure judge noise — identical output text
(甜蝦刺身, 白灼血蚶) scored SAME-DISH against arm A and MISS against arm B.
Small real gain, zero harm, zero latency cost. Not worth its own ship; worth
one free line inside 3b's context block.

**3b — the constrained match: it does the exact thing the field asked for.**

- Truth on the shortlist (6 cases): **5/5 completed calls adopted the menu's
  verbatim name** — including 和風牛肉烏龍麵 itself, the field miss, adopted
  EXACT off KE7KK's 30-item list past four adversarial 烏龍麵 neighbours.
  (The 6th, 花雕麻油雞湯麵, lost its C call to the provider window.)
- Truth NOT on the shortlist (10 completed): 8 correctly refused to force a
  match and free-guessed (今日 behaviour, unchanged). The other 2 adopted:
  - 蝦餃 → 水晶鮮蝦餃 — flagged ADOPTED-WRONG by the strict string metric but
    it is the same dish under the menu's fuller name, i.e. the DESIRED
    behaviour. The strict counter overstates.
  - 土魷蒸肉餅 → 冬菇馬蹄蒸肉餅 — **1 genuine kill-criterion event**: a
    different steamed patty from a neighbouring menu, adopted with menu-tier
    confidence while the true dish was on no nearby menu.
- Where no shortlist exists nothing changes, and on EDITED cases without a
  nearby scan NOTHING helped — the ceiling grows with scan density, exactly
  as the item predicted.

## Read

- **3a: measured, closed.** No standalone ship. Fold the locale line into
  3b's context suffix (it is free and mildly positive).
- **3b: GO** (measured ~5/6 adoption where the vocabulary exists, better than
  the item's ~75% bar; useful-wrong-adoption rate 1/16 shortlist cases).
  Wiring, next session per the batch's one-item-per-session rule:
  1. `table_sessions` gains scan coords, written at scan time (the scan flow
     already holds live coords for the restaurant gate) — migration recorded
     in `supabase/applied/`.
  2. `/api/dishes` photo path: EXIF coords present ⇒ fetch the shortlist
     (identities of restaurants ≤250m ∪ session menu_items ≤250m, ≤7 days)
     BEFORE `inferDish` — a ~50ms user-scoped DB read against a multi-second
     vision call — and pass it as an optional context argument. Absent
     shortlist ⇒ byte-identical prompt and behaviour, enforced by test
     (the batch's additive-only rule).
  3. Adoption is detected server-side by normalized-verbatim zh compare
     against the shortlist; an adopted name takes BOTH languages from the
     menu item as printed, links the identity where one exists, and never
     touches `name_edited_at`.
  4. The 土魷蒸肉餅 event says the anti-force instruction alone is not
     enough. Mitigation for v1: adoption lands as the dish name but stays on
     the existing edit affordances (the growth screen shows it at the
     engagement peak); the pre-agreed kill criterion stands — a wrong
     adoption in FIELD use gates adoption behind item 5's two-name pick.

Method debts, recorded: the same-dish judge is noisy at the margin (2 verdict
flips on identical text — same class the cross-venue eval measured as
run-to-run noise); B-arm coverage was halved by the provider window, so the
3a paired count is 26, not 54; session coords were proxied (see Method) —
production gets real ones from step 1.

## SUPERSEDED — the 2026-08-02 run measured the wrong model

Discovered 2026-08-04 (see `9253b5a`, "The 'outage' was a 26-day local/prod
model divergence"): production has run `OPENROUTER_MODEL=qwen3-vl-32b-instruct`
(non-thinking) since 2026-07-09, but `.env.local` never got the variable and
`openrouter.ts` fell back to `qwen/qwen3.7-plus` (thinking) — silently, for 26
days. This eval ran 2026-08-02, inside that window. **Every number above,
including the GO call, was measured against a model the app does not ship.**
`.env.local` is now pinned to the real production model; nothing below is.

## Field pass, 2026-08-04 — the GO call does not survive the correct model

First live field test of 3b, wired that session (`59bc3a5`). Owner scanned
大爺燒鵝 (香港仔田灣, session VYGX4, 35 items, real `scan_lat`/`scan_lng` ~13m
from the photo), photographed 油雞髀腩仔飯 five minutes later, rated it at
home. Vision returned 燒鴨叉燒飯 — wrong protein, wrong cut — and nothing was
adopted (`name_from_menu_at` null).

Two things looked identical from the DB row alone and have opposite
implications, so the exact photo was replayed against the exact live shortlist
(`scripts/diagnose-daaiye-miss.ts`, correct model, 3 runs/arm):

- **Baseline (no context): 燒鴨叉燒飯, 3/3.** Matches what production
  returned — 3b's lookup did not fire in production (the 1.5s budget failing
  closed is the leading suspect; the confirming log line is behind a Vercel
  billing limit as of this writing).
- **+shortlist (the real 40-name VYGX4 list): 大爺燒鵝雙拼飯, 3/3.** Wearing
  menu authority. **This is the kill-criterion class, deterministic.** The
  dish was actually a 自選雙拼飯 combo (build-your-own — the menu names no
  single dish for it); the shortlist supplied a confident, wrong, real menu
  name instead of the honest miss baseline gives.

So the suppression bug is, right now, the only reason this specific wrong
adoption isn't already live in the DB.

## Re-run on the correct model, 2026-08-04 — EDITED tier, n=20 (10 with shortlist)

`SIM_USER_ID=<owner> npx tsx scripts/eval-vision-naming.ts --edited-only`,
same harness, same proxy method as the 08-02 run, only the model changed
(`qwen3-vl-32b-instruct`). Directly comparable to that run's EDITED-tier row.

```
A baseline:      exact 0/20, same-dish 3/20
B +locale (3a):  exact 0/20, same-dish 3/20
C +shortlist:    exact 2/10, same-dish 3/10

Arm C adoption (n=10 with shortlist):
  truth on list: 2
  adopted:       5
  ADOPTED-WRONG: 3   <- kill-criterion class
```

**60% of adoptions were wrong (3/5).** 30% of all shortlisted cases hit the
kill criterion, vs. 1/16 (6%) on the 08-02 run. Three distinct wrong
adoptions, all wearing menu authority:

- 油雞髀腩仔飯 → 無骨海南雞配油飯 ("Hainanese chicken rice with crispy pork
  belly" — wrong chicken preparation, wrong rice, right menu, wrong dish)
- 燒鵝髀飯 → 脆皮潤腸飯 (a completely different dish)
- 土魷蒸肉餅 → 冬菇馬蹄蒸肉餅 (the same kill-criterion event the 08-02 run
  already flagged once — it reproduces)

Baseline accuracy is unchanged from 08-02 (0/16 → 0/20 exact on EDITED,
same selection-effect caveat: this tier is conditioned on the shipped
pipeline having already failed). The model swap did not change what vision
sees; it changed how eagerly it commits to a forced match, and the correct
production model commits far more readily to a wrong one.

## Read — GO is withdrawn, pending a strong-model decision

The 08-02 "GO, ~5/6 adoption accuracy" call is **withdrawn** — it was never a
measurement of what ships. On the model that actually runs in production,
adoption is wrong more often than it's right in this sample. Auto-adopt as
currently designed should not ship on this evidence.

**Not yet decided** (per CLAUDE.md: decisions touching the name authority
ladder go to the strongest model tier, not Sonnet — this section records
facts, not the call): whether this kills 3b outright, or whether it moves
straight to the item-5 two-name pick (offer the shortlist match as a
one-tap alternative rather than auto-substituting it) that the 08-02 doc
already named as the mitigation for exactly this failure class. The n=10
shortlist sample here is small; a fuller re-run (`--edited-only` was chosen
to conserve calls) would firm up the 30% figure before either path ships.

Suppression (the reason nothing wrong has shipped yet) should stay in place
until that decision is made.

## Two further findings, 2026-08-05 (`scripts/probe-picker-viability.ts`)

Re-running production's REAL lookup over the same 10 shortlisted eval cases —
rather than the eval's proxy — turns up two things that reframe the item.

**1. Neither eval measured production's shortlist.** The eval proxies session
coords from the linked restaurant; production requires real `scan_lat`, which
only exists for sessions scanned after the 2026-08-03 wiring. So 4 of the 10
cases (花雕麻油雞湯麵, 和風牛肉烏龍麵, 燒鵝髀飯, 土魷蒸肉餅) return an EMPTY
list under the real rule, including two of the three kill events and BOTH
correct adoptions. The 08-04 re-run fixed the model but not this; its 3/10
figure is not a production measurement either. **The only clean production
measurement to date is the 大爺燒鵝 field replay above** — real coords, real
session, real lookup, real model — and that one is ADOPTED-WRONG 3/3.

**2. GPS cannot tell HK restaurants apart, and that is not fixable by tuning
the radius.** Distances from one dish photo to each nearby scanned menu:

```
油雞髀腩仔飯 →  CCQHK   4m   (Japanese teishoku, 9 items)
                J4RKV  24m   (rice-noodle shop, 6 items)
                VYGX4 102m   (大爺燒鵝 — THE CORRECT MENU, 35 items)
```

The right menu is the FARTHEST of the three. Three unrelated restaurants sit
within ~25m of each other, well inside phone-GPS error, so the 250m union
mixes them (紋甲魷魚刺身 and 特大赤蝦刺身 — Japanese sashimi — are handed a
roast-goose menu) and nearest-session scoping would be *worse*, not better:
it picks the 4m Japanese shop for a 燒鵝 dish. Tightening the radius cannot
separate what GPS cannot resolve.

**What CAN separate them: `restaurant_id`.** The field dish resolved to
`126efbb2` (大爺燒鵝) and session VYGX4 carries the same `restaurant_id` —
an exact join that yields precisely the right 35 items and nothing else. But
that id is resolved CLIENT-SIDE AFTER the dish is created (`loadNearby`),
which is to say **after `inferDish` has already run**. Auto-adoption is
structurally stuck with noisy GPS; anything that happens on the growth card
gets the clean restaurant-scoped menu for free.

That is an argument for the picker independent of the honesty argument: it is
the only design that can use the good data. Note it does NOT rescue the field
case (大爺燒鵝雙拼飯 came from the correct restaurant's own menu — the dish was
a 自選雙拼飯 with no menu name at all), so the two defects are separate:
contamination is fixable by scoping, forced-matching is not fixable by prompt.
