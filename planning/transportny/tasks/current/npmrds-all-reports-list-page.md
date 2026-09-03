# NPMRDS "All Reports" list page

**Project:** TransportNY · **Topic:** themes · **Status:** SCOPED, not started · **Started:** 2026-09-03

## Objective

Build the live page for `npmrds-reports-list.html` (Alex's design, dated 2026-09-02) — a paginated,
filterable table of every report in the catalog, at URL `/npmrds/reports/list`. It's the second half
of the "report library" work item tracked in
[`npmrds-design-v2-implementation.md`](./npmrds-design-v2-implementation.md) § 2; the first half (the
Templates shelf, `npmrds-reports.html`) already shipped 2026-09-02 at `/npmrds/reports` (page
2188366) via `build_npmrds_reports.mjs`. That builder's view-toggle "All reports" cell is currently
**inert** (no href), specifically waiting on this page to exist.

## Design source

`src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/npmrds-reports-list.html`
(2026-09-02). Its own header comment is an unusually complete self-review — it explicitly states
what it ports verbatim from `ReportPickerModal.jsx` (the modal this page un-modals), what's genuinely
new (server-side pagination), and a 5-item findings table of real gaps it measured against the live
26-row dev catalog. This task file does not repeat that comment; read it directly before implementing.

## Current state (verified live, 2026-09-03)

- `npmrds_sub` pattern's `base_url` is `/npmrds`. Page 2188366 (title "Reports") has `url_slug:
  "reports"`, `parent: null`; all ~62 existing report pages are its children at `reports/<name>` →
  `/npmrds/reports/<name>`. **No page anywhere uses `list` or `all_reports` today** — confirmed via
  `dms page list --pattern npmrds_sub --limit 1000` (65 total pages).
- The catalog is `reports_snap_2`, source 2177438 / view 2177440 (`env: npmrdsv5+reports_snap_2`) —
  the same source the Templates shelf's five Cards and `ReportPickerModal` both already bind to. No
  new dataset or column needed.
- `ReportPickerModal.jsx` (+ `useReportSearch.js`/`fetchCatalogRows.js`, `reportScore.js`,
  `reportCatalogSource.js` in the same directory) already implements everything this page needs
  *except* pagination: search (OR-of-`like` on name/description), a single active tag filter (from
  `PickerModal/pickerScoring.js`'s `buildVisibilityAllowListFilterGroup` +
  `RouteTagBrowserModal/tagCategories.js`'s fixed vocab), "Mine"/"Hide incomplete"/visibility-bypass
  facets, and the `reportScore.js` prominence sort. **`fetchCatalogRows.js` hardcodes `fromIndex: 0,
  toIndex: limit-1`** — real paging needs this to become page-relative, which is a small, low-risk
  fix: the underlying `uda` Falcor action this hook calls already accepts arbitrary
  `fromIndex`/`toIndex` (confirmed — native Card pagination, e.g. `card-layout.md`'s
  `usePagination:true` example, already exercises the same action with real offsets today).

## Two real bugs the mockup's own findings table surfaced — fix as part of this task

Both are additive, backward-compatible, and needed for this page to be honest (not just cosmetic to
the mockup):

1. **`tagCategories.js`'s `tagToLabel` always renders every `user:<id>` tag as "You"** — it never
   compares the id to the viewer. Fine in the modal (which only ever surfaced *your own* rows near
   the top); wrong on a page listing everyone's reports, where `user:993`'s rows would read "You" to
   a viewer who is actually `175`. Fix: pass the viewer id in and compare.
2. **`TAG_CATEGORIES` only declares `county`/`region`/`agency`** — but measured over the real 26-row
   catalog, the two axes with actual report data are `category:` (12 rows, 5 distinct values) and
   `difficulty:` (8 rows, 3 distinct values); `county:`/`region:` have zero rows. Add two more
   `TAG_CATEGORIES` entries (`category`, `difficulty`) with their real value sets, so the rail's
   "Browse by tag" can actually browse the axes the data uses. This also fixes the live modal's own
   tag chips, which currently render these as raw storage strings (`"category:change_over_time"`).

Not fixing as part of this task (flagged, deferred): the `dynamic_report_template` curated-marker
backfill (finding 4 — with the default visibility allow-list on, 16 of 26 rows, all the dynamic
report templates, are invisible because the marker was never written). This page ships "Show
everyone's" **defaulted ON** (opposite of the modal's default), same as the mockup, specifically to
route around this — see Decisions below.

## Architecture decision — mostly native primitives, revised 2026-09-03

**Correction of this task file's own earlier draft.** The first pass here assumed no native DMS
primitive could resolve "the current viewer's id" inside an authored filter, and recommended a single
custom component for the whole rail+table+pagination surface on that basis. Ryan pointed at a real,
confirmed mechanism that changes this materially.

**Confirmed: `pageState.filters` always carries a live `user_id` entry.**
`src/dms/packages/dms/src/patterns/page/siteConfig.jsx:177` unconditionally appends
`{id:'user_id_default_filter', searchKey:'user_id', values: user?.id}` to `patternFilters` for every
page, in every pattern, on every load. `mergeFilters` in
`src/dms/packages/dms/src/patterns/page/pages/_utils/index.js:444-454` — "patternFilters should take
over if present" — matches by `searchKey` and gives this entry priority over anything the page itself
authors under the same key. `getPageVariableRegistry(item, patternFilters)` (same file, used by both
`view.jsx:30` and `edit/index.jsx:24`) is what builds `pageState.filters` from that merge. Net effect:
**any Filter/Card leaf bound to `searchParamKey:'user_id'` resolves to the current logged-in user's
id automatically** — the same mechanism `ChooseReportButton` already uses for `search`, just for a
different, always-populated key. This is what Ryan's screenshot shows: adding a page filter named
`user_id` in the page's own `/edit` filter panel and seeing it auto-populate with his own id.

**What this changes:** "Mine" (`created_by` = viewer id) is natively expressible as an authored Card
filter leaf bound to `searchParamKey:'user_id'` — no custom JS needed to know who's logged in. Same
for the results table's base data fetch generally: search (`like` OR-group on name/description) and
the single active tag filter (`tags` `filter`/array-contains on one value at a time) are both
already-proven native Filter/Card leaf patterns (see `build_npmrds_reports.mjs`'s own tag-filtered
Cards and `full-text-search-filter.md`). **Pagination is native and proven** (`card-layout.md`'s
`usePagination:true` example). So the results table itself — search + Mine + single-tag filter +
pagination — now looks buildable as an ordinary paginated Card, no custom component required for that
part.

**What's still open / still likely needs a small custom piece:**

1. **The visibility allow-list's group check has no equivalent native mechanism.** Only `user_id` is
   injected this way — grepped `siteConfig.jsx` and the auth utils for a `groups`-equivalent default
   filter and found none. `buildVisibilityAllowListFilterGroup`'s `agency:<group>` OR-branch (does the
   viewer belong to a group any row is tagged with) has no native "current viewer's groups" filter
   token to bind to. Two ways through: (a) simplify the allow-list to `created_by=user_id OR tags
   contains dynamic_report_template` (drop the groups branch) — a real behavior change from the modal,
   needs Ryan's sign-off, not a unilateral call; (b) keep exact parity via one small custom
   component/leaf that reads `CMSContext.user.groups` and injects the extra OR-clauses, same as the
   modal does today, scoped to *only* this one facet rather than the whole page.
2. **The "Browse by tag" category/value accordion is UI state, not a data filter**, regardless of the
   user_id finding — clicking "Agency" then "NYSDOT" is an interaction that resolves to one written
   value (a single tag filter), not something a native Filter control renders on its own. This still
   wants a small dedicated rail component whose only job is: render the category pills + value
   panel + "Other tags" free text, and write the resolved single tag value into a URL-bound page
   filter that the results Card's own authored `tags` leaf reads.
3. **Whether a native Card's sort/order can bind to a page filter is UNCONFIRMED, not verified false.**
   A quick grep for `orderBy`/`sort` binding inside the Card's own component/config turned up nothing,
   which is consistent with the already-documented "author-fixed sort only" limitation elsewhere in
   this codebase — but given the `user_id` mechanism was also missed by a search before Ryan pointed
   at it directly, **verify this hands-on early in Phase 2** (try wiring a Card's sort to a page
   filter) before assuming the real, viewer-changeable sort control (see below) requires bypassing a
   native Card for the whole table. If native sort-binding turns out not to exist, the table may need
   to render as a custom component after all (or the sort control could reorder a client-side page of
   already-fetched rows only, which changes the pagination math — worth avoiding if native binding
   works).

**Recommended shape, pending #3 above:** results table as a native paginated Card (search + Mine +
single-tag filter as authored leaves bound to `search`/`user_id`/a new URL-bound tag key); one small
custom rail component for the tag-browse accordion + hide-incomplete + show-everyone's toggles +
(if #1 goes with option (b)) the groups-aware half of the visibility check; sort wired natively if #3
resolves yes, otherwise reconsider. This is a materially smaller custom-code surface than the
original draft's "one component owns everything."

What already stays a native primitive either way, unchanged: the page's **header row** (title ·
view-toggle Card · search input · `CreateReportButton` · New-route Card link) is the same
five-section shape `build_npmrds_reports.mjs` already builds for the Templates page, just with the
toggle's active side flipped. The search *input* in the header should reuse whatever internal
`PickerSearchInput` subcomponent `ReportPickerModal` already has (the mockup calls this out as
"verbatim placeholder") so the two pages' search boxes stay pixel- and behavior-identical for free.

## Known, already-established gaps — ship around them, don't try to solve them here

- **Viewer-changeable sort is NOT a gap — correction, 2026-09-03.** Both `ReportPickerModal.jsx` and
  `RouteTagBrowserModal.jsx` shipped a real, viewer-changeable sort control *today* (`sortMode` state,
  `SORT_MODE_OPTIONS`/`sortRows` from `PickerModal/pickerScoring.js`, executed client-side over
  fetched rows). The "no viewer-changeable sort" limitation this task file previously cited is a
  *different*, still-real gap that's specific to **native Card-based table sort** (an author-fixed
  column property, no runtime control) — it applies to the Templates shelf page's Card sections, not
  to a custom component like this one or the two modals. Since this page is a custom component (see
  Architecture decision), it gets a real sort control for free: reuse `SORT_MODE_OPTIONS`/`sortRows`/
  `reportScore.js` verbatim, the same as both modals now do. The mockup's `<select id="sort">` stays
  in scope, wired for real.
- **No library-wide tag histogram.** Confirmed: the UDA query engine has no groupBy-unnest path for a
  multiselect column (`tagCategories.js`'s own header comment), so a true "every tag + its count"
  histogram over arbitrary/free-text tags isn't buildable. Recommend dropping the mockup's "Tags in
  this library" free histogram entirely rather than faking it — the "Browse by tag" rail's three (now
  five, after the fix above) fixed categories don't need it; showing the vocabulary without counts,
  or lazily fetching per-value counts only for the currently-expanded category (via the same
  `udaLength`-style single-count request `useReportCatalogCount.js` already uses, bounded to that
  category's ~3-62 values), is enough.

## URL / page tree

New page as a **child of page 2188366** (the `/npmrds/reports` page) — matches how every existing
report page nests (`reports/<name>`). Slug: **`list`** → `/npmrds/reports/list`, per the user's own
suggestion; this is exactly what the live page tree's convention predicts (a sibling of
`reports/snapshot`, `reports/year_over_year`, etc.). No `/npmrds/` prefix needed beyond what the
pattern already adds automatically.

(The build script's own placeholder comment for the toggle's future href says
`/converted_reports/all_reports` — that's a **stale, pre-rename literal**, not a locked decision; it
predates the 2026-09-02 `converted_reports`→`reports` slug rename and was never updated. Treat `list`
under the current `reports` parent as the real target, not that string.)

## Plan

1. **Shared-code fixes** (small, low-risk, benefit the modal too):
   - `tagToLabel` takes a viewer id parameter and compares before returning "You".
   - Add `category`/`difficulty` entries to `TAG_CATEGORIES` with their real value sets.
   - Fix `fetchCatalogRows.js`'s hardcoded `fromIndex: 0, toIndex: limit-1` to accept a real page
     offset.
2. **First, verify the two remaining open technical questions** (see Architecture decision items 1
   and 3): whether Ryan wants exact visibility-allow-list parity (groups branch) or the simplified
   version, and whether a native Card's sort can bind to a page filter. Then **build**: the results
   table as a native paginated Card (search leaf bound to `search`, Mine leaf bound to `user_id`,
   single-tag leaf bound to a new URL-bound tag key — `usePagination:true`, author `pageSize`); one
   small rail component for browse-by-tag (category pills + value panel + "Other tags" free-text,
   writing the resolved tag into that same URL-bound key), Hide incomplete-looking, Show-everyone's
   (defaulting **ON**), and — if item 1 keeps exact parity — the groups-aware half of the visibility
   check. A **real sort control**, wired natively if possible (item 3), otherwise reusing
   `SORT_MODE_OPTIONS`/`sortRows`/`reportScore.js` verbatim from `pickerScoring.js` same as both
   modals. Breadcrumb + removable active-filter chips + count bar can live in the rail component
   (they describe the *filter* state, which the rail already owns) even though the table itself is
   native. All rail-written state URL-bound the same way `Filter` sections already are.
3. **Page + header build** — a headless CLI builder script mirroring
   `build_npmrds_reports.mjs`'s structure and discipline (find-by-slug-then-address-by-id, runtime
   parity guard, draft-only, `SECTIONS_DUMP` escape hatch): create `reports/list` under 2188366;
   header band (title "All reports" · view-toggle Card with "All reports" active · search input ·
   `CreateReportButton` · New-route Card link); content band (rail + table, sibling sections per the
   mockup's own `items-stretch` note); reuse the Templates page's footer verbatim.
4. **Flip the Templates page's toggle** — edit `build_npmrds_reports.mjs`'s "All reports" cell
   (currently inert) to `isLink: true, location: "/reports/list", searchParams: "none"`, re-run.
5. **Verify**: both toggle directions round-trip; a `?search=…&tag=…&page=2`-style URL shared cold
   restores the same state; pagination math (`from`/`to`/total) matches the visible count after
   facets; the two shared-code fixes don't regress `ReportPickerModal` (spot-check the modal live —
   `user:993` no longer reads "You" to a viewer who is `175`; `category:`/`difficulty:` tags render
   as real labels in its chips too).

## Decisions made in scoping (flagged, not asked — override any of these freely)

- Slug `list` (not `all_reports`) — matches the user's own suggestion and the live sibling-slug
  convention equally well; no functional difference either way.
- Fix the two `tagCategories.js` bugs now, as part of this task, rather than filing them separately —
  they're small, additive, and this page can't be honest without them.
- Defer the `dynamic_report_template` backfill; ship "Show everyone's" defaulted ON instead.
- Drop the mockup's free-tag histogram outright rather than building a fake/partial version — a
  genuine, already-known DMS gap (no groupBy-unnest for multiselect columns), not this page's to
  solve. (The sort control is NOT dropped — see correction above, it ships real.)
- Results TABLE is a native paginated Card, not a custom component — the `user_id` page-filter
  mechanism (confirmed 2026-09-03) makes search/Mine/single-tag-filter/pagination all natively
  expressible. Only the tag-browse rail UI (and possibly the visibility allow-list's groups branch
  and/or sort, pending items 1 and 3 above) stays custom — see Architecture decision for the reduced
  surface.

## Files likely touched

- `src/themes/transportny/components/RouteTagBrowserModal/tagCategories.js` — `tagToLabel` viewer-id
  fix, two new `TAG_CATEGORIES` entries.
- `src/themes/transportny/components/ReportPickerModal/fetchCatalogRows.js` (or wherever the
  hardcoded `fromIndex`/`toIndex` lives — confirm exact filename during implementation) — real
  pagination.
- New: a small rail component directory under `src/themes/transportny/components/` (name TBD, e.g.
  `ReportsListRail` — registered as an `elementType`) for the tag-browse accordion + toggles + (maybe)
  the groups-aware visibility check. The results table itself is a native Card authored in the CLI
  builder script below, not a new component.
- New: `src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports_list.mjs`.
- `src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports.mjs` — flip the toggle cell.

## Testing checklist

- [ ] `tagToLabel` fix verified live on the existing modal (not just this new page)
- [ ] `category`/`difficulty` tag chips render real labels (not raw storage strings) in both the
  modal and the new page
- [ ] New page loads at `/npmrds/reports/list`, shows all 26 (dev) rows paginated at the authored
  page size
- [ ] Search, single-tag filter (via category browse and via "Other tags"), Mine, Hide
  incomplete-looking, Show-everyone's all narrow the table correctly and update the URL
- [ ] Sort control (Best match / Recently updated / Name A-Z) actually re-sorts the visible rows
- [ ] A copy-pasted filtered URL restores identical state on a fresh load
- [ ] View toggle round-trips both directions (`/npmrds/reports` ⇄ `/npmrds/reports/list`)
- [ ] Templates page (`/npmrds/reports`) unaffected — regression-checked since its own builder script
  is touched

## Peripheral findings (not blocking, noted for whoever's next in these files)

- `build_npmrds_reports.mjs` and `cr_sync.mjs` both cite a "DECISION D2" living in
  `planning/transportny/tasks/current/npmrds-reports-page-rev3.md` — **that file does not exist and
  has no git history.** The build script's own comment is the only surviving trace of that decision;
  there's no fuller writeup to consult.
- `cr_sync.mjs` (~line 271-277) still describes page 2188366 as slug `"converted_reports"`, stale
  since the 2026-09-02 rename to `"reports"` — one-line fix whenever someone's next in that file.
