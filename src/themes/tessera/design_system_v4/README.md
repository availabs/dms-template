# Tessera — Design System v3 (console)

> v3 · 2026-07-02 · A ground-up rebuild. **Primary inspiration: the
> unix/linux console. Secondary: the stone tablet / tessera mosaic** —
> the conceit is that stone mosaics were put to work as screens, and
> the system they run builds everything from tesserae. A terminal's
> character cell *is* a tessera: a small square unit, set in courses
> on a fixed grid, composing a larger surface.
>
> Deliberately takes **no** inspiration from the earlier Tessera
> systems (`../Tessera Design System/`, `../design_system_v2/`, or the
> mosaic-craft v3 preserved at git `a54606c`) — no bone/limestone
> palette, no warm print serifs.
>
> Read in this order: `src/dms/skills/designing-a-dms-design-system.md`
> (the structural grammar, followed precisely) ·
> `research/dms product/positioning-v2.md` (the product story the
> landing page tells) · `planning/tessera/tasks/current/tessera-v3-console-design-system.md`
> (this pass's task doc) · this file.

## The brand in one paragraph

Dark-only, by decision: the screen is stone, and stone is dark.
Surfaces are **basalt / slab / flint** with **mortar** hairlines; ink
is **chalk**; the accents are the six phosphors — the ANSI palette
named as minerals (**phosphor** green for interaction and success,
**amber**, **oxide**, **verdigris**, and **lazuli / porphyry** for
chart series only). One terminal face (JetBrains Mono) carries
display, prose, and meta; **Cinzel** is the fourth, lapidary voice,
rationed to inscriptions. Radius is 0 everywhere; hover is inverse
video; focus is a double frame; the one permitted loop is the block
cursor's blink. The signature element is **the block cursor as
tessera** — a lit square cell set in a stone frame; it is the logo,
the caret, and the hero's premise.

## Layout

```
design_system_v3/
├── README.md               ← this file
├── _shared.css             ← THE canonical CSS: .t-* type tokens (14),
│                             .tes-* surface utilities, annotation overlay.
│                             Every page links it. (theme/index.css.additions
│                             is a pointer shim — see below.)
├── design-system/           FIVE DMS-shaped documentation pages
│   ├── theme.html              1/5 · color · type · icons (63) ·
│   │                            space/radius/elevation · motion ·
│   │                            ornament · voice        (Layout default)
│   ├── layouts.html            2/5 · Layout + LayoutGroup variants,
│   │                            wrapper-class reference table,
│   │                            section width (full_width)
│   ├── grid.html               3/5 · the 12-col sectionArray grid,
│   │                            the grout model, compound card
│   ├── components.html         4/5 · every primitive, brand-skinned,
│   │                            navs to level 3       (Layout app)
│   └── patterns.html           5/5 · states, filtered data section,
│                                forms, auth, edit chrome, recurring
│                                marks                  (Layout app)
├── pages/
│   └── product-landing.html  THE one example page (see below)
└── theme/                    artifacts for the theme translation
    ├── icons.js                icon registry — SOURCE OF TRUTH (63 glyphs)
    ├── index.css.additions     pointer shim → ../_shared.css
    ├── tailwind.additions.js   theme.extend block
    └── README.md               translation notes
```

**CSS canonical-source note:** the skill (§8.0.5) wants one canonical
stylesheet. Browsers MIME-block stylesheets without a `.css`
extension under `python -m http.server`, so the canonical content
lives in `_shared.css` and `theme/index.css.additions` is the pointer
shim (the inverse arrangement of the skill's example, same
one-source rule). At translation time, inline `_shared.css` into the
production `index.css.additions`.

## The example page and its hero

`pages/product-landing.html` is the deliverable's single example: the
marketing face of the product, told in the man-page voice —
hero → SYNOPSIS → renderings → proof boot-log → the two doors
(hosted `[ try tessera ]` / self-host `docker compose up`) → theory
inscription → footer. Copy follows
`research/dms product/positioning-v2.md`; every band is a DMS-shaped
LayoutGroup and every section sits on the documented grid.

**The hero is the deliberate exception to the no-JS mockup rule.**
The brief asked for a three.js hero. Resolution, documented rather
than smuggled:

- The hero *band* is a DMS-shaped `hero` LayoutGroup; the canvas is
  decorative art inside one section.
- three.js loads as an ES module from the CDN in the page's single
  `<script type="module">`; no other JavaScript on the page beyond
  the shared floating-widget toggle.
- The scene is the brand thesis: a wall of instanced stone tiles
  settles course by course (snap easing, andamento stagger), then
  phosphor cells type on `$ TESSERA` and a block cursor blinks in
  steps — a stone mosaic running a terminal.
- Progressive enhancement: a static SVG of the composed state renders
  first and is hidden only after WebGL produces a frame.
  `prefers-reduced-motion` renders the placed, lit state with a
  steady cursor.
- **A live DMS site cannot render this hero from theme
  configuration.** Porting it requires a registered page-section
  component (`src/dms/skills/creating-page-section-components.md`);
  the rest of the page ports as ordinary sections.

## Alignment rule (read before translating)

Product bands on Layout `app` use `mr-auto … pl-12 pr-8`
(`layouts.centered: 'max-w-[1280px] mr-auto'`). Marketing bands on
Layout `default` centre with `mx-auto … px-6` — Layout `default` has
no SideNav to hug; this is an intentional, documented exception.
`auth` centres by intent. The full table with verbatim class strings
is on `layouts.html` [03].

## Icons lifecycle

63 glyphs in `theme/icons.js` — 24px grid, 1.75 stroke, square caps,
mitre joins, a filled square cell wherever another set uses a dot.
Every `<svg>` in the pages carries `<!-- icon: Name -->` (must exist
in the registry) or `<!-- decorative -->`. Audit per
`src/dms/skills/managing-design-system-icons.md`. Do **not** run
`icons-sync` yet: the live `src/themes/tessera/icons.jsx` belongs to
the v2 theme that `tessera-theme.js` still consumes. Sync when the v3
theme translation lands.

## Scope — what this theme is and isn't for

Designed for: the product marketing surface, docs, civic dashboards,
dataset workbenches — any surface that benefits from data-dense,
terminal-honest chrome. Not designed for: media-heavy consumer
surfaces (photo-forward sites should ship their own theme); print.

All primitives are nonetheless themed (components.html shows every
one) so nothing falls back to Catalyst chrome.

Out of scope for v3, deliberately: the `theme/theme.js` translation
(the sibling skill's job — v2's runtime theme keeps serving live
sites until then); a light mode (dark-only is the brand decision,
documented on theme.html); additional example pages; the MapLibre
basemap style and production chart theme.

## Working with this folder

- **Preview:** `python -m http.server` from the dms-template root,
  then open `/src/themes/tessera/design_system_v3/design-system/theme.html`.
  (Fonts come from the Google Fonts CDN; no local files needed.)
- **Change a token:** edit `_shared.css` (+ the inline
  `tailwind.config` block in each page's head if it's a color/family
  — keep them identical; `theme/tailwind.additions.js` is the
  reference copy), update the spec row on `theme.html`, then grep the
  other pages for the old value.
- **Add an icon:** register in `theme/icons.js`, add a catalog tile
  on `theme.html` [03], tag the page svgs, re-run the audit.
- **Add a page:** copy a page's head + chrome, add it to every
  footer link block and every floating widget.
