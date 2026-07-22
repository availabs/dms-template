# Report page redesign — findings & recommended approach

**Status:** exploratory — scope not yet decided. User is switching tools; this document
captures research so the next session doesn't re-derive it.

## Objective

Compare the old npmrds report-builder tool (legacy React app, `npmrds.devtny.org/report/edit/*`)
against the new DMS-based report page (transportny theme) and figure out what, if anything, still
needs visual/UX redesign work. Triggered by the user gathering screenshots of both tools side by
side and asking how to best approach a redesign.

Screenshots referenced (local, not copied into the repo):
- Old tool, edit mode: `~/Pictures/Screenshots/report_520_old.png`, `old_33_edit.png`
- Old tool, view mode: `~/Pictures/Screenshots/report_914_avg_winter.png`, `old_33.png`
- New tool: `~/Pictures/Screenshots/tappan_latest_dms.png`, `edit_graph.png`, `edit_measure_dms.png`

## Bottom line up front

This is **not greenfield**. A large chunk of old→new feature parity already shipped, most of it
in the last few days (see git log: `2ab7505` "RRL fixes, now has custom sectionMenu item for
adding graphs" → `d7778fe` → `468966b` "more RRL persistence fixes"). The open work is narrower
and more specifically visual/UX than "redesign the report page" suggests. See
[Gap analysis](#gap-analysis-what-might-still-be-worth-redesigning) below.

## What's already shipped (don't re-build this)

- **`ReportRouteList`** — `src/themes/transportny/components/ReportRouteList/` — the route
  management side panel. A real `ComponentRegistry` section component (its own `EditComp`/
  `ViewComp`/`defaultState`/`controls`), not a Card config. Done, stable, README at
  `ReportRouteList/README.md` covers the storage model and self-binding mechanism in detail.
- **The Measure Picker** — `src/themes/transportny/components/MeasurePicker/`
  (`composeMeasureConfig.js` + `index.js`) — a `sectionMenu.jsx` extension (registered via
  `sectionMenuExtensions.js`) for the `"AVL Graph"` component. Renders 4 nested selects (Graph
  Type / Measure / Resolution / Comparison Mode); each pick composes and writes
  `columns`/`join`/`comparisonSeriesCombine`/`display` into the section's live draft state via
  `dwAPI.setState`. This is the new-tool analogue of the old tool's "Graphs" catalog +
  "Templates" concept. Shipped and **live-verified end-to-end 2026-07-21**
  (`src/dms/planning/tasks/completed/report-graph-vocabulary-picker.md`).
- **Shared vocabulary** — `data-types/npmrds_graph_vocabulary/vocabulary.json` — the measure/
  resolution/join/comparison-mode expressions, ported out of `scripts/convert_old_reports.py`'s
  `TEMPLATE_SPECS` (a 60-entry dict, still exists, still used by the batch Python converter) so
  both the picker and the converter share one source instead of drifting.
- Wiring in `src/dms/packages/dms/src/patterns/page/components/sections/sectionMenu.jsx`:
  imports `getSectionMenuExtensions`, splices theme-supplied extension item-groups (e.g. the
  Measure picker) between the built-in `columns` and `filter` groups — purely additive, doesn't
  touch existing `join`/`comparisonSeries`/`pivot` groups.

**Explicitly deferred** (tracked already, don't re-litigate without new user input — see
`src/dms/planning/tasks/completed/report-graph-vocabulary-picker.md` and
`~/.claude/projects/-home-ryan-code-dms-template/memory/project_report_builder_ui_scoping.md`):
- Resolution derived dynamically from a route's own settings (old tool never asks up front; new
  tool currently does, as an explicit picker field).
- Old-tool template reuse: route-placeholder `$0/$1` substitution + rolling-year substitution.
- Peak/weekday and relative-date filter controls beyond plain start/end date.
- Resolution/TMC-compatibility validation on route→graph assignment in `ReportRouteList` (old
  tool's approach: silent per-graph-type filtering, not blocking).
- An unspecified "some concerns" about `ReportRouteList` the user flagged once, never detailed.
- `reportroutelist-graphids-wiped-on-refresh.md` — fixed and live-verified 2026-07-20, but the
  task file still sits in `tasks/current/` rather than `completed/` (bookkeeping, not a real gap).

## Old-tool architecture (ground truth)

Source: `/home/ryan/code/transportNY/src/sites/npmrds/pages/analysis/`.

- `reports/components/ReportBase.jsx` — the report editor page. One class (subclassed as
  `EditReportClass`/`ViewReportClass`) owns all report state, mounts `<GraphLayout>` +
  `<Sidebar>`, renders page-level "Hide/Show Controls", "Save as Report", "Save as Template".
- `components/Sidebar/index.jsx` + `SidebarContainer.jsx` — the "Controls" sidebar shell: a
  generic collapsible base+extension two-panel container, reused for Routes/Stations/Graphs
  detail views.
  - `ActiveRouteComponents.jsx`, `RouteComponent.jsx`, `RouteGroupComponent.jsx` — routes list,
    "Add New Group", "Routes"/"Folders" add-dropdowns, per-route detail (dates, color).
  - `ActiveGraphComponents.jsx`, `GraphSelector.jsx` — the "Graphs" list: a **fixed catalog**
    (`GRAPH_TYPES` array in `tmc_graphs/index.jsx`, entries like `{type, category, saveImage,
    isColorfull}`), grouped by category; `+`/`−` on an active graph adds/removes an *instance* of
    that type (not a type picker per instance).
  - `ColorRangeSelector.jsx` — a **separate** color-*range* picker (ColorBrewer-style palettes,
    diverging/sequential, length 3–9, reversible) for choropleth/heatmap-style graphs flagged
    `isColorfull`. Distinct from per-route color.
- `GraphLayout/index.jsx` + `GridLayout.jsx` (react-grid-layout) + `GraphFactory.jsx` (type→
  component dispatch).
- `tmc_graphs/graphClasses/GraphContainer.jsx`, `GeneralGraphComp.jsx`, `HybridGraphComp.jsx` —
  shared per-graph chrome. **Key mechanism**: every graph type implements `generateHeaderData()`
  returning declarative control descriptors (`{title:"Reverse TMCs", type:"boolean-toggle"}`,
  `{title:"Main", type:"single-select"}`, shorthands like `single-select-route` expanded generically
  by `expandHeaderData()`). A shared `MenuBar` in `GraphContainer` renders these generically by
  `type`. So the old tool's inline per-graph toolbar buttons (Main/Compare, Reverse TMCs, Display
  Data 2, Show Compare) are bespoke *data*, rendered through **one generic component**, sitting
  directly in the graph's own header — not a settings drawer. The icon row (eye/file/save/
  paint-brush/+/−) is fully generic, gated by props (`saveImage`, `hasMessageBox`, `setColorRange`).
- Templates (`store/index.js` `saveTemplate`/`_loadTemplate`): capture `route_comps` +
  `graph_comps` (grid layout + per-graph state) + `station_comps` + `colorRange`; on save,
  literal route IDs get rewritten to placeholder tokens (`$0`, `$1`, …) and — if "Save Years As
  Recent" is checked — literal years/dates get rewritten to `{recent-N}` relative tokens. Only
  templates matching the current route/station *count* are offered on load.
- Colors, two independent systems: (a) per-route/station free-form HSV picker
  (`Sidebar/components/ColorPicker.jsx`, react-color Saturation+Hue), new routes auto-assigned
  from a shared cycling palette (`COLORS`/`getRouteColor()`/`getStationColor()` in
  `store/index.js`); (b) the `ColorRangeSelector` described above, unrelated, for graph fill
  ranges not route identity.

## Gap analysis: what might still be worth redesigning

Ranked by how concrete/confirmed the gap is:

1. **Inline per-graph quick controls vs. generic Settings drawer.** The old tool's `MenuBar`
   surfaces 1-4 hot toggles (Main/Compare, Reverse TMCs, Display Data 2) directly in the graph's
   own header bar — one click. The new tool routes the equivalent settings (Measure, Comparison
   Mode, Filters, Display) through the generic per-section Settings side-drawer (see
   `edit_graph.png`/`edit_measure_dms.png`: Type → AVL Graph Settings → ... → Measure → Graph
   Type/Measure/Resolution/Comparison Mode, several clicks deep). This is the sharpest,
   best-evidenced UX regression and the most likely candidate for a first design pass. Likely
   shape of a fix, per the themes design philosophy (`src/themes/CLAUDE.md`): not a bespoke
   component, but a Card/avlGraph-level enrichment — e.g. a themeable "quick controls" row in the
   section header exposing an author-chosen subset of `display`/`comparisonSeries` fields as
   inline toggles/selects, in the spirit of `authoring-graphs.md`'s header+hero-stat pattern.
2. **Route/graph color assignment.** The old tool has two explicit, separate color systems (free
   per-route HSV color + a graph color-range picker). Whether anything equivalent exists in
   `ReportRouteList`/`MeasurePicker` today was **not confirmed** during this research pass — worth
   checking before assuming it's missing.
3. **Visual/density polish of the graph cards themselves.** Spacing, borders, legend placement,
   and the attribution-line treatment (visible in `tappan_latest_dms.png`) differ from the old
   tool's cleaner card chrome. Lower-confidence gap — more a matter of taste/polish than a
   functional hole.
4. Everything in "explicitly deferred" above is already tracked and scoped elsewhere; don't
   duplicate that scoping here.

## Recommended methodology

There is no dedicated "design" agent in this environment (checked the available agent roster:
`claude`, `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, `repo-convention-reviewer`,
`statusline-setup` — none design-specific). The right tool is a **skill**, not an agent:

1. **`src/dms/skills/transcribing-a-design-card-to-dms.md`** — primary/governing methodology.
   Purpose-built for exactly this: inventory a design mockup/screenshot into atoms, map each atom
   through the decision ladder (static text → `formatFn` → value-driven column type → Card
   `display`/span → *only as last resort* a new component), build the authorable version, verify
   with a Playwright screenshot diff (`scripts/card-shot.mjs`, or this repo's own
   `scripts/report_probe.mjs` harness — see `reference_report_probe_harness` memory).
2. **`src/dms/skills/card-layout.md`** — reference/knob-dictionary to keep open whenever a gap
   involves a Card-driven section (most Settings-drawer fields likely are).
3. **`src/dms/skills/authoring-graphs.md`** — reference for anything in the chart bodies/headers
   themselves (target lines, bar/line display knobs, header+hero-stat composition) — directly
   relevant to gap #1 above.
4. **`src/dms/skills/creating-page-section-components.md`** — fallback only, and only for
   `ReportRouteList` specifically (the one genuinely non-Card component in this page), if the
   decision ladder in (1) bottoms out.
5. **Skip `src/dms/skills/designing-a-dms-design-system.md`** — that skill is for birthing a
   brand-new theme/design system from a blank brief; this is page-pattern-level iteration inside
   an existing, already-built transportny theme. Wrong tool for this job.

## Open scoping question (unresolved — ask next session)

Presented to the user as a multiple-choice before they switched tools; not yet answered. Re-ask
before starting implementation:

- (a) Inline per-graph quick controls (gap #1 above) — recommended starting point, most concrete.
- (b) Route/graph color assignment (gap #2) — needs a confirm-it's-actually-missing step first.
- (c) Visual/density polish of graph cards (gap #3).
- (d) Whole-page holistic review — run the full transcription-skill atom inventory across all
  four old-tool screenshots before prioritizing anything.

## Cross-references

- `src/themes/transportny/components/ReportRouteList/README.md`
- `src/dms/planning/tasks/completed/report-graph-vocabulary-picker.md`
- `src/dms/planning/tasks/current/reportroutelist-graphids-wiped-on-refresh.md`
- `src/dms/planning/tasks/current/reportroutelist-page-templates.md`
- Memory: `project_report_builder_ui_scoping`, `reference_old_npmrds_tool_source`,
  `project_reportroutelist_ux_polish_done`, `reference_report_probe_harness`
