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
