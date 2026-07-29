# Add Route flow — investigation + Tier 0 fixes

## Status: Tier 0 DONE. Option 2 (full inline-sidebar rebuild) DONE + live-verified (2026-07-29).

## Objective

The current "Add a route to your report" flow splits across two pieces: the `ReportRouteList`
(RRL) sidebar (manages routes already on the report) and a separate `Spreadsheet` section
("Add a Route to Your Report") elsewhere on the page that lists the whole route catalog —
click a row there, confirm in RRL. User ask (2026-07-29): investigate improvements to this
flow. Floor requirement: a mechanism so the catalog only shows while the page is in edit mode,
regardless of whether the rest of the flow changes.

## Current state (as investigated)

Confirmed live via `report_probe.mjs` against a real converted report
(`converted_reports/i_278_between_interchanges_8_and_15`), not assumed from reading code:

- The RRL sidebar is already `position: sticky` (`sectionGroup.theme.js`'s `sideNavContainer2`)
  — confirmed by scrolling 1400px and re-screenshotting; it stays pinned. So "click a catalog
  row far down the page, then hunt for the confirm banner" is less painful than it looks — the
  banner is visible immediately wherever you are on the page.
- The catalog Spreadsheet rendered on the **published, read-only page** too — pure noise there,
  since mutations are edit-gated and a viewer's click does nothing.
- Before this fix, the catalog had **no search** and paginated 5 rows at a time across 5,884
  routes (1,177 pages) — not realistically browsable.

The platform already had the needed primitives, just not wired up on this template:

- **`hideInView`** — a section-level boolean (author-facing as the section menu's "Display" →
  "Hide Component" toggle). Enforced in `sectionArray.jsx`'s read-only render path
  (`hideSectionCondition`, ~line 406-412); the page-editor's own render path ignores it, so a
  `hideInView: true` section is invisible to readers but fully visible/editable in edit mode
  (shown with a "Hidden from View" pill, `section.jsx` ~line 518). Exactly the floor requirement.
- **`serverFilter`** — a per-column toggle on the Spreadsheet (`spreadsheet/config.jsx`) that
  opens a real debounced, server-backed search box in that column's header
  (`TableHeaderCell.jsx`'s `ServerFilterControl`).
- `pageSize` is a plain config number, no code needed to raise it.

## Done (Tier 0)

1. **`hideInView: true`** added to the "Add a Route to Your Report" section in the **Report
   Page** page template (`npmrds_sub|page_template` id `2187021`, embedded `draft_sections`).
   New reports created from this template now hide the catalog from readers by construction.
2. **Section template sync**: the underlying reusable section template (`add_route_to_report`,
   id `2187290`) was stale relative to the page template's embedded copy — brought up to date
   (`serverFilter: true` on `name`/`description`, `pageSize` 5→25) so a future
   `dms section create --template add_route_to_report` doesn't regress.
3. **Real bug found and fixed along the way**: `scripts/npmrds-reports/report_build.mjs`'s
   `clonedSection()` helper silently dropped `hideInView` (and any such template-level section
   attribute) when materializing sections for a report built via the CLI — a narrow, separate
   bug from the platform mechanism itself. The native "+ Add Page" UI path was unaffected (its
   `newPage()` in `editFunctions.jsx` spreads the whole template section object, `hideInView`
   included). Fixed with a one-line change; re-verified live after the fix.

**Explicitly NOT done, per user decision**: retroactively applying either fix to already-
converted report pages' own materialized copies of the section (each page owns a frozen copy
from creation time, independent of later template edits). Separate, deferred decision — same
shape as the earlier `fix_add_route_click_publish.py` precedent if it's ever wanted.

**Live verification** (scratch pages built via `report_build.mjs`, all deleted after — see
Testing checklist): published view shows zero trace of the catalog section; edit view shows it
with a "Hidden from View" pill, 25 rows/page ("Page 1 of 236" vs the old "Page 1 of 1177"), and
a working per-column filter (clicked the Name header, typed "9D", live-refetched down to the 7
matching routes — confirmed via captured network request, not just the UI appearing to work).

## Further options considered — none committed, all still open

The floor requirement (Tier 0) is done. Beyond that, the underlying UX gap is real: route
search/add lives in a completely different part of the page from where routes are managed
(RRL), unlike the old tool which kept everything in one sidebar (see
`old_tool_routes.png` screenshot referenced in the original ask). Three directions were
discussed; **none chosen yet**:

1. **Move the Spreadsheet section into the sidebar `group`** (so it sits directly under RRL in
   the same sticky rail, no separate page location at all). **Spiked live, not just theorized**:
   changing one section's `group` from `default` to `sidebar` is mechanically trivial, but the
   result does NOT work as-is — the Spreadsheet's column-sizing model doesn't adapt to the
   rail's fixed `w-[302px]` width (`sectionGroup.theme.js`), so the table renders at its normal
   multi-column width and overflows on top of the main content below it (screenshot taken during
   the spike, not kept — reproducible by repeating the group-field patch on any scratch page).
   Making this good would need real, scoped work: dropping down to essentially a `name` column
   (+ compact add affordance) for the narrow rail, forcing fixed narrow column widths instead of
   the current auto-resize behavior, and likely a bespoke narrow-row style rather than the
   generic data-grid look. Estimate: a real mini-project (styling + `spreadsheet`/`Table`
   component work), not a config change.
2. **Full inline-sidebar rebuild** — move route search/add logic directly into `ReportRouteList`
   itself (a live-typing autocomplete against the route catalog, click-to-add with no separate
   section or action-param round trip at all), closest to the old tool's actual UX. Biggest lift
   of the three: new debounced search/results-list UI in RRL, and a decision on whether the
   standalone catalog Spreadsheet goes away entirely or survives as a secondary "browse
   everything" view for power users.
3. **Reposition/restyle in place** — keep the click-publish + separate-section mechanism, but
   move the section physically closer to RRL in the main content column (not the sidebar rail)
   and clean up its visual styling. Smallest lift of the three, weakest parity with the old tool.

User's 2026-07-29 direction (initial): don't commit to any of these yet — later the same day,
after discussing tradeoffs, chose **Option 2 (full inline-sidebar rebuild)**, scoped down per the
user's own observation about actual usage (see plan below). Options 1 and 3 remain undone,
documented above for reference only.

## Option 2 plan — full inline-sidebar rebuild (chosen 2026-07-29)

### Why this shape, not the other two sub-approaches discussed

User asked to weigh three ways to build the inline-sidebar option: (a) a wholly new one-off
component, (b) fold directly into RRL, (c) enrich the base `Spreadsheet` component. Landed on a
hybrid closest to (b): RRL is already an accepted bespoke component (justified per
`src/themes/CLAUDE.md`'s "when a custom section IS appropriate" — it renders genuinely stateful,
non-Card behavior), so adding to it isn't the one-off-component smell the CLAUDE.md principle
warns about. `Spreadsheet` (option c) is the wrong shape entirely — a live-typing autocomplete is
not a paginated grid, no styling change closes that gap (that's the separate "Option 1" idea
above, a real but different feature). A wholly new component (option a) would have duplicated
logic that already exists in **three** places in this exact shape (debounced search → UDA `like`
filter → `apiLoad`) — `ConditionValueInput.jsx`'s `useColumnOptions`, `MultiSelect.jsx`'s
`onSearch`, `TableHeaderCell.jsx`'s `ServerFilterControl` — so the query logic is written as one
new, focused piece local to this feature (see Data layer below), not a fourth reimplementation,
without promoting it to a shared library primitive the user explicitly said isn't worth the
investment right now ("the search stuff, tbh, I don't think is huge right now").

**Key UX pivot from the user's own insight**: most users create a route, then immediately build a
report using it — they already know the name, and it's recent. So the default (no typing) state
is a short **"recently created" list**, not a search box waiting for input. Typing is the fallback
for when the route isn't in that short list, not the primary interaction.

### Confirmed schema fact (via `dbq.py new`, live query, not assumed)

RRL's existing `join.sources` catalog binding (`routeSourceInfo`) points at `Routes Data`
(`npmrdsv5`, source `2107426` / view `2107427`), which has a real `created_at` column (confirmed
by dumping `page_template_2187021`'s `draft_sections[1]` — the RRL section's own `element-data.join`
— from `scratchpad/npmrds-sub/old-reports/page_template_2187021_current.json`). Sorting this
column `desc` with a `limit` is a real "recently created" query, not an `id`-ordering hack.

### Data layer

New function (lives in `ReportRouteList.jsx` or a small local sibling file, e.g.
`useRouteSearch.js` — decide during implementation based on how large it gets), modeled on the
**existing** `fetchDynamicRoute` (`ReportRouteList.jsx:115-150`) — NOT on `RouteComparison.jsx`'s
`buildCatalogRequest`, which is missing the same `attributes`-explicit fix `fetchDynamicRoute`
already has and therefore never gets `id` back (RouteComparison only reads `route_id`, a legacyJSONB
column; RRL's own dedupe (`sameRoute`) prefers the real DMS `id` per the 2026-07-24 add-by-DMS-id
fix). Concretely:

- Same `buildUdaConfig` call shape as `fetchDynamicRoute`: `columns: [...routeSourceInfo.columns
  .map(c => ({...c, show: true})), {name: 'id', systemCol: true, show: true}]`, explicit
  `attributes: udaConfig.attributes` passed into the request `filter`, and the same
  `udaConfig.columnsToFetch.reduce(...)` unwrap of the response (flat fields, not the bare-`data`
  fallback shape).
- Two modes, one function, parameterized by `searchTerm`:
  - **Empty** (default/recent mode): no filter groups, add `sort: 'desc'` to the `created_at`
    column entry, cap via `fromIndex`/`toIndex` (same windowing `RouteComparison.jsx`'s
    `buildCatalogRequest` already uses) to a small limit (~8).
  - **`searchTerm.trim().length >= 2`** (mirrors `RouteComparison`'s threshold): filter group
    `[{ col: 'name', op: 'like', value: term }]`, capped higher (~20 — a sidebar list, not
    `RouteComparison`'s 50-row rail).
- Debounce 250ms on the search-term path (same constant `RouteComparison.jsx` uses), no debounce
  needed on the recent-list fetch (runs once on mount / whenever the list is empty).
- Already-added routes filtered out of both result sets via the existing `sameRoute(a, b)` helper
  (`ReportRouteList.jsx:96-98`) — re-adding is still technically allowed (not hard-blocked, per
  `AddRouteBanner`'s old "different date range is a legitimate use case" comment) but doesn't
  clutter the default list with routes already on the report.

### UI layer

New local component, `AddRouteSearch.jsx` (sibling to `RouteRow.jsx`/`AddRouteBanner.jsx` in the
same folder), replacing `AddRouteBanner` entirely:

- A text input (placeholder "Add a route…") — reuses the existing `t.searchWrapper`-style
  convention, new theme keys added to `ReportRouteList.theme.js`.
- Below it: "Recently created" header + up to ~8 rows when the input is empty; live search
  results when >= 2 chars typed; a loading state; an empty state ("No matching routes").
  Each row: route name + TMC count (`parseTmcArray` from `utils.js`, already used by
  `AddRouteBanner`/`RouteRow`) + click-anywhere-on-row to add.
- **Click adds immediately** — calls `addRoute(row)` (`useReportRow.js:258-291`, unchanged) with
  no confirm step. Safe because `removeRoute` is one click away and `addRoute` already handles
  dedup-by-name/color/comp-id assignment. Give a small transient success indication (e.g. a
  fading inline "Added" line) since the confirm banner's preview step is gone — exact treatment
  decided during implementation, kept minimal per the user's steer not to over-invest here.
- Placed in `ReportRouteList.jsx`'s render near the top of the panel (where `AddRouteBanner` used
  to render), above the existing "search *added* routes" box (`t.searchWrapper`, `ReportRouteList
  .jsx:202-215`) — these are two different search boxes (search-the-catalog-to-add vs.
  filter-what's-already-added) and must stay visually distinct; naming/labeling to make that
  obvious is part of the UI work.

### Removing the old mechanism

- `ReportRouteList.jsx`: delete `pendingRoute` state, `fetchDynamicRoute`, the `addRouteId`
  derivation (`pageState.filters.find(... 'add_route_id' ...)`), the effect that triggers the
  fetch, `confirmAddRoute`/`cancelAdd`, `isDuplicateRoute`, and the `AddRouteBanner` import/render.
- Delete `AddRouteBanner.jsx` (dead code once nothing renders it).
- `ReportRouteList.theme.js`: drop the now-unused `addRouteBanner*`/`addRoutePreview`/
  `addRouteButtons`/`addRouteDuplicateNotice` keys, add new keys for `AddRouteSearch`.
- No changes needed to the `click_publish` provider mechanism itself (`component-actions.md`,
  `spreadsheet/rowPublish.js`, etc.) — it's generic platform machinery other sections may still
  use; only this template's usage of it goes away.

### Template mutation (DB row, not code) — do this LAST, after code is verified

- Back up `page_template_2187021` to scratchpad first (existing convention — see
  `scratchpad/npmrds-sub/page_template_2187021.pre-*.json` from earlier rounds).
- Remove the "Add a Route to Your Report" `Spreadsheet` section entirely from the template's
  `draft_sections` (and `sections`, if a separately-materialized published copy also carries it —
  check both during implementation; Tier 0's dump only inspected `draft_sections`).
- Section template `2187290` (`add_route_to_report`) becomes unused — leave it as orphaned
  history, no cleanup required (per established "mint freely, clean up opportunistically"
  convention).
- Check `scripts/npmrds-reports/report_build.mjs` for any hardcoded reference to this section
  (beyond the generic template-section cloning `clonedSection()` already does) — expect none, but
  verify, since the Tier 0 fix touched this exact function.
- **Explicitly NOT done** (same precedent as Tier 0): retroactively removing this section from
  already-converted report pages' own frozen section copies. Separate, deferred decision.

### Verification checklist (report_probe.mjs, scratch report pages, all deleted after — including
### their orphaned `reports_snap_2` rows and section rows, which `dms page delete` does NOT cascade
### to; see "known operational gotcha" note below)

- [x] Empty-input state shows a "recently created" list, order matches `created_at desc` — spot
      checked against `dbq.py new` directly. **Found and fixed a real bug along the way** (see
      below): the naive version showed obviously-stale test routes first.
- [x] Typing >= 2 characters live-filters via a real network request (captured via
      `report_probe.mjs --grep`, not just UI appearing to update) — typed "9D", got 16 real
      catalog matches including legitimate substring hits.
- [x] Clicking a result adds the route immediately (no confirm click) — confirmed via the
      transient "Added "..."" indicator AND a direct `dbq.py new` read of the report's
      `reports_snap_2` row showing the new route persisted with a real `id`, auto-assigned color,
      and `route_comp_id`.
- [x] Already-added routes don't clutter the default recent list — confirmed live (a route on the
      report correctly skipped in the recent list, ground-truth order otherwise intact).
- [x] Removing a route (existing `removeRoute`) still works — unchanged code path, not re-tested
      in isolation (no reason to regress; nothing about this rebuild touches it).
- [x] Published (view-mode) page: no search/add UI renders at all — confirmed via a separate
      published scratch page screenshot (edit-gated exactly like the old `AddRouteBanner`).
- [x] Fresh scratch report built via `report_build.mjs` (post template-mutation) has NO standalone
      catalog Spreadsheet section anywhere on the page — confirmed via screenshot + 0 console/page
      errors.
- [x] Sticky sidebar still scrolls/behaves correctly with the new UI added at the top of the
      panel — no visual regression observed in any screenshot.

### Bug found and fixed during verification: recent-list NULLs-first ordering

`ORDER BY created_at DESC` puts NULL values FIRST in Postgres by default. ~26 of 64,801 catalog
rows (legacy imports) have no `created_at` at all, so the naive recent-list query surfaced those
undated legacy rows ahead of genuinely recent ones — confirmed live (the box showed things like
"ASDASD", a blank-name row, "CorrectFormat" instead of real recent routes). Fixed by adding a
`{ col: 'created_at', op: 'notempty' }` filter group to the recent-mode query (`useRouteSearch.js`)
— excluding undated rows is correct, not a workaround: a route with no creation timestamp genuinely
isn't orderable by recency. Re-verified live against `dbq.py`'s own ground-truth top-8 query —
exact match after the fix.

### Unplanned dependency found and fixed: `report_build.mjs` required the removed section

`scripts/npmrds-reports/report_build.mjs` unconditionally cloned the template's "Spreadsheet"
section (the standalone catalog) into every new report page (`templateSectionByType('Spreadsheet')`,
both the create-new-page path and the `--update` reconcile path) — removing it from the template
broke report building entirely (`SPEC ERROR: Report Page template has no "Spreadsheet" section`).
Fixed by removing both `clonedSection(templateSectionByType('Spreadsheet'), ...)` call sites; the
`--update` reconcile path's `spreadsheetSection` lookup + `fail()`-if-missing was also removed
(no longer required — an old page's own frozen copy, if it has one, is simply left untouched by
the reconcile, same as it was already excluded from the deletion sweep). Re-verified live: a fresh
build + `--update`-shaped reconcile path both work post-fix.

### A second, more consequential instance of the same bug: `convert_old_reports.py`

User prompt (after the feature was already shipped): "are there any other portions of reports/RRL
that assumed there would be a Spreadsheet section... something coming up because we use `$self`
for the dynamic comparison series binding, and we also iterate/look at sibling sections in a
page." Checked both leads:

- **`$self` / `usePageFilterSync` / `useGraphPublish.findSelfBoundGraphs`** — content-based
  disambiguation only (checks each sibling's own `display._functions.subscribers` for an enabled
  `comparison_series` subscriber keyed `$self`), never element-type-based and never assumes a
  Spreadsheet/Add-a-Route sibling exists. The removed section never carried that subscriber (it
  had a `click_publish` PROVIDER, not a subscriber) — its removal changes nothing here. No bug.
- **Sibling-section iteration** — this is where the real second bug was: `scripts/npmrds-reports/
  convert_old_reports.py` (the **old-report → new-DMS-report bulk conversion tool**, 68+ rounds of
  ongoing production work, 36 real reports converted, ~145 more "full_producible" and still
  pending) has its own **independent Python reimplementation** of the exact same pattern
  `report_build.mjs` had: `template_section_by_type(page_template, "Spreadsheet")` (line 5058,
  raises `RuntimeError` if missing) plus `section_datas.append(build_cloned_section_data(page_id,
  sheet_tmpl, ...))` (line 5089) — unconditionally cloning the now-removed template section into
  every newly converted page. This would have broken the **very next real conversion run**, not
  just a hypothetical — a live production-blocking regression, not merely a code-quality nit.

**Fix**: removed both the `sheet_tmpl` lookup and its clone-append call (mirrors the
`report_build.mjs` fix exactly); updated the dry-run summary message (`"+RRL +Add-a-Route"` →
`"+RRL"`). Dry-run mode doesn't exercise this code path at all (it returns before reaching section
construction), so verification required a **real, non-dry-run conversion**: ran `convert_old_reports.py
--report-id 36` (a real, previously-unconverted, gap-free old report) against the live dev stack —
succeeded, created exactly 2 draft sections (RRL + 1 graph, correctly no third Spreadsheet section,
down from the old 3), `report_probe.mjs` confirmed a clean render (0 console/page errors, real SVG).
Cleaned up afterward via the script's own `delete_converted_page()` (page + both section-row sets +
the `reports_snap_2` row), since this was a verification run, not a deliberate conversion round.

**Swept for a third instance**: grepped all of `scripts/npmrds-reports/*.{py,mjs}` and
`src/themes/transportny/**` for `Spreadsheet`/`template_section_by_type`/`templateSectionByType`/
the literal "Add a Route to Your Report" title/`add_route_id`/`click_publish` strings — every other
hit is either the generic library mechanism (used by unrelated features: transportNY's
ticket/corridor/incident QA build tools, ConditionValueInput, TableRow, Card) or this task's own
new/updated files. No third dependency found.

## Files touched

### Tier 0

| What | Where |
|---|---|
| Page template `2187021`'s "Add a Route to Your Report" section | `hideInView: true` added (DB row, not code) |
| Section template `2187290` (`add_route_to_report`) | `serverFilter`/`pageSize` synced to match (DB row, not code) |
| `scripts/npmrds-reports/report_build.mjs` | `clonedSection()` now forwards `hideInView` from the template section |

### Option 2 (full inline-sidebar rebuild)

| What | Where |
|---|---|
| `src/themes/transportny/components/ReportRouteList/useRouteSearch.js` | **New.** Debounced recent/search fetch hook against the route catalog. |
| `src/themes/transportny/components/ReportRouteList/AddRouteSearch.jsx` | **New.** The inline "Add a route" box UI (input + recent/search results, click-to-add). |
| `src/themes/transportny/components/ReportRouteList/AddRouteBanner.jsx` | **Deleted.** Replaced by `AddRouteSearch.jsx`; the click-publish/confirm-banner flow it supported no longer exists. |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` | Removed `pendingRoute`/`fetchDynamicRoute`/`addRouteId`/`confirmAddRoute`/`cancelAdd`/`AddRouteBanner`; wired in `useRouteSearch` + `AddRouteSearch` with direct `addRoute()` on click. |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.theme.js` | Dropped unused `addRouteBanner*` keys, added `addRoute*` keys for the new search box. |
| `src/themes/transportny/components/ReportRouteList/utils.js` | Comment update only (which component now uses `parseTmcArray`). |
| `scripts/npmrds-reports/report_build.mjs` | Stopped cloning a template "Spreadsheet" section into new/reconciled report pages (see bug note above); header doc comment updated. |
| `scripts/npmrds-reports/convert_old_reports.py` | Same fix, independently — the old-report bulk conversion tool had its own Python reimplementation of the same clone-from-template pattern; would have broken the next real conversion run. |
| Page template `2187021` | "Add a Route to Your Report" `Spreadsheet` section removed from `draft_sections` (DB row, not code) — backed up first to `scratchpad/npmrds-sub/page_template_2187021.pre-remove-spreadsheet-section.*.json`. |
| `scratchpad/npmrds-sub/remove_add_route_spreadsheet_section.py` | One-off migration script used for the template mutation above (dry-run by default, `--apply` to write). |

**Explicitly NOT done** (same precedent as Tier 0): already-converted report pages keep their own
frozen copy of the old catalog Spreadsheet section, untouched. Section template `2187290`
(`add_route_to_report`) is now unused/orphaned — left as-is, no cleanup needed.

## Testing checklist

- [x] Published view of a fresh report built from the (patched) template shows no trace of the
      catalog section — confirmed via `report_probe.mjs` screenshot, scratch page
      `converted_reports/scratch_hideinview_test`, deleted after.
- [x] Edit view of the same page shows the catalog with a "Hidden from View" pill, 25 rows/page.
- [x] Per-column search works end-to-end: clicked the Name header, typed "9D", confirmed a real
      re-fetch (network capture) narrowing 5,890 routes to 7 matches — not just a UI popup
      appearing.
- [x] `report_build.mjs`'s `hideInView`-forwarding fix re-verified live after the change (first
      scratch build predated the fix and did NOT hide the section; rebuild after the fix did).
- [x] Sidebar-group move spiked live on a scratch page — confirmed it does not work cleanly
      as-is (documented above); not pursued further per user direction.
- [ ] Retroactive fix to already-converted report pages — explicitly deferred, not attempted.
