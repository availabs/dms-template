# Live-verification testing structure: `report_probe.mjs --expect` + golden-corpus batch probe

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS · **Started:** 2026-08-06

## Next session priority (set 2026-08-07 by Ryan, end of session)

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

`planning/transportny/tasks/current/report-spec-and-build-script.md` (the design record for
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

## Files likely touched

- `scripts/npmrds-reports/report_probe.mjs` — add `--expect <spec.json>` flag; consider a
  `--baseline`/`--diff` pair of flags for the batch-corpus mode, or a small sibling script
  (`probe_corpus.mjs`) that shells out to `report_probe.mjs` per page and does the diffing — prefer
  extending the existing harness per its own docstring ("If the same `--eval` probe gets written
  twice, promote it to a flag here" — same spirit applies to a second orchestration script vs. a
  flag on this one; decide which fits better once the shape of the diffing logic is clear)
- New: a golden-corpus manifest file (page slugs/ids + what each covers) — likely
  `scratchpad/npmrds-sub/golden-corpus.json` or similar, plus baseline snapshots alongside it

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
- [ ] Golden corpus selected and confirmed with Ryan (the draft list above is a starting point, not
      final)
- [ ] Baseline captured for the full corpus; a deliberately-broken re-run (e.g. temporarily reverting
      a fix) is caught by the diff
