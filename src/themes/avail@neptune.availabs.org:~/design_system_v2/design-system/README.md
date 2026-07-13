# design-system/

The four documentation pages that document the Tessera theme on its own
terms. Each page is structured as a real DMS page — Layout >
LayoutGroup > Section — so the design system documents itself using
the platform it documents.

## Pages

| File | Documents |
|---|---|
| `theme.html` | Foundation tokens — color (mineral palette), type (Newsreader + IBM Plex Sans + IBM Plex Mono), icons, spacing, radii, elevation, motion, focus ring. |
| `grid.html` | Structural layer — Layout (default / app / bare) and LayoutGroup (content / header / auth / footer) named variants with diagrams and a "which to use" picker matrix. |
| `components.html` | Every UI primitive themed — TopNav, SideNav, NavigableMenu, Button, Input, MultiSelect, Switch, Tabs, Dialog, Card, dataCard, Pill, Pagination, Logo, Table, Lexical, Graph. |
| `patterns.html` | Composed multi-primitive patterns — empty / loading / error states, data section with filters, card grid, form layout, modal with form, dataset overview, auth login, section toolbar. |

## Shared chrome

`_dms-page.css` is the shared stylesheet for all four pages. It
defines:

- The `.dms-layout-*` classes that mirror DMS's Layout wrapper structure.
- The `.dms-group-{content,header,auth,footer}` classes that mirror
  the four LayoutGroup named variants.
- The `.dms-section-*` classes for Section chrome.
- Page meta, eyebrow, and annotation helpers used in the documentation
  itself.

The classes here are visual shorthand for what the live theme would
render via `tessera-theme.js`. They match the same values, so a
mockup and a live render look the same.

## Reading order

If you're new to the system, read in order:

1. `theme.html` — orientation; what's in the brand's vocabulary.
2. `grid.html` — how content is arranged on a page.
3. `components.html` — every leaf primitive.
4. `patterns.html` — how primitives compose.

Then look at `../pages/civic-overview.html` to see the system applied
to a non-introspective surface.
