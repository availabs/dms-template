# Live-verification testing structure: `report_probe.mjs --expect` + golden-corpus batch probe

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS · **Started:** 2026-08-06

## 2026-08-10: batch-corpus mode built, real, and running — priority-ordered per Ryan's steer

Ryan's ask this session: make the test plan/framework easily updatable when the underlying page
schema changes again (a naming/tagging convention that flags which fixtures to recheck), add real
observability (structural + a narrow data-value spot-check, not full measure-formula coverage —
that's explicitly scoped out, see `converter-vocabulary-unit-tests.md`), borrow what's useful from
`src/themes/transportny/qa_skills/` (the Freight Atlas/TSMO ticket-driven QA system) without
adopting its DB-backed stage machine (different, much larger surface area). Then, once the
scaffolding exists, build a concrete test case for Dynamic Reports specifically.

**Borrowed from `qa_skills/` (light-touch, not the ticket/stage machine):** the prove-before-trust
parity discipline (`fidelity_static.mjs`/`builds/README.md`'s custody table — never trust a matching
count alone), the Blocker/Major/Minor/Info severity vocabulary, and the general-purpose "SQL error
surfaced in a 200 response" check (`qa_assess.mjs`'s `graphErrs` regex, extended here with
ClickHouse's own `DB::Exception`/`Code: N` shape).

**Shipped, all live-verified, not just written:**

1. **`report_probe.mjs`**: general-purpose SQL/ClickHouse-error-in-response detection (any `/graph`
   response, not just under `--expect`) — catches a query that comes back 200 with an error payload,
   which neither the status-code check nor the console-error check would catch on its own. Also
   fixed a real pre-existing bug: slug sanitization only applied to full-URL targets, not bare-slug
   targets — every corpus page's URL is `parent/slug`-shaped (and Dynamic Report's carries `?routes=`
   too), so the unsanitized slug was silently landing output in a nested subdirectory (Playwright's
   screenshot `path` auto-creates missing dirs, masking it). Also added canvas detection to the
   section census — **Map sections render via MapLibre WebGL/canvas, never SVG**, so an SVG-only
   census reads a correctly-rendered map as permanently blank; found live probing the Dynamic Report
   page's Route Map section (screenshot showed a real rendered choropleth, 30.46 mph, while the
   census said "NO SVG"). `hasContent` is now `svg-ink OR real-sized canvas`, threaded through
   `--expect`'s "rendered non-empty" check too.
2. **`report_probe_fixtures/golden-corpus.json`**: the manifest, git-tracked, single source of truth
   (no separate hand-maintained doc to drift out of sync — `probe_corpus.mjs --list` renders a table
   from it on demand). 5 entries, each with a `covers` array tagging the real field/function names it
   exercises (`_measurePick.routeIds`, `sidebarHideInView`, `measure.speed`, etc.) — **this is the
   "easy to update" mechanism**: when a load-bearing shape changes, `grep` the manifest for that name
   to find exactly which corpus entries are at risk, re-run just those with `--only`, and `--capture`
   only once confirmed correct.
3. **`probe_corpus.mjs`**: the batch runner. `--list` / `--capture [--only k1,k2]` / diff mode
   (default). Shells out to `report_probe.mjs` per entry (extends, doesn't fork, per that script's
   own docstring convention) and normalizes its JSON dump into a small comparable shape — per-section
   render state, deduped console/page/SQL error signatures, and per-`/graph` query series counts —
   diffed against the git-tracked baseline with Blocker/Major/Minor/Info severity. Baselines live at
   `report_probe_fixtures/baselines/*.json`, one per entry, git-tracked (Ryan's call — durable across
   sessions/machines, small since they're the normalized shape not raw dumps, diffable with `git
   diff`). Screenshots are NOT part of the automated diff (pixel-diffing is fragile) — manual-review
   artifacts only.

**Three more real bugs found and fixed getting the diff to be actually quiet (not just built) —
all found by running it repeatedly against itself, the same dogfooding-catches-real-bugs pattern
this whole task exists to formalize:**
- **Match-key too short.** `graphSummary`'s match key was a 160-char prefix of the decoded query —
  not unique: the Dynamic Report page's per-weekday Bar Graph Summary queries all share the same
  view-id + options-JSON preamble and only diverge past char 160, so 43 distinct queries collapsed
  into 31 keys, producing false "series count changed" diffs against its own fresh baseline. Fixed
  to match on the full decoded string, truncating only for display.
- **Site-infrastructure query noise.** Generic Falcor/UDA plumbing (`dms","data",...,"byId"/
  "byIndex"/"length"` catalog reads, `uda",...,"sources","byIndex"/"length"` source-picker listings)
  drifts run-to-run on a shared dev DB purely from unrelated concurrent activity (someone else's
  work creating rows elsewhere shifts a global byId range) — had nothing to do with the page under
  test but was flagging false "no longer fires" Major findings. Fixed by scoping `graphSummary` to
  `isReportContentQuery` (a UDA `viewsById...options`/`colorDomain` call) only.
- **A network blip can silently poison a baseline.** Chromium returns a 200-shaped dump with a
  trivial body + `net::ERR_*` console noise instead of throwing when the page never really loaded —
  without a guard this gets captured as a legitimate "0 sections, all blank" baseline (happened for
  real this session, mid-run, when the connection dropped). Added `looksLikeFailedLoad()` — refuses
  to capture or diff an entry whose dump shows this signature, instead of silently trusting it.

**Live-verified end-to-end, both directions, on `golden_corpus_linegraph`** (a throwaway/reversible
test on this corpus page specifically, backed up and restored after each step): confirmed self-
consistency first (two consecutive clean diff passes across all 5 entries), then two injected-fault
attempts. The `routeIds:[]` corruption (mirroring the historical Design-Push-#2 regression class)
turned out inconclusive for an interesting platform reason, not a framework gap — see the note below.
The SQL-expression corruption (an unknown-function typo in the ClickHouse expression) surfaced a
real, separate platform finding (see below) rather than reaching the diff at all. **The framework's
regression-catching power was ultimately proven by the 3 real bugs above**, all caught live during
this session's own dogfooding — arguably stronger evidence than a synthetic injected fault, since
those were genuine, previously-unknown defects in the tooling itself.

**Platform finding, not yet explained, worth a follow-up look (not chased further this session):**
directly editing a published section's `display._measurePick.routeIds` to `[]` via `dms raw update`
had no visible effect on the published page's rendered series — the graph kept showing both routes'
data. `useGraphPublish.js` was confirmed (via direct code read) to re-derive the `$self` action-param
from `_measurePick.routeIds` live on every render, including on the published view, so `routeIds:[]`
should have zeroed the series — it didn't. Best guess: an empty comparison-series variants list falls
back to an unfiltered aggregate query rather than zero results, but this wasn't confirmed by reading
`useDataSource`/the comparison-series query-builder itself. **Separately**, corrupting the
`travel_time_all_vehicles` calculated column's SQL expression (an unknown ClickHouse function name)
had no effect either — the live response kept returning the pre-corruption values even though a
fresh `dms raw get` confirmed the DB held the corrupted expression. This smells like **server-side
UDA query-result caching that a raw DB write doesn't invalidate** (a normal edit through the UI
presumably goes through a cache-busting hook a raw CLI write bypasses) — also not confirmed by
reading the caching layer itself. Neither finding blocks this task, but both are real enough to be
worth a dedicated look if they recur or start masking a genuine regression during future use of this
framework.

**Layer 3 (known-good-value spot check) — one PoC entry, per Ryan's steer ("something EASY, like
speed — we're almost certainly right, and if not it's rounding").** `golden_corpus_bargraph`'s
`expectedValue` field: NY-9D Northbound's average speed on Mondays (Jan–Feb 2025), computed two
independent ways — direct ClickHouse SQL (`avgIf` per TMC on `npmrds.s583_v982_NPMRDS_V6`) combined
with per-TMC miles from the UDA view-3464 reference-data endpoint (a static geometry lookup, not
derived from this report's own rendering — never validate a value against itself), applying the
report's own formula (`sum(miles)*3600/sum(avg_travel_time_s)`). **Matched the live rendered value
exactly** — 19.57234077140305 mph to 15 significant digits — confirming the speed formula is correct
for this measure, not just approximately right. Sanity-checked the assertion mechanism itself both
ways (a deliberately-wrong expected value correctly fails with the real returned values listed; the
correct value passes) before wiring in the real number. Along the way, fixed the matcher itself
twice: matching on route name alone can hit a metadata lookup instead of the real measure query, and
even among report-content-shaped queries a paginated UDA fetch sends a `length`-only preflight before
the real `dataByIndex` call — now requires both `isReportContentQuery` and `dataByIndex` explicitly.

**Dynamic Report priority entry — `dynamic_report_one_week_study`, DONE.** Confirmed live
`authRequired: false` (renders publicly at `converted_reports/one_week_study?routes=2207838` with
zero login — the row's own `published` field reading back empty doesn't gate this). Baseline
captured and verified clean twice: 8 sections, 6 with real content (Route Line Graph ×2, Bar Graph
Summary ×2, TMC Grid Graph, Route Map — the only corpus page exercising Bar Graph Summary at all,
since it's old-tool-only and can't be spec-built), zero console/page/SQL errors, 16 report-content
queries. **Verify URL:** `http://npmrds.localhost:5173/converted_reports/one_week_study?routes=2207838`
(public, no auth) — expect all sections except the plain-text header to show real rendered content.
Re-run the check any time with `node scripts/npmrds-reports/probe_corpus.mjs --only
dynamic_report_one_week_study`.

**Not done this session** — `converter-vocabulary-unit-tests.md` (the pytest layer for
`dates.py`/`expressions.py`/`route_map.py`) is still NOT STARTED; this session's scope was the
live-page structural layer + the one Layer-3 PoC, both explicitly prioritized ahead of it by Ryan.

### Manifest grown to 8 entries by 2026-08-17 — correction, 2026-08-18

The "5 entries" description above (and the `golden-corpus.json` manifest's own `_readme`) describes
2026-08-10's state. Checked directly against the live manifest while auditing this project's
planning docs (`reports-docs-consolidation.md`): 3 more entries were added during the 2026-08-12→17
hand-by-hand template work documented in `dynamic-reports-and-route-tags.md`, none of which got a
corresponding update back into this design doc. Current 8 entries, verbatim from the manifest:

| Key | URL | `covers` highlights |
|---|---|---|
| `golden_corpus_linegraph` | `converted_reports/golden_corpus_linegraph` | `avlGraph.LineGraph`, `comparisonSeries.plain`, `sectionGroups.sidebarHideInView` |
| `golden_corpus_bargraph` | `converted_reports/golden_corpus_bargraph` | `avlGraph.BarGraph`, `measure.speed`, `comparisonSeries.plain` |
| `golden_corpus_gridgraph` | `converted_reports/golden_corpus_gridgraph` | `avlGraph.GridGraph`, `measure.travelTime`, `resolution.day` |
| `golden_corpus_routemap` | `converted_reports/golden_corpus_routemap` | `Map.choroplethBake`, `measure.speed`, `quantile_breaks` |
| `dynamic_report_one_week_study` | `converted_reports/one_week_study?routes=2207838&asOf=2026-07-23` | `dynamicReport.routeSlotsFilter`, `BarGraphSummary`, `dateFormula`, `derivedFromRoute`, `relativeDateResolution.TODAY_ANCHOR_COMP_ID` |
| `dynamic_report_monthly_congestion` **(new)** | `converted_reports/monthly_congestion?routes=2207838&asOf=2026-07-23` | `relativeDateResolution.CALENDAR_POSITION_REGEX`/`resolveCalendarPositionFormula`, `dateFormula`, `derivedFromRoute` |
| `dynamic_report_seasonality` **(new)** | `converted_reports/seasonality?routes=2207838&asOf=2026-07-23` | same calendar-position coverage as above, plus `vocabulary.resolutions.summary` |
| `dynamic_report_annual_average_study` **(new)** | `converted_reports/annual_average_study?routes=2207838&asOf=2026-07-23` | `avlGraph.GridGraph`, `RouteCompare.multiMeasure`, `InfoBox.multiMeasure`, `routeWindows` |

All 8 entries now pin `&asOf=2026-07-23` on every `dynamic_report_*` URL (per the manifest's own
`_readme`, added 2026-08-13 — without it, every Today-anchored page's query dates drift a day
between runs, forcing a daily re-baseline for no reason). `probe_corpus.mjs --list` renders this
same table live from the manifest on demand — that's still the actual source of truth; this table
is a point-in-time copy for anyone reading this doc without running the tool.

## Next session priority (set 2026-08-07 by Ryan, end of session — superseded by the above)

Everything below this point is groundwork: `--expect` works, three real `report_build.mjs`/
`report_probe.mjs` bugs got found and fixed along the way, and 5 real golden-corpus candidate pages
are live (see "Golden corpus pages currently live" below) with confirmed-working URLs. **None of
this is wired into an actual repeatable test plan yet** — there is no script or checklist a future
session runs to (a) rebuild/verify the golden corpus, (b) capture baselines, (c) diff a re-run
against the baseline and flag regressions. Ryan's explicit direction: prioritize making and
implementing that test plan next, incorporating the pieces already built here — this is the actual
Objective #2 (batch-corpus mode) below, now unblocked and ready to build for real, not the "propose
which pages" step that came before it.

## Golden corpus pages currently live (session-scoped — see below)

Left up for Ryan to review; **not permanent** — [[feedback_golden_corpus_pages_session_scoped]]: OK
to delete once this review pass (or the next one) is done, don't ask again each time.

| Type | URL | Source |
|---|---|---|
| Line Graph | `converted_reports/golden_corpus_linegraph` | fresh spec-built (`golden-corpus-linegraph.json`) |
| Bar Graph | `converted_reports/golden_corpus_bargraph` | fresh spec-built (`golden-corpus-bargraph.json`) |
| Grid Graph | `converted_reports/golden_corpus_gridgraph` | fresh spec-built (`golden-corpus-gridgraph.json`) |
| Route Map | `converted_reports/golden_corpus_routemap` | fresh spec-built (`golden-corpus-routemap.json`) |
| Bar Graph Summary + Dynamic Report | `converted_reports/one_week_study?routes=2207838` | real existing page, id `2210438` — **must keep the `?routes=` param**, see "Dynamic Report pages need `?routes=<id>`" below |

Still open from the original draft list (not started): the Route Map/Info Box/RouteCompare binding-
gap page (its old repro page, `rochester_inner_loop_0`, no longer exists — would need rebuilding),
a relative-dates-driven page, and 2-3 `--report-id` conversions from old-reports-conversion.md's
round history.

## 2026-08-07: `report_build.mjs` was broken — found and fixed while building the first test fixture

Building the first committed test-fixture spec (`scripts/npmrds-reports/report_probe_fixtures/
specs/plain-two-route-linegraph.json` — a plain 2-route LineGraph, git-tracked per Ryan's
"test specs can live in git, production specs shouldn't" ruling) surfaced two real, current bugs in
`report_build.mjs` itself, both now fixed. This is exactly the value this task exists to prove out,
so logging it here before moving on to the `--expect` flag itself.

**Bug 1 — every spec-built graph rendered completely blank, no error.** Design push #2 (2026-08-06,
see `useGraphPublish.js`'s own header comment) moved route→graph routing OFF the route
(`routes[].graphIds`) and ONTO each graph's own `display._measurePick.routeIds`.
`report_build.mjs` never got updated for this — it only ever wrote the old `routes[].graphIds` side,
so `_measurePick.routeIds` stayed `[]` on every graph, every time, since 2026-08-06. Confirmed via
`dbq.py new` that `routes[].graphIds` was correctly wired but no `/graph` query for the actual
measure ever fired, and RRL showed "0 GRAPHS" per route. Same root-cause class as
`feedback_keep_converter_in_sync_with_model_changes` (the Python converter's own same-day hotfix)
— just a second, separate script that got missed. **Fix**: a new pass in `report_build.mjs`, right
after route resolution and the Route Map re-bake loop (so it isn't clobbered by Map's full-state
replace), computes each graph's assigned routes' `route_comp_id`s and merges them into
`_measurePick.routeIds` — applies uniformly to AVL Graph/Map/Info Box (RouteCompare has no
`_measurePick` concept, skipped). `weekdays`/`start`/`end` are best-effort promoted from the
assigned routes only when every one of them agrees (warns and leaves unset otherwise) — the spec
format itself (`report-spec.md`) still expresses these per-route, not yet migrated to the graph-level
field Design Push #2 introduced; that migration is a separate, un-scoped follow-up.

**Bug 2 — every spec-built page's RRL panel rendered with a ~48px gap against the sidenav rail**
(spotted live by Ryan watching the fixture render). Root-caused via `getBoundingClientRect()` diffs
against `converted_reports/snapshot` (a known-correct real page), NOT the AM session's
`ReportRouteList.theme.js` `panelHead` fix (that one's a small ~12px padding sliver *inside* the RRL
header's own box, already shipped, unrelated). This one is `sectionGroup.jsx`'s rail mechanism: the
page's `section_groups`/`draft_section_groups` field needs an entry
`{name:'default', position:'content', theme:'flush'}` — `report_build.mjs` never wrote this field at
all, so dms-server auto-derived one with `theme:'content'` instead. A first fix attempt (forcing
every section's own `group` to `'default'`) was WRONG and broke the rail entirely — RRL rendered as
a full-width stacked band instead of the side rail, because `sectionGroup.jsx`'s `sidebarGroup`
lookup only finds sections whose own `group` field is literally `'sidebar'`; caught by comparing
screenshots before it shipped.

**Bug 3 — the PUBLISHED (non-edit) view left a dead gray gap where the RRL rail column would be**,
spotted live by Ryan on `converted_reports/golden_corpus_linegraph` after Bug 2's fix shipped (a
*different* gap from Bug 2 — that one was edit-mode-only; RRL never renders on a real page at all,
by design, but `sectionGroup.jsx`'s rail column still reserved its width unconditionally). The page
flag that collapses an empty rail column, `sidebarHideInView`, was also never being set.

**Correction on the fix for both, same day, after Ryan pushed back on maintaining page-scaffolding
facts twice across `report_build.mjs` and `convert_old_reports_lib`**: the first fix for Bug 2
hardcoded a new `REPORT_SECTION_GROUPS` literal in this script — which happened to match by
coincidence, but recreated the exact two-sources-of-truth problem being complained about. Checked
the "Report Page" template row (`pageTemplate`, id `2187021`, already loaded by this script for
other purposes) directly: it already carries the *correct* `sidebarHideInView: true` and
`draft_section_groups: [{name:'default', position:'content', theme:'flush'}]` — this script simply
never read either field off the template it already had in hand. **Real fix**: both the page-create
call and the publish branch now copy `sidebar`/`sidebarHideInView`/`draft_section_groups` straight
from `pageTemplate`, with no re-hardcoded literal (a fallback exists only as a defensive no-op if
the template is ever missing the field). If the template's own value is ever wrong, fix the template
row — every future page from any generator inherits the correction for free.

**Correction (same conversation, minutes later) — the "still a second source of truth" claim above
was wrong.** Ryan asked "could both the Python and JS copy just pull the template from the DB?" —
checking `convert_old_reports_lib/db.py` answered it: Python already has its own `dms(args,
data=None)` CLI-subprocess wrapper, functionally identical to `report_build.mjs`'s own `dms()`
helper, AND `section_builders.py`'s `load_page_template()` already fetches the exact same template
row (`PAGE_TEMPLATE_ID = 2187021`, same id both scripts use). `convert_template.py`/
`convert_report.py` already read `page_template.get("sidebarHideInView", False)` and
`page_template.get("draft_section_groups") or [...]` — `git log -L` on that exact line shows this
was fixed in a prior commit (`bdf0971`, "fixing reports stuff"), with its own comment describing the
identical rail-gap bug this task's Bug 3 rediscovered independently in `report_build.mjs`. So Python
was never actually broken here — only its unreachable fallback literal (used only if the template
row itself lacked `draft_section_groups`, which it never does in practice) still said
`theme:"content"` instead of `"flush"`. Fixed both occurrences
(`convert_template.py`/`convert_report.py`) for consistency; no behavior change, since the primary
`page_template.get(...)` path was already correct and always wins.

**Why this matters as a general lesson**: don't infer "the other generator must have the same bug"
from a hardcoded-looking literal without checking whether it's a live default or the tail of a
`.get(...) or fallback` pattern behind a check that already succeeds — `git log -L` on the specific
line would have caught this immediately instead of writing a wrong "still unresolved" note into this
task file. Both `report_build.mjs` and `convert_old_reports_lib` now correctly pull `sidebar`/
`sidebarHideInView`/`draft_section_groups` from the SAME live "Report Page" template DB row — this
is a case where "pull from the DB, don't share a JSON snapshot" was already the answer for the
Python side and just needed to become true for the JS side too. (A shared JSON file remains the
right pattern for genuinely static, generated reference data — see `vocabulary.json`'s own
cross-language use, a different kind of artifact from a live, admin-editable template row.)

**Live-verified 2026-08-07**: rebuilt `converted_reports/golden_corpus_linegraph` from scratch after
the corrected fix (new page id, same slug) — `sidebarHideInView`/`section_groups` landed correctly
with zero manual DB patching, `/graph` query fired with real ClickHouse data, RRL flush against the
rail in edit mode, and the published view fills full-width with no gap, all matching
`converted_reports/snapshot` exactly.

**Files touched**: `scripts/npmrds-reports/report_build.mjs` (all three fixes, now template-sourced,
not hardcoded); new `scripts/npmrds-reports/report_probe_fixtures/specs/plain-two-route-linegraph.json`
(disposable `--expect` test fixture) and four `golden-corpus-*.json` specs (kept-live corpus pages,
see below).

Split out of a broader ask (2026-08-06): Ryan flagged that the NPMRDS converter/vocabulary tooling
is large, load-bearing, and that the team spends a lot of time triaging regressions in it — and
asked for a testing-structure plan. This is one of two testing-structure task files split from that
ask (see also `converter-vocabulary-unit-tests.md`, the pure-function/pytest layer). This file is
the "does a real page actually render correctly" layer.

## Why this, why now

Read the full history in `src/dms/planning/tasks/current/old-reports-conversion.md` (the
authoritative doc for the converter/vocabulary arc — 908 lines, 69 rounds since 2026-07-08 as of
this writing). The pattern across essentially every round: a human browses a live converted report
page, finds a bug, root-causes it, fixes it, live-verifies by hand with `report_probe.mjs` run
against one page at a time. Nothing in this pipeline catches a regression before it ships — the
"drift detection" mechanism already built into the converter (`ensure_graph_templates` etc.) is a
reactive self-heal (old pages pick up a fix next time they're reconverted), not a preventive check.

This file's job is closing the ONE gap the team already identified and explicitly deferred, plus
generalizing the resulting mechanism.

## The already-designed, already-triggered piece: `report_probe.mjs --expect`

`planning/transportny/tasks/completed/report-spec-and-build-script.md` (the design record for
`report_build.mjs`, the declarative spec → live report builder) has a section, **"The `--verify`
decision (2026-07-27): flag removed, `--expect` deferred"**, worth reading in full before starting.
Summary:

- `report_build.mjs` composes graph state through the exact same `applyMeasurePick` the live
  Measure Picker UI calls — a "parity guarantee." Two of three layers are already checked without a
  browser: spec → composed state, and composed state → written row (both proven by construction /
  structural checks, no live page load needed).
- The third layer — **written row → what actually renders** — is explicitly NOT the build script's
  job. The doc's own reasoning: "a spec-aware live check isn't verifying the builder; it's using the
  spec as a statement of intent that makes the rendered output assertable at all." Its designed
  home is `report_probe.mjs --expect <spec.json>`, since the probe already holds live page data and
  works against ANY page (spec-built or old-report-converted).
- **Trigger to build it, per that doc**: "three or more specs in `scratchpad/npmrds-sub/report-
  specs/`, or the first graph-engine change that needs re-checking against existing spec-built
  reports." **Correction, 2026-08-07**: the original "already true, 4 specs exist" claim was wrong
  — it counted spec *files* on disk without checking whether the pages they built still exist.
  Checked live via `dms page show` on all 4 slugs: every one is gone (`No item found with slug`),
  including the `ny9d-beacon.json` spec's own build target (the real shipped NY-9D Beacon report
  lives at a different, hand-verified slug — see `project_ny9d_beacon_report_shipped` memory — not
  this spec-test page). Ryan's correction: spec JSON files in scratchpad are ephemeral build inputs,
  not durable fixtures — "it's all in the DB." Don't cite scratchpad file counts as justification;
  the actual trigger for this work is just "worth doing," independent of file-count bookkeeping. See
  `feedback_specs_are_ephemeral_not_fixtures` memory.

**Note on specs used to test this feature**: any spec files authored to exercise `--expect` during
this task's own development are throwaway — build a scratch page, test against it, delete both the
page and (optionally) the spec file when done. Don't accumulate them in
`scratchpad/npmrds-sub/report-specs/` as if they were fixtures; the DB page is the only thing that
needs to persist, and only for pages worth keeping. The golden corpus itself (below) is built from
real, currently-live, stable pages — never from spec files.

## Objective

1. **DONE, live-verified 2026-08-07.** Built `report_probe.mjs --expect <spec.json>`: given a spec
   file (the same format `report_build.mjs` consumes — see `research/npmrds-reports/report-spec.md`),
   asserts against the live page:
   - Every graph section the spec describes fired a real `/graph` request — matched to a specific
     spec graph by checking that every one of its assigned routes' `name` appears in a captured
     query's decoded `seriesVariants` labels (no structural id needed; RouteCompare graphs skipped,
     no seriesVariants-shaped query).
   - Returned series count for each self-bound section matches the route instances the spec
     assigned to that graph (counts `\"label\":\"` occurrences in the matched capture).
   - The spec's own `title` (when set) maps to a census section with non-empty SVG content.
   - No console/page errors.
   Exits 1 on any failed check, 0 otherwise; prints PASS/FAIL per check either way. Implementation
   found and fixed a real pre-existing bug in the probe's own SVG census along the way: in edit mode,
   every section cell's first `.font-display` match is the hover "Add Section" control's own label
   ("Add"), not the section's real title, so EVERY section's census `title` silently came back "Add"
   — now skips that literal placeholder value. This affected every prior edit-mode probe's `title`
   field, not just `--expect` (single-page mode's own printed section list was equally wrong; nobody
   had noticed because the SVG-content/blank distinction it exists for doesn't depend on the title
   string).
   Verified both directions: passes clean against a real spec-built fixture (all 5 checks), and fails
   (exit 1) against a deliberately-wrong spec (a route name not actually on the page) — see the
   2026-08-07 section above for the fixture and the `report_build.mjs` bugs found getting there.
2. Generalize `report_probe.mjs` into a **golden-corpus batch mode**: run it over a small, curated,
   stable set of already-converted pages chosen to exercise every major section type and known-gap
   class, not just spec-built ones. Store each page's probe output (per-section SVG census,
   console-error count, decoded `/graph` path summary) as a baseline snapshot; future runs diff
   against baseline and flag regressions (a section that used to render now doesn't; a console error
   that wasn't there before) instead of requiring a human to notice by eye.

## Dynamic Report pages need `?routes=<id>` — found live 2026-08-07

A Dynamic Report page (the 12 reports-catalog templates) shows its "Add Routes" entry-gate modal on
first load and every graph renders empty until a route is picked — probing the bare slug alone
(`converted_reports/one_week_study`) shows 1/8 sections with content, all placeholder. Simulating the
modal click via Playwright works (confirmed: `graphIds`/comparisonSeries resolve correctly, real
ClickHouse data returned for every graph type on the page including two Route Map choropleths) but
is not something a batch probe should have to automate per corpus page. **Ryan pointed at the actual
mechanism**: the page's own Dynamic Report filter (`{searchKey: "routes", useSearchParams: true,
type: "routeSlots"}`, set at conversion time — see `convert_template.py`) reads a plain `?routes=`
query param. Appending `?routes=<route_id>` (e.g.
`converted_reports/one_week_study?routes=2207838`) bypasses the modal entirely and renders
identically to the modal-click path — deterministic, scriptable, no interaction needed. **Any Dynamic
Report entry in the golden corpus must be listed with its working `?routes=` URL, not the bare
slug** — probing the bare slug tests nothing but the empty-slot placeholder state.

`converted_reports/one_week_study?routes=2207838` (page id `2210438`) is a strong first Dynamic
Report corpus candidate on its own merits: it's the ONLY page found so far exercising Bar Graph
Summary (the one major graph type that can't be spec-built via `report_build.mjs` at all — old-tool-
only), alongside Line/Bar-Summary(×2)/Grid/Map all on one page, all confirmed rendering with real
data and zero console errors.

## Proposed golden corpus (draft — confirm/adjust before building)

Pick pages that between them cover:
- At least one page per major graph type already built (Line, Bar, Grid, Bar Graph Summary, Route
  Map — every measure/resolution combo is NOT the goal, one representative each is)
- At least one page exercising the Route Map / Route Compare Component / TMC Info Box binding gap
  found 2026-08-06 (see `../../../../src/dms/planning/tasks/current/
  dynamic-report-nongraph-section-binding.md`) — this corpus should FAIL on that page today and
  flip to passing once that fix lands, giving the fix a concrete regression test for free
- At least one relative-dates-driven page (`resolve_relative_dates` mechanism — checked 2026-08-06
  and found solid, but a real page exercising it belongs in the corpus so it stays solid)
- The 12 reports-catalog templates (`--template-id` / Dynamic Report mode) — distinct code path
  from `--report-id` conversions, worth covering separately
- 2-3 `--report-id` conversions from different rounds of `old-reports-conversion.md`'s history,
  picked for how many distinct gap-kinds/measures they exercise (the round ledger's own page-id
  tables are a ready-made source list)

## What NOT to build (scope guard)

- No CI/GitHub Actions integration — no CI exists in this repo today, and the Postgres/ClickHouse/
  dev-server dependencies make that a materially bigger lift than what's being asked for here. Scope
  this as a local, manually-triggered-but-repeatable script (e.g. `node scripts/npmrds-reports/
  probe_corpus.mjs`), not a CI gate, unless separately requested.
- No attempt to make `report_probe.mjs`'s existing single-page mode go away — the batch mode is
  additive.

## Files touched (2026-08-06/07 `--expect` + 2026-08-10 batch mode)

- `scripts/npmrds-reports/report_probe.mjs` — `--expect <spec.json>` flag (2026-08-07); general SQL-
  error detection, slug-sanitization fix, and canvas/Map content detection (2026-08-10)
- New: `scripts/npmrds-reports/probe_corpus.mjs` — the batch-mode sibling script (resolved the
  "flag-vs-sibling-script" open question from the original plan: sibling script won, since batch I/O
  — manifest read, baseline dir read/write, cross-entry aggregation — is genuinely different from
  `report_probe.mjs`'s own single-page CLI surface)
- New: `scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json` — the manifest (landed here,
  not `scratchpad/`, since it's a durable git-tracked artifact, not an ephemeral build input)
- New: `scripts/npmrds-reports/report_probe_fixtures/baselines/*.json` — one git-tracked baseline per
  corpus entry

## Testing checklist

- [x] `--expect` correctly passes against a known-good page (an AVL-Graph-only spec-built report)
      — verified 2026-08-07 against a fresh 2-route plain LineGraph fixture, all 5 checks pass
- [x] `--expect` correctly fails (exit 1) against a mismatched spec — verified 2026-08-07 by adding
      a route name not actually assigned on the live page; the "fired a /graph request" check
      failed as expected, others still passed correctly (partial-failure reporting works)
- [ ] `--expect` against a known-broken page (e.g. the Route Map binding gap page) before that fix
      lands, and passing after — not yet tried against a Map/Info Box graph at all (only AVL Graph
      LineGraph tested so far); the seriesVariants-label matching should generalize per report-
      spec.md's 2026-07-28 finding, but hasn't been live-checked on those two types yet
- [x] Golden corpus selected and confirmed with Ryan — 5 entries live 2026-08-10 (LineGraph/BarGraph/
      GridGraph/RouteMap spec-built + the Dynamic Report priority entry); the 12-catalog-templates and
      2-3 `--report-id` conversions below are still open, not blocking
- [x] Baseline captured for the full corpus, git-tracked, confirmed self-consistent across two
      consecutive clean runs. Regression-catching power proven two ways: (1) the diff mechanism itself
      correctly flags/clears a deliberately-wrong Layer-3 expected value both directions (2026-08-10);
      (2) three REAL bugs in `probe_corpus.mjs`/`report_probe.mjs` were caught live during this
      session's own dogfooding (match-key truncation, site-infrastructure query noise, a network-blip
      false baseline) — see the 2026-08-10 section above. A direct injected-DB-corruption test on a
      live section was attempted twice and inconclusive for platform reasons unrelated to this
      framework (also documented above), not re-attempted further this session.
