# theme/ — the shipped TransportNY DMS theme overlay

The runnable code artifact. Drop this folder into a DMS site under
`src/themes/transportny/`, then:

1. Import `theme.js`'s default export and pass it into `DmsSite`'s
   `themes` prop.
2. Merge `tailwind.additions.js` into the consuming project's
   `tailwind.config.{js,ts}` `theme.extend`. (Tailwind v4 projects:
   prefer the `{ type: 'tailwind' }` entry on `theme.fonts` for font
   registration; merge the colors into a v4 `@theme` block.)
3. Append `index.css.additions` to the site's `index.css` (or
   equivalent global stylesheet).
4. Serve the brand fonts at the paths referenced in
   `index.css.additions` — typically `public/themes/transportny/fonts/`.

## Files

| File | Role |
|---|---|
| `theme.js` | The complete theme overlay. Every primitive's `styles[0]` is filled in, named variants live in `styles[1..n]`. Pattern-level themes (`pages.*`, `datasets.*`, `auth.*`) and the `fonts` array sit alongside the primitive overlays. |
| `icons.js` | Name → SVG-component map. Every icon name referenced from `theme.js` must exist here. New icons added here automatically become available to every primitive whose theme entry references an `icon` / `*Icon` string. |
| `icons/` | (Currently empty placeholder.) See `icons/README.md` for conversion notes from inline React components to standalone `.svg` files. |
| `tailwind.additions.js` | The `theme.extend` snippet. Brand colors, font families, max-width container tokens, section-padding scale, shadows, radii. |
| `index.css.additions` | `@font-face` declarations + brand surface utilities (`.tny-pane`, `.tny-card`, `.tny-press`, `.tny-hero-topo`, `.tny-map`, `.tny-meta-nav`, the `[data-dms-*]` annotation overlay). |

## How keys map to primitives

| Primitive | Top-level key | Theme shape | Source of truth |
|---|---|---|---|
| Layout | `layout` | options/styles | `src/dms/packages/dms/src/ui/components/Layout.theme.jsx` |
| LayoutGroup | `layoutGroup` | options/styles | `LayoutGroup.theme.jsx` |
| TopNav | `topnav` | options/styles | `TopNav.theme.jsx` |
| SideNav | `sidenav` | options/styles | `SideNav.theme.jsx` |
| NavigableMenu | `navigableMenu` | options/styles | `navigableMenu/theme.js` |
| Nestable | `nestable`, `nestableInHouse` | options/styles | `draggableNav.jsx`, `nestableInHouse/` |
| Logo | `logo` | options/styles | `Logo.theme.js` |
| Button | `button` | options/styles | `Button.theme.jsx` |
| Input | `input` | flat | `Input.theme.js` |
| MultiSelect | `multiselect` | options/styles | `MultiSelect.theme.js` |
| Tabs | `tabs` | options/styles | `Tabs.theme.jsx` |
| Switch | `switch` | options/styles | `Switch.theme.js` |
| FieldSet | `field` | flat | `FieldSet.theme.js` |
| Label | `label` | flat | `Label.jsx` |
| Dialog | `dialog` | flat | `Dialog.theme.jsx` |
| Modal | `modal` | flat | `Modal.theme.jsx` |
| Drawer | `drawer` | options/styles | `Drawer.theme.jsx` |
| DeleteModal | `deleteModal` | flat | `DeleteModal.theme.js` |
| Popup | `popup` | options/styles | (no codebase theme file; this slot is brand-defined) |
| dataCard (Card section) | `dataCard` | options/styles | `card.theme.jsx` |
| Card | `card` | options/styles | (legacy; small generic) |
| Pill | `pill` | options/styles | `Pill.theme.js` |
| Pagination | `pagination` | options/styles | (read from inside Table) |
| Icon | `icon` + global `Icons` | flat + map | `Icon.theme.js` |
| Table | `table` | options/styles | `table/table.theme.js` |
| Lexical | `lexical` | options/styles | `lexical/theme.js` |
| Graph (legacy) | `graph` | options/styles | `graph/theme.js` |
| avlGraph (new) | `avlGraph` | options/styles | `graph_new/theme.js` |
| Map | `map` | options/styles | `map/map.theme.js` |
| textSettings | `textSettings` | options/styles | `ui/themes/textSettings.js` |
| pages.attribution | `attribution` (also `pages.attribution`) | flat | `patterns/page/...` |
| pages.complexFilters | `pages.complexFilters` | flat | `patterns/page/...` |
| pages.sectionArray | `pages.sectionArray` | options/styles | `patterns/page/.../sectionArray.jsx` |
| pages.sectionGroupsPane | `pages.sectionGroupsPane` | flat | `patterns/page/...` |
| pages.searchButton | `pages.searchButton` | options/styles | `patterns/page/...` |
| pages.searchPallet | `pages.searchPallet` | options/styles | `patterns/page/...` |
| pages.pageTree | `pages.pageTree` | flat | `patterns/page/...` |
| pages.userMenu | `pages.userMenu` | options/styles | `patterns/page/...` |
| datasets.* | `datasets.*` | flat | `patterns/datasets/defaultTheme.js` |
| auth.* | `auth.*` | flat | `patterns/auth/defaultTheme.js` |

Every key in `styles[0]` is sourced from the matching `.theme.{js,jsx}`
file in `src/dms/packages/dms/src/ui/`. The v1 pass invented a few
keys (e.g. `topnav.menu`, `sidenav.bottomMenuWrapper` was missing
sub-slots); v2 cross-checked every key list against the codebase
source. If a future codebase change adds a key, mirror it here.

## Variants

- `layout.styles`: `default` · `app` · `bare`
- `layoutGroup.styles`: `content` · `content_tint` · `header` · `hero` · `tone_bar` · `tone_bar_dark` · `auth` · `footer` · `workbench`
- `topnav.styles`: `default`
- `sidenav.styles`: `default` · `compact`
- `button.styles`: `default` · `plain` · `active` · `secondary` · `tertiary` · `ghost` · `danger` · `compact` · `icon` · `amber`
- `multiselect.styles`: `default` · `compact` · `tone_bar` · `multiselect_with_search`
- `tabs.styles`: `default` · `segmented` · `pill`
- `dataCard.styles`: `default` · `kpi` · `compliance` · `editorial` · `title_bar` · `compact` · `dashboard`
- `pill.styles`: `default` · `blue` · `slate` · `amber` · `green` · `red` · `zinc` · `ink` · `beta` · `admin` · `status_good` · `status_warn` · `status_bad` · `status_na` · `route`
- `table.styles`: `default` · `editorial` · `compact`
- `navigableMenu.styles`: `default` · `dark` · `dock`

## Primitives this theme does NOT explicitly style

These primitives are not depicted in the brand's design system but
still get a sensible default by inheriting the codebase theme (the
brand should audit them if a future page surfaces them):

- `ButtonSelect` (used in some admin flows)
- `Colorpicker` (admin theme editor only)
- `DndList` / `DraggableList` ghost styles
- `Permissions` modal chrome

## Tailwind v3 vs v4

The dms-template host project uses Tailwind v4 (`@tailwindcss/vite`).
The `fonts` array in `theme.js` has the right `{ type: 'tailwind' }`
entry to register the font families at runtime; the
`tailwind.additions.js` file in this folder is the **v3** mirror for
sites that haven't migrated yet. If you're on v4, you can ignore
`tailwind.additions.js` and rely on the `fonts` array entries.

## When you change a token

1. Update `theme.js`.
2. Grep `design-system/*.html` and `pages/*.html` for the old class
   string and update each occurrence — the mockups don't import from
   `theme.js`; they ship literal class strings (per the no-build-step
   contract).
3. If the change touches colors or fonts, also update
   `tailwind.additions.js` and `index.css.additions`.
4. Mirror `index.css.additions` into `../design-system/_shared.css`.
