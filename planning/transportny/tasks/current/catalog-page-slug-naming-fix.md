# Catalog page slugs collide with the old system's internal template names

**Project:** TransportNY · **Topic:** themes · **Status:** Slug/title swap fix DONE, live-verified
2026-08-07 · header placeholder-text item (below) still NOT started · **Started:** 2026-08-06,
**finished (slug fix):** 2026-08-07

Split out of `planning/transportny/tasks/completed/reports-page-template-catalog.md`'s "Triage,
same day" section (2026-08-06) — kept as its own task since it's a small, independent, cheap fix,
distinct from the much larger binding-gap fix (see
`../../../../src/dms/planning/tasks/current/dynamic-report-nongraph-section-binding.md`, a library
task, and the testing-structure tasks alongside this one).

## Done — slug/title swap, 2026-08-07

Implemented and live-verified per the "Proposed fix" plan below, with two real-world wrinkles the
plan didn't anticipate:

**1. Conversion order matters for the swapped pair.** Converting old id 246 with `--title
"Snapshot"` BEFORE old id 225 with `--title "Weekly Average"` collides: 225's *existing* page still
held the bare `converted_reports/snapshot` slug (minted under the old, unfixed converter, since
225's real old-system name literally is "Snapshot"), so 246 would get bumped to
`snapshot_0` instead of the clean slug. Fix: convert 225 first (frees the slug by deleting/
recreating that page under its own correct title "Weekly Average"), then 246. All 12 templates were
re-run via `--replace --title "<catalog title>"` (each per its row in the mapping table below);
`--report-id` conversions were not touched, per the original decision to keep this fix isolated.

**2. A Bash-tool timeout mid-conversion left real orphan/collision debris — worth knowing about if
this ever needs re-running.** A 12-item shell loop hit the tool's 2-minute wall-clock limit while
template 244 ("Year Over Year") was mid-flight; Python's stdout was fully buffered (piped through
`grep`, not a tty), so the process had actually gotten much further than the visible output implied
before being killed — it had already deleted the old page+snap row and created a *new* page + draft
sections, but never reached the final `reports_snap_2` row create. The next run's `--replace`
therefore found no existing marked page (the snap row that would prove one never got created), so it
minted ANOTHER new page, colliding on the clean slug and landing on `year_over_year_0`. Fixed by hand
via direct DB inspection + the `dms` CLI (not by re-running the converter again, which would have
just repeated the same collision): renamed the broken half-built orphan's slug out of the way, then
`dms page update` to move template 244's real completed page onto the correct `year_over_year` slug,
then deleted the orphan page + its 4 dangling draft-section rows via `dms raw delete` once confirmed
nothing referenced them. **Caught and avoided a near-miss along the way**: a *different*, similarly-
named page (`converted_reports/year_over_year_beginner`, id 2192364) looked like an orphan at first
glance but turned out to be a real, unrelated, already-live conversion of old **report** id 987
(not template 244) — confirmed via its own intact `reports_snap_2` row (`_converted_from_old_report_id:
"987"`) before touching it. Lesson: always confirm a suspected orphan has *no* snap-row reference
(by report_id, not just by the marker you expect) before deleting, even when the slug/title look
like an obvious duplicate. **If re-running any of this, do it one `--template-id` at a time (not a
shell loop that can exceed the 2-minute tool timeout), and check the gap-report + slug after each.**

**Also re-applied catalog metadata to all 12 fresh `reports_snap_2` rows** (each `--replace` deletes
the old snap row along with the old page, so `--title` alone doesn't preserve `tags`/`difficulty`/
`graph_count`/`page_path`/`counts_label`/curated `name`+`description` — those were gone from every
row until reapplied). Sourced description/difficulty/category text from the design mockup
(`npmrds-reports.html`'s § 01 cards, lines ~269-508) and graph_count/route-slot counts freshly
re-measured against the new pages (confirmed identical to the original catalog build's numbers —
title-only reconversion doesn't change section counts). Hit the same CLI footgun as the original
build (`dms raw update <id>` alone silently no-ops on a split `:data` row — the response echoes
success but nothing changes server-side): fixed by adding `--row-type "reports_snap_2|2177440:data"`,
confirmed this time by reading the DB directly rather than trusting the CLI response.

**Verified live** via `report_probe.mjs`: all 12 `/converted_reports/reports` catalog cards' visible
title text now pairs with the correct link href (confirmed "Snapshot" → `/converted_reports/snapshot`
and "Weekly Average" → `/converted_reports/weekly_average`, the originally-reported swap); loaded
`/converted_reports/snapshot` directly — header section reads "Snapshot.", no "Rochester" anywhere on
the page, 0 console/page errors. **Page ids changed again** (this is now the third set of ids for
these 12 pages — first build, Design Push #2 hotfix, this fix); not worth recording here, look up via
the `_converted_from_old_template_id` marker on `reports_snap_2` if needed.

**Not done this pass** — the header `purpose`/`metaLine` placeholder-text item below (checked live on
the new Snapshot page: still shows the master template's literal instruction copy, unchanged from
before this fix). Left as its own open item, not silently dropped.

## Objective

Make each reports-catalog card's link target match its own displayed identity, so "Snapshot"
doesn't link to a page whose URL literally says `rochester_inner_loop`.

## Root cause (confirmed against the live DB, not inferred)

Ryan reported: the "Snapshot" card on `/reports` links to
`http://npmrds.localhost:5173/edit/converted_reports/snapshot?routes=` and looked wrong. Traced
end-to-end:

- `convert_template.py:103`: `title = old["name"] or f"Template {old_id}"` — the page's own
  `title`/`url_slug` are **always** derived from the OLD `admin2.templates` row's real internal
  name, never from the catalog's own curated display name.
- The reports catalog (`reports_snap_2`) intentionally uses **curated** titles that differ from the
  old names — documented in the original catalog task as a known "catalogue-debt" collision:
  catalog card **"Snapshot"** is old template id **246**, whose real old-system name is
  **"Rochester Inner Loop"**; catalog card **"Weekly Average"** is old template id **225**, whose
  real old-system name is literally **"Snapshot"**.
- Confirmed live via `dbq.py new`, querying `reports_snap_2` directly:

  | reports_snap_2 row | old_template_id | catalog `name` | actual `page_path` |
  |---|---|---|---|
  | 2208624 | 225 | Weekly Average | `/converted_reports/snapshot` |
  | 2208904 | 246 | Snapshot | `/converted_reports/rochester_inner_loop_0` |

  So the card labeled "Snapshot" really does link to `rochester_inner_loop_0`, and vice versa — not
  a one-off glitch, a direct consequence of slug generation always using `old["name"]`.
- This was flagged as known/accepted debt when the catalog first shipped, but seeing the mismatch
  live in a real URL reads as broken to any visitor, and is cheap to fix at the source — worth
  actually fixing rather than leaving as accepted debt.

## Proposed fix

1. Add an optional title-override to the template conversion path:
   - `scripts/npmrds-reports/convert_old_reports_lib/cli.py`: add `--title` to the `--template-id`
     argument group (a plain string; only meaningful with `--template-id`).
   - `scripts/npmrds-reports/convert_old_reports_lib/convert_template.py:41`: change
     `convert_template(old_id, dry_run=False, replace=False)` to accept an optional
     `title_override=None` param; line 103 becomes
     `title = title_override or old["name"] or f"Template {old_id}"`.
   - `cli.py`'s `--template-id` branch (line ~132-134) passes `args.title` through.
   - Deliberately NOT touching `convert_report.py`/`--report-id` — that path has no catalog-title
     concept and isn't in scope here (keeps this fix isolated, per
     `feedback_isolate_shared_code_changes`).
2. Re-run `--replace --title "<Catalog Title>"` for all 12 catalog templates, using the exact
   catalog titles already recorded in `reports-page-template-catalog.md`'s own mapping table:

   | Catalog title | Old id |
   |---|---|
   | Single Route | 221 |
   | One Week Study | 276 |
   | Annual Average Study | 278 |
   | Single Day (Advanced) | 291 |
   | Year Over Year | 244 |
   | This Month vs. Last Month vs. Last Year | 239 |
   | Monthly Congestion | 207 |
   | Monthly Speed Comparisons | 77 |
   | Snapshot | 246 |
   | Seasonality | 247 |
   | Bi-directional | 228 |
   | Weekly Average | 225 |

   This also fixes the visible on-page `<h1>` (`ReportPageHeader` renders `item?.title` directly),
   so the page itself will read "Snapshot." instead of "Rochester Inner Loop." — resolving the
   confusion at both the URL and the visible heading.
3. Re-apply catalog metadata to the 12 fresh `reports_snap_2` rows the replace creates, same as the
   original build's process: `name`/`description`/`tags`/`difficulty`/`counts_label`/`graph_count`/
   `page_path` — `page_path` in particular MUST be re-derived from each new page's real (now
   correct) `url_slug`, not copied from the old row.
4. Verify no other reference to the old slugs exists (grep `converted_reports/rochester_inner_loop`,
   `converted_reports/snapshot` etc. across scratchpad/planning docs) before/after, since slugs are
   known-unstable elsewhere in this arc (see `reference_report_url_slug_convention` memory).

## Also fix, same pass (from the same triage, cheap): header placeholder text

Traced separately, same triage session: every converted page's `ReportPageHeader` section — cloned
verbatim by `template_framework_sections()` from the master "Report Page" template (`2187021`) —
carries that template's own **editor-instruction placeholder copy**, not real content:
`purpose` = *"What question does this report answer? Describe what it compares and why it matters —
then update the copy above to match your own report."*, `metaLine` = *"region · county · agency"*.
`template_framework_sections()` clones any `templateRole=='framework'` section byte-for-byte with no
per-report customization, so this literal instructional text ships as if it were real page copy on
all 12 catalog pages (and the 4 non-catalog `--report-id` conversions from the same day). Fix:
either author real per-template copy for the 12 catalog rows during the metadata re-application
step above (item 3), or explicitly blank both fields (the component already renders cleanly when
empty — `d.purpose ? <p>...</p> : null` in `ReportPageHeader.jsx`). Recommend real copy for the 12
catalog templates (they're the public-facing ones) since the effort is the same order as blanking
and is more useful.

**Not in scope here**: inferring `metaLine` (region/county/agency) from the picked route at
runtime — a real future enhancement, not a bug. Checked: the Routes Data catalog (source `2107426`)
has no region/county/agency columns today; would need new data + a binding mechanism. Logged, not
scheduled.

## Files requiring changes

- `scripts/npmrds-reports/convert_old_reports_lib/cli.py`
- `scripts/npmrds-reports/convert_old_reports_lib/convert_template.py`
- DB only for steps 2-3 above (via `dms` CLI / `convert_old_reports.py --replace`)

## Testing checklist

- [x] `--title` override works via a dry-run against one template (e.g. 246) before running all 12
- [x] All 12 catalog cards' `page_path` slugs match their own displayed catalog name (spot-checked
      "Snapshot"/"Weekly Average", the known collision pair — confirmed fixed both ways)
- [x] Each page's visible `<h1>`/header matches its catalog card name (confirmed "Snapshot.", no
      "Rochester" anywhere on the page)
- [ ] Header `purpose`/`metaLine` show real copy (or are cleanly blank) on all 12, not the master
      template's placeholder instructions — **still open, not done this pass**
- [x] Live-verify `/converted_reports/reports` — confirmed via `report_probe.mjs` (card title text
      correctly paired with each link href) and a direct load of `/converted_reports/snapshot`
      (0 console/page errors)
