# NPMRDS Routes & Reports — the 1.0 tracker

**Project:** TransportNY · **Topic:** themes · **Status:** OPEN — this is the single entry point for
the Routes/Reports arc as of 2026-09-16. · **Started:** 2026-09-16

> **Read this file first.** The arc accumulated ~45 task docs across two repos. A 2026-09-16 triage
> checked each remaining "open" item against live code and found **most were already shipped but
> still documented as open**. This file is the current truth; everything else is history. Regenerate
> the full doc inventory any time with:
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

| # | Item | Where | State |
|---|------|-------|-------|
| 1 | Difference-graph re-wiring bug (old gap #12) | — | **Owned by a separate session** as of 2026-09-16. Found while validating gap #12; a `golden_corpus_difference_linegraph` corpus entry + spec are in the working tree from that work. Not to be picked up here without checking with Ryan first. |

That is the whole 1.0 list. Everything else below is either closed, deferred by an explicit
decision, or out of scope.

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

- **2026-09-16** — File created. Full-arc triage against live code: 11 items documented as open were
  already closed (table above); gap #3 fixed and live-confirmed; `arc_inventory.py` added so the doc
  inventory regenerates instead of drifting.
