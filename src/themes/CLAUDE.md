# Themes — design philosophy

This file is read by Claude Code (and humans) before working on anything in `src/themes/`. Read it before adding custom column types, custom section components, or theme overrides.

## The principle: configure the Card, don't write a new component

The Card section is the workhorse of DMS pages. A page author with admin access can pick a data source, pick which columns to show, set spans, swap fonts, change image sizes, hide headers — without touching code. That capability is the product. Every time a developer answers "make this page look like X" with a custom React component, that capability narrows: the next author who wants something similar has to ask the developer.

**Default to building with Card cells.** When a design lands on your desk, the first move is to map it onto Card primitives:

| Design element                  | Card primitive                                          |
|---------------------------------|---------------------------------------------------------|
| An image                        | An image column (`type: 'image'`, `imageSize`, `imageLocation`) |
| A piece of text in a specific style | A text column with `valueFontStyle` pointing into `textSettings` |
| Vertical/horizontal arrangement | `cellsGridSize` + per-column `cellSpan` / `cellRowSpan` |
| A formatted number              | A text column with `formatFn: 'comma' | 'abbreviate' | 'date' | 'time' | …` |
| A non-data button or chrome     | A small theme-registered column type that renders only that piece |
| Multiple records on a page      | `cardsGridSize` |

If the Card grid can't express the layout, the **second** move is not "write a custom component," it's **"what's the smallest enrichment of the Card that would let an author express this?"** Then add that enrichment.

This is harder than writing a custom component. It will sometimes produce layouts that are not pixel-perfect to the design. **That trade-off is the right one.** A page that a future author can iterate on themselves is worth more than a single page that looks 100% like the mockup but is frozen behind code.

### When a custom column type IS appropriate

A theme-registered column type (`theme.columnTypes.<name>`, with `cardHints` and a `ViewComp`) is the right tool when:

- The thing being rendered has **no underlying column value** (a play button, an "On Air" pill that isn't a field) — Card cells assume there's a value to render; chrome doesn't have one.
- The rendering involves **dynamic behaviour** that can't be expressed as a `formatFn` (e.g., reading multiple sibling fields, polling, animation).
- The piece is **small and focused on one concern** — see the WCDB `portrait_banner` and `stream_player` types as worked examples. Both render one visual element each, slotted into a Card cell laid out by the section author.

The wrong move is the inverse: writing one big column type that renders an entire composite layout (album art + title + artist + play button + progress bar) inside a single cell. That recreates everything the Card already does, badly, in a place authors can't reach.

### When a custom section IS appropriate

A new entry in `ComponentRegistry/` (a whole new section type) is justified when:

- The component genuinely renders something the Card cannot — a map, a graph, a PDF export.
- The configuration surface for "Card with N tweaks" would be unreasonably large to express the new behaviour.

See `src/dms/skills/creating-page-section-components.md` for the recipe. The bar is high; most cases that look like new components are actually configured Cards.

## When you find Card primitives lacking

While configuring a section you'll hit limits. Each limit is a chance to enrich the Card so the *next* author doesn't hit it.

Examples of legitimate Card enrichments — what makes one of these worth doing is "more than one design would have used this":

- A new `formatFn` (e.g., a column-combining formatter that renders `album · year` from two fields).
- A new image-cell knob (alignment within the cell, fixed pixel size, aspect ratio).
- A `gridAutoFlow` / `cellsAutoFlow` display setting so 2D layouts with row-spans can use `dense` packing without hand-ordering columns.
- A `selectOnly: true` per-column flag so a column is fetched without rendering a cell (cleaner than `hideHeader + hideValue`).
- A new font-style preset in `textSettings` (so authors get a new option in the value-style dropdown).

The pattern is the same each time: add the enrichment in `src/dms/packages/dms/src/...`, surface it in `Card.config.jsx`'s controls so it shows up in the toolbar, and document it in `src/dms/skills/card-layout.md`.

## When you're tempted to bail out to a custom component

Stop and ask:

1. **Can a `formatFn` express this?** Most "format the value differently" cases — currency, dates, percentages, custom delimiters — fit here.
2. **Can a new `cardHints` flag express this?** `fullBleed`, `spanFullColumns`, `defaultHideHeader` already exist; another flag may belong.
3. **Can a new theme token express this?** Image radius, image alignment, cell padding overrides — these are theme concerns, not code concerns.
4. **Can a small focused column type express the *chrome*, while real data lives in real Card cells?** This is the pattern used by `portrait_banner` and `stream_player` — each renders one visual element. The Card grid lays them out alongside data cells.

Only after those four answer "no" should you reach for a custom section component.

## Theme structure notes

See [THEME_EDITING_GUIDE.md](./THEME_EDITING_GUIDE.md) for the mechanical details of theme file structure (`options/styles`, named styles, merging, registered widgets/column types, etc.).

See `src/dms/skills/card-layout.md` for the full surface of Card-section authoring knobs.

## Custom theme components worth knowing about

- **`transportny/components/ReportRouteList`** — a route-editor panel for "report" pages (created
  from the `npmrds_sub` pattern's **Report Page** template). A report is just a page; its routes are
  stored in one dedicated row of a dataset (the template pre-wires `reports_snap_2`), keyed 1:1 to the
  page — chosen via this section's own sectionMenu "Dataset" picker (`externalSource`), not a bespoke
  Page attribute (tried and reverted) or a hardcoded constant (tried and reverted — repo-convention
  violation, dataset choice belongs to the author). The route **catalog** binding (which routes are
  addable) lives on the sectionMenu's "Add Join Source" slot instead, deliberately left incomplete (no
  join columns configured) so it never fires as a real SQL join — see the README's "Storage" section
  for the full history and why two sectionMenu slots are used this way. Graphs are ordinary page
  sections (a `comparison_series` subscriber, keyed by the `$self` sentinel, binds each graph to the
  routes the panel has assigned it via `setActionParam`). **As of 2026-07-02 this storage rework is
  implemented but NOT live-verified** — no browser session confirmed routes actually persist correctly
  — read [its README](./transportny/components/ReportRouteList/README.md) before assuming it works.
