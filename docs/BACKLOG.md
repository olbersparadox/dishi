# Dishi Backlog

Single source of truth for outstanding work. Triage/specs happen in the Claude
Project; execution happens in Claude Code. When an item ships: check it off with
the commit hash. When a new item is decided anywhere: add it here and push.

Model tier per item: **[S]** = Sonnet (well-specified build) · **[F]** = Fable/Opus
(design decisions, entity resolution, diagnosis).

## Now

- [ ] **[S] Diet-flag integrity (雞扎 problem).** Dish named chicken shows
  pork+beef chips and no chicken — taxonomy has no poultry flag, and no guard
  checks model output against the dish's own name. Trust-critical: users read
  chips as an ingredient list. Full spec: `docs/specs/diet-flag-integrity.md`.
- [ ] **[S] Three-path log entry (re-land).** Replace the single ＋記錄口味 button
  with 餐廳菜 / 屋企煮 / 相簿舊相; each path strips what it doesn't need.
  Full spec: `docs/specs/three-path-log-entry.md`. DB side is ALREADY live
  (dishes.source accepts photo|scan|table|manual|home|album) — this is code-only.

## Next

- [ ] **[S] Bilingual ingredient display.** The ingredients line under the diet
  chips (DishInfoDisplay) shows lowercase English as stored today. Give ingredients
  a zh/en pair so the line reads native in Chinese-first mode. Deferred out of the
  diet-flag-integrity work; needs its own small vocabulary/translation pass.
- [ ] **[F] Diet taxonomy growth (gluten, soy, nuts-general).** The 雞扎 fix took
  DIET_FLAGS from 7 → 13 (added poultry/lamb/egg/dairy/offal). Further allergen
  axes are real but each needs its own recipe-grounding thought — do NOT bolt them
  on ad hoc; keep the vocabulary closed and deliberate.
- [ ] **[S] Seal at pick time.** Move seal creation (`POST /api/seals`) from
  queue-load to the pick-confirm moment on the scan page, so the prediction is
  committed when the user ORDERS, not when they next open the Taste tab.
  Strengthens the honesty framing; small change, endpoint already idempotent.
- [ ] **[F] 食記 ordering for album logs.** Old camera-roll photos have a fuzzy
  eaten-date; decide: order journal by when-eaten vs when-logged, and how to
  capture an approximate eaten-date at log time without adding friction.
  Design conversation first — do not build straight from this line.

## Later / standing

- [ ] **[F] Taste export as a recurring loop.** Versioned deltas shipped; open
  question is cadence and re-engagement (when/how the app invites a re-export).
- [ ] **Strategy: consumer scan density.** One dense neighborhood before
  expanding; no friend graph at this stage. Not a code item.

## Done (recent, for context)

- [x] Sealed-bet mechanic end-to-end + RLS/admin-client fix (印 stamp live in prod)
- [x] Scan persistence across tab switches (`src/lib/scanSession.ts`)
- [x] Taste tab redesign: black radar, bold top-3, progress bar, stat sizing
- [x] Owner menu authority tier + `tests/ownerMenuReconcile.test.ts`
- [x] dishes.source constraint widened live (fixed silent no-photo log failure)
