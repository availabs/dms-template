# Report spec + `report_build.mjs` (declarative NPMRDS report authoring)

**Project:** TransportNY

**Status, corrected 2026-08-18 (moved to `completed/`):** Phase A + Phase B COMPLETE 2026-07-27.
`scripts/npmrds-reports/report_build.mjs` builds a live report page from a spec; the parity
mechanism is proven (written rows byte-identical to composed states). The format reference is
written (`research/npmrds-reports/report-spec.md`). The skill split (Phase A) is done:
`creating-reports.md` (spec-first) + `creating-routes.md`, with UI gaps moved to
`report-route-ui-parity-gaps.md` (Phase C's own tracking file — always lived there, not duplicated
in this file, so it never blocked this file's completion).

The header above was stale for 8 days — it didn't acknowledge that **"Follow-on: Dynamic Report
spec support" (below) is itself DONE 2026-08-11** (all 12 catalog templates spec-built) or that the
**difference-graph color polarity follow-on is FIXED 2026-07-30** (see "Finding: difference-graph
color scale reads backwards" below). The one item genuinely still open — a `minutes_seconds`
duration ValueFormat so a travel-time y-axis doesn't need to fall back to "Integer" — is tracked in
its own already-separate library task, `src/dms/planning/tasks/current/duration-value-format-mm-ss.md`,
**still NOT STARTED as of 2026-08-18**. Worth a pointer for whoever picks that up: a real, usable
building block landed as a side effect of unrelated work on 2026-08-17 — `durationMinutesFormat`/
`duration_mmss` (`graph_new/utils.js`), added to fix a travel-time *tooltip* showing unreadable
decimals. It produces exactly the `M:SS` output that task wants, but it's wired to the tooltip's own
value format (`display.tooltip.valueFormat`/`yFormat`), not `display.yAxis.format` — so it does
**not** resolve the y-axis-still-shows-decimals complaint by itself, just removes most of the
implementation work for whoever wires it there too.

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

**DEPRIORITIZED 2026-08-11 (Ryan's direction)**: the literal-client-request-inference objective
above is no longer a main feature to weigh decisions against. Don't factor it into report-related
work — spec fields that exist to support it (`request`, per-graph `why`, the intake-checklist
inference workflow in `creating-reports.md`) aren't being removed, but they're no longer a design
priority, and nothing currently being scoped or built (including the Dynamic Report spec-support
follow-on below) should be shaped around this objective. Superseded by the more concrete near-term
goal: a spec source-of-truth for the 12 existing Dynamic Report catalog templates.

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
  `theme.mapPlugins` (`planning/transportny/tasks/completed/port-transportny-map-plugins.md`) — the paragraph
  below describing the manual cross-repo sync dance, submodule-path rewrites, and "is transportNY
  currently byte-aligned" checks is now historical. It's kept for context (and because
  `RouteComparison` was last confirmed to still be transportNY-only — check
  `research/npmrds-reports/reportroutelist-cross-repo-sync.md` before assuming that's changed too),
  but nothing in this task requires touching transportNY anymore.

  **Cross-repo state verified 2026-07-27 (after the user bumped transportNY's submodule twice):
  currently byte-aligned — but by MANUAL COPY ONLY, so this is a snapshot, not a guarantee.**
  Verified there is no auto-sync mechanism of any kind: `src/dms_themes/transportny` is a plain
  directory (not a symlink), the theme is absent from transportNY's `.gitmodules` (which lists 7
  other submodules), and `package.json` has no theme dependency and no copy/sync/postinstall
  script. **It will drift again the moment either side is edited — assume it has, and `diff -rq`
  rather than trusting this paragraph.** Both repos' `@availabs/dms` are at the identical commit
  `4e8a1511` (so transportNY now has the `sectionMenuExtensions`/`sectionHeaderExtensions`
  extension points AND the `GraphComponent.jsx` hover-tooltip `xFormat`/`indexFormat` fix);
  `MeasurePicker/` and `src/themes/transportny/components/MeasurePicker/vocabulary.json` are byte-identical;
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

## Follow-ons

Not Phase B work, but spawned by it:

1. `src/dms/planning/tasks/current/duration-value-format-mm-ss.md` — a `minutes_seconds` ValueFormat
   plus a `valueFormat` hint on the duration measures, so travel-time axes render `0:54` not `0.9`.
   **NOT STARTED.** Needs a new per-measure hint in `vocabulary.json`, consumed by
   `composeMeasureConfig` at the point it now sets `xAxis.epochMinutesPerUnit` — touches shared
   composition code the live UI runs, so isolate (`feedback_isolate_shared_code_changes`) rather than
   riding along with anything else.
2. The difference-graph color polarity below — **FIXED 2026-07-30**, turned out not to need a new
   hint at all; see the finding's resolution note.
3. **Dynamic Report spec support — scoped 2026-08-11, CORE MECHANISM BUILT + LIVE-VERIFIED same day.**
   See the dedicated section below.

## Follow-on: Dynamic Report spec support (scoped 2026-08-11, corrected same day per Ryan)

**Status: route slots + Mechanism B formula fields are DONE and live-verified against a real
published test page.** `report_build.mjs` now builds a real Dynamic Report end-to-end — slots,
`dateFormula`/`derivedFromRoute` (including the `__TODAY__` sentinel), the `dynamicReport` page-filter
write, and the `--from-page` reverse direction (including three real, previously-latent bugs found
and fixed along the way — see "What got built" below). What's NOT done: 2 of `one_week_study`'s 7
real panels ("Bar Graph Summary") turn out to need spec grammar that doesn't exist yet at all — a
newly-found gap, unrelated to slots — and the other 11 catalog templates haven't been attempted.

**The actual, immediate goal — narrower than the first pass at this scoping**: a git-committed spec
that is a true source of truth for each of the **12 existing Dynamic Report catalog templates**, so
they can be thoroughly tested and re-derived without the old DB. Nothing broader than that.

**Where the specs live (Ryan's direction, 2026-08-11) — a deliberate reversal of a prior standing
decision, flagged rather than quietly reconciled**: `report-probe-expect-and-golden-corpus.md`
recorded Ryan's own earlier correction that spec JSON files are ephemeral build inputs, never a
durable fixture — "it's all in the DB," don't accumulate them (`feedback_specs_are_ephemeral_not_
fixtures` memory). That stands for throwaway/dev-time specs. **For these 12 templates specifically,
the spec *is* meant to be the durable artifact** — that's the entire point of this follow-on (point 5
above: stop needing the old DB as the input for this class of page). So they're git-committed at
`scripts/npmrds-reports/dynamic_report_specs/<slug>.json` (one file per template, named after its page slug),
not scratchpad. Scratchpad stays the right home for throwaway specs written to test this feature
during its own development, or for any other one-off report that isn't meant to be a maintained
source of truth — the old rule still applies there.

### Scope boundary (corrected 2026-08-11)

The first pass at this section treated "route slots" and "relative dates" as separable phases (build
slots against concrete dates first, add relative dates later) and didn't draw a hard line around who
this applies to. Both were wrong, per Ryan's direct correction:

- **A Dynamic Report cannot ship with concrete routes OR concrete dates, ever, by design** — the
  entire premise is minimal viewer input at view time (see the "No fixed dates in Dynamic Reports,
  ever" hard rule already established in `dynamic-reports-and-route-tags.md` item 3). So "route slots
  with literal dates" is not a real, buildable intermediate target — none of the 12 templates can
  exist in that half-state, and there is no valid test case for it. Slots and relative dates aren't
  independent phases for this goal; a spec that faithfully represents any real Dynamic Report needs
  both together.
- **Route slots are Dynamic-Report-specific, full stop** — there are exactly 12 of these templates
  today, and the slot mechanism (`routeSlots` page filter, `useDynamicReportRoutes.js`) has no
  meaning on a normal report. This section's route-slot work should never generalize beyond the
  `dynamicReport: true` spec flag gating it.
- **The relative-date formula grammar itself (`dateFormula`/`derivedFromRoute`) is general** — it
  already works on any report today via `RouteRow.jsx`'s Fixed/Derived switch, Dynamic or not. But
  **the viewer-facing "pick a base date" entry-gate prompt (`?asOf=`) is Dynamic-Report-only** —
  `toggleDynamicReport` only ever registers the `baseDate` filter alongside `routeSlots`, never on its
  own. Spec support for the formula fields (item 2 below) is written generally (any route can carry
  them), but the *only* place it's actually needed right now is these 12 templates — this task is not
  "add relative-date spec support to the general report format," even though that happens to fall out
  of it for free.
- **Explicitly out of scope**: "represent/build ANY report via a JSON spec/DSL" is a real, separate,
  larger goal Ryan named as a *direction*, not a target for this task — distance to it is unknown and
  not estimated here. Nothing below should be read as scoping that.

This is still four gaps, and all four are needed together — there is no useful "build (1) alone,
prove it, then add (2)" path, because (1) alone can't represent anything that actually exists. See
"Sizing and recommended order" below for what a real incremental path looks like instead.

### 1. Route slots (unfilled placeholders, resolved at view time)

- `routes[]` needs a slot shape alongside today's concrete shape: no `route_id`; optional
  `route_slot_group` (several slot rows sharing one viewer-picked real route — Year Over Year's "11
  date-range comps, one conceptual route" shape, see `useDynamicReportRoutes.js`'s grouping); optional
  `isPlaceholderName` (mirrors `handleAddRouteSlot`'s auto-generated "Route Slot N" — probably not
  worth exposing, since a spec author can just write the real intended name directly).
- The build-time "resolving routes from the catalog..." loop (`report_build.mjs` around the
  `dataset query` call) must skip slots entirely — no `route_id` to look up, no `tmc_array`, no
  `_row`. Today it hard-fails (`route_id ${r.route_id} not found`) for anything without one.
- The written `reports_snap_2` route entry needs a distinct shape for a slot: only
  `{route_comp_id, color, name, isPlaceholderName?, dateFormula?, derivedFromRoute?,
  route_slot_group?}` — never a real `id`/`tmc_array`/other catalog fields, which get overlaid live
  by `useDynamicReportRoutes` on every page load. Today's `routeEntries` builder always spreads
  `r._row` (the resolved catalog row), which doesn't exist for a slot.
- The page itself needs `filters: [{searchKey:'routes', type:'routeSlots', ...}, {searchKey:'asOf',
  type:'baseDate', ...}]` — the actual mechanism `toggleDynamicReport` (`ReportRouteList.jsx`) flips
  to turn Dynamic Report mode on. `report_build.mjs` never touches `item.filters` today; needs a new
  top-level spec flag (e.g. `"dynamicReport": true`) that writes these two filters at create time.

**What needs zero change**: the graph-level `_measurePick.routeIds` wiring already keys off each
route's own `comp-${i}` regardless of whether that route is concrete or a slot, and the
anchor/`comparisonMode: difference`/structural checks all operate on spec-local ids the same way —
this is why the assignment mechanism itself doesn't need touching, only route validation/resolution
and the write path.

### 2. `dateFormula`/`derivedFromRoute` as first-class route fields (Mechanism B, incl. `calendar:`)

- New optional `routes[]` fields: `dateFormula` (the raw formula string,
  `relativeDateResolution.js`'s grammar — offset, snap, or `calendar:` shape) + `derivedFromRoute` (a
  spec-local `routes[].id`, or the literal sentinel `"__TODAY__"` for the synthetic Today anchor).
  A route with either field omits `startDate`/`endDate` — they're resolved live, never persisted.
- **Validate by reusing the real resolver, not a re-implemented regex** — `report_build.mjs` already
  boots a Vite SSR server to load theme modules for `applyMeasurePick`; `relativeDateResolution.js`'s
  `resolveRelativeDateFormula`/`RELATIVE_DATE_REGEX`/`CALENDAR_POSITION_REGEX` can load the same way,
  so a bad formula string fails the build the same way a bad measure enum does today, and the parity
  guarantee (CLI validates against the exact code the UI runs) extends to this field too.
- **Single-hop check**: `resolveRouteDates` refuses to resolve a route whose own base is itself
  derived (`base.dateFormula` truthy → no-op, silently). The build must replicate this check and
  hard-fail rather than let a spec author accidentally author a chain that silently never resolves at
  view time — the single-hop constraint documented in `traversing-report-pages.md`'s "A derive-from
  base can never itself be derived" section (found live, 2026-08-11, converting `Single Day
  (Advanced)`).
- **Translation at write time**: `derivedFromRoute` in the spec is a spec-local id; on write it must
  become the base's `comp-${i}` (or pass `"__TODAY__"` through unchanged) — the same kind of
  translation `graphs[].anchor` already does, just applied to routes instead of graphs.

### 3. The one sub-gap that does NOT already degrade gracefully: InfoBox `reliability`

- **Map already degrades fine, no new code needed**: its per-report choropleth bake already no-ops
  to placeholder paint when `startDate`/`endDate` are absent across every assigned route (true today
  whenever an author simply omits dates) — a slot/derived route feeding a Map graph hits that same
  path for free.
- **InfoBox's `reliability` measure does NOT degrade** — it hard-fails the build
  (`needs at least one assigned route with a startDate/endDate to period-match source 1410's per-year
  join`) if every route assigned to it lacks a literal date, which is exactly the normal case for a
  fully-dynamic report (no route has a real date until a viewer picks one). This needs an explicit
  design decision from Ryan before it can be built — e.g. default to the resolved Today-anchor's
  year, or require the spec to name an explicit fallback year — not something to guess-and-flag past,
  since picking the wrong join year silently returns the wrong LOTTR/TTTR numbers rather than an
  empty chart.

### 4. `--update` and `--from-page` need a second branch each, not an extension

- `--update`'s reconcile path needs to write/preserve the `routeSlots`/`baseDate` filters (create them
  if the spec says `dynamicReport: true` and the live page doesn't have them yet; leave them alone
  otherwise) — today it only ever touches sections and the page title, never `item.filters`.
- `--from-page` assumes every persisted route entry has a resolvable catalog `id` and literal dates
  (`splitDateTime(e.startDate)` etc.) — a slot entry has neither. Reconstructing one needs a genuinely
  separate branch: recognize a slot (no `id`/`tmc_array`, just `route_comp_id`), recover
  `dateFormula`/`derivedFromRoute` (translating a `comp-N` back to the spec-local id, or passing
  `__TODAY__` through), and recover `route_slot_group`/`isPlaceholderName`. Also needs to detect
  `dynamicReport: true` from the page's own `routeSlots`/`baseDate` filters rather than assuming a
  normal report.

### Sizing and recommended order (corrected 2026-08-11)

Comparable in scope to the original spec-format build documented in this whole file, not a quick
follow-on patch — it touches route validation, the catalog-resolution loop, both write paths
(create and `--update`), page-filter writes (new territory for this script), and a second
`--from-page` branch.

**Not a valid incremental path**: "build (1) alone against a made-up all-concrete-dates Dynamic
Report, prove it, then add (2)" — there is no real template that shape describes, so a spec that
passes that test proves nothing about the actual 12 templates. Slots and relative dates have to land
together to produce a spec that represents something real.

**A better incremental path**: pick the *simplest* of the 12 real templates as the end-to-end proof
target rather than inventing a synthetic one — `one_week_study` is the natural choice, since it's
already the one golden-corpus entry flagged `"NOT spec-built"`, so closing that flag is itself the
acceptance test and needs no new tooling. Get (1) and (2) working together against that single
template first (fewer route slots/comps than most of the other 11, and its Today-anchor/day-chain
formula shape is already well understood from the 2026-08-10 work), confirm the built spec's
`--dry-run` state and the final page match the live hand-converted one exactly, *then* extend to the
remaining 11 — at which point (3)'s InfoBox-`reliability` question becomes concrete instead of
hypothetical: **still needs checking (not done in this pass) which, if any, of the 12 templates
actually have an Info Box `reliability` panel with no literal-dated route anywhere on the page** —
if none do, that sub-gap can be dropped from the critical path entirely rather than requiring a
design decision up front.

### What got built, live-verified 2026-08-11 — exactly the path recommended above

Built against `one_week_study` specifically (the golden-corpus entry already flagged
`"NOT spec-built"`), not a synthetic all-concrete spec, per the "not a valid incremental path" call
above.

**Code changes, `report_build.mjs`:**
- `routes[]` accepts `slot: true` (no `route_id`; requires `spec.dynamicReport: true`), plus
  `route_slot_group`/`isPlaceholderName`. The catalog-resolution loop skips slots entirely.
- `dateFormula`/`derivedFromRoute` (general, any report) validate against the REAL grammar —
  `relativeDateResolution.js` loaded via a plain Node `import()` (zero imports of its own, so no Vite
  boot needed just to check a formula string), not a re-implemented regex. Single-hop enforced as a
  hard build error. Spec-local id ↔ `comp-N` translated both directions (write and `--from-page`).
- `spec.dynamicReport: true` writes the `routeSlots`/`baseDate` page filters (create path unconditional;
  `--update` path additive-only — adds if missing, never removes, never touches `filters` at all when
  the spec doesn't say `dynamicReport: true`), mirroring `toggleDynamicReport` exactly.
- The `reports_snap_2` route-entry write branches slot vs. concrete — a slot writes exactly the shape
  `handleAddRouteSlot`/`addRoutes` write by hand today (no `id`/`route_id`/`tmc_array`).
- `--from-page` reconstructs slots, `dateFormula`/`derivedFromRoute` (translated back to spec-local
  ids), and detects `dynamicReport: true` from the page's own filters.

**Three real, previously-latent bugs found and fixed while wiring this — none of them
slot/dateFormula-specific, all pre-existing:**
1. A real (non-`--dry-run`) build of a Map graph with zero resolvable dates across every assigned
   route used to write `element-data: undefined` (silently dropped from the section entirely, not
   the documented "placeholder paint renders" fallback) — the claim had only ever been verified via
   `--dry-run`, which calls `composeMapGraphState` unconditionally; a real build never did. Fixed:
   `composeMapGraphState` falls back to the current calendar year when no route has a literal date
   (cosmetic — only affects which TMC-network vintage's geometry renders as backdrop, not the live
   query), and the re-bake loop now calls it for a real placeholder instead of leaving the state unset.
2. `--from-page` double-counted every graph section on an already-published page — draft and
   published rows share a trackingId but are separate row ids, and the CLI's `page dump --sections`
   dedupes only by row id, not trackingId, so `_expanded_sections` legitimately contains both copies
   of every section. `one_week_study` was the first real exercise of `--from-page` against an
   already-published page. Fixed: dedupe by trackingId up front, preferring the draft copy (what
   `--update` always edits).
3. `--from-page` could never recover `measure`/`resolution`/`comparisonMode` for any AVL Graph section
   `convert_old_reports.py` built (every one of the 12 catalog templates, for every AVL Graph section
   on them) — its Design-Push-2 routing retrofit (`section_builders.py`) overwrites `_measurePick`
   wholesale with only `weekdays`/`start`/`end`/`routeIds`, wiping whatever the shared graph-template
   row originally carried, and silently produced `measure: undefined` with no flag at all. Fixed:
   `display.graphType` recovered as an independent, durable fallback; `measure`/`resolution`/
   `comparisonMode` flagged `_needsReview` instead of silently wrong, matching the honesty this
   function already gave Map/InfoBox/RouteCompare.

**A newly-found, genuinely separate platform gap, initially NOT fixed, then BUILT same day (see
below)**: 2 of `one_week_study`'s 7 real panels are "Bar Graph Summary" — one bar per route/series, no
time bucketing at all. Read directly off the composed state: its x-axis column is the `__series`
categorize column itself, which matched none of `vocabulary.json`'s 6 real `resolution` shapes at the
time (all six produced a time column — `epoch`/`date`/a calculated weekday or month bucket).
`applyMeasurePick` had no path to this shape; only `convert_old_reports.py`'s own hand-built
section-composition code could produce it. **Corrected after checking the render/query code, not just
the vocabulary**: this turned out to be a shallow gap, not a deep one — see "'Bar Graph Summary' built"
below.

**The proof build** (`scripts/npmrds-reports/dynamic_report_specs/one_week_study.json`, git-committed):
5 of the 7 real panels (everything except the two Bar Graph Summary ones), all 8 route slots grouped
under one `route_slot_group`. First proven against a scratch test page, then — per Ryan's direct
2026-08-11 correction below — **the real live `one_week_study` page (id `2210438`) was deleted and
rebuilt fresh under the same slug from this spec**, replacing the scratch page entirely (deleted after
verifying the real one worked identically). `dynamic_report_one_week_study`'s golden-corpus manifest
entry can now be updated off `"NOT spec-built"` — not yet done, see "Not done" below.

Live-verified via `report_probe.mjs` against the PUBLISHED view (not `/edit/`, where
`useDynamicReportRoutes` is deliberately disabled — authors see raw unresolved slots by design;
probing edit mode first gave a false "empty" reading before this was caught) with a real route
(`?routes=2207838`): **0 console/page/SQL errors**, real ClickHouse-backed chart content on all 5
buildable panels (LineGraph ×2, Map ×2, GridGraph ×1), and the resolved date for the "4 Days Ago"
comp was `2026-07-17` — exactly `defaultAnchorDate()`'s lag-adjusted anchor (`2026-08-11 − 21 days` =
`2026-07-21`) minus 4 more days, confirming the `__TODAY__`/day-offset formula chain resolved
correctly end to end, not just structurally. **A cold-first-load timing gotcha, not a bug**: the
FIRST probe of the brand-new page (default `--wait 6000`) showed the two LineGraph panels empty while
Map/GridGraph rendered fine — re-probing the identical URL with `--wait 15000` showed all 5 panels
correctly; a truly first-ever page load took longer to settle than the probe's default window, and a
second probe of the already-warm scratch page (same spec, same moment) worked fine at the default
wait. Don't mistake this for a real render bug if it recurs on a freshly-built page.

### Corrections, same day, after the first "Not done" pass — all from Ryan directly

1. **The spec-storage directory is renamed** `scripts/npmrds-reports/report_specs/` →
   `scripts/npmrds-reports/dynamic_report_specs/` — Ryan's call: this location is for the Dynamic
   Report catalog's durable specs specifically, not a general "any report's spec can live here"
   dumping ground. Random one-off report specs still don't get a durable git home (the original
   `feedback_specs_are_ephemeral_not_fixtures` rule, unchanged for that class).
2. **Catalog metadata (`tags`/`difficulty`/`page_path`/`graph_count`/`counts_label`) is now tracked ON
   THE SPEC**, not patched onto the snap row out-of-band. Found while reconciling `one_week_study`:
   the `/reports` catalog page (`converted_reports/reports`, id `2208581`) has 5 Card sections, one
   per category, each filtering `reports_snap_2` on `{col: 'tags', op: 'filter', value:
   ['category:<x>']}` — `tags` is the actual row-selection mechanism for the catalog, not just a
   display label, so a spec-built row missing it doesn't render wrong, it's simply **absent from the
   catalog entirely**. Fixed properly rather than patched around: `report_build.mjs` now computes
   `page_path` (`/${slug}`), `graph_count`, and `counts_label` (`"${routes.length} routes ·
   ${graphs.length} graphs"`) directly from the spec on every build — no author input, no chance of
   drift, the exact staleness class Ryan's point 2 below flags for route labels. `tags`/`difficulty`
   are new, genuinely author-supplied top-level spec fields (there's no way to derive "which
   category" from the graphs/routes alone) — `--from-page` round-trips them back too. Confirmed live:
   `one_week_study`'s rebuilt row carries `graph_count: 5` (the honest reduced count, not the stale
   `7` the old row had) and the correct `tags`/`page_path`, and the card still resolves on `/reports`.
3. **No `--update` bootstrap capability for a pre-existing (non-`report_build.mjs`-built) page —
   Ryan's explicit call: don't build it.** The accepted process when this comes up (rarely, per
   Ryan) is manual: delete the old page + its sections + its `reports_snap_2` row, then build fresh
   from the spec under the identical slug (`report_build.mjs <spec.json> --publish`, no `--update`).
   The one real wrinkle (point 2 above) is catalog metadata — now moot, since it's a spec field like
   everything else, so a fresh build reproduces it automatically. Executed exactly this way for
   `one_week_study` itself (see above) — confirmed the URL, catalog card, and live rendering all
   survived the swap. Not automated further; this is deliberately a manual, occasional step.

### "Bar Graph Summary" built — DONE 2026-08-11, same day as the "not fixed" finding above

Ryan pushed back on the "genuinely separate platform gap... not scoped further" framing — correctly:
checking the actual render (`BarGraph.jsx`) and query-building (`buildUdaConfig.js`) code, rather than
just the vocabulary-composition layer, found this shape was **already fully supported end to end**,
just never wired into `composeMeasureConfig.js`'s vocabulary-driven picker:

- `BarGraph.jsx` already had a named `!categoryColumn` branch (a live 2026-08-04 bug fix, comment
  naming "Bar Graph Summary" explicitly) that keys bar colors off the x-axis value when no separate
  categorize column exists.
- `buildUdaConfig.js` already had a named `ungroupedAggregate` collapse for `groupBy: ["__series"]`-only
  queries — also comment-named "Bar Graph Summary" — which is exactly what makes each comparisonSeries
  arm's query correctly fold to one summary row instead of a time series.
- `convert_old_reports_lib/expressions.py` confirmed `SPEED_SUMMARY_EXPR = SPEED_EXPR` (and the same
  for `travelTime`/`hoursOfDelay`) — literal aliases of the SAME `vocabulary.json` measure expressions
  every time-bucketed chart already uses (ClickHouse map/array aggregates that fold correctly at any
  grain, ONE bucket or the whole range). Only `avgHoursOfDelay` is a genuine exception — its summary
  value is bucket-grain-dependent (`_avg_delay_summary_expr`, parameterized per grain) — already
  flagged out of scope in `MeasurePicker/README.md` before this round, unrelated to it.

**Built**: a new `"summary"` resolution key in `vocabulary.json` (`xAxis.type: "series"`), a matching
branch in `composeMeasureConfig.js`'s `buildXAxisColumn` that retargets the `__series` column from
`categorize` to `xAxis` — tagged `origin: 'comparison-series'` (not `MEASURE_PICKER_COLUMN_ORIGIN`) so
the reconcile step's origin-keyed lookup treats it as already-existing and never adds a second,
colliding `__series` column — and a forced, always-explicit `displayPatch.legend` (`show: false` for
`summary`, `true` otherwise) mirroring the old converter's own load-bearing fix for a real live bug
(an unbound raw-expression legend label squeezing the chart to 0 width). `applyMeasurePickToState`
(`index.js`) needed one new line to actually apply a `legend` patch — it previously read `xAxis`/
`yAxis`/`colors` from `displayPatch` but silently dropped `legend`. `avgHoursOfDelay` + `summary` is
guarded, not silently wrong: `composeMeasureConfig` returns `null` (composes nothing, same contract
an unknown `measureKey` gets) and `report_build.mjs` hard-fails that specific combo at spec-validation
time with a clear message, since the live UI's own fire-and-forget call never checks the return value.

**Verified three ways**: (1) `--dry-run` compose byte-matched the reference shape captured from
`one_week_study`'s own OLD live section before it was deleted (`SPEED_EXPR` verbatim as `yAxis`,
`__series`/`target:"xAxis"` as the only other column, no separate categorize column). (2) A real
build+publish to a scratch page returned genuine non-zero ClickHouse values (~29.95 mph) per arm, with
the decoded query showing exactly `"groupBy":["__series"]`/`"ungroupedAggregate":true` — confirming the
mechanism live, not just structurally. (3) The full golden-corpus suite (`probe_corpus.mjs`, mandatory
for any RRL/report-adjacent shared-code touch) ran clean on every OTHER entry
(`golden_corpus_bargraph`/`gridgraph`/`routemap`/`linegraph`, `dynamic_report_monthly_congestion`/
`seasonality`) — confirming the change is isolated and doesn't regress any existing chart type.

Applied to `one_week_study`'s own spec immediately after (both `daily_bar`/`avg_bar` graphs added
back) and rebuilt via `--update` — the real live page now has all 7 real panels, nothing dropped.
Live-verified: 5 bars on the daily summary (matching its 5 assigned routes), 3 on the average summary,
0 console/page/SQL errors. Golden-corpus `dynamic_report_one_week_study` entry re-baselined and its
`source`/`rebuild` fields corrected off `"NOT spec-built"` — full suite re-runs clean (7/7 pass).

**Not done — real follow-ups:**
- The other 11 catalog templates — not attempted at the time this was written; `Single Route` done
  same day, see below.
- InfoBox `reliability`'s no-literal-date fallback — confirmed NOT needed for `one_week_study`
  (it has no Info Box panel at all); still unconfirmed for the other 10.
- `avgHoursOfDelay` + `summary`'s grain-parameterized expression — guarded (hard error), not built.
  **Confirmed actually needed, not hypothetical**: `Single Route` has exactly this panel (a Bar Graph
  Summary of avg. hours of delay) — dropped from its spec rather than built, see below.

### `Single Route` converted — DONE 2026-08-11, with two real findings along the way

**Finding 1 — a standing "DONE" claim didn't hold up against the live DB.** The archive
(`dynamic-reports-and-route-tags.md`) states this template's dates were fixed to Current-Year/
3-Years-Ago/Trailing-3-Years relative dates in the 2026-08-10/11 "no fixed dates, ever" round,
**including a live-verification claim** ("Live-verified 2026-08-11, all 7... 0 console/page/SQL
errors on every one"). Reading the live DB directly (not trusting the doc) found `Single Route` still
on frozen literal years (`"2018"`/`"2023"`/`"2017-2023"`, zero `dateFormula` anywhere) — that claimed
fix never actually landed. **Checked the other 6 templates from the same round**: `Year Over Year`,
`Bi-directional`, `This Month vs. Last Month vs. Last Year`, `Weekly Average`, and `Snapshot` are
ALSO still on frozen literals with zero `dateFormula` — only `Single Day (Advanced)` shows real
relative-date data. So 6 of 7 templates from a round documented as "DONE" with a specific live
verification are not actually fixed. Doesn't change what's needed here (every Dynamic Report gets
correct relative dates as part of being converted to spec-driven regardless of prior claims), but the
false "DONE" record needed flagging, not quiet correction — see
[[feedback_flag_standing_decision_reversals]]. Applied the real, intended formulas by hand
(`startDate=>yearof` / `startDate=>year-3year->1year` / `startDate=>year-2year->3year`), using
`Year Over Year`'s own documented (if likewise not-actually-live) formula choices as the reference.

**Finding 2 — a real, separate `--from-page` bug, not slot/dateFormula-related.** Route→graph
assignment was being reconstructed from each route's own `graphIds` field — dead, write-once
bookkeeping from conversion time (per `useGraphPublish.js`'s own header comment). `Single Route`'s
live AVL Graph sections reference `route_comp_id`s (`comp-1`/`comp-3`/`comp-5`) that don't match any
of its 3 CURRENT routes (`comp-0`/`comp-2`/`comp-4`) at all — a route consolidated/deleted after
conversion, its stale comp ids never scrubbed from the graphs that used to reference them. Using
`graphIds` would have silently produced a spec with wrong route assignments. **Fixed**: reconstruct
from each GRAPH's own live `_measurePick.routeIds` instead (the actual routing field the runtime
reads — matches `useGraphPublish.js`'s real behavior exactly, including silently dropping a
`routeIds` entry whose route no longer exists). Re-verified `one_week_study`'s own reconstruction
under the fix — unchanged, still byte-correct (its data happened to already be internally
consistent, which is why this bug was never exposed there).

**The conversion itself**: 9 of 10 real panels built (LineGraph/BarGraph/GridGraph/Map, one
`comparisonMode: "difference"` panel with the anchor recovered exactly from the live
`comparisonSeries.combine.invert` bit, not guessed). One panel — a Bar Graph Summary of
`avgHoursOfDelay` — **confirmed via the live section's own SQL expression to need the bucket-grain-
parameterized variant** (`_avg_delay_summary_expr("ds.date")` in `expressions.py`, byte-matched
against the live column) that `resolution: "summary"` deliberately doesn't support yet; dropped from
the spec rather than built, per the same "guess and flag" posture as everything else in this
follow-on. Two panels needed a best-guess route reassignment (their original sub-route references
are the same orphaned comp ids from Finding 2 — the exact narrower "by day" windows they fed are
gone, not just relabeled) — flagged via `confidence` on one, plain reasoning in `why` on the other.

Live-verified: 8/11 sections rendered (0 console/page/SQL errors); the one blank AVL Graph panel
(`avgHoursOfDelay`, LineGraph) returned a real, error-free query with a literal SQL `NULL` result —
consistent with a genuine data-coverage gap in the AADT-distributions join for the specific test TMC
(`120P58011`), not a build defect — every other panel using that same TMC, including the OTHER
`avgHoursOfDelay` panel (the Map), rendered fine.

### ROOT CAUSE of the "DONE but not live" finding — found while converting `Year Over Year`

The false "DONE" claim above isn't a mystery — `scratchpad/npmrds-sub/apply_today_relative_patches.py`
(the script that round used) is still on disk, and its `dms_raw_update()` helper does exactly this:

```python
cmd = ["dms", "raw", "update", str(row_id), "--data", json.dumps(data), "--row-type", row_type]
```

That's a plain `dms raw update` against `reports_snap_2` — a **split (`:data`) row type**. `dms raw
update` silently no-ops on split rows (echoes success, doesn't persist) — this exact script's own
call is the single cause of every one of the 6 templates' missing relative dates. Two things masked
it: (1) the script's section-deletion half (`raw delete` on component rows, `raw update` on the
*page* row to trim `sections`/`draft_sections`) targets non-split types, so that part genuinely
worked — explaining why sections were correctly trimmed on `Year Over Year` while routes stayed
fully frozen; (2) the round's own verification (`report_probe.mjs`, checking "does it render without
errors") can't distinguish a frozen-date page from a relative-date one — both render fine.
`Single Day (Advanced)`'s partial state is explained the same way: its `dateFormula` values predate
this round (written via `raw create` during original conversion, which works); this round's only job
for it was repointing `derivedFromRoute` from a sibling comp to `__TODAY__` — a routes-JSON field
edit via the same broken call, so it silently didn't take.

**This also reverses a memory that was actively wrong**: `reference_dms_section_create_cli_gaps.md`
claimed (2026-08-06) that `--row-type` fixes `raw update` on split rows, with a cited verified
read-back. That claim doesn't hold in general — corrected the memory 2026-08-11. The only reliable
pattern for a split row, confirmed by `report_build.mjs`'s own code (never uses `raw update` on
`reports_snap_2` at all) and by this whole conversion effort's repeated success: **delete, then
create** — never update, regardless of `--row-type`, and never trust the CLI's own stdout as proof a
write landed on a split row.

**Practical upside**: the patch script's `REPORTS` dict still has the exact intended comp patches
(names + formulas) for `This Month vs. Last Month vs. Last Year`, `Weekly Average`, `Snapshot`, and
`Bi-directional` — usable directly for those conversions instead of re-deriving the formulas by hand.

### `Annual Average Study`, `Single Day (Advanced)`, `Year Over Year` converted — DONE 2026-08-11

Same treatment as `Single Route`, briefly:
- **`Annual Average Study`**: dates were ALREADY correctly live (this one's claimed fix, from the
  earlier 2026-08-10 round using a *different*, working script, actually held up) — 6 of 10 original
  comps were narrower AM/PM/Off-Peak/day-of-week/by-day/by-month sub-windows of "Current Year",
  orphaned once Design Push #2 moved that filtering to the graph level; re-pointed 3 affected graphs
  at "Current Year" by title intent, dropped one "Bar Graph Summary" that would now show a
  meaningless single bar (the peak-hour comparison it used to show is genuinely gone — a Bar Graph
  Summary's bars are different ROUTES, and only one real route survives). 6/6 real panels live.
- **`Single Day (Advanced)`**: applied the actual single-hop fix — "Incident Day" now derives from
  `__TODAY__` (viewer picks the real date via the entry gate) and all 6 dependent comps repointed to
  derive from `__TODAY__` directly instead of chaining through it, per the archive's own documented
  (never-executed) design. One orphaned-comp reassignment. 6/6 real panels live.
- **`Year Over Year`**: the big one — 10 routes/9 real sections, none of the claimed reduction to 4
  comps had happened at the route level (though section trimming had, per the root cause above).
  Applied the real 4-comp design (Current Year / 1-2 Years Ago / Trailing 3 Years,
  `year-2year->3year` for the trailing window, matching the archive's own target exactly) — every
  Map/LineGraph/BarGraph/InfoBox/RouteCompare panel re-pointed by title intent. `graph_count`/
  `counts_label` on the old row were themselves stale ("21 graphs" vs. 9 real ones) — another
  instance of exactly the staleness class the spec's auto-computed catalog fields exist to prevent.
  7/9 panels showed chart content in the probe; the other 2 (InfoBox, RouteCompare) are
  Spreadsheet/table sections the probe's SVG/canvas detector doesn't recognize — confirmed real via
  decoded query values instead (RouteCompare: a genuine 29.15 mph delta for "1 Year Ago"; InfoBox: a
  real 0.188mi TMC length), not a rendering gap.

4 of 11 remaining templates done as of this point (`Single Route`, `Annual Average Study`,
`Single Day (Advanced)`, `Year Over Year`); 7 left (`This Month vs. Last Month vs. Last Year`,
`Monthly Congestion`, `Monthly Speed Comparisons`, `Seasonality`, `Bi-directional`, `Snapshot`,
`Weekly Average`).

### Remaining 7 templates converted — DONE 2026-08-11, sweep complete (all 12 catalog templates now spec-built)

Same treatment throughout: `--from-page`, cross-reference live `route_comps[].graphIds` against
each section's `trackingId` where `--from-page` couldn't recover measure/resolution (pages that
predate `_measurePick` entirely — every AVL Graph section on that page is unrecoverable, not just
some), `--dry-run`, delete old page+sections+snap row, rebuild+publish, verify via
`report_probe.mjs --wait 15000` with test route `2207838` (and a second value,
`?routes=2207838|||2207838`, for any template needing 2+ independently-picked routes).

- **`This Month vs. Last Month vs. Last Year`**: 15 of 22 sections referenced only orphaned
  day-of-week/summary sub-routes (zero overlap with the 4 real routes). Per Ryan's direct question
  ("does dropping these lose the idea, or were they just orphaned?") — rebuilt the "day of week" and
  "one bar per period" views using the SAME 4 live routes plus `resolution: weekday`/`summary`
  (both graph-level now, no dead sub-routes needed) instead of just dropping them. One panel
  ("Bar Graph Summary, Avg. Hours of Delay") stays dropped — needs `avgHoursOfDelay`+`summary`,
  still unbuilt (1st occurrence).
- **`Monthly Congestion`**: dates/`calendar:` formulas were already correctly live from the earlier
  working round — first real round-trip test of that grammar through the spec path, held up clean.
  One `--from-page` limitation found: a 13th section (an old, pre-marker RouteCompare) was silently
  excluded from reconstruction entirely, not just measure-unrecoverable — `isGraphSectionElement`
  can't tell it apart from the page's own Add-a-Route Spreadsheet section without a marker. Added it
  back by hand.
- **`Monthly Speed Comparisons`**: dropped 2 of 9 graphs ("Average Speed by Peak", "Hours of Delay
  by Peak") needing AM/PM/Off-Peak sub-routes — flagged, not attempted, whether slot routes could
  carry `startTime`/`endTime` to rebuild this without dead routes (2nd occurrence of the
  `avgHoursOfDelay`+`summary` gap, on the delay side).
- **`Seasonality`**: most complex template (18 graphs, 6 routes). Two real fixes: (1) 4 "Speed in
  Compared to Year Average" difference GridGraphs had a dead anchor comp, re-pointed at the live
  Current Year route; (2) 3 of 4 seasons' weekday breakdowns were missing (dead sub-routes) —
  consolidated into one `resolution: weekday` graph on the live Avg Day routes. Dropped 1 graph
  needing `avgHoursOfDelay`+`summary` (3rd occurrence). Verified: the one genuinely empty panel is
  the known AADT-join data-coverage gap; "Fall Average Day" rendering visibly sparser than the other
  3 seasons is explained, not a bug — Fall's window (`9-20..12-19`) is mostly FUTURE relative to
  today, unlike the other 3 seasons' fully-past windows, so most of it is beyond the real ClickHouse
  data cliff.
- **`Bi-directional`**: this page predates `_measurePick` entirely, so `--from-page` recovered
  graphType only — every measure/resolution came from cross-referencing 16 legacy per-year routes'
  `graphIds` against section `trackingId`s by hand. Reduced from 7 literal years x 2 directions down
  to the archive's own target (Current Year / 1 / 2 Years Ago / Trailing 3 Years, matching Year Over
  Year's exact formulas) x 2 directions = 8 real routes, 14 graphs. Two legacy-data issues found and
  NOT preserved: a "Route Map, Speed" fed by only one dropped year (stale single-comp reference,
  merged into a real 4-period map per direction), and a duplicate-label-era bug where one direction's
  Travel Time graph had a stray route from the OTHER direction mixed in (predates the
  comparisonSeries-duplicate-label-collapse fix). Verified with `?routes=2207838|||2207838` (one
  test route per direction) — all 14 graphs render with real data.
- **`Snapshot`**: also predates `_measurePick`. Only 4 legacy comps survived live, 2 of them
  (different `route_slot_group`s, both literally named "2023") turned out to be a redundant slot
  split, not a real 2nd dimension — collapsed to 2 real routes sharing one slot group (Current Year /
  Trailing 3 Years, "All-time Average" folded into Trailing 3 Years per Ryan's own prior "3 years for
  all of these" decision). Reconstructed 3 completely orphaned graphs (Monthly, 2x Weekday) via
  graph-level `month`/`weekday` resolution — zero live routes referenced them at all beforehand.
  Dropped the same AM/PM/Off-Peak pair as Monthly Speed Comparisons (2nd occurrence of that gap) —
  confirmed genuinely blocking, not just unverified, by reading `report_build.mjs`'s own validation
  (a route with `startTime`/`endTime` hard-requires a literal `startDate`/`endDate`, which a
  `dateFormula`-driven slot route never has at spec-write time).
- **`Weekly Average`**: smallest template in the catalog — 2 real graphs, 3 comps, one shared
  LineGraph feed. Comp-1's live name ("Long Long Long Long Long Name Here") was flagged in the
  archive's own patch script as a "placeholder-looking test name," not real content. The single
  BarGraph's shape wasn't recoverable from the section (pre-`_measurePick`), but the report's own
  title/description directly named a "weekday profile with the weekend separated out" —
  `resolution: weekday` was a direct read of stated intent, not a guess.

**All 12 catalog templates are now spec-built**, git-committed under
`scripts/npmrds-reports/dynamic_report_specs/`, and live-verified. Running total of templates
needing the still-unbuilt `avgHoursOfDelay`+`summary` combo: 3 (`This Month vs. Last Month vs. Last
Year`, `Single Route`, `Seasonality`). Running total needing the still-unbuilt
`startTime`/`endTime`-on-a-relative-date-slot-route combo: 2 (`Monthly Speed Comparisons`,
`Snapshot`). Both are real, scoped gaps, not hypothetical — worth building for real now that the
sweep is done, not before.
- `--summary`'s route-window printer shows `route undefined` for a slot (cosmetic only — the real
  build/validation path is unaffected) — never updated to describe a slot/derived-date route in
  plain language.
- Update the golden-corpus manifest: `dynamic_report_one_week_study` no longer needs its
  `"NOT spec-built"` tag.
- **Route/comp labels don't reflect a viewer-picked base date — flagged by Ryan, likely affects ALL
  12 templates, not fixed (not risky, just not top priority).** `one_week_study`'s comps are named
  "Today", "Yesterday", "4 Days Ago", etc. — text baked in when the OLD template assumed "today" meant
  real wall-clock today. Once a viewer can pick an arbitrary `?asOf=` base date, these labels actively
  mislead: a viewer who picks a date three weeks ago still sees a series called "Today" showing that
  three-week-old date. The fix is presentational, not architectural — the resolved base date is
  already computed live (`anchorDateStr` in `ReportRouteList.jsx`); comp names should read something
  like "{resolved base date}" for the anchor itself and "N day(s) prior"/"N day(s) after" for the
  offsets, rather than static English relative-time words. Likely affects every one of the 12
  templates wherever a comp name encodes a relative-time phrase (`Current Year`, `Last Month`,
  `This Week`, etc., not just `one_week_study`'s day-of-week framing) — worth a sweep across all 12
  once this is picked up, not a one-page fix.
- **Dynamic Report pages should show the resolved base date somewhere in the header — scoped, not
  built.** Ryan's ask: at minimum, a Dynamic Report viewer should be able to see WHAT date they're
  looking at without hunting through route labels — "we might just have to add more labels, or use
  better/different route names, I can't always tell what is being shown/visualized." Concretely
  scoped (read directly from the component, not guessed): `ReportPageHeader.jsx`
  (`src/themes/transportny/components/ReportPageHeader/`) is a real section component, separate from
  `ReportRouteList`, that already reads `item`/`editPageMode` off the SAME `PageContext` RRL uses for
  `pageState` — so it can destructure `pageState` too with zero new plumbing. The rest is small: read
  `pageState?.filters?.find(f => f.type === 'baseDate')` for a viewer's `?asOf=` override (same as
  `ReportRouteList.jsx` does), import `defaultAnchorDate()`/`formatDateOnly()` from
  `relativeDateResolution.js` for the default when none is picked, and render a line (e.g. next to the
  existing freshness footline, or in the kicker meta row) like "Viewing as of: 2026-07-21". **One
  real open design question**: gate it on "page is a Dynamic Report" (`pageState.filters` has a
  `routeSlots` entry — cheap, available to the header already) rather than "some comp actually
  derives from `__TODAY__`" (`usesTodayAnchor` in RRL needs the report's own `routes` data, which the
  header doesn't have and would need new plumbing to get) — the simpler gate shows the date on every
  Dynamic Report even if unused by any comp, which is a safe, harmless over-show rather than a
  under-show. Not started.
- `report_probe.mjs`'s tile requests for both Map sections were still `PENDING` at the probe's settle
  window close (`--wait` default 6000ms) even though real canvas content had already rendered —
  likely just slow progressive tile loading on a cold cache, not the unfiltered-scan failure mode
  from past incidents (the request carries real `tmc`/`date` filters), but not chased further.

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

### RESOLVED 2026-07-30 — no new vocabulary field needed after all

Re-derived from first principles, then checked against the Python converter's own long-standing
`REVERSE_COLORS_MEASURES`/`GOOD_DIRECTION_BY_MEASURE`/round-51 history (`convert_old_reports.py`
lines ~380-490, ~3380-3410): `measure.reverseColors` is validated correct for coloring a measure's
**raw value** (round 51: old dataTypes.js's flag, confirmed live — short/good travelTime renders
green, long/bad renders red on a TMC Grid Graph). But a difference graph colors a **before-minus-after
delta**, not a raw value, and going from "which raw value is good" to "which delta sign is good"
provably inverts the polarity for every measure (e.g. travelTime: low raw value is good, but a
*positive* delta — time fell — is also good, and positive sits at the opposite end of the
byValueSymmetric domain from low). `buildDiffColors()` (and the Python `_diff_colors()` call sites
before it) reused the raw flag unchanged for difference mode, so **every measure's difference-mode
color was backwards** — confirmed via `dbq.py new`: 100% of persisted difference sections checked
(including the dev-built `page_13_13`/NY-9D Beacon report — nothing in this arc is live/production,
see `feedback_nothing_is_live_yet` memory) carried the inverted array.

**Fix**: `buildDiffColors` in `composeMeasureConfig.js` now reverses the palette when
`measure.reverseColors` is **false** (was: when true) — i.e. the diff-mode decision is the logical
negation of the raw flag, not the flag itself. One-line change, no new vocabulary field. Also
corrected the (wrong) formula documented in `data-types/npmrds_graph_vocabulary/README.md`.

**Verified live, not just by reading code**: built an isolated scratch page
(`converted_reports/color_polarity_fix_verify`, deleted after) from the real `ny9d-beacon.json` spec
via `report_build.mjs` (no `--update`/`--publish`, draft only), confirmed via `--dry-run` that the
composed `colors.value` is now `["#d7191c",...,"#1a9641"]` (red-low/green-high, i.e. reversed from
before), then ran `report_probe.mjs edit/... --auth` to render it for real against live ClickHouse
data. Screenshot confirms: positive bars (travel time fell, the improvement) render green, negative
bars (travel time rose, regression) render red/orange — correct.

**Also mirrored into the Python converter** (user direction 2026-07-30): `convert_old_reports.py`'s
`_diff_colors()` had the identical bug (same raw-flag-reused-verbatim pattern, one choke point fixes
all ~17 call sites). A **second, independent instance** of the same bug was found and fixed in
`build_graph_section_data`'s custom-`color_range` wiring (the path that fires when an old report
carried its own author-set `color_range` instead of the template default) — that one is shared by
both raw-value graph types (`Route Bar Graph`/`TMC Grid Graph`, correct as-is) and the two difference
types (`Route Difference Graph`/`TMC Difference Grid`, needed the same negation), so the fix there is
conditional on graph type rather than a blanket flip. Future old-report conversions won't reproduce
the bug either way now.

**Scoped fix on already-built pages (user direction 2026-07-30, not a full sweep):** nothing in this
arc is live/production — see `feedback_nothing_is_live_yet` memory, this was a repeated correction.
Only `converted_reports/ny9d_beacon_spec_test` (page 2195822) was rebuilt to pick up corrected
colors. `page_13_13` (2195810) and any other dev-built difference graph were explicitly left
untouched per the user's own scoping — not an oversight.

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

- **2026-08-12** — Three real `report_build.mjs`/converter-lib changes, all spawned by Ryan's
  hand-by-hand review of the 12 spec-built catalog templates against the old tool (full detail in
  `dynamic-reports-and-route-tags.md`, this is a pointer + summary, not a duplicate):
  1. **`isGraphSectionElement()` fixed a systemic silent-data-loss bug**: it only recognized a
     Route Compare/Info Box section via a `_routeComparePick`/`_infoBoxPick` marker this script
     itself invented — `convert_old_reports.py` never stamps either, so any such section the
     Python converter successfully built was completely invisible to `--from-page`, silently
     dropped with no warning at all (found on `annual_average_study`, likely affects other
     templates too — audit deferred, see task file). Fixed by matching structure instead: the
     same self-bound `comparison_series`/`$self` subscriber the live runtime's own
     `findSelfBoundGraphs` uses, plus a `type:'delta'` column as the Route-Compare-vs-Info-Box
     tell.
  2. **Multi-measure Info Box + Route Compare** — `measure` accepts an array (2+) for both graph
     types now; composed fresh per report (not a combinatorially-named shared template); Info Box
     also gained a real plain `speed` measure (was missing entirely — only the unrelated
     `reliability` bucket existed). Full grammar in `research/npmrds-reports/report-spec.md`'s
     "Route/TMC Info Box graphs"/"Route Compare graphs" sections.
  3. **Metadata-unification**: `speed`/`speedTruck` (and Info Box's `speed`/`length`/`aadt`,
     Route Compare's `speed`) repointed from a static, year-agnostic join
     (`TMC_IDENTIFICATION_JOIN`, since removed) to `META_JOIN` (year-matched) — every query now
     pulls TMC metadata for its actual year. Full detail: `src/dms/documentation/npmrds-data-sources.md`.

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
   `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` (ranked list, written as part of Phase A).

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
    `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` — Phase C's tracking file, gaps ranked
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

- **2026-07-30 (session 4) — user triage of `converted_reports/ny9d_beacon_spec_test`, two symptoms,
  three root causes, all FIXED and live-verified.**

  **Symptom 1 — y-axis tick labels repeat ("1 1 1" in a row).** Root cause: `AxisLeft.jsx` /
  `AxisRight.jsx` (`src/dms/packages/dms/src/ui/components/graph_new/components/avl-graph/components/`)
  handed d3 a fixed tick COUNT and a separately-chosen FORMAT with no coupling between them — d3's
  `scale.ticks(10)` picks a "nice" step from the domain alone (here a sub-1-unit travel-time-delta
  range), and when that step is finer than the format's own resolution (`"integer"` here — an
  author-facing ValueFormat choice, `display.yAxis.format`, nothing to do with the
  `duration-value-format-mm-ss.md` follow-on below), several adjacent ticks round to the same label.
  Not measure-specific — reproducible with ANY ValueFormat coarser than the domain's natural step.
  **Fix**: both axis components now compute the candidate tick set explicitly
  (`scale.ticks(ticks)`), format each, and drop any tick whose label collides with the previous
  KEPT tick's label — before handing the (possibly thinned) list to d3, so gridlines (which read the
  same `tickValues`) stay in sync with the visible labels. Linear-scale only; band/ordinal axes
  already have their own thinning logic. No test suite covers this UI package; verified by
  screenshot before/after (`scratchpad/npmrds-sub/tmp/crop_northbound_yaxis*.png`) — before: `2 2 2
  1 1 1 1 1 0 0 0 0 -1 -1 -1`; after: `2 1 0 -1`, gridlines matching.

  **Symptom 2 — difference-graph tooltip/title don't say which route is base vs comparison.** Two
  compounding causes, both in the "the anchor's own raw value never reaches the client" family (see
  clickhouse.js's diff-mode INNER JOIN, `## Finding: difference-graph color scale...` above for the
  sibling color-polarity bug in the same code path):
  1. **Tooltip**: `query_sets/clickhouse.js`'s diff-mode branch projected `compare.__series as
     __series` using the compare arm's OWN unmodified label (e.g. just the route's name) as the
     `__series` discriminator — which `BarGraph.jsx`'s `DefaultHoverComp` renders verbatim as the
     tooltip's key text (`keyFormat(key)`, `Identity` by default). A lone hover then reads
     "<route name>: 1.2" with nothing indicating a subtraction happened, or against what. **Fix**:
     compose BOTH arms' labels into that discriminator string, in the same order as the actual
     arithmetic (`anchor − compare`, or the reverse under `seriesCombine.invert` — checked directly
     off the same `seriesCombine` the arithmetic branch reads, so the label can never drift out of
     sync with the sign). Scoped to `diffMode && i > 0` only — the plain UNION-ALL fan-out and the
     anchor arm's own (unused downstream) label are untouched. Updated the 2 stale assertions in
     `tests/test-uda.js`'s `testClickHouseSeriesCombineDifference` that checked for the compare arm's
     BARE label (`'Route B'`) and added assertions for the composed label + its invert-flip; full
     suite re-run, 93/93 pass.
  2. **Title/subtitle**: `report_build.mjs` only wrote `display.description` (renders as a subtitle
     under the graph title, per `GraphComponent.jsx`'s `GraphTitle`) from an explicit spec-level
     `graphs[].caption` — the `ny9d-beacon.json` spec never set one for either difference graph, so
     neither had any base-vs-comparison text anywhere. **Fix**: when `comparisonMode ===
     'difference'` and no `caption` is given, auto-fill `state.display.description` from the same
     anchor/compare resolution the arithmetic already computes (`g._assigned` + `g._invert`) —
     `"Base: <anchor route name> · Comparison: <compare route name(s)>"`. Verified via `--dry-run`
     against the real spec before touching anything live.

  **Landing the fix on the ALREADY-BUILT page**: `--update converted_reports/ny9d_beacon_spec_test`
  refused — page 2195822's `reports_snap_2` row predates the key→trackingId map feature
  (`--update` needs it to match spec graphs to existing sections; error message points at
  `--from-page` + a fresh non-`--update` build to adopt it, a bigger migration than this fix
  warranted for one scratch page). Instead patched the 2 affected sections' stored
  `display.description` directly via `dms raw update <id> --data <file>` (full-data replace per
  `uda-sql-building-landmines`'s "dotted --set corrupts stringified JSON" footgun) — both the
  published copies (2197362 NB, 2197363 SB) AND their draft counterparts (2195825, 2195826; page has
  `has_changes:false` so the two were in sync). The axis-tick fix and the ClickHouse label fix are
  both live library/server code — no page rebuild needed, they apply on next render / next query.
  Re-probed with `report_probe.mjs`: both fixes visually confirmed
  (`scratchpad/npmrds-sub/tmp/probe_converted_reports/ny9d_beacon_spec_test.png`).

  **Not done**: could not get a live tooltip screenshot via Playwright — `page.mouse.move` /
  `.hover()` onto a bar's `<rect class="avl-stack">` never flipped `HoverCompContainer`'s `show`
  state in this headless run (`.hover-comp` stayed `display:none` after multiple approaches: raw
  `mouse.move`, element `.hover()`, native-event dispatch via `page.evaluate`). Not investigated
  further — likely a synthetic-event/headless quirk in this harness, not a product bug (the tooltip
  text is a direct, mechanically-guaranteed passthrough of the `__series` string the now-passing
  ClickHouse unit test already pins). If a future session needs an actual tooltip screenshot, start
  there rather than assuming the same approach will work.

  **Out of scope, left as-is**: `duration-value-format-mm-ss.md` (adding a `minutes_seconds`
  ValueFormat so a travel-time yAxis wouldn't need "Integer" at all) is unrelated and still
  NOT STARTED — the tick-dedup fix above is a general safety net for ANY coarse format on a narrow
  domain, not a substitute for giving travel-time measures a better-fitting default format.
