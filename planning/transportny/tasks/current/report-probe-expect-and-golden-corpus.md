# Live-verification testing structure: `report_probe.mjs --expect` + golden-corpus batch probe

**Project:** TransportNY · **Topic:** themes · **Status:** NOT STARTED · **Started:** 2026-08-06

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
  reports." **Already true as of 2026-08-06** — 4 specs exist there
  (`ny9d-beacon.json`, `scratch_add_route_search_publish_test.json`,
  `scratch_add_route_search_test.json`, `scratch_template_patched_test.json`). This is overdue, not
  speculative.

## Objective

1. Build `report_probe.mjs --expect <spec.json>`: given a spec file (the same format
   `report_build.mjs` consumes — see `research/npmrds-reports/report-spec.md`), assert against the
   live page:
   - Every graph section the spec describes fired a real `/graph` request (the probe already
     reports this unprompted — turn "unprompted" into "asserted, exit 1 on failure").
   - Returned series count for each self-bound section matches the route instances the spec
     assigned to that graph (the one live-data-dependent assertion the deferred `--verify` design
     identified — see the table in `report-spec-and-build-script.md`'s "The `--verify` decision").
   - No console/page errors (already collected by the probe; wire into a pass/fail exit code when
     `--expect` is passed, where today it's report-only).
2. Generalize `report_probe.mjs` into a **golden-corpus batch mode**: run it over a small, curated,
   stable set of already-converted pages chosen to exercise every major section type and known-gap
   class, not just spec-built ones. Store each page's probe output (per-section SVG census,
   console-error count, decoded `/graph` path summary) as a baseline snapshot; future runs diff
   against baseline and flag regressions (a section that used to render now doesn't; a console error
   that wasn't there before) instead of requiring a human to notice by eye.

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

- [ ] `--expect` correctly fails against a known-broken page (e.g. the Route Map binding gap
      page) before that fix lands, and passes after
- [ ] `--expect` correctly passes against a known-good page (an AVL-Graph-only spec-built report)
- [ ] Golden corpus selected and confirmed with Ryan (the draft list above is a starting point, not
      final)
- [ ] Baseline captured for the full corpus; a deliberately-broken re-run (e.g. temporarily reverting
      a fix) is caught by the diff
