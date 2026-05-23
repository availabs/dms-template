# pages/

Example page mockups demonstrating the Tessera theme on real-feeling
surfaces. Per `src/dms/skills/designing-a-dms-theme.md` §12.6,
this folder is **theme-chosen and optional** — themes are choices, and
each one ships the example pages that demonstrate its intent.

Tessera ships eight example pages covering the four surface families
the v1 design template explored: a civic dashboard, marketing,
documentation, and product chrome.

## Contents

| File | Surface | Notes |
|---|---|---|
| `civic-overview.html` | Civic dashboard | A Sullivan County mitigation overview. KPI strip, hazard map with NFIP claims overlay, stacked-bar status chart, recent-actions table, stakeholder list. The brand's home turf. |
| `marketing-homepage.html` | Marketing | The Tessera product homepage. Header hero + surfaces grid + two-doors fork + proof points + theory link + marketing footer. |
| `marketing-comparison.html` | Marketing | Hosted vs. self-host comparison — the WordPress.com vs. WordPress.org fork. 14-row capability matrix across 4 categories. |
| `marketing-theory.html` | Marketing | Long-form essay page citing Macwright on representation primacy. Magazine-style typesetting; ~620px reading column; drop-cap; pull-quote. |
| `docs-page.html` | Documentation | A reference chapter from the docs. Three-column layout (DocsSidebar + prose column + on-this-page rail). Substantive code samples on slate and limestone grounds. |
| `product-site-overview.html` | Product chrome | The wcdb.fm-shaped admin "Site overview" — patterns list, KPI strip, recent activity. Uses the `app` Layout variant. |
| `product-page-editor.html` | Product chrome | Page editor canvas with the section list left + live preview + edit chrome right. The most dense surface; demonstrates the toolbar / drag-handle / section-type designator pattern. |
| `product-dataset-view.html` | Product chrome | Dataset / data-view: filter chrome + table + pagination + schema + downstream-pattern panels. |

## Migration from the v1 design template

These pages were originally implemented in
`../Tessera Design System/ui_kits/` as React + JSX, with all components
bundled into single HTML files and transpiled in the browser via Babel
Standalone. The result was a 1.88 MB JSX script per page being
transpiled in the main thread on every load — browser-crashing on the
marketing homepage in particular.

The v2 translation is pure HTML + CSS. No JSX, no Babel, no React. The
same content composed into the same structural shape, just rendered
directly. Open any of them in a browser; they load instantly.

If you need to refer back to the original implementations:

```
../Tessera Design System/ui_kits/marketing/index.html      → marketing-homepage.html
../Tessera Design System/ui_kits/marketing/comparison.html → marketing-comparison.html
../Tessera Design System/ui_kits/marketing/theory.html     → marketing-theory.html
../Tessera Design System/ui_kits/docs/index.html           → docs-page.html
../Tessera Design System/ui_kits/product/index.html        → product-site-overview.html
../Tessera Design System/ui_kits/product/editor.html       → product-page-editor.html
../Tessera Design System/ui_kits/product/dataset.html      → product-dataset-view.html
```

## Why this many examples for Tessera

The brand's most natural target is the civic / institutional / durable
surface (the civic-overview page), but the v1 template explored seven
other surfaces and they're worth preserving as v2 — for two reasons:

1. **They demonstrate the brand surviving a wider range of contexts**
   than the brand brief explicitly committed to. Tessera reads well as
   a docs site, a marketing site, a product chrome surface, *and* a
   civic dashboard. That's evidence the foundation tokens are doing
   their job.
2. **They give the design-Claude agent more example shapes to compose
   against** when extending the system in v0.2.

Per the design contract, the number of example pages a theme ships is
the theme's choice. Tessera v0.1 chose generosity here.
