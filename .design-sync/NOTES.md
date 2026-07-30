# design-sync notes — Dishi

Repo-specific gotchas for future syncs. Read this before re-running.

## Shape: an app, not a package

- Dishi is a Next.js **application**. There is no library `dist/`, no `main`/
  `module`/`exports` in package.json, and `npm run build` is `next build` (which
  produces `.next/`, not a component entry). `shape: "package"`, and the entry is
  a barrel we maintain: **`.design-sync/entry.tsx`**.
- **Always pass `--entry ./.design-sync/entry.tsx`.** Without it the converter
  resolves the package as `node_modules/dishi`, which never exists (npm won't
  self-install a package into its own repo), and the build dies with
  `ENOENT … node_modules/dishi/package.json` before printing any diagnostic tag.
  With `--entry`, PKG_DIR is derived by walking up to the nearest package.json
  with a `name` — the repo root — which is what everything else expects.

## Component discovery must be explicit

- With no build there is no `.d.ts` tree, so `exportedNames()` finds **0**
  components (it parses only `next-env.d.ts`). The `deriveComponentsFromSrc`
  fallback runs **only in synth-entry mode**, and passing `--entry` disables it.
  Net effect: discovery finds nothing on its own and the run degrades to
  `[ZERO_MATCH] … tokens-only DS` with `components: 0`.
- The fix is `componentSrcMap` with **non-null paths**, which both *adds* the
  component and pins its source. Every component we sync is enumerated there.
  This is the one place that must be edited when a component is added or removed
  — the barrel and the map have to agree, or the card renders
  "Element type is invalid".

## Provider

- `cfg.provider` is `LanguageProvider` (from `src/lib/i18n`). Nearly every
  component reads i18n context and renders blank without it.
- `extraEntries: ["./src/lib/i18n"]` does **not** resolve (logged as
  `! extraEntries: … not found — skipped`). Don't re-add it — the barrel
  re-exports `LanguageProvider` directly, which is what puts it on the bundle's
  export list where `provider` validation looks for it.

## Scope

- **52 exports synced**: 24 single-component files, 3 from `TasteForm.tsx`
  (`TasteFormSnapshot`/`TasteFormLive`/`TasteFormReveal` — this file has **no**
  default export), and the 25 named icons from `icons.tsx`.
- **18 components deliberately excluded** — they need Supabase, `next/navigation`,
  or a `fetch` to render at all: AuthGate, DuelOverlay, ExecutionSlider, FeedCard,
  FeedList, IdentityConfirmCard, MyDishes, NotificationBell, OtpForm, PostSheet,
  PublicDossier, RatingStack, RestaurantPicker, Shell, SignInSheet, TasteFormCard,
  TasteGrowth, UsernameSheet. Adding any of them means mocking its data source
  first; a card that renders blank teaches the design agent nothing.
- Note the comparison chassis splits: `DuelSide` (the side anatomy) is in,
  `DuelOverlay` (the card shell, which fetches) is out. Per CLAUDE.md the
  comparison family is core product DNA and expected to grow, so re-including
  `DuelOverlay` behind a mock is the most valuable single addition next time.

## Known limitation: every component lands in group "general"

- `c.group` is derived from the component's source directory relative to
  `srcDir`. Every Dishi component sits flat in `src/components/`, so the relative
  dir is empty and everything falls through to `general`.
- The documented regroup route (`cfg.docsMap` → a stub `.md` with
  `---\ncategory: X\n---`) was **rejected on purpose**: a stub doc *replaces* the
  synthesized `.prompt.md`, and the synthesized version (props body + JSDoc +
  preview examples) is what the design agent actually reads. Trading a real usage
  reference for a folder label is a bad deal.
- The clean fix, if grouping matters later, is a real docs tree with frontmatter
  `category` per component — that sets the group **and** improves the prompt.
