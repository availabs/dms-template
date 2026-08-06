# NPMRDS Design System v2 → report page & report library implementation

**Project:** TransportNY · **Topic:** themes · **Status:** SCOPED, plan confirmed for **the single report page** (`npmrds-report.html`, build now) and **the report library** (`npmrds-reports.html`, Ryan's eventually — Alex's design is ~90% done). Ryan's active/eventual scope, narrowed 2026-08-06. This is the top-priority reports/routes item, superseding `dynamic-reports-and-route-tags.md`. The other 4 surfaces in the design set (`npmrds-home.html`, `npmrds-macro.html`, `route-comparison.html`, the MAP-21 family) are **Alex's purview for now** (status unknown to Ryan) — kept below as reference research only, not part of the active plan. · **Started:** 2026-08-06

## Objective

Bring two pages of Alex's redesign onto the real, already-built (or, for the library, not-yet-built) surfaces:
1. `npmrds-report.html` + `npmrds-report.js` — the individual report canvas — onto `ReportRouteList`/`RouteRow`/`RouteTagBrowserModal`/`AddGraphModal`, plus a new second custom component (a report page header). **Active now.**
2. `npmrds-reports.html` — the report library — a net-new page with no live equivalent, reversing a prior "permanently out of scope" ruling. **Ryan's eventually, blocked on Alex finishing the design** (per Ryan, 2026-08-06: "~90% done").

Both are genuine second-pass UX work — not reskins — built, per Ryan (2026-08-06), with the current live implementation in mind.

**Scope note (Ryan, 2026-08-06, in two messages):** *"I am focused only on the reports page / single report page. The map-21 stuff, other design files, I am not sure the status of. Those fall under Alex's purview for now."* Then, clarifying further: *"reports lib I think is mine eventually, Alex is only like 90% done with that design. But yeah, the map21, macroview, all that is Alex for now."* Net effect: the report canvas and the report library are both Ryan's (this doc), at different points of readiness; `npmrds-home.html`, `npmrds-macro.html`, `route-comparison.html`, and the MAP-21 family stay with Alex. Those four were already researched in this doc's first pass (2026-08-06, before this narrowing) and are kept at the bottom under "Reference: the rest of the design set" so that work isn't lost — but none of it is part of the active plan, decisions, or phasing below.

## Sources

- Design: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-report.html` + `npmrds-report.js` (the one interactive mockup in the set), plus `theme/theme.js` for the shared token/style additions it needs. Parent folder's `README.md` documents the cross-page contract this page still has to honor (nav, freshness strip, container width) even though the other pages aren't Ryan's concern right now.
- Critique: `research/npmrds-category-design/critique-round-1.md` (2026-07-29) — the must-fix items that named `npmrds-report.html` specifically (1600px→1480px container, compound-card gap, inert sticky rail) are still relevant; its Phase 8b tightening pass (same day) applied most of them, but wasn't re-verified against the current file in this pass since the report-canvas page itself went through a *later* redesign (Phases 9-14, 2026-08-05).
- **Missing:** `planning/transportny/tasks/current/npmrds-category-design-set.md` — referenced 3× as the authoritative task file (real cross-page contract, an Escalations table, verified numbers, Design notes, Phase 6/8 history). Confirmed absent from the whole repo. Ryan is asking Alex directly (Decision 0 below) — it likely has report-canvas-specific decision history too, not just cross-page material.
- Live components: `src/themes/transportny/components/{ReportRouteList,RouteTagBrowserModal,AddGraphModal,MeasurePicker}/`
- Related in-flight task files: [`dynamic-reports-and-route-tags.md`](./dynamic-reports-and-route-tags.md) (built RRL/modals through 2026-08-05, explicitly anticipated this design work arriving "later"), [`report-page-redesign.md`](./report-page-redesign.md) (gaps 01-03, card visual/density polish — continuous with this doc's graph-card-contract items), [`reportroutelist.md`](./reportroutelist.md), [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md) (its "permanently out of scope" ruling on report discovery was amended 2026-08-06 — see the reference section below, not relevant to the active plan here).

---

## The single report page — active scope

`npmrds-report.html`/`.js` is a genuine second-pass redesign (Phases 9-14, all dated 2026-08-05) of `ReportRouteList` / `RouteRow` / `RouteTagBrowserModal` / `AddGraphModal` — real UX changes, not a reskin. The mockup is itself a transcription of a real live page (`npmrds_sub` pattern, page `2195810`, "NY-9D Beacon Signal Study"), stress-tested with extra cards borrowed from two other real reports.

### Layout
- Rail becomes a **fixed 340px flex sibling** of the canvas column (not a grid column — `col-span-3`/`col-span-9` was explicitly rejected in the mockup's own comments), `sticky top-0 h-svh`, no padding, full tab height. Theme key `pages.sectionGroup` needs a second named style ("flush") beyond the current single 302px style. **Decision 2 (below): use the design's named-style approach** — Ryan's own stashed core change (`sidebarGroup.width` on `sectionGroup.jsx`, prototyped the same day, 2026-08-05) is not being merged.
- No breadcrumb band on this page (deliberate — makes the rail's `sticky top-0 h-svh` math exact; a breadcrumb strip would need to offset both `top` and height).
- Page header is **not** a full-bleed band — it's a card-styled section inside the content column: kicker+meta (region/county/agency, a "published" pill) → h1+purpose → an action stack (Data/Share/Print/Edit) → a full-width freshness footline. Dynamic enough (edit-mode-aware action, multi-sibling-field kicker meta, a computed freshness line) to justify a **second custom component**, per Ryan relaying Alex's suggestion (2026-08-06). Proposed name: `ReportPageHeader` (exact name TBD), alongside `ReportRouteList` as this page's two custom components.
- Compact 64px SideNav on this page (340px rail + 256px expanded nav would starve the canvas).
- Container width: `max-w-[1480px]` (an earlier draft used 1600px — a critique must-fix normalized it back to the catalogue's standard 1480; port 1480).
- Graph-card contract (header shape, legend-below-plot not floating, one-line attribution, size-4 tick/legend collapse) is real polish work, continuous with `report-page-redesign.md`'s existing gap 03 (card visual/density polish) — track as a continuation there, not duplicated here.

### Route rail — per-route controls (`RouteRow.jsx`)

| Item | Live today | Design wants | Gap size |
|---|---|---|---|
| Row disclosures | 4 independent `useState`s (dates/deps/color/menu) + row expand | Same shape, restructured chrome | small |
| Kebab menu | "⋮" menu, 2 items (Rename, Remove) | No kebab — same 2 actions (pencil+trash) always visible inline | trivial |
| Color control | Inline: expand row → click "Appearance" → `ColorPicker` mounts inline in the open-out | Popover anchored directly on the row's color dot, portalled (the rail's scroll region is `overflow-hidden`, needs a portal like the shared `Popup` primitive) | small-medium (new portal pattern for this control) |
| Date/time editing | 2-field framing ("Start date+time / End date+time") in the UI, even though internally already 3 facets (day-range loop + weekday mask + epoch range) | Explicit 3-facet UI: **Dates** (live "N of M days" count + **shift ±1yr** pills) → **Days** (weekday mask + Weekdays/Weekends/All — already live) → **Time of day** (5 presets, hours printed on the pill — already live) | UI restructure surfacing the real mental model; **shift ±1yr is net-new** (today only reachable indirectly via Derived-mode's period options, never for a route's own fixed dates) |
| Copy/paste window | **absent** — grepped, no hits anywhere | Per-row copy icon + paste icon (disabled until a copy exists) + a rail-top "paste into all (N)" strip; derived-date routes always skipped | **net-new feature**, moderate build |
| "Base for N routes" | Live: `dependentsRow`, a standing one-liner + pill list (`RouteRow.jsx:481-493`) | **Not drawn anywhere in the mockup** (its only worked example is a 1:1 derive relationship) | Confirm with Alex this wasn't meant to be dropped — likely an under-tested example, not a real removal ask |
| Derived-date mode | `Switch` + `relativeDatePresets.js` (Offset/Same-period/Advanced) | Same mechanism, single-hop only (already enforced live) | matches |

### Add Route modal (`RouteTagBrowserModal`)
- Live: search+recent list, then 5 **equal-weight** category tiles (County/Region/Agency/Auto-generated/Other tags); result rows show name + TMC count only, no tags.
- Design: same search-first shape, but only **3** tag axes as header pills (County/Region/Agency), with Auto-generated/Other-tags demoted to plain text links; every result row shows its tags inline as chips ("name + TMC count can't separate 'NY-9D NB (Beacon)' from 'NY-9D NB · Main St to Verplanck'").
- Gap: small restructure (5 tiles → 3 pills + 2 links) + inline tag chips on result rows (currently absent). The already-added-routes-hidden-only-in-the-unscoped-recent-list nuance **already matches live** (fixed 2026-07-31, same rule the design states).

### Add Graph modal (`AddGraphModal`)
- Live: exactly **3** graph-type options (Bar/Line/Grid), all producing an "AVL Graph" chart section only — `useAddGraphSection.js:7` hardcodes the element type, confirmed no Spreadsheet/Map branch exists anywhere in this modal. Flat 9-item measure select (no grouping). 3 inline SVG glyphs already exist (`BarGraphGlyph`/`LineGraphGlyph`/`GridGraphGlyph`).
- Design: **5** shape cards — adds **Table → Spreadsheet section** and **Map → Route Map section** — plus a grouped measure `<optgroup>` (Speed/Travel time/Delay/Emissions), default pick changed to Line·TravelTime·Hour (from Bar·speed·5min), picks persisting across repeated modal opens.
- Gap: **the single largest net-new-capability item in this plan.** `composeMeasureConfig`'s compose-a-fresh-section-from-a-pick mechanism is chart(AVL-Graph)-specific; the Table/Map cards need a fresh `Spreadsheet` defaultState and a fresh `Map` defaultState composed the same principled way — no existing analog to reuse verbatim the way the chart path had. Everything else (grouping, default pick, persistence-across-opens) is small config-level work.
- Note: a **second, older** measure-editing surface still exists for already-created graphs (an amber edit-bar "measure" button opening 4 flat `<select>`s via `toggleMeasurePicker`, sharing one global `measurePick` state rather than per-card). A separate, smaller pre-existing inconsistency the mockup doesn't address — flagged, not scoped for this pass unless it blocks something.

### Constraints any redesign must respect (from `ReportRouteList/README.md`, all still binding)
- RRL never writes into a graph section's row (read-only discovery via `findSelfBoundGraphs`)
- key graph/route identity by `trackingId`, not `id` (the orphan-cleanup race fix, 2026-08-03)
- never set the generic `hideInView` flag on this component — it self-hides via its own `if (!isEdit) return routeSelectionModal`
- two edit-gates required (`editPageMode` AND the section's own `isEdit`), not either alone
- route content lives in the report's own `reports_snap_2` row — no Publish/Discard semantics, ever
- route names must stay unique (comparison-series' sole series discriminator)
- derived dates are single-hop only (a derived route can't itself be a base)

---

## The report library — active scope, blocked on Alex's design

`npmrds-reports.html` is a "TEMPLATE SHELF" (12 real templates in 5 typed groups, each card a 4:5 SVG "preview plate" derived from the template's own `graph_comps[].layout`), "your reports" (3 real + empty state), "worked examples" (4 real converted pages), and a **real, working** search dialog (57-row live sample, `<mark>` highlighting, URL-bound query/facets, 3 working facets + 4 disabled-with-tooltip facets explaining exactly why each isn't wired). Per the critique's A/B ruling (already applied): this inline/URL-bound treatment shipped; a command-palette alternative was deleted and logged as an escalation, not built.

**Live:** does not exist. A reports-library/browsing page had been **explicitly out of scope, permanently** — `report-route-ui-parity-gaps.md`: *"Not in scope, permanently: folders, report discovery/browsing, permissions... per user direction 2026-07-27"* — reaffirmed 2026-07-31.

**Decided 2026-08-06:** reopened — this is Ryan's page eventually, not Alex's to build. *"we dont have one built yet but we will want one"*, then *"reports lib I think is mine eventually, Alex is only like 90% done with that design."* Amended in `report-route-ui-parity-gaps.md` and `dynamic-reports-and-route-tags.md` (permissions/ACL remains the one still-standing exclusion from the original ruling).

**Status: blocked on Alex's design reaching 100%.** Don't start building against `npmrds-reports.html` yet — check with Ryan/Alex on design completion first. When it's ready:
- Needs a real queryable index of report metadata (869 reports, with denormalized route chips per report per the critique's Honesty §5) as a data-shape prerequisite, not just UI work.
- Sequenced after the report-canvas work in the phased plan below, both because of that prerequisite and because the design isn't finished.

---

## Cross-cutting findings (scoped to the report page)

### A. Theme additions this page needs
- `pages.sectionGroup` needs a second named style ("flush", 340px, no padding, `sticky top-0 h-svh`) — both live theme files today have a single fixed-302px style, no style-selection mechanism at all. **Decision 2: add it directly to `theme.js`/`themev2.js`, don't use the stashed core mechanism.**
- Micro-type tokens the page's attribution lines/quick-control pills/kicker labels actually use, per the critique's must-fix #8: `chromeLabel` (10px/400 mono uppercase) and `chromeTick` (9px/400 mono) cover this page's 9/9.5/10/10.5px cluster; `chromeNav` (13px/500) covers the compact SideNav this page also uses. Declare-to-match, no page edits needed beyond declaring them.

### B. The missing `npmrds-category-design-set.md`
See Decision 0. May contain report-canvas-specific decisions beyond the cross-page contract — fold anything recovered back into this section.

### C. Two custom components in scope
1. **`ReportRouteList`** (exists) — restructure per the route rail diff table above; net-new sub-features (copy/paste window, color popover, Table/Map graph types).
2. **Report Header** (net-new, per Ryan 2026-08-06 relaying Alex's suggestion) — the page-header card described above. Justified as a real component (not pure Card config) per `src/themes/CLAUDE.md`'s bar: edit-mode-aware dynamic behavior, multiple-sibling-field reads, computed content a `formatFn` can't express.

---

## Decisions (Ryan, 2026-08-06)

**0. Missing task file — Ask Alex.** Ryan will ask Alex directly whether he has `npmrds-category-design-set.md` (his machine, a different branch). Not reconstructed here.

**Assessed 2026-08-06: not blocking for the report canvas, doesn't gate starting the phased plan.** Checked what the file actually held (via its 3 citations + how extensively `critique-round-1.md` quotes it): the cross-page contract is duplicated verbatim in `npmrds-home.html`'s header comment (already captured above); all 5 Escalations-table items are about `npmrds-macro.html`/`npmrds-reports.html`, none about the report canvas; the verified-numbers ledger covers aggregate stats the report canvas doesn't show; of the 7 Design notes only #1 (gap-6 compound-card bug) and #3 (type debt, generic) touch this page, and both are already quoted in full in the critique doc. The report canvas's *own* most recent redesign (Phases 9-14, 2026-08-05, a week after the critique) isn't in the missing file at all — it's self-documented directly in `npmrds-report.html`'s own comments (control inventory, design rules, "try this" walkthrough), already fully read. The one place recovery could still help is a provenance question (the "Base for N routes" mockup-omission, above) — better resolved by asking Alex directly than by finding the doc.

**1. Reports library — reopened, Ryan's eventually.** See "The report library" section above. Blocked on Alex finishing the design (~90% done as of 2026-08-06); don't start building yet.

**2. Rail-width mechanism — use the design's style only.** Add "flush" directly to `pages.sectionGroup` in the theme files. Ryan's stashed core `sectionGroup.jsx` change is not being merged — it's still sitting in a local git stash; worth a `git stash drop` (or `git stash list` to confirm which one) once Ryan's ready to let it go. Not done here since dropping a stash is a destructive, easily-lost action.

**4. Priority — yes, top priority.** The report-canvas + report-library work above supersedes `dynamic-reports-and-route-tags.md` as the top-priority reports/routes item (noted in that file and in `todo.md`).

*(3 — MAP-21 consolidation — was never actually asked, and is now moot for this doc: MAP-21 is Alex's purview, see the reference section below.)*

---

## Phased plan

1. **Rail-width mechanism** — add the "flush" named style to `pages.sectionGroup` in `theme.js`/`themev2.js`. Blocks the rail work below.
2. **Report Header component** — new, small-medium, independent of the RRL changes below.
3. **RRL restructure**, roughly in this sub-order:
   - a. Kebab → inline 2-icon (trivial)
   - b. Date/time 3-facet UI restructure (surfaces the existing mental model, no new data)
   - c. Color popover-on-dot (needs a portal pattern)
   - d. Add Route modal: 3-pill+2-link restructure + inline tag chips
   - e. Shift ±1yr control (small, net-new)
   - f. Copy/paste window (moderate, net-new)
   - g. Add Graph modal: Table/Map graph-type capability (largest single item — needs Spreadsheet/Map `composeMeasureConfig` analogs)
4. **Theme tokens** (`chromeLabel`/`chromeTick`, `chromeNav` if the compact SideNav needs it) — declare-to-match, can happen any time, doesn't block anything.
5. **Report library** (`npmrds-reports.html`) — **blocked**, don't start until Alex's design is finished (~90% as of 2026-08-06) and a real report-metadata index (data-shape prerequisite) is scoped. Re-scope this phase in detail once the design lands — the "report library" section above has what's known so far, but file-level implementation detail hasn't been worked out yet (unlike phases 1-4, which have).

## Files likely to require changes

**Report canvas (phases 1-4, ready to start):**
- `src/themes/transportny/theme.js`, `src/themes/transportny/themev2.js` — `pages.sectionGroup` flush style, token additions
- `src/themes/transportny/components/ReportRouteList/{RouteRow.jsx,ReportRouteList.jsx,ReportRouteList.theme.js,useReportRow.js,useGraphPublish.js}`
- `src/themes/transportny/components/RouteTagBrowserModal/{RouteTagBrowserModal.jsx,useTagBrowser.js,tagCategories.js}`
- `src/themes/transportny/components/AddGraphModal/{AddGraphModal.jsx,useAddGraphSection.js}`, `src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js` (or a sibling compose function for Spreadsheet/Map)
- New: a `ReportPageHeader`-style component directory under `src/themes/transportny/components/`

**Report library (phase 5, blocked):** TBD — needs the report-metadata index designed first; likely a new page + a new data source/view, not yet scoped at the file level.

**Not touched by this plan:** core `src/dms/packages/dms/src/.../sectionGroup.jsx`/`sectionGroup.theme.js` (Ryan's stashed change, not being merged — Decision 2); `macroview/`, `RouteComparison/`, `npmrds-home.html`, and MAP-21 (Alex's purview, see below).

## Next steps

Work phases 1-4 in order per `planning/planning-rules.md`'s update-as-you-go rule — update phase/section headers with status as each is started/finished. Check in on Alex's report-library design progress before starting phase 5. If Ryan hears back from Alex about the missing `npmrds-category-design-set.md` (Decision 0), fold anything recovered back into this file.

---

## Reference: the rest of the design set (Alex's purview, not part of this task's active scope)

This section preserves the research already done on the other 4 mockup surfaces (2026-08-06, before Ryan narrowed scope). Kept for continuity — e.g. if Alex needs a handoff, or if Ryan's scope changes later — but **none of this is being planned, decided, or built as part of this task.** (`npmrds-reports.html`, the report library, moved up into Ryan's active scope above — it isn't Alex's to build, just currently blocked on his design work.)

### `npmrds-home.html` — category landing/doorway page
Four product doorways (Macro View/Reports/Route Comparison/MAP-21), each a colored icon+CTA card with stats/links; a `data-spine` freshness row; a measure-vocabulary table reused on other pages; a PM3 stat-tile row; sticky in-page-nav + docs-index card. No live equivalent exists. Looked fully Card/lexical-composable, no custom component apparently needed.

### `npmrds-macro.html` — full-page map workbench
Floating-panel workbench (Controls/Measure Context/Map Chrome/Download), an 8-measure reference table, a value-distribution histogram, a download builder panel. Live: `src/themes/transportny/components/macroview/` — a real, working map plugin (ported 2026-07-29) with geography filtering, a measure definition panel, and a working Data Downloader modal already. Two real gaps: the value-distribution histogram has no live equivalent (small net-new viz); the download builder critique-flagged as missing is actually already resolved by macroview's own bespoke code (the one real remaining issue, `DAMA_HOST` unavailable in the editor context, is separately tracked in `route-creation-tool.md`). Two mockup elements are design mistakes per the critique (a viewer-facing "edit breaks" button; "shift-click to add to a route" on the hover popup) and shouldn't be built as drawn.

### `route-comparison.html` — mass route×period×metric comparison
Builder rail (Scope/Routes/Periods/Metrics) + a pivoted cross-tab + a trend chart; should share rail chrome with the report canvas's dark-header treatment per the critique. Live: `src/themes/transportny/components/RouteComparison/` — Scope + Routes steps are live and functional; Periods and Metrics are UI shells only (pre-existing `// TODO Task 3.4`/`3.5`); the cross-tab Spreadsheet is a separate, not-yet-built sibling section per the component's own README.

### MAP-21 family (`map-21.html`, `map-21-trend.html`, `map-21-lottr.html`, `map-21-system-performance.html`)
Four mockups with real content overlap — `map-21-system-performance.html` self-describes as absorbing the other two into one consolidated page, matching `MAP21_REPORTING_PLAN.md`'s own recommended architecture. The 4 pages disagree with each other on target values and target-line shape; `map-21-lottr.html` has its own self-flagged data-reconciliation gap. Live: a complete DMS-native MAP-21 PM3 page (draft id **2173915**, `npmrds2:map_21_system_performance`) was already built and closed 2026-06-03 (`src/dms/planning/tasks/completed/map21-single-page-dms-build.md`) — pure Card/Spreadsheet/Graph composition, no bespoke component, publish status unconfirmed.

**My recommendation, never put to Ryan and now moot given the scope narrowing:** treat `map-21-system-performance.html` as the one page to re-theme, build `map-21-lottr.html` fresh as a real drill-down, and leave `map-21.html`/`map-21-trend.html` unbuilt as superseded. Whoever picks this up (Alex, or Ryan later) should sanity-check this recommendation rather than assume it's settled — it was never confirmed.
