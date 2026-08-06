# Reports page — § 01 template catalog

**Project:** TransportNY · **Topic:** themes · **Status:** DONE, live-verified · **Started/finished:** 2026-08-06

## Done — live-verified 2026-08-06

Built and shipped. **Verify URL:** `http://npmrds.localhost:5173/reports` (public, no auth needed) — also
`/edit/reports` for the authenring view. Page id `2208581`, section group UUID
`b77dbc82-4485-4e9a-8046-cc3a7eedf5b4`. All 12 templates render, correctly grouped into the 5
categories (1/2/1/4/4 cards), each showing name/description/difficulty/route+graph counts and a real
working link to its converted report page. Verified both the authenticated draft/edit view and the
plain public view via `report_probe.mjs` (0 console/page errors both times) — screenshots match.

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
