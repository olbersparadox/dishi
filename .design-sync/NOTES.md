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

- **54 exports synced.** `TableWaitLayer` and `TableSettle` joined 2026-07-30
  (the done-picking handshake and the bill). Both take everything as props with
  no Supabase and no fetch, so they belong in scope rather than with the 18
  data-coupled exclusions below. Both needed `cardMode: single` — each contains
  a fixed-position element (the wait layer's scrim, the bill's 去評分 bar) and
  tripped `[GRID_OVERFLOW]` exactly like `ExplainModal`/`SnapRating` did.
- Of those, **52 came from the first sync**: 24 single-component files, 3 from `TasteForm.tsx`
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

## Authoring previews: what bit us

- **Captures are a fixed 900x700 screenshot, not full-page.** A cell taller than
  ~700px at the capture canvas's near-full width is silently cropped — the DOM is
  fine, the image just stops, with no visual sign anything is missing. Any cell
  containing a 4:3-or-taller photo must be wrapped at the app's real `.shell`
  width (`maxWidth: 420`, matching `globals.css`) before capture. That is also the
  compositionally correct choice: the app never renders wider than 420px. If a
  future card "stops partway down" for no reason, check width first.
- **No dish photo assets exist in this repo** (`public/` has only a menu scan and
  provider logos), and external URLs don't load during headless capture. Previews
  that need a photo use small inline `data:image/svg+xml` tiles. If real dish
  photos ever land in the repo, swap them in.
- **`DailyInteractions` is data-coupled one hop out** — it has no `fetch` of its
  own, which is why the original presentational/coupled split missed it, but
  `useInteractions` fetches `/api/interactions/today` and the component returns
  null on an empty feed (a zero-height cell). Its preview installs a fetch
  interceptor scoped to that one URL, passing everything else through. It is
  therefore tied to that endpoint's response shape — see Re-sync risks.
- **The taste blob is gated by `evidence`, not by `vector`.** A vector without a
  matching evidence map renders a near-circle whatever its values, so a realistic
  `FormInputs` needs all four fields (lopsided vector, evidence map, ratingCount,
  stable seed). The radar's callout threshold is `> 0.12`; a sparse profile
  should reach "early" by having few dims past it, not by shrinking everything.
- **Some states genuinely can't be captured** and were skipped deliberately
  rather than shipped blank: `TableRestaurantLine`'s expanded picker (internal
  state, and forcing it open mounts `RestaurantPicker`, which hits
  `navigator.geolocation` on mount), and `PhotoPicker`'s bare `hideLabel` variant
  (nothing in the app mounts it that way).

## Product issue found while authoring (not a sync problem)

- `TasteRadar` clips long **Latin** callout labels near the horizontal rim: at
  reveal size a strong "umami" or "grilled" overflows the SVG viewBox and
  truncates. zh labels are 1-2 glyphs and never reach it, so this is invisible in
  the Chinese-first default and only bites English-primary users. The
  `EnglishLabels` preview cell works around it with a palate whose callouts sit
  top/diagonal; once the component is fixed, that cell should be changed to a
  horizontal-axis palate so it pins the fix instead of dodging it.

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

## Techniques worth reusing

- **Use the app's real classNames in previews.** `globals.css` loads for every
  preview, so mounting an icon inside `.icon-btn` / `.row-menu` / `.ok-circle`
  renders the real chrome for free. Inventing lookalike markup gets you a card
  that teaches markup the product doesn't use.
- **Fixed-position overlays can be framed.** `SnapRating` and `ExplainModal` are
  `position: fixed; inset: 0` and would smear across the whole capture viewport.
  A wrapper with `transform: translateZ(0)` becomes the containing block for
  fixed descendants, so the overlay renders in a phone-sized footprint. Their
  internal vw/vh formulas are all `min()`-capped, so nothing breaks at 900x700.
- **Cover a non-renderable state through a real caller's composition.**
  `SealRevealBadge`'s tap-open balloon and `SealStamp`'s explainer are internal
  state with no prop access, but both are just `ExplainModal` compositions — so
  the `ExplainModal` preview ports them verbatim. The state gets taught without
  faking open-state props.
- **Never pin a height on a frame that contains a fixed element.** The
  `translateZ(0)` wrapper makes the box the containing block, so a fixed child
  positions against the WRAPPER's bottom, not the viewport's. `TableSettle`'s
  first pass pinned the frame at 660px while the bill ran ~750px, which dropped
  the fixed 去評分 bar straight onto the 如何付款 pills — a preview artefact that
  looks exactly like a component bug (the live app renders it correctly). Let the
  frame grow to its content and the bar lands back inside the component's own
  bottom padding.
- **Absolutely-positioned menus need room.** `.row-menu` is `right: 0` with a
  140px min-width; if its parent sits near the cell's left edge the dropdown
  overhangs the capture region and vanishes. Give the wrapper left padding.

## Two icons have no call site

`LockIcon` and `PotIcon` are exported from `icons.tsx` and imported nowhere in
`src/` (verified). Their preview cells are therefore **inferred** compositions,
not ported from a real screen. Whether they are dead code is a cleanup call for
the owner, not something a sync should decide.

## Vermillion drift: the documented law and the CSS disagree

CLAUDE.md reserves `--seal` for the seal stamp, the export CTA, and the
dirty-save button. `globals.css` actually has **13** `var(--seal)` consumers.
Beyond the sanctioned ones (`.btn.primary.dirty`, `.icon-btn.save.dirty`, the
export button, the seal modal/stamp rules), vermillion also paints:
`.wordmark em` (the "i" in dishi — brand, and clearly deliberate),
`.snap-tick.on`, `.learn-learned`, `.learn-row.needs-look`, `.scan-reason` +
`.scan-reason-icon`, and `.notif-dot`.

`conventions.md` states the strict rule, because that is the right guidance for
NEW design and it is the owner's stated law. Nothing was changed in `globals.css`
— reconciling the two (tighten the CSS, or formally widen the rule) is an owner
decision, deliberately not made inside a sync.

## Correction to a subagent claim

One batch reported that `FlickRating` has no live call sites and might be
kill-legacy. **That is wrong** — `MyDishes.tsx:643` mounts it for re-rating from
the journal. The agent only had 7 components in view and `MyDishes` is one of
the 18 excluded from this sync, so the call site was invisible to it. Do not
propagate that claim. The related finding IS real and reachable: with a null
`photoUrl`, `.flick-hint` renders on top of `.flick-nophoto`'s dish name.

## Known render warns (triaged as legitimate — a warn NOT listed here is new)

- `[RENDER_THIN]` on **ArrowLeftIcon, LinkIcon, LockIcon** — their cells contain
  no text at all, which is correct for an icon. They render; the heuristic is
  measuring text, not pixels.
- `variantsIdentical` on **TasteFormReveal** — its two cells are the Taste-tab
  mount and the PublicDossier mount, which differ by the presence of the centre
  glyph. The dimension labels around the blob are the same in both, so a
  text-based comparison sees them as identical. The visual difference is real.
- `[TOKENS_MISSING]` for `--x`, `--y`, `--lo`, `--hi`, `--val`, `--porcelain` —
  set at runtime from JS/inline style, so they are expected to be absent from a
  static stylesheet. `--font-body` and `--font-wordmark` come from `next/font`
  in `layout.tsx`, which the DS bundle does not carry.
- `[FONT_MISSING]` for **Songti TC** and **Cascadia Mono** — system fonts with
  no shippable `@font-face`, accepted deliberately (owner, 2026-07-30). Noto
  Serif TC now backs the Chinese display face for non-macOS viewers.

## Card presentation overrides

Nine components needed `cfg.overrides` after the first full render check:
`ExplainModal`, `PickedCartBar` and `SnapRating` are fixed/portal surfaces whose
content escapes any grid cell, so they use `cardMode: single` with a chosen
`primaryStory`; `HomeIcon`, `InteractionRow`, `PhotoIcon`, `PhotoPicker`,
`TasteFormSnapshot` and `UtensilsIcon` render wider than a grid cell and use
`cardMode: column`, which keeps every export at full card width. These are
presentation-only and carry their grades.

## Re-sync risks — what can silently go stale

- **`entry.tsx` and `componentSrcMap` must agree.** They are maintained by hand.
  A component added to one and not the other either never appears or renders
  "Element type is invalid".
- **`process-shim.ts` is load-bearing and order-sensitive.** It must remain the
  FIRST import in `entry.tsx`. Moving it below another import puts every card
  back to blank, with an error that names `process`, not the import order.
- **The fonts are gitignored.** `.design-sync/fonts/` (5.7MB, 108 woff2) is not
  committed. On a fresh clone, regenerate before building, or `[FONT_MISSING]`
  returns and Chinese silently loses its serif off macOS:
  `curl 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap'`
  with a browser User-Agent, download each woff2 into
  `.design-sync/fonts/noto-serif-tc/`, and rewrite the URLs to `./noto-serif-tc/<file>`.
- **`DailyInteractions`' preview mocks `/api/interactions/today`.** If that
  endpoint's response shape changes, the card keeps rendering the old shape and
  nothing fails loudly.
- **Data-URI photo stand-ins** are used wherever a dish photo is needed, because
  `public/` has none and capture is offline. Real photo assets would be better.
- **Songti TC and Cascadia Mono stay unshipped by design** (system fonts). That
  `[FONT_MISSING]` warning is expected — it is not a regression.
- **Two states are deliberately uncaptured**: `TableRestaurantLine`'s expanded
  picker and `FlickRating`'s no-photo rest state (the latter until the overlap
  bug is fixed, at which point it should gain a cell that pins the fix).
