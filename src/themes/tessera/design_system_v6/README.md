# Tessera — Design System v6 · "Graph Paper"

> v6 · 2026-07-03 · A new direction, unrelated to v2–v5's mosaic/console/deco
> passes. Visual language drawn from **tailwindcss.com, Tailwind Plus, and
> zed.dev**: hairline structure, drafting-sheet grids, monospace metadata,
> one saturated cobalt, borders over shadows — plus a handwritten margin
> voice, rationed to drafting annotations. The anchor example page is **an
> invite-only beta landing** — personable but professional (the original
> friends-and-family register was formalized per owner feedback, v6.4) —
> joined by a features page and a docs landing (v6.6).
>
> Read in this order: `src/dms/skills/designing-a-dms-design-system.md`
> (the structural grammar) ·
> `planning/tessera/tasks/current/tessera-v6-design-system.md` (this pass's
> design doc) · this file.

## The conceit

**The builder lays tiles on graph paper.** A tessera is a tile; DMS sections
are tiles set on a 12-column sheet. The design system *is* the drafting
sheet — but the grid is **rationed** (owner feedback, v6.1): the page body is
plain paper + grain; the 24px graph grid appears only where the sheet means
something — hero/CTA bands via `.t6-sheet-fade` (it dissolves into paper),
editor canvases and demo surfaces via `.t6-sheet`. Marketing bands are
separated by hatched `.t6-divider` strips with 7px **square joint tiles**
pinned where they meet the rails (zed-style anchors — and literally
tesserae), and every band carries 16px **edge-pattern strips** at the
viewport edges connecting the dividers — one flavor per band: `t6-hatch`
(hero/CTA + the sticky TopNav, so the header rides the rails as you
scroll) · `t6-backhatch` · `t6-dashes` · `t6-ticks` · `t6-rungs` ·
`t6-ticks-chalk` (board bands). (A wider "drafting frame" was tried in
v6.2; owner preferred the slivers. Plus-crosses, dot fills, and a
checkerboard were tried in v6.3; owner preferred squares, ticks, rungs.) Mono annotations —
and pencil notes in Caveat, as if the builder marked up a printout before
handing it to you. The signature is **the claimed cell**: the logo is graph
paper with one cell taken by a filled tessera set at −8° — the only filled
shape in the icon set (chosen from a five-candidate pass, v6.5; the earlier
mark was a tilted tile with a cursor) — and the landing hero shows the
editor mid-drag.

## Light and dark, first-class

Every color token is a CSS custom property (`--t-paper`, `--t-cobalt`, …) in
`_shared.css`; the per-page Tailwind config maps brand color names to
`var()`, so **one set of utility classes renders both modes** —
`[data-theme="dark"]` on `<html>` swaps the palette. A sun/moon toggle in
every TopNav persists the choice (`localStorage["t6-theme"]`; an early head
script applies it before first paint; unset falls back to
`prefers-color-scheme`). Consequences to know:

- Slash-opacity utilities (`bg-cobalt/10`) don't work on var() colors — the
  `*Soft` tokens exist instead.
- Text on cobalt/brick fills is `text-accentInk` (white in light mode,
  near-black in dark, where the accents lighten). Never `text-white` on an
  accent fill.
- Board (code-pane) tokens don't invert — dark bands are dark in both modes.

## Tokens in one breath

Palette: paper · panel · well · ink · graphite · pencil · rule/ruleStrong ·
**cobalt** (the only speaking accent) · marker (highlighter) · go / amber /
brick (status) · board/board2 + chalk/chalkDim (code panes). Type: 15
tokens, 4 roles — display + prose are **IBM Plex Sans** and meta is **IBM
Plex Mono** (Zed's brand family: "Zed Plex" is customized IBM Plex), note is
**Caveat** (margin voice, ≤3/page, never UI). Radius: 6px
controls, 8px cards, pill badges. Depth: 1px borders; shadow-lift on hover;
shadow-drag reserved for the mid-drag moment. Motion: 150ms ease-out and two
permitted loops — the hero caret blink and the landing hero's sketch layer
(three.js, v6.5: 2px wireframe sections trace onto the sheet, assemble page
layouts, and get rearranged like editor sections, t6-joint squares at each
corner; static when reduced-motion) — both reduced-motion safe.

## Layout

```
design_system_v6/
├── README.md
├── _shared.css              ← THE canonical CSS: light+dark custom
│                              properties, graph/grain/hatch textures,
│                              15 .t-* type tokens, .t6-* utilities,
│                              annotation overlay, reduced-motion.
├── ds-nav.js                ← shared floating nav widget (documentation
│                              scaffolding; never ships on a live site).
├── design-system/            FIVE DMS-shaped documentation pages
│   ├── theme.html               1/5 · color (both lamps + contrast
│   │                             tables) · type · icons (~55) · space/
│   │                             shape · motion · texture · dark · voice
│   ├── layouts.html             2/5 · Layout + LayoutGroup variants,
│   │                             wrapper-class reference table,
│   │                             section width (full_width)
│   ├── grid.html                3/5 · the 12-col sectionArray grid and
│   │                             the grout model, compound-card example
│   ├── components.html          4/5 · every primitive, brand-skinned,
│   │                             navs to level 3
│   └── patterns.html            5/5 · states, filtered data section,
│                                 forms, auth, edit chrome, recurring
│                                 brand patterns
├── pages/
│   ├── beta-landing.html      the anchor example page (see below)
│   ├── features.html          marketing features page — Layout default
│   ├── docs.html              docs landing — Layout app (SideNav + search)
│   ├── login.html             sign-in — Layout bare (patterns.html §06)
│   └── admin-*.html           ADMIN pages (v6.7, control-room chrome) —
│                              see planning/tessera/tasks/current/
│                              tessera-v6-admin-pages.md; admin-site.html
│                              is the first of the set
└── theme/                     artifacts for the theme translation
    ├── icons.js                 icon registry — SOURCE OF TRUTH
    ├── index.css.additions      pointer shim → ../_shared.css
    ├── tailwind.additions.js    theme.extend block (all var()-backed)
    └── README.md                translation notes
```

## The example pages

`pages/beta-landing.html` — the anchor: the landing page for an invite-only
website-builder beta. Personable but professional, no first person (v6.4):
a stacked hero lockup — "Tessera" (displayHero) over "a data-driven
website builder." (displayXL) with the blinking caret — an illustration of
**the actual editor mid-drag** (page tree, grid overlay, a graph section
being placed), honest
capability tiles, a **known issues** board band (mono checklist of real
bugs + a report-an-issue link), a small FAQ, and an invite form. The
margin voice is held to two drafting annotations on the editor
illustration, and feedback routes through real channels (form, issue
link) — never a personal one. The TopNav links to the features and docs
pages, not in-page anchors. Every band is a DMS-shaped LayoutGroup on the
documented 12-col gap-0 grid; every capability named is something DMS
actually does (in-place editing, live data binding, spreadsheets, avlGraph
charts, MapLibre GIS, themes, drafts→publish).

`pages/features.html` (v6.6) — the marketing features page, Layout
`default`. Three deep-dive bands (edit in place, the sheet, live data),
each pairing copy + a mono spec line with a product miniature drawn from DS
primitives — a selected section with t6-joint corner handles and its edit
toolbar, a spanned mini-sheet with the grid overlay, a file→dataset card
with a version pill — then six compact toolkit tiles (tables, charts,
maps, themes, publish, access) and an invite CTA. No three.js here: the
sketch layer stays the landing hero's signature.

`pages/docs.html` (v6.6) — the docs landing, Layout `app`: the SideNav
carries doc categories (Start here active, with level-2 anchors) and the
slim TopNav adds a docs search field with a `/` key hint. Bands (all
`mr-auto`): a quick start of three numbered steps with board code panes
(`npx tessera new` · `tessera dataset upload` · `tessera publish`), four
concept cards, a popular-guides list in the flush-row style, and a help
band linking the known-issues board. All guide links are placeholders.

`pages/admin-*.html` (v6.7) — design versions of the DMS **admin pattern**
(task doc: `planning/tessera/tasks/current/tessera-v6-admin-pages.md`).
Layout `app` with the **control-room SideNav trial**: w-56, mono `t-metaMD`
lowercase labels, 2px cobalt left-rule active state (vs the docs sidenav's
rounded pill), and an env + user block at the bottom. The sidenav is
site-scoped only (overview/themes/people/tenants) — patterns are NOT listed
there (production sites run 50–100+ patterns; the overview table is the
pattern nav). Density rule: the working surface is the feature — header +
stats compress into one ~90px strip. Admin pages carry their own compact footer
block, and the other pages gain a single `admin` link — a documented
deviation from the every-page-lists-everything footer rule, to keep footers
sane as the admin set grows.

`pages/login.html` (v6.6) — the sign-in page, Layout `bare` per the
documented auth pattern (patterns.html §06): no product chrome, one
centered card on the fading sheet — the only panel on the page. Email +
password fields, a forgot link, and an invite-only note routing to the
landing's request form (no self-signup during the beta). Mode follows the
choice stored by any other page. The live "sign in" footer links on the
marketing pages point here.

**Alignment note:** this page uses Layout `default` (marketing) — bands
centre with `mx-auto`, the documented exception (no SideNav to hug).
Product surfaces on Layout `app` — including the five design-system pages
themselves — use `mr-auto`. The full wrapper-class table is on
`layouts.html`.

## Icons lifecycle

~55 drawn glyphs (24px grid, 1.5px stroke, round caps) in `theme/icons.js`.
Every page `<svg>` carries `<!-- icon: Name -->` or `<!-- decorative -->`.

```bash
node scratchpad/scripts/icons-audit.mjs --brand tessera-v6      # pages/
node scratchpad/scripts/icons-audit.mjs --brand tessera-v6-ds   # design-system/
```

Do **not** run `icons-sync.mjs` for v6: the live
`src/themes/tessera/icons.jsx` still serves the theme that's actually
running. Sync when a v6 theme translation lands.

## Scope

Designed for: the tessera product surfaces (editor, marketing/landing,
docs), data-driven pages (cards/tables/graphs/maps), auth. Deliberately out
of scope for v6: the `theme/theme.js` translation (sibling skill's job),
additional example pages, production MapLibre/chart themes.

## Working with this folder

- **Preview:** `python -m http.server` from the dms-template root →
  `/src/themes/tessera/design_system_v6/design-system/theme.html`. Toggle
  the moon/sun in any TopNav to check both modes — always check both.
- **Change a color:** edit BOTH mode blocks in `_shared.css`, the swatch
  tile + contrast table on `theme.html`, and `theme/tailwind.additions.js`.
- **Add a type token:** earn it first (skill §7.2.1), add the `.t-*` class,
  add its specimen row on `theme.html`.
- **Add an icon:** register in `theme/icons.js`, add a catalog tile on
  `theme.html`, tag usages, re-run both audits.
- **Add a page:** copy a page's head + chrome, add one line to `ds-nav.js`
  SECTIONS, add it to every footer link block.
