# Converter redesign: stop replicating redundant old route_comps

**Project:** TransportNY · **Topic:** themes · **Status:** DONE, implemented + live-verified ·
**Started/finished:** 2026-08-07

This file exists to durably capture a core-assumption correction Ryan gave directly (2026-08-07), plus
the research that scopes the fix, **before any code changes** — per his own framing: "I feel like
you/we have not properly internalized it," so getting the write-up right matters more than shipping
fast here. Nothing in this file has been implemented yet. Read this in full before touching
`convert_old_reports_lib/`'s route-building code.

## The core assumption change, stated precisely

The converter's old mental model was: **faithfully replicate every old `route_comp` as its own new
"route."** That model is now wrong, because Design Push #2 (2026-08-06, see
`../completed/reports-page-template-catalog.md`'s hotfix section and
`../../../../src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md`) moved
**weekday-mask and time-of-day-within-a-date-range** off the route and onto each graph's own
`display._measurePick.weekdays`/`start`/`end` (read by `useGraphPublish.js`'s
`transformReportRoutes`). A lot of what the old tool represented as *separate routes* — because the
old tool had no other way to give one graph an AM-peak view and another a PM-peak view of the *same*
corridor/dates — are really one underlying route, sliced differently per graph.

**Ryan's explicit correction, verbatim in spirit (2026-08-07): "post design pass 2, we still need
separate routeComps to represent different date ranges. DATES are still handled on a per route
basis."** This is the load-bearing constraint that makes this a *narrower* fix than "collapse
anything that looks similar":

- **Redundant, should collapse**: two old comps share the same TMC set (routeId) **and** the same
  calendar date range, differing only in the old tool's own peak-period/weekday/resolution slicing.
- **NOT redundant, must stay separate routes**: two old comps share a TMC set but have **different
  calendar date ranges** — before/after comparisons, year-over-year, a 2017-2024 "all-time" window
  vs. a 2023-only window. Date range is still a real, route-level fact.

Do not implement a fix that collapses on TMC-set/routeId alone — it must also match on the exact
calendar `startDate`/`endDate`, or it will silently merge two legitimately-different routes (e.g. a
before-window and an after-window) into one, breaking every before/after and year-over-year report in
the corpus.

## Concrete evidence: the "Snapshot" catalog page's real data

Pulled directly from the live `reports_snap_2` row for old template 246 (the "Snapshot" catalog
page, `converted_reports/snapshot`, page id `2209200`) — 11 written `routes[]` entries that are
really only **4 distinct (TMC-set, calendar-date-range) identities**:

| # | name | route_slot_group (routeId) | calendar dates | time-of-day suffix |
|---|---|---|---|---|
| 0 | 2023 - 5 min ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 1 | 2023 - AM ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 2 | 2023 - PM ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 3 | 2023 - Off ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 4 | 2023 - Weekday ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 5 | 2023 - Monthly ... | 163185 | 2023-01-01 → 2023-12-31 | 07:00 → 19:00 |
| 6 | All-time Average ... | 163185 | **2017-01-01 → 2024-12-31** | 07:00 → 19:00 |
| 7 | I-490 36055 EB AM Peak | 6476 | 2023-01-01 → 2023-12-31 | **07:00 → 10:00** |
| 8 | I-490 36055 WB AM Peak | 6475 | 2023-01-01 → 2023-12-31 | **07:00 → 10:00** |
| 9 | I-490 36055 EB PM Peak | 6476 | 2023-01-01 → 2023-12-31 | **16:00 → 19:00** |
| 10 | I-490 36055 WB PM Peak | 6475 | 2023-01-01 → 2023-12-31 | **16:00 → 19:00** |

Reading this against Ryan's rule:
- **Rows 0-5** (route_slot_group `163185`): identical calendar dates AND identical time-of-day
  suffix. These 6 are the textbook redundant case — same route, 6 different old-tool labels
  (5-min/AM/PM/Off/Weekday/Monthly) that map to graph-level resolution/weekday/time choices now, not
  route identity. **Should collapse to 1 route.**
- **Row 6** (`163185`, but 2017-2024 instead of 2023 alone): same routeId, but a **genuinely
  different calendar date range** — this is exactly the case Ryan says must stay separate. **Stays
  its own route.**
- **Rows 7 & 9** (`6476`, same calendar dates, different time-of-day 07:00-10:00 vs 16:00-19:00):
  same routeId, same calendar dates, only the time-of-day portion differs. Under the corrected model
  this is **also a same-date-range case** (the calendar range is identical; only the intra-day
  window differs) — so per Ryan's rule ("dates" = calendar range) these **should also collapse** to
  one EB route feeding two graphs (AM-peak `_measurePick`, PM-peak `_measurePick`). Same reasoning
  for rows 8 & 10 (`6475`, WB).
- Net result: **11 rows → 4 real routes** (163185-full-year, 163185-all-time, 6476-EB, 6475-WB), each
  feeding however many graphs it used to correspond to separate rows for.

This means the collapse key is **(routeId, calendar startDate, calendar endDate)** — deliberately
*not* including the time-of-day (`startTime`/`endTime`) portion of the old settings, since that's
exactly the facet that moved to the graph. Confirm this reading with Ryan before implementing — it's
the one place "date range" could be read two ways (whole timestamp vs. calendar-date-only), and
getting it wrong either merges too little (rows 7/9, 8/10 stay separate, missing half the win) or
merges too much (if a future case has the same calendar dates but a real, still-meaningful
route-level reason to differ that isn't time-of-day).

## Current pipeline (confirmed by reading the code, not inferred)

Traced end to end via a dedicated research pass (2026-08-07):

1. **`flatten_route_comps`** (`db.py:97-111`) — un-nests `type:"group"` wrapper comps only. Every
   returned item is still the raw old `route_comp` dict: `routeId`, `compId`, `name`,
   `settings.{startDate,endDate,startTime,endTime,weekdays,resolution,dataColumn,...}`, `color`. No
   TMC array resolved yet (that happens per-comp, right before entry-building, via
   `old_routes[routeId]["tmc_array"]` or `resolve_tmc_array`). **Everything needed to detect a
   duplicate — routeId, calendar startDate/endDate — is already present at this point; no new data
   needs to be plumbed in.**
2. **`route_comp_display_name`** (`transforms.py:106-126`) — renders the old comp's `compTitle`
   template into a plain string. **There is no structured, machine-readable peak-period field
   anywhere** — "AM"/"PM"/"Off"/"Weekday"/"Monthly" only exist as substrings of `compTitle`/`name`,
   never a separate `settings.peakLabel`. Any dedup logic must group on the *effective*
   `(routeId, startDate, endDate)` triple, not on name-string patterns.
3. **`build_route_entry`** (`transforms.py:129-201`, real `--report-id` reports) — one comp → one
   `routes[]` entry. Writes `route_id`, resolved `tmc_array`, `startDate`/`endDate` (via
   `to_datetime_str`, which is where the time-of-day suffix gets baked onto the date string —
   `transforms.py:133-134`), `weekdays`, `route_comp_id`, `graphIds`. **Does not write
   `route_slot_group` at all** — there is no existing same-routeId grouping key on this path.
4. **`build_slot_entry`** (`transforms.py:204-260`, `--template-id` templates only) — same one-comp-
   one-entry shape, but *does* write `route_slot_group = str(rc.get("routeId"))` literally
   (`transforms.py:243`), purely as a label for the Dynamic-Report route-slot UI
   (`useDynamicReportRoutes.js`) — **not currently used to merge/dedup entries.**
5. **Graph→route assignment is already many-to-many today** — `analyze_graph`
   (`section_builders.py:403-579`) computes `info["assigned"]` (which old comp ids a graph shows),
   and `graphs_for_comp` (`convert_report.py:430-433` / `convert_template.py:343-346`) inverts that
   into each comp's own `graphIds`. **One comp already commonly has several `graphIds`, and one graph
   already commonly has several assigned comps** — this is not a new relationship the redesign needs
   to build; collapsing redundant comps just means each *merged* entry's `graphIds` becomes the union
   of its constituents' `graphIds`. Mechanically simple.
6. **The graph-side half of Design Push #2 is already fully implemented and correct** —
   `resolve_measure_pick_window` (`section_builders.py:373-401`) computes each graph's own
   `weekdays`/`start`/`end` from the *agreeing* signature across its assigned comps (gap-logs
   `measure_pick_window_mixed` if they disagree — meaning inconsistent old data is already detected,
   not silently dropped), and `build_graph_section_data` (`section_builders.py:711-745`) writes it
   into `display._measurePick`. This landed 2026-08-06, one day before this finding — **the route
   side is the only piece still doing the old (now-redundant) thing.**

## Conclusion: this is a "add a merge/dedup pass" change, not new plumbing

Every fact needed to detect and merge duplicates — `routeId` (or resolved `tmc_array`), calendar
`startDate`/`endDate` — is already available at exactly the point `build_route_entry`/
`build_slot_entry` run. The shape of the fix:

1. Group the flattened, TMC-resolved, relative-dates-resolved `route_comps` by
   `(routeId, calendar startDate, calendar endDate)` — **not** including `startTime`/`endTime`, per
   the "dates stay route-level, time-of-day doesn't" rule above.
2. Emit **one** `routes[]` entry per group (not one per comp) — pick a representative comp for the
   entry's own `name`/`color`/`route_comp_id` (open question below), union every constituent comp's
   `graphIds` onto the merged entry.
3. Any per-comp `weekdays`/`startTime`/`endTime` that used to vary within a group is **dropped from
   the route entry** — it's already superseded by each graph's own `_measurePick`, so keeping it on
   the (now-merged) route would be meaningless (which comp's weekday mask would even win?).
4. `route_slot_group` should probably be written on **both** conversion paths now (not just
   `--template-id`), even after this merge, since Dynamic-Report route-slot resolution
   (`useDynamicReportRoutes.js`) and any future same-route detection both want it — needs a
   `build_route_entry` change, not just `build_slot_entry`.

## Open design questions — need Ryan's input before implementing

1. **Merged entry's `name`/`color`/`route_comp_id`**: with 6 old comps collapsing to 1 entry, which
   comp's `name` survives? The old peak-period-specific names ("2023 - AM ...") are actively
   misleading once the entry feeds *multiple* graphs with different peak windows — probably wants a
   generic name (e.g. just the underlying corridor/route name, no peak suffix), authored fresh, not
   inherited verbatim from any one comp. Needs a real design decision, not a mechanical pick.
2. **Does this apply to both conversion paths, or just one first?** The evidence above is from a
   `--template-id` conversion; is the same redundant-comp pattern equally present in `--report-id`
   (historical one-off report) conversions? (Likely yes — `build_route_entry` has the identical
   one-comp-one-entry shape — but not independently confirmed against a real `--report-id` example
   yet.)
3. **Retroactive scope**: fix the converter going forward only (new conversions get fewer, cleaner
   routes), or also reconvert the 16 already-existing template pages / sweep the 72 `--report-id`
   pages to clean up existing redundancy? Per `feedback_dont_over_engineer_against_orphaning` and
   the general pattern this session (Design Push #2's own rollout only touched already-affected
   pages, not the whole corpus) — recommend **forward-only** unless Ryan asks for a retroactive
   sweep; the existing 16+72 pages work today (just carry redundant routes), this isn't a
   correctness bug for them.
4. **Frozen/generic graph titles**: once a route no longer carries "AM"/"PM"/etc. in its name, does
   the *graph* need to pick up that distinction in its own title instead (e.g. "Average Speed — AM
   Peak")? This is the same open question already flagged as item 5 in
   `dynamic-report-nongraph-section-binding.md` ("frozen titles") — this redesign makes it more
   pressing (currently the peak-period info is redundant between route name and graph, so losing it
   from the route name loses it entirely unless the graph side picks it up).
5. **Merge-key edge cases**: are there real corpus cases where two comps share `(routeId, startDate,
   endDate)` but have **genuinely different resolved `tmc_array`** (e.g. a routeId whose underlying
   TMC set was edited between two comps' creation)? If so, the merge key needs `tmc_array` equality
   too, not just `routeId`. Not checked against the full 69-round corpus yet — worth a quick sweep
   before implementing, not just trusting `routeId` uniqueness.

## Files likely touched (once a plan is agreed)

- `scripts/npmrds-reports/convert_old_reports_lib/transforms.py` — `build_route_entry`,
  `build_slot_entry` (the merge/dedup pass itself)
- `scripts/npmrds-reports/convert_old_reports_lib/db.py` — possibly `flatten_route_comps` if the
  grouping is cleaner to do at that stage rather than at entry-build time
- `scripts/npmrds-reports/convert_old_reports_lib/section_builders.py` — `analyze_graph`/
  `graphs_for_comp` inversion logic needs to work in terms of the merged entries' `graphIds`, not
  raw per-comp ones (mechanical once the merge key is decided)
- Test corpus: `converter-vocabulary-unit-tests.md` (a sibling open task) would be a natural home for
  locking in the merge behavior once built — the exact "6 comps → 1 route" case above is a
  ready-made test fixture

## Implementation (2026-08-07, same day) — DONE, live-verified

Every open design question above was resolved directly with Ryan before writing code:

1. **Merged entry's name**: generic corridor name, authored fresh — never a peak-labeled comp name.
2. **Both conversion paths**: `build_route_entry` (`--report-id`) and `build_slot_entry`
   (`--template-id`) fixed together, same change.
3. **Retroactive scope**: resolved differently than "reconvert everything" — Ryan asked to delete
   all 68 pre-existing pages under `converted_reports` (every old conversion except the `reports`
   landing page) outright, including the previously "shipped" NY-9D Beacon report — see "Corpus
   cleanup" below. Nothing retroactive to reconvert as a result; only fresh conversions matter going
   forward.
4. **Graph titles**: yes, fix now — once a merged route's own name goes generic, a graph whose title
   template never had a `{name}` slot to begin with must pick up the distinction some other way, or
   it's lost entirely.
5. **Merge-key edge cases**: closed by construction, not a corpus sweep — the merge key includes the
   resolved `tmc_array`, so a routeId whose underlying TMC set genuinely differs between two comps
   naturally lands in different groups. Confirmed in code that this is a no-op safety net in
   practice (resolved TMCs are themselves derived from the same routeId+dates the key already uses).

### Corpus cleanup (before any code change)

Deleted all 68 pre-existing pages under `converted_reports` (kept only the `converted_reports` root
container and the `converted_reports/reports` landing page) via `dms raw delete`, per Ryan's direct
request — the stale reports were "always messing him up." **Follow-up bug found during this
session's own planning**: deleting a page via direct `dms raw delete` bypasses
`delete_converted_page`'s own cleanup of that page's `reports_snap_2` row (a separate table) — left
52 orphaned snap rows (12 catalog + 40 report-id) with `report_id` pointing at now-dead pages.
Cleaned those up too (captured the 12 catalog rows' curated metadata — `name`/`description`/
`tags`/`difficulty`/`page_path` — before deleting them, needed again below).

### Code changes

- **`transforms.py`**: added `route_comp_merge_key(rc, old_route=None, tmc_override=None)` — the
  merge key `(routeId, calendar startDate, calendar endDate, resolved tmc_array)`, deliberately
  excluding `startTime`/`endTime`/`weekdays`/`resolution` (moved to graph-level `_measurePick`).
  Added `group_route_comps(route_comps, key_fn)`, a plain stable-order grouping helper.
  `build_route_entry` now also writes `route_slot_group` (previously only `build_slot_entry` did).
- **`section_builders.py`**: `analyze_graph` now returns `had_name_token` (did the OLD title
  template ever have a `{name}` placeholder, checked before the substitution) and `comp_names` (the
  joined names actually substituted in, filtered so a template's intentionally-blank comp labels
  don't leave `", , "` artifacts).
- **`convert_report.py` / `convert_template.py`**: `route_entries` construction replaced with a
  merge-group loop — one entry per group, `graphIds` unioned across every member, `weekdays` dropped
  when merged (superseded by each fed graph's own `_measurePick`). A graph-title-suffix block
  (mirroring the existing Info-Box bin/year suffix) appends the generic label when
  `not had_name_token and comp_names and any member of this graph's assigned comps was merged`.

### Bug found during live verification #1 — templates leaked specific route names/dates

Ryan caught this live: a *template* (Dynamic Report) slot named `I-490 36055 EB AM Peak`, and a
graph title `Avg. Hours of Delay (2023 - 5 min 2023 - 5 min Inner Loop 2)` — a template's slot can be
filled with **any** viewer-supplied route later, so baking in a specific old route's name is wrong
by construction, not just stale (the duplicate "2023 - 5 min" text was a separate, also-pre-existing
compTitle self-reference quirk in the same old data, exposed rather than caused by this change).
Root cause: `build_slot_entry`/the template naming loop used `route_comp_display_name`, which
renders full route/date text — correct for a `--report-id` conversion (a report about one specific
real route), wrong for a template slot.

**Fix**: added `generic_comp_label(rc, gaps=None)` — blanks compTitle's `{name}` token (the
route-identity portion) while substituting `{year}`/`{month}`/`{date}` with their real values (dates
stay fixed/known on the slot itself, confirmed with Ryan: a viewer supplies `name + tmc_array` only,
never a date). When compTitle has **no** tokens at all (pure literal text like `"I-490 36055 EB AM
Peak"` — no structural signal to separate a reusable label from the route-specific words), returns
`""` and gap-logs `template_comp_title_not_generic` rather than guess. Added
`merged_group_date_label(settings)` for a merged slot's own name — shows only the shared date, not
any one member's peak suffix (which would misrepresent the merged entry as "the AM one"). Fixed
`build_slot_entry`'s own fallback (`rc.get("name") or route_comp_display_name(rc, None)` — the second
half reintroduced the exact leak) to `rc.get("name") or ""`.

### Bug found during live verification #2 — merged routes broke graph data for non-representative comps

Ryan's own repro: `converted_reports/snapshot?routes=<3 real route ids>` showed 7+ blank
graphs/sections. Root cause, traced to `useGraphPublish.js`: its `routesByCompId` lookup was keyed by
each route entry's single `route_comp_id` — 1:1 with old comps before this merge, but a merged entry
only carries its *representative* comp's id. Any graph whose `_measurePick.routeIds` (frozen at
conversion time against the ORIGINAL per-comp ids) referenced one of the OTHER merged-away comps
resolved to nothing.

**Fix**: added `entry["route_comp_ids"]` (the full list of every comp id a group absorbed) to both
`convert_report.py`/`convert_template.py`'s merge loops, and changed `useGraphPublish.js`'s
`routesByCompId` construction to index every id in that list, falling back to the single
`route_comp_id` for any entry without it (every pre-fix entry, and every never-merged entry) — same
result as before, not a behavior change there. Live-verified after the fix: all 6 previously-blank
AVL Graph sections on the repro URL now render real data. (Also live-checked, with a properly long
Playwright settle time after an initial premature/wrong read: TMC Info Box and Route Compare
Component sections on the same page DO render real rows once loaded — not a regression. Route Map's
status wasn't conclusively checked either way — it renders via canvas/tiles, not SVG, so the probe
harness's SVG census can't tell blank from populated for it.)

### Reconversion (3 rounds, mechanically re-running the same 12 templates each time)

Ran `python3 scripts/npmrds-reports/convert_old_reports.py --template-id <id> --title "<catalog
title>" --replace` for all 12 catalog templates (old ids 246/225/221/276/278/291/244/239/207/77/247/228
— titles/mapping in `../completed/reports-page-template-catalog.md`) three times: once for the merge
fix itself, once more for the generic-name fix, once more for the `route_comp_ids` runtime fix. After
each round, re-measured real route/graph counts (`sections_count - 2` = graph count; `routes.length`
from the fresh `reports_snap_2` row) and reapplied the 12 rows' curated catalog metadata (captured
before deletion, above) via `dms raw update --data`. Route counts dropped where the corpus had real
peak/weekday/resolution redundancy (Snapshot 11→4, Monthly Speed Comparisons 7→2, This Month vs...
8→4) and stayed unchanged where it didn't (One Week Study, Bi-directional, Weekly Average) — graph
counts never changed (confirmed identical across all three rounds), matching the design: the merge
only touches `routes[]`, never the graph-analysis pipeline.

**Mid-session cleanup**: an interrupted batched shell command left template 225's old page
(`weekly_average`) orphaned (its snap row was deleted before the process was killed, but not the
page/sections) and a stray `weekly_average_0` duplicate from the next clean run avoiding the
collision. Deleted both, re-ran cleanly onto the canonical slug.

### Live verification (final)

- `converted_reports/reports` (the catalog): `report_probe.mjs` — 0 console/page errors, all 12
  cards render with the correct, re-measured `counts_label`.
- `converted_reports/snapshot?routes=2195805|||2195804|||2195803` (Ryan's own repro URL): all AVL
  Graph sections render real data; Route Compare Component and both TMC Info Box sections render real
  rows given proper load time; exactly 14 live pages under `converted_reports` (root + landing + 12),
  confirmed via `dms raw list`.

### Follow-up logged elsewhere, not implemented this session

Ryan's "todo, ideally": once a Dynamic Report viewer actually fills a route slot, the RUNTIME should
use the viewer-supplied route's own name (plus the slot's known date) as the comparisonSeries
`__series` label and section titles — the live analogue of what this task's converter-time fix does
for templates before any route is picked. This is DMS-library runtime work (`useGraphPublish.js`'s
`transformReportRoutes`, or wherever a section's title renders at runtime), not converter work —
logged as **Round 4** in
`src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md`, which already tracked
the same "frozen titles" gap as an undecided open item (item 5) before this session gave it a
concrete resolution direction.

### Files touched

- `scripts/npmrds-reports/convert_old_reports_lib/transforms.py` — `route_comp_merge_key`,
  `group_route_comps`, `generic_comp_label`, `merged_group_date_label`, `route_slot_group` added to
  `build_route_entry`, `build_slot_entry`'s naming fallback fixed
- `scripts/npmrds-reports/convert_old_reports_lib/section_builders.py` — `analyze_graph` returns
  `had_name_token`/`comp_names`
- `scripts/npmrds-reports/convert_old_reports_lib/convert_report.py` — merge-group loop,
  `route_comp_ids`, graph-title-suffix block
- `scripts/npmrds-reports/convert_old_reports_lib/convert_template.py` — same, plus
  `generic_comp_label`/`merged_group_date_label` for the slot-naming path
- `src/themes/transportny/components/ReportRouteList/useGraphPublish.js` — `routesByCompId` now
  expands across `route_comp_ids`, not just `route_comp_id`

## Explicitly not started

Nothing — this task is fully implemented and live-verified as of 2026-08-07. The only remaining
piece (runtime-derived seriesLabel/title from a viewer's picked route) is intentionally out of scope
here and tracked separately (see "Follow-up logged elsewhere" above).
