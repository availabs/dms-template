# Reports page — § 01 template catalog

**Project:** TransportNY · **Topic:** themes · **Status:** DONE, live-verified · **Started/finished:** 2026-08-06 · follow-up bugs split into separate task files, see below.

## Follow-up, same day: more staleness found post-hotfix, split into separate task files (2026-08-06)

Ryan spot-checked the live catalog and found several more things wrong, on top of the hotfix below.
Triaged and root-caused; work items split out into their own task files (this doc stays about the
catalog build itself, which is DONE) per Ryan's request to keep each fix/phase in its own document:

- **[`./catalog-page-slug-naming-fix.md`](./catalog-page-slug-naming-fix.md)** —
  the "Snapshot" card links to `/converted_reports/rochester_inner_loop_0` (and vice versa); page
  slugs are generated from the OLD system's internal template name, not the catalog's curated
  title. Slug fix DONE 2026-08-07; moved to `tasks/completed/` 2026-08-18 (the one item it left
  open, header `purpose`/`metaLine` placeholder text, was folded into
  `dynamic-reports-and-route-tags.md`'s "Open questions for triage" section).
- **[Dynamic-Report non-graph section binding](../../../../src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md)** —
  the keystone finding: Map/Route Compare Component/TMC Info Box sections don't reliably fill from
  Dynamic-Report route picks the way AVL Graph sections do (live-reproduced by picking routes
  through the Add Routes modal and watching which sections actually rendered). Filed as a DMS
  library task since the root causes are in shared library code, not converter-specific.
- **[`report_probe.mjs --expect` + golden corpus](../current/report-probe-expect-and-golden-corpus.md)**
  and **[converter vocabulary unit tests](../current/converter-vocabulary-unit-tests.md)** — the
  broader testing-structure ask that came out of this same conversation (the converter/vocabulary
  tooling is large and load-bearing, and regressions in it get caught by hand, repeatedly — see
  those files for the full reasoning).
- Two findings from the same triage did NOT need their own task: relative-dates handling was
  checked and found solid (no action needed — see the binding-gap task file for the pointer), and
  junk placeholder route-name content (e.g. one route literally named "Long Long Long Long Long
  Name Here") is data debt from the old system, not a code bug — noted, not scheduled.

## Hotfix, same day: converted templates were broken by Design Push #2

Ryan caught this live, right after the catalog shipped: the 12 templates' own pages had (1) a
stale white/blank rail-width gap in view mode, and (2) — the serious one — **adding routes via
the Dynamic Report entry-gate modal never updated any graph.**

**Root cause, both:** `scripts/npmrds-reports/convert_old_reports_lib/` (the Python converter
used by `--template-id`/`--report-id`) was never updated for two page-model changes that shipped
earlier the same day (see `npmrds-design-v2-implementation.md`'s "Design push #2" and the flush-rail
work above it):
1. `sidebarHideInView` (the flag that collapses the 340px rail in view mode once RRL renders
   nothing) was added to the **Report Page template** (`2187021`) but never copied onto pages the
   converter creates — every converted page inherited `sidebar` from the template but not this flag.
2. Design Push #2 moved route↔graph binding from the route's own `graphIds` to the graph's own
   `display._measurePick.routeIds` — but `build_graph_section_data` (the function that clones a
   graph template's state onto a new page) was never updated to set it. Every converted graph came
   out with `_measurePick` entirely absent, so `useGraphPublish.js`'s publish effect always resolved
   **zero** routes for it — regardless of what a viewer picked in the modal. Confirmed by tracing
   `useGraphPublish.js`'s `findSelfBoundGraphs`/`transformReportRoutes` directly, then reproducing
   live in a real browser (clicked through the Add-Routes modal on `converted_reports/snapshot`,
   confirmed both graphs went from blank to real rendered data with the fix, blank without it).

Ryan's own framing, worth keeping as a standing practice: he'd explicitly asked, right after the
flush-rail/`ReportPageHeader` work landed, "does the converter also need updating so every new
report going forward gets this" (see this doc's own `npmrds-design-v2-implementation.md`
cross-reference, the `templateRole:"framework"` fix) — that question was answered for THAT change,
but Design Push #2 shipped later the same day and never got the same check. **Whenever a report/graph
data-shape or model change ships, explicitly check whether `convert_old_reports_lib/` needs the
matching update — don't let a later change in the same session skip the check a similar earlier
change got.**

**Fixed:**
- `convert_template.py`/`convert_report.py`: copy `sidebarHideInView` from the page template (same
  line as the existing `sidebar` copy).
- `section_builders.py`'s `build_graph_section_data`: when the cloned graph template already wires
  the `$self` comparison_series subscriber, set `display._measurePick = {weekdays:{}, start:'',
  end:'', routeIds: info["assigned"]}` — `info["assigned"]` is already the exact route_comp_id list
  (the inverse of the old per-route `graphIds`), no new computation needed.

**Rolled out:** re-ran `--replace` for all 12 catalog templates against the fixed converter (slugs —
and therefore the catalog's `page_path` values — stayed identical, no relink needed; graph/route
counts stayed identical too, confirmed by re-counting sections before publishing this doc). Catalog
metadata (name/description/tags/difficulty/counts_label/graph_count/page_path) re-applied to the 12
fresh `reports_snap_2` rows the replace created (the old ones were deleted along with the old pages).
**Page ids changed** — the ones cited in the "Done" section below are now stale; current ids are in
`reports_snap_2` via the `_converted_from_old_template_id` marker, not worth re-copying into this doc.

**Verified live, interactively, in a real browser** (not just data-level): loaded
`converted_reports/snapshot`, the entry-gate "Add Routes" modal correctly appeared (2 route slots
after grouping), picked 2 real routes, clicked "Add 2 Routes" — both graphs rendered real data
immediately. URL param format for direct testing is `?routes=<id>|||<id>` (pipe-delimited), not
comma-separated — the modal's own `?routes=` builder uses `|||`, confirmed by reading the resulting
URL after clicking through.

**The other 4 non-catalog templates — DONE too, 2026-08-06 (Ryan asked right after the above).**
Old ids `90`/`204`/`238`/`265` (`covid_comparison`/`bottleneck_examples`/
`change_over_time_analysis_month_v1`/`weekly_averages`) had the identical bug — converted after
Design Push #2 shipped, by the same not-yet-fixed converter. Re-ran `--replace` for all 4 against the
fixed converter; slugs stayed identical (no other references to update — these aren't part of the
catalog, no `reports_snap_2` metadata to re-apply). Verified directly against the DB:
`sidebarHideInView: true` on all 4 pages, `_measurePick` set on every self-bound graph/map section
(6/6, 4/4, 21/21, 20/20 across the 4 pages) — not re-verified interactively in the browser (the
catalog's own `converted_reports/snapshot` click-through already proved the mechanism; these 4 are
the same code path, same fix, just different content).

Any `--report-id` (regular, non-template) report converted between Design Push #2 landing and this
fix would have the same bug — none identified as having been converted in that window, and none
were searched for/fixed here (would need a corpus-wide sweep, not attempted).

## Done — live-verified 2026-08-06

Built and shipped. **Moved 2026-08-06, later same day** (Ryan: "stay out of prod") from `/reports`
to **`/converted_reports/reports`** — `url_slug` + `parent` set to `2188366` ("Converted Reports"),
matching every other converted page's convention. **Verify URL:**
`http://npmrds.localhost:5173/converted_reports/reports` (public, no auth needed) — also
`/edit/converted_reports/reports` for the authoring view. Page id `2208581`, section group UUID
`b77dbc82-4485-4e9a-8046-cc3a7eedf5b4`. The old `/reports` URL no longer matches any page (confirmed
— no page has that slug anymore); it now silently falls through to an unrelated pre-existing MAP-21
PM3 page, a known platform quirk (slug fallback when nothing matches exactly, not something this
move caused) documented in `traversing-dms-pages.md`'s gotcha list. All 12 templates render,
correctly grouped into the 5 categories (1/2/1/4/4 cards), each showing name/description/difficulty/
route+graph counts and a real working link to its converted report page. Verified both the
authenticated draft/edit view and the plain public view via `report_probe.mjs` (0 console/page
errors both times) — screenshots match.

**What shipped:**
- `reports_snap_2` extended with `tags`/`graph_count`/`page_path`/`difficulty`/`counts_label` columns
  (source `2177438`) — no new dataset, per Ryan's steer. `tags` is `multiselect`, filtered via the
  existing `array_contains` UDA op (same mechanism as Route Tags) — confirmed live via real UDA
  `filterGroups` traffic returning the correct per-category counts.
- All 12 mockup templates converted for real (9 new: 276/291/239/207/77/246/247/228/225; 3 already
  existed: 221/244/278) via `convert_old_reports.py --template-id`. Metadata (name/description/
  category+difficulty tags/graph_count/page_path) populated on each row from real measured data
  (published-section counts by element-type, not the mockup's illustrative numbers — see table below).
- New page `reports` (slug `/reports`), one `content`-style section group, 11 sections: 1 intro
  heading + 5×(category head + Card). Each Card's `externalSource` = `reports_snap_2`, statically
  filtered on `tags` (`{col:'tags', op:'filter', value:['category:<x>']}` — no `usePageFilters`/
  `searchParamKey`, so it's fixed, not URL-bound), no join needed (name/description/difficulty/counts/
  link-target all live redundantly on the same row, deliberately — avoids a cross-source join for a
  simple catalog listing).

**Deliberate simplifications (flagged, not gaps to silently reopen):**
- **Whole-card click-through**: the mockup wraps the entire card in one `<a>`; Card's `isLink` is a
  per-cell mechanism, not a per-card one. Shipped as a `page_path` text cell styled as "View template
  →" instead — real, working, Card-native, just not whole-card. A `cardHints`-level "make this whole
  card a link via column X" flag would be the from-scratch fix (a generalizable enrichment, not a
  one-off), not attempted this pass.
- **No preview-plate/thumbnail** — explicitly out of scope per Ryan.
- **`graph_count`/`counts_label` are static, authored at curation time**, not a live query against
  each page's actual section count — will drift if a template's graphs change later. Same trade-off
  already accepted elsewhere in this arc (`ReportPageHeader`'s freshness footline).
- **Header/search/"Your reports"/"Worked examples"/Routes-CTA bands** — untouched, explicitly out of
  scope per Ryan ("only focus on section 1").
- Difficulty/category encoded BOTH in `tags` (`category:x`/`difficulty:y`, for filtering) AND
  redundantly in the plain `difficulty` field (for simple display, no formatFn needed) — accepted
  duplication, same reasoning as storing `counts_label` pre-formatted rather than building a
  `combine`-formatFn chain across `routes`/`graph_count`.

**Real bugs hit and fixed during the build, worth remembering:**
1. **`dms raw update` positional-args form is update-only-by-id, NOT `<app> <type> <id>`.** Unlike
   `raw delete` (which genuinely takes `app type id`), `raw update` takes a single `<id>` positional —
   app resolves from env/`.dmsrc`, and a split (`:data`-suffixed) row's type must go through
   `--row-type`, not a positional arg. Calling it with 3 positionals (by false analogy with `delete`)
   silently no-ops: the CLI still prints a "success" response echoing back the intended data, but the
   real `id` argument resolves to `NaN`/`null` (visible in the response's own `"id":null` — the tell),
   so the `WHERE id = $3` matches nothing server-side. Cost ~15 min chasing a "why didn't my schema
   change stick" mystery before catching the `"id":null` giveaway. `creating-pages-from-a-design-
   pattern.md`'s own §4.2 code snippet uses this wrong form too (pre-dates `--row-type` existing) —
   worth fixing in that skill file if revisited.
2. **`raw update <id> --data` DOES work correctly on split rows once given the real `<id>` and
   `--row-type`** — confirmed via direct DB read-back (not just trusting the CLI's echo) on every one
   of the ~35 writes this task made. Supersedes the older `reference_dms_section_create_cli_gaps`
   memory's blanket "raw update silently no-ops on split rows, don't fight it" advice — that was true
   only for the missing-`--row-type` case; `--row-type` has since been added to the CLI and fixes it
   cleanly.
3. **Lexical `element-data` needs the FULL leaf-node shape or it silently renders nothing** — a
   heading node's text child needs `{type:"text", version:1, detail:0, format:0, mode:"normal",
   style:"", text:"..."}`, not just `{type:"text", text:"..."}`. Missing fields didn't error, they just
   made 6 lexical sections (the intro + all 5 group heads) invisible — caught by comparing the
   screenshot against what should have rendered, not by any console/page error (there were none).
4. **A Card `isLink` cell with no `location` set uses the cell's OWN rendered value as the href** —
   confirmed by reading `Card.jsx`'s `url = location || valueFormattedForDisplay`. But that value is
   resolved as a *relative* link by the router, so a bare `converted_reports/foo` path resolves
   relative to whatever page you're currently on (`/edit/reports/converted_reports/foo` — broken,
   nested). Fixed by storing `page_path` as an absolute path (leading `/`) on all 12 rows.
5. **Section rows must never carry a real `title`** — confirmed against
   `creating-pages-from-a-design-pattern.md`'s explicit "Owner rule, no exceptions" (renders as a
   hardcoded unthemed band via `ViewSectionHeader`). All 11 sections here use `title:""`, with real
   heading text living in lexical content or Card cells instead.
6. **A fresh page has no `draft_section_groups` at all** — sections created without a matching `group`
   UUID land in `draft_sections` but have nowhere to render. Fixed via `dms page update --data
   '{"draft_section_groups":[...]}'` (never `--set`, which corrupted the array into a bare number on
   the first attempt) with a real UUID `name`, matching that same UUID on every section's own `group`.

**Stale as of 2026-08-07 — route-slot counts below predate the converter's route-comp merge/dedup
pass.** `../completed/converter-route-comp-redesign.md` collapsed old comps that shared a routeId +
calendar date range (differing only in peak/weekday/resolution, now expressed per-graph) into one
route entry — Snapshot's route-slot count dropped 11→4, Monthly Speed Comparisons 7→2, This Month
vs... 8→4, etc. `graph_count` is unaffected (the merge only touches `routes[]`). Left the table below
as originally written per this repo's "don't rewrite history you didn't write" convention — treat
its **route slots** column as historical, not current; re-measure from the live page/`reports_snap_2`
row if you need today's number.

**Real measured counts vs. the mockup's illustrative ones** (used the former — real page section
counts, not the mockup's numbers off the old template's raw, pre-conversion `graph_comps`):

| Template | route slots | graph_count (real) | mockup said |
|---|---|---|---|
| Single Route (221) | 6 | 10 | "1 · 11" |
| One Week Study (276) | 8 | 7 | "1 · 8" |
| Annual Average Study (278) | 10 | 9 | "1 · 9" |
| Single Day Advanced (291) | 8 | 6 | "1 · 7" |
| Year Over Year (244) | 11 | 21 | "1 · 21" |
| This Month vs... (239) | 8 | 23 | "1 · 27" |
| Monthly Congestion (207) | 15 | 13 | "1 · 16" |
| Monthly Speed Comparisons (77) | 7 | 10 | "1 · 13" |
| Snapshot (246) | 11 | 14 | "3 · 17" |
| Seasonality (247) | 10 | 18 | "1 · 22" |
| Bi-directional (228) | 16 | 19 | "2 · 23" |
| Weekly Average (225) | 3 | 2 | "2 · 3" |

Gaps between real and mockup counts are the templates' own conversion gaps (a handful of graphs each
that don't map to a built new-side shape yet — same class of gap already tracked for the rest of the
corpus, not new).

---

## Original plan (superseded by "Done" above, kept for the record)

## Objective

Build the real, working **§ 01 "Templates"** band from `npmrds-reports.html` (the design mockup at
`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports.html`,
lines ~224-514) — a 12-card, 5-category catalog of report templates, data-driven off a real dataset.
This is a narrower re-scope of the "report library" work that `npmrds-design-v2-implementation.md`
had marked blocked/Ryan's-eventually — Ryan asked to proceed now, **section 1 only**.

**Explicitly out of scope this pass (Ryan, 2026-08-06):** header/search bar polish (fine if fast,
not worth chasing — especially the search dialog, "very TBD"); the per-card preview-plate/thumbnail
image; "Your reports"/"Worked examples"/"Routes" CTA bands elsewhere on the mockup page.

## Key decision: extend `reports_snap_2`, no new dataset

Ryan's steer, 2026-08-06: rather than a new "Report Templates" catalog dataset, extend the existing
`reports_snap_2` dataset (source `2177438` / view `2177440`, app `npmrdsv5`) — it already has **one
row per converted report/template page**, keyed by `report_id` = the page's own id. Verified safe
by tracing the actual write path end-to-end (not inferred):

- `ReportRouteList/useReportRow.js`'s `persistRoutes` only ever sends a partial payload
  (`{report_id, routes}` [+`id` on update]) through `apiUpdate`.
- `dmsDataEditor` (`src/dms/packages/dms/src/api/index.js:548`) routes an existing-id update to
  `falcor.call(["dms","data","edit"], [app, id, row, type])`.
- Server: `dms.data.edit` → `controller.setDataById` (`dms-server/src/routes/dms/dms.controller.js:786`)
  → `UPDATE ... SET data = COALESCE(data,'{}') || $1` (Postgres jsonb `||`, a **shallow top-level
  merge** — see `jsonMerge()` in `db/query-utils.js:163`).
- So any top-level key already on the row that isn't `report_id`/`routes`/`id` is **never touched**
  by RRL's own writes. Confirmed live: template 244's snap row (id `2199176`) still carries its
  `_converted_from_old_template_id: "244"` marker despite many repeated route edits during Design
  Push #2 verification.
- All 12 catalog rows already have (or will have, once converted) a real `reports_snap_2` row via
  the template-conversion pipeline, so every write in this task is a merge-safe UPDATE, never a
  fresh `create` — no risk of a full-row insert dropping sibling fields.

**New columns on the `reports_snap_2` source (`2177438`) `data.config.attributes[]`** — same
mechanism as the Route Tags column add (`dynamic-reports-and-route-tags.md` item 2, step 1): fetch
the source row, `JSON.parse(data.config)`, append attribute defs, `JSON.stringify` back, full
`data` replace via `dms raw update` (never a dotted `--set` on this key — JSON-string footgun):

- `name` (text) — catalog display title (may differ from the live page's own `item.title`; the old
  FocusAnalysis config names already diverge from the real `admin2.templates` row names in several
  cases, so an independently-curated catalog title is expected, not a bug).
- `description` (text) — catalog blurb (stored old-template copy, per the mockup's own "REAL
  CONTENT" notes).
- `tags` (multiselect, `options: null`, free-form-capable) — seeded values follow the Route Tags
  `prefix:value` convention: `category:before_after` / `category:floating_car` / `category:events` /
  `category:change_over_time` / `category:behavioral` (mirrors the 5 old-landing-page categories,
  confirmed by Ryan to match) + `difficulty:beginner` / `difficulty:intermediate` / `difficulty:advanced`.
- `graph_count` (number) — authored/static at curation time (not live-synced against the page's
  actual section count; flagged drift risk, acceptable for a catalog display, not a live figure).
- `page_path` (text) — the relative URL to the real page (e.g. `converted_reports/<slug>`), so the
  catalog Card needs no id→slug join.

`route_count` is NOT a new column — derive it client-side from `routes.length` on the existing
`routes` field (already present on every row).

## The 12 templates — old `admin2.templates` id, category, conversion status

Cross-referenced against the live DB via the `_converted_from_old_template_id` marker
(`SELECT ... FROM data_items__s2177438_v2177440_reports_snap_2 WHERE data->>'_converted_from_old_template_id' IS NOT NULL`).

| # | Config title (mockup) | Old id | Real `admin2.templates` name | Category | Difficulty | Status |
|---|---|---|---|---|---|---|
| 1 | Single Route | 221 | — | before_after | beginner | ✅ converted → page `2207950` |
| 2 | One Week Study | 276 | Floating Car - Week | floating_car | — | dry-run clean, not built |
| 3 | Annual Average Study | 278 | — | floating_car | — | ✅ converted → page `2208008` |
| 4 | Single Day (Advanced) | 291 | Incident Analysis | events | advanced | dry-run clean, not built |
| 5 | Year Over Year | 244 | Year Over Year (Beginner) | change_over_time | beginner | ✅ converted → page `2199131` |
| 6 | This Month vs. Last Month vs. Last Year | 239 | This Month vs. Last Month vs. Last Year (Advanced) | change_over_time | advanced | dry-run clean, not built |
| 7 | Monthly Congestion | 207 | Monthly Congestion (Beginner) | change_over_time | beginner | dry-run clean, not built |
| 8 | Monthly Speed Comparisons | 77 | Single Route Default | change_over_time | — | dry-run clean, not built |
| 9 | Snapshot | 246 | Rochester Inner Loop | behavioral | — | dry-run clean, not built |
| 10 | Seasonality | 247 | Seasonality Report (Intermediate) | behavioral | intermediate | dry-run clean, not built |
| 11 | Bi-directional | 228 | Bi-Directional Route Analysis (Intermediate)-V2 | behavioral | intermediate | dry-run clean, not built |
| 12 | Weekly Average | 225 | Snapshot | behavioral | — | dry-run clean, not built |

Note the catalogue-debt name collisions are real and already documented by the mockup itself: config
"Snapshot" (#9) is old row 246 "Rochester Inner Loop"; config "Weekly Average" (#12) is old row 225
whose real name is literally "Snapshot". Use the **config titles** (column 2) as the catalog `name`,
not the raw old-DB name — matches the mockup's own documented choice.

All 9 not-yet-converted templates dry-ran clean 2026-08-06 (each drops a handful of ungapped
graphs — same partial-conversion norm already accepted elsewhere in this corpus, not a blocker).

## No live "Reports" landing page exists yet

Checked (`data->>'url_slug'` sweep on `npmrds_sub|page`): only `converted_reports` (id `2188366`,
a plain parent container, not a catalog UI) and unrelated demo pages. Need to create a new page
(slug TBD, likely `reports`, matching the mockup's nav position) to hold § 01.

## Plan

1. [ ] Extend `reports_snap_2` source (`2177438`) with the 5 new column defs above. Verify via
   `dms raw get 2177438` that `config.attributes` grew by 5, nothing else changed.
2. [ ] Convert the 9 remaining templates for real (`convert_old_reports.py --template-id <id>`,
   no `--dry-run`). Verify each via the marker query + a quick page-load check.
3. [ ] Populate `name`/`description`/`tags`/`graph_count`/`page_path` on all 12 `reports_snap_2`
   rows (the 3 pre-existing + 9 new) via `dms raw update --data` (full-row-preserving merge of new
   keys only — never touch `routes`/`report_id`/the conversion marker).
4. [ ] Create the new Reports landing page + build § 01: 5 lexical group-head sections + 5 Cards
   (one per category), each Card's `externalSource` = `reports_snap_2`, filtered via `array_contains`
   on `tags`, `cardsGridSize` for the per-group grid. No preview-plate column. Cell mapping:
   `name` → title text, `description` → body text (line-clamp), `tags` → parse out `difficulty:*`
   for a small pill/chip, `routes.length` + `graph_count` → a combined counts footer (may need a
   small combining `formatFn`, per `src/themes/CLAUDE.md`'s enrichment guidance — not a custom
   component), `page_path` → the card's link-through.
5. [ ] Live-verify: all 12 cards render with real data, grouped correctly, each links to its real
   working page.

## Files likely touched

- DB only for steps 1-3 (via `dms` CLI / `dms raw update`) — no repo file changes.
- Step 4: a new page (DB row) + however many Card sections the design needs; possibly a small
  `formatFn` addition in DMS core if the counts-combining cell needs one (`src/dms/packages/dms/src/...`,
  per `src/themes/CLAUDE.md`'s enrichment pattern) — TBD once building.
