# Spec: Three-path log entry (餐廳菜 / 屋企煮 / 相簿舊相)

**Tier:** Sonnet. **Scope:** code only — the DB migration is already applied to
prod (`dishes.source` check constraint accepts
`photo|scan|table|manual|home|album`). Record it in
`supabase/applied/dishes_source_expand_check.sql` as part of this task (SQL below).

## Goal

The single ＋記錄口味 button on the Taste tab tells users nothing about scope.
Replace it with three equal-weight entry paths so the surface itself teaches that
anything counts. Each path lands in `/log` with the steps it doesn't need removed.

## 1. Taste tab (`src/app/profile/page.tsx`)

Replace the `＋記錄口味` `<Link className="btn primary">` with a 3-column row:

- 餐廳菜 / "Dining out" → `/log`
- 屋企煮 / "Home-cooked" → `/log?source=home`
- 相簿舊相 / "Old photos" → `/log?source=album`

Style: uniform ink pills (`--ink` bg, `--glaze` text, `--font-display`,
border-radius 999px, ~14px vertical padding, grid `repeat(3,1fr)` gap 8px,
margin-bottom 26px). Equal weight across all three is the point — do NOT make
the restaurant one primary. Remove the now-unused `profile.logadish` i18n key.

## 2. Log flow modes (`src/app/log/page.tsx`)

Read `?source=` once at mount into `mode: 'restaurant' | 'home' | 'album'`
(unknown/absent → `restaurant`, so old links keep working).

- **restaurant**: classic flow, unchanged.
- **home**: header 記錄屋企煮嘅 / "Log a home-cooked dish". The restaurant
  question is REMOVED entirely (not made skippable) from BOTH the photo path
  and the typed no-photo path. Save calls must not send restaurant fields in
  this mode even if a stale selection exists in state.
- **album**: header 記錄相簿舊相 / "Log from your camera roll". Hint line above
  the photo picker: 喺相簿揀返張食物相 — 幾耐之前食都得 / "Pick a food shot from
  your photos — no matter how long ago". HIDE the typed-only (冇影相) pill — an
  album log without a photo is a contradiction. Restaurant question survives but
  demoted: label 記唔記得喺邊度食？唔記得可以跳過 / "Remember where you had it?
  Skip if not", and the 跳過 chip renders FIRST in the picker's chip row.

## 3. RestaurantPicker (`src/components/RestaurantPicker.tsx`)

Add prop `skipFirst?: boolean` (default false). When true, render the skip chip
before the nearby chips and suppress the trailing one. No other behavior change.

## 4. Source wiring

- Photo save (`logDish` FormData): append `source` when mode ≠ restaurant.
- Typed save (`createWithoutPhoto` JSON): send `source: 'home'` when mode=home.
- `/api/dishes` (`src/app/api/dishes/route.ts`):
  - Form path: read `source`, whitelist `['photo','home','album']`, default
    `'photo'`, write explicitly on the insert.
  - JSON path: `source: body?.source === 'home' ? 'home' : 'manual'`.
  - Never accept `'scan'`/`'table'` here — reserved for their own pipelines.

## 5. i18n (`src/lib/i18n-dict.ts`) — all keys need zh + en (tests enforce parity)

`logsrc.rest` 餐廳菜/Dining out · `logsrc.home` 屋企煮/Home-cooked ·
`logsrc.album` 相簿舊相/Old photos · `log.title.home` · `log.title.album` ·
`log.album.hint` · `log.album.where` (values above).

## 6. Migration record — `supabase/applied/dishes_source_expand_check.sql`

```sql
-- Applied via Supabase MCP on 2026-07-17. Expands dishes.source to all log
-- entry contexts. Also fixed a latent bug: the typed no-photo path inserted
-- source='manual', which the old constraint (photo|scan|table) rejected —
-- every no-photo log failed silently until this widening.
alter table dishes drop constraint if exists dishes_source_check;
alter table dishes add constraint dishes_source_check
  check (source = any (array['photo'::text,'scan'::text,'table'::text,
                             'manual'::text,'home'::text,'album'::text]));
```

## Acceptance

- `npx tsc --noEmit` clean (ignore known `tests/i18n.test.ts` downlevelIteration
  errors under bare tsc); `npm test` all green.
- Manual: each chip lands on the right tailored screen; home saves have no
  restaurant and `source='home'`; album save carries `source='album'`;
  a plain `/log` visit is pixel-identical to today.
