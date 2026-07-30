## Building with Dishi

Dishi is a Hong Kong dish-rating app. Quiet ink-on-paper, Chinese-first, one
accent colour used sparingly. The rules below are not stylistic preferences;
breaking them makes a design read as not-Dishi.

### Wrap everything in the provider chain

Almost every component reads i18n context and renders **blank** without it.
`DishName` also reads the translation cache, `LanguagePicker` the scan preset:

```jsx
<LanguageProvider>
  <TranslationProvider>
    <ScanPresetProvider>
      {/* your design here */}
    </ScanPresetProvider>
  </TranslationProvider>
</LanguageProvider>
```

### The styling idiom: semantic classes + custom properties

There are **no utility classes**. Style with the existing semantic class names,
and reach for `var(--token)` for colour, size and radius. Inline `style` is used
only for genuinely dynamic values (a computed size, a per-user colour).

The class families that carry most of the app:

| Family | Names |
|---|---|
| Card | `card`, `card-title`, `card-body`, `card-meta` |
| Button | `btn` plus `primary`, `ghost`, `small`, `large`, `export`, `is-disabled` |
| Chip | `chip`, `chips`, `chip-util` |
| Form | `field`, `label`, `small` |
| Stat | `stat`, `stat-num`, `stat-label`, `stat-row` |
| Icon button | `icon-btn` |

Colour tokens: `--glaze` (paper), `--paper-raised`, `--paper-inset`, `--ink`,
`--ink-soft`, `--ink-faint`, `--line` (hairline), `--seal` (vermillion),
`--seal-ink`.

Type is a **seven-step scale chosen by role, not by size** — never invent an
eighth: `--fs-micro` (labels, badges), `--fs-caption` (`--ink-soft` meta text),
`--fs-body` (UI copy), `--fs-subtitle-a` / `--fs-subtitle-b` (dish-name rows,
denser and looser), `--fs-title-a` (stat numbers, mid headlines), `--fs-title-b`
(page titles). Buttons use `--fw-btn`. The display serif is `--font-display`.
Radii: `--radius`, plus `--r-form`, `--r-ai`, `--r-session`, `--r-stat`.

### Vermillion is reserved

`--seal` belongs to exactly three things: the 印 seal stamp, the AI-export CTA,
and a save button's dirty state. **Never use it for emphasis, links, badges,
errors, or decoration.** Everything else is ink on paper. Per-user chop colours
are the one other exception and come from their own fixed palette, never
vermillion.

### Chinese-first

Traditional Chinese (zh-HK) is primary and English secondary, in copy and in
field order. `DishName` renders both slots and tracks the two scripts
differently, so pass real names for both rather than translating in your layout.
**Never use em-dashes in copy** — join clauses with a space.

### Comparison is the core interaction

People judge food by comparing, not by scoring in a vacuum. Comparison surfaces
share one chassis: mount `DuelSide` rather than building a lookalike.

### Where the truth lives

Read `styles.css` and its import closure (`_ds_bundle.css` holds every component
style, `fonts/fonts.css` the Chinese webfont) before styling anything, and each
component's `.prompt.md` for its own API. The stylesheet is authoritative; this
summary is not.

### An idiomatic snippet

```jsx
<div className="card">
  <div className="card-title">
    <DishName name="Beef Chow Fun" name_zh="乾炒牛河" suffix={<SealStamp />} />
  </div>
  <div className="card-meta" style={{ color: 'var(--ink-soft)' }}>深水埗 · $88</div>
  <button className="btn primary">開始評分</button>
</div>
```
