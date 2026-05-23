# TransportNY · DMS Design System

**v0.1 · 2026-05-22** · A DMS-format implementation of the TransportNY
brand. Translates the HTML/JSX prototypes in
`../design_handoff_transportny_design_system/` into the folder
structure mandated by `src/dms/skills/designing-a-dms-theme.md`.

> Read [`designing-a-dms-theme.md`](../../../../dms/skills/designing-a-dms-theme.md)
> first. This folder honors the contract it describes — including the
> rule that every mockup page is **plain HTML + Tailwind CDN only**
> (no JSX, no React, no build step).

---

## What this folder is

The handoff folder next door (`design_handoff_transportny_design_system/`)
is a high-fidelity set of HTML/JSX prototypes. They show what the brand
should *look like*. They do not by themselves answer the question
"what does an engineer install in a DMS project?" — the prototypes invent
their own component names (`TNYSidebar`, `TNYHero`), bake class strings
into JSX, and lay out pages with flat `<main>` containers that don't
match the DMS render path.

This folder rewrites the same design language in the DMS-contract
format, so a downstream engineer can drop `theme/` into a DMS site and
have the brand work without writing new components.

---

## Layout

```
dms_design_system/
├── README.md              ← you are here
├── theme/                 ← the shipped code artifact
│   ├── theme.js               · DMS theme overlay (textSettings, layout, layoutGroup, every primitive, pages.*/datasets.*/auth.*)
│   ├── icons.js               · name → SVG-component map (~35 icons)
│   ├── icons/README.md
│   ├── tailwind.additions.js  · theme.extend snippet (brand colors, fontFamily, container widths)
│   ├── index.css.additions    · @font-face + .tny-* surface utilities
│   └── README.md
├── design-system/         ← four pages documenting the theme
│   ├── _shared.css            · mirror of theme/index.css.additions for mockup pages
│   ├── theme.html             · foundation: color, type, icons, spacing
│   ├── grid.html              · structural: Layout + LayoutGroup variants, nesting reference
│   ├── components.html        · every UI primitive THIS theme uses
│   └── patterns.html          · multi-primitive compositions (states, data section, form, auth, edit toolbar)
└── pages/                 ← optional theme-chosen example pages
    ├── npmrds-getting-started.html  · public-facing landing
    └── map-21-pm3.html              · canonical product dashboard
```

Every HTML file is **plain HTML5 + Tailwind via CDN + the brand's
`_shared.css`**. No JSX. No React. No build step. Open any file
directly in a browser (`python -m http.server` from the project root)
and edit it in a text editor — there is no toolchain.

Class strings are hard-coded from `theme/theme.js`. If you change a
value in `theme.js`, mirror the change in any mockup HTML that demos
the affected primitive. The trade-off is intentional — see
[`src/dms/skills/designing-a-dms-theme.md` §12.8](../../../../dms/skills/designing-a-dms-theme.md).

Each page is shaped as a real DMS page (`Layout > LayoutGroup >
Section > Component`) — open `theme.html` and you'll see
`data-dms-layout`, `data-dms-group`, `data-dms-section` attributes on
the wrappers. `theme.html` and `grid.html` ship with the
`dms-annotated` class on `<body>` so structural badges (`LAYOUT ·
GROUP · SECTION`) appear overlaid; toggle it off to see the page the
way an end user would.

---

## Mapping to the spec

| Spec section                       | This folder                                                                 |
|-----------------------------------|-----------------------------------------------------------------------------|
| §12 deliverable structure          | `theme/` + `design-system/` + `pages/` siblings ✓                           |
| §12.1 theme/                       | `theme.js` + `icons.js` + `icons/` + `tailwind.additions.js` + `index.css.additions` + `README.md` ✓ |
| §12.2 design-system/theme          | `design-system/theme.html` — brand, palette, data viz, surface, type, icons, elevation ✓ |
| §12.3 design-system/grid           | `design-system/grid.html` — hierarchy diagram + 3 Layout variants + 8 LayoutGroup variants + nesting example + naming reference ✓ |
| §12.4 design-system/components     | `design-system/components.html` — navigation, form/interaction, containers, rich content ✓ |
| §12.5 design-system/patterns       | `design-system/patterns.html` — empty/loading/error/stale, data section with filters, card grid, form, auth, section toolbar ✓ |
| §12.6 pages/ (theme's choice)      | Two pages — landing + canonical data dashboard (theme's primary intent) ✓   |
| §1 five-layer hierarchy            | Every mockup uses `<Layout>` from `_dms.jsx` → `<LayoutGroup>` → `<Section>` → primitive |
| §2 theme grammar                   | `theme.js` uses `options.activeStyle` + `styles[]` shape on every primitive; `styles[0]` is the complete default; named variants in `styles[1..n]` |
| §7 textSettings                    | Complete; supports per-cell font-style dropdown                             |
| §8 icons                           | Registered map; names are the API; primitives reference by name             |

---

## Brand intent

TransportNY is a public-sector data platform for NYSDOT, MPOs, academic
partners, and the public — used for NPMRDS travel-time data, MAP-21 PM3
federal reporting, freight reliability, congestion, and route analysis.

The visual signature is:

- **Institutional, not playful.** Deep NYS blue (#1F3F8F), warm amber
  (#FACC15) for active state, persistent dark sidebar (#12181F), pale
  grey content pane (#ECEEF2).
- **Cards on pane.** Section bg is always the pane; content lives inside
  white cards with a hairline edge.
- **Editorial moments.** A warm bone surface (#F5F1E8) is reserved for
  printable narrative cards (jurisdictional profiles, public-read
  notices) — used sparingly.
- **Numbers are mono.** All KPI values and table cells use tabular-nums
  in `ui-monospace`. Oswald is reserved for headings and chrome.

## Theme-chosen scope

This is a theme, not a universal renderer. TransportNY's example pages
in `pages/` exercise:

- The marketing/landing pattern (`npmrds-getting-started.html`)
- A canonical product dashboard with sidebar + tone-bar + KPI row +
  map workbench + leaderboard table (`map-21-pm3.html`)

The brand does **not** ship example pages for radio-station rotations,
podcast catalogs, technical-docs trees, or marketing-CMS catalogues —
those are out of scope. The platform supports them; this *theme*
doesn't have to.

---

## Working with this folder

**To preview locally:** serve the project root over any static HTTP
server (`python -m http.server`) and open the files in the browser.
Hot-reload is unnecessary — these are HTML mockups.

**To port to a live DMS site:** copy `theme/theme.js`, `theme/icons.js`,
the contents of `theme/tailwind.additions.js`, and `theme/index.css.additions`
into the DMS site's `src/themes/transportny/`. Merge the tailwind
additions into the site's `tailwind.config.js`. Append the CSS additions
to the site's `index.css`.

**When you change a token:** update `theme/theme.js`, then manually
mirror the new class string into any mockup HTML that demos the
affected primitive (`grep` for the old string across
`design-system/*.html` and `pages/*.html`). The mockups don't import
from `theme.js` — that's the trade-off the skill spec calls out, and
it's what keeps the mockups editable in a text editor with no
toolchain.

**To add a new primitive's theme:** put it in `theme/theme.js` first,
then add a demo of it to `design-system/components.html`. If it composes
with other primitives in a recognisable pattern, add a Section to
`design-system/patterns.html`.

---

## Known gaps in v0.1

- `theme/icons/*.svg` standalone files are not generated — icons are
  React components in `icons.js`. See `theme/icons/README.md` for the
  conversion notes.
- The Tailwind config additions assume Tailwind v3+. If the consuming
  project is on v4, adapt the `theme.extend` shape.
- `pages/` ships two examples; the spec allows more. Add a third
  (e.g., docs-overview) when the brand owns more public-facing surfaces.
- Tone-bar selects show their open-menu state only inline — no live
  popovers in the static mockups. The behaviour is documented in
  `components.html` text.

---

## Sources

- `../design_handoff_transportny_design_system/` — the HTML/JSX
  prototypes this folder translates from.
- `../../../../dms/skills/designing-a-dms-theme.md` — the design
  contract / skill this folder honors.
- `../../theme.js` — the existing DMS theme.js for TransportNY (the
  live site's overlay); this folder's `theme/theme.js` is a cleaner
  rebuild aligned to the spec.
