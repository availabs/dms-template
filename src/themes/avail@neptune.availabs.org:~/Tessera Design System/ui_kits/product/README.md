# Tessera — Product UI kit

The product surface — Tessera's authoring chrome. A typed-row model
expressed as a small set of well-considered tools.

## What the product does

Tessera lets a small team manage a data-driven site. The same row
format drives pages, sections, datasets, queries, and themes. The
product chrome lets you compose, place, and publish those rows.

## Files

- `index.html` — site overview (the default landing for a logged-in user).
- `editor.html` — page editor canvas.
- `dataset.html` — dataset / data-grid view.
- Components:
  - `ProductChrome.jsx` — top bar + scaffolding.
  - `SiteSidebar.jsx` — left rail with site index.
  - `PatternsList.jsx` — the section list a site is composed of.
  - `KpiStrip.jsx` — small data-strip with tabular numerals.
  - `Toolbar.jsx` — secondary action bar.
  - `EmptyState.jsx` — the "no sections yet" treatment.
  - `Modal.jsx` — sheet modal with scrim.
  - `Tooltip.jsx` — solid slate-on-parchment.

The product chrome is opaque, square-cornered, and uses the parchment
surface for lifted controls. No floating action buttons, no chat
widgets.

## Cuts-corners

- Authentication and routing are mocked.
- The page editor canvas previews static content; in reality, sections
  are composed by drag-and-drop. The placement affordances are
  rendered but not interactive.
- Data-grid filters and column reordering are visual only.
