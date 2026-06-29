# Handoff: TransportNY Design System

## Overview

This bundle is the TransportNY design system — a public-sector data platform for NYSDOT, MPOs, academic partners, and the public to access NPMRDS travel-time data, MAP-21 PM3 federal-reporting dashboards, freight reliability, congestion, work-zone, and route-analysis tools.

It ships four foundation pages (Theme, Grid, Components, Patterns) and a set of working product pages built on top of them so you can see how the system composes in practice.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — interactive prototypes showing the intended look, behavior, and composition rules. They are not production code to copy directly.

They use plain HTML files with inline React + Babel and Tailwind CDN. That's the right tool for iterating on a design quickly; it is **not** the right tool for production.

The task is to **recreate these designs in the target codebase's environment** (likely a Vite/Next.js + React + Tailwind app — pick what matches the existing repo) using its established build pipeline, component patterns, and routing. The HTML files are pixel-fidelity references; the system tokens and rules they encode are what should be ported.

If no production environment exists yet, a sensible starting stack is:
- Vite + React + TypeScript
- TailwindCSS with the design tokens below committed as `tailwind.config.ts` theme extensions
- A `components/` directory mirroring the components catalogued here
- A single shared `<TNYSidebar>`, `<TNYPageHeader>`, `<TNYCard>`, etc., that every product page consumes

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, component shapes, and interactions are all specified. Recreate pixel-perfectly using the codebase's existing libraries — port the tokens, build the components, then assemble pages from them. The HTML files reference exact pixel sizes (e.g. `h-8`, `px-2.5`, `text-[12px]`) — preserve them.

---

## Foundation pages

These four pages define the system. **Read them first.** Every other page is an application of these rules.

### 1. Theme — `pages/theme.html`
Color palette, typography scale, surface tokens, elevation, motion. The first surface a developer should port.

### 2. Grid — `pages/grid-system.html` + `pages/grid-system.jsx`
- **// 00 Scope** — the grid governs the main content area only; sidebar is fixed chrome outside the system
- **// 01 Foundations** — six container tokens: `narrow` (480), `prose` (720), `split` (1024), `marketing` (1280), `data` (1480), `workbench` (full-bleed). Pick one per page; never invent widths.
- **// 02 Columns** — 12-column grid, 24px gutter, 32px page margin at `lg`
- **// 03 Vertical rhythm** — section-padding scale: `dense` 24, `comfortable` 48, `roomy` 72, `feature` 96. One per page.
- **// 04 Surfaces** — **the cards-on-pane rule.** Section bg is always `.tny-pane` (#ECEEF2) or `.tny-pane-tint` (#E4E8EE). Content lives inside cards. Never `bg-white` on a section.
- **// 05 Composition** — rules + anti-patterns

### 3. Components — `pages/components.html`
Per-component specs with rules:
- **Page headers** (`TNYPageHeader`) — three tones: `data`, `hero`, `editorial`. Always in the data container.
- **Breadcrumb** (`TNYBreadcrumb`) — separator `›`, last item non-link
- **Buttons** — primary (NYS Blue), secondary (ghost), destructive
- **Inputs & Selectors** — form fields (h-11), compact selectors (h-8), tone-bar (white-on-blue), toggles/radios/checkboxes/sliders
- **Selects** — **four documented variants**:
  - `01 · Compact` (h-8 chip, lives in page headers — see MAP-21 year picker)
  - `02 · Standard` (h-11 form field)
  - `03 · Multi-select` (h-11 with applied-count badge + checkbox menu)
  - `04 · Multi-select with search` (search pinned at top, use for >10 options)
- **Navigation** — persistent ink rail (`#12181F`), Amber active-bar, sub-section indent into `#0d1117`
- **Cards** — two layers: primitives (`Card`, `CardKicker`, `CardTitle`, `CardScore`, `CardDelta`, `CardTrend`, `CardTargetBar`) and composed (`KpiCard`, `KpiCardCompliance`, `StatTile`, `MetricCard`). Single-column rule: every section of a card lives on its own row.
- **Tables** — editorial (deep navy header, bone tint, for printable docs) vs dashboard (light, hover-amber rows)
- **Popovers, Menus & Toolbars**
- **Chart Chrome** — three variants: **bar** (categorical, Cat-5 palette), **line** (single series, NYS Blue + area fill), **multi-line** (slate ramp hierarchy, dashed amber target rule, focus-line tooltip)
- **Badges, Pills & Status** — status is a colored dot, never a background

### 4. Patterns — `pages/patterns.html`
Page archetypes. Each pattern fixes a container, alignment, and section-padding scale: `Form`, `Data dashboard`, `Report template`, `Editorial / doc`, `Workbench`, `Split`, `Catalog / Marketing`.

---

## Example product pages

These are real product surfaces built on the system. Use them as full-page references when implementing similar screens.

| Page | File | Container | Pattern | Notes |
|---|---|---|---|---|
| Landing / marketing | `landing.html` (+ `landing-app.jsx`, `landing-parts.jsx`) | marketing 1280 | Catalog | Public-facing marketing for the platform |
| Sign in | `login.html` | full + 9/3 split | Form | Sidebar present with **signed-out** user state. Heading lives **inside** the card; no page hero. Credentials form first, then `or` divider + single "Continue with NY.gov ID" SSO button. Aside has: Browse without signing in / Why an account? / System status. |
| Getting Started | `getting-started.html` | data 1480 | Catalog | NPMRDS landing. TNYPageHeader (hero) with compact Region select in actions slot. Two sections: `// 01 Regional analysis` (3 subgroups: Floating Car / Reliability / Congestion) and `// 02 Route analysis templates` (4 templates). |
| Documentation index | `docs-overview.html` | prose 720 | Editorial / doc | TOC + body |
| MAP-21 PM3 (per-year) | `map-21.html` + `map-21.jsx` | data 1480 | Data dashboard | Year-selector compact select (`2016–2025`), compliance band, map workbench with TMC segments + inspector, MPO small-multiples leaderboard. **Has Tweaks panel with 12-col grid overlay** — see `GridOverlay` and `TweaksPanel` integration. |
| MAP-21 PM3 (multi-year trend) | `map-21-trend.html` + `map-21-trend.jsx` | data 1480 | Data dashboard | Companion to per-year view. Compact Geography select (4 tabs: NY State / Counties / MPOs / Urb. areas) + Year-range select. 4 full-width measure sections, each with Graph / Table / Cards view toggle. **Critical reference for** the geography selector, view toggle, and trend-chart patterns. |
| Floating Car (50p Speed) | `floating-car.html` | data 1480 | Data dashboard | Report template |
| Congestion | `congestion.html` | data 1480 | Data dashboard | |
| Work Zones | `work-zones.html` | data 1480 | Data dashboard | |

---

## Design Tokens

Port these directly to `tailwind.config.ts` `theme.extend` (or your equivalent).

### Colors

```ts
// Core palette
'nys-blue':       '#1F3F8F',    // Primary brand. Tone-bars, primary CTAs, links.
'blue-press':     '#16307A',    // Hover/active for primary blue surfaces.
'ink-navy':       '#0F2D4D',    // Table headers, callouts, deep accents.
'sidebar-ink':    '#12181F',    // Persistent left rail. Always paired with white text.
'logo-plate':     '#0A0E13',    // Top of sidebar, behind NYS mark.
'active-amber':   '#FACC15',    // Selected nav, highlighted toolbar buttons.
'underline-amber':'#EAAD43',    // Section heading underline, anchored TOC.
'kicker-amber':   '#CA8A04',    // Kicker text "// 01" labels.
'slate-tag':      '#37576B',    // Avatar gradient base, status chips, links.

// Surfaces (the cards-on-pane system)
'pane':           '#ECEEF2',    // Page background. THE DEFAULT FOR <section>.
'pane-tint':      '#E4E8EE',    // Alternating sections.
'card':           '#FFFFFF',    // Default content surface.
'card-tint':      '#FAFBFC',    // Inner panels inside a card.
'card-bone':      '#F5F1E8',    // Editorial / printable narrative only.

// Data viz — categorical (5 max)
'cat-1': '#6F6F6F',
'cat-2': '#E5A646',
'cat-3': '#94C24E',
'cat-4': '#E160A4',
'cat-5': '#F2CB3D',

// Data viz — sequential speed ramp (5 stops, slowest → freeflow)
'speed-0': '#D6453B',  // 42.12–42.46 mph
'speed-1': '#E8843F',
'speed-2': '#F2E18A',
'speed-3': '#A8D26B',
'speed-4': '#3FA34D',  // 49.62–50.61 mph freeflow

// Status (never as backgrounds; only as dots/text)
'good':   '#10B981',
'warn':   '#F59E0B',
'bad':    '#EF4444',
'na':     '#94A3B8',
```

### Typography

Two families:
- **Oswald** — condensed display. Chrome, headings, tabular labels. `font-oswald`. Weights 300–700 variable.
- **Proxima Nova / Source Sans 3** — all running prose, form copy. `font-proxima`. Weights 300–700 variable. (Source Sans 3 is the open substitute used in the bundled fonts.)
- **Mono** — `ui-monospace, SFMono-Regular, Menlo, monospace`. For numerics ≥18px, kickers, metadata.

Type scale (use these exact sizes — they're tuned to the grid):

| Role | Family | Size | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Display | Oswald | 52px | 600 | tracking-tight | Page hero (`tone="hero"`) |
| H2 Section | Oswald | 28px | 600 | — | Spec/section starts |
| Section title (data) | Oswald | 38px | 600 | tracking-tight, uppercase | `TNYPageHeader tone="data"` |
| Section title (editorial) | Oswald | 40px | 600 | tracking-wide, uppercase, underlined Amber | `TNYPageHeader tone="editorial"` |
| Card title | Oswald | 14-15px | 500 | — | KPI / section card heads |
| Nav glyph | Oswald | 13.5px | 500 | uppercase, tracking-wide | Sidebar items, tab pills |
| Body | Proxima | 14.5px | 400 | line-height 1.65 | Running prose, max-w 680 |
| Caption | Proxima | 12.5px | 400 | — | Card subtitles, TOC, footnotes |
| Kicker | Mono | 10.5px | 400 | tracking-[0.2em], uppercase | `// 01` labels in kicker-amber |
| Numeric | Mono | 22px | 500 | tabular-nums | KPI values. Never Oswald < 18px |

### Spacing & Containers

```ts
// Containers (max-w)
narrow:    '480px',
prose:     '720px',
split:     '1024px',
marketing: '1280px',
data:      '1480px',
workbench: '100%',

// Section padding tokens (vertical only — pick one per page)
dense:       '24px',
comfortable: '48px',  // Default for dashboards
roomy:       '72px',  // Editorial
feature:     '96px',  // Landing / hero
```

### Radii & Shadows

- Card: `radius 8px` + `shadow-sm` (`0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(15,23,42,0.02)`) + 1px hairline `rgba(15,23,42,0.08)`
- Popover/menu: `radius 8px` + `shadow-lg`
- Floating dock: `rounded-full` + `shadow-xl`
- Form input: `radius 6px`
- Sidebar items: square (zero radius); active state uses left-bar instead

### Motion

- Hover: 120ms ease-out
- Tone-bar press (`.tny-press`): 80ms — border drops 2px (intentional mass effect)
- Popover open: 140ms · opacity + 6px translateY
- Pulsing status dot (`.dot-pulse`): 2.4s ease-in-out infinite

### The cards-on-pane rule (read this twice)

The single most important visual rule. From Grid `// 04 Surfaces`:

> Section background = page pane (#ECEEF2). Content lives in cards.
> 
> - Set bg on every `<section>` to `.tny-pane` (or `.tny-pane-tint`) — never white, never card
> - Put content inside a card with a visible edge: 1 px hairline + 8 px radius + `shadow-sm`
> - Alternating sections use pane vs pane-tint — **never** pane vs white
> - Don't nest white-on-white. If you need a sub-surface, use `.tny-card-tint` (#FAFBFC)
> - Lightweight summary strips (kicker + a row of inline stats) can sit directly on the pane without a card

The visual comparison on grid-system.html under `// 04 Surfaces` shows BAD (wall-to-wall white) vs GOOD (cards on pane). This is the source of truth.

---

## Components — Implementation order

When porting, build in this order. Each layer depends on the one above.

1. **Tokens** — colors, type, spacing, radii, shadows in `tailwind.config.ts`
2. **Surface primitives** — `tny-pane`, `tny-pane-tint`, `tny-card`, `tny-card-tint`, `tny-card-bone`, `tny-mono` as utility classes
3. **Icons** (`ui_kits/transportny/icons.jsx`) — port the icon set; ~40 SVGs as React components. Names: `Pages`, `Sections`, `Settings`, `History`, `Search`, `Database`, `CaretDown`, `CaretUp`, `ChevronRight`, `ChevronLeft`, `User`, `PencilEdit`, `View`, `Plus`, `XMark`, `Filter`, `Download`, `More`, `MapLayers`, `SortAsc`, `Grid`, `Bell`, `Play`, `Pause`, `MapPin`, `Activity`.
4. **Chrome** (`pages/_chrome.jsx`) — `TNYSidebar` (with `user={null}` signed-out variant), `TNYPageHeader` (tones: `data` | `hero` | `editorial`), `TNYBreadcrumb`, `TNYFilterBar`, `TNYTopBlue`, `TNYPillBar`, `TNYFooter`, `TNYCard`
5. **Cards** (`pages/_cards.jsx`) — `Card`, `CardKicker`, `CardTitle`, `CardMeta`, `CardHint`, `CardStatus`, `CardScore`, `CardDelta`, `CardTrend`, `CardTargetBar`, then `KpiCard`, `KpiCardCompliance`, `StatTile`, `MetricCard`
6. **Selects** — port all 4 variants from `components.html` `#selects`. The compact h-8 select is the workhorse used in page headers throughout (see `YearScrubber` in `map-21.jsx`, `GeographySelect` in `map-21-trend.jsx`).
7. **Charts** — line / multi-line / bar following the rules in `components.html` `#charts`. NYS Blue primary, slate ramp for comparisons, dashed Amber target rule.
8. **Tweaks panel** (`pages/tweaks-panel.jsx`) — optional in production; useful in dev. Drop if your toolchain has its own design-debug overlay.
9. **Product pages** — assemble from the above.

---

## Interactions & Behavior

### Sidebar

- Persistent at all breakpoints ≥ lg; collapses to 60px icon-only at smaller widths
- Active item: Amber left-bar (3px) + `#1e2530` body. Inactive: transparent left-bar + slate-300 text.
- Hover: `#1e2530` body, no left-bar yet
- Sub-sections (when present) indent into `#0d1117`
- User block at bottom has two states (see Sign in page):
  - **Signed in** (`user` prop set): initials avatar + name + caret menu
  - **Signed out** (`user={null}`): "Sign in" pill that links to `/login`

### Compact selects (h-8 chips in headers)

- Default: white bg, hairline border
- Open: border becomes `#37576B` with 2px ring at 15% opacity
- Caret rotates 180° when open
- Outside-click and Escape close
- Apply state immediately on selection for single-selects; require explicit Apply for multi-selects

### Tone-bar press buttons

- `tny-press` class: 4px bottom border. On `:active`, border drops to 2px and `margin-bottom: 2px` so the button "settles". 80ms transition.
- Use on primary CTAs and main toolbar buttons. Don't use on text links or ghost buttons.

### Chart hover/focus

- Multi-line: focused x-position shows a vertical dashed slate rule + dots on every series + a dark tooltip with all series values, primary value bold
- Single line: peaks may be statically annotated with a dot + value label
- Target threshold: always a dashed Amber line with an end-anchored "TARGET ≤ X.XX" mono label

### View toggle (Graph / Table / Cards) — see `map-21-trend.jsx`

- Three-option segmented control, h-8
- Each option has an icon + label
- Active option: `#0a0e13` bg + white text + Amber-tinted icon

### Tweaks panel

The bottom-right floating Tweaks panel is a dev affordance and persists state via `__edit_mode_set_keys` in the prototype harness. In production you can:
- Drop it entirely
- Keep just the 12-col grid overlay as an internal-only `?grid=1` query-param debug mode

---

## State Management

Most of the prototypes are intentionally stateless or use simple `useState`. In production:

- **Geography scope** (MAP-21 trend page) — global page state. Should be a URL query param `?geo=state` or `?geo=county:001,003` so it survives reloads and is shareable.
- **Year / year-range** — same: URL param
- **View toggle** (Graph / Table / Cards) — local per-section state is fine; could also be URL param
- **Sidebar collapsed state** — localStorage
- **User session** — your auth provider (NY.gov ID — OIDC)

---

## Routing

Implied routes from the page set:

```
/                          → landing
/login                     → sign-in
/getting-started           → NPMRDS getting started
/npmrds                    → NPMRDS dashboard
/npmrds/floating-car       → 50p speed report (region-scoped)
/npmrds/congestion         → congestion report
/npmrds/work-zones         → work-zone report
/npmrds/map-21             → MAP-21 PM3 per-year view
/npmrds/map-21/trend       → MAP-21 PM3 multi-year (overall) view
/docs                      → documentation index
/design                    → design system home (optional, only if shipping internal-docs site)
/design/theme              → tokens
/design/grid               → grid
/design/components         → component catalog
/design/patterns           → page archetypes
```

---

## Assets

Bundled in this handoff:

| File | Use |
|---|---|
| `assets/nys_logo_white.svg` | Sidebar lockup (dark bg) |
| `assets/nys_logo_blue.svg` | Light marks |
| `assets/logo-transportny.svg` | Wordmark (if exists) |
| `assets/nys-shield-placeholder.svg` | Placeholder NYS shield |
| `assets/transportny_header_background.jpg` | Landing page hero bg (if used) |
| `fonts/Oswald-Variable.woff2` | Headline face |
| `fonts/SourceSans3-Variable.woff2` | Body face (Proxima Nova substitute — open source) |

If you have access to the licensed Proxima Nova family, swap `SourceSans3-Variable.woff2` for `ProximaNova-Variable.woff2` and update `_shared.css` accordingly. Source Sans 3 has very similar metrics so the design holds either way.

---

## Files in this bundle

```
pages/
  _shared.css          — surface tokens (.tny-pane, .tny-card, .tny-card-tint, .tny-card-bone, .tny-mono, etc.)
  _icons.jsx           — icon set (alternate copy, in sync with ui_kits/transportny/icons.jsx)
  _chrome.jsx          — TNYSidebar, TNYPageHeader, TNYBreadcrumb, TNYFilterBar, TNYTopBlue, TNYPillBar, TNYFooter, TNYCard
  _cards.jsx           — Card primitives + composed KPI cards
  tweaks-panel.jsx     — Optional dev tweaks panel (drop in production)

  theme.html           — color, type, surface, elevation tokens
  grid-system.html     — container, columns, vertical rhythm, surfaces (the cards-on-pane rule), composition
  grid-system.jsx
  components.html      — full component catalog
  patterns.html        — page archetypes

  landing.html         — public marketing
  landing-app.jsx
  landing-parts.jsx
  login.html           — sign-in
  getting-started.html — NPMRDS landing
  docs-overview.html   — docs index
  map-21.html          — MAP-21 PM3 per-year deep-dive
  map-21.jsx
  map-21-trend.html    — MAP-21 PM3 multi-year trend
  map-21-trend.jsx
  floating-car.html
  congestion.html
  work-zones.html

ui_kits/
  transportny/icons.jsx

assets/
  nys_logo_white.svg
  nys_logo_blue.svg
  logo-transportny.svg
  nys-shield-placeholder.svg
  transportny_header_background.jpg

fonts/
  Oswald-Variable.woff2
  SourceSans3-Variable.woff2
```

To run the prototypes locally before porting, serve the folder over any static HTTP server (`python -m http.server` from the bundle root) and open `pages/grid-system.html` to start.
