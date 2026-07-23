-- Applied live: 2026-07-23 (via MCP execute_sql).
-- Why: POST /api/dishes/pick never wrote eaten_at — only the photo path set it,
-- from EXIF — so scan/table picks showed 某年某月某日 in 食記 despite the eaten
-- time being known precisely (pick time IS the eaten time; the person is at the
-- table choosing off the menu). The route now stamps eaten_at = now() on every
-- created row (src/lib/pickRows.ts); this backfills the rows created before
-- that fix, using created_at, which for a pick is the same moment.
-- Dry-run first (begin … returning … rollback): exactly 2 rows matched, both
-- source='table', nothing outside scan/table. Applied for real: same 2 rows.

update dishes set eaten_at = created_at
  where eaten_at is null and source in ('scan','table');
