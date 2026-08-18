# Landbank theme — Albany County Land Bank

Records-office polish: survey grids, parcel ledgers, and the sky-blue /
leaf-green of the ACLB logo grounded in a deep civic ink (`#16232C`) on
record-paper neutrals (`#F2F5F6` / `#EAEFF1`). The brand brights (`sky
#0AA7E4`, `leaf #8CC63E`) are *graphic* colors only — text and interaction
always step down to their darkened pairs (`skydeep #0A6E99`, `field #4C9129`,
`forest #33641B`). A seven-status semantic color system (For Sale · ACLB
Rehab · Sale Pending · Co-Development · In Process · On Hold · Sold) drives
every pill, chart palette, and map pin identically. Type is **Archivo at 118%
width** (`font-display`) for civic display caps, **Public Sans**
(`font-prose`) for all running text, and **IBM Plex Mono** (`font-meta`) for
parcel IDs and data chrome. One border tone (`border-[#16232C]/10`), one
radius (6px / `rounded-md`), buttons physically press (`.lb-press`).

Source design system: [`design_system/`](./design_system/) (theme / layouts /
grid / components / patterns + three example pages). Translated per
`src/dms/skills/translating-design-system-to-dms-theme.md`.

## Variants

- `layout.styles`: `default` (public: TopNav compact, no SideNav, paper pane)
  · `app` (staff console: ink SideNav) · `bare` (auth/print)
- `layoutGroup.styles`: `content` (default; `lb-paper` py-12) · `content_tint`
  · `hero` (`lb-plat` py-14) · `header` (`lb-plat` py-10) · `feature`
  (`lb-plat-ink`) · `footer` (`lb-plat-ink` mt-auto) · `auth` (centered
  max-w-md) · `workbench` (full-bleed canvas) · **`admin_header` +
  `admin_content`** (the console pair: plain paper, `pt-6` / `pb-6` only —
  on an admin page the sections' own gutters carry the rhythm, so a band must
  not add `py-12` on top. Use both together on any admin page)
- `button.styles`: `default` (skydeep press) · `cta` (field/forest green) ·
  `secondary` (white + hairline) · `plain` (ghost skydeep) · `danger`
  (rose press)
- `pill.styles`: `default` (neutral tag chip) · the seven statuses
  (`for_sale`, `aclb_rehab`, `sale_pending`, `co_development`, `in_process`,
  `on_hold`, `sold`) · legacy color names (`gray`/`orange`/`blue`/`green`/
  `red`/`violet`) and `status_good`/`status_warn`/`status_bad`/`status_na`
  mapped onto the same seven recipes
- `dataCard.styles`: `default` (metaSM mist headers, display-ink values) ·
  `kpi` (stat tile: border-t-2 field accent, 38px tabular display numeral) ·
  `kpi_sky`/`kpi_field`/`kpi_amber`/`kpi_ink` (the same tile, one per accent,
  so a KPI row can color-code its tiles from the style dropdown) ·
  `note_tint` (the tinted footer inset a card pins under its content —
  `rounded-md` papertint surface, no border/shadow. The TINT IS THE CARD: the
  section stays white and its padding becomes the gutter the inset floats in.
  Turn on with `display.cardBorder: true` + `cardsPadding: 14`, and pin it
  with `cardsVerticalAlign: 'bottom'`)
- `table.styles`: `default` (the ledger: papertint/60 header band, ink/5 row
  rules, sky-wash hover, mono numerals) · `below-row` (inline open-out)
- `filters.styles` (promoted to options/styles — author-pickable via the
  Filter section's "Filter style" control): `panel` (the dashboard filter
  band; `controlStyle: 'default'`) · `chip` (inline chips;
  `controlStyle: 'filter_chip'`) · `scope_bar` (the admin scope band: flex
  chip triggers with the label inside, an applied state via
  `group-data-[active]:`, and a "Reset" link; `controlStyle: 'filter_trigger'`)
- `multiselect.styles`: `default` · `filter_chip` (borderless, for the chip
  filter design)
- `modal.styles`: `default` · `wide`
- `avlGraph.styles`: `default` (white, status-system palette, mono axes) ·
  `dark` (for the `feature` band)
- `logo.styles`: `default` · `dark_chip` (white chip on dark grounds — the
  mark is never recolored)
- `textSettings`: the 14 brand tokens (`displayHero/XL/LG/MD/SM`,
  `proseLG/prose/proseSM/proseXS`, `labelMD/labelSM`, `metaMD/metaSM/metaXS`)
  exposed to Lexical via `options.slashKeys`, plus the full generic
  `textXS..text8XL` ladder re-skinned (Public Sans working sizes, Archivo
  display sizes, ink). `h1..h6` map onto the display ladder and are mirrored
  explicitly into `lexical.heading_h1..h6`.

## Primitives this theme styles

layout · layoutGroup · topnav · sidenav · navigableMenu · logo · button ·
input · multiselect · tabs · field · label · icon · dialog · dialogActions ·
modal · dataCard · pill · table · lexical (incl. `layoutTemplates`) · graph ·
avlGraph · map (surfaces only — control icon names inherit) · filters
(top-level, promoted) · attribution (top-level) · textSettings ·
pages.sectionArray (12-col gap-0 grid, p-3 gutters, 6px inner-box chrome,
all eleven edit-chrome keys) · pages.sectionGroup (in-page nav rail) ·
pages.searchButton · pages.searchPallet (sparse) · datasets.datasetsList
(sparse, brand neutrals) · auth.authPages.sectionGroup.default + auth.field.

## Primitives this theme does NOT style (inherit codebase defaults)

- `switch` — `Switch.jsx` is not themeable (hardcoded classes); no keys to ship.
- `nestable` / `nestableInHouse`, `pages.userMenu`, `pages.complexFilters`,
  `pages.sectionGroupsPane`, `pages.section`, `pages.templateManager`,
  `pages.timePicker`, `pages.pageTemplatePicker` — admin/edit chrome, neutral
  defaults acceptable for v0.1.
- `datasets.*` beyond `datasetsList` (metadataComp, upload, gis pages, …).
- `admin.*` namespace, `drawer`, `heading` (legacy).
- Deep `map` structure (controls/styleSelector/filters/infoBox) and control
  icon names — only legend/popup/hover surfaces are re-skinned.

## Custom additions

- **Icons** ([`icons.jsx`](./icons.jsx)): the 41-glyph registry from
  `design_system/design-system/theme.html#icons` (exact path data; `Lot` is
  the custom surveyed-parcel glyph; `TriangleAlert` the warning glyph from
  the dashboard's "Needs attention" line and `Eye` the view action from its
  inventory table) plus platform aliases — `XMark`,
  `Pencil`, `ArrowDown/Left/Up`, `ChevronUp/Left`, `CaretDown/Up`,
  `Settings`/`Gear`, `User`, and the table header-menu glyphs (`TallyMark`,
  `LeftToRightListBullet`, `Sum`, `Avg`, `Group`, `SortAsc`, `SortDesc`).
  Names not shipped here fall through to the DMS default registry via theme
  merge.
- **Surface utilities** — injected by the theme itself via
  `fonts[{ type:'style', id:'landbank-surfaces' }]` (no consumer index.css
  edits): `lb-paper`, `lb-paper-tint`, `lb-card`, `lb-card-ink`,
  `lb-card-tint`, `lb-plat`, `lb-plat-ink`, `lb-plate`, `lb-lot`,
  `lb-lot-sky`, `lb-lot-slate`, `lb-press`, `dot-pulse`, focus-visible ring,
  reduced-motion guards.
- **Fonts** — theme-owned loader: Google Fonts request (Archivo w/ `wdth`
  axis + Public Sans + IBM Plex Mono), a Tailwind-4 `@theme` registration
  (`landbank-tw-theme`), and a `:root` re-pin + the `font-display` /
  `font-prose` / `font-meta` role classes (`landbank-font-stacks`;
  `.font-display` pins `font-stretch: 118%`).
- **Colors** — arbitrary hex values throughout (`bg-[#0A6E99]`); no Tailwind
  config additions required.
- **Assets** — `public/themes/landbank/aclb-logo.png` (referenced by the
  `logo` theme; on dark grounds it always sits in a white chip).
- **Column types** — `columnTypes.parcel_plate`
  (`columnTypes/parcelPlate.{jsx,config.js,theme.js}`): the lot-geometry
  survey thumbnail drawn from recorded width × length. Full-bleed
  (`cardHints`), reads the length + status off sibling row columns
  (fetch them as `show:true, hideValue:true` loader cells), hatch variant
  by status (`parcelPlate.lotVariantByValue` — ACLB Project → sky,
  Sold → slate), "survey pending" fallback when dimensions are missing.
  The status pill needs no custom type — the built-in `status_pill`
  + per-column `pillColors` maps onto the theme's seven pill styles.
  In-cell bars are the built-in `data_bar` skinned by the top-level
  `dataBar` theme key (papertint track; `sky`/`field` fills).
- **Column types** — `columnTypes.status_dot`
  (`columnTypes/statusDot.{jsx,config.js,theme.js}`): `status_pill`'s
  unfilled sibling — a colored dot + plain label, which is how the design
  set draws a chart LEGEND as opposed to a state badge. `dotColorByValue`
  collapses the raw ACLB status vocabulary onto the six legend hues; an
  optional per-column `dotColors` overrides it. The count stays a normal
  right-aligned Card cell.
- **Column types** — `columnTypes.icon_text`
  (`columnTypes/iconText.{jsx,config.js,theme.js}`): a leading glyph in
  front of the cell's own value, for the design set's `⚠ <sentence>` callout
  lines. Card cells can style a value but can't put anything in front of it,
  so these were previously faked with a literal character in the data (wrong
  color, wrong baseline). Per-column `iconName` (any name in `theme.Icons`),
  `iconColor` (a brand name — `amberdeep`, `field`, …) and `iconSize`
  (xs–xl), all picked from selects built off the registries themselves.
  Typography stays the cell's `valueFontStyle`.
- **Column types** — `columnTypes.icon_link`
  (`columnTypes/iconLink.{jsx,config.js,theme.js}`): an icon-only link to a
  per-row destination — the design's View / Edit row actions at the end of
  every inventory row. Per-column `iconName`, `iconTitle` (tooltip +
  accessible name), `location` (the path INCLUDING the query key, e.g.
  `/admin/property-view?id=`), `linkParamColumn` (a sibling row column
  supplying the param — fetch it `selectOnly`; unset falls back to the row's
  `id`), `iconColor`, and `external`. Add **`linkText`** and the cell becomes a
  real labelled button instead of a bare hit target — the design's "Edit
  record" / "Public listing" actions, which are *links* and so can't be the
  theme's `button` component; `linkVariant` picks primary / secondary / ghost,
  mirroring `button.styles`. A row whose param resolves empty
  renders the glyph disabled rather than a link to nowhere. Works in a
  Spreadsheet cell as well as a Card cell — `registerColumnType` mutates the
  registry the table reads too.
  ⚠ In a table, **size the column** (an unsized column takes an elastic
  `minmax(default, 1fr)` track and will claim ~200px) and give the second of
  a pair a **space**, not `""`, as its `customName` — an empty header falls
  back to the raw column name.

## Documented deviations

- Public bands keep `mx-auto` (centered, 1240px cap) — the platform's
  `mr-auto` rule exists for SideNav surfaces; the public `default` layout has
  none. The `app` layout's content band follows the platform rule
  (`mr-auto w-full max-w-[1480px] pl-12 pr-8` — see
  `design_system/design-system/layouts.html` wrapper table) if/when app
  surfaces are built out.
