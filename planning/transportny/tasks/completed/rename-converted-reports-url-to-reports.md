# Rename report URLs: `/npmrds/converted_reports` → `/npmrds/reports`

**Project:** TransportNY · **Topic:** content · **Status:** DONE, live-verified · **Started:** 2026-09-02 · **Completed:** 2026-09-02

## Objective

Change the live NPMRDS report URL scheme from `www.localhost:5173/npmrds/converted_reports` (homepage)
and `www.localhost:5173/npmrds/converted_reports/<report_slug>` (individual reports) to
`www.localhost:5173/npmrds/reports` and `www.localhost:5173/npmrds/reports/<report_slug>` respectively.
`route_creation` is explicitly out of scope — it already lives at `/npmrds/route_creation` and stays there.

## Scope

- **In scope**: the `converted_reports` homepage page (id `2188366`), every page nested under it by
  slug (the 12 Dynamic Report templates, 4 golden-corpus regression fixtures, ~6-9 older one-off
  converted reports, and the 30-report batch converted 2026-09-02 — roughly 50-55 page rows total),
  their paired `reports_snap_2` catalog rows, the small set of code locations that hardcode the
  `converted_reports` slug (converter constants, one live-component back-link, tooling/build scripts),
  and the committed regression-test fixtures (`golden-corpus.json` + its sibling spec) that reference
  these URLs by literal string.
- **Explicitly destroyed, not migrated**: the `converted_reports/reports` page (id `2208581`) — Ryan
  confirmed 2026-09-02 this was a v0.1 landing page and can simply be deleted, not renamed/kept.
- **Out of scope**: `route_creation` (staying at `/npmrds/route_creation`, unchanged); the mount-prefix
  system (`resolveMountPath`/`MountContext`, already correct and orthogonal — this task only changes
  the slug segment itself, not the `/npmrds` prefix); ~30 planning/research/skill docs that reference
  `converted_reports/*` historically (informational only, lowest priority, can be batch-updated
  opportunistically — not blocking).

## Current State (confirmed via code read, 2026-09-02)

**`url_slug` is a flat string baked in at save time — there is no cascading rename.** Confirmed by
direct code read (not assumed):

- Route registration is one wildcard per pattern mount (`path: "/*"`,
  `src/dms/packages/dms/src/patterns/page/siteConfig.jsx:209,234`); React Router just captures the
  whole remaining path as one string.
- Matching is a flat string comparison: the wildcard remainder is compared against
  `item.url_slug === activeSlug` over the full page list (`src/dms/packages/dms/src/api/index.js:71,75`).
- `getUrlSlug()` (`src/dms/packages/dms/src/patterns/page/pages/_utils/index.js:99-131`) computes
  `baseSlug = getParentSlug(...) + toSnakeCase(item.title)`, where `getParentSlug()` returns the
  **parent's own already-materialized `url_slug`** (not just the parent's short segment) — so a
  report page's `url_slug` literally *contains* the substring `converted_reports/` as a baked-in
  prefix, computed once when the page was created/renamed and never revisited.
- `parent` is a real page-ID pointer field (`page.format.js:163-175`, `cli/docs/TYPES.md:100`), but it
  is only consulted to *compute* the slug once — nothing re-derives it later, and no code anywhere
  (checked for cascade/descendant/renameChildren) propagates a rename to descendants. `dms page update
  --slug` (`cli/src/commands/page.js:243,250-256`) just merges the literal new value into that one row.
- **Practical implication**: renaming the homepage page's `url_slug` alone does nothing for any
  existing child page. Each of the ~50-55 report pages needs its own `url_slug` individually rewritten
  (mechanical prefix swap), plus its paired `reports_snap_2` row's `page_path` field (a separate table,
  same rewrite) — this is the field `ReportPickerModal.jsx`'s "Choose a report" navigates by
  (`openReport()`, `resolveMountPath(row.page_path, ...)`), so it must stay in lockstep or the picker
  will send users to a dead URL.
- **Confirmed 2026-09-02, in answer to Ryan's direct question about UI behavior**: renaming the
  parent via the UI does not just "do nothing" for children — it creates a silent, incidental split.
  Nothing re-derives a child's `url_slug` from a live parent lookup, so a child stays on its old full
  slug (`converted_reports/<title>`) indefinitely, and any UI navigation to it (the "Choose a report"
  picker, `ReportPickerModal`'s `openReport()`, the report header's Edit/Done toggle) still sends you
  to that **old** URL — none of these rebuild a link from "current parent slug + child's own segment,"
  they all read the child's own stored `url_slug`/`page_path`. The page still loads fine (route
  matching is a flat string compare, independent of the parent's current slug), so nothing 404s
  immediately. But a child's slug *can* jump to the new prefix — one page at a time, as an incidental
  side effect the next time someone happens to re-save *that specific child's own title* (confirmed via
  `ReportPageHeader.jsx`'s `commitTitle()`, which has an explicit dirty-check — `if (!trimmed ||
  trimmed === item?.title) return` — so merely toggling Edit/Done does nothing; it takes an actual
  title edit-and-confirm). Left alone after a UI-only parent rename, the report population would
  silently and unpredictably split between old- and new-prefix URLs over time, with no one having
  asked for that. This is the concrete reason a deliberate bulk migration is required, not an
  UI-driven "rename and let it settle."
- Good news: because of the already-shipped mount-aware-links work
  (`src/dms/planning/tasks/current/mount-aware-links-and-retired-subdomains.md`), nearly every live
  report-authoring component is already dynamic (reads `item.url_slug`/`row.page_path`/`item.parent`
  off data, not a hardcoded string) — `editFunctions.jsx`'s `updateTitle()`/`newPage()`,
  `ReportPageHeader.jsx`, `settingsPane.jsx`, `ReportPickerModal.jsx`, `CreateReportButton.jsx`, and the
  `npmrds_sub` pattern itself (zero code-level dependency on the literal string `converted_reports`).
  Only a small, enumerated set of places actually hardcode the string — see below.

## Proposed Changes

### Step 0 — pre-flight (day of execution, not now)

- Confirm with the coworker doing report-conversion work that they're still holding off on new
  conversions (per Ryan 2026-09-02: they already are, and it's fine either way — "if we miss 1, nbd").
- Re-run a fresh count of pages whose `url_slug = 'converted_reports'` or
  `url_slug LIKE 'converted_reports/%'` right before starting (exact figures below are from
  2026-09-02 memory, not a live query — treat as an estimate, not a target that must reconcile exactly).
- Confirm whether anything has `parent = 2208581` (the page being destroyed) before deleting it, so no
  page is silently orphaned — not checked yet, do this first.
- Check whether `scripts/npmrds-reports/dynamic_report_specs/*.json` (the 12 templates' own committed
  specs) carry an explicit `parent`/slug field, or rely purely on `report_build.mjs`'s
  `DEFAULT_PARENT_SLUG` fallback — not yet confirmed either way.

### Step 1 — code changes (small, enumerated)

| File | Change |
|---|---|
| `scripts/npmrds-reports/convert_old_reports_lib/config.py:108` | `CONVERTED_PARENT_SLUG = "converted_reports"` → `"reports"`. This is the master constant the Python converter uses for every newly-converted report's slug. Note: this file had uncommitted changes from another active session earlier today; as of the last check it's back to a clean/committed state (commit `27ae29e0`), but re-check `git status`/`git diff` before editing. |
| `scripts/npmrds-reports/convert_old_reports_lib/pages.py:35` | Comment in `compute_report_slug()` docstring referencing the old scheme — update for accuracy. |
| `scripts/npmrds-reports/pick_test_report.py:37` | Its own duplicate `CONVERTED_PARENT_SLUG = "converted_reports"` constant (used to build the `LIKE` filter and the printed verification URLs) → `"reports"`. |
| `scripts/npmrds-reports/report_build.mjs:66,269-270,1666-1669` | `DEFAULT_PARENT_SLUG = 'converted_reports'` → `'reports'` — used to compute new report slugs and to look up the parent page when (re-)seeding the 12 Dynamic Report templates. |
| `src/themes/transportny/components/routecreation/components/RouteIdentityPanel.jsx:39` | The **one live-component hardcode**: `resolveMountPath("/converted_reports#routes", ...)` → `resolveMountPath("/reports#routes", ...)`. This is the route-creation map's "All routes" back-link. |
| `src/themes/transportny/qa_skills/tools/builds/build_npmrds_home.mjs:154-176`, `build_npmrds_macro.mjs:165`, `build_npmrds_reports.mjs:3,89,141,142`, `cr_sync.mjs:266,300` | One-off page-content-seeding/QA-sync scripts, not shipped app code — hardcoded `/converted_reports*` path tables. Lower priority (only matters if these are re-run), but should be updated for consistency so a future re-run doesn't reintroduce the old slug. |
| `src/dms/packages/dms/tests/mountPath.test.js:70` | Example assertion `resolveMountPath("/converted_reports/reports", "/npmrds", ...)` → update the example value for consistency (cosmetic, doesn't test the string itself, low risk either way). |

### Step 2 — regression-fixture updates (must move in lockstep with the DB migration, not deferred)

Per the standing convention that fixtures + the 12 Dynamic Report templates are the deliberate,
git-committed exceptions to "specs are ephemeral":

- `scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json` — 8 entries, each
  `"url": "converted_reports/<slug>"` → `"reports/<slug>"`.
- `scripts/npmrds-reports/report_probe_fixtures/specs/plain-two-route-linegraph.json` — one `"slug"`
  field, same prefix swap.

These must be updated in the **same pass** as the DB migration below — if the DB rows move but these
fixtures don't, `report_probe.mjs`/the golden-corpus regression suite will fail against pages that no
longer exist at the old slugs.

### Step 3 — DB bulk migration (the actual rename)

1. **Delete** page `2208581` (`converted_reports/reports`, the v0.1 landing/catalog page Ryan confirmed
   is disposable) — both the page row itself and its paired `reports_snap_2` row if one exists (check
   first, per Step 0).
2. **Rewrite** the homepage page `2188366`'s `url_slug` from `"converted_reports"` → `"reports"` (single
   scalar field update, e.g. `dms page update 2188366 --set url_slug=reports` — pages are not split
   `:data` types, so the normal `dms page update`/`dms raw update` path applies, not the
   dataset/split-row path).
3. **For every remaining descendant page** (the ~50-55 real report pages, excluding the just-deleted
   2208581): rewrite `url_slug`, replacing the `converted_reports/` prefix with `reports/` (same
   suffix). Enumerate via `url_slug LIKE 'converted_reports/%'` for the npmrds app/pattern (confirm
   exact app/type filter at execution time, e.g. via `dms site tree` or `dms raw list`).
4. **For each of those pages' matching `reports_snap_2` row** (joined via `report_id` = page id):
   update `page_path` to the same new value, via the established safe write path
   (`dms dataset update reports_snap_2 <row-id> --view <id> --set page_path=<new>` — the
   purpose-built shallow-merge path for split dataset rows, not `dms raw update`, which needs an
   explicit `--row-type` and is easy to footgun on split rows).
5. Spot-check via re-query (a handful of pages + their catalog rows) before considering the migration
   done. Per Ryan: **100% completeness is not required** — "if we miss 1, nbd." A best-effort bulk
   pass with a few smoke-test verifications is sufficient; this is not a task requiring a full
   before/after row-count reconciliation audit, though doing one is cheap and welcome.

### Step 4 — live verification

- `/npmrds/reports` renders the homepage.
- A handful of migrated report URLs (`/npmrds/reports/<slug>`) load correctly.
- `report_probe.mjs`/golden-corpus regression pass against the new slugs (after Step 2's fixture
  update).
- "Choose a report" picker still opens reports correctly (proves `page_path` lockstep update worked).
- Route-creation's "All routes" back-link (`RouteIdentityPanel.jsx`) now points at `/npmrds/reports#routes`
  and resolves correctly.
- Creating a brand-new report via "Create Report" lands it under `reports/<new_title>`, not
  `converted_reports/<new_title>` (proves Step 1's constant flips took effect).

### Step 5 — docs (lowest priority, can be opportunistic/deferred)

- `src/dms/skills/traversing-report-pages.md` is an explicitly living doc (per its own convention) —
  update it in the same session as the live-verification pass, not deferred.
- The ~30 other `planning/`/`research/`/`src/dms/planning/` files referencing `converted_reports/*`
  historically are informational narrative, not live contracts — safe to leave stale or batch-update
  later, not blocking.

## Files Requiring Changes (summary list)

- `scripts/npmrds-reports/convert_old_reports_lib/config.py`
- `scripts/npmrds-reports/convert_old_reports_lib/pages.py`
- `scripts/npmrds-reports/pick_test_report.py`
- `scripts/npmrds-reports/report_build.mjs`
- `src/themes/transportny/components/routecreation/components/RouteIdentityPanel.jsx`
- `src/themes/transportny/qa_skills/tools/builds/build_npmrds_home.mjs`
- `src/themes/transportny/qa_skills/tools/builds/build_npmrds_macro.mjs`
- `src/themes/transportny/qa_skills/tools/builds/build_npmrds_reports.mjs`
- `src/themes/transportny/qa_skills/tools/cr_sync.mjs`
- `src/dms/packages/dms/tests/mountPath.test.js`
- `scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json`
- `scripts/npmrds-reports/report_probe_fixtures/specs/plain-two-route-linegraph.json`
- DB: page `2188366` + ~50-55 descendant pages + their paired `reports_snap_2` rows (bulk update, no
  fixed file)
- DB: delete page `2208581` (+ paired `reports_snap_2` row if any)

## Testing Checklist

- [ ] `/npmrds/reports` loads the homepage (was `/npmrds/converted_reports`)
- [ ] `/npmrds/converted_reports` no longer resolves to anything live (404 or falls through cleanly —
      confirm behavior, no `retired_subdomains`-style redirect exists for a slug rename, only for
      subdomain retirement, so this will likely just 404 — decide if that's acceptable or if a
      redirect is wanted)
- [ ] A sample of migrated report pages load at `/npmrds/reports/<slug>`
- [ ] `reports_snap_2.page_path` matches each migrated page's new `url_slug` (spot-check + "Choose a
      report" picker navigation)
- [ ] `report_probe.mjs` / golden-corpus regression suite passes against new slugs
- [ ] New report creation lands under `reports/<slug>`, not `converted_reports/<slug>`
- [ ] Route-creation's "All routes" back-link works
- [ ] `converted_reports/reports` (2208581) is deleted, nothing orphaned (no page had it as `parent`)

## Decisions locked 2026-09-02

- `converted_reports/reports` (2208581) is destroyed, not migrated — confirmed v0.1 landing page,
  disposable.
- No strict ordering/timing constraint — the coworker doing report-conversion work is already holding
  off on new conversions until signaled otherwise; the 30 reports converted 2026-09-02 are stable
  (not growing or shrinking).
- Completeness is best-effort, not exhaustive — missing one row during the bulk migration is
  acceptable, not a blocker.
- Ryan gave the explicit go-ahead 2026-09-02 to implement from this file.

## Execution record — DONE 2026-09-02

Implemented in one session, same day as scoping, per Ryan's go-ahead ("get started, heres the task
file"). No coordination delay was needed — the coworker doing report-conversion work was already
holding off, confirmed by Ryan before starting.

### DB migration

Enumerated live via `dbq.py new` against `dms_npmrdsv5.data_items` (`type = 'npmrds_sub|page'`,
`data->>'url_slug'` `= 'converted_reports'` or `LIKE 'converted_reports/%'`) — **exactly 50 rows**
(1 homepage + 48 real reports + the 1 doomed catalog page), matching the scoping estimate closely.
Migration driver: `scratchpad/npmrds-sub/rename_converted_reports_migration.py` (new, one-time,
gitignored) — dry-run verified first, then applied via the `dms` CLI (never raw SQL writes):

- **Homepage** (2188366): `dms page update 2188366 --set url_slug=reports` — title left as
  "Converted Reports" (out of scope, URL-only ask).
- **Destroyed**: `dms page delete 2208581` (`converted_reports/reports`) — confirmed first that no
  page had `parent = 2208581` (nothing orphaned), and it had no paired `reports_snap_2` row to clean
  up.
- **48 report pages**: `dms page update <id> --set url_slug=reports/<same-suffix>` each (prefix swap
  only, preserving whatever collision-disambiguation suffix already existed — deliberately NOT
  recomputed fresh via `getUrlSlug()`, since a fresh recompute could theoretically collide where the
  stored value already doesn't).
- **48 paired `reports_snap_2` rows** (view `2177440`, 1:1 match with the 48 report pages, confirmed
  by `report_id`): `dms dataset update reports_snap_2 <row-id> --view 2177440 --set page_path=/reports/<slug>`.
- Result: **0 failures across all 50 logical operations** (98 underlying `dms` CLI calls). Verified
  via fresh read-only re-query: 0 pages remain under `converted_reports*`, 49 now under `reports*`
  (homepage + 48), 2208581 confirmed gone, 0 `reports_snap_2` rows still have an old `page_path`, 48
  have the new one.

### Live-content fixes beyond the DB rename (found via a full DB-wide literal-substring sweep, not just the pre-scoped file list)

**Important self-caught bug along the way**: an early sweep used `data::text ILIKE '%converted_reports%'` — in SQL LIKE/ILIKE, `_` is a wildcard
for **any single character**, not a literal underscore, so this pattern also matched "Converted Reports" (the
homepage's own title, with a space) as a false positive, and briefly appeared to show the homepage
row "flapping" between matching/not-matching across separate read connections (actually just two
different rows/timings, not real instability). Redid the sweep with `strpos(data::text, 'converted_reports') > 0`
(a true literal substring test) once this was caught — the corrected sweep is what the numbers below are based on.

The corrected DB-wide sweep found **3 additional live spots** beyond the single hardcode already
identified during scoping (`RouteIdentityPanel.jsx`), all fixed via the same technique already
established in this codebase (fetch the row's full `data`, string-replace, write back the complete
object via `dms raw update <id> --data <file>`):

1. **Site-wide nav config** — pattern row `2100394`'s `theme.navOptions.secondaryNav.navItems`
   (the actual top-nav "Reports" link every page on the site shows) had `"path": "/converted_reports"`
   — fixed to `/reports`. This is the single most consequential fix in this list; missing it would
   have left the whole site's primary nav pointing at a dead slug.
2. **The Home page's own hero/footer content** (page `2211341`, slug `home`, distinct from the
   `converted_reports`/`reports` homepage at 2188366) — 10 component rows (5 logical components ×
   draft+published pairs: ids 2213651/2216763, 2213652/2216764, 2213653/2216765, 2213654/2216766,
   2213666/2216778) had literal `"path"`/`"location"` values like `/converted_reports`,
   `/converted_reports/snapshot`, `/converted_reports/year_over_year` baked into their lexical/Card
   content — fixed via global string-replace of `converted_reports` → `reports` within each row's
   `data` (safe: the token is distinctive, no risk of an unintended match).
3. **The homepage's (2188366) own footer nav row** — 2 component rows (2217640 draft, 2217674
   published) had a "report" button pointing at `/converted_reports/reports` (the just-destroyed
   catalog page) — repointed to `/reports` (the homepage itself, the closest surviving equivalent).

**28 additional rows still contain the literal string `converted_reports`** (mostly `/converted_reports`,
`/converted_reports/snapshot`, `/converted_reports/year_over_year`, `/converted_reports/reports`
fragments) but are confirmed **orphaned** — not referenced by any live page's `sections` or
`draft_sections` array (checked via a containment query against all 28 ids). Left alone, per this
repo's standing convention of not chasing down harmless DB debris unless asked. Ids, for reference: 2211455-2211458,
2211475, 2211479, 2213582-2213585, 2213597, 2213674-2213677, 2213689, 2213976, 2213998, 2214149,
2214392, 2214775, 2214792, 2216740-2216743, 2216755, 2217622.

### Code changes (all applied)

All files from the "Files Requiring Changes" list above were edited as planned:
`convert_old_reports_lib/config.py` (`CONVERTED_PARENT_SLUG` → `"reports"`), `pages.py` (docstring),
`pick_test_report.py` (`CONVERTED_PARENT_SLUG`, docstring, error message — smoke-tested live after
the DB migration, correctly prints `reports/<slug>` URLs), `report_build.mjs`
(`DEFAULT_PARENT_SLUG` → `'reports'`, 2 stale comments), `RouteIdentityPanel.jsx` (the one live
hardcode), `mountPath.test.js` (example value swapped to a still-real path), the 3 `qa_skills`
build scripts (`build_npmrds_home.mjs`, `build_npmrds_macro.mjs`, `build_npmrds_reports.mjs` —
including repointing each dead `reportIndex`/report-button target from the destroyed 2208581 to
`/reports`), and `cr_sync.mjs` (dead override entry removed with an explanatory comment, stale
comment updated). `dynamic_report_specs/*.json` (the 12 templates' own committed specs) were
checked and confirmed to carry **no** hardcoded parent/slug field — they rely purely on
`report_build.mjs`'s default, already fixed, so no changes needed there.

### Regression fixtures (updated in lockstep, per Step 2)

`golden-corpus.json`'s 8 `"url"` fields and `plain-two-route-linegraph.json`'s `"slug"` field
updated `converted_reports/` → `reports/`.

### Live verification

- `curl`/`report_probe.mjs --auth` confirmed `/npmrds/reports` (homepage) and
  `/npmrds/reports/snapshot` (a migrated report) both render real content, 0 console/page/SQL
  errors, and the top-nav correctly shows "Reports" pointing at the new path.
- **The old URL (`/npmrds/converted_reports/snapshot`) does not cleanly 404** — it falls through to
  a different pattern's page (the TransportNY root landing content), the same generic "unmatched
  slug falls through to another mounted pattern" behavior already documented elsewhere in this repo
  (`mount-aware-links-and-retired-subdomains.md`'s retired-subdomain work is the closest existing
  fix, but that mechanism only covers retired **subdomains**, not an individual page's renamed
  slug). Not fixed — building a redirect for this would be new capability work, out of scope for a
  rename task; flagging it here as a known, accepted consequence (Ryan: "if we miss 1, nbd" — same
  risk tolerance applies to old bookmarked URLs).
- Full golden-corpus regression suite (`probe_corpus.mjs`, 8 entries) run against the renamed URLs:
  **5/8 PASS**. The other 3 findings were investigated and confirmed **unrelated to this rename**,
  not regressions from it:
  - `golden_corpus_routemap`: "non-200 API responses increased 1→3" — all 3 are `204` responses
    (an analytics tracking beacon + 2 legitimately-empty map tiles), not errors; 0 console/page/SQL
    errors confirmed via a direct re-probe.
  - `dynamic_report_seasonality` (3 sections) and `dynamic_report_annual_average_study` (5 sections):
    flagged as "blank → has content" against the stored baseline. Reproduced consistently (not
    flaky), but 0 console/page/SQL errors on direct re-probe, and the affected sections (Hours of
    Delay / relative-date breakdowns) land squarely in a gap area already tracked elsewhere
    (`project_dynamic_reports_relative_dates_next_steps` memory: "2 real gaps remain
    (avgHoursOfDelay+summary, peak-hour relative slots)") — nothing in this task touched
    measure/date/query logic, only `url_slug`/`page_path`/href strings, so this cannot be caused by
    the rename. Left the stored baseline untouched (not this task's call to re-capture it) and did
    not investigate further — flagging for whoever owns that gap-tracking work next.
- `traversing-report-pages.md` (living skill doc) updated with a top-of-doc dated correction note
  plus the two "current fact" references fixed in place, per its own living-document convention.

### Not done / explicitly out of scope

- The ~28 orphaned DB rows left alone (see above).
- The homepage's title ("Converted Reports") left unchanged — URL-only ask.
- No redirect built for the old `converted_reports/*` URLs (see live-verification note above).
- The 3 pre-existing golden-corpus findings (see above) — not this task's to fix.
