# Fix addendum: 語言對 — two gaps found in live Japanese-menu test

**Tier: [S].** Remediation of the confirmed `language-pair-globe.md` spec —
its acceptance test (rescan Imakatsu with 中文 primary) fails. Verified against
`ec16af0`: with pair 中文/English, primary renders the Japanese original
(特選ロースカツ膳) and the foreign-menu preset never fires.

## Gap 1 — scan z-instruction was never hardened

The katakana/false-friend/HK-register rules exist ONLY in
`src/lib/nameTranslate.ts`. The spec required them ALSO in the scan prompts'
`"z"` field instruction — both prompt sites in `src/lib/menuScan.ts` still say
just `"z": string (Traditional Chinese name; translate if needed)`.

Fix: extend the z instruction at BOTH sites (one-shot SYSTEM and the
skeleton/stream prompt) with the same rules already written in nameTranslate:
Traditional Chinese in HONG KONG register; if the menu language is not
Chinese, TRANSLATE by meaning — katakana/hiragana/hangul must never appear in
z; HK-conventional names for foreign dishes (ロースカツ膳 → 吉列豬扒定食,
うどん → 烏冬, 天ぷら → 天婦羅); kanji false friends translated by meaning
(春雨=粉絲 · 人参=紅蘿蔔 · 大根=白蘿蔔 · 玉子=蛋 · Japanese 湯 = hot water).
Factor the shared rule text into ONE exported constant used by both
menuScan.ts and nameTranslate.ts so they can never drift again.

## Gap 2 — bilingual menus defeat menuLanguageToCode

The Imakatsu board is Japanese + English; the model reports a compound value
("Japanese and English" or similar) → `menuLanguageToCode` maps it to null →
the foreign-secondary preset never fires (secondary stayed English, no
session note).

Fix, both ends:
- Prompt: instruct `menu_language` to be the menu's PRIMARY language as a
  single lowercase word; when a menu is bilingual with English, report the
  NON-English language (that's the language the dishes are "really" in).
- Mapping: make `menuLanguageToCode` resilient anyway — substring match
  (contains 'japan' → ja, 'korea' → ko, etc.), and for compound values
  containing English plus one other recognized language, return the other
  language. Unit-test: 'Japanese and English', 'japanese/english', 'JA',
  'bilingual japanese-english' → 'ja'; 'english' → 'en'; 'chinese + english'
  → 'zh'; garbage → null.

## Tests

- Prompt guard: both menuScan prompt sites contain the shared z-rule constant
  (assert on the constant's presence in the built prompt strings).
- menuLanguageToCode cases above.
- Existing langPair fidelity tests still green.

## Acceptance

The spec's original money test, for real this time: rescan the Imakatsu photo
with pair 中文/English → primary is real Chinese (特選吉列豬扒定食-style),
session note offers 日本語 as secondary, and choosing it shows the exact
printed originals.

---

# v2 addendum (after the 11:42 rescan on c8af257)

Timeline: c8af257 went READY ~11:39-40; the rescan was 11:42 — probably the new
prompt, but borderline. Regardless, this is the SECOND prompt-wording attempt at
making the skeleton model (qwen) translate z, with at least one confirmed
failure. Conclusion: stop relying on prompt compliance from the skeleton vision
model. Add a mechanical guarantee.

## Fix 3 — kana/hangul tripwire + re-author via the proven translate path

- Deterministic detector on every skeleton item's z (and n if it ever matters):
  `/[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/` (hiragana, katakana incl.
  extensions, hangul). Pure script check — cannot false-positive on real
  Chinese. Exported + unit-tested (`hasNonChineseScript` or similar).
- In the scan pipeline (both stream and one-shot), after skeleton parse:
  collect tripped items, batch re-author their z in ONE call through the
  nameTranslate zh path (buildTranslatePrompt machinery — the demonstrably
  compliant model/prompt), then emit the corrected names through the existing
  enrichment-update event so the UI patches progressively. Bounded: one batch
  call per scan, only when tripped; zero cost on Chinese/English menus.
- Keep the prompt hardening (it reduces trips) but treat it as optimization,
  not guarantee. The tripwire is the guarantee — and covers ko/th menus free.
- Tests: detector cases (katakana, hiragana, hangul, pure Traditional Chinese
  incl. 吉列豬扒定食 → false, mixed kanji+kana → true); pipeline test with a
  mocked skeleton returning Japanese z → re-author call made once, corrected z
  emitted.

## Fix 4 — chip dedupe by LABEL, not just icon

ヒレカツ膳 rendered 牛肉 twice: beef diet flag (🐮 牛肉) + beef ingredient
(🥩 牛肉) — the ingredient-chip dedupe (71447a6) compares icons only. Dedupe by
rendered LABEL too in DishInfoDisplay. (The beef-on-pork-fillet hallucination
itself is noted but not chased here: flag and ingredient corroborate each
other, so dietSuspicion structurally can't catch mutual hallucination —
accepted limitation, revisit only if it recurs visibly.)

## Acceptance (v2)

Same Imakatsu money test, plus: force a mock skeleton with kana in z → UI never
shows kana in the primary Chinese slot at any point after enrichment settles;
ヒレカツ膳 card shows at most one 牛肉 chip.

---

# v3 addendum: the preset must yield to an explicit user choice

Live finding (12:17 test): with the foreign preset active (secondary = 日本語),
changing the secondary to English in the globe does nothing — the override is
recomputed from the persisted pair on every render, so any pair not containing
ja gets stomped back to ja. The user is trapped, and the inline note's 撳地球可改
promise is false. Also: the popover shows the PERSISTED pair (English) while the
page shows the EFFECTIVE pair (Japanese) — the UI contradicts itself.

Rule: **the preset is a default; an explicit user choice beats a default,
immediately and for the rest of that scan session.**

## Fix 5

1. While a scan's foreign preset is active, the globe popover displays the
   EFFECTIVE pair — secondary reads 日本語（餐牌原文）— not the persisted one.
2. Any change made in the pair picker while scan results are open clears the
   preset for that scan session (a session flag alongside the existing
   scanSession state, so it survives tab switches like the rest of the scan and
   dies on X/refresh with it). From that moment scanPair = the user's chosen
   pair, exactly as chosen. Choosing 日本語 explicitly keeps Japanese — now by
   choice rather than by trap. Persisted-pair semantics are unchanged.
3. Tests: preset active → user sets secondary en → effective secondary en and
   stays en across re-renders; preset cleared flag persists in scanSession;
   new scan (new menu) re-evaluates the preset fresh.

Acceptance: reproduce the 12:17 sequence — scan Japanese menu, open globe, set
secondary to English → secondary line switches to English and stays; set it
back to 日本語 → printed originals return.
