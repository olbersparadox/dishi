# Session A — Paper + Liquid direction: spec

Confirmed by Jerry: dents-for-dislikes yes (softened), buddy option (a) clean
replacement, Figma skipped — spec directly from the approved hybrid mock.

## 1. Taste form (the blob)

Shipped in this session, pure and tested:
- `src/lib/blobForm.ts` — deterministic mapping from REAL profile
  (vector + evidence + rating_count + seed) to an organic radial form.
  - `dimState()` uses the exact /api/buddy thresholds (evidence >= 3 knows,
    1–2 learning, 0 fog). Single source of truth — never fork this.
  - Loved known dims = outward lobes; disliked = inward dents at 0.5 softening;
    learning dims at 0.3 gain; fog dims contribute NOTHING (honesty contract,
    regression-tested in tests/blobForm.test.ts).
  - Seed = `${userId}:v${profileVersion}` → identity is stable per version;
    version bumps visibly reshape the micro-form (export deltas are SEEN).
  - `formToSvgPath` / `blobSnapshotPath` render static snapshots (version
    cards, export headers, share images). Live renderer adds time-noise
    breathing ON TOP (see the approved chat prototype) and must never alter
    the base form.
- Renderer plan (Session B): Canvas 2D component `<TasteForm live />`, rAF
  paused off-screen via IntersectionObserver, devicePixelRatio capped at 2.
  Static `<TasteForm snapshot />` uses the SVG path. One math module, two
  renderers.
- Fog rendering: radial paper-wash halo, extent/opacity from `fogExtent()`.
- Center glyphs: top loved KNOWN dims as single characters (e.g. 鮮 嫩 生),
  max 3, from real vector order — never decorative.

## 2. 封印預測 (sealed predictions — ex "sealed bet")

Renamed: no gambling framing. The engine stamps a vermillion 印 in the fog;
rating breaks the seal.
- Migration: `supabase/pending/sealed_predictions.sql` (NOT applied). Apply
  at build-session start via MCP.
- Seal creation: when a dish enters awaiting-rating AND engine has >= 5
  ratings (training-gate consistency). Server-side only; client learns only
  that a seal exists.
- Reveal on rating commit: predicted vs actual, outcome hit/near/miss per
  bands in the SQL comment; streak computed in query.
- UI beats (Session B): stamp appears with a small press animation; reveal =
  seal cracks; post-rating screen shows prediction vs your flick + what the
  engine just learned (merges with backlog item 5, post-rating flow).

## 3. Buddy migration — option (a), clean replacement

- The taste form IS the companion. Animal species retire.
- XP/LEVELS/engineStrength in `src/lib/buddy.ts` survive unchanged — growth()
  in blobForm already consumes rating count; level names can label form
  maturity. `exploredDims`, `knows/learning` API shape unchanged.
- Migration moment (one-time, per user): "你嘅夥伴進化咗 — 而家佢就係你嘅味覺"
  with old species avatar dissolving into their real form. Copy TBD.
- BuddyCard.tsx becomes TasteFormCard; the "buddy speaks what it knows/is
  learning" honesty framing is KEPT — it maps 1:1 onto knows/learning/fog.
- SPECIES/SPECIES_INFO code left in place this session; removed in Session B
  after the migration moment ships.

## 4. Design tokens

- `src/app/paper-tokens.css` — not imported anywhere yet; zero pixel change.
  Session B imports from globals.css and migrates screens.
- Vermillion (--seal) is reserved: seal stamp + export CTA only.
- Serif display (--font-display) for headings/dish names/CTAs; sans for
  meta/labels/numbers.

## 5. Session B punch list (Sonnet)

1. Import paper-tokens, migrate Taste tab first, then log/scan flows.
2. TasteForm live + snapshot components from blobForm.ts.
3. Seal API routes + apply pending migration + post-rating reveal flow.
4. Buddy → taste form migration moment; retire species after.
5. Export strip: AI provider marks (Claude/Gemini/GPT/Grok as monochrome
   drawn marks, not official logos) above copy/export; versioned export (v3)
   with visible form delta.
6. Rate/delete buttons on awaiting-rating rows: 44px round, ink-filled rate
   (arrows-vertical icon), inset delete (trash icon) — per approved mock.
7. Remaining queued Sonnet items: Taste page polish, log-flow leftovers,
   post-rating landing (merged with seal reveal).
