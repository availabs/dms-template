# NPMRDS "All Reports" list page

**Project:** TransportNY · **Topic:** themes · **Status:** BUILT + VERIFIED LIVE (draft only, not published) · **Started:** 2026-09-03

**Publish blocker flagged 2026-09-04, RESOLVED same day:** Ryan noticed the `counts_label`
(routes · graphs) column was only populated by json-spec-generated reports — most reports had
nothing there. Decided: build a real write-path (RRL updates `reports_snap_2` whenever a
route/graph is added/removed), not remove the column. Built + live-verified as part of Phase 2 in
`npmrds-reports-routes-feedback-triage.md` — `ReportRouteList.jsx` now keeps `graph_count`/
`counts_label` live for any hand-authored report, confirmed via a live add-graph and
remove-route on a scratch report, DB-read before/after. No longer a blocker for this page's
publish.

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

## Architecture decision — FINAL, 2026-09-03 (second revision, supersedes the "mostly native primitives, revised" draft below)

**The draft below correctly found the `user_id` mechanism but stopped short — its own open
question #3 ("is native Card sort-binding possible") is now answered, and the answer reshapes the
whole plan. Keep the draft's reasoning for the `user_id`/visibility parts (still correct); replace
its conclusion on the results table.**

1. **Item 3 (native sort) — confirmed NO for `Card`, but the right fix is a different section
   type, not a custom component.** Read `buildUdaConfig.js`: a Card's `orderBy` is derived
   (`buildUdaConfig.js:1429`) from a static `column.sort` set at authoring time — no runtime
   binding exists for Card. BUT: Ryan pointed at a live screenshot (MAP-21 PM3, a `table`-type
   section) showing a real, viewer-facing "Sort: Not Sorted / A→Z / Z→A" dropdown on a column
   header. Traced it: `ComponentRegistry/spreadsheet/config.jsx`'s `Sort` header control has
   `displayCdn: ({ attribute, isEdit }) => isEdit || !attribute.disableSort` — i.e. **not**
   edit-gated (unlike every neighboring control) — the comment states outright: "Sort is the ONE
   header control viewers see... it doubles as the published sort affordance." Selecting it calls
   `setState` on that column's `sort`, which (same `useSetDataRequest`/`buildUdaConfig` pipeline
   Card uses) triggers a real re-fetch with a new `ORDER BY`. `elementType: 'table'`
   (`spreadsheet/config.jsx`'s registered `type`) is a sibling `ComponentRegistry` entry to `Card`
   — same `useDataWrapper`, same Filter-leaf binding, same `usePagination`/`pageSize`. **So the
   fix is: build the results grid as a `table` section, not a `Card`.** Zero custom fetch/sort
   code needed for it.
   - This makes the mockup's own finding #5 ("viewer-changeable sort is not a DMS capability...
     the pill goes away") **wrong**, the same class of miss as the `user_id` correction below —
     both times a real primitive existed and an earlier pass concluded it didn't. Corrected here.
   - **Trade-off flagged to Ryan and confirmed (2026-09-03, AskUserQuestion):** native per-column
     sort cannot reproduce `reportScore.js`'s weighted composite ("Best match" — log-scaled
     magnitude + ownership + recency + name-penalty summed to one number, not a single DB column).
     Ryan picked the native `table` section — **"Best match" is dropped for this page**; the
     table's default/author-set order is `updated_at desc` ("Recently updated"), and any viewer
     can click any sortable column header to re-order for real. This is a genuine, deliberate
     behavior difference from the modal, not an oversight.
2. **`buildVisibilityAllowListFilterGroup`'s groups branch — also fully native**, once the table
   is native: no custom fetch call needs `user.groups` at all. Reproduce the SAME shape as two
   ordinary page-filter-bound leaves in one `OR` group:
   `{ op:'OR', groups: [ {col:'created_by', op:'filter', usePageFilters:true, searchParamKey:
   'restricted_owner'}, {col:'tags', op:'filter', usePageFilters:true, searchParamKey:
   'restricted_curated'} ] }`. Both leaves are empty (dropped) unless the rail's "Show everyone's"
   toggle is OFF, in which case the rail writes BOTH URL params at once (`restricted_owner=<the
   viewer's own id, read from CMSContext>`, `restricted_curated=dynamic_report_template`) — a
   real, deliberate simplification from the modal's allow-list: **the `agency:<group>` OR-branch
   is dropped** (no native "current viewer's groups" page filter exists, confirmed by the original
   draft's own grep, and it's not worth a custom component just for that one branch). Flagged, not
   asked — matches "Show everyone's" already shipping defaulted ON specifically to route around
   the same backfill gap.
   - **The auto-injected `user_id` page filter is NOT the right binding for the "Mine" toggle.**
     `patternFilters` appends `{searchKey:'user_id', values: user?.id}` UNCONDITIONALLY on every
     page load (confirmed, draft below) — so a leaf bound directly to `searchParamKey:'user_id'`
     is ALWAYS populated and can never be "off". A toggleable "Mine" facet needs its OWN key
     (`mine`) that the rail writes with the viewer's id when ON and clears when OFF — same
     `navigate()` + `URLSearchParams` pattern `ReportPageHeader.jsx`'s "Viewing as of" control
     already uses (confirmed live code, not a new mechanism).
3. **Search — the established native recipe, verbatim.** `src/dms/skills/full-text-search-filter.md`
   is the exact recipe: one `elementType:'filter'` control section (`operation:'like'`,
   `searchParamKey:'search'`, `hideExternalToggle:true`) + an `OR` group of `like` leaves (name,
   description) on the table section, both `usePageFilters:true` + `searchParamKey:'search'`. Its
   own worked example (MNY `actions_index`, page 2239721) uses a **Spreadsheet** (`table`) section
   as the responding data section — independent confirmation that `table` sections take Filter-leaf
   bindings exactly like Card.
4. **Net result: the results grid needs NO custom component at all** — search, Mine, tag filter,
   visibility toggle, pagination, and now sort are ALL native (`elementType:'filter'` control +
   `elementType:'table'` data section + page-filter-bound leaves). The **only** custom code left is
   one small rail component (category pills + expandable value list + "Other tags" free-text +
   breadcrumb + active-filter chips + the Mine/Show-everyone's toggle pills) — pure UI that reads
   `pageState.filters` and writes URL params via `navigate()`, same shape as `ReportPageHeader`'s
   `asOf` control. It does no data fetching itself; the table section does that. This is a
   *smaller* custom-code surface than either prior draft in this file, and reuses the picker's
   actual constants (`TAG_CATEGORIES`, `tagToLabel`, `DYNAMIC_REPORT_TEMPLATE_TAG`) rather than
   re-typing them, per Ryan's instruction to reuse the picker's code/infra where it's genuinely the
   same knowledge (vocabulary, curated-tag semantics) — the parts that don't reuse (composite
   scoring, client-side pagination) are exactly the parts a native primitive now replaces outright.
5. **Not solved, deliberately dropped:** the modal's "Hide incomplete-looking" facet
   (`LOOKS_INCOMPLETE_RE`, a multi-substring case-insensitive regex over `name`) has no native
   filter op — `buildUdaConfig.js`'s leaf vocabulary is `like/filter/exclude/empty/notempty/time/
   is_null/is_not_null`, no regex/not-like-multiple-substrings op. Not worth a custom component
   for one heuristic toggle that (per the mockup's own measurement) hides exactly one row in the
   current catalog. Flagged, dropped, not built.

## Architecture decision — "mostly native primitives" draft, 2026-09-03 (superseded above on the results-table conclusion; the `user_id`/visibility reasoning below is still correct and load-bearing)

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

- **Viewer-changeable sort IS natively buildable — second correction, 2026-09-03.** The FINAL
  Architecture decision above (item 1) supersedes both this file's original "not a DMS capability"
  claim and its own first correction ("only the modals can do it, via client JS"). It's the
  `table`/Spreadsheet section type's own header control, live for any viewer, no client JS needed.
  What's genuinely dropped: `reportScore.js`'s composite "Best match" ranking has no single-column
  equivalent, so this page's default/author-set order is `updated_at desc`, not a prominence score
  — Ryan's explicit call once the native mechanism was shown to him (AskUserQuestion, 2026-09-03).
- **No library-wide tag histogram.** Confirmed: the UDA query engine has no groupBy-unnest path for a
  multiselect column (`tagCategories.js`'s own header comment), so a true "every tag + its count"
  histogram over arbitrary/free-text tags isn't buildable. Drop the mockup's "Tags in this library"
  free histogram entirely rather than faking it — the "Browse by tag" rail's five fixed categories
  (after the fix above) don't need it; the rail shows the vocabulary, not counts.
- **"Hide incomplete-looking" is dropped, not ported.** `LOOKS_INCOMPLETE_RE` is a multi-substring
  case-insensitive regex over `name` — `buildUdaConfig.js`'s filter-leaf vocabulary
  (`like/filter/exclude/empty/notempty/time/is_null/is_not_null`) has no regex/not-like-many-terms
  op. Not worth a custom component for a heuristic that (per the mockup's own measurement) hides
  exactly one row in the current catalog.

## URL / page tree

New page as a **child of page 2188366** (the `/npmrds/reports` page) — matches how every existing
report page nests (`reports/<name>`). Slug (`url_slug`): **`reports/list`** → `/npmrds/reports/list`.

**Correction, verified live 2026-09-03 (built the page, then had to fix this):** `url_slug` is a
FLAT, fully-composed path string, not a leaf segment — `parent` is hierarchy metadata only and is
NOT prepended at routing/slug-lookup time. Confirmed: `dms page show reports/year_over_year`
resolves (an existing child of 2188366); `dms page show year_over_year` does not. `dms page create
--slug list --parent 2188366` stores `url_slug:"list"` verbatim — the page then 404s/silently
falls back to the site's home page at `/npmrds/reports/list` (traversing-dms-pages.md's own
"any unresolvable slug silently falls back to home" gotcha; easy to misread as "page rendered
correctly, blank" instead of "wrong URL"). Fixed via `dms page update <id> --slug reports/list`.
The builder script now passes `--slug reports/list` directly on create.

(The build script's own placeholder comment for the toggle's future href says
`/converted_reports/all_reports` — that's a **stale, pre-rename literal**, not a locked decision; it
predates the 2026-09-02 `converted_reports`→`reports` slug rename and was never updated. Treat `list`
under the current `reports` parent as the real target, not that string.)

## Page-filter registry (the keys this page registers, per `creating-interactive-pages.md` step 0)

| `searchKey` | Written by | Read by | Semantics when absent |
|---|---|---|---|
| `search` | native `filter` control section (header) | table's OR-group of `like` leaves (name, description) | no constraint |
| `tag` | rail (category/value pick) | table's `tags` `filter` (array_contains) leaf | no constraint |
| `tag_like` | rail ("Other tags" free-text box) | table's `tags` `like` (substring) leaf | no constraint |
| `mine` | rail "Mine" toggle — writes the viewer's own `user.id` | table's `created_by` `filter` leaf | no constraint |
| `restricted_owner` | rail "Show everyone's" toggle (OFF only) — writes viewer's own `user.id` | one arm of the visibility `OR` group | dropped (both `restricted_*` leaves empty → no constraint → "show everyone's") |
| `restricted_curated` | rail "Show everyone's" toggle (OFF only) — writes the literal string `dynamic_report_template` | other arm of the visibility `OR` group | dropped |

`restricted_owner`/`restricted_curated` are written and cleared TOGETHER by the one "Show
everyone's" toggle — never independently. Do not bind anything to the auto-injected `user_id`
page filter directly (see Architecture decision item 2) — it's always populated, so a leaf bound
to it can never be "off".

## Plan

1. **Shared-code fixes** (small, low-risk, benefit the modal too):
   - `tagToLabel(tag, viewerId)` — new second param; compares `tag` against `makeUserTag(viewerId)`
     before returning "You", falls through to the existing raw-tag/vocabulary lookup otherwise.
     Update all 4 call sites (`ReportPickerModal.jsx`, `RouteTagBrowserModal.jsx`, `TagsEditor.jsx`
     ×2) to pass their already-in-scope `currentUserId`/`user?.id`.
   - Add `category`/`difficulty` entries to `TAG_CATEGORIES` with their real, confirmed value sets
     (pulled live via `dms dataset dump 2177438`, 2026-09-03, 51 rows): category → behavioral(4),
     change_over_time(4), floating_car(2), before_after(1), events(1); difficulty → beginner(4),
     intermediate(2), advanced(2).
   - `fetchCatalogRows.js`'s hardcoded `fromIndex`/`toIndex` is **NOT touched** — this page's table
     doesn't call it at all (native `table` section, not a custom fetch). Removed from scope.
2. **Rail component** (the only new custom code) — category pills + expandable value panel +
   "Other tags" free-text + breadcrumb + active-filter chips + Mine/Show-everyone's toggle pills.
   Imports `TAG_CATEGORIES`/`tagToLabel`/`DYNAMIC_REPORT_TEMPLATE_TAG`/`makeUserTag` from
   `tagCategories.js` (post-fix) rather than re-declaring the vocabulary. Reads `pageState.filters`,
   writes `search`/`tag`/`mine`/`restricted_owner`/`restricted_curated` via `navigate()` +
   `URLSearchParams`, same pattern as `ReportPageHeader.jsx`'s "Viewing as of" control (confirmed
   live convention, not a new mechanism). No data fetching of its own.
3. **Page + header build** — a headless CLI builder script mirroring `build_npmrds_reports.mjs`'s
   structure and discipline (find-by-slug-then-create, runtime parity guard, draft-only,
   `SECTIONS_DUMP` escape hatch): create `reports/list` under 2188366.
   - Header band: title "All reports." · view-toggle Card (flip active side vs. the Templates
     page) · a native `elementType:'filter'` search control (`operation:'like'`,
     `searchParamKey:'search'`, `hideExternalToggle:true` — `full-text-search-filter.md` step 1,
     NOT `ChooseReportButton`, since there's no modal to open on this page) · `CreateReportButton`
     · New-route Card link.
   - Content band, ONE band, TWO sibling sections (`items-stretch`, per the mockup's own note and
     `feedback_rail_column_layout_in_pages_theme`): rail (size 3, the new custom component) + table
     (size 9, `elementType:'table'`) bound to `reports_snap_2`. Table's authored filter tree: static
     `page_path notempty` + `name notempty` (legacy-row exclusion, always on) AND the `search`
     OR-group (step 1 above) AND a `tags` `filter` leaf bound to `tag` AND a `created_by` `filter`
     leaf bound to `mine` AND the `restricted_owner`/`restricted_curated` OR-group. Columns: name,
     tags, counts_label (routes · graphs), updated_at, page_path (link, `disableSort` on
     non-meaningful columns e.g. `page_path`). `display.usePagination:true`, author `pageSize`
     (mockup uses 25), default `sort` on `updated_at`: `'desc nulls last'`.
   - Reuse the Templates page's footer verbatim.
4. **Flip the Templates page's toggle** — edit `build_npmrds_reports.mjs`'s "All reports" cell
   (currently inert) to `isLink: true, location: "/reports/list", searchParams: "none"`, re-run.
5. **Verify**: both toggle directions round-trip; a `?search=…&tag=…&mine=…` URL shared cold
   restores the same table state; native pagination and native per-column sort both work by
   clicking table headers; the shared-code fixes don't regress `ReportPickerModal`/
   `RouteTagBrowserModal` (spot-check live — `user:993` no longer reads "You" to a viewer who is
   `175`; `category:`/`difficulty:` tags render as real labels in chips, not raw storage strings).

## Decisions made in scoping (flagged, not asked — override any of these freely)

- Slug `list` (not `all_reports`) — matches the user's own suggestion and the live sibling-slug
  convention equally well; no functional difference either way.
- Fix the two `tagCategories.js` bugs now, as part of this task, rather than filing them separately —
  they're small, additive, and this page can't be honest without them. Adding `category`/`difficulty`
  to the SHARED `TAG_CATEGORIES` also makes those two pills appear in `RouteTagBrowserModal` (routes
  never carry these tags, so they'd always show zero matches there) — a minor, known side effect of
  following this file's own already-written plan to extend the shared list; not gated on.
- Defer the `dynamic_report_template` backfill; ship "Show everyone's" defaulted ON instead.
- Drop the mockup's free-tag histogram AND "Hide incomplete-looking" outright — see Known gaps.
- "Best match" composite sort is dropped for this page (native per-column sort instead) —
  Ryan's explicit choice, see Architecture decision item 1.
- Visibility allow-list's `agency:<group>` OR-branch is dropped for this page (native
  `restricted_owner`/`restricted_curated` OR-group instead, no groups branch) — flagged, not asked,
  see Architecture decision item 2.
- Results table + search + Mine + tag-filter + visibility toggle + pagination + sort are ALL native
  (`elementType:'table'` + `elementType:'filter'` + page-filter-bound leaves) — zero custom fetch
  code. Only the tag-browse rail (pure UI, no data fetching) is custom.

## Files touched

- `src/themes/transportny/components/RouteTagBrowserModal/tagCategories.js` — `tagToLabel(tag,
  viewerId)` viewer-id fix; `REPORT_CATEGORIES`/`REPORT_DIFFICULTIES` + two new `TAG_CATEGORIES`
  entries.
- `src/themes/transportny/components/ReportPickerModal/ReportPickerModal.jsx`,
  `src/themes/transportny/components/RouteTagBrowserModal/RouteTagBrowserModal.jsx`,
  `src/themes/transportny/components/TagsEditor/TagsEditor.jsx` — updated all 5 `tagToLabel(...)`
  call sites for the new second parameter.
- New: `src/themes/transportny/components/ReportsListRail/` (`ReportsListRail.jsx`,
  `ReportsListRail.theme.js`, `index.jsx`) — the tag-browse rail + Mine/Show-everyone's toggles +
  breadcrumb + active-filter chips. Pure UI, no data fetching.
- `src/themes/transportny/themev2.js` — imports and registers `ReportsListRail` in
  `pageComponents` (the theme actually in use — not the older, unregistered `theme.js`).
- New: `src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports_list.mjs` — creates/
  updates page 2217965 (`reports/list`), idempotent re-run.
- `src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports.mjs` — flipped the "All
  reports" toggle cell from inert to a real link (`isLink`, `location: "/reports/list"`).
- 2026-09-04 header-alignment fixes (see "Shared-theme CSS" section above for the full story):
  `src/themes/transportny/themev2.js` (2 new `viewTab*` tokens, `flush` dataCard style,
  `header_search` filters style), `build_npmrds_reports_list.mjs` (header sections rebuilt), and
  3 files in the `src/dms` submodule — `.../dataWrapper/components/filters/RenderFilters.jsx`,
  `.../filters/Components/RenderFilterValueSelector.jsx` (theme-threading fix + placeholder
  fallback), and `.../dataWrapper/migrateToV2.js` (touched then reverted — confirmed dead for
  `elementType:'Filter'` sections).

## Testing checklist — all verified live 2026-09-03 (dev2, page 2217965, `/npmrds/edit/reports/list`)

- [x] New page loads at `/npmrds/reports/list` (edit view — page is draft-only, not yet published),
  shows all rows paginated at the authored page size (25; measured 26+ rows over 2-3 pages live)
- [x] Search narrows correctly across name+description (typed "Seasonality" → exactly the 2
  matching rows) and updates the URL (`?search=Seasonality`)
- [x] Tag filter (category browse: Category → Behavioral) narrows correctly (4 rows, all carrying
  `category:behavioral`) with breadcrumb ("ALL REPORTS / CATEGORY / BEHAVIORAL") and a removable
  active chip
- [x] `category`/`difficulty` rail pills render with real counts (5/3) and real value labels
  (Behavioral, Change Over Time, Floating Car, Before/After, Events; Beginner, Intermediate,
  Advanced) — not raw storage strings
- [x] Native per-column sort works: clicking the Updated column header opens the real
  Not-Sorted/A→Z/Z→A control and re-orders the table on a real re-query (verified both directions)
- [x] View toggle round-trips both directions: Templates → All Reports link (draft) correctly
  navigates to `/npmrds/reports/list`; All Reports → Templates link unchanged
- [x] Templates page (`/npmrds/reports`) unaffected by the toggle-cell edit — regression-checked,
  its own 12-template shelf still renders correctly in edit mode
- [x] `created_by`/`systemCol` resolution mechanism CONFIRMED CORRECT (see finding below) — but
  **cannot be visually distinguished against this specific dev catalog**, so Mine/Show-everyone's
  are mechanism-verified, not behavior-verified, pending real data
- [ ] `tagToLabel` "You" fix — not independently re-verified live this session (the fix + its 5
  call-site updates were code-reviewed at write time; no live check was done against the modal)
- [ ] A copy-pasted filtered URL restoring state on a cold (non-edit-mode) load — not tested; the
  page has never been published, so only the `/edit` route was exercised this session

### Real bug found and fixed during testing: `created_by` needs BOTH `systemCol:true` AND to be
### listed in the section's own `columns` array

Two separate, compounding bugs, both now fixed in `build_npmrds_reports_list.mjs`:
1. `RS_COLS` (copied from `build_npmrds_reports.mjs`, which never filters on `created_by`) lacked
   `systemCol: true` — the exact bug `reportCatalogSource.js` already documents and fixed
   elsewhere (2026-09-01). Without it, `created_by` resolves to the inert JSON field
   `data->>'created_by'`.
2. Even after adding `systemCol: true`, the `mine`/`restricted_owner` filters still did nothing —
   traced to `buildUdaConfig.js:839` (`buildColumnsWithSettings`): it only enriches/returns
   entries already present in the SECTION's own authored `columns` array, using
   `externalSource.columns` purely as a lookup table for entries that already exist in `columns` —
   it never adds a new entry from `externalSource` outright. `created_by` and `description` were
   never in `RESULTS_COLUMNS` (both are filter-only, never displayed), so `getColumn('created_by')`
   returned `undefined` and the leaf silently never resolved — no error, no SQL, no constraint.
   Fixed by adding both as `selectOnly:true, show:false` entries to `RESULTS_COLUMNS`.

Both fixes verified with a temporary diagnostic (`created_by` shown as a real visible column with
a hardcoded `value:["993"]` filter) before being reverted to the real `usePageFilters`-bound
version — see the finding below for what that diagnostic actually revealed.

### Finding: every row in this dev catalog shares the same real `created_by` (993)

The diagnostic column showed **every single visible row's real system `created_by` is 993**,
regardless of what `user:<id>` TAG it carries (rows tagged `user:1`, `user:175`, `user:643` all
still have `created_by:993`). This is a DATA fact of this dev environment (everything was written
via the same authenticated identity — imports, conversions, and this session's own testing all
ran as the same account), not a bug: the `user:<id>` tag and the real DMS `created_by` audit stamp
are two independently-maintained fields (per `tagCategories.js`'s own Workstream D commentary), and
in this dev catalog they've simply never diverged from the writer's own account. Net effect:
**Mine and the `restricted_owner` half of Show-everyone's will show ALL rows in dev today**,
correctly and by design (the filter really does evaluate to true for every row) — this is a real
limitation for demoing/screenshotting this page against dev data, not a code defect. A real
production catalog with distinct authors would show correct narrowing.

### One throwaway test artifact created and cleaned up

Clicking "Create Report" while testing produced a real page (id 2218002, slug `reports/page_25`,
named "Page 25" — collided in name only, not id, with pre-existing catalog debris of the same
name). Deleted via `dms page delete 2218002` after use.

## Real bug found and fixed: orphaned `reports_snap_2` catalog rows (2026-09-03)

Ryan caught this live on the new list page: deleting a report page via the generic admin
"Delete Page" action does not cascade to `reports_snap_2` — the catalog row survives, still
pointing at a `report_id` that no longer resolves to any real page. This is the SAME root cause
`ReportPickerModal/useReportSearch.js`'s `checkIdsExist` band-aid was built for (2026-09-01) — the
modal hides these live, per-search, via a runtime existence check against `dms.data[app].byId`.
The native `Spreadsheet`-based list page has no equivalent hook (a plain SQL query, no per-row
cross-table check available) — this is a real, structural gap between "native primitives" and
"the picker's own custom JS," not something a `page_path notempty` filter catches (orphans keep
their stale `page_path`, which still reads as non-empty).

**Fixed today:**
1. Identified and deleted the 3 rows currently orphaned (cross-referenced every `reports_snap_2`
   row's `report_id` against the live `npmrds_sub` page list) — catalog went from 52 → 49 rows,
   confirmed zero orphans remaining. Two of the three ("Page 25" ×2) were debris from THIS
   session's own live testing (a throwaway report created via "Create Report," then deleted — the
   exact same bug, self-inflicted); the third ("Page 24", `report_id` 2217752) predates this
   session.
2. New: `src/themes/transportny/qa_skills/tools/prune_report_snap_orphans.mjs` — a reusable,
   dry-run-by-default script (same cross-reference logic) to catch and remove future orphans.
   Not a live safeguard (the list page still has no runtime check) — a maintenance tool to re-run
   when the list looks wrong, until "Delete Page" itself cascades to this dataset (a deeper
   platform fix, not attempted here).

**Root cause FIXED 2026-09-04** (separate session, prompted by this exact page having no runtime
band-aid available): `dms.data.delete`'s server-side cascade dispatch (already extended once for
source/view orphans, `delete-cascade-source-view-orphans.md`) now also dispatches page deletes to
an optional, deployment-registered hook (`DMS_PAGE_DELETE_HOOK`, same shape as the already-shipped
`DMS_EXTRA_DATATYPES`) — `hooks/register_page_delete_hooks.js` → `npmrds_report_page_delete_hook.js`
deletes the matching `reports_snap_2` row whenever a report page is deleted, covering the admin UI,
`dms page delete`, and `dms raw delete` uniformly (not just this page). Full design + the exact
diff in `src/dms/planning/tasks/current/page-delete-lifecycle-hook.md`. This page itself needed no
changes — the fix is entirely upstream of it. `prune_report_snap_orphans.mjs` (above) stays as a
defense-in-depth backstop (hook failures are logged, never blocking) rather than becoming dead
code. **Still open**: PG-dialect test run and live verification against a real deploy (no docker
socket / VPN access in that session's sandbox) — see that task file's testing checklist.

## Shared-theme CSS — reverted, deferred to Alex (2026-09-03); FIXED 2026-09-04

Ryan's explicit call (2026-09-03): remove every style change that session made to `themev2.js` (a
shared file another contributor, Alex, is actively working in — the source of the git merge
conflict that session hit) and defer ALL toggle/search-box CSS fixes to him. `themev2.js` was
reverted to exactly the committed HEAD, both build scripts updated to reference only tokens that
still existed post-revert, and both KNOWN COSMETIC BUGS (mismatched border/gap on the toggle
pills; stacked label-above-box on the search input) shipped as-is, flagged in-code as deferred.

**Fixed 2026-09-04**, after Ryan re-raised it with a fresh screenshot. Took THREE passes to get
right — the first two looked fixed from a screenshot but weren't at the pixel level, and Ryan
caught a real mistake in the third (see below). Root causes, in the order found:

1. **Toggle gap + reversed corners** — `viewTabOn`/`viewTabOff` (themev2.js) bake "the active/dark
   cell is always the LEFT one" into the same class as the color: the left cell owns the full
   border + left radius, the right cell drops its left border + owns the right radius. This page
   needs the OPPOSITE (Templates left/inactive, All reports right/active). Fixed with two new
   POSITION-aware tokens, `viewTabOffLeft`/`viewTabOnRight` (themev2.js, `textSettings` +
   `dataCard` copies + `slashKeys`), rather than touching the existing (already-correct on
   Templates) pair.
2. **Toggle STILL had a ~14px gap** after (1) — a screenshot-only check missed it; a raw-pixel
   scan of a saved screenshot caught it, and Ryan independently confirmed it live. Root cause one
   level below the tokens: a Card LINK cell's wrapper `<div>` (`theme.value`, default `px-3 pb-3`)
   is a SEPARATE parent of the `<a>` the token classes land on, so the token's `!important`
   padding can't reach it — a STATIC cell doesn't have this problem (wrapper + token classes merge
   onto the SAME element). Fixed with a new `dataCard` style, `flush` (`value:''`), applied via
   `cardStyle:'flush'` on the toggle Card.
3. **Still ~2px, from Card's v1/v2 layout split** — `flush` alone left a residual 2px: Card.layout.js's
   v1 model (the default everywhere) gives every cell an always-on `border border-transparent`
   (+2px, reserved for the edit-hover outline). Fixed by adding `layoutModel:'v2'` to `flush`
   (v2 drops that border, uses a real CSS outline instead — zero layout impact). This is SAFE
   only because `cellBorder:false` is this Card's existing default.
4. **v2 switch silently top-packed the toggle** — Card.layout.js's `resolveCardsPackMode` inverts
   the default between layout models: v1 defaults to 'stretch' packing, v2 defaults to 'top'.
   Without `cardsVerticalAlign:'stretch'` alongside `layoutModel:'v2'`, the toggle sat 6px higher
   than its 4 header siblings (all still v1). Ryan caught this live by eyeballing pixel offsets
   the tool measurements hadn't flagged.
5. **Search bar + toggle not vertically aligned with the row** — `build_npmrds_reports.mjs` got a
   `height:'fill'` treatment on every header section (2026-09-03) that centres content on the
   row's mid-line; this page never got the matching treatment. Fixed by porting the same recipe
   to all 5 header sections; the title became a Card (a lexical section can't centre); the search
   Filter control got a new named `filters` style, `header_search` (themev2.js, styles[6]) that
   hides the label row and fills+centers.
6. **Header row still ~12px taller than Templates'** after (5) — Ryan caught this too. The search
   section's OWN natural (pre-stretch) content was 76px vs its siblings' 64-66px, so `height:'fill'`
   stretched everything else to match. Two contributors: (a) the shared `input` theme is `h-11`
   (44px) vs this row's `h-10` controls — left as-is, Ryan's explicit call, not worth the
   regression risk to the shared `Input`/`Textarea` theme used elsewhere in the app; (b) an
   unreachable `filterRowWrapper` override (+8px) — see next section for why and how that got
   fixed for real. Net: row height went 76px → 68px (Templates is 66px; the residual 2px is (a),
   accepted).
7. **Button cluster sat visibly closer to page-center than on Templates** — Ryan caught this too,
   unrelated to the above. This page's header column split (title 2 / toggle 2 / search 4 /
   create 2 / new-route 2 = 12) summed to the same total as Templates' (2/2/5/2/1) but distributed
   differently, so New route's own column being a full track wider shifted the whole
   Create-Report/New-route cluster left. Fixed by matching Templates' exact split (search→5,
   new route→1).

**A real mistake, caught by Ryan, corrected the same session:** the search box's placeholder text
fix (see next section) initially touched `migrateToV2.js` — Ryan asked "are you sure that's not
legacy-only?" and was right: `migrateToV2` returns `elementType:'Filter'` data verbatim
(`compName === 'Filter'` early-return, before any migration logic), so that edit was dead code,
never reached. Reverted cleanly. The ACTUAL live component
(`RenderFilterValueSelector.jsx`, not `ExternalFilters.jsx`/`ConditionValueInput.jsx` — this
page's `filters.groups` tree is empty, so `ExternalFilters` renders null) had two real, separate
bugs instead: it re-resolved its own `filters` theme with no style selector (dropping the parent
`RenderFilters.jsx`'s already-correct one, so `header_search`'s `filterRowWrapper`/`filtersWrapper`
overrides were silently ignored — fixed by threading the resolved `theme` down as a prop) and its
placeholder text was hardcoded to a literal `'search...'` for every `'like'` leaf, never reading
`filter.placeholder` at all (fixed by adding a `filter.placeholder ||` fallback, mirroring
`ConditionValueInput.jsx`'s existing pattern for the other code path). Both are narrow,
backward-compatible library fixes (3 files, `src/dms` submodule) — see "Files touched" below.

Verified live (`/npmrds/edit/reports/list`, dev2), pixel-measured via JS `getBoundingClientRect`,
not just screenshots: toggle gap is exactly 0px; all 6 header controls (title, both toggle pills,
search box, Create Report, New route) share the exact same vertical center; header row is 68px
(Templates: 66px, the accepted 2px residual); button cluster lands in the same columns as
Templates; search placeholder renders the real copy, not the generic default; search still
narrows results correctly. Templates page (`/npmrds/edit/reports`) regression-checked at each
step, byte-unchanged.

**Not done, and not part of this fix:** publishing the page (still draft-only, `dms page publish
2217965` is the owner's call) — the page WAS published mid-session by Ryan from an earlier,
partially-fixed draft, so it's stale again relative to the final draft above; needs a re-publish.
Ryan also asked the same session to design a COMBINED page (one toggle switching what renders
below it, no navigation) via the Design System; that is a separate, larger deliverable, not
started here.

## Peripheral findings (not blocking, noted for whoever's next in these files)

- `build_npmrds_reports.mjs` and `cr_sync.mjs` both cite a "DECISION D2" living in
  `planning/transportny/tasks/current/npmrds-reports-page-rev3.md` — **that file does not exist and
  has no git history.** The build script's own comment is the only surviving trace of that decision;
  there's no fuller writeup to consult.
- `cr_sync.mjs` (~line 271-277) still describes page 2188366 as slug `"converted_reports"`, stale
  since the 2026-09-02 rename to `"reports"` — one-line fix whenever someone's next in that file.
