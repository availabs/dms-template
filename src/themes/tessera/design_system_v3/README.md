# Tessera — Design System v3

> v3 · 2026-07-02 · A ground-up rebuild of `../design_system_v2/`,
> structured to the current DMS design-system contract, with the Roman
> mosaic craft made structural rather than decorative.
>
> Read in this order: `src/dms/skills/designing-a-dms-design-system.md`
> (the structural grammar) · `research/dms product/brand-tessera.md`
> (the aesthetic gospel) · `planning/tessera/tasks/current/tessera-v3-design-system.md`
> (this pass's design doc) · this file.

## What changed since v2

1. **Current-rules compliance.** v2 predates several rules that now govern
   design systems: the shared `ds-nav.js` widget (one data-driven file, not
   per-page inline copies), `data-dms-layout/group/section` annotation
   attributes + overlay, the required `layouts.html` wrapper-class reference
   table and section-width (`full_width`) documentation, `<!-- icon: Name -->`
   tagging with the audit toolchain, and Google-Fonts-CDN fallbacks.
2. **The grout model, actually implemented.** The sectionArray's
   gap-0 / padding-gutter / inner-box-chrome model is not just documented on
   `grid.html` — every page in this deliverable authors its sections as
   `grid grid-cols-12 gap-0` with `p-3` section padding and chrome on an
   inner box. Sections are tesserae; the padding is the grout. (v2 and the
   TransportNY worked example both documented this model and then authored
   pages with grid `gap-6`.)
3. **A custom drawn icon set** (`theme/icons.js`, ~48 glyphs) replaces v2's
   Lucide dependency — 24px grid, 1.5px stroke, butt caps, mitre joins,
   and a rotated square (a tessera) wherever another set would use a dot.
   This was v2's stated v0.2 intention.
4. **Roman-mosaic vocabulary made structural.** Opus tessellatum names the
   grid; the grout names the gutter model; the emblema names the
   one-featured-panel pattern; opus vermiculatum names the double focus
   ring; andamento names the stagger spec; the tabula ansata is the
   marketing designator chip; two friezes (tessera course, running meander)
   are the only sanctioned band ornaments. Usage rules on `theme.html` §07.
5. **Deeper foundations:** semantic status mapping (success → verdigris,
   warning → ochre, danger → tile), a measured WCAG contrast table, a
   motion spec with reduced-motion behaviour, documented dark tokens
   ("photographs of stone at night"), and a voice section in the tokens page.
6. **The v3.1 revision pass (owner feedback).** The accent set became
   smalti — the fired glass of Roman workshops: a new **lapis** `#3B5BA5`
   (info, links, series-2), verdigris brightened to `#3F8F7F`, ochre
   turned gold `#C7910F`; slate left the chart series. Every surface
   carries a faint feTurbulence **stone grain** (limestone grains a step
   harder). The mark became a **composed monogram** — five tesserae
   suggesting the T, the stem tile set at nine degrees, the tile being
   placed. And the landing hero went **full-bleed**: the mosaic floor
   spans the whole band, with the copy set on a solid bone plaque — a
   tabula set into the pavement.
7. **One example page, with a three.js hero.** `pages/product-landing.html`
   is the deliverable's single example. Its hero — tesserae assembling,
   course by course, into the composed layout of a data page — is a
   deliberate, documented exception to the no-JS rule (see below).
8. **Tessellated edges (v3.2, owner feedback + `references/tessera/`).**
   A mosaic never draws a line — it sets a course of tiles. On the landing
   page, the continuous 1px `border-grout-light` chrome gave way to a
   tessellated edge vocabulary in `_shared.css`: `.tsr-course` /
   `.tsr-course-dark` (a panel framed by one course of set tiles, via
   border-image — the §02 surface grid and the Theory emblema),
   `.tsr-slab` / `.tsr-slab-b` (stepped clip-path silhouettes for cut
   slabs — the hero tabula, craft cards, doors; two cuts so neighbours
   don't repeat), `.tsr-rule` (a broken grout hairline replacing
   continuous band separators), `.tsr-cut` (hand-cut corner chips on
   buttons in place of `rounded-[2px]`), and `.tsr-underline` (the
   active-nav mark as a run of tiles). Applied to
   `pages/product-landing.html` only so far; the design-system pages,
   `theme.html` §07 documentation, and the theme translation still carry
   the v3.1 drafted-line chrome.

## Layout

```
design_system_v3/
├── README.md               ← this file
├── _shared.css             ← THE canonical CSS: @font-face, .t-* type
│                             tokens, .tsr-* surface utilities, the
│                             dms-annotated overlay. Every page links it.
├── ds-nav.js               ← shared floating nav widget (documentation
│                             scaffolding; never ships on a live site).
│                             Add pages by adding one line to SECTIONS.
├── design-system/           FIVE DMS-shaped documentation pages
│   ├── theme.html              1/5 · color · type (16 tokens) · icons ·
│   │                            space/radius/elevation · motion ·
│   │                            ornament · dark · voice
│   ├── layouts.html            2/5 · Layout + LayoutGroup variants,
│   │                            wrapper-class reference table, section
│   │                            width (full_width)
│   ├── grid.html               3/5 · the 12-col sectionArray grid and
│   │                            the grout model, with the compound-card
│   │                            worked example
│   ├── components.html         4/5 · every primitive, brand-skinned,
│   │                            with states (navs shown to level 3)
│   └── patterns.html           5/5 · composed patterns: states, filtered
│                                data section, forms, auth, edit chrome,
│                                recurring brand patterns
├── pages/
│   └── product-landing.html  the one example page (see below)
└── theme/                    artifacts for the theme translation
    ├── icons.js                icon registry — SOURCE OF TRUTH
    ├── index.css.additions     pointer shim → ../_shared.css
    ├── tailwind.additions.js   theme.extend block
    └── README.md               translation notes
```

## The example page and its hero

`pages/product-landing.html` demonstrates the theme's primary use: the
marketing face of a durable, civic data platform. Every band is a
DMS-shaped LayoutGroup and every section sits on the documented 12-column
grid.

**The hero is the deliberate exception.** The brief asked for a three.js
hero expressing tesserae composing into a whole; the mockup rules forbid
JS frameworks. Resolution, documented rather than smuggled:

- The hero *band* is still a DMS-shaped `hero` LayoutGroup; the canvas is
  decorative art inside one section.
- three.js loads as an ES module from the CDN inside a single
  `<script type="module">`; nothing else on the page uses JavaScript.
- Progressive enhancement: a static SVG of the composed end-state renders
  by default and is hidden only after WebGL produces a frame.
  `prefers-reduced-motion` skips the assembly and renders the placed state.
- Motion honours the brand: snap easing (`cubic-bezier(.2,0,.1,1)`),
  andamento stagger (courses settle row by row), stillness after assembly,
  and a quiet pointer lift — no loops, no parallax.
- **A live DMS site cannot render this hero from theme configuration.**
  Porting it requires a registered page-section component
  (see `src/dms/skills/creating-page-section-components.md`); the rest of
  the landing page ports as ordinary sections.

## Alignment rule (read before translating)

Product bands on Layout `app` use `mr-auto … pl-12 pr-8` per the current
contract (`layouts.centered: 'max-w-[1280px] mr-auto'`). Marketing bands
on Layout `default` centre with `mx-auto` — Layout `default` has no
SideNav to hug; this is an intentional, documented exception, consistent
with the TransportNY worked example's marketing pages. `auth` centres.
The full table with verbatim class strings is on `layouts.html`.

## Icons lifecycle

Every `<svg>` in the design pages carries `<!-- icon: Name -->` (must
exist in `theme/icons.js`) or `<!-- decorative -->`. Audit:

```bash
node scratchpad/scripts/icons-audit.mjs --brand tessera
```

Do **not** run `icons-sync.mjs --brand tessera` yet: the live
`src/themes/tessera/icons.jsx` still belongs to the v2 Lucide registry
that `tessera-theme.js` consumes. Sync when the v3 theme translation lands.

## Scope — what this theme is and isn't for

Designed for: civic dashboards (MitigateNY-shaped), marketing/long-form
surfaces, documentation, dataset workbenches. Not designed for:
media-heavy consumer surfaces (wcdb-shaped sites are shown as a rendering
target on the landing page, but that brand ships its own theme).

Out of scope for v3, deliberately: the `theme/theme.js` translation
(the sibling skill's job — v2's runtime theme keeps serving live sites
until then); componentized dark mode (tokens documented on `theme.html`);
additional example pages; the MapLibre basemap and production chart theme.

## Working with this folder

- **Preview:** `python -m http.server` from the dms-template root, then
  open `/src/themes/tessera/design_system_v3/design-system/theme.html`.
  (Root-serving matters: Tiempos loads from `/fonts/tessera/tiempos/`;
  elsewhere the pages fall back to Newsreader.)
- **Change a token:** edit `_shared.css` **and** `theme/tailwind.additions.js`
  (+ each page's inline tailwind.config block if it's a color/family),
  update the swatch or spec row on `theme.html`, then grep the other
  pages for the old value.
- **Add an icon:** register in `theme/icons.js`, add a catalog tile on
  `theme.html` §04, tag the page svgs, re-run the audit.
- **Add a page:** copy a page's head + chrome, add one line to
  `ds-nav.js` SECTIONS, add it to every footer link block.
