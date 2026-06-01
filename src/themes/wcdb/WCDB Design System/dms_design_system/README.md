# WCDB · DMS Design System

**v0.1 · 2026-06-01** · A DMS-format implementation of the WCDB 90.9 FM
brand. Translates the Hanssen-inspired high-fidelity prototypes in
`../design_handoff_wcdb_design_system/` into the deliverable shape
mandated by the up-to-date DMS authoring skills, while **deferring
to `src/themes/wcdb/wcdb_theme.js`** for layout, sectionGroups, and
every primitive that has already been hand-tuned in the live theme.

> Reading order before changes:
>
> 1. [`src/dms/skills/designing-a-dms-design-system.md`](../../../../dms/skills/designing-a-dms-design-system.md) — the structural grammar this folder honours.
> 2. [`src/dms/skills/translating-design-system-to-dms-theme.md`](../../../../dms/skills/translating-design-system-to-dms-theme.md) — the per-primitive key checklist the live `wcdb_theme.js` already fills in.
> 3. [`src/dms/skills/card-layout.md`](../../../../dms/skills/card-layout.md) — what every Card cell-/cards-grid knob does.
> 4. [`src/themes/CLAUDE.md`](../../../CLAUDE.md) — "configure the Card, don't write a new component."
> 5. [`src/themes/wcdb/wcdb_theme.js`](../../wcdb_theme.js) — **the source of truth for layout, layoutGroup, sections, and primitive theming**. When in doubt, read theme.js.

This folder honours the contract those skills describe — including
the rule that every mockup page is **plain HTML + Tailwind CDN +
`_shared.css`** (no JSX, no React, no build step).

---

## The split between handoff and theme.js

WCDB is a special case among the brands shipping a DMS design system
because it has **two converging sources of truth** for the visual
contract:

1. **The handoff** (`../design_handoff_wcdb_design_system/`) — a
   React-via-Babel-in-the-browser prototype that captures the brand's
   aesthetic intent: tokens, the cutaway split, the bare-vs-carded
   right-column rhythm, the inverted footer card, the italic-serif
   editorial voice. This was the original brief.
2. **`src/themes/wcdb/wcdb_theme.js`** — the live runtime theme. While
   the handoff was being translated into runnable code, parts of the
   design system were improved and re-shaped against the actual DMS
   primitives. The Layout, LayoutGroup, and section primitive choices
   in `theme.js` therefore **supersede** the handoff for those
   layers.

**When the two disagree:** follow `theme.js`. The handoff documents
intent at design time; the theme is the working contract. This
README's job is to surface those differences so a future pass
doesn't get confused.

### What this folder defers to from `theme.js`

| Layer | Source | Why |
|---|---|---|
| `layout.styles[0]` (the *only* shipped layout) | `theme.js` | The cutaway split lives in `childWrapper: "flex-1 flex flex-col md:grid md:grid-cols-2"`. The handoff achieved the same shape with hand-rolled `.wc-split` CSS; the theme uses pure Tailwind grid. The theme version is what authors get. |
| `layoutGroup.styles[0]` (`content`) and `layoutGroup.styles[1]` (`header`) | `theme.js` | The cutaway is **two LayoutGroup variants on the same page**, not a single split layout. The left column ("header") is a sticky cutaway panel; the right column ("content") is the scrolling feed. Both wrapper-class stacks come straight from `theme.js`. |
| `pages.section.heights` and `editMinHeight` | `wcdb_section.theme.js` | Named height presets (`auto`, `fill`, `hero`, `tall`, `medium`, `small`) selectable per-section. `fill` is the sentinel that triggers flex sizing on the header column. |
| `topnav.styles[0]` (`wcdb`) | `theme.js` | The mobile + multi-level + animated-underline behaviour is fully themed; the design system documents the rendered states, not new ones. |
| `textSettings` (the Hanssen italic-display ladder) | `theme.js` | Already pinned to Instrument Serif italic from `text-xl` up; mono uppercase eyebrows on `h5`/`h6`. |
| `dataCard.imgFill` | `theme.js` | The new image-cell knob — `imageSize: 'imgFill'` makes images responsive to their cell's `cellWidth` instead of capping at `max-w-N`. The design system documents this as a Card knob; the runtime ships it. |
| `theme.columnTypes.portrait_banner` / `stream_player` / `now_indicator` | `theme.js` + `columnTypes/*.config.js` | Theme-registered WCDB column types. Each is a *small* visual element (banner, play button, on-air pill) the section author parks on the Card grid. The design system shows them alongside data cells, not as composite "section components". |
| `pages.section.heights = { auto, fill, hero, tall, medium, small }` | `wcdb_section.theme.js` | The Layout > Height control on each section uses these named presets. `fill` is the sentinel for flex-fill behaviour in the cutaway header column. |

### What this folder transcribes from the handoff

| Concern | Where in the handoff | Where here |
|---|---|---|
| Color tokens (dark + light) | `styles/tokens.css` | `_shared.css` + `design-system/theme.html` |
| Type ladder, `Instrument Serif` italic discipline | `styles/tokens.css` + page-level uses | `design-system/theme.html` Type section |
| The cutaway split's *intent* (image cuts up under the nav, sticky-left, scrolling-right) | `README.md` "Critical implementation details" + `styles/components.css` `.wc-split` | `design-system/layouts.html` + `design-system/grid.html` (advanced layout grid) |
| The bare-vs-carded right-column rhythm | `README.md` "Bare-vs-carded mix" | `design-system/patterns.html` |
| The inverted footer card | `styles/components.css` `.wc-card-inv` | `design-system/components.html` (Card variants) + `_shared.css` `.wcdb-card-inv` |
| Per-page composition (home / listen / schedule / show / djs / spins / blog / events) | `*.html` mockups in the handoff | `pages/*.html` here, **shaped as real DMS pages** |

---

## Layout

```
dms_design_system/
├── README.md              ← you are here
├── _shared.css            ← mirror of src/themes/wcdb/tokens.css + brand surfaces + meta-nav
├── design-system/         ← FIVE pages documenting the brand
│   ├── theme.html             · color, type ladder, icons, spacing, radii — the foundational tokens
│   ├── layouts.html           · the Layout + the two LayoutGroup variants (content + header cutaway)
│   ├── grid.html              · the sectionArray column grid + the higher-level cutaway split
│   ├── components.html        · every UI primitive WCDB styles, including theme.columnTypes.*
│   └── patterns.html          · multi-primitive compositions + the bare-vs-carded rhythm
└── pages/                 ← every page from the handoff, translated to DMS shape
    ├── home.html              · canonical layout — Listen Live + scrolling feed
    ├── listen.html            · big-play single-column "where to listen" page
    ├── schedule.html          · weekly schedule grid
    ├── show.html              · show detail (hero + about + episode list)
    ├── djs.html               · DJ directory grid (search + segmented filter)
    ├── spins.html             · recent spins full table (search + time filter + Export CSV)
    ├── blog.html              · editorial blog index (featured + grid)
    ├── events.html            · events list with giant italic day numbers
    └── login.html             · auth (the only `layoutGroup: auth` page)
```

Every HTML file is **plain HTML5 + Tailwind via CDN + `_shared.css`**.
No JSX. No React. No build step. Open any file directly in a browser
(`python -m http.server` from the project root) and edit it in a text
editor — there is no toolchain.

Class strings on each primitive are hard-coded from
`src/themes/wcdb/wcdb_theme.js`. If you change a value in the live
theme, mirror the change in any mockup HTML that demos the affected
primitive. The trade-off is intentional — see
[`designing-a-dms-design-system.md` §8](../../../../dms/skills/designing-a-dms-design-system.md#8-implementation-rules-for-mockup-pages).

Each page is shaped as a real DMS page (`Layout > LayoutGroup >
Section > Component`) — wrappers carry `data-dms-layout`,
`data-dms-group`, and `data-dms-section` attributes so a reviewer
can see the structure. The five `design-system/` pages ship with
`dms-annotated` on `<body>` so structural badges
(`LAYOUT · GROUP · SECTION`) appear overlaid; `pages/` examples
leave it off so they read like real product surfaces.

---

## Brand intent

WCDB 90.9 FM is the student-run college radio station at SUNY
Albany. The brand is **Hanssen-inspired** (the Pawel Gola Framer
template): minimal, near-monochrome, editorial. The visual signature:

- **Italic display serif** (Instrument Serif italic) for every
  headline from `text-xl` upward. Carries the editorial / college
  arts-and-letters weight. **Non-negotiable** — don't substitute
  another italic serif without testing.
- **Mono uppercase tracked** (Geist Mono) for eyebrows, labels,
  table headers, on-air pills, chrome. The second-most-distinctive
  voice — appears above every section head, above every table.
- **Sans body** (Geist) for paragraphs, captions, form fields,
  metadata. Quiet, modern, the default voice for everything that
  isn't headline or chrome.
- **Near-monochrome.** White on near-black in dark mode; black on
  off-white in light mode. The accent is the same monochrome ink
  used for primary text — there is no brand colour beyond grey-scale.
- **One red, used once.** `--on-air: #ff3b2f` appears **only** on
  live-broadcast indicators. Never for errors, links, or other UI
  states.
- **The cutaway split.** The home and listen pages put the now-playing
  panel in a sticky left column with the nav floating over its top
  edge, and a scrolling editorial feed on the right. This is the
  brand's single most distinctive layout move — it's why `theme.js`
  ships a Layout that *only* renders cutaway pages and a special
  `header` LayoutGroup for the sticky panel.
- **Bare-vs-carded right column.** The right-hand scrolling feed
  alternates between bare sections (on the page bg, the typography
  carries them) and carded sections (functional content benefits
  from a panel). Most "design system" themes put everything in
  cards; WCDB breathes.
- **Inverted footer.** The footer is a card with flipped colours
  (white card in dark mode; dark card in light mode). The classic
  Hanssen move — the design system's only chromatic break.

## Theme-chosen scope

WCDB is an editorial / radio-station theme. Its example pages
exercise:

- The cutaway-layout home page (`home.html`).
- Long-form catalogue moments (`show.html`, `blog.html`).
- Calendar / schedule moments (`schedule.html`, `events.html`).
- A directory grid (`djs.html`).
- A dense tabular page (`spins.html`).
- A single-column hero page (`listen.html`).
- An auth form (`login.html`).

The brand does **not** ship example pages for analytics dashboards,
GIS workbenches, or dense filterable tables of compliance KPIs. The
platform supports them; this *theme* doesn't need to prove it. (For
those archetypes, see TransportNY's `dms_design_system_v2` and
Tessera's `design_system_v2`.)

---

## Mapping to the spec

| Spec section                  | This folder                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| §7 deliverable structure      | `_shared.css` + `design-system/` (5 pages) + `pages/` (9 examples) ✓        |
| §7.2 design-system/theme      | `design-system/theme.html` — color, type (14 tokens), icons, spacing, radii ✓ |
| §7.3 design-system/layouts    | `design-system/layouts.html` — hierarchy diagram + the single shipped Layout + both `content` + `header` LayoutGroup variants + wrapper-class reference table + section-width section ✓ |
| §7.4 design-system/grid       | `design-system/grid.html` — `gridSize`, `defaultSize`, the `sizes` vocabulary, **plus** the higher-level cutaway split since WCDB's `childWrapper` is `md:grid md:grid-cols-2` ✓ |
| §7.5 design-system/components | `design-system/components.html` — every primitive in `src/dms/packages/dms/src/ui/components/` plus WCDB's three theme-registered column types ✓ |
| §7.6 design-system/patterns   | `design-system/patterns.html` — empty/loading/error states, data section with filters, card grid, form, auth, section toolbar + WCDB-specific bare-vs-carded rhythm pattern ✓ |
| §7.7 pages/ (theme's choice)  | Every public-facing handoff page translated to DMS shape ✓                  |
| §1 five-layer hierarchy       | Every mockup uses `<Layout>` → `<LayoutGroup>` → `<Section>` → primitive   |
| §10 done criteria             | Every primitive used in `pages/` is documented in `components.html`; every Section sits on the grid `grid.html` documents; TopNav shows 2-level menu with active state; the cutaway pattern is preserved on `home.html`/`listen.html` ✓ |

---

## Known gaps in v0.1 / open questions

- The handoff included scripted interactions (mode toggle, density
  toggle, animated underlines, on-air dot, equalizer). Static HTML
  mockups can show the animations (CSS keyframes) but not the
  toggles. Live state lives in `wcdb_theme.js` widgets
  (`ThemeModeToggle`, `NavLeftStyleWidget`, `NavRightStyleWidget`)
  — those are documented but not interactive here.
- The hero "imagery" is CSS gradients + scan-line textures + giant
  italic glyphs (`.wcdb-art`, `.wcdb-initials`). Real photography
  should replace these placeholders in production.
- The on-air audio player UI is mocked — wiring it to the actual
  WCDB stream URL is out of scope for the theme.
- `theme.columnTypes` ships three column types
  (`portrait_banner`, `stream_player`, `now_indicator`) — all are
  documented on `components.html`. If more are added later, mirror
  them there.

---

## Sources

- `../design_handoff_wcdb_design_system/` — the React-via-Babel
  prototypes this folder transcribes content from.
- [`../../wcdb_theme.js`](../../wcdb_theme.js) — the live runtime
  theme, **the layout/sectionGroup/primitive contract** this folder
  defers to.
- [`../../tokens.css`](../../tokens.css) — the canonical CSS-variable
  token file `wcdb_theme.js` consumes; `_shared.css` mirrors it.
- [`../../wcdb_section.theme.js`](../../wcdb_section.theme.js) — the
  section-height preset map.
- [`../../columnTypes/`](../../columnTypes/) — the three
  theme-registered column types and their config + theme files.
- `src/dms/skills/designing-a-dms-design-system.md` — the design
  contract this folder honours.
