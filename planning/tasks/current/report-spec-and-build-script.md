# Report spec + `report_build.mjs` (declarative NPMRDS report authoring)

**Status:** Phase A + Phase B COMPLETE — 2026-07-27. `scripts/npmrds-reports/report_build.mjs` builds a live report
page from a spec; the parity mechanism is proven (written rows byte-identical to composed states) and
the first live build (page `2195822`) renders correctly. The format reference is written
(`research/npmrds-reports/report-spec.md`). The dead `--verify` flag is removed and its live-assertion
successor is deferred with an explicit trigger (see "The `--verify` decision" below). The skill split
(Phase A) is done: `src/dms/skills/creating-routes-and-reports.md` no longer exists, replaced by
`creating-reports.md` (spec-first) + `creating-routes.md`, with the old "Known UI gaps" list moved to
`planning/tasks/current/report-route-ui-parity-gaps.md` (Phase C's tracking file).

Remaining before this file can move to `completed/`: Phase C (the ranked UI-parity gaps) and the two
follow-ons Phase B spawned — the `minutes_seconds` value format and the difference-graph color
polarity, which share one mechanism — tracked separately and listed under "Follow-ons" below.

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
- **Phase B** (this file): the spec format + `scripts/npmrds-reports/report_build.mjs` + live proof.
- **Phase C**: close the ranked UI-parity gaps.

Ordering rationale: writing the skill first would mean carefully documenting click-path workarounds
that Phase B makes unnecessary.

## Scope

**In scope:**
- A report spec JSON format (routes + graphs + provenance).
- `scripts/npmrds-reports/report_build.mjs` — spec → live report page (clone Report Page template, compose graph
  sections, write the `reports_snap_2` row, optional publish).
- `--summary` (plain-language "what this report will show", no writes). ~~`--verify` (live
  assertions via `report_probe.mjs`)~~ — dropped, see "The `--verify` decision"; live checking stays
  in `report_probe.mjs` where it belongs.
- Live proof: rebuild the NY-9D Beacon report from a spec into a NEW page and diff section state
  against the hand-built original (`converted_reports/page_13_13`).

**Out of scope:**
- Folders, report discovery/browsing, permissions — **permanently**, per user direction
  2026-07-27; these fold into DMS native primitives later. Do not list them as gaps.
  (Memory: `project_reports_folders_discovery_permissions_out_of_scope`.)
- Route *creation* (the routecreation map tool). The spec references routes by id; making them is
  a separate skill.
- **Anything in transportNY.** All code here lives in dms-template — user direction 2026-07-27,
  memory `feedback_all_code_in_dms_template`.

  **2026-07-29 update: transportNY is no longer needed for routes/reports work at all.** The
  routecreation plugin (and macroview) have been ported natively into dms-template via
  `theme.mapPlugins` (`planning/tasks/completed/port-transportny-map-plugins.md`) — the paragraphs
  below describing the manual cross-repo sync dance, submodule-path rewrites, and "is transportNY
  currently byte-aligned" checks are now historical. They're kept for context (and because
  `RouteComparison` was last confirmed to still be transportNY-only — check
  `research/npmrds-reports/reportroutelist-cross-repo-sync.md` before assuming that's changed too),
  but nothing in this task requires touching transportNY anymore.
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
2. **`scripts/npmrds-reports/convert_old_reports.py`** (4,991 lines) — fully automated, but only from an *old*
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

### 2. `scripts/npmrds-reports/report_build.mjs`

Node (not Python) specifically so it can `import` the theme's real composition module.

Steps: load page template `2187021` → clone its RRL + Add-a-Route sections with fresh trackingIds →
per spec graph, run `applyMeasurePick` through the shim over a fresh AVL-Graph state → write
section rows → write the `reports_snap_2` row (route instances with `route_comp_id`, dates, color,
weekdays, `graphIds` resolved from graph keys) → optionally publish.

Modes: `--summary` (plain-language description, no writes), `--dry-run` (print composed state, no
writes), `--publish`.

### 3. ~~`--verify` assertions~~ — SUPERSEDED

This section originally proposed four live assertions behind a `--verify` flag. Three turned out not
to need a browser and the fourth belongs on the probe, so the flag was removed rather than finished.
The reasoning, and the trigger for building its `report_probe.mjs --expect` successor, are in
**"The `--verify` decision"** below. The structural checks that survived run unconditionally on every
build and exit `1` on failure.

## Files requiring changes

- **DONE** `scripts/npmrds-reports/report_build.mjs`
- **DONE** `research/npmrds-reports/report-spec.md` — the format reference (spec fields, the
  resolution-migration caveat, the difference-graph sign convention). Note the path: root
  `documentation/` was a directory this arc invented and it has been removed — the repo's root
  convention is `planning/` + `research/<topic>/`, and `documentation/` is sanctioned only inside
  `src/dms/`. The two field-note docs moved to `research/npmrds-reports/` alongside this one.
- **DONE** example spec at `scratchpad/npmrds-sub/report-specs/ny9d-beacon.json`
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
- [x] Byte-compare one composed state against a live UI-built section — DONE 2026-07-27, composed
      `overview` vs live section `2195807`. Every difference explained; **all three key-name
      divergences resolve in the composed state's favor** (the live section carries inert
      legacy-`graph`-era keys inherited from the page template). Full writeup:
      `research/npmrds-reports/npmrds-report-data-shapes.md` §4. Diff must exclude `state.data`,
      `comparisonSeries.config` and `externalSource.columns` or it's ~3,500 noise keys (§5).
- [x] Build the NY-9D Beacon spec into a NEW page — DONE 2026-07-27, page `2195822`. All 3 written
      section rows byte-identical to the composed states; color config byte-identical to
      `page_13_13`'s hand-built difference sections. Remaining differences vs the hand-built page are
      all explained: legacy dead display keys the template injects (§4 of the data-shapes doc), and
      the user's own later hand-edits to `page_13_13` (2195815 → hourly).
- [x] `reports_snap_2` row: every route instance has non-empty `graphIds`, correct dates/colors —
      verified, 4 instances × 2 graphIds, 4 **unique** names, correct TMC arrays, and each graph
      trackingId resolves to exactly 1 section row.
- [x] Difference graph renders with the spec-named anchor as Main — verified: `invert:false` on both,
      so anchor = the spec-named `nb_before`/`sb_before` arm and the difference is before − after.
      **BUT the color direction is semantically backwards** — see the finding below; it is NOT a spec-
      build defect (byte-identical to the hand-built page) so it does not block this task.
- [x] Page renders live with real (non-placeholder) values — verified at the **`/edit/` URL** (the
      page is draft-only, so the public URL legitimately has nothing to render). 3/9 sections carry
      SVG (other 6 are edit-mode Add placeholders): overview = 4 correctly-labeled series, clock-time
      x-axis; both difference graphs = diverging bars with mixed ± values. 0 console errors, 0 page
      errors, 0 pending-at-close.
      **Rendered on FIRST LOAD with no re-save dance** — the UI click-path needed a section re-open +
      re-save before difference graphs would fire (memory
      `project_ny9d_difference_graphs_and_epoch_axis_bug`). The spec path does not. Concrete win.
- [x] ~~`--verify` catches a deliberately-broken spec~~ — **flag removed instead**, see the decision
      below. The negative case it was meant to prove (drop a `graphs` assignment) is already covered
      by the structural checks, which run unconditionally and exit `1`.
- [ ] Published-row check: verify against `data->'sections'`, not `draft_sections` — **deferred with
      `--publish` itself.** The page is draft-only by choice and nothing has been published, so
      there is no published row to check. Do this the first time a spec-built report is published
      for real.
- [x] `research/npmrds-reports/report-spec.md` written — full field reference (top-level / `graphs[]`
      / `routes[]`), the four easy-to-get-wrong semantics (name-collapse, weekday mask, anchor sign,
      resolution-will-migrate), modes, the three-layer check model, and a worked example.

## The `--verify` decision (2026-07-27): flag removed, `--expect` deferred

`--verify` was specified as four live assertions. Taken one at a time, three of them don't need a
browser at all:

| intended assertion | needs a browser? |
|---|---|
| no route comp has empty `graphIds` | **No** — a structural check, runs pre-write on every build |
| difference anchor == the spec-named arm | **No** — decidable from `combine.invert`, which the script already computes |
| every graph section fired a `/graph` request | No *spec* knowledge needed — `report_probe.mjs` reports this unprompted |
| returned series count == route instances assigned to that graph | **Yes** — the only one needing both live data and the spec |

And as implemented it asserted nothing: it shelled out to `report_probe.mjs <slug>` with no `--auth`
on the *public* URL of a draft-only page — so it could only ever print `0/0` — then dumped the last
25 lines for a human to read. Removed 2026-07-27, along with the now-unused `existsSync` import; the
build's closing line now prints the right probe command instead (`edit/<slug> --auth` when draft).

**Why the remaining assertion isn't the build script's job.** There are three layers: spec → composed
state, composed state → written row, and written row → what renders. The first two are what "does the
builder build what the spec says?" means, and both are already proven without a browser (parity by
construction; written rows byte-identical to composed states). Only the third is open — and its
failures are **platform bugs, not build bugs**. Both prerequisites folded into this task
(`epoch-time-format-bucket-width`, `length-query-calculated-groupby-alias`) had a *correct* composed
state and a broken page. So a spec-aware live check isn't verifying the builder; it's using the spec
as a statement of intent that makes the rendered output assertable at all.

**Deferred successor: `report_probe.mjs --expect <spec.json>`.** Correct home because the probe
already holds the live data and would work against *any* page, including hand-built ones like
`page_13_13` — whereas a flag on the builder only ever checks the case least likely to be wrong.
Its value is proportional to how often it runs unattended: run once by hand after a build it is
strictly worse than reading the probe's own output (console errors, pending requests, per-section
SVG census, series labels — far more signal than four assertions). **Trigger to build it:** three or
more specs in `scratchpad/npmrds-sub/report-specs/`, or the first graph-engine change that needs
re-checking against existing spec-built reports.

## Follow-ons (both want one mechanism)

Not Phase B work, but spawned by it, and they should be done together because they need the same
thing — a **per-measure hint in `vocabulary.json`, consumed by `composeMeasureConfig`** at the point
it now sets `xAxis.epochMinutesPerUnit`:

1. `src/dms/planning/tasks/current/duration-value-format-mm-ss.md` — a `minutes_seconds` ValueFormat
   plus a `valueFormat` hint on the duration measures, so travel-time axes render `0:54` not `0.9`.
2. The difference-graph color polarity below — needs a "lower is better" hint on the same measures.

Both touch shared composition code that the live UI runs, so they need the isolation treatment
(`feedback_isolate_shared_code_changes`) rather than riding along with anything else.

## Finding: difference-graph color scale reads backwards (pre-existing, NOT a spec-build defect)

Live-observed 2026-07-27 on the spec-built page, then confirmed identical on the hand-built
`page_13_13`. Both difference sections carry:

```json
"colors": { "type": "palette", "byValue": true, "byValueSymmetric": true,
            "value": ["#1a9641","#a6d96a","#ffffbf","#fdae61","#d7191c"] }
```

Palette index 0 (green) maps to the lowest value and index 4 (red) to the highest. The difference is
`before − after`, so a **positive** bar means travel time FELL — the improvement the client is paying
to see — and it renders **red**, while a regression renders green. Neither report sets `reverseColors`.

Not a spec-build regression: the spec-built and hand-built sections' color config are byte-identical,
so this is a property of the Measure Picker's difference-mode default. Two candidate fixes, both
outside this task's scope (`applyMeasurePick`/`composeMeasureConfig` are consumed as-is per Scope —
and changing the default would silently flip every existing difference graph, so it needs the
isolation treatment of `feedback_isolate_shared_code_changes`):

1. Set `reverseColors` (or reverse the palette) for difference mode where "lower is better" measures
   are involved — needs a per-measure polarity hint in the vocabulary, since for a measure where
   higher is better the current direction would be right.
2. Leave the default and expose the knob in the spec + Measure Picker, so the author decides.

Option 1 is the real fix but requires the vocabulary to know each measure's polarity — the same
per-measure-hint mechanism the `minutes_seconds` ValueFormat work needs, so they pair naturally.

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

Interim options if the CLI fix is deferred: read the split table via `scripts/npmrds-reports/dbq.py new` (sanctioned
for read-only validation, but bypasses the CLI rule), or require `tmc_array` inline in the spec
(rejected — duplicates catalog data into every spec and goes stale).

Also observed while testing: intermittent `getaddrinfo EAI_AGAIN mercury/neptune.availabs.org` from
both the CLI and dms-server's task poller, while `preflight.py` resolved the same hosts fine
seconds later. Flaky DNS, not a down VPN — retry before diagnosing anything as unreachable.

## Progress log

- **2026-07-27 (session 1)** — Task created. Reuse target (`applyMeasurePick`) identified and read;
  converter's load-bearing details extracted; stack preflight healthy.
- **2026-07-27** — `scripts/npmrds-reports/report_build.mjs` WRITTEN. Modes: `--summary` (plain-language review, no
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

- **2026-07-27 (session 2)** — Spec pointed at the REAL routes; composed-vs-live parity diff done;
  data-shape gotchas written up durably in **`research/npmrds-reports/npmrds-report-data-shapes.md`** (read it
  before doing any DB inspection of report pages — 10 items, each one cost real time to rediscover).
  - **Real route ids**: NB = **2195805** (TMCs `120+29713,+29712,+29714`), SB = **2195804**
    (`120-29713,-29711,-29712`). `2195803` is a superseded 2-TMC SB variant; `2195782`
    ("marker_route") was only ever placeholder. Both real routes are *baseline-period* rows —
    one route per **direction**, not a before/after pair. Before/after is a property of the route
    **instance's date window**, so the spec's original shape (two instances sharing one `route_id`)
    was already right; only the ids and windows were wrong.
  - **Corrected windows: Jan/Feb 2025 vs Jan/Feb 2026** (same season year-over-year, per the actual
    client ask in memory `project_ny9d_beacon_report_shipped`) — NOT the Mar-Apr 2025 window the
    placeholder spec carried, which would have compared winter against spring.
  - `--summary` and `--dry-run` both re-verified against the real routes; route resolution through
    the fixed `dms dataset query` path works. 3 graphs compose (overview / nb_diff / sb_diff),
    anchors resolve correctly (`nb_before − others`).
  - **FIXED in `report_build.mjs`**: `--dry-run`'s trailer line moved from stdout to stderr, so its
    stdout is now valid JSON and pipes into `jq`/`json.load` without trimming.
  - **Parity target recorded** for page `2195810` (slug `converted_reports/page_13_13`): 4 route
    instances `comp-0..comp-3`, colors `#D72638 / #007F5F / #F8A100 / #38BFA7`; graphs by
    trackingId — `36c04103` overview LineGraph (all 4), `01ed2831` NB diff, `86fbb688` SB diff.
  - **The live page has since been hand-edited by the user** (their FYI, mid-session): section
    `2195815`'s resolution is now `hour` rather than the documented 5-minutes, the AVL Graph titles
    are empty, and sections `2195819`/`2195820` are orphans not in `draft_sections`. So a strict
    whole-page byte-diff is no longer the right acceptance test — diff per-section against sections
    known to be Measure-Picker-composed, and attribute the rest to manual edits.
  - Two findings worth their own attention, both in `npmrds-report-data-shapes.md`: orphan sections
    `2195819`/`2195820` carry **duplicate trackingIds** with live sections (§3 — collides on the
    exact key route wiring uses), and the **Report Page template's starter AVL Graph section carries
    dead legacy display keys** (§4 — `yAxis.tickFormat`, `display.margins.*`, `xAxis.tickSpacing`;
    nothing in `graph_new` reads any of them).
- **2026-07-27 (session 2, cont.) — FIRST LIVE BUILD RAN, and the DB side is fully verified.**
  `node scripts/npmrds-reports/report_build.mjs scratchpad/npmrds-sub/report-specs/ny9d-beacon.json` (draft only):
  - Created page **2195822** slug `converted_reports/ny9d_beacon_spec_test`, 5 draft sections
    (`2195823` ReportRouteList, `2195824`/`2195825`/`2195826` AVL Graph, `2195827` Spreadsheet),
    `reports_snap_2` row **2195828** with 4 route instances. Structural checks all passed.
  - **All 3 written AVL Graph section rows are byte-identical to the `--dry-run` composed states**
    (verified by sorted-JSON compare, not eyeball). So the write path adds/loses nothing — the
    "CLI-built and UI-built are identical by construction" claim now has its first real evidence.
  - Snap row correct: 4 **unique** names (incl. the proper `Jan-Feb 2026` labels the hand-built page
    gets wrong as `... Jan-Feb 2025 (2)`), right dates/colors/TMC arrays, 2 `graphIds` each.
  - Route→graph wiring resolves correctly: overview fed by all 4 arms, nb_diff by comp-0/comp-2,
    sb_diff by comp-1/comp-3 — and **each trackingId appears in exactly 1 row**, i.e. none of the
    duplicate-trackingId orphan collision the hand-built page has.
  - Fixed a misleading log line: route resolution echoed the *catalog* row name, so two instances
    sharing one route printed identically and a correct build looked collapsed. Now prints the
    spec's instance name, with the catalog name in parens when they differ.
  - **BLOCKED on browser verification: the probe auth token is EXPIRED** (`.dms-auth-token`, minted
    Jul 24). The edit-route probe rendered the login page ("Welcome back.", `0/1` sections) —
    `--auth` degrades to anon silently, exactly as `report_probe.mjs`'s header warns. The public-URL
    probe's `0/0` is separately just the page being draft-only (`published='draft'`, 0 published
    sections). Neither result is evidence of a build defect. To finish: have Ryan run
    `scratchpad/npmrds-sub/mint_token.sh`, then re-probe the edit URL — or `--publish` and probe the
    public URL.

### Exact next steps for a fresh session

**Phase B is done** — everything the old version of this section listed has either been completed or
consciously dropped. Don't re-derive it; read "The `--verify` decision" and "Follow-ons" above first.

Next, in arc order:

1. ~~**Phase A — the skill split.**~~ **DONE 2026-07-27**, see progress log below.
2. **The paired follow-ons** (`minutes_seconds` + difference-color polarity) — one vocabulary-hint
   mechanism, isolated from other changes.
3. **Phase C** — the ranked UI-parity gaps, which the spec format now makes enumerable: every spec
   field with no Measure Picker / ReportRouteList control is a gap. `weekdays` is the cheapest
   (runtime already honors it, no control exists). Now tracked in
   `planning/tasks/current/report-route-ui-parity-gaps.md` (ranked list, written as part of Phase A).

- **2026-07-27** — Task file created. Investigation complete: reuse target (`applyMeasurePick`)
  identified and read; converter's load-bearing details (`state.data`, section row shape, colspan)
  extracted; stack preflight healthy. Next: write `documentation/report-spec.md` + the script.

- **2026-07-27 (session 3) — Phase B closed out.**
  - **Root `documentation/` removed.** It was a directory this arc invented (commit `d3373b3`),
    holding only its own two files; the repo's root convention is `planning/` + `research/<topic>/`,
    and `documentation/` is sanctioned only inside `src/dms/` per `src/dms/CLAUDE.md`. Both docs
    moved to `research/npmrds-reports/` and all references rewritten — 6 in-repo files (`todo.md`,
    2 root task files, 2 `src/dms` task files, `creating-routes-and-reports.md`) and 5 memory files.
  - **`research/npmrds-reports/report-spec.md` written.** Field reference for all three levels, the
    four easy-to-get-wrong semantics, the three-layer check model, and a worked before/after example.
  - **`--verify` removed from `report_build.mjs`** (plus its now-dead `existsSync` import). Full
    reasoning in "The `--verify` decision" above; the short version is that it asserted nothing and
    three of its four intended assertions never needed a browser. Usage text and the build's closing
    line now point at the right probe invocation instead, including `edit/<slug> --auth` for the
    draft-only case that the old flag got wrong. `--summary` re-run against the real spec to confirm
    nothing else broke.

- **2026-07-27 (session 4) — Phase A (skill split) done.**
  - `src/dms/skills/creating-routes-and-reports.md` **deleted**, replaced by
    `creating-routes.md` (route creation only: TMC-chain identification, the transportNY-only
    routecreation tool, cross-repo note) and `creating-reports.md` (report building, now spec-first:
    the main flow is write-a-spec → `report_build.mjs`, with the old UI click-path kept as a
    documented second column for one-off hand-edits, pointing at `report-spec.md` for the field
    reference instead of restating it).
  - **Stale claims corrected, not just moved.** The difference-graph section's "epoch tick format
    bug NOT fixed" claim was actually resolved earlier the same day by
    `epoch-time-format-bucket-width.md` (DONE, live-confirmed) — dropped from the new skill rather
    than carried forward. The "known bugs hit building this" block was entirely superseded (both its
    bugs are DONE) and was not carried into the new skill. The *other*, still-real re-save quirk (RRL
    wiring changes not re-triggering a graph's query without an explicit re-save) was kept, as gap
    #12 in the new tracking file (renumbered from #11 2026-07-27 when a new route-creation gap was
    inserted — see that file's progress log) — this task's own testing checklist shows the spec path doesn't hit
    it, which is evidence but not proof the UI-only cause is fixed.
  - **"Known UI gaps" list moved** (not just copied) into
    `planning/tasks/current/report-route-ui-parity-gaps.md` — Phase C's tracking file, gaps ranked
    by (fix cost) × (how often it bites) rather than left in encounter order. `weekdays` (no UI
    control despite the runtime already honoring it) ranked cheapest/first.
  - Updated all cross-references to the old filename: `research/report-page-redesign/findings.md`,
    2 `src/dms/planning` task files (`length-query-calculated-groupby-alias.md`,
    `epoch-time-format-bucket-width.md`), the skills `README.md` index, and 3 memory files
    (`reference_creating_routes_and_reports_skill`, `project_ny9d_difference_graphs_and_epoch_axis_bug`,
    and the `MEMORY.md` index lines for both).
  - The doc-path staleness this file's old "Exact next steps" flagged
    (`documentation/…cross-repo-sync.md`) turned out to already be correct in the live skill file —
    no fix was needed there.
