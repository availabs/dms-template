# Albany County Land Bank — DMS Design System

> v0.1 · 2026-07-01 · Built per `src/dms/skills/designing-a-dms-design-system.md`.
>
> A civic design system for the **Albany County Land Bank Corporation**
> (albanycountylandbank.org) — a public authority that acquires
> tax-foreclosed, vacant, and abandoned property in Albany County and
> returns it to responsible owners. The system's voice is *records-office
> polish*: survey grids, parcel ledgers, and the sky-blue / leaf-green of
> the ACLB logo grounded in a deep civic ink.

## What's in this folder

This folder is the **design system** (mockups + tokens). The shipped theme
artifact lives one level up: `src/themes/landbank/theme.js` + `icons.jsx`,
registered in `src/themes/index.js` as `landbank`.

```
design_system/
├── README.md
├── _shared.css              fonts roles, surfaces (lb-*), plat textures, parcel-plate hatches
├── assets/
│   └── aclb-logo.png        the real ACLB logo (from albanycountylandbank.org)
├── design-system/           the FIVE DMS-shaped docs pages
│   ├── theme.html               1 · tokens: color, status system, 14 type tokens, icons, surfaces
│   ├── layouts.html             2 · Layout variants (default/app/bare) + LayoutGroup bands + wrapper tables
│   ├── grid.html                3 · the 12-col gap-0 sectionArray grid, span vocabulary, compound cards
│   ├── components.html          4 · every primitive in ACLB skin (nav, forms, overlays, cards, rich content)
│   └── patterns.html            5 · compositions: data states, dashboard kit, record cards, forms, admin chrome
└── pages/                   the three example pages
    ├── home.html                public homepage (hero record card, KPI proof, process, programs, impact)
    ├── about.html               mission, pipeline, real-data timeline, public accountability
    └── properties.html          the portfolio dashboard (the theme's centerpiece — see below)
```

Open any file in a browser — plain HTML + Tailwind Play CDN, no build step.
Suggested reading order: `theme → layouts → grid → components → patterns → pages/*`.
Every page links to every other via the TopNav / footer index / floating widget.

## The brand in one paragraph

**Color** comes straight from the logo: `sky #0AA7E4` and `leaf #8CC63E` as
graphic colors only, with darkened pairs (`skydeep #0A6E99`, `field #4C9129`,
`forest #33641B`) doing interactive/text duty, all grounded in `ink #16232C`
on record-paper neutrals. A seven-status **semantic color system** (For Sale ·
ACLB Rehab · Sale Pending · Co-Development · In Process · On Hold · Sold) drives
every pill, map pin, donut slice, and bar identically. **Type** is Archivo at
118% width (civic display caps echoing the tracked ACLB wordmark), Public Sans
(the U.S. public-sector typeface) for prose, IBM Plex Mono for parcel IDs and
data chrome — 14 declared tokens, modifier axes for color/uppercase/tabular.
The **signature element** is the *parcel plate*: property cards draw each lot's
true recorded geometry (width × length) as a hatched survey diagram — vacant
lots don't photograph well; their survey tells the story.

## Real data throughout

All figures come from `references/landbank/AlbanyCountyLandbankData.xlsx`
(1,314 property records, June 2026): 199 parcels in inventory, 60 for sale,
1,115 sold since 2015, $600 median asking, sold-by-year series 2015–2026.
The properties dashboard's map plots the 176 geocoded current-inventory
parcels at their true coordinates. The dashboard is loosely based on the
Monday.com board screenshot in `references/landbank/albany land bank.docx`
(total owned / avg days / zoning + status donuts / map), redesigned around
the status system, a real ledger table, and neighborhood analytics.

## Scope & choices

- **Layouts:** `default` (public, TopNav, centered `max-w-[1240px] mx-auto`),
  `app` (staff console, SideNav, `mr-auto` per platform rule), `bare` (auth).
  The centered public layout is an intentional, documented deviation from the
  `mr-auto` rule — that rule exists for SideNav surfaces (see layouts.html).
- **Grid:** 12 columns, `gap-0`, `p-3` padding gutters, chrome on inner boxes.
- **Designed for:** civic marketing pages, public data dashboards, ledgers,
  application forms, light admin. **Not designed for:** media playback,
  calendars, long-form editorial — those inherit neutral recipes.
- **Custom column type:** the parcel plate (lot-geometry thumbnail) is the one
  theme-registered column type; everything else is configured platform primitives.
- Icon registry (39 glyphs, incl. the custom `Lot`) lives on `theme.html#icons`;
  every SVG in these pages carries an `<!-- icon: Name -->` comment.

## Next step

Translate to a runnable theme via
`src/dms/skills/translating-design-system-to-dms-theme.md` — `_shared.css`
mirrors into `theme/index.css.additions`; the type tokens map onto
`textSettings.styles[0]`; the status pills map to Pill named variants.
