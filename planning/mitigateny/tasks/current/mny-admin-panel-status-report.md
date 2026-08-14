# MNY Admin Panel status report (pattern 566466) + county_template link audit (1300890)

**Project:** MitigateNY · **Topic:** content · **Status:** DONE (v1 + v2) · **Started:** 2026-08-12 · **Completed:** 2026-08-13

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
