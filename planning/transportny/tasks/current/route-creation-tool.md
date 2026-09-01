# Route creation tool — current status

**Project:** TransportNY

Route Creation is the tool that feeds `Route`s (named, saved collections of TMCs) into the NPMRDS
Reports feature. This file is a short orientation pointer, not a new history — the arc has two
substantial existing documents that stay authoritative:

- [`research/route-creation/findings.md`](../../../../research/route-creation/findings.md) — the full
  investigative trail (Parts 1-8): the map-properties root cause, the old-tool feature-gap
  inventory, the auto-routing endpoint investigation, architecture decisions, and later bug triage.
  Long, but already well-organized and self-correcting in place — read it directly rather than
  expecting a summary here to substitute.
- `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` (the `dms`
  submodule) — the marker-placement/auto-routing feature's phased plan and decisions. Its own
  top-of-file status note (added 2026-07-30) explains how it relates to the port below.

## Where the code lives

As of 2026-07-29, `routecreation` and `macroview` (a second map plugin, geography-level PM3
choropleth viewer) were **ported natively into dms-template** —
[`planning/transportny/tasks/completed/port-transportny-map-plugins.md`](../completed/port-transportny-map-plugins.md).
dms-template's own dev server (`src/themes/transportny/components/{routecreation,macroview}/`) is
where both are now developed and tested. transportNY still has its original copies (that's where
all the research and early feature work below happened), but they are no longer the develop/test
target — this file does not track whether transportNY's copies still match.

## Current status by phase

| Phase | What | Status |
|---|---|---|
| Map-properties bug (findings.md Part 1) | Map clicks returned empty `.properties`, so no TMC could ever be selected | **FIXED**, plugin-local `data-column: 'tmc'` fix, carried into the dms-template port |
| Marker placement / auto-routing Phase 1 (dms-server proxy) | Wrap the external `routing2.availabs.org` map-matching service behind a swappable dms-server module | **NOT STARTED** — the plugin still uses a temporary direct client call (`hooks/resolveRoute.js`), by design, swappable later |
| Marker placement Phase 2 (marker UI) | Drop/drag markers, auto-resolve to a TMC path, gradient-by-sequence coloring | **DONE**, live-verified, carried into the dms-template port |
| Marker placement Phase 3 (year selector) | Pick a network vintage, swapping both the routing call's year param and the visible shapefile layer | **NOT STARTED** — blocked on re-verifying the actually-routable year range (see below) |
| Save/load `points` persistence | Reloading a marker-made route back into editable markers (not just a flat TMC list) | **NOT DONE** — a marker-made route saves/reloads as a flat TMC list today |
| Search-to-add TMC + route_id update/overwrite labeling | Type a TMC and add it without clicking the map; clear "Update" vs "Save" labeling when editing an existing route via URL | **DONE** (built 2026-07-27 in transportNY, carried into the dms-template port) |
| macroview Data Downloader (GIS export) | Needs a `MapEditorContext.DAMA_HOST` equivalent that doesn't exist upstream yet | **NOT DONE**, falls back to a published-page-only context field |

## Known, closed loose ends (corrects stale claims found elsewhere)

- **The "Routes Data" table fetchMode gap is CLOSED**, not open — a prior memory index entry
  described it as unfixed; it was fixed and verified 2026-07-24 (both the live page and its
  page/section templates got `display.fetchMode: "force"` + an `updated_at` sort column). See
  findings.md Part 7 for the full trace.
- **A stale-sidebar-mileage bug in `useRouteData.js`** (cleared TMCs left the old mileage list
  showing) was found and fixed 2026-07-24 in transportNY, before the port — confirmed present in
  dms-template's ported copy today (the `else { setTmcData([]) }` branch exists).

## Open items worth flagging before picking this arc back up

- **Untested surface carried over from the port itself, flagged here 2026-08-18 since nothing
  pointed at it before**: `port-transportny-map-plugins.md`'s own testing checklist left two things
  unverified that this file's phase table doesn't separately call out — routecreation's marker/
  auto-route mode and its save/load-a-route path (`apiUpdate`/`INTERNAL_ROUTES_*`, distinct from the
  "Save/load `points` persistence" row above, which is about a confirmed *design* limitation, not a
  testing gap), and macroview's MapEditor-side `internalPanel` authoring controls (only the
  published-page render path has been verified). Neither is known-broken, just genuinely unverified.
- **The routing service's actually-usable year range is unconfirmed beyond one test location.**
  A DB-metadata-based claim that years 2016-2026 all work was directly tested and found **wrong** —
  only 2020-2022 resolved for a real corridor near Albany; every other tested year (2016, 2018,
  2023-2026) returned no match. Phase 3's year selector can't be designed around the full
  2016-2026 range until this is checked against more locations.
- **Phase 1 (the dms-server proxy) is the next real blocker** before the temporary direct
  `routing2.availabs.org` client call can be retired.
- **CSV bulk import, a folder field in save/move, and a full permissions model** were all
  deliberately deferred (not gaps to close opportunistically) — see findings.md Part 4 for why.

## Implementation plan — theme/component build (scoped 2026-09-01, items 0-4 + theme refactor BUILT + live-verified 2026-09-01; item 5 freshness panel not started)

This is the build Workstream E of
[`routes-reports-users-mesh.md`](./routes-reports-users-mesh.md) refers to as "the real remaining
size of Workstream E" — turning the live mockup
(`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-route-creation.html`,
re-verified against live plugin source 2026-09-01, see that file's own header + its § 04
built/specified/deferred/blocked table) into real `routecreation/` plugin code. Scoping only —
no code written yet. Follows the same shape MacroView's own polish pass took (`2ecd3cb` bare port →
`af05609`/`1ec53e3`/`8878dc2` progressively adding `macroview.theme.js` + themed panel
subcomponents) — read that precedent (`macroview.theme.js`, `contextPanel.jsx`,
`controlsPanel.jsx`, `mapChrome.jsx`) before building; the pattern (a plugin-local `<plugin>.theme.js`
class map, consumed via `getComponentTheme(themeFromContext, '<plugin>')` and composed with
`damaMapTheme.layerLibrary`'s panel shell, inside small presentational panel components that take
all their data as props from `comp.jsx`) is what this plan reuses, not a new pattern.

### In scope this pass — the mockup's four "specified" items + one "easy fix" gap

All five are pure client-side plugin/theme work — no server, no schema, no `dms` library change.

**0. Compact icon-rail sidenav (config-only, do first, ~5 min).** Confirmed live 2026-09-01:
`/route_creation` renders the full labelled sidebar, not the 64px icon rail every other shipped
NPMRDS page uses. The mechanism is already known and previously used — round 81 of
`src/dms/planning/tasks/current/old-reports-conversion-archive.md` (see "Third finding, same
round") found the SAME gap on report pages and fixed it as a **per-page DB field**, not a
component change: `item.theme.layout.options.sideNav.activeStyle`. That round patched 22 pages via
`dms raw update <id> --set theme.layout.options.sideNav.activeStyle=1`. Before repeating that
verbatim on the route-creation page: **re-confirm the correct value for this page**, don't assume
`1` — round 81's pages render through `themev2.js`, whose OWN `layout.options.sideNav.activeStyle`
default is `0` for the compact style (`themev2.js:297`), the opposite mapping. Map-plugin pages
(`routecreation`/`macroview`) may resolve through the older `theme.js` instead (it defines several
`activeStyle: 0` sidenav-style blocks too) or through a different code path entirely — check which
theme file actually renders `/route_creation` and what value a known-good compact page (e.g.
`single_route`, or `/macro`) carries for this exact field on ITS OWN page row before writing
anything. Read-only checks first (`dms page show <route_creation page id>` /
`dms raw get npmrdsv5 <macroview or single_route's actual page type>|page <id>`), then one `--set`
call once the right value is confirmed.

**1. Brand paint — network grey / route blue / highlight amber (replaces the LOTTR-red collision).**
   - `paint.js`: base `line-color` `'#ccc'` → `'#C4CBD4'` (the mockup's network grey; width/offset/
     hover-opacity ramps untouched, per the mockup's own note).
   - `constants.js`: add the two brand color constants used both here and in the map's Mapbox-style
     paint expression AND in Tailwind arbitrary-value classNames (`ROUTE_COLOR = '#1F3F8F'`,
     `HIGHLIGHT_COLOR = '#CA8A04'`) — single source of truth even though a Tailwind class string
     can't literally reference a JS import; keep both in sync by comment, the pattern
     `translating-design-system-to-dms-theme.md` already uses for this exact problem.
   - `dataUpdate.jsx`: the current two-state `match` (`tmc_array` → red `#FF0000`, else grey)
     becomes a three-state `case` expression so the highlighted TMC always wins regardless of
     whether it's also in the route: `["case", ["==", ["get","tmc"], hoveredTmc || ""],
     HIGHLIGHT_COLOR, ["match", ["get","tmc"], tmc_array, ROUTE_COLOR, NETWORK_COLOR]]`. Needs
     `hoveredTmc` — see item 2.

**2. Row ↔ segment two-way highlight (net-new interaction, build this before items 3/4 since it's
   the only genuinely new state/wiring; the rest is additive UI).**
   - New state: `hoveredTmc`. Store it the SAME way `tmc_array` already round-trips through the
     plugin (`${pluginDataPath}['hovered_tmc']` inside `state`/`setState`) rather than inventing a
     new context — `dataUpdate.jsx` only ever receives `(map, state, setState)` from the plugin
     framework, so anything item 1's paint expression needs to read has to live in `state`, not a
     sibling React context.
   - New hook `hooks/useMapHoverHandler.js`, structurally parallel to the existing
     `useMapTmcHandler.js`: a `mousemove` listener does `queryRenderedFeatures` against the
     shapefile layer (same call `useMapTmcHandler`'s click handler already makes) and writes
     `hovered_tmc` when the feature under the cursor changes; a `mouseleave` (or "no feature under
     cursor") clears it. Bind/unbind mirrors the existing click-handler effect's cleanup exactly.
   - `comp.jsx`: wire the new hook alongside the existing `useMapTmcHandler`/`useMapMarkerHandler`
     calls; read `hovered_tmc` back out of `state` next to the existing `tmc_array`/`view_id`
     `useMemo`; pass both the value and a row-hover setter down to `RouteEditor`.
   - `RouteEditor.jsx`: each TMC row gets `onMouseEnter`/`onMouseLeave` writing the same
     `hovered_tmc` path (so hovering a ROW lights the segment, not just the reverse), plus the
     amber-left-border/tinted-background treatment on the row matching `hoveredTmc === tmc`
     (mockup: `bg-amber-50 border-l-2 border-[#CA8A04]`).

**3. Route identity panel (Panel 1, top-left) — net-new component,
   `components/RouteIdentityPanel.jsx`.** Pure presentational, all data already resolved in
   `comp.jsx` today: `modalState.name`/`.description`/`.tags`, `tmc_array.length`, total miles
   (already computed in `RouteEditor` from `tmcData` — hoist or duplicate the one-line reduce),
   `routeIdFilterValue` (both the numeric id to display and whether to show the "editing" pill),
   network vintage (`DEFAULT_ROUTING_YEAR` from `constants.js`, rendered as the static "pinned"
   chip the mockup specifies — NOT a select, per the still-open Phase 3 blocker). The mockup's "All
   routes" back-link (`npmrds-reports.html#routes` in the static design system) resolves live to
   `/converted_reports#routes` — the real homepage's Routes anchor, the same target the "New
   Route"/"Build a route" buttons were just repointed to (this file's own Progress log, 2026-09-01).

**4. Mode hint pill (Panel 4, docked bottom-center) — net-new component,
   `components/ModeHintPill.jsx`.** Reads `creationMode` (already in `comp.jsx`) and renders one of
   two copy strings (TMC-click: "Click a segment to add or remove it"; Markers: needs real copy
   matching the old tool's InfoBox text — check `RouteCreationInfoBox.jsx` in transportNY's
   original source per this file's own "vet the serving codebase" convention, don't invent new
   copy), plus the shared "switching mode clears the selection" caveat both modes carry (confirmed
   real: `comp.jsx`'s `setCreationMode` unconditionally clears both `tmc_array` and markers on
   every mode switch).

**5. Freshness panel (Panel 3, bottom-left) — resolve an open question before building, lower
   priority than 1-4.** MacroView's own freshness bar (`mapChrome.jsx`) reads a VIEW's real
   `metadata.dates`, not a hardcoded string — Report pages' freshness strip
   (`ReportPageHeader.jsx`) is the opposite, an author-typed free-text field, which doesn't fit a
   single shared workbench page with no per-instance author. Before building: find whether the raw
   NPMRDS speeds table/view (not PM3) carries the same kind of real `metadata.dates` macroview
   reads, and reuse that mechanism if so; if not, a periodically-updated static string (matching the
   mockup's exact copy: "npmrds speeds · complete through jun 2026 · jul 2026 partial · since jan
   2017 · network 2022") is the honest fallback — flag it as static in a code comment either way, per
   this codebase's "never draw chrome that isn't real" convention (`designing-a-dms-design-system.md`).

### Theme-file refactor (do last, wraps the above into the codebase's established pattern)

- New `routecreation.theme.js` (plugin-scoped Tailwind class map, same shape as
  `macroview.theme.js`): panel positioning, the row/hover/pill/chip classNames the new components
  above need, consumed via `getComponentTheme(themeFromContext, 'routecreation')` merged with
  `damaMapTheme.layerLibrary`'s panel shell (`panel`/`panelInner`/`header`/`headerTitle`/
  `headerCount`/`body`) — the SAME shell macroview's panels already consume, so Panel 1/2's
  rounded-lg/h-10-header/white-95 chrome comes from composition, not restated CSS.
- `RouteEditor.jsx` currently has zero theme-file involvement — every className is inline Tailwind
  written directly in the JSX (only `UI.Button` is theme-driven, via the generic `ThemeContext`).
  Refold it onto `routecreationTheme` + the `damaMap.layerLibrary` shell as part of this pass, not a
  follow-up — building two brand-new panels (3, 4 above) against the theme file while the third
  existing panel stays hand-rolled Tailwind would immediately fork the pattern.
- Read `src/dms/skills/translating-design-system-to-dms-theme.md`'s "nine gotchas" section before
  writing the theme file, in particular #6 (no literal space in a Tailwind arbitrary value —
  n/a here, no custom font) and #9 (leading-zero opacity like `/05` compiles under the mockup's
  Tailwind Play CDN but emits nothing in the real v4 build — the mockup uses `/05`/`/08`/`/10` a lot,
  e.g. `border-zinc-950/05`; every one of those needs `/5`/`/8`/`/10` in the real theme file).

### Explicitly NOT in this pass (already decided, don't re-litigate)

- **Network-vintage year selector** — blocked on Phase 3's re-verification of which years the
  routing service actually matches (only 2020-2022 confirmed in a live test). The chip stays
  static/pinned.
- **Waypoint (`points`) persistence** — an open design limitation (marker routes round-trip as flat
  TMC lists), not a bug; reopening it is a real, separate, larger task (new save-payload field +
  reload-into-marker-mode logic), not a theme/paint change.
- **Routing behind a server proxy (Phase 1)** — cross-cutting (`dms-server`), tracked in
  `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md`, not this file's
  scope.
- **Folder field, start/end dates in Save, CSV bulk import, a permissions model** — all deliberately
  deferred per standing decisions (see findings.md Part 4 and the mockup's own § 04 table); not
  reopened by this pass.

### Suggested build order

1. Item 0 (sidenav config fix) — independent, do it standalone first.
2. Items 1+2 together (paint + hover state) — the only genuinely new interaction wiring; verify live
   before layering more UI on top.
3. Items 3+4 (identity panel, mode hint pill) — additive, no interaction with existing behavior.
4. Theme-file refactor — fold 1-4 plus the pre-existing `RouteEditor.jsx` onto
   `routecreation.theme.js` + the `damaMap.layerLibrary` shell in one pass.
5. Item 5 (freshness panel) — resolve the data-source question, then build; lowest priority of the
   five.

Each step needs a live claude-in-chrome pass on `/route_creation` (per this file's own "untested
surface" flags above — marker mode and the save/load path were never verified after the port) before
moving to the next, not one verification pass at the very end.

### Status: items 0-4 + theme refactor BUILT + live-verified 2026-09-01 (item 5 not started)

**Item 0 (sidenav)**: confirmed live (not assumed) that both `converted_reports/single_route`
(2213465) and `/macro` (2214566) already carry `theme.layout.options.sideNav.activeStyle: 1` for
the compact rail — the same value round 81 used, so no theme-file-resolution surprise. Applied via
`dms page update 2216258 --set theme.layout.options.sideNav.activeStyle=1`; re-queried, only
`theme` changed. Live-verified: `/route_creation` now renders the 64px icon rail.

**Items 1-2 (paint + hover)**: `constants.js` gained `NETWORK_COLOR`/`ROUTE_COLOR`/
`HIGHLIGHT_COLOR`; `paint.js`'s base network color is now `NETWORK_COLOR`; `dataUpdate.jsx`'s
two-state `match` is now a three-state `case` (highlighted wins over in-route). New
`hooks/useMapHoverHandler.js` (mousemove + queryRenderedFeatures, mirrors `useMapTmcHandler`'s
click handler; mouseout as a backstop) writes `hovered_tmc` into the SAME `state`/`setState` plugin
data path `tmc_array` already uses — `dataUpdate.jsx` reads it back out. `comp.jsx` wires the hook
and passes `hoveredTmc`/`setHoveredTmc` to `RouteEditor`; each TMC row gets
`onMouseEnter`/`onMouseLeave`.

**Items 3-4 (identity panel + mode hint pill)**: new `components/RouteIdentityPanel.jsx` (name/
tags/tmc count/miles/editing badge/pinned network-vintage chip/"All routes" link to
`/converted_reports#routes` — the live equivalent of the mockup's `npmrds-reports.html#routes`)
and `components/ModeHintPill.jsx` (copy taken verbatim from the OLD tool's
`RouteCreationInfoBox.jsx` — "Click TMCs to define a route." / "Click map to place markers to
define a route." — not invented). `totalMiles` hoisted from `RouteEditor` into `comp.jsx` so both
panels share one calculation instead of two independently-drifting reduces.

**Theme refactor**: new `routecreation.theme.js` (same shape as `macroview.theme.js`), consumed via
`getComponentTheme(themeFromContext, 'routecreation')` composed with `damaMapTheme.layerLibrary`'s
panel shell (`panel`/`panelInner`/`header`/`headerTitle`/`headerCount`/`body`) — same composition
macroview's `contextPanel.jsx`/`controlsPanel.jsx` use. `RouteEditor.jsx` fully refolded off inline
Tailwind onto theme tokens (kept its own bespoke `editorWrapper` position/width per the mockup's own
note, rather than the shared panel's generic `p-4` positioning); both new panels built against the
same theme file from the start, each owning its own `${t.posTopLeft} ${mapT.panel}` /
`${t.posBottomCenter}` positioning wrapper, matching macroview's `controlsPanel.jsx` pattern exactly.

**Live-verified** (claude-in-chrome, authenticated dev session, `npm run dev` local server): all
three panels render and match the mockup closely (icon+title+count header, segmented TMC
Click/Markers control, TMC search, TMC list, Save/Update footer; Route panel's name/meta/tag
chips/vintage chip/back-link; the docked hint pill). Clicking a map segment added a real TMC
(`104+11381`, "NORTHERN BLVD", 2.212 mi) — count badge, TMC list row, and identity panel's
`1 tmc · 2.21 mi` all updated correctly. Hovering that list row lit it amber
(`bg-amber-50`/`border-l-[#CA8A04]`), proving the `hoveredTmc` round-trip through `state`/`setState`
actually fires (the map-hover-to-row-highlight direction uses the identical
`queryRenderedFeatures`-against-`shapefileLayerId` mechanism the already-proven click handler uses,
so it was not independently pixel-verified against the map canvas itself — a real, not just
theoretical, follow-up if ever in doubt). Toggling to Markers mode correctly cleared the TMC
selection (count 1→0), swapped the segmented control's active state, updated the hint pill's copy,
and hid the TMC-click-only search box; dropping a marker in Markers mode still worked
(`Markers: 1`), confirming the new hover hook doesn't interfere with existing marker-mode click
handling. Zero console errors across the entire session. The auto-tag-at-creation chips
(`user:993`/`agency:NYSDOT`/`agency:AVAIL`, Workstream D) rendered correctly inside the new identity
panel as a side effect of using real `modalState.tags`. Nothing was saved (no route ID created) —
this was an unsaved new-route session, not a live-data write.

**Not done**: item 5 (freshness panel) — the data-source question (real `metadata.dates` vs. a
periodic static string) is still open, per the plan above. The network-vintage year selector,
waypoint persistence, and the server-side routing proxy remain out of scope per the standing
decisions.

**Files**: `constants.js`, `paint.js`, `dataUpdate.jsx`, `comp.jsx`, `components/RouteEditor.jsx`,
new `components/RouteIdentityPanel.jsx`, new `components/ModeHintPill.jsx`, new
`hooks/useMapHoverHandler.js`, new `routecreation.theme.js` — all under
`src/themes/transportny/components/routecreation/`.

## Cross-references

- `research/route-creation/findings.md` — full investigative trail
- `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` — marker-placement phased plan
- `planning/transportny/tasks/completed/port-transportny-map-plugins.md` — the port itself, including full macroview crash root-cause detail
- `src/dms/planning/tasks/completed/map-plugins-theme-registration.md` — the generic `theme.mapPlugins` registration mechanism the port relies on
- `src/dms/planning/research/map-stack-architecture.md` — background on the mapeditor/map/map_dama split
