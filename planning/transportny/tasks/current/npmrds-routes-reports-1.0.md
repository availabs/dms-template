# NPMRDS Routes & Reports — the 1.0 tracker

**Project:** TransportNY · **Topic:** themes · **Status:** OPEN — this is the single entry point for
the Routes/Reports arc as of 2026-09-16. · **Started:** 2026-09-16

> **Read this file first — it is the single entry point for Routes/Reports and for converting old
> reports.** The arc accumulated ~45 task docs across two repos. A 2026-09-16 triage checked each
> remaining "open" item against live code and found **most were already shipped but still
> documented as open**. This file is the current truth; everything else is history. Start at
> "Working on reports — start here" below for commands, code layout and the gotchas; use the table
> immediately below for what is actually open. Regenerate the full doc inventory any time with:
>
> ```bash
> python3 scripts/npmrds-reports/arc_inventory.py --open   # open items only
> python3 scripts/npmrds-reports/arc_inventory.py --dupes  # duplicate todo.md entries
> ```
>
> That script re-derives status from the task files themselves, so it can't drift the way a
> hand-written list does. It also prints an UNCLASSIFIED section when a new arc-shaped submodule task
> appears that its allowlist doesn't know about.

## Open for 1.0

Derived 2026-09-16 from a **systematic sweep of every live (non-archive) arc doc**, not a
hand-picked subset — an earlier pass the same day only triaged the UI parity-gap ledger and missed
the old-reports workstream entirely. Regenerate the doc inventory any time with
`python3 scripts/npmrds-reports/arc_inventory.py --open`.

The finding: nearly every remaining "open" line across the arc is an **explicit Ryan deferral**, a
scoping-only task, or part of the routing-plugin sub-arc.

| # | Item | Where | State |
|---|------|-------|-------|
| ~~1~~ | ~~Info Box multi-measure~~ | `old-reports-conversion.md` | **BUILT + live-verified 2026-09-16** (step 1). 483 of 597 instances. |
| ~~1b~~ | ~~Route Compare multi-measure~~ | `old-reports-conversion.md` | **BUILT + live-verified 2026-09-16.** 192 of 216 instances. |
| ~~3~~ | ~~Publish the All Reports list page~~ | — | **DONE 2026-09-16 (Ryan).** |
| ~~4~~ | ~~GridGraph Part 1 live-verification~~ | — | **DONE 2026-09-16 (Ryan).** |
| ~~5~~ | ~~Deploy dms-server for delete-cascade~~ | — | **DONE 2026-09-16 (Ryan).** |
| 2 | **Literal `LOTTR`/`TTTR` measures** — 10 reports, invisible inside the generic `extra_measures_dropped` bucket. | `old-reports-conversion.md` | Open. Ryan at round 85: keep them for real, "somewhat soon… idk if mandatory." Payoff today is zero (all 10 predate 1410 coverage). |
| 6 | Old-report known gaps: Route Compare anchor row ordering inconsistent; Travel Time Route Map colour scale is static. | `old-reports-conversion.md` | Open, both user-reported. |

**Nothing on this list blocks 1.0 any more.** Items 2 and 6 are small and explicitly low-urgency.

### Highest-value next step (not a blocker)

Add **`hoursOfDelay`** and **`co2Emissions`** to the Info Box / Route Compare supported measure
sets (`INFO_BOX_MEASURE_BY_BUCKET`, `MEASURE_EXPR`). Both already exist elsewhere in the converter's
vocabulary. The commonest Route Compare combo is `[speed, travelTime, hoursOfDelay, co2Emissions]`
(30 instances), so this converts a large share of the 334 + 178 *partial* boxes into full-fidelity
ones. Full numbers in `old-reports-conversion.md`'s step-1/1b sections.

### Not in 1.0 — explicitly deferred by prior decision

Listed so they stop reading as backlog: Item 9 Publish/Discard for RRL changes; the 11-template
audit in `dynamic-reports-and-route-tags.md`; `avlgraph` pass 3 (collapsing legend) + Stage 2;
`graph-card-padding-and-legend-theming` step 3; tooltip-swatch muting; `duration-value-format-mm-ss`;
comparison-series fan-out phases 4–5; ClickHouse probe-hazard Option A; converter vocabulary unit
tests; probe expected-value cells; `route-build-duplicate-falcor-instances`;
`theme-legend-token-consolidation` (marked "do not implement"); and the entire routing-plugin
sub-arc (point-to-point, detour/avoid-segment, ALT, bridge-candidates, route-creation-tool phases).

## Deferred past 1.0 (explicit decisions, not neglect)

- **Per-route `routeWindows` override UI** (old gap #18) — same route on one graph at different
  time/DOW windows. Backend + `report_build.mjs` spec grammar already support it; only the UI is
  missing. Open design problem: `routeWindows` is graph-scoped, so there's no single place "the AM
  variant of Current Year" lives for a picker to default a colour from.
  See [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md) gap #18.
- **GridGraph Part 2 — row-average strip** — a narrow strip beside the grid showing each row's
  overall (not time-bucketed) average. Renderer already supports it. Gated on shipping with a real
  user-facing toggle, not a spec-only flag.
  See [`gridgraph-row-height-scaling.md`](./gridgraph-row-height-scaling.md).
- **Combined Reports page** — design done, library-change plan spec'd, build not started.
  See [`npmrds-reports-combined-page-design.md`](./npmrds-reports-combined-page-design.md).
- **Routing plugins** (point-to-point, detour/avoid-segment, ALT heuristic, bridge-candidates
  GeoPackage) — a separate product surface from Reports/Routes authoring, tracked in their own files.

## Closed 2026-09-16 (verified against live code, not doc headers)

Each of these was documented as open and was found already shipped. Listed with the evidence, since
the docs themselves were the unreliable part.

| Old item | Verdict | Evidence |
|---|---|---|
| Gap #3 — hover popover showed TMC code only | **FIXED 2026-09-16** | See "Gap #3" below. |
| Gap #1 — map scroll-zoom disabled | Closed | `map/index.jsx:1367-1369` drives `dragPan`/`scrollZoom`/`dragRotate` off `state.zoomPan`, which defaults `true` (`:382`). routecreation is a plugin on that same map. |
| Gap #6 — RRL "ON: Graph N" pill silent-fail | Moot | The pill was removed from the UI entirely (Ryan, 2026-09-16). Nothing left to reproduce. |
| Gap #9 — Measure Picker pick unsaved until floppy Save | Outdated | No floppy in the flow; QuickControls in the section header auto-persist to the page draft, which is the intended behaviour. |
| Gap #13 — Add Page no-redirect | Dead | Report pages are created through a purpose-built button, not generic Add Page. |
| Gap #14 — Settings-gear discoverability | Dead | An author is never expected to use the settings gear for NPMRDS routes/reports. |
| Gap #15 — Measure Picker never composes title/description | Closed | `composeSectionTitlePatch()` fills both, each behind its own pristine check (`isTitleDirty`/`isKickerDirty`) — exactly the auto-vs-edited design the gap called for. Wired at `useAddGraphSection.js:102` and `MeasurePicker/index.js:319`, plus a Map equivalent. Title half landed 2026-08-20 (Tier 5B), kicker half 2026-09-11. |
| Gap #12 — difference-graph re-wiring needs re-open + re-save | Moot + fixed | The RRL has no "update an existing graph" affordance any more (only `addGraphSection`), so the flow the gap describes no longer exists; the underlying difference-graph bug was fixed by a separate session 2026-09-16. |
| Converter not updated for the graph-card header/title change | Done | `report-graph-card-header-and-titles.md` Round 3 (2026-09-15) updated `convert_old_reports_lib/convert_report.py` via `compose_bridge.mjs`, verified by re-converting old report 1041 → page 2224449. That file's own status header and its "converter NOT done" line are both stale. |
| Gap #16 — no UI to author Info Box / Route Compare | Wrong premise | They were reframed as **Table + modifiers**, not separate shapes: Info Box ≈ Table at `resolution: 'summary'`; Route Compare = Table + the `routeCompare` checkbox, gated to summary (`composeMeasureConfig.js:1017`). Confirmed in the live Add Graph modal. |
| Probe corpus non-determinism | Fixed 2026-09-14 | Three consecutive runs `entries=8 blockers=0 majors=0 info=0`, `FLAKY — 0`, plus a tamper test proving the suite has teeth. Commit `2bbaec7` re-baselined all 8 baselines. The section heading in [`report-probe-expect-and-golden-corpus.md`](./report-probe-expect-and-golden-corpus.md) still said NON-DETERMINISTIC above its own fix. |
| GridGraph row-height Part 1 | Built | `composeMeasureConfig.js:390-393`, `MeasurePicker/index.js:60`, and Height/Width target options in the submodule's `graph_new/config.jsx:240,243`. |
| `page-delete` orphaned `reports_snap_2` rows | Done | A registered server-side page-delete hook now runs on every page delete and cleans up the report-routes row. |

### Gap #3 — hover popover now names the segment (FIXED 2026-09-16)

Hovering a segment in the route-creation map showed a bare TMC code (`120N04891`), so identifying a
road meant clicking it and reading the route list. It now shows **Road · Direction · TMC**.

Two changes were needed, because there are two separate mechanisms:

1. **`hover-columns` on the layer** decides which attributes the popup lists
   (`SymbologyViewLayer.jsx:1871`, `HoverComp`). It was an **authored** value —
   `[{column_name: "tmc", display_name: "tmc"}]` — which is precisely why only the TMC showed.
   Because it is author-authored (unlike `data-column`/`hoverTolerance`, which the plugin owns),
   this was changed **in the symbology**, not force-written from the plugin.
2. **`data-column` on the layer** decides which columns ride in the vector tile. Changed from
   `'tmc'` to `'tmc,road,direction'` in `routecreation.plugin.jsx`. `getLayerTileUrl` builds `cols=`
   from `[layerProps['data-column']]` verbatim, so a comma-joined list passes through as-is.

**Why both.** Setting only `hover-columns` was not enough: the tile carried just `tmc`, so
`road`/`direction` fell to `HoverComp`'s base-attribute fetch (resolve-by-MVT-feature-id against the
source) — the same path observed sticking on "Fetching Attributes" for this layer. Putting them in
the tile makes them synchronous feature properties and sidesteps that path entirely.

**Rows touched** (the two-symbology-homes gotcha — the page renders from an embedded *copy*, not the
catalog item, so all three needed patching):

| Row | What |
|---|---|
| `2172314` | mapeditor catalog item, "Route Creation Plugin" |
| `2216259` | `route_creation` page **draft** section (embedded copy) |
| `2216260` | `route_creation` page **published** section (embedded copy) |

Backups: `scratchpad/npmrdsv5-dev2/routecreation_symbology_backup.json`, `section_2216259.json`,
`section_2216260.json`.

**Verify URL:** `http://www.localhost:5173/npmrds/route_creation` — hard-reload, hover any segment.
**Expect:** Road, Direction, TMC. Confirmed live by Ryan 2026-09-16.

Tile-level proof, independent of the browser (z12 tile over Albany, view 3058):

```
cols=tmc                 HTTP 200   33564 bytes   keys -> tmc:True  road:False direction:False
cols=tmc,road,direction  HTTP 200   36734 bytes   keys -> tmc:True  road:True  direction:True
```

**Watch item, pre-existing:** the hover popup intermittently sticks on "Fetching Attributes"
(Ryan: it "sometimes gets hung"). Present before this change and not caused by it; the tile-property
route above means the popup's Road/Direction no longer depend on the fetch that hangs.

## Working on reports — start here

### Converting old reports

Source of truth: **`src/dms/planning/tasks/current/old-reports-conversion.md`** (live) +
`old-reports-conversion-archive.md` (rounds 1-84). 85 rounds in; read that file's "Current state"
header and its "Known functionality gaps" register before touching the converter.

```bash
python3 scripts/npmrds-reports/convert_old_reports.py --report-id <id> --dry-run
python3 scripts/npmrds-reports/convert_old_reports.py --report-id <id> [--replace]
python3 scripts/npmrds-reports/census_old_reports.py        # corpus-wide coverage census
```

Code lives in `scripts/npmrds-reports/convert_old_reports_lib/` (a 6016-line monolith split into
16 modules; `convert_old_reports.py` is a shim preserving imports). The pieces that matter most:
`section_builders.py` (`analyze_graph`, `build_graph_section_data`, the multi-measure helpers),
`vocab.py` (old-tool key spaces and buckets), `template_specs.py` (`BRIDGE_GRAPH_SPECS`,
`MEASURE_EXPR`), `compose_bridge.py` (calls the REAL `composeMeasureConfig.js` so converter and UI
can't drift).

Coverage as of 2026-09-16: clean (page-producible **and** full) conversions **290 / 870**.
Multi-measure sections: Info Box **483 / 597**, Route Compare **192 / 216**.

### Building a report from scratch

`scripts/npmrds-reports/report_build.mjs` (spec-driven) — composes through the same
`applyMeasurePick` the UI's Measure Picker calls, so spec-built and UI-built output are identical
by construction. Skill: [`creating-reports.md`](../../../../src/dms/skills/creating-reports.md).
Routes first: [`creating-routes.md`](../../../../src/dms/skills/creating-routes.md) /
`scripts/npmrds-reports/route_build.py`.

### Verifying anything

**Mandatory on every report/RRL/converter touch** — not optional:

```bash
node scripts/npmrds-reports/report_probe.mjs reports/<slug> --auth   # one page
node scripts/npmrds-reports/probe_corpus.mjs                         # golden-corpus regression
```

`--auth` needs a token: `bash scratchpad/npmrds-sub/mint_token.sh`. Without it the probe silently
degrades to anonymous and reports "Welcome back." with 0 sections. The browser URL takes a
`/npmrds` prefix the probe's bare slug does not. See
[`regression-testing-npmrds-reports.md`](../../../../src/dms/skills/regression-testing-npmrds-reports.md)
and [`traversing-report-pages.md`](../../../../src/dms/skills/traversing-report-pages.md).

### Gotchas that have each cost a session

- **Draft vs published sections are DISJOINT arrays.** `/edit/<slug>` renders `draft_sections`;
  the public page renders `sections`, and they point at different component rows. Patch both, and
  when inspecting a page make sure you are reading the array the UI you are looking at renders.
- **Two symbology homes.** A Map section carries its own embedded COPY of the symbology; the
  mapeditor catalog item is not what the page renders. Patch the catalog row AND both section
  copies (see the Gap #3 writeup below for a worked example).
- **`_measurePick.measure` drives units.** Omit it and `resolveLegendUnit` returns undefined, so
  tooltips and legend captions silently lose their units. Every writer must set it.
- **No backfill, by design.** Section chrome (`activeStyle`, section title/kicker) is stamped at
  creation. Sections minted before a default changed keep their old look until regenerated —
  `reportSectionDefaults.js` states this explicitly. An old-looking card is usually a stale
  section, not stale code.
- **A long-running Vite dev server can serve stale modules.** `report_build.mjs` loads
  `reportSectionDefaults.js`/`composeMeasureConfig.js` through `server.ssrLoadModule`, and the
  browser bundle serves `useAddGraphSection.js`. A server started before a change to those files
  can keep writing the OLD values from a CORRECT repo. Restart it after touching them. (Diagnosed
  2026-09-16 from a section written 3 days after its default changed.)
- **`dms raw update --set` corrupts stringified JSON.** Use a full `--data` replace.

## Where the history lives

Everything below is closed or archival — do not treat any of it as a backlog without re-checking it
against live code first. That is exactly the mistake the 2026-09-16 triage found eleven times.

| Area | Live doc | Archive |
|---|---|---|
| UI parity gap ledger | [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md) | — |
| 2026-09-04 feedback batch | [`npmrds-reports-routes-feedback-triage.md`](./npmrds-reports-routes-feedback-triage.md) | — |
| Routes/Reports/Users mesh | [`routes-reports-users-mesh.md`](./routes-reports-users-mesh.md) | — |
| Dynamic Reports + Route Tags | [`dynamic-reports-and-route-tags.md`](./dynamic-reports-and-route-tags.md) | [archive](./dynamic-reports-and-route-tags-archive.md) |
| Report canvas / Design System v2 | [`npmrds-design-v2-implementation.md`](./npmrds-design-v2-implementation.md) | [archive](./npmrds-design-v2-implementation-archive.md) |
| Report authoring UX overhaul | [`report-authoring-ux-overhaul.md`](./report-authoring-ux-overhaul.md) | [archive](./report-authoring-ux-overhaul-archive.md) |
| ReportRouteList (RRL) | [`reportroutelist.md`](./reportroutelist.md) | [archive](./reportroutelist-archive.md) |
| Report page redesign | [`report-page-redesign.md`](./report-page-redesign.md) | [archive](./report-page-redesign-archive.md) |
| Old-reports conversion | `src/dms/planning/tasks/current/old-reports-conversion.md` | [archive](../../../../src/dms/planning/tasks/current/old-reports-conversion-archive.md) |
| Testing / golden corpus | [`report-probe-expect-and-golden-corpus.md`](./report-probe-expect-and-golden-corpus.md) | — |

Research (evidence, not tracking): `research/npmrds-reports/`, `research/route-creation/findings.md`,
`research/report-page-redesign/findings.md`.

## Progress log

- **2026-09-16** — File created. Full-arc triage against live code: **13** items documented as open
  were already closed, moot, or dead (table above); gap #3 fixed and live-confirmed;
  `arc_inventory.py` added so the doc inventory regenerates instead of drifting.
- **2026-09-16 — SHIPPED this session** (all converter-only, all live-verified, golden corpus 9/9
  PASS after each): **Gap #3** hover popover now names the segment (Road/Direction/TMC);
  **Info Box multi-measure** (step 1, 483/597 instances); **Route Compare multi-measure**
  (step 1b, 192/216); **section titles** now name every measure a box contains; **tooltip units**
  — converted reports were missing `_measurePick.measure`, which silently disabled the existing
  `resolveLegendUnit` → `tooltip.valueLabel` chain, so every converted graph showed bare numbers.
  Details in `old-reports-conversion.md`; the units fix has its own section there.
- **2026-09-16 (later, same day)** — First triage pass was **incomplete**: it worked from the UI
  parity-gap ledger and a few cross-cutting docs, and missed the old-reports conversion workstream
  entirely. Redone as a systematic sweep of every live arc doc; the 1.0 table above is the result.
  Headline correction: the real 1.0 question is a conversion-coverage scope call (item #1), not a
  UI gap.
