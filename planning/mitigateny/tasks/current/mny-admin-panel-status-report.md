# MNY Admin Panel status report (pattern 566466) + county_template link audit (1300890)

**Project:** MitigateNY · **Topic:** content · **Status:** DONE (v1 + v2 + v3 + v4) · **Started:** 2026-08-12 · **Completed:** 2026-08-17

## Objective

Produce a data-backed status report in `src/themes/mny/design/reports/` documenting:

1. Every page in the **admin panel pattern 566466** (`/admin`, subdomain `*`), with an
   information-architecture diagram showing per-page status.
2. Which admin pages **need attention**, judged by whether each form parent's links carry a
   user to analogous destinations across parents. The Actions and Capabilities ecosystems
   legitimately have more pages (client request) — those only need to link correctly.
3. Live verification that the **tables** (Spreadsheet/Card row-action links) and **edit cards**
   actually navigate where they claim.
4. A review of **county_template pattern 1300890**: every page/location that links into
   `/admin`, and whether those links are operational or broken.
5. A fix list, grouped by type and location, workable by a human.

**Client direction observed:** deleted nothing; delete buttons assumed working and not exercised;
no rows added or edited in any forms dataset during the audit. All browser work was read-only.

## Deliverable

`src/themes/mny/design/reports/admin-panel-status.html` — "Every page, and what needs attention".

## Method

- `scratchpad/mny-admin-status/harvest.mjs` — pulls every page + every section of a pattern via
  the CLI's falcor client and extracts link-bearing config keys
  (`path`/`url`/`link`/`href`/`baseUrl`/…) with their JSON path.
- `scratchpad/mny-admin-status/check2.mjs` — resolves each value against the pattern's real
  slug set, handling both absolute (`/admin/...`) and react-router-relative (`edit`) forms.
- `scratchpad/mny-admin-status/scan-raw.mjs` — raw regex sweep of every serialized section for
  `/admin...` strings, so nothing is missed by the key-name heuristic (this surfaced the
  county_template Card links).
- `scratchpad/mny-admin-status/build-status.mjs` — per-page status matrix + form-family matrix.
- `scratchpad/mny-admin-status/gen-report.mjs` — emits the HTML from `report-data.json`, so every
  number in the report is generated, not typed.
- Live verification in Chrome against production (`https://www.mitigateny.org`), signed in with a
  CLI-minted session token seeded into `localStorage.userToken` (see
  `src/dms/skills/authenticating-the-dms-cli.md`).

## Findings

### Admin pattern 566466 — 74 pages / 1,012 sections

| Class | Count | Meaning |
|---|---|---|
| A — live dead links | 47 (27 pages) | control renders today, target slug doesn't exist |
| B — latent | 4 | stale action-column `url` stored on a table/card, not currently surfaced |
| C — draft only | 2 | only in draft sections |
| D — in dropped sections | 14 | published but inside a section group the page doesn't define |

- **17 pages** have neither a sidebar entry nor a working inbound link (URL-only).
- **23 published sections across 6 pages never render** — they name a `group` absent from the
  page's `section_groups`. 18 of them are on the admin Home page (566463), which is why Home
  shows 4 EXPLORE cards while carrying content for a dozen more.
- **Root cause is naming drift across the 18 form families.** Only LHMP Template offers all six
  roles (list/cards/view/edit/single_edit/create); 9 families offer three or fewer. Three create
  slugs are advertised (`create`, `create_full`, `create_simple`) and only `create` was built.
  Twelve families moved under `other_forms/` and ~16 links still omit the segment.

### County template 1300890 — 58 pages / 3,859 sections

- All `/admin` references come from **Annotation Cards** driven by one dataset:
  **LHMP_IA, source 1441680**, column `shmp_component_name_location`.
- **10 rows control every county's doors into the panel; 5 are broken** (invented `*_add_new`
  slugs, three also missing `other_forms/`). Fix the dataset once → every county inherits it.
- **48 stale cached snapshots across 30 county pages** still hold pre-correction `*_add_new`
  values (Card sections cache their dataset rows alongside the live query).
- On a live signed-in load of `county_template → The Risk → Flooding`, **no `/admin` anchor
  renders at all** — the location column isn't currently surfaced as a link by the card layout.
  So today the county-side doors are *absent* rather than *broken*; targets must be corrected
  before the link is restored.

### Live behaviour verified (this is why these accumulated)

- A missing admin route **does not 404** — it silently renders the admin Home page.
  Confirmed at `/admin/forms/actions/create_simple`.
- Clicking a dead button in-app changes the URL but not the screen; reload/share lands on Home.
  Confirmed on *Capabilities Edit → CREATE* → `/admin/forms/capabilities/create_full`.
- Relative button paths resolve against the **current URL**, not the route prefix.
  Confirmed: CARDS on `/admin/forms/capabilities` → `/admin/forms/capabilities/card`.
- Tables/edit cards that do surface work: Jurisdictions row menu → `single_edit?id=`;
  Jurisdiction Edit BATCH EDIT → `.../jurisdictions/edit`; County Plan Status EDIT →
  `.../county_status_spreadsheet`.
- `/admin/forms/roles/create` renders on Roles, Roles Edit, Roles View and Roles Single Edit —
  no such page exists.
- **Capacities** is a complete working family (list + edit + create) that is missing from the sidebar.
- High Hazard Dams' parent exposes no edit/create/view control at all.

### Observations recorded but not diagnosed

- `/admin/forms/actions` showed 16,114 rows on the first load of the session and **zero rows on
  three subsequent loads** (including a fresh tab, no filter set). Intermittent — needs a second look.
- County Plan Status renders two identical "Update in Progress · 20" stat cards.
- LHMP_IA row 1468324 points at `https://redesign.devmny.org/edit/…` — a dev host and an edit
  URL shipped as county-facing plan content.

## Phase status

- [x] Phase 1 — harvest admin pattern (74 pages / 1,012 sections)
- [x] Phase 2 — resolve + classify admin-internal links (67 broken definitions → 47/4/2/14)
- [x] Phase 3 — harvest county_template + raw `/admin` sweep (152 hits → LHMP_IA root cause)
- [x] Phase 4 — live browser verification of tables, edit cards and failure modes
- [x] Phase 5 — write `src/themes/mny/design/reports/admin-panel-status.html`
- [x] Phase 6 — cross-link into ds-nav, the README, and the three admin-review reports

## Files

- [x] `src/themes/mny/design/reports/admin-panel-status.html` (new)
- [x] `src/themes/mny/design/ds-nav.js` — added the report to the `reports` section (now 14)
- [x] `src/themes/mny/design/README.md` — documented the new report in the folder tree
- [x] `admin-workflow-current-state.html`, `admin-direction-consolidate.html`,
      `admin-direction-dissolve.html` — footer link to the new report
- [x] `scratchpad/mny-admin-status/` — harvest/check/build/gen scripts + JSON evidence (git-ignored)

## Testing checklist

- [x] Report renders in house style over a local server (`python -m http.server` in `design/`)
- [x] All 18 tables render with expected row counts; 182 live admin links resolve to real URLs
- [x] `ds-nav.js` widget shows the report as entry 14 of the Reports section, marked active
- [x] No horizontal page overflow (document width == scroll width)
- [x] Dark type-header `<code>` contrast fixed (was white-on-white)
- [ ] Not verified: whether the Actions empty-table behaviour is a data issue or a caching artefact

---

## v2 — planner scope, no naming convention, create-as-modal (rev 2026-08-13)

**Ask (two revisions, same deliverable):**
1. Narrow the audit to the panel a county planner uses — the seven families (Actions, Capabilities,
   Hazards of Concern, High Hazard Dams, Participation, Roles, Jurisdictional Annex Entry) plus the
   links on **Home** and **Forms**. Drop everything under **Other Forms**. Ship a tracking CSV.
2. Then: **assume no page naming convention** (names stand as they are; only ask whether a link's
   target exists), and check the **create** decision — CREATE opens a modal on the page, whose add
   button lands on `single_edit` — removing from the fix list any page whose create modal works.

### Deliverables

- [x] `src/themes/mny/design/reports/admin-panel-status-v2.html`
- [x] `src/themes/mny/design/reports/admin-panel-fix-list-v2.csv` — 50 rows, one per fix, same IDs
      as the report; `Status` / `Assigned to` / `Date fixed` / `Notes` left empty
- [x] `ds-nav.js` (entry 15) + design `README.md`

### Method additions this revision

- `reharvest-byid.mjs` — re-fetch pages/sections **by id**. The server reported `length: 0` for
  `mitigat-ny-prod+admin|page` on an unauthenticated read (byIndex empty, byId fine), so `fetchAll`
  could not enumerate the pattern; ids came from the 2026-08-12 harvest. Authenticated reads are
  fine, so this is a permissions artefact, not data loss — but batch reads return `no-access`
  without `DMS_AUTH_TOKEN` (mint per `skills/authenticating-the-dms-cli.md`).
- `harvest-createforms.mjs` — captures what the link sweep cannot see: `display.allowAdddNew`
  (three d's), `addNewBehaviour`, `navigateUrlOnAdd`, `closeModalOnAdd`, and
  `display._functions.providers/subscribers` (the action params). **`navigateUrlOnAdd` is a real
  navigation target that `LINKISH_KEY` never matched** — v1 missed all 47 of them (all resolve).
- `classify-v2.mjs` — the A/B/C/D rule made explicit and re-runnable. Validated: it reproduces v1
  exactly on the 2026-08-12 harvest (A=47 B=4 C=2 D=14).
- `harvest.mjs` — added a by-id fallback when `resolvePattern` can't find the pattern (the admin
  pattern is not listed in the site row's `patterns` array).
- ⚠ Do **not** pass `/admin` as check2.mjs's BASE argument from Git Bash — MSYS rewrites it to
  `C:/Program Files/Git/admin` and only 16 of 201 links resolve. Omit it; the default is correct.

### Scope

29 of 74 pages, 270 published sections, 7 families, 2 hubs. Links *on* Home and Forms stay in scope
even when they point at Other Forms pages. **Capacities moved under `/forms/other_forms/capacities`
on 2026-08-13**, so it is out of scope by the rule now — but the move left **9 newly dead links** on
its own four pages (their cross-links still say `/admin/forms/capacities`). Out of scope, flagged in
the report.

### Findings

| | v1 (all 74) | v2 (planner scope) |
|---|---|---|
| Live dead links | 47 on 27 pages | **19 on 17 pages** |
| — of which the CREATE button | — | **16** |
| Pages nothing reaches | 17 | **1** (`capabilities/view_simple`) |
| Sections never rendering | 23 on 6 pages | **20 on 3 pages** (18 on Home) |
| Stale row-action targets (class B) | 4 | **0** |
| County doors | 5 of 10 work | **5 of 7** in-scope rows work |

- **Four of the seven families render no dead links at all**: Hazards of Concern, High Hazard Dams,
  Participation, Jurisdictional Annex Entry. Participation is also the only family with a real
  `create` page, and its four CREATE links resolve to it correctly.
- Dropping the naming-convention framing removes 20 of the v2's earlier 55 fix items (the renames
  and the repoint-on-rename work). What is left in Capabilities is two links naming pages the family
  does not have: `/capabilities/edit` → `edit_simple`, `/capabilities/single_edit_simple` →
  `single_edit_new`.

### The create decision, as built (the important finding)

- The decided pattern is **already authored on 19 of the 29 in-scope pages**: a section group with
  `isModal: true` + `modalParamKey: 'create'`, holding a 5–7 field add form with
  `addNewBehaviour: 'navigate'` and `navigateUrlOnAdd` pointing at that family's own single-row
  editor. **No create page needs building.** The Jurisdictional Annex Entry page is the reference
  implementation — five modals, one per family, each with `closeModalOnAdd` and a data-refresh
  subscriber.
- **Nothing can open any of them.** A modal opens on an in-memory *action param* published by a Card
  `click_publish` provider. Of the 6 sections in the entire pattern using `click_publish`, all are on
  one Other Forms page and none names `create`. Action params never come from the URL, so
  `?create=1` does nothing — verified live.
- **Why nobody has noticed:** the build on `www.mitigateny.org` predates modal section groups — the
  served bundle contains no `isModal`, `modalParamKey` or `click_publish`. It renders each create
  group as an ordinary band, so the add form sits permanently visible below the table and creating
  rows works. **The next deploy onto a current DMS build activates `isModal` and hides every one of
  those forms behind a modal nothing can open** — so the 5 trigger items (T2-17…T2-21) must ship
  with that deploy, not after it.
- Verified live on `/admin/forms/actions`: CREATE sets the URL to `/admin/forms/actions/create_simple`,
  no modal opens, the screen does not change, and the inline create form stays visible.

### Fix list, v2 rev 2

50 items in 9 types, IDs `T<type>-<nn>`: type 1 ×4 · **type 2 ×21** (16 dead CREATE buttons + 5
triggers) · type 3 ×2 · type 4 ×5 · type 5 ×6 · type 6 ×3 · type 7 ×2 · type 8 ×6 · type 9 ×1.
Order: 3 and 5 first (find-and-replace; 5 clears the only sidebar-reachable dead link), then 2,
then 6 — which surfaces 1 and 4 by restoring the sections hiding them. 7 → 8 on the county side.

### v2 testing checklist

- [x] Renders in house style over `python -m http.server` in `design/` — 19 tables, no `undefined`
- [x] No horizontal page overflow (`scrollWidth == clientWidth`)
- [x] All 9 type blocks render with the item counts above
- [x] CSV: 17 columns, 50 rows, UTF-8 BOM, CRLF, no duplicate fix across types
- [x] Live: CREATE button behaviour and `?create=1` both confirmed on production
- [x] Live: production bundle confirmed to contain no modal/action-param code
- [ ] Not verified (carried from v1): the intermittent empty Actions table

---

## v3 — re-run + four new audit passes (2026-08-14)

**Ask:** re-run the v2 report as v3, same scope (Home, the Forms hub, and Actions, Capabilities,
Hazards of Concern, High Hazard Dams, Participation, Roles, Jurisdictional Annex Entry — everything
under **Other Forms** stays out). Check every link on those pages and every county_template link
that touches the panel; confirm what is fixed and locate what is not. Add: (a) a diagnostic of all
CREATE buttons / create modals for consistency and whether they work; (b) on the Jurisdictional
Annex Entry page, whether every white text box bound to LHMP_IA restricts access to
**LHMP Template Editor**; (c) whether every Card/Spreadsheet on the forms pages is set to fetch mode
**Force (always re-fetch)**; (d) whether county and jurisdiction are carried as **geoid** /
**geoid_juris** from their respective datasets. Plus a to-do list by type and contextual pages/
features/what-a-user-can-do material per data type.

### Deliverables

- [x] `src/themes/mny/design/reports/admin-panel-status-v3.html` (266 KB, 23 tables, no overflow)
- [x] `src/themes/mny/design/reports/admin-panel-fix-list-v3.csv` — 254 rows, 18 columns, incl. a
      `v2 ID` column for traceability; Status / Assigned to / Date fixed / Notes left empty
- [x] `ds-nav.js` (entry 16) + design `README.md`

### Method additions this revision

- `lib-v3.mjs` — shared scope + loaders, so every audit runs off one definition of scope.
- `harvest-full-0814.mjs` — one pass over all 1,023 sections keeping a trimmed but complete picture
  of every data component: `display.fetchMode`/`readyToLoad`, per-column `mapped_options` /
  `meta_lookup`, the source's own schema, filters, `authPermissions`, and lexical button targets.
  Drops the cached row snapshots (29.7 MB of the 30 MB total).
- `audit-fetchmode.mjs` · `audit-geo.mjs` · `audit-permissions.mjs` · `audit-create.mjs` ·
  `audit-noop-buttons.mjs` · `audit-county.mjs` · `audit-pagecontext.mjs` — one script per question.
- `build-v3.mjs` → `report-data-v3.json` → `gen-report-v3.mjs`.
- ⚠ The page index enumerates fine when authenticated — the v2 `length: 0` note was a permissions
  artefact, and `reharvest-byid.mjs` is no longer needed.
- ⚠ `check2.mjs` writes `<harvest>-links2.json`, the same filename `reharvest-byid.mjs` uses. Run
  check2 last (or rename), or the button/lexical detail is overwritten.

### The single most important finding: what the deployed bundle supports

Fetched `index-CQNxZA8R.js` (2,194 KB) from production and searched it per key.
**Present:** `allowAdddNew`, `addNewBehaviour`, `navigateUrlOnAdd`, `readyToLoad`, `usePageFilters`,
`edit-section`. **Absent:** `isModal`, `modalParamKey`, `click_publish`, `add_publish`,
`data_refresh`, `closeModalOnAdd`, `fetchMode`, `requireResolved`, `sectionHasPermissions`.
So the modal groups still render as ordinary bands (create works today, permanently visible), and
`fetchMode` is inert. The next deploy activates both at once. This is the sequencing constraint for
fix types 2, 3 and 5.

### Findings

| | v2 (2026-08-13) | v3 (2026-08-14) |
|---|---|---|
| Pages in scope | 29 of 74 | **27 of 72** |
| Live dead links | 19 on 17 pages | **1** (`participation/view` → `participation/create`) |
| Controls rendering but wired to nothing | not measured | **41** (21 CREATE self-links, 13 annex “Add New …”, 7 other) |
| Create modals / triggers | 19 / 0 | **23 / 0** |
| Sections never rendering | 20 on 3 pages | **20 on 3 pages** (unchanged) |
| County door rows resolving | 5 of 7 in scope | **6 of 10** (1 in-scope row still dead: 1478042) |
| Stale county card snapshots | 48 hits / 30 pages | **6 hits / 1 page** (Flooding Dup 1544397) |

- **v2 verdicts:** T3 and T9 fixed (the page holding them was deleted); T5-01, T7-01 and 15 of the
  16 dead CREATE targets fixed; T1, T4, T6 and the 5 Home items unchanged; T7-02 still open.
- **The CREATE regression.** The dead CREATE targets were *removed*, not rewired: 21 CREATE buttons
  now carry an empty target, which React Router renders as a link to the current page. Verified live
  — `/admin/forms/actions` CREATE has `href="/admin/forms/actions"`. The annex page's 13
  “Add New …” buttons are anchored to `#`. No `click_publish` provider exists in scope, so no modal
  can open once the build supports them.
- **Fetch mode:** 22 of 158 in-scope Card/Spreadsheet components are on Force; 132 have no
  `fetchMode` and 4 are on Smart. 11 are *effectively* Cache (9 of them the record cards on
  `/forms/capabilities/view`).
- **Geo bindings:** 27 component-level deviations (surfacing the free-text `county` / `jurisdiction`
  twin) + 11 dataset-level (5 datasets resolve `geoid_juris` through the legacy
  `477b3e18-…` UUID type; NYS_Dams has neither geoid column; LHMP_IA's `geoid_juris` has no lookup;
  Jurisdictions' `county_geoid` has no lookup; BILD/NFIP name it `jurisdiction_geoid`).
- **Annex permissions:** 8 of 9 LHMP_IA boxes carry
  `{"groups":{"LHMP Template Editor":["*"]}}`; **Progress (2379972 / draft 2334420) carries none**.
  Two Jurisdictions-backed boxes (2379900, 2379937 "Problem Areas") carry the grant when they hold
  county prose. One lexical section (2379948) has an empty permissions object, which
  `sectionMenu.jsx`'s `isEmpty` check treats as no permissions at all. **Caveat that matters:**
  section permissions *merge onto* the pattern's (`utils/auth.js · mergeAuthPermissions`) and gate
  the section's edit chrome, not visibility — and pattern 566466 already grants
  `LHMP Template Editor: ["*"]` plus `AVAIL: ["*"]`. So the grant is documentation, not enforcement,
  unless the other grants are disabled at the section with empty arrays.
- **The empty Actions table is not intermittent.** Carried unresolved from v1 and v2. Loaded three
  ways (bare, `?geoid=36105`, `?geoid_juris=3610534881`): headers render, zero rows, every time —
  while Home reports 61 actions for the same county and the Roles list renders 356 rows normally.
  The Actions spreadsheet filters `county_geoid` on page filter `geoid`, whose stored value is empty
  and which has `useSearchParams: false`. Tracked as T9-01.
- Also live: the button labelled **SEARCH** on `/forms/actions` navigates to `/forms/actions/card`;
  the Forms hub offers 6 family cards and omits the Jurisdictional Annex Entry page; Home renders
  19 of 37 sections and offers **no** link into any family.

### Fix list, v3

254 items in 9 types: 1 ×15 · 2 ×41 · 3 ×9 · 4 ×3 · 5 ×136 · 6 ×27 (+11 dataset-level) · 7 ×4 ·
8 ×4 · 9 ×4. Suggested order: 1 and 9 first (both hit a planner today), 2 and 3 with the deploy that
activates modals, then 4 (which surfaces the rest of type 1), then 5 (also deploy-gated), then 6 and
7, and 8 on the county side last.

### v3 testing checklist

- [x] Renders in house style over `python -m http.server` in `design/` — 23 tables, 190 rows,
      no `undefined` / `NaN` / `[object Object]`, no empty cells
- [x] No horizontal page overflow (`scrollWidth == clientWidth`)
- [x] All 9 type blocks render with the item counts above
- [x] CSV: 18 columns, 254 rows, UTF-8 BOM, CRLF
- [x] Live: bundle capability check, CREATE button hrefs, annex Add-New hrefs, the silent-Home
      fallback, county_template Flooding page (113 links, 0 `/admin` anchors, signed in)
- [ ] Not verified: whether the Actions `geoid` page-filter diagnosis (T9-01) is the whole cause —
      the config evidence is cited, the fix is not proven

---

## v4 — six families, dropped sections quarantined, five focused checks (2026-08-17)

**Ask:** re-run as v4 with a tighter process. (1) Limit QA to Home, Forms, and Actions /
Capabilities / Roles / Participation / Hazards of Concern / Jurisdictional Annex Entry Form, all
children — **High Hazard Dams is out this pass**, and everything under Other Forms stays out.
(2) Produce a list of component IDs for every dropped section and **exclude dropped-section findings
from every other fix type** — the plan is to hand-delete those rows and then fix the delete-section
bug that removes a section but leaves its children. (3) Confirm every component on pages featuring
spreadsheets (list + edit pages) is on Force re-fetch. (4) Same for every component on the
Jurisdictional Annex Entry Page. (5) Confirm the View / Edit actions inside spreadsheets link to the
correct pages.

### Deliverables

- [x] `src/themes/mny/design/reports/admin-panel-status-v4.html` (360 KB, 23 tables, no overflow)
- [x] `src/themes/mny/design/reports/admin-panel-fix-list-v4.csv` — 257 rows, 18 columns, with a
      **Component ID** column so the delete list is directly workable
- [x] `ds-nav.js` (entry 17), design `README.md`, footers of the three admin-review reports

### Method additions this revision

- `lib-v4.mjs` — new scope (6 families) **and** the quarantine: `load()` now returns a `dropped`
  Set and `droppedRows`, computed by comparing each section's `group` against its page's declared
  `section_groups`, for published and draft rows alike. Every v4 audit filters on it.
- `audit-dropped-v4.mjs` — the delete list: per page, per orphan group, published vs draft IDs.
- `audit-fetchmode-v4.mjs` — splits the question three ways (spreadsheet pages / annex page /
  everything else) and only counts components that *have* a fetch mode. The control exists on
  **Card, Spreadsheet and Graph only** — Filter and Map sections are listed as "no control" rather
  than counted as failures.
- `audit-rowactions-v4.mjs` — row actions are columns carrying
  `{actionType:'url'|'delete', name:'View'|'Edit'|'Delete', url}`. Each is judged against **the
  dataset its table reads**, not the page it sits on, so an annex-page Roles table is required to
  send Edit to `/admin/forms/roles/single_edit`.
- `audit-rest-v4.mjs` — links / inert controls / create / geo / permissions, all quarantine-aware.
- `harvest-full-0814.mjs` — `COL_KEEP` extended with `actionType`, `url`, `size` so row actions
  survive the trim (they did not in v3).

### Findings

| | v3 (Aug 14) | v4 (Aug 17) |
|---|---|---|
| Pages in scope | 27 (7 families) | **25 (6 families)** |
| Dead links a user can reach | 1 | **0** |
| Broken link definitions remaining | 15 | **14 — all inside dropped sections** |
| Components to delete (dropped) | 20 published, counted as a fix | **40 (20 published + 20 draft) on 3 pages** |
| Controls rendering but inert | 41 | **42** |
| Spreadsheet row actions correct | not checked | **48 / 48** |
| Fetch mode — spreadsheet pages | — | **12 / 24 on Force** |
| Fetch mode — annex page | — | **1 / 55 on Force** |
| Fetch mode — other in-scope pages | 22/158 (all pages) | **15 / 66** |

- **Zero reachable dead links.** The last one (v3's `/forms/participation/view` → `participation/create`)
  was resolved the same way the other 15 were: the target was emptied, not repointed, so the CREATE
  button is now an inert self-link. All 14 broken definitions that remain are inside dropped sections.
- **The delete list is the lever.** 18 of the 20 published dropped rows are on Home (a Mitigation
  Measures card, a Policies block with two graphs, dashboard rows for Capabilities and Actions); the
  other two are the old button strips on `/forms/capabilities` and `/forms/capabilities/edit_simple`
  in group `4a9d8ef0…`, which hold the relative `card`/`edit`/`create_full` links carried since v2.
  Deleting the 40 rows closes the panel's entire remaining link debt.
- **Fetch mode: the tables are done, the add forms are not.** Every list/batch-edit Spreadsheet in
  scope is now on Force except `/forms/participation/edit`'s (Smart). What is left on those pages is
  almost entirely the **create-modal add form** Card — eleven of the twelve items. The annex page is
  the big one: 1 of 55.
- **Row actions pass cleanly.** All 48 correct, including every cross-family action on the annex page
  and `single_edit_new` for Capabilities. Verified in the DOM: the Roles row menu yields
  `view?id=1504427` and `single_edit?id=1504427`. Four BILD reference tables correctly have none.
  One structural gap: Hazards of Concern tables offer Edit + Delete but no View, because the family
  has no view page.
- **Create is unchanged:** 23 pages carry a modal, 0 can be opened, 6 `click_publish` providers exist
  pattern-wide and all are on one Other Forms page.
- **Annex permissions unchanged in substance, new ids** — the page was republished, so "Progress"
  is now section 2386511 (was 2379972). 8 of 9 LHMP_IA boxes locked, on both draft and published.
- **The bundle has not moved** (`index-CQNxZA8R.js`, 2,194 KB, identical to v3), so `fetchMode` is
  still inert in production: 117 of the 257 items are preparation for the next deploy.

### Fix list, v4

257 items in 9 types: 1 ×40 (delete list) · 2 ×42 · 3 ×30 · 4 ×12 · 5 ×54 · 6 ×51 · 7 ×20 · 8 ×4 ·
9 ×4. Order: **1 alone first** (it shrinks every other list), then 9, then 4 + 5 + 2 + 3 with the
deploy that activates `fetchMode` and modals, then 6, 7, 8.

### v4 testing checklist

- [x] Renders in house style over `python -m http.server` in `design/` — 23 tables, 264 rows, no
      `undefined` / `NaN`, no empty cells, no horizontal overflow
- [x] Delete-list ID blocks contain 40 / 20 / 20 ids and are selectable
- [x] CSV: 18 columns, 257 rows, Component ID populated for all 40 type-1 rows
- [x] Live: bundle re-check, Roles row menu targets, Roles CREATE inert self-link, Actions list
      still zero rows
- [ ] Not verified: the Actions empty-list cause (T9-001) — config evidence cited, not proven
- [ ] Not re-checked this pass: county_template (audited in v3; LHMP_IA row 1478042 still open)

### v4 rev 2 — two client directions (same day)

**Ask:** (a) the create modals work properly as currently configured — stop tracking them as
problems. (b) Re-check the spreadsheet-page fetch modes, confirm the review covers only the admin
sections under `forms` and **not** under `other_forms`, and produce a list of components by page with
their current setting — force re-fetch / smart fetch / none / no setting selected. **Force and Smart
are both acceptable.** Same treatment for the Jurisdictional Annex Entry Page.

**What changed in the report**

- **Create retired.** The create-modal type (30 items) is gone from the fix list, replaced by a
  documented "create mechanism, accepted as configured" section. The retirement was extended to the
  22 empty-target CREATE buttons and the 13 annex "Add New …" buttons — the trigger half of the same
  mechanism — and that reading is stated in the report so it can be reversed. The remaining 7
  anchor-only controls turned out to be the *active* member of each LIST / SEARCH toggle pair, which
  is correct behaviour. **72 items retired in total.**
- **Fetch mode became an inventory** (`audit-fetchmode-v4b.mjs`), four-way: `force` / `smart` /
  `cache` / unset, reporting the stored setting **and** the resolved behaviour, because with no
  setting the loader falls back to `readyToLoad === true ? 'smart' : 'cache'` — invisible in the UI.
  Acceptability is judged on the resolved value.
- **Scope exclusion asserted in code**, not assumed: the script exits non-zero if any
  `other_forms` page reaches the inventory. All 25 pages examined are `/admin/home` or under
  `/admin/forms`.

**Findings under the revised rule**

| | components | force | smart | cache | no setting | acceptable |
|---|---|---|---|---|---|---|
| Spreadsheet pages (11) | 24 | 12 | 1 | 0 | 11 | **24 / 24** |
| Jurisdictional Annex Entry Page | 55 | 1 | 1 | 0 | 53 | **55 / 55** |
| Other in-scope pages (13) | 66 | 15 | 0 | 0 | 51 | 57 / 66 |

- **Nothing in scope stores `cache`.** Both asked-about page sets pass: every unset component on them
  carries `readyToLoad: true` and resolves to Smart.
- **The one real defect: 9 record cards on `/forms/capabilities/view`** — unset *and* no
  `readyToLoad`, so they resolve to Cache and never re-query. That page has no spreadsheet, so it sat
  outside both asks; reported anyway as type 2.
- 64 of the 79 components on the two asked-about page sets rely on the invisible fallback rather than
  an explicit setting — hygiene worth doing, not a defect.

**Fix list, v4 rev 2:** 77 items in 5 types — 1 ×40 (delete list) · 2 ×9 (never re-queries) ·
3 ×20 (geoid bindings) · 4 ×4 (annex permissions) · 5 ×4 (live behaviour). Down from 257.

**New deliverable:** `admin-panel-fetchmode-v4.csv` — 145 rows, one per fetch-mode-capable component,
with page / dataset / stored setting / readyToLoad / resolved behaviour / acceptable / in-create-modal.

- [x] Re-verified over `python -m http.server`: 31 tables, 244 rows, no `undefined`, no overflow,
      15 tables in the fetch-mode inventory section

### v4 rev 3 — re-harvest after the capabilities/view fix (2026-08-17)

**Ask:** the `/forms/capabilities/view` cards were updated to re-fetch; account for it.

**Verified by diffing a fresh harvest against the pre-fix snapshot** (`sections-full-0817-prefix.json`):

- The page was **republished**, so its published rows were replaced: 2380128–2380140 → 2388820–2388832.
  Ten of the eleven new Cards carry `fetchMode: 'smart'` explicitly; the eleventh (2388832, the
  create-modal add form) is unset but carries `readyToLoad: true`, so it resolves to Smart.
- The ten **draft** rows (2262526, 2262668, 2262686-8, 2262697, 2262749/50, 2262754, 2262761) were also
  updated unset → `smart`, nine of them moving effective cache → smart. Draft and published now agree.
- `/forms/capabilities` and `/forms/capabilities/edit_simple` were republished in the same pass
  (2386863–2386867 → 2388984–2388988); the new list Spreadsheet 2388985 is on `force`.

**Result: fix type 2 is closed.** Group C went from 57/66 to **66/66 acceptable**, so across the whole
scope **145 of 145 fetch-mode-capable components now re-query** — 28 Force, 12 Smart, 105 unset-but-
resolving-to-Smart (every one of those carries `readyToLoad: true`). Nothing resolves to Cache.

**⚠ Delete-list ID drift.** Republishing mints new published component rows, so an orphan's id moves.
The `/forms/capabilities` orphan was **2386865** in rev 1/2 and is **2388986** after this fix — the old
id no longer exists. The report now carries a red callout saying so and telling the reader to
re-generate the list rather than work from a copy if more publishing happens before the deletion runs.
The other 39 ids are unchanged; the count is still 40 (20 published + 20 draft).

**Unchanged:** 0 reachable dead links, 48/48 row actions, 40-row delete list, 20 geoid bindings,
4 annex permission items, 4 live-behaviour items. Annex permissions still 8/9 with "Progress" (2386511)
the gap.

**Fix list, v4 rev 3:** 68 items — type 1 ×40 · type 2 **closed** · type 3 ×20 · type 4 ×4 · type 5 ×4.
Type numbers are held stable across revisions so an already-issued fix ID keeps its meaning; a closed
type renders as a green "closed" block rather than being renumbered away.

- [x] Re-verified over `python -m http.server`: 30 tables, 235 rows, no `undefined`, no overflow,
      type 2 renders as closed
