# MNY Admin Panel — current-state analysis & direction reports

**Project:** MitigateNY · **Topic:** themes · **Status:** ANALYSIS + REPORTS DONE (2026-08-06) —
awaiting owner direction decision · **Started:** 2026-08-06

## Objective

Step back from the July "clean up the admin panel" framing and answer the bigger IA question:
the admin pattern (`566466`, `prod|admin:pattern`, `/admin`) predates the county-draft workflow
and sits outside it — should planner-facing data entry live there at all? Deliver (owner ask,
2026-08-06): a current-state report and **at least two directions** — one a cleanup of the current
system, one moving most/all of it into the county template — as mny design-system HTML reports,
with non-technical planners' experience front of mind (including teaching the "datasets vs
planning content" concept). Mid-task addition: whatever the next admin becomes must include a
**plan-status page** (and possibly a landing-page status overview) showing everything that needs
filling out and its fill state.

## Deliverables (all shipped 2026-08-06)

Three-report series in `src/themes/mny/design/reports/` (mny report conventions, cross-linked,
one-way links only — no existing report was edited):

1. **`admin-workflow-current-state.html`** — the evidence report: what the 112-page panel
   contains, which of its datasets the county template actually binds, every measured route
   between plan/guide/admin (including the broken ones), the two-paradigms UX narrative, the
   missing status page, and an A/B1/B2 directions comparison.
2. **`admin-direction-consolidate.html`** — Direction A: keep `/admin`, consolidate 112 → ~31
   role-adaptive task-named pages (adopts the July collapse), NEW Plan-Status landing, seam
   repairs (Add-Data rows, guide package, Back-to-Plan cards), cleanup ledger, honest limits.
3. **`admin-direction-dissolve.html`** — Direction B (**recommended: B1**): all six planner forms
   move into the plan experience following the county-actions precedent; page-by-page move table;
   the shared-pattern architecture call (form surfaces on `subdomain:*` patterns → no clone
   drift); B1 slim DHSES console (~12 pages) vs B2 full retirement; costs and build order.

Working data/context (git-ignored): **`references/admin IA/`** — CLAUDE.md (access + folder map),
`findings.md` (the fact ledger — every report number with derivation), full 2026-08-06 pulls of
all 7 patterns (pages + sections), scripts (`pull_all.mjs`, `analyze.mjs`, `adminlinks.mjs`,
`page_text.mjs`, `dmscli.sh`), and five research summaries (admin, template+drafts, guide,
datasets, actions/mockups).

## Headline findings (full ledger in `references/admin IA/findings.md`)

- **The workflow moved; the panel didn't.** Admin created 2024-08-26; County Template V2
  2025-05-29; real drafts 2026 (Suffolk 163 annotation slots drafted / Schenectady 55 /
  Westchester 54 — all in-plan). Chapters link to `/guide`, never `/admin`.
- **Panel contents:** 112 pages, 98 under Forms; 78 hidden from nav; 33% duplicate/legacy/archived;
  dev-facing names (`single_edit_simple`, `list_search_old`); 4 mis-bound edit pages; newest work
  (Jurisdictional Entry "w Modals", 2026-07-27) is a deep copy of a page that mirrors the
  template's own annex page.
- **Dataset matrix:** planner-needed six = Actions_Revised (18,382 rows, the only mandatory +
  statewide-scale dataset), Capabilities_Catalogue (269, Chemung pilot), Hazards_of_Concern (119,
  Chemung), Participation (216), Roles (144), NYS_Dams (annotate-only). State catalogs the plan
  reads: LHMP_IA (1,043 template sections!), Jurisdictions, Mitigation_Measures, R_and_V_Matrix,
  DHSES_County_Database, Funding_Sources. Admin-only orphans: Policy Database, Content_Resources
  (×3 sources), Capacities v1/V2, SHMP_Narrative, 4 mis-bound shells. **Live divergence:** the
  template displays Capabilities_Catalogue while Sullivan actively fills Capacities V2 — schema
  decision is the standing blocker for any capabilities build.
- **The plan's doors into admin are dataset rows, and they're dead:** the "Add Data" cards are
  LHMP_IA rows (column `shmp_component_name_location`); 7 of 10 point at `*_add_new` pages that
  no longer exist; 3 were repaired but template Card sections still render stale cached URLs
  (~58 sections/county). One-row fixes propagate to every county — cheapest win available.
- **Guide:** Tasks 1–8 contain zero working hyperlinks; 59/122 links broken; the six form cards
  under "Click below" carry no links; only Actions has a how-to; Data Management branch is empty;
  five unreconciled names for the forms-data concept.
- **Env hygiene:** everything lives in `test_meta_forms_env`; 28/51 sources are test junk.
- **Clone drift is real** (frozen 71-section annex snapshots vs the template's 91; Sullivan
  geoids hardcoded in every draft's Home) → Direction B's form surfaces should be shared
  `subdomain:*` patterns (the `/actions` model), not cloned pages.

## Addendum 2026-08-07 — sitemap visualizations added to both direction reports

Per owner request, both direction reports now end with a three-map visualization section
(consolidate: "Section 06 — The two sites, page by page"; dissolve: "Section 05 — One site,
page by page"):

- **Map 1 — the county plan site**, drawn from the live template pull: the 39 public pages + 4
  by-link working pages (43 of the template's 58; the other 15 are hidden
  workbench/sandbox/superseded pages + 1 orphan) in nav structure (Home & chrome / Local Environment / The Risk / The Plan /
  Track Progress), every page tagged with chips for the data it displays (amber = county-entered
  form data, steel = state catalog, "+N ext" = external risk library). Hidden workbench/sandbox
  pages and the orphaned Response page are omitted (stated in the caption). In the dissolve
  report, Map 1 additionally embeds Direction B's entry surfaces in place (amber-bordered NEW
  nodes with "shared" tags: county-actions flow, HoC worklist + per-chapter entry bands,
  capabilities workspace, Roles/Participation worklists, dams annotate-in-place, Plan Status).
- **Map 2 — the proposed admin**: consolidate shows all ~34 remaining pages with was→now badges
  (Actions "was 23" → 5, etc.) + the retired-~78 box; dissolve shows the 5-box B1 DHSES console.
- **Map 3 — linkage/change lanes**: consolidate maps entry page ▶ dataset ▶ plan display pages
  with a per-lane "Change:" note; dissolve maps every one of today's 112 admin pages ▶ its
  Direction B destination (or archived/deleted).

Rendered checks: Playwright at 1440px, screenshots in session scratchpad; all relative links
re-verified.

## Open items / next steps

- [ ] **Owner decision: direction** (A / B1 / B2). Recommendation in the series: **B1**, with the
  four no-regret moves now regardless: repair the 7 LHMP_IA Add-Data rows (+ refresh cached
  sections), guide link sweep, archive the legacy/dup trees, decide Capabilities-vs-Capacities.
- [x] **Plan Status page mockup — DONE 2026-08-07**, both directions, under a new "LHMP Admin"
  design category `src/themes/mny/design/pages/lhmp-admin/`:
  `plan-status-admin.html` (admin-panel chrome — Direction A's landing; reworked 2026-08-07 to
  wear the LIVE mny_admin chrome after owner feedback: compact fixed 64px icon sidenav with
  Logo-top/UserMenu-bottom and a CSS hover flyout for Forms, page content as one full-width white
  card — rail/flyout/pageWrapper class strings quoted verbatim from
  `src/themes/mny/admin.theme.js` sidenav style "mny-compact" so the translation skill can
  round-trip them; no top nav) and
  `plan-status-plan.html` (county-plan chrome under Track Progress — Direction B; adds the
  "How saving works" records-vs-page-text strip; gap links stay in-plan, Actions links go to the
  county-actions mockups). Same four bands in both: plan record (real DHSES row — Sullivan's plan
  EXPIRED 4/27/2026, update funded 11/26/2024), narrative completeness by chapter (10/267 slots;
  Local Env 34 · Risk 195 · Plan 30 · Home 6 · Track 2), form coverage vs the guide's rules
  (Actions 475 strong / HoC 0-of-368 "start here" blocker / Capacities V2 320 schema-pending /
  Participation 27 / Roles 111 / Dams annotate-only), required components (LHMP_IA mny_required
  42 Required by chapter: Plan 19 · Annexes 10 · Local Env 8 · Risk 5; honest banner:
  cfr_requirement_number empty on all 529 rows), and a Tasks 1–8 position stepper with derived
  states. All numbers real (pulled 2026-08-06/07); provenance in each file's header comment.
  Registered as the "LHMP Admin" section in `ds-nav.js`. Both direction reports now link the
  mockups (centerpiece band, phase-1 cards, dissolve Map 1 node). ALSO fixed same day: the three
  review reports now use the shared `ds-nav.js` widget instead of hand-rolled panels, and
  ds-nav's Reports section was completed (5 → all 13 reports listed).

  **Expanded 2026-08-07 (owner feedback: "too shallow — expand the plan narrative"):** the
  chapter-meter band became a full-width **task-ordered writing plan** on both versions — six
  numbered groups mapped to the guide's Tasks 1–6, per-page rows with meters + named-slot chips
  (Task 1 shows About the Process's full 13-slot checklist), a **16×11 hazard-slot matrix**
  summarizing the 174 hazard-chapter slots (dashed cells mark real template inconsistencies:
  Wind/Snowstorm lack Local Hazard Summary, Extreme Cold lacks Local Actions; Flooding carries
  the one filled extra SFHA slot), and totals corrected to the visible plan (8/256, was 10/267).
  **Requirements-tagging question ANSWERED: 1,866 template sections carry FEMA review-element
  codes in `data.tags`** (173 of 256 slots) — surfaced on the page as element chips per slot/page
  plus a new "FEMA review elements" rollup band (B 757 · C 329 · H 85 · A 49 · S 30 · E 21 ·
  D 19 · F 8); H/S letter meanings need DHSES confirmation. The old "no element mapping" banner
  was rewritten: two tagging systems exist (section tags + LHMP_IA registry), joining them is the
  remaining work. Findings ledger §16 + `summaries/narrative_inventory.txt` hold the full
  per-page slot inventory.
- [ ] HoC worklist mockup (Direction B phase 3; promotes hidden template prototype 1676369).
- [ ] Human visual pass on the three reports (rendered checks done via Playwright at 1440px;
  screenshots in session scratchpad).

## Relationship to prior work

Supersedes the *framing* of [`mny-admin-panel-redesign.md`](./mny-admin-panel-redesign.md) (July:
how to clean up the panel) — that task's Phase 2+ (building the other five datasets' admin pages)
should NOT proceed until the direction decision lands; its collapse math and 16 mockups are
incorporated into Direction A. The county-actions workflow
([`mny-county-actions-jurisdiction-prioritization.md`](./mny-county-actions-jurisdiction-prioritization.md),
[`mny-jurisdiction-prioritization-live-build.md`](./mny-jurisdiction-prioritization-live-build.md))
is the reference implementation Direction B scales.
