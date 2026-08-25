# Routes/Reports/Users mesh

**Project:** TransportNY · **Topic:** themes · **Status:** kicked off 2026-08-25. Workstreams **A** (picker modal mockups AND the real
`RouteTagBrowserModal`/`ReportPickerModal` implementation, sharing a new `PickerModal/` layer) and
**C** (auto-generated route audit + cleanup) **DONE** same day, both independently live-verified. **B** (old-reports reconversion inventory) also ran same
day, in its own file (`src/dms/planning/tasks/current/old-reports-conversion.md`, not here — see
below) — surfaced a real live regression worth flagging here even though full detail lives there:
graphs converted from old reports have silently reverted to "all days, all hours" again since a
2026-08-14 rendering-contract migration (`routeWindows`) the converter was never updated for. D
(auth) is intentionally minimal, touched only via A4. E (Route Creation Plugin redesign) explicitly
last, not started.
· **Started:** 2026-08-25

## Objective

Ryan's framing, verbatim in spirit: imagine an extremely unskilled boss ("Boss A") who needs to,
with practically zero training, show the tool to *their* boss ("Boss B") and easily find
easy/fun/cool examples. Boss A is easily distracted and flustered. Every decision in this arc should
be judged against "can Boss A pilot this without help."

The current focus is the mesh between three things DMS already has separately — **Routes**,
**Reports**, **Users** — and cleaning up the seams where an author has to find/pick/own one from
inside another. Concretely: the "choose a route" modal (used both from Dynamic Reports and from
adding a route to a custom report) and a net-new "choose a report" modal both need the same
treatment — merge AVAIL-curated content with user-generated content, surface the "money routes"
(e.g. I-87 near Albany should be trivially findable), and prioritize what the current user owns.

This file's scope is deliberately narrower than the whole brain-dump that kicked it off — see the
sibling threads below for the parts that live elsewhere.

## Decisions locked 2026-08-25 (don't re-litigate without a new explicit ask)

- **A2's scope, corrected by Ryan mid-triage**: the `/reports` homepage stays AVAIL-curated Dynamic
  Reports ONLY — unchanged. The new "choose a report" **modal** is a superset: it searches/opens
  **everything the current user is auth'd for**, personal reports included. The modal is not a
  bigger version of the homepage grid; it's a different surface with a different (broader) content
  set. This makes A2 the real proving ground for A4's ownership filter, not a nice-to-have on top of
  it.
- **A4's mechanism, corrected by Ryan**: DMS already has the generic "send an arbitrary filter to
  the server" capability (the same one `full-text-search-filter.md` and
  `creating-interactive-pages.md`'s page-variable pattern already use) — nothing new needed there.
  What's actually missing is just the specific wiring: filter on the existing `created_by` audit
  column (populated on every write, `api/updateDMSAttrs.js`) against the current user id (already
  available via `CMSContext`, e.g. `ReportPageHeader.jsx`). No new `user:{id}` tagging convention
  needed for v1. Security note, Ryan's own framing: this is intentionally client-side-only for now —
  no server-side enforcement that the filter's user id matches the auth token. Fine for a first pass,
  not a real permission boundary.
- **B's scope, corrected by Ryan**: do NOT build new detection for "did a route-collapse change a
  graph's semantics" (comparison/difference-graph arm merging). Only need clean-vs-not-clean,
  answerable from tooling `convert_old_reports_lib/convert_report.py` already produces
  (`route_comps_merged`, `no_valid_routes` gap tags). This work lives in the EXISTING
  `old-reports-conversion.md` task file (which already has a live+archive split), not a new file.
- **C's scope, corrected by Ryan**: don't cross-reference current (dms-template) `reports_snap_2`
  usage when auditing auto-generated routes — these are brand-new 2024 corridors with no counterpart
  in the old tool, so "is any live report using this yet" is near-meaningless signal this early. Old
  (legacy-tool) reports could theoretically be useful, but the new auto-gen routes don't correspond
  to anything in the old tool either, so there's nothing to cross-reference there. The audit uses TMC
  identity (road/direction/county/miles) and geometry-match detection instead — see Progress log.
- **C's generator-code directive, Ryan's own words**: "our existing code that creates the auto-gen
  routes should be updated to produce this analysis as well" — i.e. this had to be a durable,
  reusable capability on the generator tooling, not a one-off throwaway script. Landed as
  `route_build.py audit` (see Progress log).
- **E's designs, Ryan's call**: treat all of Alex's handed-off `dms_design_system_v2` mockups as
  final/complete. No check-in needed before building from them.
- **Sequencing, Ryan's own ordering**: A/B/C are the current work; D (auth) stays minimal, touched
  only via A4; E (Route Creation Plugin redesign) is explicitly last — mentioned now only so A1's
  modal mockup can borrow its visual language, not to start it.
- **Folders**: reference-only. The old tool's folder system (user/group/AVAIL types, nesting, bulk
  move/copy) is fully documented at `research/route-creation/findings.md:296-414` and was
  deliberately deferred when 2.0 was built — Route Tags already ship as the folder-approximation
  replacement (`dynamic-reports-and-route-tags.md`). Per standing decision
  (`report-route-ui-parity-gaps.md:29-31`), folders/discovery/permissions are permanently out of
  scope, not just deferred. A5 below is context for A4's design, not a build item.

## Cross-references

- [`report-authoring-ux-overhaul.md`](./report-authoring-ux-overhaul.md) (+
  [`-archive.md`](./report-authoring-ux-overhaul-archive.md)) — the prior arc, Tiers 1-10 all DONE
  2026-08-24. Scoped to in-page report-canvas authoring UX (RRL, QuickControls, graph/section
  types) — confirmed to have zero content on the Routes/Reports/Users mesh theme; genuinely separate
  work, not a continuation.
- `src/dms/planning/tasks/current/old-reports-conversion.md` (+ its own `-archive.md`) — Workstream
  B lives there, not here. Already has the archive/current split Ryan asked for; this session added
  a new round for the convertibility classification (see that file's own round ledger for details,
  once that background pass lands).
- [`dynamic-reports-and-route-tags.md`](./dynamic-reports-and-route-tags.md) (+ `-archive.md`) — Route
  Tags (the folder-approximation), the tag-browsing picker modal's origin, and the tmc_linear
  auto-generation scheme this file's Workstream C audits.
- [`route-creation-tool.md`](./route-creation-tool.md) — current status/phase table for the
  route-creation map plugin itself (Workstream E's target, not started this arc).
- [`npmrds-design-v2-implementation.md`](./npmrds-design-v2-implementation.md) — where Alex's
  `dms_design_system_v2` mockups are tracked; `src/themes/transportny/TransportNY Design
  System/dms_design_system_v2/pages/npmrds-route-creation.html` (+ sibling `npmrds-reports.html`,
  `npmrds-report.html`) is the design source for Workstream A1/A2's visual language and Workstream
  E's eventual target.
- `research/route-creation/findings.md:296-414` — the old tool's folder system, full spec (reference
  only, see Decisions above).
- `src/themes/transportny/components/RouteTagBrowserModal/` — the CURRENT "choose a route" modal
  (`RouteTagBrowserModal.jsx`, `fetchCatalogRows.js`, `tagCategories.js`, `useTagBrowser.js`,
  `.theme.js`), shared by RRL's "+Add Route" and Dynamic Reports' route-slot fill via
  `selectionMode`. This is what Workstream A1 redesigns. Current behavior: single-pane drill-down
  (root → County(62)/Region(11)/Agency(~18)/Auto-generated/Other-tags), name search, checkbox
  multi-select, "Already on report" badges, ranking = `created_at desc` only (no prominence concept).
- `src/dms/skills/designing-a-dms-design-system.md` — format/conventions for the interactive HTML
  mockups Workstream A produces (plain HTML + Tailwind Play CDN, no build step).

---

## Workstream A — picker modal redesign (active)

**A1. "Choose a route" modal.** Redesign `RouteTagBrowserModal`'s UX (not necessarily its component
identity) as an interactive HTML mockup with real data, per `designing-a-dms-design-system.md`'s
conventions. Needs: a prominence/ranking model beyond `created_at desc` (see A3), the merged
curated+user-generated display (see A3), and an "owned by me" affordance (see A4).

**A2. "Choose a report" modal — net new.** See Decisions above for the corrected scope: superset of
`/reports`, not a bigger version of it — searches/opens everything the current user is auth'd for.
Build alongside A1 as one shared shell (same interaction model, same prominence/ownership
affordances), per Ryan's own steer that they should look/feel/function very similarly.

**A3. Merge curated + user-generated data; surface "money routes"; prioritize owned items.** No
heuristic exists in code today for either routes or reports — confirmed via research. The mockup
should sketch one (illustrative, not committed): a prominence score blending real-name-vs-auto-generated,
geometry size (TMC count / mileage — see Workstream C's single-TMC finding, a real signal this feeds
into directly), county/region/agency tag presence, maybe usage/reference count; owned items get a
hard boost. Redirect freely — this is exploratory UI, not an algorithm spec.

**A4. Lightweight ownership signal.** See Decisions above for the corrected mechanism — filter on
existing `created_by` against the current user id via CMSContext, using DMS's already-generic filter
plumbing. No new tagging convention needed for v1. Explicitly not real access control.

**A5. Folders.** Reference-only — see Decisions above. Not a build item.

**A1+A2 mockup — DONE, live-verified 2026-08-25.** Built as one interactive HTML page,
`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-picker-modals.html`
(registered in that folder's `ds-nav.js`), extending — not replacing — `npmrds-reports.html`'s own
§ 04 search dialog (Alex, 2026-07-31), which already shipped a real interactive result-list dialog
this session discovered while researching precedent. Three things move from that dialog's own
"drawn but inert" state to wired: the `mine` facet (real `created_by` column, confirmed live via
`select data->>'created_by', count(*) ... group by 1` — 652 is the bulk auto-gen service account
with 55,370 rows, real human ids like 191 own the rest), a "Best match" prominence sort replacing
pure recency (road-class-weighted — real finding baked in: Albany county's I-87 has only 12 TMCs
vs. NY-32's 34 and NY-85's 28, so raw geometry size alone would rank I-87 *behind* two much less
significant roads), and one merged curated/auto-generated/mine result list with badges instead of
separate browse trees. Live-verified via claude-in-chrome (local `python3 -m http.server`, since
`file://` navigation is blocked): typing "87" in the route picker correctly surfaces all I-87/I-787
matches with I-87 own-county real rows (including today's `#12000212` disambiguator from the C fix
below); the report picker's "mine" boost correctly promotes a demo-owned report to #1; the
"hide likely test/junk" facet correctly drops `TESTING SAVING`/`Testing and Acceptance...` rows
(25 → 16 matches); zero console errors throughout. All route data marked REAL is live rows queried
today from the routes catalog; one route row is explicitly marked ILLUSTRATIVE (needed a
non-service-account owner for the "mine" demo) — see the file's own header comment for full
provenance, matching `npmrds-reports.html`'s own real-vs-illustrative labeling convention.

**A1+A2 real implementation — DONE, independently verified 2026-08-25.** Built by a background
agent, redirected mid-flight per Ryan's explicit architectural correction ("share as much
code/styling as possible... there might even be existing modal components to borrow from") — I
confirmed `RouteTagBrowserModal.jsx` already wrapped DMS's own `UI.Modal` primitive before handing
that correction off. Result: a new shared `src/themes/transportny/components/PickerModal/` layer
(`pickerScoring.js`, `useCatalogFetch.js`, `fetchCatalogRows.js` moved here, `PickerModalParts.jsx`
+ theme) that BOTH `RouteTagBrowserModal/` (refactored) and the net-new `ReportPickerModal/` +
`ChooseReportButton/` import from and render through the same `UI.Modal` primitive — confirmed via
direct grep, not just the agent's own claim.

Independently verified live (not just trusting the agent's report — claude-in-chrome was
unavailable to it, so I used `report_probe.mjs --eval` scripts myself after the fact): the report
picker opens on the real `/reports` homepage (draft-only, `2214721`, published content untouched —
confirmed via `dms raw get 2208581`), searches real `reports_snap_2` data with a "Mine"/"Hide
incomplete-looking" facet row (language fix applied) and the correct "superset of the curated
homepage" framing; the route picker's Dynamic Report entry gate ("Add Routes") shows a live
`road_rank` SQL CASE expression in the actual captured query (`~* '^(i|us|ny)-[0-9]'`) — confirming
the prominence sort is real server-side ranking, not decorative — and a real "60 routes (short
segments hidden)" count confirming the fragment-collapse behavior works by default. The original
County/Region/Agency tag-browse tree is preserved unchanged alongside the new search/facets.
`probe_corpus.mjs`, re-run independently: all 4 `dynamic_report_*` entries (the ones exercising the
changed code) PASS; the 4 static `golden_corpus_*` entries fail on the same pre-existing
slug-drift bug documented 2026-08-24 (section count 2→20, blank) — confirmed unrelated to this
work, not a new regression.

Real bugs found and fixed by the agent along the way (not hypothetical): 72% of the routes catalog
is single-TMC fragments and the 80 most-recent rows are 100% fragments, so fragment exclusion had
to move server-side; a name search like "87" was getting swamped by thousands of raw-id-named
legacy rows before I-87 ever got fetched, fixed with SQL-side ranking columns.

`src/dms/skills/traversing-report-pages.md` updated with both pickers' behavior + a CLI footgun
found along the way (`dms page update --set` destructively replacing a whole array field on one
page — hit only on a disposable scratch page, no real data lost).

## Workstream B — old-reports reconversion + inventory (background, separate file)

Tracked entirely in `src/dms/planning/tasks/current/old-reports-conversion.md` per Ryan's explicit
instruction (see Decisions above). Do not duplicate status here — check that file directly.

## Workstream C — auto-generated route (tmc_linear) cleanup — DONE 2026-08-25

**Ask**: quantify how many 2024 auto-generated routes have only 1 TMC (candidate for
de-prioritizing/dropping in the UI), expanded mid-session to include duplicate-named auto-gen routes
as the same "junk" smell (Ryan's own example: `10TH AVE 36061 NORTHBOUND (2024)` × 2).

**Tool built**: `python3 scripts/npmrds-reports/route_build.py audit [--tag auto_generated]
[--out file.json]` — a new subcommand on the existing route-creation CLI (not a one-off script, per
Ryan's explicit "our existing code... should be updated to produce this analysis as well").
Paginates the full routes catalog with `--order id:asc` (load-bearing — see the code comment at
`fetch_all_routes()`: an earlier unsorted pass showed 93% of routes as "duplicates" that were purely
a LIMIT/OFFSET pagination artifact from ties in the default sort, not real data; caught by noticing
the returned ids were exact repeats before trusting the result). Flags single-TMC routes and
duplicate names, enriched with real evidence (TMC road/direction/county/miles via ClickHouse;
identical-vs-differing geometry per duplicate group) — deliberately does NOT cross-reference
`reports_snap_2` usage (see Decisions above).

**Findings**:
- **Single-TMC: 1,617 / 8,660 (18.7%)**. Median length 0.18 mi, 89% under 0.5 mi. Root cause
  (confirmed via code read, `route_gen_corridors.py:82-84`): the generator groups by `(tmclinear,
  road, county, direction)` and never crosses county lines — a road that barely touches a county, or
  gets cut by a county boundary, produces a 1-segment "route." Example found live: `CR-65` exists as
  two separate single-TMC routes (Albany county vs. Schenectady county), same physical road. **Read:
  real geometry, not data corruption — a UI de-prioritization candidate (feeds Workstream A3's
  ranking heuristic), not a deletion candidate.**
- **Duplicate names: 731 groups / 1,559 rows found, 100% differing geometry (0 identical).**
  Root cause confirmed via code read (`route_gen_corridors.py`, pre-fix): the grouping key correctly
  keeps distinct `tmclinear` chains separate, but the name template dropped `tmclinear`, so any
  county with 2+ tmclinear chains for the same road+direction collided on name. Since it was 100%
  name-collision / 0% true duplication, **"combine" was never actually on the table for any of
  these — every one needed a rename.**
  - **Generator fixed** 2026-08-25: `route_gen_corridors.py` now appends `#{tmclinear}` to the name
    whenever a collision would occur — prevents recurrence when the other years (2016, 2018-2026
    excl. 2024) get generated.
  - **All 1,559 existing rows renamed** 2026-08-25 via a one-time migration script
    (`scratchpad/npmrds-sub/dedupe_auto_gen_names.py`, not wired into the durable CLI — a one-time
    data fixup, not a recurring capability): re-derives each row's `tmclinear` from its own
    `tmc_array`, appends the same `#{tmclinear}` disambiguator the generator fix now applies going
    forward. Ran 16-way parallel via `dms dataset update` (confirmed this IS the correct write path
    for split `:data` rows — `dms raw update` needs an explicit `--row-type` and is easy to
    footgun, `dataset update <source> <row-id> --view <id> --set col=val` is the purpose-built,
    shallow-merging path; verified via a single-row before/after `dataset query` re-fetch before
    batching). 1,559/1,559 succeeded, 0 failed, ~2 minutes wall-clock. Re-audit confirmed 0
    duplicate names remain.
- Full detail (single-TMC rows with TMC identity, now-empty duplicate-name groups): 
  `scratchpad/npmrds-sub/auto_generated_route_audit_2026-08-25.json` (regenerated post-rename).

## Workstream D — auth

Intentionally minimal. Touched only via A4's ownership filter (see Decisions above). No folders, no
real permission model, no server-side enforcement.

## Workstream E — Route Creation Plugin redesign (last, not started)

Design source: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/
npmrds-route-creation.html` — an interactive mockup (Alex) transcribed from both the legacy tool and
the current live plugin, explicitly calling out 4 gaps between mockup and live behavior (one being a
paint-color collision with the LOTTR "bad value" red — see the file's own header comment, § 04).
Treat as final per Decisions above. Explicitly sequenced last; mentioned early only so A1's modal
mockup can borrow its visual language.

---

## Progress log

- **2026-08-25**: Kicked off from a large multi-topic ask (Routes/Reports/Users mesh focus, old-reports
  reconversion, auto-gen route cleanup, a minimal auth touch, Route Creation Plugin redesign
  mentioned-but-deferred). Grounding research via 4 parallel forks (task-file tail, existing HTML
  mockups + current route-picker modal, tmc_linear + converter tooling, auth/permissions +
  route-creation design refs) confirmed the shape of each workstream against real code before any
  triage was presented — see this file's Decisions section for the corrections Ryan made against
  that initial triage. `report-authoring-ux-overhaul.md` (2533 lines, fully DONE through Tier 10)
  archived same session per Ryan's own flag that it should have been split already. Workstream C
  built, run, and fully closed out same day (see above). Workstream B kicked off as a background
  agent against `old-reports-conversion.md` (verification + classification pass, no bulk conversion
  run yet — that's a separate go/no-go once the classification lands). Workstream A (the modal
  mockups) is next.
