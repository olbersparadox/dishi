# Spec: 語言對 — the globe picker (language-pair dish names)

**Tier: [F] — use Opus in Claude Code.** Fully specified, but it's a
cross-cutting refactor of the i18n core touching every surface; breadth
warrants the stronger model. **DB is already live**: `dishes.names jsonb`
applied via Supabase MCP 2026-07-18 (SQL at bottom — record as
`supabase/applied/dishes_names_translation_cache.sql`).

## Product shape

Replace the 中/EN switcher (top right) with a globe icon. Tapping opens:

```
  Primary dish name    [ 中文        ▾ ]
  ────────────────────────  ⇅ (swap)
  Secondary dish name  [ English    ▾ ]
```

Every dish name everywhere renders as PRIMARY (big, bold) over SECONDARY
(small, thin) in the chosen pair. Default pair = 中文/English → the current app
is pixel-identical for users who never touch the globe. Curated language list
(shown each in its own language): 中文 · English · 日本語 · 한국어 · ไทย ·
Tiếng Việt · Bahasa Indonesia · Filipino · Español · Français.

Pair persists like the current lang setting (same storage mechanism useLang
uses today, extended to a pair). Primary and secondary must differ; picking
the other slot's language swaps them.

## The one hard rule (data integrity — do not violate)

`name` (en) and `name_zh` (zh) remain the CANONICAL stored identity of every
dish. Every scan and every log still produces both, always, regardless of the
active pair — dish identity resolution, owner dashboards, and cross-user
linking depend on it. All other languages are PRESENTATION ONLY, cached in
`dishes.names` jsonb. New translation-layer code references a named constant
`CANONICAL_PAIR = ['zh', 'en'] as const` — never a hardcoded 'zh' — so a
future regional deployment is a constant change, not a rewrite. Do NOT touch
the name/name_zh columns or their semantics.

## Chrome vs dish names (the ripple-containment trick)

UI chrome (buttons, labels, all existing t() calls) stays zh/en only, derived
from the pair: chrome language = 'zh' if either slot is 中文, else 'en'. Keep
`lang` as this derived binary inside useLang so EVERY existing t() call site
keeps working untouched. Only DishName (and the couple of places that call
pickNames directly) consume the full pair. Full ja/ko chrome localization is
explicitly out of scope.

## DishName resolution

For a dish and slot language L:
1. L === 'en' → name; L === 'zh' → name_zh
2. else dishes.names[L] if cached
3. else fall back to canonical (zh for zh-adjacent? no — fall back to the
   canonical the user's pair implies: if primary missing, show name_zh when
   chrome is zh else name) — and REQUEST the translation (below). The
   canonical shows instantly; the translation fades in when it arrives —
   the "user can see progress" requirement. No spinners on names.
4. Never render the same string twice: if primary and secondary resolve to
   identical text, render primary alone (existing single-name behavior).

## Translation supply

**Batch endpoint** `POST /api/dishes/translate`:
- Mode A (persisted): `{ dish_ids: string[], lang }` → for each, return
  cached names[lang] or translate-and-cache. Translate ALL missing ones in ONE
  LLM call (batch of name+name_zh pairs in, JSON map out). Write cache via the
  user-scoped client is fine (own dishes) — but journal can show only own
  dishes; if any surface shows others' dishes (table mode), use admin for the
  cache write. Auth required.
- Mode B (ephemeral, for scan results before picking): `{ items: [{name,
  name_zh, name_original}], lang }` → returns translations, no persistence.
- Client: a small hook that collects visible untranslated dish ids/items,
  debounces one batch call per screen per language, and streams results into
  state. A dish-language pair is translated once ever (Mode A cache).

**Translation prompt** (one function, used by the endpoint) — the hardening
folded in from the Japanese-menu test:
- Target-language name must be REAL target language: katakana/hiragana/hangul
  must never appear in Chinese output; Chinese characters must never pass
  through unread into Japanese output, etc. Translate by MEANING.
- Kanji false friends when translating between ja and zh: 春雨=粉絲 ·
  人参=紅蘿蔔 · 大根=白蘿蔔 · 玉子=蛋 · Japanese 湯 = hot water, not soup.
- Chinese output: Traditional, HONG KONG register (吉列豬扒定食, 烏冬, 天婦羅,
  刺身). Figurative names translate by the dish, not the characters (existing
  菠蘿包 guidance applies).
- Output compact JSON map only.

Also apply the same katakana-prohibition + false-friend + HK-register lines to
the scan prompts' `"z"` field instruction (both scan prompt sites in
menuScan.ts) — canonical zh from a Japanese menu must be real Chinese.

## Smart preset on foreign scans

When a scan's `menu_language` is neither slot of the active pair: for THAT
scan session only, secondary becomes the menu's language, with a small
inline note near the results header (e.g. 副名稱：日本語（餐牌原文）· tap the
globe to change). Non-destructive — the persisted pair is untouched; leaving
the scan restores it.

**Fidelity rule:** when a display slot's language === menu_language, render
the skeleton's `name_original` (exact printed text) instead of any
re-translation — perfect fidelity for point-and-order / ticket-machine
matching, zero LLM cost. This is why the preset exists.

## UI details

- Globe icon replaces the two-segment switcher; same position/size footprint.
- Sheet/popover in the paper-ink language: two rows as sketched, swap icon
  between, tap outside to dismiss. i18n keys for the sheet labels (zh/en).
- Language names always rendered in their own language (self-identifying).
- No per-dish language controls anywhere — the pair is global.

## Tests (`tests/langPair.test.ts` + additions)

- Pair resolution: canonical slots, cached slot, missing→fallback, identical
  primary/secondary collapse, derived chrome lang (zh present → zh; ja/en →
  en; ja/ko → en).
- Preset rule: menu_language outside pair → session secondary override;
  slot===menu_language → name_original used verbatim.
- Translate endpoint: batches into one call, caches, returns cached on second
  hit without an LLM call (mock the model).
- Prompt guard: translation prompt contains the katakana prohibition and at
  least 春雨/人参 examples; scan z-instruction likewise.
- i18n parity for all new keys.

## Acceptance

- tsc clean; npm test green.
- Manual, the money test: rescan the Imakatsu photo with pair 中文/English →
  primary names are REAL Chinese (特選吉列豬扒定食-style), secondary English,
  session note offers 日本語; switch secondary to 日本語 → exact printed
  originals appear (fidelity rule). Then open the journal with pair
  日本語/English → names fade from canonical to Japanese as the batch call
  lands, and a second visit is instant (cache).
- A user who never opens the globe sees zero difference anywhere.

## Out of scope (explicitly)

- Chrome localization beyond zh/en.
- Translating restaurant_menu_items (owner surfaces fall back to canonical).
- Ingredients/hook translation beyond what exists (separate backlog item).
- Migrating name/name_zh into the jsonb (the real multi-region migration —
  future, deliberate, not now).

## Migration (already applied live — record as supabase/applied/dishes_names_translation_cache.sql)

```sql
alter table dishes add column if not exists names jsonb;
```
