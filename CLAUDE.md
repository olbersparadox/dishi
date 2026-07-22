# Dishi — Project Context for Claude Code

Dish rating + taste-learning app for Hong Kong. Users scan menus, rate dishes, and
build an authentic taste profile that exports as a prompt to their personal AI.
Bilingual zh-HK (Traditional Chinese, HK Cantonese) / English — **Chinese-first**
in product copy and field ordering. Restaurant-side monetization is a
"claim your page" model (Google Business Profile style); the moat is
consumer-side dish-level demand data.

## Hard product principles (never violate)

- **Never sell placement or ranking influence to restaurant owners.** It destroys
  consumer trust in the recommendation engine.
- **No rec is better than an irrelevant one.** Recommendation quality gates
  everything; don't pad results.
- **The sealed-bet honesty contract:** a sealed prediction is written server-side
  BEFORE the user rates and is never returned to the client until revealed.
  The client may only ever learn that a seal exists (the 印 stamp). Anything
  that leaks a pending prediction breaks the product claim.
- **Name authority ladder** (`nameAuthority()` in `src/lib/dishIdentity.ts`):
  OWNER(4) > MENU(3) > HUMAN(2) > VISION(1). Upgrades only — never silently
  demote a name's tier. A user editing a name sets human authority
  (`name_edited_at`); propagating an identity name to dishes must NOT touch
  `name_edited_at`.
- Equal-weight logging: restaurant dishes, home cooking, and old camera-roll
  photos all count the same. Don't privilege the restaurant path in UI.

## Stack & commands

- Next.js (app router) + Supabase + Vercel. Repo root is the project root.
- Verify with: `npx tsc --noEmit` and `npm test` (vitest; all tests must pass).
  Known pre-existing failure to ignore: `tests/i18n.test.ts` downlevelIteration
  errors under bare tsc (vitest runs it fine).
- Deploy: push to `main` → Vercel.

## Database workflow

- Migrations are applied LIVE to Supabase (via MCP or dashboard), then the exact
  SQL is recorded in `supabase/applied/<name>.sql` with a header comment noting
  the date and why. `supabase/schema.sql` is descriptive; **live schema is the
  source of truth** — inspect it before assuming.
- **RLS pattern:** `supabaseServer()` is the user-scoped client and respects
  RLS. `supabaseAdmin()` bypasses it. Any table that is deliberately
  RLS-locked against its own owner (e.g. `sealed_predictions` — pending rows
  invisible by design) must be read/written ONLY via `supabaseAdmin()` in API
  routes, after authenticating the user and scoping to their `user_id`.
  A silently-blocked insert (RLS or check constraint) is a known failure class
  here — when a write path "never seems to run," check policies and constraints
  in the live DB first.
- `dishes.source` check constraint allows:
  `photo | scan | table | manual | home | album`. `scan`/`table` are reserved
  for their pipelines; the `/api/dishes` endpoint whitelists what it accepts.

## Architecture map (where things live)

- `src/lib/dishIdentity.ts` — dish identity resolution: 3-gate pipeline
  (string prefilter → LLM adjudication → human confirm), authority ladder.
- `src/lib/ownerMenuReconcile.ts` — owner-published menu names adopting
  identities (exact match free; LLM fuzzy capped at 12 per publish; fails
  closed). Tests: `tests/ownerMenuReconcile.test.ts`.
- `src/lib/restaurant.ts` — restaurant dedup: `place_id` canonical, cosmetic
  name match either language within 50m, guarded containment fallback.
- `src/lib/seal.ts` + `/api/seals` + `/api/ratings` — sealed-bet mechanic
  (create → 印 stamp → reveal on rating; streak computed from revealed history).
- `src/lib/scanSession.ts` — in-memory persistence of a scan across tab
  switches (deliberately NOT Web Storage: must clear on browser refresh).
- `src/lib/openrouter.ts` (`callClaudeStream`) + `src/lib/jsonSalvage.ts`
  (`salvageJsonObjects`) — token-level SSE scan streaming + incremental JSON.
- Logging a dish: one entry point, `src/app/profile/page.tsx`'s merged
  restaurant/home/album pill, which all three open the SAME photo picker →
  `src/components/RatingStack.tsx` (flick card → `TasteGrowth` growth
  screen). Menu-scan picks feed the same rating queue (`log.toRate` on the
  Taste tab) instead of a separate flow. The old standalone `/log` page
  (three `?source=` modes, its own picker/flow) was killed 2026-07-22 —
  don't recreate it; if a photo-first or home-cooking entry needs new UI,
  it belongs on the merged pill, not a new route.
- Taste engine: `src/lib/taste.ts` (EMA + full-history replay on re-rating —
  never incremental-update a re-rated dish), `src/lib/buddy.ts`,
  `src/components/TasteForm*.tsx` (blob ↔ radar).

## Conventions

- Bilingual copy lives in `src/lib/i18n-dict.ts`; every key needs zh + en
  (tests enforce parity). Remove keys when their last usage goes.
- Comments explain WHY (design rationale), not what. Keep the existing style.
- Prefer small shared components (`DishInfoDisplay`, `icons.tsx`) over
  duplication; pure logic goes in `src/lib` with a vitest file.
- UI: quiet ink-on-paper aesthetic; ink (`--ink`) for primary, vermillion
  (`--seal`) reserved for the seal stamp, the export CTA, and the dish-edit
  "儲存" button's dirty state (`.btn.primary.dirty` — vermillion the moment a
  field actually changes; wired app-wide at every dish-edit site).
- **Backlog hygiene:** `docs/BACKLOG.md` holds OPEN items only. When an item
  ships, move its full entry (rationale + every amendment, verbatim — don't
  summarize or paraphrase) into `docs/DECISIONS.md` under the same batch
  heading, and leave a one-line "(items N shipped — see DECISIONS.md)" pointer
  if other items in that batch are still open. Do this as part of marking the
  item done, automatically, without being asked. Read `docs/BACKLOG.md`
  surgically (grep section headers, read only the relevant batch) rather than
  doing full-file reads once it's grown past what you need for the task.

## Model selection (decide per task, state the choice)

- **Strongest model (Opus/Fable tier):** entity-resolution tradeoffs, cross-layer
  diagnosis (e.g. silent DB failures), R&D with uncertain success, simulation-
  heavy verification, anything touching the authority ladder or seal contract.
- **Sonnet tier:** well-specified implementation, UI polish, copy changes,
  straightforward builds from a spec.
- The owner sets an explicit go/no-go probability bar (~50%) before committing
  to R&D directions — surface success-probability estimates early.

## Open threads (check with owner before starting)

- 食記 journal: order album logs by when-eaten vs when-logged (fuzzy eaten-date
  question is unresolved design).
- AI taste export loop: keep versioning deltas visible and recurring.
- Consumer scan density: one dense neighborhood first; no friend graph yet.

## UI verification (mandatory)

- **Screenshot before "done".** Any task that changes what a user sees ends
  with a rendered screenshot of the affected screen(s), posted in the reply,
  BEFORE claiming completion. "The code matches the spec" is not evidence;
  pixels are. For flows with roles (host/joiner, owner/diner), screenshot
  each role.

- **Reuse, don't imitate.** When a task says two surfaces must be "the
  same," mount the same component — never build or restyle a lookalike.
  If you find yourself copying styles to make B resemble A, stop: that is
  the wrong implementation, not a shortcut to it.

- **Kill legacy on replacement.** When a view is superseded, delete the old
  component in the same PR. It must not remain importable. Feature-flagged
  corpses are how regressions ship.

- **Verify on real data.** Seed fixtures (test dishes, tiny menus) are for
  unit tests only. Visual verification uses a realistic session (e.g. a
  full scanned menu), because fixtures hide layout and density failures.

- **Sameness tests assert identity.** A test for "X renders the same as Y"
  must compare component trees / snapshots such that a lookalike FAILS it.

Private/local context (IDs, test accounts) lives in `CLAUDE.local.md` — not
committed. Deeper product history: `SPEC.md` and `docs/`.
