# Report spec + `report_build.mjs` (declarative NPMRDS report authoring)

**Status:** IN PROGRESS — 2026-07-27. Phase B of the reports-skill refinement arc.
`scripts/report_build.mjs` EXISTS and its composition path is verified (`--summary` and `--dry-run`
both working, the parity mechanism proven). **Not yet done: an actual live build.** The blocker that
stopped it (no CLI read path for a Routes Data row) is now FIXED — see
`src/dms/planning/tasks/current/cli-dataset-rows-via-uda.md` — so the next session can go straight
to running a real build with `--verify`.

Read this whole file before continuing; three prerequisite bugs were found and fixed along the way
and their task files carry detail this one only summarizes.

## Objective

Make an NPMRDS report page buildable from a single declarative JSON **spec**, via a script that
reuses the *exact same* composition code the authoring UI uses — so that CLI-built and UI-built
reports are byte-identical by construction, and "eventual UI feature parity" becomes a checkable
property (does a control exist for each spec field?) rather than a comparison of two
implementations.

Second, equally-weighted objective (user direction 2026-07-27, a **main feature** not a nicety):
the skill must let Claude read a **literal client request** ("a client wants to see how traffic
changed on corridor X between period A and period B") and infer a good report — which graphs,
measures, date windows, resolutions, and route instances satisfy the ask. The spec is the
reviewable intermediate representation where that inference lands and can be corrected *before*
anything is built.

## Arc context

Phase B of a three-phase arc agreed with the user 2026-07-27:

- **Phase A** (after B): split `src/dms/skills/creating-routes-and-reports.md` into
  `creating-reports.md` (spec-first, with a UI column per step) + `creating-routes.md`; correct its
  stale claims; move its "Known UI gaps" list into a tracked task file.
- **Phase B** (this file): the spec format + `scripts/report_build.mjs` + live proof.
- **Phase C**: close the ranked UI-parity gaps.

Ordering rationale: writing the skill first would mean carefully documenting click-path workarounds
that Phase B makes unnecessary.

## Scope

**In scope:**
- A report spec JSON format (routes + graphs + provenance).
- `scripts/report_build.mjs` — spec → live report page (clone Report Page template, compose graph
  sections, write the `reports_snap_2` row, optional publish).
- `--summary` (plain-language "what this report will show", no writes) and `--verify` (live
  assertions via `report_probe.mjs`).
- Live proof: rebuild the NY-9D Beacon report from a spec into a NEW page and diff section state
  against the hand-built original (`converted_reports/page_13_13`).

**Out of scope:**
- Folders, report discovery/browsing, permissions — **permanently**, per user direction
  2026-07-27; these fold into DMS native primitives later. Do not list them as gaps.
  (Memory: `project_reports_folders_discovery_permissions_out_of_scope`.)
- Route *creation* (the transportNY-only routecreation map tool). The spec references routes by
  id; making them is a separate skill.
- **Anything in transportNY.** All code here lives in dms-template — user direction 2026-07-27,
  memory `feedback_all_code_in_dms_template`. transportNY is a test bed (the only place
  routecreation-tool routes can be made), not a development target, and its older-pinned theme +
  `@availabs/dms` copies get changes by the manual port procedure in
  `documentation/reportroutelist-cross-repo-sync.md`. Do NOT treat "only exists in transportNY" as
  a blocker.
  Note the rule is **plugins**, not routecreation specifically: transportNY is a separately-deployed
  *production* frontend and plugins (`src/pages/TransportNYDataTypes/plugins/*`) must live there.
  Everything else is dms-template.

  **Cross-repo state verified 2026-07-27 (after the user bumped transportNY's submodule twice):
  currently byte-aligned — but by MANUAL COPY ONLY, so this is a snapshot, not a guarantee.**
  Verified there is no auto-sync mechanism of any kind: `src/dms_themes/transportny` is a plain
  directory (not a symlink), the theme is absent from transportNY's `.gitmodules` (which lists 7
  other submodules), and `package.json` has no theme dependency and no copy/sync/postinstall
  script. **It will drift again the moment either side is edited — assume it has, and `diff -rq`
  rather than trusting this paragraph.** Both repos' `@availabs/dms` are at the identical commit
  `4e8a1511` (so transportNY now has the `sectionMenuExtensions`/`sectionHeaderExtensions`
  extension points AND the `GraphComponent.jsx` hover-tooltip `xFormat`/`indexFormat` fix);
  `MeasurePicker/` and `data-types/npmrds_graph_vocabulary/vocabulary.json` are byte-identical;
  `QuickControls/` and `ReportRouteList/` differ **only** by the required submodule-path rewrite
  (`../../../../dms/` → `../../../../modules/dms/`). An earlier draft of this file warned that a
  spec-built report would render differently on transportNY — that is no longer true. Re-check
  with a `diff -rq` before repeating the claim either way.
- Any change to `composeMeasureConfig.js` / `applyMeasurePick` behavior. This task *consumes*
  them. If a gap forces a change there, it affects the live UI too — isolate it
  (`feedback_isolate_shared_code_changes`).

## Current state

Three ways a report gets built today:

1. **The UI click-path** — page from Report Page template → insert AVL Graph sections → per-section
   Measure Picker (gated behind the Settings pencil) → per-route graph pills in ReportRouteList →
   publish. Documented in `src/dms/skills/creating-routes-and-reports.md`. Has at least three
   silent failure modes (graph-assignment pill not registering; measure pick lost if Save isn't
   clicked; difference graph needing a no-op re-save to fire its query).
2. **`scripts/convert_old_reports.py`** (4,991 lines) — fully automated, but only from an *old*
   `admin2.reports` row. No path to a new report. Composes graph state by cloning
   `avl_graph_template` rows built by ~30 `ensure_*_template` functions.
3. Nothing declarative. No artifact states what a report is *supposed* to be, so correctness can
   only be checked by DB query + eyeballing.

### The reuse target (verified by reading, 2026-07-27)

`src/themes/transportny/components/MeasurePicker/index.js` exports **`applyMeasurePick({state,
dwAPI, currentComponent}, partial)`**. Its own docstring: "The apply sequence shared by every entry
point … byte-identical regardless of caller so the two entry points can never silently drift." It
performs the whole mutation:

- defaults `externalSource` to `BASE_SOURCE` when unset (`index.js:121-123`)
- replaces columns carrying `MANAGED_TARGETS = ['xAxis','yAxis','color']`, never `categorize`
  (`index.js:131-134`, and the comment above `MANAGED_TARGETS` explains why an origin-only filter
  was live-proven insufficient)
- full-replaces or deletes `join` (`index.js:135-136`)
- sets `display.graphType` / `fetchMode` / `xAxis` / `yAxis` / `colors` (`index.js:139-147`)
- sets/removes `comparisonSeries.combine` (`index.js:149-153`)
- upserts `comparisonSeries.enabled/seriesKey/seriesLabel` plus the `$self`-bound
  `comparison_series` subscriber with `REPORT_SUBSCRIBER_ARGS` (`index.js:162-177`)
- records `display._measurePick` bookkeeping (`index.js:182`)
- then calls `dwAPI.reconcileComparisonSeriesColumn()` separately (`index.js:192`)

So the script becomes a **third caller**, not a reimplementation. It must supply a shim:
`state` (plain object), `dwAPI.setState(fn)` (apply mutator to a plain mutable object — immer
drafts behave the same for the plain assignment/`delete` this code does),
`dwAPI.reconcileComparisonSeriesColumn()` (replicating
`useDataWrapperAPI.js:132-174`), and `currentComponent.defaultState.display.colors`.

### Load-bearing details from the Python converter (do not rediscover)

- **`state.data = []` is required.** `convert_old_reports.py:4150-4152`: UI-created sections always
  carry `state.data`; template `stateJson` doesn't; **BarGraph crashes on undefined viewData**
  (`d3groups(undefined)` → "values is not iterable"). A from-scratch composed state has no template
  to inherit it from, so the script must set it.
- **Section row shape** (`build_cloned_section_data`, `:4262-4276`): `type`, `group`, `level`,
  `title`, `parent` (a JSON **string** `{"id","ref"}`), `trackingId`, `element{element-type,
  element-data}`.
- **Colspan** is the section's own `size` field, "1".."12" (`:4141-4147`).
- Report Page page template is row **`2187021`**; its sections are a self-contained deep copy, so
  editing the template never touches existing pages (route-creation findings Part 7).

## Proposed changes

### 1. Spec format (`scratchpad/npmrds-sub/report-specs/<name>.json` for working specs)

```json
{
  "title": "NY-9D Beacon — signal timing before/after",
  "slug": "converted_reports/ny9d_beacon",
  "request": "Client (City of Beacon) wants to see how traffic changed on NY-9D through Beacon before vs after the March 2025 signal-timing change.",
  "graphs": [
    { "key": "overview", "title": "Travel Time — all periods",
      "graphType": "LineGraph", "measure": "travelTime",
      "resolution": "5-minutes", "comparisonMode": "plain",
      "why": "One overlaid trace per direction/period; lets the client see peak shape shift." },
    { "key": "nb_diff", "title": "Northbound Travel Time Difference",
      "graphType": "BarGraph", "measure": "travelTime",
      "resolution": "15-minutes", "comparisonMode": "difference", "anchor": "nb_before",
      "why": "Direct before-minus-after per time bucket; positive = travel time fell." }
  ],
  "routes": [
    { "id": "nb_before", "route_id": 2195782,
      "name": "NY-9D NB (I-84 → Main St) — Jan-Feb 2025",
      "startDate": "2025-01-01T06:00", "endDate": "2025-02-28T10:00",
      "color": "#1f77b4", "weekdays": { "saturday": false, "sunday": false },
      "graphs": ["overview", "nb_diff"] }
  ]
}
```

Design notes:
- `routes[].graphs` is a **declaration** → `graphIds` is computed, so the silent
  graph-assignment-failure class cannot occur.
- `graphs[].anchor` names the Main arm of a difference graph **explicitly**. Today that's
  implicitly "whichever instance was added to the report first" (`route_comp_id` order), invisible
  in the UI and a coin-flip to get right.
- `request` + per-graph `why` make Claude's inference auditable.
- **`resolution` is per-graph today but is expected to migrate to per-route.**
  `project_report_builder_ui_scoping` records the correction that resolution is a property of the
  attached route in the old tool (`GeneralGraphComp.getResolution()` reads
  `activeRouteComponents[0].settings.resolution`), read at render time; the report-page-redesign
  findings list deriving it dynamically as *explicitly deferred*. Note this in the spec doc so the
  current shape isn't mistaken for settled.
- `weekdays` ships despite having no UI control — the runtime already honors it
  (`useGraphPublish.js:34`), so it's free to carry and is the cheapest first parity win.

### 2. `scripts/report_build.mjs`

Node (not Python) specifically so it can `import` the theme's real composition module.

Steps: load page template `2187021` → clone its RRL + Add-a-Route sections with fresh trackingIds →
per spec graph, run `applyMeasurePick` through the shim over a fresh AVL-Graph state → write
section rows → write the `reports_snap_2` row (route instances with `route_comp_id`, dates, color,
weekdays, `graphIds` resolved from graph keys) → optionally publish.

Modes: `--summary` (plain-language description, no writes), `--dry-run` (print composed state, no
writes), `--verify` (see below).

### 3. `--verify` assertions (turn the known silent failures into hard checks)

Via `report_probe.mjs` + `dbq.py`:
- every graph section issued a `/graph` request (catches the missing-`fetchMode` / never-fetches
  class — `project_routes_data_table_fetchmode_gap`)
- each graph's returned series count == number of route instances assigned to it
- no route comp has an empty `graphIds`
- difference graphs: the anchor arm is the one the spec named

## Files requiring changes

- **NEW** `scripts/report_build.mjs`
- **NEW** `documentation/report-spec.md` — the format reference (spec fields, the
  resolution-migration caveat, the difference-graph sign convention)
- **NEW** example spec(s) under `scratchpad/npmrds-sub/report-specs/`
- No edits to `composeMeasureConfig.js` / `MeasurePicker/index.js` / `useDataWrapperAPI.js`
  expected — consumed as-is (see Scope).

## Testing checklist

- [x] `--summary` prints a sensible plain-language report description from a spec (incl. the
      weekday-mask semantics: only an explicit `false` excludes, so `{sat:false,sun:false}` renders
      `[mon,tue,wed,thu,fri]` — got this backwards on the first pass)
- [x] `--dry-run` composes via the real `applyMeasurePick` (3rd caller, no reimplementation):
      5-min → `epoch` + `epochMinutesPerUnit:5`; 15-min → `intDiv(epoch, 3)` + `15`; both
      `fetchMode:force`, `comparisonSeries.enabled`, `$self` subscriber, `__series` categorize col.
      Anchor honored automatically: naming arm #2 as `anchor` emits `combine.invert:true` rather than
      requiring the routes array be reordered.
- [ ] Byte-compare one composed state against a live UI-built section (not yet done)
- [ ] Build the NY-9D Beacon spec into a NEW page; diff each graph section's state against
      `converted_reports/page_13_13`'s hand-built equivalents; explain every difference
- [ ] `reports_snap_2` row: every route instance has non-empty `graphIds`, correct dates/colors
- [ ] Difference graph renders with the spec-named anchor as Main (sign convention correct per
      `reverseColors` — positive travel-time bars = travel time fell)
- [ ] `--verify` catches a deliberately-broken spec (drop a `graphs` assignment → assertion fires)
- [ ] Page renders live at its non-`/edit/` URL with real (non-placeholder) values
- [ ] Published-row check: verify against `data->'sections'`, not `draft_sections`

## Folded-in prerequisites discovered while building

Both surfaced live on 2026-07-27 and are tracked in their own files under `src/dms/planning/`:

1. **`epoch-time-format-bucket-width.md`** — DONE (module-verified + live-confirmed by the user).
2. **`length-query-calculated-groupby-alias.md`** — DONE (live-confirmed). Two consequences of one
   root cause: a 500 from the length query, and difference mode silently differencing the x column
   against itself. **Both were invisible to unit reasoning and only showed up in a browser** — which
   is the strongest available argument for this task's `--verify` assertions (every graph fired a
   `/graph` request; series count matches assigned instances; the x column is a join key, not a value
   column). Screenshots caught these; assertions should have.
3. **`duration-value-format-mm-ss.md`** — NOT STARTED, do it here: add a `minutes_seconds`
   ValueFormat and drive `yAxis.format` from a new per-measure vocabulary hint, in the same place
   `composeMeasureConfig` now sets `xAxis.epochMinutesPerUnit`.

## BLOCKER (partly fixed 2026-07-27): reading a Routes Data row

Two real CLI bugs found and FIXED; a third layer is a server-side gap and still open.

### FIXED — `--filter`/`--order` sent `data->>'id'` for physical columns
`cli/src/commands/dataset.js` built `data->>'${col}'` unconditionally. `id` (and `app`/`type`/
`created_at`/`updated_at`) are **physical `data_items` columns**, so `data->>'id'` is NULL on every
row and `--filter id=<n>` could never match — the exact footgun already fixed twice server-side (see
`uda-sql-building-landmines`). Added a `PHYSICAL_COLUMNS` set + `columnAccessor()`. Verified: the
filter now emits bare `id` and finds the row (`total: 1`, was `0`).

### FIXED — byIndex requested a path that matches no route, then mis-parsed refs
Two compounding mistakes in `fetchRowsViaOptions`:
1. It requested `dms.data[key].options[opts].byIndex[...]`, but the server registers **`opts`** for
   byIndex and `options` only for `length` (`dms.route.js:226` vs `:256`) — and with no options at
   all, byIndex is the bare `dms.data[key].byIndex` route. Unmatched falcor paths come back as empty
   `{$type:'atom'}` placeholders, which is why every row parsed to `{id: undefined}`.
2. byIndex returns **`$ref`s**, not inlined attrs, and this client does not auto-follow them. The old
   code read `entry[attr]` off the ref and the `if (row.id)` guard silently dropped everything.
   Now mirrors `api/index.js:256-257` for the path and follows refs via `fetchByIds`.
Verified: `items` is populated (3 rows unfiltered, 1 row filtered) where it was always `[]`.

**Both bugs presented identically — a correct `total` beside an empty `items`.** Any caller that
trusts `total` concludes rows exist and then iterates nothing.

### RESOLVED — dataset rows now read through UDA

`byId` genuinely cannot resolve split (`:data`) rows: it is app-namespaced, split rows live in
per-type tables, and the byIndex ref omits the type. Proven side by side — `byId` on the non-split
page template `2187021` returns real data, on Routes Data row `2195782` it returns
`{id:null, data:null}`.

**User decision 2026-07-27**: option (a) (make refs/`byId` type-aware) was **rejected** — too large a
regression risk, since the browser consumes that contract. Went with **(b)**: re-point
`dataset query`/`dump` at the **UDA** routes, which is what the browser already does for dataset rows
and which returns values inline with no refs. Full writeup:
`src/dms/planning/tasks/current/cli-dataset-rows-via-uda.md`.

Verified live: `dms dataset query 2107426 --view 2107427 --filter id=2195782` now returns the real
row (`marker_route`, 9 TMCs). `dms raw get` on a split row now emits a signpost error instead of
silent nulls. **So `report_build.mjs`'s route-resolution step is unblocked** — but note it currently
calls `dms raw get <route_id>`, which will now hit that signpost; **switch it to
`dms dataset query 2107426 --view 2107427 --filter id=<route_id>` before the first live build.**

## Superseded blocker notes

The script must resolve each spec `route_id` to its `tmc_array`/name to embed in the
`reports_snap_2` entry. Routes Data rows are split-table `:data` rows, and **all three CLI paths
fail** (verified live 2026-07-27, dev DB reachable, route "marker_route" id 2195782 known to exist):

| attempt | result |
|---|---|
| `dms raw get 2195782` | `{"id":null,"app":null,...}` — all nulls. Consistent with `reference_dms_section_create_cli_gaps` ("raw update silently no-ops on split (:data) rows"); reads have the same gap. |
| `dms dataset query 2107426 --view 2107427 --filter id=2195782` | `total: 0`. The echoed filter is `data->>'id'` — **the exact documented landmine** in `uda-sql-building-landmines`: `id` is a physical top-level column, NOT a key in the `data` blob, so `data->>'id'` is NULL on every row and can never match. Third known instance of this bug, first in the CLI. |
| `dms dataset query ... --filter name=marker_route` | `total: 1` but `items: []` — the COUNT path resolves the blob column correctly, the ROW-FETCH path returns nothing. Separate CLI bug. |

Both are worth fixing in the CLI rather than worked around, since "always use the CLI for DMS data"
is a repo rule (root `CLAUDE.md`) and any future script hits the same wall. Note the second one is
nastier than it looks: a caller that only checks `total` concludes the row exists and then silently
iterates an empty list.

Interim options if the CLI fix is deferred: read the split table via `scripts/dbq.py new` (sanctioned
for read-only validation, but bypasses the CLI rule), or require `tmc_array` inline in the spec
(rejected — duplicates catalog data into every spec and goes stale).

Also observed while testing: intermittent `getaddrinfo EAI_AGAIN mercury/neptune.availabs.org` from
both the CLI and dms-server's task poller, while `preflight.py` resolved the same hosts fine
seconds later. Flaky DNS, not a down VPN — retry before diagnosing anything as unreachable.

## Progress log

- **2026-07-27 (session 1)** — Task created. Reuse target (`applyMeasurePick`) identified and read;
  converter's load-bearing details extracted; stack preflight healthy.
- **2026-07-27** — `scripts/report_build.mjs` WRITTEN. Modes: `--summary` (plain-language review, no
  Vite boot, no writes), `--dry-run` (compose + print, no writes), `--publish`, `--verify`.
  Loads theme/library modules through **Vite's SSR resolver** (`createServer` + `ssrLoadModule`),
  because these sources use extensionless + JSON imports only Vite resolves — which also guarantees
  the same module graph the browser uses. **Verified working:**
  - `--summary` renders routes/graphs/anchors readably. Got weekday-mask semantics backwards on the
    first pass — only an explicit `false` excludes a day (`useGraphPublish.js:34`), so
    `{saturday:false,sunday:false}` means Mon-Fri, not "nothing".
  - `--dry-run` composes through the real `applyMeasurePick` (3rd caller, zero reimplementation):
    5-min → `epoch` + `epochMinutesPerUnit:5`; 15-min → `intDiv(epoch, 3)` + `15`; both carry
    `fetchMode:'force'`, `comparisonSeries.enabled`, the `$self` subscriber and the `__series`
    categorize column.
  - **Anchor works**: naming arm #2 as a difference graph's `anchor` emits
    `combine.invert:true` automatically instead of demanding the routes array be reordered. >2 arms
    with a non-first anchor is a hard error with a fix hint.
  - Validation catches unknown graphType/measure/resolution (against the vocabulary), duplicate
    route names (auto-suffixed — they otherwise collapse into one series), a difference graph with
    <2 arms, and any graph no route feeds.
  - Route resolution switched from `dms raw get` to `dms dataset query` after the CLI fix (raw get
    cannot read split rows).
- **NOT DONE: no live build has been run yet.** Everything above is compose-and-inspect only. The
  first live run should be `--dry-run` → then without it → then `--verify`.

### Exact next steps for a fresh session

1. `node scripts/report_build.mjs scratchpad/npmrds-sub/report-specs/ny9d-beacon.json --summary`
   (sanity), then `--dry-run`.
2. Point the spec's `route_id`s at real routes. The example spec uses `2195782` ("marker_route",
   9 TMCs) twice, which is fine for a smoke test but is NOT the NY-9D corridor — for the real proof,
   find the 4 NY-9D instances via
   `dms dataset query 2107426 --view 2107427 --filter name=<...>`.
3. Run the build (draft only, no `--publish`), then `--verify`.
4. Diff the composed graph state against `converted_reports/page_13_13`'s hand-built sections and
   explain every difference.
5. Then: `documentation/report-spec.md`, the `minutes_seconds` format
   (`duration-value-format-mm-ss.md`), and Phase A's skill split.

- **2026-07-27** — Task file created. Investigation complete: reuse target (`applyMeasurePick`)
  identified and read; converter's load-bearing details (`state.data`, section row shape, colspan)
  extracted; stack preflight healthy. Next: write `documentation/report-spec.md` + the script.
