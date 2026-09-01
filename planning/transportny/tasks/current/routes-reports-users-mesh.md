# Routes/Reports/Users mesh

**Project:** TransportNY · **Topic:** themes · **Status:** kicked off 2026-08-25. Workstreams **A** (picker modal mockups AND the real
`RouteTagBrowserModal`/`ReportPickerModal` implementation, sharing a new `PickerModal/` layer) and
**C** (auto-generated route audit + cleanup) **DONE** same day, both independently live-verified —
**correction 2026-09-01: A4's "mine" facet was NOT actually working for reports** despite being
reported live-verified here; see the Progress log entry below for the two real bugs found+fixed.
**B** (old-reports reconversion inventory) also ran same
day, in its own file (`src/dms/planning/tasks/current/old-reports-conversion.md`, not here — see
below) — surfaced a real live regression, fixed same day: graphs converted from old reports had
silently reverted to "all days, all hours" again since a 2026-08-14 rendering-contract migration
(`routeWindows`) the converter was never updated for (round 72, live-verified). A second,
unrelated crash bug (13/870 corpus reports, a corrupted old-tool relativeDate placeholder) was
fixed 2026-08-26 (round 73) — see that file for both. D
(auth) is intentionally minimal, touched only via A4. E (Route Creation Plugin redesign) explicitly
last, not started. **2026-09-01 (later): "Choose a report" orphaned-row bug** (stale
`reports_snap_2` rows with no live page) — cleanup done + a durable picker-side filter shipped
(see Progress log); the `deletePage` cascade hook that would close the hole at its source is an
open follow-on, not started.
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
- **D superseded 2026-09-01**: the "stays minimal" call above is no longer current — Ryan asked for a
  real (client-side-only) auth/tags scope for Routes and Reports. See Workstream D below for the full
  design; this doesn't reopen A/B/C/E's own sequencing.
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
- **2026-09-01: Workstream D (auth) scoped for real** — no longer "minimal, touched only via
  A4." Full client-side-only ownership/tag design locked (user tag + live-group tags,
  default-restrictive picker visibility, inline header tag editor) — see Workstream D below.
  Not yet implemented.
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

## Workstream D — auth + tags (scoped + BUILT + live-verified 2026-09-01)

**Ask, Ryan's own framing**: client-side-only, "fake it" — no real permission boundary, just make
the logged-in user mostly/only see what they or their group(s) created. Concrete trigger: AVAIL's
own test reports (round after round of `TEST`/`Testing`-named scratch reports this task's Progress
log is full of) should stay invisible to non-AVAIL client users by default. Tags are the mechanism —
they're already replacing the old tool's folders (`dynamic-reports-and-route-tags.md`), and now
carry the ownership signal too.

### Confirmed mechanics (read the real code before designing, not assumed)

- `CMSContext`'s `user` (from `AuthContext`, `src/dms/packages/dms/src/patterns/auth/context.js`)
  already carries `id`, `email`, and a real, server-verified `groups: string[]` — the login groups
  the user actually belongs to for this project (`avail_auth` DB, `groups`/`groups_in_projects`/
  `users_in_groups`, joined per-project in `jwt.js`). Nothing new needed to read "my groups."
- **Real finding, not assumed**: queried `avail_auth` directly (read-only,
  `DBQ_OLD_CONFIG=.../availauth.config.json dbq.py old`) for the `npmrdsv5` project's live groups —
  `AGFTC, AVAIL, BMTS, CDTC, ECTC, GBNRTC, GTC, ITCTC, MHV, MPOs, MTA, "NPMRDS New Users",
  "NPMRDS_PM3 New Users", "NPMRDS Public", "npmrdsv5 Public", NYMTC, NYSAMPO, NYSDOT,
  "NYSDOT Admin", OCTC, PDCTC, SMTC, "Traffic Management Group", UCTC` (24 groups). Compared against
  `RouteTagBrowserModal/tagCategories.js`'s hardcoded `AGENCY_CODES` (22 codes): **15 overlap, but
  the two lists are independently-maintained and already drifted** — `AGENCY_CODES` was mined from
  the OLD tool's `admin2.folders` table (2026-07-31 inspection), never from the live auth system.
  `WLD/SDD/TDD/MDD/HOCTS/NYSDOT_CONSULTANT` are legacy-only (no live group, nobody can ever "be a
  member" going forward); `ECTC/MPOs/MTA/"NPMRDS_PM3 New Users"/"NPMRDS Public"/"npmrdsv5
  Public"/"NYSDOT Admin"/"Traffic Management Group"` are real, current groups the vocabulary is
  missing. A plain uppercase/underscore slug of the live group name reproduces the existing codes
  exactly wherever they were meant to line up (`"NPMRDS New Users"` → `NPMRDS_NEW_USERS`, already in
  the list) — reconciling this is mechanical, not a redesign.
- `created_by` (DMS system column, `user.id`) is real and already used, but only as a **soft**
  ranking boost (`reportScore.js`/its route-side twin, +30) plus an **opt-in** "Mine" facet chip
  (`ReportPickerModal.jsx`) — nothing hides other people's content today.
- Tags already live as a `tags` multiselect JSON column on each dataset row (`routes_data`,
  `reports_snap_2`), filtered via the existing generic `array_contains` UDA op — no backend/library
  change needed for any of this. Two separate, already-diverged tag-entry UIs exist:
  `ReportTagsEditor.jsx` (RRL "Report settings" submenu, has `canonicalizeTag`) and
  `SaveRouteModal.jsx`'s inline `TagsInputField` (route save modal, plain free-text, **zero**
  canonicalization or validation today).

### Design, locked 2026-09-01

1. **New `user:<id>` tag**, written into `tags` — distinct from the immutable `created_by` audit
   column. Supersedes the 2026-08-25 A4 decision above ("no new `user:{id}` tagging convention
   needed for v1") for a different purpose: that decision was about the *ownership-filter signal*
   (still `created_by`, unchanged); this is a *visible, removable* tag an author can see/manage.
2. **Group tags derived live from `user.groups`**, not the static list — canonicalized via a small
   slug helper into the existing `agency:<CODE>` namespace. `AGENCY_CODES`
   (`tagCategories.js`) gets extended with the 8 real-but-missing codes found above (`ECTC`, `MPOS`,
   `MTA`, `NPMRDS_PM3_NEW_USERS`, `NPMRDS_PUBLIC`, `NPMRDSV5_PUBLIC`, `NYSDOT_ADMIN`,
   `TRAFFIC_MANAGEMENT_GROUP`) so they're browsable too. Future new auth groups become usable with
   zero code changes — kills the "keep these two lists in sync by hand" footgun the current file's
   own comment already flags.
3. **One shared `TagsEditor` component**, replacing both `ReportTagsEditor.jsx` and
   `SaveRouteModal.jsx`'s ad hoc field: pre-populates with `user:<id>` + the viewer's own group
   tags; free add/remove; renders the viewer's not-yet-added groups as one-click suggestion chips;
   **rejects** committing any `agency:`-namespaced value that isn't one of the viewer's own groups
   (typed OR picked — closes `SaveRouteModal`'s current zero-validation free-text gap too).
4. **Auto-tagging at creation, not just at editor-open**: a new report gets its default tags written
   the moment its `reports_snap_2` row is first created (`useReportRow.js`'s existing "ensure row"
   effect is the hook); a new route gets them pre-filled into `SaveRouteModal`'s initial state.
   **No backfill** of the ~900 existing `reports_snap_2` rows or ~8,660 existing routes — go-forward
   only, same as the original Route Tags rollout.
5. **Default-restrictive picker visibility, CORRECTED 2026-09-01 (Ryan's own wording correction) —
   an allow-list, not a hide-list-with-exceptions.** Original wording above ("hide only when it's
   clearly someone else's") was backwards from what Ryan actually wants: **untagged/legacy content
   is hidden from non-AVAIL users by default, full stop** — visibility is now a positive allow-list.
   `ReportPickerModal`/`RouteTagBrowserModal` show a row to a non-AVAIL viewer only when at least one
   of: (a) `created_by` is the viewer, (b) the row shares a group tag with the viewer, or (c) the row
   carries a specific "always shown" curated marker (below). Everything else — the ~900
   `reports_snap_2` legacy rows, the 4 golden-corpus test fixtures, ordinary (non-auto-gen) old
   routes — is hidden by default. Explicit "Show everyone's" toggle still reveals the full catalog.
   Priority reasoning, Ryan's own framing: the client is a low-skill, easily-distracted user, and
   right now "looking orderly" matters more than the underlying data actually being clean — every
   item shown by default should have an obvious reason for being there.
   **AVAIL itself is exempt from the restriction** (not explicitly asked, but follows directly from
   the stated goal — AVAIL runs this system and needs to see its own operational content; since
   AVAIL staff already share the `agency:AVAIL` group tag with each other under the auto-tagging
   design, this mostly falls out for free, but the "Show everyone's" default should start ON, not
   OFF, for any viewer whose own groups include `AVAIL`).
6. **Curated "always shown" markers — the two exceptions, both are backfill, not new ongoing logic.**
   Ryan confirmed exactly two categories keep showing to everyone regardless of tags: the Dynamic
   Report templates (reports) and the `tmc_linear` auto-generated routes (routes) — because both have
   an obvious, explainable reason for being there. Mechanism:
   - **Routes**: already covered — `tmc_linear` routes already carry the existing `auto_generated`
     tag (Workstream C's audit/generator work). Just need to confirm it's actually present on the
     current 8,660-row catalog before relying on it (a quick read-only check, not a rebuild), and
     add `auto_generated` to the picker's allow-list check.
   - **Reports**: genuinely needs a backfill — the 12 (or however many currently exist)
     `reports_snap_2` rows built from `dynamic_report_specs/*.json` don't carry any positive marker
     today. Tag them with a new `dynamic_report_template` value (plain reserved tag, not one of the
     `county:`/`region:`/`agency:`/`user:` prefixed families) and add it to the picker's allow-list
     check. One-time script, keyed off `_built_from_spec` pointing at `dynamic_report_specs/` (NOT
     `report_probe_fixtures/specs/golden-corpus-*.json` — those 4 stay hidden by design, they're
     regression-test fixtures, not client-facing content).
   - The 6 "other real reports" and 4 golden-corpus fixtures found in the 2026-09-01 cleanup
     (Progress log) get NO special marker — under Ryan's explicit ruling, only Dynamic Report
     templates are visible to non-AVAIL among reports, so these stay hidden by default (correct
     outcome of applying the rule as stated, not a gap to chase further).
   - **Framing, Ryan's own correction**: these two markers are a one-time backfill on the CURRENT
     catalog, not a permanent pair of hardcoded exceptions layered onto the general rule. Going
     forward, real users' own new routes/reports get auto-tagged with their `user:`/`agency:` tags at
     creation (item 4 above) and are found via the normal owner/group-match path — nothing new needs
     the curated marker over time.
7. **Inline header tag editor** (Ryan's pick over a Done-modal or leaving it in the RRL submenu): a
   compact tag-chip row lives directly in `ReportPageHeader.jsx`'s edit controls, next to the
   Done/Edit button — always visible while editing, no extra click. Needs a small new hook
   (`ReportPageHeader` doesn't currently touch `reports_snap_2` at all — `ReportRouteList.jsx`'s
   `useReportRow` owns that row) that reads/writes just the `tags` field of the SAME row RRL owns
   `routes` on; safe because both `persistRoutes`/`persistTags` already coexist via JSONB-merge
   writes, same pattern as today.

### Explicitly not in scope

No server-side enforcement (a filter's user id is never checked against the auth token — same
caveat the 2026-08-25 A4 decision already stated). No real folders, no per-row ACL, no report
discovery/index page beyond the existing pickers (`project_reports_folders_discovery_permissions_
out_of_scope` memory's original ruling on discovery + permissions still stands — only route
organization/tags were ever reopened). No backfill of tags onto pre-existing content **beyond the
two curated markers in item 6** — the general "hide untagged legacy content" default needs no data
migration, it falls straight out of the allow-list rule as written.

### Status: BUILT + live-verified 2026-09-01 — see the Progress log entry
("later still, BUILT + live-verified") for the full implementation record, the two
live-caught corrections, and what was explicitly left out (server-side enforcement,
backfilling `user:`/`agency:` tags onto pre-existing content, a live routes-side check).

## Workstream E — Route Creation Plugin redesign (last, not started)

Design source: `src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/
npmrds-route-creation.html` — an interactive mockup (Alex) transcribed from both the legacy tool and
the current live plugin, explicitly calling out 4 gaps between mockup and live behavior (one being a
paint-color collision with the LOTTR "bad value" red — see the file's own header comment, § 04).
Treat as final per Decisions above. Explicitly sequenced last; mentioned early only so A1's modal
mockup can borrow its visual language.

---

## Progress log

- **2026-09-01 (later still, BUILT + live-verified)**: Workstream D implemented end-to-end
  from the locked design, per Ryan's go-ahead. Files: `RouteTagBrowserModal/tagCategories.js`
  (8 new real `AGENCY_CODES` entries + `slugifyGroupName`/`groupNameToAgencyTag`/`makeUserTag`/
  `isUserTag`/`isAgencyTag`/`defaultTagsForUser`/`isTagAllowedForUser`/`DYNAMIC_REPORT_TEMPLATE_TAG`),
  new shared `TagsEditor/` (`TagsEditor.jsx` + `.theme.js`, replaces both the old
  `ReportRouteList/ReportTagsEditor.jsx` — deleted — and `SaveRouteModal.jsx`'s old zero-validation
  free-text field), `PickerModal/pickerScoring.js` (`isAvailUser`, `buildVisibilityAllowListFilterGroup`),
  `ReportPickerModal.jsx`/`RouteTagBrowserModal.jsx` (new "Show everyone's" facet chip wired to the
  allow-list), `useReportRow.js` (auto-tags a report's catalog row the moment it's first created),
  `routecreation/comp.jsx` + `SaveRouteModal.jsx` (auto-tags a brand-new route's modal state),
  new `ReportPageHeader/useReportTags.js` (a second, independent read/write hook onto the SAME
  `reports_snap_2` row RRL owns `routes` on — see its own header comment for why this is a separate
  fetch, not shared state) + `ReportPageHeader.jsx`/`.theme.js` (inline tag editor next to Done).

  **Two corrections mid-build, both from Ryan watching the live result:**
  1. The visibility rule as first written was backwards — "hide only when clearly someone else's,
     untagged stays visible" — from what Ryan actually wants: untagged/legacy content hidden from
     non-AVAIL by default, full stop (an allow-list, not a hide-list). Fixed in the Workstream D
     section above before any code was written against the wrong version. Two curated markers stay
     visible to everyone regardless: `auto_generated` (routes, already present — confirmed live via
     read-only query, exactly 8,660/8,660 `tmc_linear` rows carry it, matching the Workstream C
     audit count) and a new `dynamic_report_template` tag (reports — genuinely needed backfilling,
     see below).
  2. `ReportPageHeader.jsx`'s tag editor didn't appear at first — it was gated on `canEdit =
     editPageMode && sectionEditorOpen` (this section's own separate pencil-click), not just
     `editPageMode`. Ryan's correction: "if the PAGE is in edit mode, the user SHOULD NOT HAVE TO
     change any component into edit mode to make changes" — same "no extra click" convention RRL
     already documents for itself. Fixed by dropping the `sectionEditorOpen` requirement entirely
     (`canEdit = Boolean(editPageMode)`) — applies to the WHOLE header (kicker/purpose/freshness/
     data-link fields too, not just the new tag editor), not a narrow tags-only carve-out. A third
     live-caught issue: the new tag editor's first drop-in used `TagsEditor`'s generic blue-chip
     default theme, which visibly clashed with this header's own deliberate dark/gold/uppercase
     design system ("the CSS in the header component is off now"). Fixed with a real header-matched
     theme override (`ReportPageHeader.theme.js`'s new `tagsEditor*` keys, reusing
     `inlineFieldLabel`/`routePill`'s own look) plus a new `inline` prop on the shared `TagsEditor`
     (label beside the chips in one row, not stacked above) — a genuine small reusable addition, not
     a one-off hack, since any future compact placement can reuse it. Once fixed, Ryan asked for the
     now-redundant RRL "Report settings" tag editor to be removed entirely (done — `ReportRouteList.jsx`
     no longer renders a tags row at all; report tagging lives only in the header now).

  **Live-verified** (claude-in-chrome, authenticated as the real dev user, `report_probe.mjs --auth`
  first confirming 0 console/page/SQL errors on the edit page): the header tag editor renders inline
  next to Done with zero extra clicks; "+ You"/"+ AVAIL" one-click suggestion chips appear correctly
  (derived live from `user.groups`, not a hardcoded list); typing "NYSDOT" (a real vocabulary value
  the test user is NOT a member of) is correctly rejected inline ("You're not in NYSDOT — ask an
  admin to add you to that group first."), text stays uncommitted; adding/removing a tag persists
  across reload and doesn't touch `routes`/`name`/`page_path` on the same row (JSONB-merge writes
  coexisting correctly, same mechanism RRL's own routes/tags writes already relied on). Captured the
  actual `/graph` request from "Choose a report" with "Show everyone's" toggled off: filterGroups
  decoded to exactly `{OR: [created_by=993, tags array_contains [user:993, agency:AVAIL,
  dynamic_report_template]]}` — confirms the allow-list composes correctly server-side from real
  generic UDA primitives, not just client-side. Toggled on by default for this AVAIL test account
  (confirmed via the chip's active styling) — couldn't directly observe an exclusion effect since
  every row in this dev corpus already belongs to (or is taggable by) the one real human test
  account, but the captured query proves the mechanism itself is correct.

  **Backfill done** (the one-time, go-forward-only exception from the Design section): all 12
  `reports_snap_2` rows built from `dynamic_report_specs/*.json` (identified via
  `_built_from_spec`, NOT the 4 golden-corpus fixtures) now carry `dynamic_report_template` in
  addition to their existing `category:`/`difficulty:` tags (a taxonomy this session discovered
  already existed, unrelated to county/region/agency) — via `dms dataset update`, one row tested
  and read back before batching the other 11, all 12/12 confirmed via a read-only re-query.
  `auto_generated` needed no backfill (already correct, see above).

  **Not done, explicitly out of scope for this pass**: no server-side enforcement (unchanged from
  the original v1 scope call); no backfill of `user:`/`agency:` tags onto any other pre-existing
  content; the routes-side `comp.jsx`/`SaveRouteModal.jsx` auto-tag-at-creation and `TagsEditor`
  wiring were code-reviewed carefully (structurally identical to the proven reports-side wiring) but
  NOT live-verified in a browser — the route-creation map-plugin's live page URL wasn't found this
  session (a genuine "where does this even live" gap, not a bug); worth a live pass next time that
  page is being worked on anyway.

- **2026-09-01 (later still, correction)**: Ryan corrected the Workstream D visibility rule right
  after it was written — his intent was an allow-list (untagged/legacy hidden from non-AVAIL by
  default), not a hide-list-with-exceptions (untagged visible by default, hide only clear foreign
  ownership) as first drafted. Two curated categories (Dynamic Report templates, `tmc_linear`
  auto-gen routes) stay visible to everyone via a one-time backfill tag, framed explicitly as
  backfill/current-catalog cleanup, not permanent hardcoded exceptions to the general rule. Section
  above rewritten in place (item 5 corrected, new item 6 for the backfill). Also asked a
  non-blocking side question (how custom/free-form tags work + the groupBy/count-per-tag
  limitation) — answered in-conversation, not written into this file (pure explanation, no design
  decision attached).

- **2026-09-01 (later still)**: Workstream D (auth) scoped for real, per Ryan's explicit ask —
  full writeup above in "Workstream D — auth + tags." Grounding included a live, read-only query
  against `avail_auth` (the real auth DB) to check Ryan's own hunch that login groups already match
  the `agency:` tag vocabulary — confirmed a real, previously-undiscovered drift (15/22 overlap, 8
  live groups missing from the tag vocabulary, 6 tag codes with no live group), not just a
  hypothetical. Two design calls made via AskUserQuestion (both went with the recommended option):
  picker visibility defaults to hiding other people's/groups' content rather than staying opt-in,
  and the report tag editor surfaces inline in `ReportPageHeader.jsx` rather than a Done-modal or
  staying buried in RRL's submenu. Not yet implemented — next session picks up the build from the
  Workstream D section's "Design, locked" list.

- **2026-09-01 (later same day)**: User-reported a second, distinct bug — "Choose a report" surfaces
  results whose slug has no live page (example: `claude_scratch_quickcontrols_when_check`, navigating
  there redirects to the site homepage). Hypothesis (confirmed): the generic DMS "Delete Page" admin
  action (`pagesEditor.jsx`'s `deletePage`, `dms.controller.js`'s `deleteData`) never cascades to
  `reports_snap_2` — a page's `type` (`{pattern}|page`) has no `:`, so `deleteData`'s cascade check
  (`kind === 'source' || 'view'`) never fires, confirmed by direct code trace, not just inference.
  Scoped into three parts: **(1) one-off cleanup of existing orphans — DONE this entry**, (2) an
  optional `deletePage` cascade hook (opt-in via `ThemeContext`, zero behavior change for any site
  that doesn't define it — not yet built), (3) a durable picker-side filter that drops any result
  whose `report_id` no longer resolves to a live page (batched existence check, not per-row — not
  yet built).

  **Cleanup (1), DONE**: `scratchpad/npmrds-sub/cleanup_orphaned_reports_snap.py` (reads via
  `psql_new`, deletes via `dms raw delete`, 16-way parallel — same conventions
  `backfill_report_page_path.py`/`dedupe_auto_gen_names.py` already established). Dry-run surfaced
  that the naive "report_id doesn't resolve to a live page" test conflates two very different
  populations: **868 rows** have a `report_id` under 100000 — the OLD tool's own small-integer
  report ids from an early conversion pass that predates the "report_id = the new page's own DMS id"
  convention (real DMS ids here start at 225867) — these are the SAME ~934 rows this file's earlier
  2026-09-01 entry already found and explicitly ruled out of scope ("pre-existing DB churn... not a
  symptom of this bug"); left untouched, per that standing decision. **73 rows** were genuine
  orphans — a real (large) page id that no longer exists, or (one row) a corrupted non-numeric
  `report_id` value — matching the actual bug just reported, including the exact reported example
  (snap row `2212675`, report_id `2212666`). Deleted all 73, 0 failures, confirmed via re-query
  (`reports_snap_2` row count 969 → 896; row 2212675 confirmed gone).

  **Follow-up same session**: Ryan then explicitly overrode the "out of scope" call on the 868
  legacy rows above — the end state he wants is `reports_snap_2` containing ONLY real,
  navigable-via-web new-tool reports, full stop. Ran the same script with `--legacy` (also deletes
  rows with `report_id < 100000`): 868 deleted, 0 failures. `reports_snap_2` row count 896 → 28.
  Manually reviewed all 28 survivors — every one has a real name and a `page_path` matching an
  actual live page (golden-corpus test reports, the 12 Dynamic Report template instances, and a
  handful of individually-named real reports) — confirmed clean. Items (2) (`deletePage` cascade
  hook) and (3) (picker-side live-page filter) not yet built — next up.

  **Second follow-up, same session**: Ryan asked for a created-at breakdown of the 28 survivors
  (to correlate creation cohort with functionality/bugs), which surfaced 3 clear cohorts: 12 rows
  created 08-17 20:26-20:32 (confirmed real Dynamic Report template instances — each snap row's
  `_built_from_spec` points at `scripts/npmrds-reports/dynamic_report_specs/<name>.json`), 6 rows
  created 08-26/08-27 one at a time (individually-authored manual test reports, no spec marker),
  and 10 rows created 08-31 (today's session — R5 HELP/NYC Test/787 NB/NITTEC 150/Madison Ave/I-87
  Exit 4, plus 4 "Golden Corpus" rows whose `_built_from_spec` points at
  `report_probe_fixtures/specs/golden-corpus-*.json` — the golden-corpus regression-test fixtures,
  a DIFFERENT spec family from the Dynamic Report templates). Ryan then asked to delete every
  non-dynamic-report page created on or before 8/27 — resolves to exactly the 6 manual test
  reports from the second cohort (Skyway SB vs. Lake Ave EB/WB Jan 5 2017 `2214921`, Van Wyck CO2
  Test Single TMC `2214949`, Inc 3/1/2023 NY33 EB @ Dodge St `2214973`, I-190 NB COVID Comparison
  `2215001`, Rochester Inner Loop `2215037`, K-Bridge 9-21-17 `2215071`). Unlike the cleanup above
  (which only ever touched orphaned catalog rows), this deleted 6 REAL live pages — both the page
  itself (`dms raw delete npmrdsv5 npmrds_sub|page <id>`) and its `reports_snap_2` catalog row
  (same command against `reports_snap_2|2177440:data`), done manually for both since the
  `deletePage` cascade hook (item 2) doesn't exist yet — confirmed via re-query: `reports_snap_2`
  28 → 22, all 6 page ids gone from `data_items`. `reports_snap_2` now contains only the 12
  Dynamic Report templates, the 4 golden-corpus fixtures, and 6 other real reports (22 total).

  **Item (3), DONE — picker-side live-page filter.** Added `checkIdsExist(falcor, app, ids)` to
  the `@availabs/dms` library's `api/` layer (`src/dms/packages/dms/src/api/index.js`, re-exported
  from the package root) — a genuinely reusable, generic addition: batch-checks which of a list of
  ids still exist as `data_items` rows for an app, in ONE round trip, by calling the
  `dms.data[{app}].byId[{ids}][{attrs}]` Falcor route directly (it already fans an array of ids
  into a single server-side `WHERE id IN (...)` query). Needed a real new function rather than
  reusing `apiLoad`: `dmsDataLoader`/`createRequest.js`'s `'edit'`/`'view'` action path derives
  exactly one id-ref per active config (`dmsDataLoader`'s `activeIds` derivation reads a single
  `$ref` per config), so it can't be repurposed for a bulk check.
  `useReportSearch.js` now runs a second pass after the underlying catalog fetch settles: collects
  the `report_id`s of the returned rows, calls `checkIdsExist`, and drops any row whose id doesn't
  come back — fails open (keeps all rows) on a transient error rather than blanking the list, and
  guards against a slow check clobbering a newer search's results the same way `useCatalogFetch.js`
  already does (a monotonic request-id ref). `ReportPickerModal.jsx` now also destructures `falcor`
  from `CMSContext` to pass through.
  **Live-verified**: created a synthetic orphaned `reports_snap_2` row (snap `2216211`,
  `report_id: '999999999'`, name "TEST ORPHAN FILTER VERIFY", real `page_path`) — before this fix
  it would have matched the catalog query outright; searching for it in "Choose a report" (live,
  via claude-in-chrome) correctly returned **0 reports / "No reports found"**, zero console errors.
  A real search ("Golden") still correctly returned all 4 golden-corpus reports. Deleted the test
  row after verifying. Files: `src/dms/packages/dms/src/api/index.js`, `src/dms/packages/dms/src/index.js`,
  `src/themes/transportny/components/ReportPickerModal/useReportSearch.js`,
  `src/themes/transportny/components/ReportPickerModal/ReportPickerModal.jsx`.

  **Item (2), NOT STARTED — follow-on/TODO.** The `deletePage` cascade hook (an optional
  `themeFromContext?.admin?.onPageDeleted?.(page, {...})` call in `pagesEditor.jsx`'s `deletePage`,
  ~line 815 — `ThemeContext` is already in scope there — wrapped in try/catch so it can never break
  page deletion for any site; zero behavior change for every site that doesn't define the hook)
  would close the hole at its source instead of relying solely on item (3)'s safety net. Deferred,
  not abandoned — item (3) alone is durable enough for now per Ryan's own framing of it as "works
  indefinitely." Pick this up when there's appetite for a shared-library-touching change (affects
  every DMS site's page-delete path, not just transportny, even though the hook itself is opt-in).

- **2026-09-01**: User-reported bug — created a report via "Create Report" on `/converted_reports`,
  published it with zero routes, then couldn't find it in "Choose a report" under the "Mine" chip.
  Root-caused to **two independent, compounding bugs**, both confirmed live against the dev DB
  (not just by reading code):
  1. **A report with zero routes never gets a `reports_snap_2` catalog row at all.**
     `CreateReportButton.jsx` → `newPage()` only creates the page; the catalog row was only ever
     created lazily, the first time an author added a route (`ReportRouteList/useReportRow.js`'s
     `persistRoutes`). Since `useReportSearch.js`'s base query unconditionally requires
     `page_path notempty` + `name notempty` on that row, a routeless report is invisible in
     "Choose a report" under **every** facet, not just "Mine" — confirmed live: page `2216183`
     ("Page 23") had zero `reports_snap_2` rows anywhere in the DB despite being published.
  2. **The "Mine" facet was never wired to a field anything populates.** `reportCatalogSource.js`
     declared `created_by` as a plain `data->>'created_by'` JSON column — a *different* thing from
     DMS's own audit column of the same name (auto-stamped from the auth token on every write,
     confirmed live: page `2216183`'s real system `created_by` = `993`, correctly the logged-in
     user). Nothing ever wrote the JSON field: the Python converter stashes the old tool's creator
     under an inert `_old_created_by` key instead, and the live `persistRoutes`/`persistTags`
     writers never sent `created_by` at all. So "Mine" could never match ANY report, converted or
     live-authored — this is the actual reason A4 (in the Decisions section above, and the
     2026-08-25 "live-verified" entry below) turned out not to work despite reading as solved: the
     design note assumed the auto-populated system column, but the implementation keyed off a
     separate, hand-maintained field of the same name.

  **Fixed**, both live-verified: (1) `reportCatalogSource.js`'s `created_by` column now declared
  `systemCol: true` (same convention as `id` elsewhere in this codebase), so it resolves to the
  real, always-populated system column — proven live via the exact same `{col:'id', op:'filter'}`
  pattern `useDynamicReportRoutes.js` already uses for systemCol filtering. (2)
  `useReportRow.js`: `persistRoutes`/`persistTags` now also send `name`/`page_path` (derived from
  the page's own title/url_slug) on every write — self-healing, since the underlying write is a
  JSONB merge — and a new effect creates the catalog row immediately when a report's edit page
  opens and none exists yet, instead of waiting for a route to be added. Along the way, found and
  fixed the reason that new effect didn't fire on the first attempt: a UDA query with zero matching
  rows returns a truthy placeholder object (every field a valueless Falcor atom) rather than an
  empty result, which `loadReportRow`'s naive truthiness check couldn't tell apart from a real row
  — now an id-less extraction is correctly treated as "no row."

  **Live-verified end-to-end** via claude-in-chrome, in the user's own authenticated session:
  reloading "Page 23"'s edit page created its `reports_snap_2` row on the spot (`name`/`page_path`
  populated, system `created_by=993`); "Choose a report" → search "Page 23" → "Mine" chip active
  shows it with both "Mine" and "Rebuilt" pills. **Backfilled** 6 other pre-existing live pages
  found with the same broken (name/page_path-less) catalog row from earlier manual testing (Pages
  13/19/20/22/25/26) via `dms dataset update` — all now read back correctly. Did NOT touch the
  ~934 other `reports_snap_2` rows in the dev DB found during the investigation — those point at
  report ids with no live page at all (pre-existing DB churn from `--replace` reconversions/dev-DB
  resets across many past rounds), out of scope, not a symptom of this bug.
  Files: `src/themes/transportny/components/ReportPickerModal/reportCatalogSource.js`,
  `src/themes/transportny/components/ReportRouteList/useReportRow.js`.

- **2026-08-26**: Ryan corrected a standing wrong assumption: `/converted_reports` (page
  2188366) is the site's real homepage, not `/converted_reports/reports` (page 2208581, the
  curated Reports catalog one level under it) — fixed throughout `traversing-report-pages.md`.
  On the real homepage, fixed the **"New Report"** button (was a dead static `Card` link to
  `/converted_reports/reports`, section 2214127) and added an **"Open Report"** button next to
  it, both by reusing the exact same registered `CreateReportButton`/`ChooseReportButton`
  components already proven live one level down on 2208581 — new published rows 2214758/2214759
  in 2188366's `Header` section group. Live-verified via claude-in-chrome: real `<button>`s (not
  links), "Choose a report" pops the real `ReportPickerModal` with 60 results, zero console
  errors, `title`/`url_slug`/`published` unaffected. Full writeup incl. the new safe-write-path
  finding (`dms page update --data` with a `sections`-only payload is safe for page-level array
  fields, unlike `--set`) in `traversing-report-pages.md`'s new "The real homepage" section.
  **Follow-up same day**: Ryan flagged the first pass as too heavy visually — reused button
  section data verbatim, which stacked both buttons full-width with a redundant header band
  instead of sitting compact and inline. Fixed on BOTH pages (Reports page 2214746/2214747 too,
  not just the homepage) via 4 single-field `--set` calls (`size: "6"→"3"` on both buttons,
  `title: ""` on `ChooseReportButton`, matching `padding.top:8` so they align) — no code changes.
  Root cause + fix fully written up in `traversing-report-pages.md`. **Second follow-up, same
  day**: Ryan then wanted the buttons truly inline with "New Route" (not just with each other).
  Found a stale, unrelated draft (2026-08-20, predates today's work) that had already solved this
  for `CreateReportButton` alone by splitting row 1 into 5 narrower cells — reused that proven
  layout, resized the published row-1 cells (heading/search/freshness+route Cards, byte-identical
  content to the draft, confirmed via `dms raw get` before touching) to make room, landing all six
  pieces (heading, search, freshness+route, New Route, Create Report, Choose a Report) on one row.
  Hit one real CLI footgun along the way: `dms section update --data {...}` never unsets a field
  just because it's absent from the payload (the shallow `||` merge only adds/overwrites present
  keys) — had to explicitly send `{"padding": null}` to clear a stale `padding.top` override.
  DONE, Ryan confirmed final result live. Full detail + the footgun in
  `traversing-report-pages.md`.
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
