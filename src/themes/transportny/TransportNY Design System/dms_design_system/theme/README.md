# TransportNY · theme/

The shipped code artifact for the TransportNY brand. Drop this folder
into `src/themes/transportny/` of the consuming DMS site and import
`theme.js` as the site's theme overlay.

## Contents

| File                     | What it ships                                                                      |
|--------------------------|------------------------------------------------------------------------------------|
| `theme.js`               | The DMS theme overlay — `textSettings`, `Icons`, `layout`, `layoutGroup`, every UI primitive, `pages.*` / `datasets.*` / `auth.*` pattern-level chrome. |
| `icons.js`               | Name → SVG-component map. ~35 icons on a 24px grid, stroke 1.5, currentColor. Use via the DMS `Icon` primitive — never imported directly. |
| `icons/README.md`        | Icon-name reference (the names *are* the API).                                     |
| `tailwind.additions.js`  | `theme.extend` snippet to merge into the consuming project's `tailwind.config.js`. Brand colours, font families, container max-widths, section-padding scale, shadows. |
| `index.css.additions`    | `@font-face` declarations for Oswald + Source Sans 3, plus the `.tny-*` surface and effect utilities referenced by name in `theme.js` (e.g. `.tny-pane`, `.tny-card`, `.tny-press`, `.tny-active-bar`, `.tny-hero-topo`). |

## At a glance

- **Identity** — NYS public-sector data platform. Deep institutional
  blue (#1F3F8F), amber active marker (#FACC15), warm bone (#F5F1E8)
  for editorial cards. Persistent dark sidebar (#12181F), pale grey
  content pane (#ECEEF2) with white cards floating on top.
- **Typography** — Oswald (condensed display, headings + chrome),
  Proxima Nova / Source Sans 3 (running prose + form), mono for numerics
  ≥18px and the `// 01` kicker labels.
- **Surface model** — *cards on pane.* Section background is always the
  pane (#ECEEF2) or pane-tint (#E4E8EE); content lives inside cards
  with 8px radius, 1px hairline, single soft shadow. Never `bg-white`
  on a section. Bone (#F5F1E8) is reserved for editorial/printable
  narrative cards only.
- **Press effect** — primary CTAs use the `tny-press` tone-bar style:
  4px bottom border that drops to 2px on `:active` (80ms) for an
  intentional "mass" feel. Don't use on text links or ghost buttons.

## Named variants this brand ships

| Primitive       | styles[]                                                                  |
|-----------------|---------------------------------------------------------------------------|
| `layout`        | `default` · `app` (sidenav-on, the canonical product layout) · `bare`     |
| `layoutGroup`   | `content` · `content_tint` · `header` · `hero` · `tone_bar` · `auth` · `footer` · `workbench` |
| `sidenav`       | `default` (240px expanded) · `compact` (64px icon-only, hover flyout)     |
| `button`        | `default` (NYS-blue tone-bar) · `plain` · `active` · `secondary` · `ghost` · `danger` · `compact` |
| `multiselect`   | `default` · `compact` (h-8 chip for headers) · `tone_bar` (white-on-blue) · `multiselect_with_search` |
| `tabs`          | `default` (amber-underline) · `segmented` (Graph/Table/Cards toggle)      |
| `dataCard`      | `default` · `kpi` · `editorial` · `title_bar`                             |
| `table`         | `default` (dashboard, amber hover) · `editorial` (deep-navy header, bone) |
| `navigableMenu` | `default` · `dark`                                                        |
| `pill`          | `default` · `blue` · `slate` · `amber` · `green` · `red` · `zinc` · `status_good` · `status_warn` · `status_bad` · `status_na` |
| `logo`          | `default` · `compact` · `light`                                           |

## What's not themed by this brand

- `notebook` — no Jupyter integration in the TransportNY surface
- `forms` pattern-level — auth forms only; the brand doesn't ship a
  full forms-pattern customisation

These primitives will inherit DMS defaults when present.

## Theme-registered column types

None in v0.1. The brand brief discusses an `nys_shield` column type
(jurisdictional badge for MPO / county tables); add when the first
page that needs it is built.

## Version

v0.1 · 2026-05-22 · Initial overlay translating the
`design_handoff_transportny_design_system` HTML/JSX prototypes into the
DMS theme contract.
