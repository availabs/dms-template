# MNY Admin Panel Redesign — Design Mockups

**Project:** MitigateNY · **Topic:** themes · **Status:** ON HOLD (2026-08-06) — Phase 1 DONE,
Phase 2+ blocked on the direction decision in
[`mny-admin-panel-directions.md`](./mny-admin-panel-directions.md) · **Started:** 2026-07-29

> **2026-08-06 — framing superseded a second time.** A full current-state analysis (admin pattern
> vs county template/drafts/guide/actions, live pull) produced a three-report series in
> `src/themes/mny/design/reports/` (`admin-workflow-current-state.html`,
> `admin-direction-consolidate.html`, `admin-direction-dissolve.html`). This task's "collapse
> within the panel" plan survives as **Direction A**; the recommended direction (**B1**) moves all
> six planner forms into the plan experience and reduces `/admin` to a slim DHSES console. Do not
> build Phase 2+ here until the owner picks a direction.

## Objective

Redesign the MNY "admin panel" (live DMS pattern `566466`, app `mitigat-ny-prod`,
type `prod|admin:pattern`, `base_url: /admin`) as a set of DMS-shaped HTML design
mockups under `src/themes/mny/design/pages/`.

**⚠ Superseded framing, kept for history**: Phase 1 was built as three
audience-tiered page groups — **State**, **County**, **Jurisdiction** —
each with a full 5-page ecosystem (dashboard · spreadsheet · view · edit ·
create) per dataset. A later assessment (see "Tiers are roles, not pages"
below) concluded this tier-duplication was the wrong axis: tiers should be
a role/scope within ONE page per page-type, not three separate files.
Phase 1's 15 files are left as-is (not yet consolidated); **Phase 2+
should build directly in the collapsed shape** — see that section for the
current target.

Datasets in scope: **Actions, Capabilities, Hazards of Concern, High Hazard
Dams, Participation, Capacities, Roles**.

This is a **design-mockup deliverable only** (plain HTML + Tailwind CDN, per
`src/dms/skills/designing-a-dms-design-system.md`) — not a live DMS build.
Do not overwrite any existing file in `src/themes/mny/design/pages/`.

## Current state (as-is), discovered via live CLI query 2026-07-29

The DMS CLI (`src/dms/packages/dms/cli`) hangs indefinitely in this sandbox
(process never exits after the response resolves — looks like an open
keep-alive socket, not a real server issue; direct `fetch()` calls to
`/graph` work fine and return quickly). Ad-hoc query scripts were used
instead — see the worked pattern in `scratchpad/` history for this session
if this needs to be redone (a minimal Falcor POST to `{host}/graph` with
`method=get&paths=...`).

Auth: dev credentials (`availabs@gmail.com`/`test123`) against
`https://dmsserver.availabs.org/login` with `project: "mitigat-ny-prod"` mint
a valid token (authLevel 10, groups `AVAIL`+`LHMP Template Editor`) — this is
a live production system the user explicitly authorized querying with these
credentials.

Pattern 566466's `Forms` hub (page id `1336681`) has one subtree per dataset,
each with an inconsistent, organically-grown page set — this sprawl is
exactly what the redesign should clean up:

| Dataset | Live page id | Existing pages today | Gaps vs. target 5-page ecosystem |
|---|---|---|---|
| Actions | 1686109 | list_search / list_search_old / card_search, card, view, single_edit ×3 variants, edit/edit_simple (a **Spreadsheet** bulk-editor), create ×3 variants | none missing, but 5+ redundant variants per page-type |
| Capabilities | 1690288 | card, view/view_simple, single_edit ×3, edit/edit_simple, create_full/create_simple | same redundancy |
| Hazards of Concern | 1444290 | create, edit, single_edit | no dashboard/list, no view |
| High Hazard Dams | 1444479 | single_edit only | no dashboard, no spreadsheet, no view, **no create (confirmed intentional — see Decisions)** |
| Participation | 1444280 | single_edit, edit, create, view | no dashboard/list |
| Capacities | 1923305 | create, single_edit, edit | no view, no dashboard/list |
| Roles | 1444244 | single_edit, view, edit, create | no dashboard/list |

Real field grounding — pulled the live Actions "edit" page (id `1686224`,
element-type `Spreadsheet`, bound to source `Actions_Revised`, ~90 columns).
Notable fields: `geoid_juris`, `county_geoid` (geography scoping — confirms
tiering is already a first-class concept in the data, just not surfaced as
separate page tiers), `dhses_comments`, `fema_comments`, `approvable` (a
state-level QA/approval workflow already exists in the data model).

The existing design mockups `actions-workspace.html` / `action-view.html` /
`action-edit.html` / `actions-by-jurisdiction.html` (built earlier against a
*different* live pattern, 2265530, the public county-template site — see
each file's "ECOSYSTEM NOTE" header comment) are, per the user, the closest
existing precedent to what the **Jurisdiction** tier of the new admin-panel
Actions ecosystem should look like. Adapt their visual language/section
grouping into new files under the admin-panel naming scheme — do not edit
the originals.

The 7-section field grouping already proven in `action-edit.html` /
`action-view.html` (Summary, Action Information, Status & Prioritization,
Cost & Timeframe, Location, Hazards & Risk Environment, Additional Details)
is the condensation to reuse for Actions edit/view/create pages at all 3
tiers. **State tier adds an 8th section** — "State Review" — surfacing
`dhses_comments`, `fema_comments`, `approvable` (fields that exist in the
live data but aren't surfaced in any tier-agnostic mockup yet).

## Decisions locked in with the user (2026-07-29)

1. **Applicability**: mostly all 7 datasets need the full ecosystem at all 3
   tiers. Exception: **High Hazard Dams has no create-new page at any tier**
   (matches the live data — HHD rows are a fixed reference set).
2. **Actions ecosystem relationship**: reuse the existing
   `actions-workspace.html` ecosystem's visual language as the basis for the
   **Jurisdiction** tier (adapted into new files, originals untouched).
3. **Tiering meaning**: not yet fully specified beyond geography scope +
   the state QA fields found in the data — refine per-dataset as each is
   built; default assumption is state=statewide rollup + QA, county=county
   rollup, jurisdiction=single municipality, unless a dataset's real fields
   suggest otherwise.
4. **State-tier create**: **yes** — state can create records too (all 3
   tiers get the full 5-page ecosystem for Actions).
5. **Jurisdiction dashboard/spreadsheet split**: split into two separate
   pages (matching County/State) for now, **may be re-merged into one page
   later** — keep the split changes easy to collapse back if that happens.
6. **File naming**: `admin-{tier}-{dataset}-{pagetype}.html`, e.g.
   `admin-county-capabilities-dashboard.html`,
   `admin-state-actions-spreadsheet.html`.
7. **Phasing**: build **one dataset (Actions) fully across all 3 tiers
   first**, review, then replicate the pattern to the other 6 datasets.

## Per-dataset ecosystem shape — locked in with the user (2026-07-29, second pass)

Prompted by the user's explicit ask to assess each dataset's ecosystem
*independently* rather than assume the uniform 5-page shape. Real field
data pulled live from each dataset's edit/single_edit page (see table
below); decisions confirmed with the user question-by-question. **This
supersedes the "mostly all 7 need the full ecosystem" line in decision #1
above** — the shape below is the actual target for Phase 2+.

| Dataset | Dash. | Sheet | View | Edit | Create | Live source (page id, cols) | Why |
|---|---|---|---|---|---|---|---|
| Actions | ✓ | ✓ | ✓ | ✓ | ✓ | `Actions_Revised` (1686224, ~90) | Shipped Phase 1. High volume, per-jurisdiction. |
| Capabilities | ✓ | ✓ | ✓ | ✓ | ✓ | (1696938, 84 cols, **no geoid field**) | Kept 3-tiered for UI consistency even though it's actually a centrally-maintained statewide catalog — see `capacity-assessment-architecture.md` / the existing `capacity-assessment-architecture.html` report, which already established Capability≠Capacity. |
| Hazards of Concern | ✓ | ✓ | ✓ | ✓ | ✓ | `Hazards_of_Concern` (1702741, 25) | Dense ~16-hazard-per-jurisdiction grid. Spreadsheet is the primary bulk-fill workflow; Create adds "Other" hazard rows; user explicitly asked for the full set (dashboard/view/edit/create confirmed, spreadsheet confirmed in follow-up). |
| High Hazard Dams | ✓ | ✓ | ✓ | ✓ | **—** | (1444469, 6 Card sections incl. a hand-repeated `hhpd_1..4` sub-record) | **4-page ecosystem, no Create at any tier** — fixed state-owned registry. County/Jurisdiction get Edit to add local context (not to add/remove dams). All 3 tiers get Spreadsheet (state bulk-corrects; county/jurisdiction bulk-annotates). |
| Participation | ✓ | ✓ | ✓ | ✓ | ✓ | (1714399, 16 cols) | One row per meeting/event, created as meetings occur. Spreadsheet most useful for County/State rollup review. |
| **Capacities** | **—** | **—** | **—** | **—** | **—** | `Capacities V2` (1923342, 15 cols) | **Deferred — do not build.** User: "likely getting scrapped and incorporated into Capabilities." Revisit once that merge is decided; don't build a placeholder. |
| Roles | ✓ | ✓ | ✓ | ✓ | ✓ | `Roles` (1715553, 20 cols) | One row per stakeholder/contact, maintained on an ongoing basis. |

~~Net target once all phases complete: 87 pages across 6 active datasets
(5 datasets × 5 page-types + High Hazard Dams × 4 page-types, all × 3
tiers)~~ — **superseded, see "Tiers are roles, not pages" below.**

**Auth note**: token minted 2026-07-29 for this second pass — same
`/login` flow, dev credentials, `project: "mitigat-ny-prod"`. Tokens expire
~6h; re-mint if resuming this task later.

## Tiers are roles, not pages — locked in with the user (2026-07-29, third pass)

The user asked directly: "assess this holistically and understand if this
admin system SHOULD be split into geographic tiers with duplicative pages
… What pages can be collapsed (i.e. right now the single view and edit
pages can be the same one for all levels of jurisdictions)." Assessed and
confirmed: **yes, collapse — the tier split from decisions #1-7 above was
the wrong axis.**

**Evidence against tier-duplicated pages:**
1. Pattern 566466's own `authPermissions` already gate by group (`AVAIL`,
   `DHSES`, `LHMP Admin Group`, …), and the minted session token carried
   per-user geography (`"meta":{"geography":{"county_codes":["36001"]}}`
   on the `AVAIL` group). Who-sees-what is already a login-time /
   session concern in this platform — not something a page needs to
   encode.
2. `actions-database.html`'s own build note (already in this repo):
   the live page is "filtered to SULLIVAN COUNTY (page param
   `county=36105`)... County scope is set at the SITE level by the page
   filter param, so there is no county selector — the page is a filtered
   template." One template, many counties, via a param — the platform's
   existing, proven convention for exactly this problem.
3. A record's fields don't change shape depending on who's viewing it. An
   Action is the same Action whether a jurisdiction clerk, county
   planner, or state reviewer opens it — only (a) which records they may
   see, and (b) whether role-gated sections (State Review) are
   visible/editable, differ. Neither requires a different page.

**What collapses to ONE page per page-type per dataset:**
- **View / Edit / Create** — record shape never changes by role.
- **Dashboard / Spreadsheet** — row *scope* changes by role/geography;
  the page itself doesn't.

**What stays role-gated *within* that one page** (not a reason to fork it):
- Which records are visible (geography/role filter).
- Extra columns (Jurisdiction, County) for broader-scope roles.
- The State Review section; a jurisdiction/county picker field on Create
  that's open for state-role users, pre-filled+hidden for jurisdiction-role
  users.
- Aggregate/rollup sections (e.g. actions-by-county) — simply empty for
  narrow-scope roles, not a reason to fork the page.

**For static design mockups** (no real auth yet), the honest way to show
this is ONE file per page-type with an in-page **"Viewing as: [Jurisdiction
/ County / State]"** JS toggle that shows/hides the role-gated bits live —
not three separate HTML files.

**New net target: 29 pages** across 6 active datasets (5 datasets × 5
page-types + High Hazard Dams × 4 page-types — no tier multiplier),
Capacities excluded. Down from 112 live pages today and from the
previous (superseded) 87-page tiered target.

**Disposition of already-built work (user decision, 2026-07-29):**
"Update the report only, hold off on rebuilding." The 15 Phase-1 Actions
pages under `src/themes/mny/design/pages/admin-{jurisdiction,county,state}-actions-*.html`
are **left as-is for now** — valuable field/section exploration, but not
the target shape. Consolidating them to 5 role-adaptive pages is an
**open follow-up**, not yet scheduled. **Phase 2+ (the other 5 active
datasets) should be built directly in the collapsed 5-page shape from the
start** — do not repeat the tier-duplication pattern for them.

## Scope — Phase 1 (Actions, all 3 tiers)

15 new files under `src/themes/mny/design/pages/`:

```
admin-jurisdiction-actions-dashboard.html
admin-jurisdiction-actions-spreadsheet.html
admin-jurisdiction-actions-view.html
admin-jurisdiction-actions-edit.html
admin-jurisdiction-actions-create.html

admin-county-actions-dashboard.html
admin-county-actions-spreadsheet.html
admin-county-actions-view.html
admin-county-actions-edit.html
admin-county-actions-create.html

admin-state-actions-dashboard.html
admin-state-actions-spreadsheet.html
admin-state-actions-view.html
admin-state-actions-edit.html
admin-state-actions-create.html
```

Each page:
- Plain HTML + Tailwind CDN + `../theme/index.css.additions`, mny brand
  tokens (see `src/themes/mny/design/README.md`), no build step.
- DMS-shaped: `data-dms="layout"` / `layoutGroup` / `section` structure per
  `src/dms/skills/designing-a-dms-design-system.md`.
- TopNav shows product nav (not the design-system nav) since these are
  `pages/` examples, not `design-system/` docs pages.
- Floating nav widget (bottom-right) + footer link block, listing at least
  all 15 Phase-1 pages (per §7.0 of the design-system skill) — update as
  more datasets are added in later phases.
- A **tier switcher** in the page header (links to the equivalent page at
  the other 2 tiers) alongside the usual page-type ecosystem links.

## Phase plan

- [x] `admin-jurisdiction-actions-dashboard.html` built directly (reference
  template for the other 14 pages)
- [x] **Phase 1a — Jurisdiction tier** (remaining 4 pages — spreadsheet,
  view, edit, create) — DONE, built by background agent
- [x] **Phase 1b — County tier** (5 pages) — DONE, built by background
  agent; adds a Jurisdiction filter/column, dashboard rolled up to 132
  actions across 8 jurisdictions
- [x] **Phase 1c — State tier** (5 pages) — DONE, built by background
  agent; adds a County filter/column + the 8th "State Review" section
  (approvable / dhses_comments / fema_comments — real live fields),
  accent-styled, editable on edit/create, read-only on view
- [x] **Phase 1 verify — DONE (2026-07-29).** Confirmed via `git status`
  that all 15 files are new/untracked and no existing file was modified.
  Confirmed via automated filename cross-check that every one of the 15
  files' internal links (tier switcher, inline buttons, floating nav
  widget, footer block) resolves to one of the 15 real filenames with
  zero typos. Spot-checked in browser: jurisdiction dashboard, county
  dashboard (rollup differentiation correct), state view (State Review
  section renders correctly, read-only). All render on-brand and
  consistent with the existing mny design tokens.
- [ ] **Phase 1 review** — awaiting human review before replicating to
  other 6 datasets
- [x] **IA report — DONE (2026-07-29).**
  `src/themes/mny/design/reports/admin-panel-information-architecture.html`
  built (new report page, `reports/` series conventions), documenting the
  as-is sprawl, the per-dataset ecosystem shapes above, and Phase 1 status.
  Live field data for the 6 non-Actions datasets was pulled during this
  pass (see table above) specifically to ground this report and the
  per-dataset decisions — reuse it directly for Phase 2+, no need to
  re-query.
- [ ] **Phase 2+** — Capabilities, Hazards of Concern, High Hazard Dams,
  Participation, Roles (Capacities deferred, see decision table above).
  Not yet started. **Do NOT repeat Phase 1's tier-duplication pattern** —
  build each dataset as 5 role-adaptive pages (4 for High Hazard Dams),
  one file per page-type with an in-page "Viewing as" role toggle, per
  "Tiers are roles, not pages" above. Field lists already pulled above;
  no need to re-query the live server.
- [ ] **Consolidate Phase 1** — collapse the 15 built Actions pages into 5
  role-adaptive pages (matching whatever pattern Phase 2 establishes).
  Explicitly deferred by the user 2026-07-29 ("update the report only,
  hold off on rebuilding") — not scheduled, but should happen once Phase
  2's collapsed shape is proven out, so Actions doesn't stay the odd one
  out.

## Missing-pages assessment — locked in with the user (2026-07-29, fourth pass)

User asked directly: "are there pages in the ecosystem that are clearly
missing?" Assessed against the full live page tree (112 pages) already
pulled. Found four gaps, of increasing scope:

1. **Jurisdictions has no ecosystem.** Live `forms/jurisdictions` (page
   1439493) has only `edit`/`single_edit` — no dashboard, view, or create
   — despite every one of our 6 active datasets scoping by
   `geoid_juris`/`county_geoid`. **Not added to scope** (user didn't ask
   for it this pass) — flagged for a future decision.
2. **No Admin Panel home/landing page.** Nothing indexes the active
   datasets — the only entry point was the flat live `Forms` hub (the
   sprawl this whole redesign is fixing). **Added — see below.**
3. **No bulk import/upload page.** The legacy `Actions (old)` tree has an
   `Action Upload` page (`forms/actions_old/action_upload`) with no
   analog in the redesign; Spreadsheet covers bulk-*editing* existing rows,
   not importing a new batch (relevant since Actions/Capabilities data is
   periodically refreshed via CSV per the existing capability reports).
   **Not added to scope** — flagged only.
4. **Cross-dataset plan-status rollup exists live but was scoped out.**
   `Other Forms` → `County Plan Status Dashboard` / `Jurisdictional Entry
   Page` (pages 954242, 1443103, 2334433) roll up *across all datasets*
   for one jurisdiction/county — arguably closer to what a County/State
   role wants to see first than any single dataset's dashboard. **Not
   added to scope** — user chose to leave this cut, only requested the
   landing page.

**User's decision: build only #2 (the landing page).** #1, #3, #4 are
documented above as known open questions, not scheduled.

### Admin Panel Home — DONE (2026-07-29)

New file: `src/themes/mny/design/pages/admin-home.html`. Tier-agnostic
(no tier switcher — it's the front door before a role is chosen). Card
grid of all 6 active datasets: Actions marked "Live (Phase 1)" with real
links to its Jurisdiction/County/State dashboards; the other 5 marked
"Not yet built" with disabled-style CTAs; Capacities shown separately in
a de-emphasized dashed-border row with a link to the report's rationale.
Links to the IA report and vice versa. Verified visually in-browser.

### IA sitemap — DONE (2026-07-29)

Added a "Full Information Architecture — Every Page" section to
`reports/admin-panel-information-architecture.html`: a nested bulleted
list of all 30 target pages (Admin Panel Home + 5 datasets × 5 page-types
+ High Hazard Dams × 4, Capacities shown deferred with no pages), amber
dot = live today, gray dot = planned. Updated stat strip (30, not 29),
recommendation callout, and source citation to reference the new home
page. Verified visually in-browser.

## Files requiring changes

- New files under `src/themes/mny/design/pages/` (see Scope above),
  **plus** `src/themes/mny/design/pages/admin-home.html` (new, this pass).
  No existing files under `pages/` are modified.
- `src/themes/mny/design/reports/admin-panel-information-architecture.html`
  (new file, substantially revised across this session's turns). Does
  **not** modify the other reports' nav widgets (unlike the precedent set
  by the capability/capacity report series) — kept one-way-linking to
  minimize footprint; revisit if full cross-linking is wanted later.
