# MNY County Template — LHMP plan home redesign

**Project:** MitigateNY · **Topic:** themes · **Status:** BUILT 2026-09-04 · REV 3 base + paragraph break + hurricane card rebuilt, 2026-09-08 · pending owner review · **Started:** 2026-09-04

## Objective

Redesign the **county template home page** — the page a member of the public lands on when they
open their county's Local Hazard Mitigation Plan — as a design mockup in the mny design system,
in a **new "LHMP Design" section**.

The redesign has three jobs:

1. **Keep what the current home is** — the same page, driven by the same pattern-level `geoid`, so
   one design serves all 62 counties with only values changing.
2. **Bind the county profile datasource into three cards** — *geography*, *demography*, and *major
   industries* — so the plan opens by telling you what this county actually is, from data rather
   than authored prose.
3. **Tighten the rest of the page** against the design system, and — from a review of the other
   datasources the county template already uses — add an overview band that gives a public visitor a
   real sense of the plan (risk, actions, jurisdictions) before they navigate anywhere.

**Deliverable: design mockup(s) only.** Plain HTML + Tailwind CDN per
[`src/dms/skills/designing-a-dms-design-system.md`](../../../../src/dms/skills/designing-a-dms-design-system.md).
No live DMS build in this task; the live build is a follow-on task once the design is approved.

## Scope

**In scope**
- [x] New design-system section **LHMP Design** (`src/themes/mny/design/pages/lhmp/`) + its
  `ds-nav.js` registration + a `README.md` entry.
- [x] A redesigned `home.html` for the county plan, drawn on the mny 1440px page canvas.
- [x] A written binding spec for every data-bound section (source id / view id / env / columns /
  filters), detailed enough that the live-build task can be executed from it — written as HTML
  comments **on the band it describes**, so the spec cannot drift from the design.
- [x] A review of the county template's other datasources with a recommendation for what belongs on
  the landing page (§2 below; recommendations 1–3 were taken, 4 was not).

**Out of scope**
- Writing anything to `mitigat-ny-prod` (pattern `1300890`, page `1300803`). No draft sections, no
  publish. That is the follow-on live-build task.
- The `/admin` panel home — that is a different page with a different audience, already designed in
  [`mny-admin-home-redesign.md`](./mny-admin-home-redesign.md) (`pages/admin-home-v2.html`).
- The statewide public home (`pages/home.html` / `home-v2.html`), which is the MitigateNY site
  landing page, not a plan landing page.

## The governing constraint — templateability

This page is a **template** for every county plan. Carry over the rule established in the admin
home redesign:

> **Every band is identical for every county plan. Only values and the county name vary — never the
> copy, never which cards appear.**

That rules out hand-written per-county findings ("this county has no ranked actions"), and it makes
the *data binding* the interesting part of the design: everything specific to a county must arrive
through a `geoid`-filtered source, not through an author retyping it 62 times.

Corollary for review: any band that would read as wrong or empty for a county with thin data has to
degrade gracefully. Several counties will have empty profile prose and zero prioritized actions.

## Current state

### The pattern

| Fact | Value |
|---|---|
| Pattern | `MitigateNY_County_Template_V3` — **1300890**, `prod\|mitigateny_county_template:pattern` |
| Subdomain | `county_template` (`https://county_template.devmny.org/`) |
| base_url | `/` |
| **Pattern-level filter** | `[{"searchKey":"geoid","values":["36105"]}]` — Sullivan County |
| Home page | **1300803**, `url_slug: home`, `title: Home`, `hide_in_nav: hide` |
| Page-level filter | same — `geoid = 36105` |
| Page theme | `sideNav.size: 'none'` (no side rail on home) |
| Section groups | `header` (top, full-width) · `default` (content, boxed) · `53b7e32b-…` "Group 4" (bottom, full-width, `clearCentered`) |
| Sections | 11 published (`2275240`–`2275250`), 11 draft (`2175337`, `2175339`–`2175348`) |

Every county plan is a duplicate of this pattern with its own `geoid` — `suffolk_draft` (2249247),
`schenectady_draft` (2304223), `delaware_draft` (2323808), `MitigateNY_Nassau_V2` (2407262). **A
change to this page's design is a change to all of them**, which is why the templateability rule is
load-bearing and why the live build will have to run through the
[propagating-county-template-changes-to-duplicates](../../skills/propagating-county-template-changes-to-duplicates.md)
skill.

### The 11 sections as they stand (draft ids)

| # | Section | Kind | Size | Notes |
|---|---|---|---|---|
| 1 | 2175337 | `Header: MNY Data` | 2 (full) | **Bound to DHSES_County_Database** (953754 / v1108098, `mitigat-ny-prod+test_meta_forms`), filtered `geoid[page:geoid]=36105`, 1 row. Columns in use: `county` (title) · `county_seal_url` (logo) · `photo` (bgImg) · `photo_credit` · `geoid` · `stcofips` · `geography_topography` · `richtext_info_test` (hidden). `overlay: full`, `titleSize: sm:text-[48px]`, `showSearchBar: true`, default bg `/themes/mny/inset_county.jpeg`, default title "County Hazard Mitigation Plan". |
| 2 | 2175339 | lexical | 2 | H2 only: "EXPLORE THE COUNTY HAZARD MITIGATION PLAN" |
| 3 | 2175340 | lexical | 2 | One paragraph — and it is **about the template, not about the plan**: "This is a county template for local hazard mitigation plans. It includes places for counties and jurisdictions to input mitigation planning content…". Authoring-facing copy on a public landing page. |
| 4 | 2175341 | lexical (`isCard: Annotation`, bg `#F3F8F9`) | 1/2 | "Take Action" + a **base64-inlined PNG** + a paragraph on Strategy Development Workshops. |
| 5 | 2175342 | lexical (Annotation) | 1/2 | "Cities, Towns, and Villages" + base64 PNG + a paragraph on jurisdictional annexes. |
| 6 | 2175343 | lexical (Annotation) | 1/4 | Link list — THE LOCAL ENVIRONMENT (5 links) |
| 7 | 2175344 | lexical (Annotation) | 1/4 | Link list — THE RISK (4 links) |
| 8 | 2175345 | lexical (Annotation) | 1/4 | Link list — THE PLAN (3 links) |
| 9 | 2175346 | lexical (Annotation) | 1/4 | Link list — TRACK PROGRESS (2 links + 2 broken) |
| 10 | 2175347 | `Footer: MNY Footer` | — | v1 config |
| 11 | 2175348 | `Card` — "County Hazard Profiles" | 2 | **AVAIL - Fusion Events V2** (external, `hazmit_dama` **870 / v1648**), filters `substring(geoid,1,2)='36'` AND `geoid[page:geoid]=36105`; 11 hazard rows paged 4 at a time, `gridSize: 4`, `compactView`, `reverse`, risk level derived by a `CASE` calc column. |

**So the page today is: an image header, two paragraphs, two illustrated blurbs, a four-column link
menu, and one hazard card strip.** Two data bindings out of eleven sections.

### Defects found while scoping (fix as part of the redesign)

1. **Section 3's copy is about the template, not the plan.** A public visitor to Sullivan County's
   plan is told they are looking at a template with "places for counties … to input content".
2. **Two broken links in TRACK PROGRESS (2175346):** `https://https://redesign.devmny.org/plan_to_act/evaluate_cap`
   — doubled scheme, and pointing at a different site.
3. **A likely dead link:** `/track_progress/actions_listview`. No such page appears in the
   2026-09-01 harvest (`src/themes/mny/design/reports/pattern-component-catalog.csv`), which lists
   `track_progress/actions_database` and `…/actions_index` but no `actions_listview`. Verify live
   before rewriting.
4. **Stray duplicate links** inside the LOCAL ENVIRONMENT and THE PLAN lists (a second
   `/the_local_environment/people_and_communities` link riding on the Natural Environment and NFIP
   rows; a second `/the_plan/strategies` on the annexes row).
5. **Base64 PNGs inlined in lexical** (sections 4 and 5) — page weight the design should move to
   `/themes/mny/…` assets or drop.
6. **Four separate 1/4 lexical sections doing one job.** A link menu authored as four independent
   rich-text blocks cannot be restyled, reordered, or kept consistent across 5 county patterns. This
   is the clearest candidate for replacement by one configured primitive.

## 1 · The three profile cards

**Source named by the owner:** `https://www.devmny.org/cenrep/source/1161/table/1986` — i.e. **source
1161, view 1986**, reached through the `Datasets` pattern (**1499610**, base_url `/cenrep`).

**What is confirmed:** the id pair is an **external DAMA source in `hazmit_dama`**, not a DMS-internal
source. `dms raw get 1161` finds nothing in `mitigat-ny-prod`, it is absent from the dmsEnv
(**1676363**) that backs `/cenrep`'s internal listing, and `graph.availabs.org` answers a falcor read
of `dama.hazmit_dama.sources.byId.1161` with `User not authorized for source id(s): 1161` — an
authorization refusal, so the row exists there. Its id range matches the pattern's other
`hazmit_dama` sources (870, 1482, 1505, 1508, 1610, 1651).

> **STILL OPEN — the one thing the build could not resolve.** Reading source 1161 / view 1986
> needs a credentialed `hazmit_dama` session. Anonymous falcor reads against both
> `graph.availabs.org` and `dmsserver.availabs.org` return `User not authorized` / nulls, the
> `dama-admin` REST endpoints 404, and the stored token in `scratchpad/mitigat-ny-prod-prod/.token`
> is (a) expired and (b) a DMS-server token, which `graph.availabs.org` does not accept. **The
> mockup was therefore built against the confirmed equivalent below**, and the swap is a
> four-line change to one section's `externalSource` + column names — see the SWAP NOTE in the
> `county-profile` band's comment. Nothing in the design depends on the answer.

**The strong prior, and the fallback.** The three fields the owner asks for already exist, with those
exact meanings, on the source the header is *already* bound to — **DHSES_County_Database, 953754 /
view 1108098**:

| Card | Column | Type |
|---|---|---|
| Geography | `geography_topography` ("Geography/Topography") | text |
| Demography | `demographics_population_centers` ("Demographics Population Centers") | textarea |
| Major industries | `major_industries_economic_drivers_and_notable_infrastructure` | text |

Neighbouring columns worth considering for the same band: `watershed_s` (Watersheds),
`climate_assessment_region` + `climate_assessment_narrative` (lexical), `richtext_info_test`
("Extra Info", lexical — currently bound-but-hidden on the header), `plan_status`,
`plan_approval_date`, `expiration_date`, `risk_assessment_period`, `primary_point_of_contact`,
`lhmp_link`, `county_profile_link`.

So there are two live possibilities and the answer decides the binding spec:

- **(a) 1161/1986 is the DAMA-side county profile table** carrying the same three narrative fields.
  Bind the three cards to it; note in the spec that the header (2175337) still reads
  `geography_topography` from the *DMS* source, and decide whether the header should move too so the
  page has one profile source rather than two.
- **(b) 1161/1986 is a different table** (a census/ACS-shaped one, say). Then it likely supplies
  *measured* demography and industry figures, and the design should pair them with the DHSES
  narrative rather than replace it — a number plus the county's own sentence.

**Design intent, either way.** Three cards, equal width, on one row of the content grid, each:
county-scoped by the page `geoid`, one heading, one body of prose or one figure + prose, no chrome
beyond the mny card surface. They replace the "template" paragraph (section 3) as the page's first
content band — the plan opens by saying what the county *is*.

**Empty-state rule.** Several counties will have blank profile prose. Specify what each card renders
when its field is null; a card that collapses to a bare heading is worse than a card that does not
appear, and per the templateability rule "does not appear" is not available. Decide and document.

## 2 · Datasource review — what else the landing page could carry

Every source the county template already binds, from the 2026-09-01 census
(`src/themes/mny/design/reports/county-template-qa-t6-fetchmode.csv`, 1,125 data components over 58
pages). Anything on this list is already paid for: the pattern's authors know it, and it is already
`geoid`-filterable.

| Source | Class | id / view | env | Pages |
|---|---|---|---|---|
| `LHMP_IA` | internal | 1441680 / 1441681 | test-meta-forms | 37 |
| `Actions_Revised` | internal | 1029065 / 1074456 | test-meta-forms | 29 |
| `Capabilities_Catalogue` | internal | 1068273 / 1172519 | test-meta-forms | 21 |
| `Hazards_of_Concern` | internal | 1473470 / 1473471 | test-meta-forms | 21 |
| **AVAIL - Fusion Events V2** | external | **870 / 1648** (also v2401) | hazmit_dama | 20 — *incl. home* |
| `R_and_V_Matrix` | internal | 1068982 / 1160864 | prod | 18 |
| **NRI Counties - Hazard Normalized** | external | **1508 / 1982** | hazmit_dama | 16 |
| `Mitigation_Measures` | internal | 1068274 / 1155800 | test-meta-forms | 16 |
| `Roles` | internal | 1473295 / 1473296 | test-meta-forms | 4 |
| **`Jurisdictions`** | internal | **1346449 / 1346450** | test-meta-forms | 4 |
| `Participation` | internal | 1473468 / 1473469 | test-meta-forms | 3 |
| BILD 2026 Simplified Draft V1 | external | 1651 / 2357 | hazmit_dama | 3 |
| NFIP Claims Enhanced (V2) | external | 831 / 1304 | hazmit_dama | 3 |
| `NYS_Dams` | internal | 1459525 / 1459528 | prod | 2 |
| nfip claims enhance (incl. juris geoms) v1.1 / v1.2 | external | 1558 / 2285 · 1610 / 2583 | hazmit_dama | 2 · 1 |
| **Actions Cleaned** | external | **12453 / 13272** | hazmit_dama | 2 |
| ACS | external | 1482 / 1962 | hazmit_dama | 1 |
| Climate Smart Communities | external | 1636 / 2331 | hazmit_dama | 1 |
| Disaster Loss Summary (V2) | external | 858 / 2398 | hazmit_dama | 1 |
| IHP Enhanced · PA Funded Projects · SBA Disaster Loans · USDA Crop Loss | external | 854/1379 · 372/1305 · 88/1646 · 342/1197 | hazmit_dama | 1 each |
| FEMA NRI Counties · NCEI Storm Events Enhanced | external | 159 / 1370 · 198 / 1157 | hazmit_dama | 1 each |
| AVAIL BILD V3.1 · BILD 2023 Parcels as Points · NYS Tax Parcels Map · NFIP Community Status Book | external | 1117/1596 · 1505/1978 · 423/2268 · 411/2299 | hazmit_dama | 1 each |
| `Funding_Sources` | internal | 1672380 / 1672381 | test-meta-forms | 1 |
| **`DHSES_County_Database`** | internal | **953754 / 1108098** | test-meta-forms | 1 — *home only* |

**Recommended candidates for an overview band** (evaluate each in the design; the band should be
small — three or four figures, not a dashboard):

1. **The plan's own scale — `Jurisdictions` (1346449 / 1346450).** "N participating jurisdictions"
   is the single most orienting fact about a countywide plan and the page never states it. Already
   `geoid`-filtered on the annexes pages.
2. **The mitigation strategy — `Actions_Revised` (1029065 / 1074456).** Count of actions in this
   county, and a status split (proposed / in progress / complete). The public equivalent of the
   Track Progress section, and the one number that says the plan is a live document. *Caveat from the
   county-actions work: county priority is unset on all 475 Sullivan actions and `estimated_cost` is
   empty on every row — so lead with counts and status, not priority or cost.* Consider **Actions
   Cleaned (12453 / 13272)** instead, which is the source the statewide dashboards use.
3. **The risk in one line — `Hazards_of_Concern` (1473470 / 1473471)** and/or the existing
   **Fusion Events V2 (870 / 1648)** card already on the page. Fusion Events already computes
   `fusion_total_damage`, `num_declared_disasters` and `num_events` per hazard for this geoid — a
   county-total "N declared disasters, $X in recorded losses since …" band is a **re-aggregation of a
   binding the page already has**, i.e. nearly free, and it is the strongest public hook on the page.
4. **Capability posture — `Capabilities_Catalogue` (1068273 / 1172519).** Lower priority: it is a
   planner-facing concept and hard to state to the public without narrative.

**Explicitly consider and probably reject** for a public landing page: `LHMP_IA` (it is the
plan-text/requirements spine — it belongs to every section page, not the front door), `R_and_V_Matrix`,
`NYS_Dams`, the parcels/BILD sources, and the single-use disaster-program sources — all of which have
a home page of their own one click away.

**Hazard Profiles card (2175348) stays**, but re-examine it: 11 hazards paged 4 at a time on a
landing page means most of the county's risk is behind a "load more". Either show all of them
compactly or show the top N by risk with a link to `the_risk/natural_hazards`.

## 3 · Tightening the current design

Apply the design system rather than inventing. Specific instructions:

- **Read [`src/dms/skills/card-layout.md`](../../../../src/dms/skills/card-layout.md) before drawing
  anything.** Per the repo's author-empowerment principle, the answer to a layout is a Card
  configuration (`cellSpan`, static columns, `cardHints`, `formatFn`, a small column type) — never a
  bespoke React component. If the design needs something the Card cannot express, name the smallest
  platform enrichment that would let an author express it and log it as a follow-on.
- **Collapse the four 1/4 link lexicals into one configured section.** Four hand-authored rich-text
  menus is the page's biggest maintenance liability across five patterns. An all-static Card
  ("authored list panel" recipe, `card-layout.md` §Recipes) gives the same four columns with one
  configuration and consistent type.
- **One heading system.** The page currently mixes an H2 band ("EXPLORE THE COUNTY HAZARD MITIGATION
  PLAN") with in-card H2s at the same weight. Use the mny scale: `displaySM`/`displayXS` for band
  titles, `metaLG`/`metaMD` for card titles, `prose`/`proseSM` for body.
- **One surface rule.** Every current content block is `#F3F8F9` (`blue-50`) `Annotation`. Decide
  deliberately which bands sit on the topo canvas unboxed and which are white/`blue-50` cards —
  and note the county-actions gotcha: chrome toned for the topo canvas goes invisible on a white
  surface.
- **Cut the base64 images**; reference `assets/mny/…` or drop them.
- **Fix the four link defects** listed above and re-verify every remaining link resolves to a page
  that exists in pattern 1300890.
- **Grid discipline:** every band on the `sectionArray` column grid documented in
  `design-system/grid.html`; content cap 1020px, page cap 1440px, gutters `md:px-4 xl:px-[64px]`.

## Implementation — DONE 2026-09-04

**Deliverable:** [`src/themes/mny/design/pages/lhmp/home.html`](../../../../src/themes/mny/design/pages/lhmp/home.html)
— 49 KB, plain HTML + Tailwind CDN + `theme/index.css.additions`, no build step, **two inline
styles** (the topo canvas on `<body>`, and the header background image — which the live
`mnyHeaderDataDriven.jsx` also sets inline because it is a bound value). For comparison the existing
`pages/home.html` carries ten.

**Every figure on the page is real Sullivan County data**, pulled live during the build:

| Figure | Value | Where it came from |
|---|---|---|
| Profile prose ×3 | verbatim | `dms dataset query 953754 --view 1108098 --filter geoid=36105` |
| Plan status / approved / expires | Update in Progress · 2021-04-28 · 2026-04-27 | same row |
| Watersheds · climate region · risk assessment period | Lower Hudson & Delaware · Catskills · Dec 2024–Mar 2026 | same row |
| Participating jurisdictions | **23** (15 Town + 7 Village + 1 County) | `dms dataset query 1346449 --view 1346450 --filter county_geoid=36105` → 48 rows; the 25 `CDP` rows are census places, not jurisdictions, and are excluded |
| Mitigation actions | **475** — 391 proposed · 23 in progress · 41 complete · 20 other | `references/actions/data/sullivan_stats.json` (baked from `Actions_Revised` 1029065 / v1074456) |
| Declared disasters · declared loss | **17** · **$372,735,007** | the four aggregate columns already computed by live section **2413419** (`natural_hazards`), Fusion Events V2 870/v1648, groupBy geoid, `geoid=36105` |
| Other recorded events · non-declared loss | **537** · **$25,742,310** | same |
| Total recorded loss | **$398,477,317** → "$398M" | sum of the two above; cross-checks against the 11 per-hazard rows (≈$398.5M) |
| 11 hazards, risk level + loss | hurricane $363.8M … extreme heat $0 | live section **2413425** ("Loss by Hazard Category", Fusion Events V2 870/v2401) for the losses; the risk levels are the `CASE` column verbatim from the live home card **2175348** |

Only the one-paragraph lede and the four Explore column headings are authored copy, and that copy is
identical for all 62 counties — the templateability rule holds.

### Revision 2 (2026-09-04) — body rebuilt in the county-actions design language

Review: *"start from scratch besides the header, taking more inspiration from the work in the county
actions workflow designs. There need to be better text layout here and better use of size and
placement to help us understand where to focus."*

The header was kept; everything below it was rebuilt. Three things changed, and each one is a
borrowing from `pages/county-actions/`:

| Rev 1 | Rev 2 | Borrowed from |
|---|---|---|
| Prose in **three equal cards side by side** — same size, same weight, same colour, no entry point. One grey block three columns wide. | A **reading column + sticky rail**: headed prose blocks with hairline rules, Geography at lede weight, the facts pulled out to a `County facts` dl beside it. | `action-view.html` — the `the-case` / `key-facts` split |
| Four **flat stat tiles** (23 · 475 · 17 · $398M) with equal weight and no shape | Counts that have a distribution are **meters with legends** — 475 segmented into 391 proposed / 23 in progress / 41 complete / 20 not reported. Same figures, one of them legible. | `jurisdiction-prioritization.html` — the `progress-and-stats` band |
| **11 hazard tiles in a 4-wide grid**, all the same size, so the page said nothing about which one matters | **The leader is pulled out as the page's focus object** at 36px, and the other ten become a bar list. | `dashboard.html` — the `hazard-mix` bar list, and the county-identity band's scale |
| Four tinted nav **cards at 14px** competing with the content above them | A **quiet 13px index** — rules instead of boxes. It's the last thing on the page and now looks like it. | `dashboard.html` — the `page-index` footer treatment |

**The type ladder is now the focus mechanism**, largest first:

| Size | Carries |
|---|---|
| 36px Oswald | the dominant hazard's name — the page's focus object |
| 30px Oswald | `$363,792,448` and `475` — the two numbers that matter |
| 20px Proxima | the page lede, and the Geography paragraph — what you read first |
| 16px | band titles; the Demography and Major Industries paragraphs |
| 14px | supporting prose, rail values |
| 13px | the Explore index — deliberately the quietest thing on the page |

**The one analytical move.** Hurricane is **91%** of Sullivan's recorded loss
($363,792,448 of $398,477,317). On a shared scale the other ten hazards are invisible stubs, so the
band could only ever say "hurricane". Pulled out, the leader answers *why does this plan exist*, and
the remaining ten get a scale they can use — stated on the page ("Bars scaled to the largest of
these, not to hurricane"), not hidden. **This generalises without per-county authoring:** the rule is
*rank 1 out front, ranks 2–n scaled to rank 2*, which holds for a county whose leader is 30% as well
as one whose leader is 91%. The templateability rule survives — the label "Most costly hazard" is
fixed; the hazard and the figure are values.

**Two more real fields were bound** while rebuilding, both already on the row the header uses:
`climate_assessment_narrative` (a lexical column, regional → templateable) as a Climate outlook panel
in the rail, and `disaster_declaration_threshold` ($349,091) as a rail fact.

**Two defects found and fixed during the rebuild:**

1. **`border-l-4 border-<colour>` + `border-y border-r border-<other>` silently loses the coloured
   edge.** Both utilities set `border-color` on *all four sides*, so whichever rule lands later in the
   generated CSS wins and the card gets one uniform outline. Class order in the attribute does not
   decide it. The correct form is the side-scoped one `dashboard.html`'s status strip uses:
   `border border-<other> border-l-4 border-l-<colour>`. Four cards on this page were affected.
   **Worth checking the county-actions pages for the same shape** — several of them write
   `border-l-4 border-mny-y700 border-y border-r border-mny-y500/40`.
2. The rail was short against a tall reading column, so `Participating jurisdictions` left the facts
   list (23 gets a 30px treatment two bands down, and county-actions' rule is not to print a number
   twice) and the climate narrative now runs in full rather than cut mid-passage.

### Revision 3 (2026-09-08) — geography to the header, breakout illustration cards, navigation restored

Three owner directions, all applied.

| Direction | Change |
|---|---|
| *"What if we just put the geography text in the header."* | Done. The header card now runs **eyebrow → county name → `geography_topography` → plan status → search**, and it is the right home for it: the header answers *where am I*, and a photograph of the county beside the county's own description of itself is one thought, not two. The card widened 520 → 600px and the band grew to `lg:min-h-[700px]`. **No new column is needed** — the live component already binds `geography_topography` in `externalSource.columns` and renders nothing with it. |
| *"Take a bit more from the current homepage — the cards with the isometric images. Those look a lot better when the image actually breaks out of the top of the card."* | Done, using `pages/home.html`'s device verbatim: `pt-[Npx]` on the wrapper reserves the overhang, and the image carries `mt-[-Npx] mx-[-12px] w-[calc(100%+24px)]`. Used **twice** — the three profile cards and the four Explore cards. |
| *"The page needs to do more to take the user to other places in the plan like it did before."* | Rev 2's 13px index was too quiet — it had traded away the live page's one real strength. The Explore band is now four illustrated cards carrying **every page of the plan**, and routes are threaded through every band above it. |

**The profile band is three cards again.** Geography's promotion to the header freed a slot, and
`climate_assessment_narrative` — a lexical column on the same row, regional (Catskills) and therefore
templateable — took it. So the band is **Demography · Major Industries · Climate Outlook**, each an
isometric breakout card with its prose and a pill to its section. The reference data that had been in
a sticky rail became a slim four-up strip above the cards (watersheds · climate region · risk
assessment period · disaster declaration threshold), which suits a card row better than a rail does.

**Navigation reach, counted off the built file** (comments stripped, so commented-out examples don't
inflate it):

| | Live page | Rev 2 | Rev 3 |
|---|---|---|---|
| In-plan links | 14, **3 of them broken** | 27 | **56** |
| Distinct pages reached | 13 | 24 | **33** |

All 33 slugs were checked against the 2026-09-01 harvest
(`src/themes/mny/design/reports/pattern-component-catalog.csv`); none is invented. Where they sit:
1 in the header · 2 lede CTAs · 1 in the facts strip · 3 profile pills · 16 in the risk band (the
band link, the hurricane card, ten bar rows, four chips) · 7 in the response band · 22 in the Explore
band. The four TopNav entries became real links too.

**Two sizing findings on the breakout card, worth recording because the next person will hit them:**

1. **`w-[calc(100%+24px)]` is calibrated to a ~290px card.** That is the width of `home.html`'s
   4-across cards and of the owner's reference image, and at that width the illustration lands at
   ~255px tall — correct. On the 3-across profile cards (~390px) the same rule scaled it to ~340px
   and it swamped the prose. Those cards now pin the height (`h-[240px]`) and keep the bleed width.
2. **`w-auto mx-auto` centres the file, not the drawing.** These renders carry uneven transparent
   padding, so a centred image sat visibly left of card centre. Giving the image the full bleed width
   and letting `object-contain` letterbox inside it centres the *drawing*. Both facts belong in
   whatever theme value carries this treatment in the live build.

### Revision 4 (2026-09-08) — paragraphs in the profile cards, and the illustration framing fixed

Owner: *"Break the 3 text cards at the top into paragraphs. Make the graphic for the hurricane card
come out of the top of the card and make it bigger."* Then, on review: *"I don't think we need
paragraph structure in the one in the header, but the layout of the other three still feels quite bad
to look at even though I like the cards."*

**The header keeps its single block.** Geography reads as one paragraph there and stays that way.

**The three profile cards are now 2–3 paragraphs each, running the FULL field.** All three had been
trimmed to fit a single block; with paragraph breaks there is no reason to trim, so Demography,
Major Industries and Climate Outlook now carry every sentence DHSES holds. Prose went 14px → **15px /
1.5** — 14px over a 366px measure was cramped for three paragraphs.

> **LIVE-BUILD REQUIREMENT — the paragraph breaks are not in the data.** Checked directly:
> `geography_topography`, `demographics_population_centers` and
> `major_industries_economic_drivers_and_notable_infrastructure` each contain **zero newlines**
> (452 / 758 / 810 characters, one run), and `climate_assessment_narrative` — though it is a
> **lexical** column and so already capable of carrying them — has a single `paragraph` node. So the
> breaks on this page are a design proposal, and the live build needs one of:
>   1. **authors add the breaks** — free for `climate_assessment_narrative` today, and the cleanest
>      answer since only the county knows where its own paragraphs go; or
>   2. **a `formatFn` that splits on sentence groups** — templateable, but it will guess.
> Recommend (1), with (2) as the fallback for counties that never revisit the field.

**Why the cards looked bad, and the actual fix.** Every file in `assets/mny/illustrations/` is
**1024×1024 — a square, with a variable amount of transparent padding baked in**. That single fact
explains it:

| Treatment | What happens on a 414px card |
|---|---|
| `h-[240px] object-contain` (rev 3) | The square scales to 240×240 — **240px wide inside a 414px box.** The drawing floats in ~170px of horizontal air, and because each file pads differently it also reads as off-centre and unaligned card to card. **This was the "bad to look at".** |
| plain full bleed, no height | Width is right, but the image is as **tall as the card is wide** — 414px — which swamped the prose on the first pass. |
| **a clipped window** (rev 4) | Full bleed width, wrapped in a shorter `overflow-hidden` box that crops the square's dead top and bottom. Full width, no air, identical height on every card, and the crop lands in the padding rather than the drawing. |

Neither of the first two can work, because the asset's aspect ratio is the problem, not the CSS.

**And the window must be proportional, not fixed px.** The first cut used `h-[380px]`, correct only
at 1440: at 1024 the image is *shorter* than the window, so the float comes straight back, and on a
wider card the same value cut the windmill off `mny-built-environment`. It is now
`aspect-[13/12]` on the profile cards and `aspect-[10/9]` on the hurricane card — ~4–5% off each
edge at **any** width. Verified at 1440, 1280 and 1024 with the drawings intact.

**The hurricane graphic** swapped the 44px `hazards/` glyph for the isometric `illustrations/`
render, full bleed, breaking 230px out of the card top — **the biggest graphic on the page**, which
is what the page's focus object should have.

**Data-quality artifacts found in the source prose** (worth a county fix, not a design problem):
all three text fields end in a stray `?`, each carries 7 non-breaking spaces mid-sentence, and the
industries field reads *"There Vera Health Spa was recently opened"* — almost certainly *"The Vera
Health Spa"*. The mockup drops the trailing `?` and otherwise quotes verbatim, including that
sentence.

### Revision 5 (2026-09-08) — one card size for the whole page

Owner: *"The cards on the very bottom look great. Maybe we set the cards at the top to be 9 columns
so they size similar to the 4 cards at the bottom, then we put the county info in an info card next
to them."* Plus, from the pass before: *"the illustrations and the cards are too big almost"* and
*"the hurricane card now creates a ton of white space above and below the graph."*

**The profile cards went from 4 columns to 3** (9 of 12), which makes them **exactly 304px — the same
as the four Explore cards** — and the county facts moved out of the strip above them into an **info
card in the remaining 3 columns**. One card size now governs the page.

**That deleted rev 4's whole crop apparatus for those cards.** The `aspect-[13/12] overflow-hidden`
window existed only because a 414px card makes a full-bleed square 414px tall. At ~290px the square
lands at ~314px, which is the proportion `home.html` and the client's reference image were drawn at —
so the three profile cards now use the Explore cards' treatment verbatim
(`mx-[-12px] mt-[-110px] w-[calc(100%+24px)]`, no window, no crop). **The lesson generalises: the
breakout card wants a ~290–305px column. Give it that width and it needs no correction at all.**

The clipped window survives on one card only — the hurricane focus panel, which is 5 columns wide by
design. There the illustration is inset to 70% and cropped `aspect-[10/9]`, which lands it at roughly
the same *graphic* size as the 304px cards even though its card is wider.

**The whitespace around the bar list is gone, and the cause is worth recording.** It was
`lg:pt-[230px]` on the bar-list column, which I had added to line the bar list up with the hurricane
*card's* top. That pushed 230px of white above the bars and left the column short at the bottom. But
the illustration lives *inside* the left column, so it cannot collide with the right one — the bar
list simply starts at the row top and sits alongside the overhang. The chip row then takes `mt-auto`,
and the bar rows went `space-y-2` → `space-y-3`, so the remaining slack is spent on the bars rather
than dumped in one gap. **Band height 853 → 690.**

The band's own totals: `county-profile` 1022 → **991** (and it now carries a fourth card), and the
page lost ~200px overall.

### Revision 6 (2026-09-08) — the profile stops being cards

Owner: *"This still doesn't look very good. Maybe we try making these just 3 lexical sections with
width 9 and the stat card next to them instead of being cards"* … *"each of the sections should be
width 9 and they should be vertically stacked."*

**The county profile is now three stacked sections at `size: 3/4` (9 of 12), with no card chrome and
no illustration**, and the County facts card beside them. That was the right call and it is worth
being clear about why the card form kept failing here: at 304px a card holding an illustration and
three paragraphs is ~700px tall, and three of them side by side own the page. **The illustrated
breakout card is a doorway form — short link list, one destination — which is exactly the Explore
band at the foot of the page, and it stays there.** It was never the right container for 750
characters of prose. Four revisions went into resizing, cropping and re-scaling it before the
container itself turned out to be the problem.

Three specifics:

- **The facts card is placed FIRST in the section array**, pinned to columns 10–12 with
  `row-span-3`, so it stands beside the three stacked sections rather than under them. Same trick
  `dashboard.html` uses for its map (`lg:col-span-7 lg:row-span-2` ahead of two 5-wide siblings): the
  spanning item comes first and auto-placement fills the remaining track. In DMS this is a `1/4`
  section carrying a rowspan.
- **Each section's prose runs in two CSS columns.** A 9-wide block is ~790px — about 110 characters
  at 15px, well past readable — so `md:columns-2 md:gap-x-10` with `break-inside-avoid` on the
  paragraphs gives ~380px measures and fills the width instead of leaving a ragged right edge.
- **The facts card distributes down its full height** (`justify-between` + `divide-y`), because
  spanning three sections stretched it to ~560px while four facts filled ~290px and it read as an
  empty card with a pill stranded at the bottom. It now reads as a spec table that is meant to be
  that tall.

> **OWNER DECISION — `Card` styled as prose, or true `lexical` sections?** The owner said "lexical",
> and it matters for more than markup. As drawn these are **`Card` sections with `removeBorder: true`
> and no `bgColor`**, which renders a bound value as bare prose and keeps all three fields coming
> from one row of one source. Built as **true `lexical` sections** the prose stops being data-bound
> and becomes **authored per county — 62 copies to maintain**, and the DHSES row stops being the
> source of truth. The one real argument for lexical: the paragraph breaks are not in the data
> either way (rev 4), so an author has to touch this text regardless. I have drawn the bound version
> because it preserves the templateability rule; say the word and it becomes lexical.

### Revision 7 (2026-09-08) — start simple

Owner: *"Let's get rid of the columns and just lay it out like normal text"* … *"we don't need the
hrs, we can try to add back in the iso images if we want, but let's just start simple."*

- **The two CSS columns are gone.** Normal single-column flow. A 9-wide section is ~916px of text
  width — about 125 characters at 15px — so the text column is capped at **`max-w-[660px]`**, the
  same measure `dashboard.html` uses for its intro copy, with the heading ending on the same line as
  the prose. The section stays 9 wide in the grid.
- **All the rules are gone** from the profile band — the heading underlines and the separators
  between blocks. Spacing alone separates them.
- **The facts card sizes to its content** instead of stretching across all three sections. Spanning
  them had forced a choice between an empty card and four rows distributed down 640px with dividers;
  a compact card at the top of the span needs neither.
- **The isometric illustrations are out of the profile band** and live only in the Explore band at
  the foot. Owner may put them back; the treatment is documented in `design/README.md` either way.

So the county band is now: a band head, three prose blocks (heading · paragraphs · one link), and a
County facts card top right. Nothing else.

### Revision 8 (2026-09-08) — width-9 card sections, full-width text

Owner: *"These look width 6 to me, not width 9"* … *"the text should be full width in their cards
which should be width 9"* … *"they should be card sections."*

**The width-6 look was my `max-w-[660px]` cap.** The sections were `col-span-9` in the grid all
along, but capping the text at 660px out of the 948px available made the block read as ~6 of 12. The
cap was there because a single run across 9 columns is ~120 characters a line at 15px. Removed — the
text now fills the card.

**They are Card sections again, at width 9, stacked, with the text full width inside the card and no
illustration.** Worth being precise about what went wrong before: it was never the card, it was the
card *plus a 1024² illustration at 304px*, which makes a ~700px-tall object, three of which own the
page. At 9 wide with no render, the card is the right container.

> **OPEN QUESTION 11 — CLOSED.** The owner confirmed *"they should be card sections"*, so the prose
> stays **bound to the DHSES row** rather than becoming 62 authored `lexical` copies. The
> paragraph-break finding from rev 4 still stands: the breaks are not in the data, so adding them
> remains an authoring step on the source (or a `formatFn`).

**One trade-off, recorded rather than silently fixed:** full-width text in a 9-wide card is ~876px,
about 120 characters a line at 15px, past the comfortable 45–75. This is the owner's explicit call.
The levers if it reads long in review, least disruptive first: **16px** prose (the brand's `prose`
token) with `leading-[1.6]`; a `max-w` on the text; or two CSS columns. Noted in the file at the
band.

### Revision 9 (2026-09-08) — reverted to rev 3, plus one paragraph break

Owner: *"This still just takes up too much space. I think the best version we have for this is
actually `http://mercury.availabs.org/mny-design/pages/lhmp/home.html` — can we go back to that and
just add one paragraph break?"* … *"I am open to other suggestions, I just can't get this to feel
right."*

**Done.** That deployed URL is **rev 3** — three profile cards at `col-span-4` with
`h-[240px] object-contain` illustrations, the four-up facts strip above them, and the hurricane card
with its small inline `hazards/` glyph. It was pulled down (`curl`), diffed to confirm the revision,
and copied back over `pages/lhmp/home.html`. Each of the three profile cards then got **one**
paragraph break at its natural seam — wording untouched, only the split is new:

| Card | Break after |
|---|---|
| Demography | "…summer camps and retreats." |
| Major industries | "…prison and tourism industries." |
| Climate outlook | "…the 1981–2010 average." |

**The deployed file already carried the rev-4 border fix** (`border-mny-100 border-l-4
border-l-mny-red`, not the broken all-sides form), so reverting did not reintroduce that defect. It
also already has the header overflow fix.

**Revisions 4–8 are therefore rolled back.** Everything they *learned* is kept in this file and in
`design/README.md`; what is gone from the page is: the paragraph-per-sentence-group prose, the
clipped/proportional illustration window, the width-9 stacked sections, the info card, and — flagged
for the owner, because they had asked for it — **the enlarged breakout hurricane graphic**. That one
is a small standalone re-apply if wanted.

**Standing suggestion for the "too much space" problem, since the owner asked for one.** The three
fields are ~500 characters each, and all three destinations already exist in the pattern
(`/the_local_environment/people_and_communities`, `/…/built_environment`, `/the_risk/climate_change`).
So the honest question is a **content** one, not a layout one: *does the full profile prose belong on
the landing page at all, now that geography sits in the header?* If each card carried its **first
sentence or two plus the link**, the band would halve and the cards would sit at the same proportion
as the four Explore cards the owner already likes — the doorway form doing doorway work, with the
full text on the page it belongs to. That is one small edit away and nothing else on the page moves.

### Revision 10 (2026-09-08) — the hurricane card

Owner: *"Add the hurricane graphic to be larger again, but remove the editorial text in that card
('91% of every …') because we can't automate that kind of copy. I want the hurricane and the amount
to be on the same line so the card, even with the iso image coming out the top, is the same height
it is now."* … *"the iso image in the hurricane card should aim to be the same size as all the other
iso images on the page."*

**The editorial paragraph is gone, and the owner is right about why** — it was the one piece of copy
on the page that could not be generated for another county, which is a straight violation of the
templateability rule this task opens with. I wrote it and should have caught it.

**Hurricane and the amount now share a line** (`flex items-baseline justify-between`), 36px name left
and 30px figure right.

**The iso image is sized off a measurement, not a guess.** Every illustration on the page was
measured: the three profile cards render at **240px**, the four Explore cards at **280px**. The
hurricane render is set to **240px** — it matches three of the seven and costs the least height. If
280 is preferred it is a one-token change and costs ~40px more.

**The height arithmetic, and where it landed.** The two removals free exactly 111px — the editorial
paragraph (59px + 6px margin) and the amount moving up onto the title's line (30px + 16px margin) —
so `mt-[-149px]` leaves 111px of the 240px render inside the card and 129px overhanging above it.
Measured result:

| | Before | After |
|---|---|---|
| Card box | 393px | **305px** (shorter) |
| Card + overhang | 391px | 433px |
| Band | 487px | 527px |

So the **card box shrank**, but the whole object is **42px taller** than the card was. That gap is
arithmetic, not styling: total height = card content + image height, and a 240px image against 111px
of freed space cannot come out even. **The lever, if the 42px matters:** collapse the three-stat
block (17 declared disasters · 537 other events · $398M) from label-over-value in three columns to
one inline line — about 30px — which lands it within ~12px. Not done unasked, since the block reads
well as it is.

The 129px of overhang is added to the **column**, not the card, so the bar list still starts at the
row top and there is no dead space above it (the rev-5 fix holds).

**Follow-up the same day — the chip row lost its bottom alignment, and the owner spotted the cause
correctly:** *"even though the card part is smaller the card plus the iso is still taller."* Exactly
right. The overhang goes on the left column, so that column is taller than the bar list's natural
content, the bar column stretches, and the chip row — sitting at its natural position after the
legend — no longer landed on the card's bottom edge.

Owner: *"I want the buttons to align with the bottom, it would be ok to make the graph be a bit
bigger or slightly more spaced."* So **the bar list became the flexible element**: the column is
`flex flex-col` and the eleven rows sit in a `flex-1 flex flex-col justify-between gap-2.5`
container, absorbing whatever height the card's overhang adds to the row, with the legend and chips
riding at the bottom. Bar tracks also went 14px → 16px now that they have the room. Measured:
**chip-row bottom minus card bottom = 0px.** Band unchanged at 527px, so the alignment cost nothing.

This is the general fix for the pattern, worth keeping: **when one column in a row carries a
breakout overhang, the other column needs one flexible element** — otherwise it stretches and
everything in it floats away from the shared bottom edge. Padding the second column to match (what
rev 4 did with `lg:pt-[230px]`) produces the dead space the owner rejected at rev 5; making its
list flexible produces alignment instead.

### The nine sections as built

| # | Section (`data-name`) | Kind | Grid | Binding |
|---|---|---|---|---|
| 1 | `identity` | `Header: MNY Data` | header group, full-bleed | DHSES 953754/v1108098, `geoid[page:geoid]` — plus **`geography_topography`** (rev 3) and the plan-status columns |
| 2 | `lede` | lexical (static) | `col-span-12` | — 20px opener + two CTAs |
| 3 | `county-band-head` | lexical | `col-span-12` | — |
| 4 | `county-facts` | Card | `col-span-3`, `col-start-10`, **`row-span-3`** | DHSES 953754/v1108098 — `watershed_s` · `climate_assessment_region` · `risk_assessment_period` · `disaster_declaration_threshold` · `county_profile_link` |
| 5–7 | `profile-demography` · `profile-industries` · `profile-climate` | **3 stacked Card sections**, card chrome, text full width | `col-span-9` each | **★ the three profile fields** — `demographics_population_centers` · `major_industries_…` · `climate_assessment_narrative`. All DHSES 953754/v1108098 |
| 4 | `hazard-risk` | Card — focus panel + bar list | `col-span-12` (5+7) | Fusion Events V2 870/v1648 — **unchanged binding**; totals reuse live 2413419's four aggregates |
| 5 | `plan-response` | Card — two meters | `col-span-12` (7+5) | Actions_Revised 1029065/v1074456 · Jurisdictions 1346449/v1346450 |
| 6 | `explore` | **Card, 4 breakout cards**, all-static | `col-span-12` | — 22 links, every page of the plan |
| 7 | footer | `Footer: MNY Footer` | footer group | unchanged |

Eleven sections became **seven**, and two data bindings became **five** (the profile, risk and response bands each bind a source; the header keeps its own).

### Design decisions taken (and why)

*Entries 1, 2, 5, 6 and 8 were rewritten by revision 2 above; the reasoning that survived is kept.*

1. **The three profile fields are ONE Card section, not three.** The three fields live on one row of
   one source; three sections would triple the binding for no gain. **Rev 2:** they are three headed
   blocks in a reading column rather than three boxes in a row — see the revision-2 table for why.
   If the owner wants them visibly carded, that is a presentation change to one Card's display, not
   a re-binding.
2. **The profile prose is shown in full, not clamped.** It *is* the point of the band. **Rev 2:**
   Geography sets at 20px and the other two at 16px, so the block has a reading order instead of
   three equal weights.
3. **The header gained a plan-status line** (status · approved · expires). "Is this plan current?"
   is the first question a public visitor has and the page never answered it; all three values are
   already on the bound row, so it is a column addition, not a new component.
4. **The two illustrated blurbs were dropped** ("Take Action", "Cities, Towns and Villages"). They
   were brochure copy restating what the Actions and Annexes destinations say, and the
   plan-at-a-glance strip now says it with numbers. **This is open question 5 — reversible.**
5. **The hazard band shows all 11 on one page**, ordered by recorded loss descending, instead of
   paging four at a time. `totalLength` is 11 for Sullivan and can never exceed the 18 NRI
   categories, so a single page is safe for every county. **Rev 2:** rank 1 is pulled out as the
   focus object and ranks 2–n become a bar list.
6. ~~The 12th hazard cell is a static doorway.~~ **Retired by rev 2** — the 4-wide tile grid is gone,
   and the doorway is now the band's "All 16 hazard profiles →" header link.
7. **Extreme Heat is kept at "High risk / No recorded loss".** High risk with no recorded loss is a
   real and important shape for a public reader, and hiding it would misrepresent the county.
8. **The six lexical nav blocks became one all-static Card.** Across the five county patterns that
   is 30 hand-maintained rich-text bodies collapsing to one configuration — the single biggest
   maintenance win on the page, and it makes the link set data an audit can read. **Rev 2:** it is
   set at 13px with rules instead of boxes, because it is an index and should be the quietest thing
   on the page.

### Defects fixed in the redesign (all six from Current State)

- [x] 1 · Template-facing copy replaced with a lede about the plan
- [x] 2 · Both `https://https://redesign.devmny.org/plan_to_act/evaluate_cap` links removed
- [x] 3 · `/track_progress/actions_listview` replaced with the four Track Progress pages that exist
      (`actions_dashboard`, `actions_database`, `annual_maintenance`, `funding_sources`)
- [x] 4 · Stray duplicate `/the_local_environment/people_and_communities` and `/the_plan/strategies`
      links removed
- [x] 5 · No base64 image data on the page — brand assets from `assets/mny/`
- [x] 6 · Four 1/4 lexical link menus collapsed into one configured section
- [x] **Also added:** `/the_plan/capabilities_assessment`, a real page the live menu omits

### Platform findings — four, all logged not fixed

1. **A `risk_pill` column type.** The hazard band renders `risk_level` as a colour pill: five values,
   five documented mny tokens (Very High `mny-red` · High `orange-400` · Moderate `yellow-700` ·
   Low `blue-400` · Very Low `green-700`). Look depends on the value, which is exactly the case
   `card-layout.md`'s decision ladder sends to a small column type rather than a component. **All 16
   hazard pages would reuse it.** This is the only platform enrichment the page asks for; everything
   else is Card configuration.
2. **`mnyHeaderDataDriven.jsx` overflows horizontally between 1024px and 1440px.** The `overlay:
   'full'` variant sets `lg:w-[1440px]` on its inner wrapper
   (`mnyHeaderDataDriven.jsx:113`), so at any `lg` viewport narrower than 1440 the page scrolls
   sideways. The mockup uses `w-full lg:max-w-[1440px]` instead — identical at 1440, correct below
   it — and says so in a comment at that line. **This is a live bug on every MNY page that uses the
   full-overlay header**, not just this one; it needs its own small library task.
3. **A Tailwind idiom in the county-actions pages silently drops its coloured edge.**
   `border-l-4 border-<colour> border-y border-r border-<other>` sets `border-color` on all four
   sides twice; the later rule in the generated CSS wins, so the card renders one uniform outline and
   the accent edge is lost. Attribute order does not decide it. The working form is the side-scoped
   one `dashboard.html`'s status strip already uses: `border border-<other> border-l-4
   border-l-<colour>`. Four cards on this page were affected and are fixed. **Several
   `pages/county-actions/` bands use the broken shape** — `jurisdiction-prioritization.html`'s
   progress lede and needs-attention panel among them — so they are probably rendering a flat amber
   box where a left edge was intended. Worth a sweep; not done here, since those pages are another
   task's deliverable.
4. **`mnyHeader`'s `note` is a single string, so the header can hold only one prose slot.** Rev 3
   puts `geography_topography` in the header, which needs either a second prose slot or for `note` to
   accept a bound column. The column is already in the section's `externalSource.columns` and already
   fetched — nothing renders it. Smallest fix: let `note` take a column name. Additive, no migration.

### Verification run (Playwright, 2026-09-04)

Script kept at `scratchpad/lhmp-home-verify.mjs` (gitignored); screenshot
`scratchpad/lhmp-home-full.png`. Served with `python3 -m http.server` from `design/`.

- No console errors, no page errors, **no failed requests** — all 20 asset references resolve
- **No horizontal overflow at 1440, 1280 or 1024** (`scrollWidth === clientWidth` at each)
- **No broken images** (`naturalWidth > 0` on every `<img>`)
- Three `layoutGroup`s (`header` · `content` · `footer`) and six annotated `section`s in the
  content flow, as specified
- `ds-nav` mounts and resolves the page to **LHMP Design → "plan home (county template)"**, active,
  with jump links to all nine other sections

---

## Proposed page shape (starting point, expect it to change in review)

1. **Header** — unchanged binding (2175337): county name, seal, county photo, search. Consider adding
   `plan_status` / `plan_approval_date` / `expiration_date` as a thin meta line, since "is this plan
   current?" is the first question a public visitor has.
2. **Lede** — one short paragraph about *this plan* (replacing the template paragraph), identical
   copy for every county.
3. **Profile band — the three cards** (geography · demography · major industries).
4. **Overview band** — three or four figures from §2 (jurisdictions · actions · disasters/losses).
5. **Risk band** — the Hazard Profiles card, reconsidered per §2.
6. **Explore band** — the four-column navigation, rebuilt as one configured section, with the two
   illustrated blurbs either folded in or dropped.
7. **Footer** — unchanged.

## Files requiring changes

| File | Change | Status |
|---|---|---|
| `src/themes/mny/design/pages/lhmp/home.html` | **NEW** — the redesigned county plan home | **DONE** |
| `src/themes/mny/design/pages/lhmp/` | **NEW** folder — the LHMP Design section | **DONE** |
| `src/themes/mny/design/ds-nav.js` | `{ key: 'lhmp', label: 'LHMP Design', dir: 'pages/lhmp', landing: 'home.html', … }` added to `SECTIONS` after `lhmpadmin` | **DONE** |
| `src/themes/mny/design/README.md` | `pages/lhmp/` added to the folder tree, a `## pages/lhmp/ — LHMP Design` section added with the live-vs-redesign table, and the section table filled in | **DONE** — the table was also missing **LHMP Admin**, which was added in the same pass |
| this task file | binding spec, design decisions, verification run | **DONE** |

`src/themes/mny/theme.js` was **not** touched, as planned.

`src/themes/mny/theme.js` is **not** expected to change; if the design needs a theme key that does
not exist, record it here as a follow-on rather than editing the live theme inside a design task.

## Open questions for the owner

Answer these against the built page; each one is a small edit, none of them re-opens the design.

1. **What is source 1161 / view 1986?** ⚠ **BLOCKED, needs you** — reading it requires a
   credentialed `hazmit_dama` session this session could not mint (see §1). The page is bound to the
   confirmed equivalent, `DHSES_County_Database` 953754 / v1108098, which carries the three fields
   exactly. If 1161/1986 is the DAMA-side copy of the same narrative fields, the swap is
   `externalSource` + three column names on one section. If it carries *measured* demography /
   industry figures instead, add a figure line above each paragraph — the card is sized for it.
   **Follow-on:** should the header (2175337) move to the same source, so the page has one profile
   source rather than two?
2. **Empty profile prose.** Proposed answer, implemented as a comment on the Demography card:
   *"This county has not yet described its population centers."* in italic `mny-400`. The card must
   not collapse to a bare heading — the templateability rule forbids it disappearing, so it has to
   say something. Confirm the wording.
3. **The four overview figures** — jurisdictions · actions · declared disasters · recorded losses.
   Built as recommended. Confirm, or substitute.
4. **`Actions_Revised` (1029065) or `Actions Cleaned` (12453)?** Built on **Revised**, because that
   is what the county-template pages already bind; the statewide dashboards use Cleaned. One-line
   change either way.
5. ~~**The two illustrated blurbs are gone**~~ — **resolved by rev 3.** The isometric illustrations
   are back, doing a real job: three of them carry the county profile and four carry the Explore
   navigation, with the image breaking out of the card top per the owner's reference. The two *blurbs*
   stay gone; what came back is the card treatment.
6. **`/track_progress/actions_listview`** does not appear in the 2026-09-01 harvest and has been
   replaced with the four Track Progress pages that do exist. **Worth one live check** before the
   live build writes it.
7. **The `risk_pill` column type.** The hazard band needs it, and all 16 hazard pages would
   reuse it. Approve it as a library task, or accept plain text risk labels for now.
8. **The header overflow bug.** `mnyHeaderDataDriven.jsx:113` sets `lg:w-[1440px]`, which
   scrolls the page sideways at any viewport between 1024 and 1440. This affects every MNY page with
   a full-overlay header. Should it get its own task under `src/dms/planning/`?

## Testing checklist

- [ ] **Source 1161 / view 1986 identified** — name, columns, types, row count recorded above.
      **The one item still open**; needs credentials this session did not have.
- [x] `pages/lhmp/home.html` renders standalone over `python3 -m http.server` in `design/` with no
      console errors — verified Playwright, 0 console errors / 0 page errors / 0 failed requests
- [x] Registered in `ds-nav.js`; the widget resolves the page to **LHMP Design → plan home (county
      template)**, active, with jump links to all nine other sections
- [x] Every band sits on the `grid.html` column grid (`grid-cols-6 md:grid-cols-12`, `max-w-[1020px]
      mx-auto lg:px-[56px]`); **two** inline styles, both unavoidable (topo canvas; the bound header
      background image, which the live component also sets inline) — `pages/home.html` has ten
- [x] Page cap 1440px / content cap 1020px respected; **no horizontal scroll at 1440, 1280 or 1024**
      (one real overflow was found and fixed en route — see Platform findings 2)
- [x] Type and color tokens only from `README.md`'s token tables. The one addition is `mny-org`
      (`#EA8954`, the documented `orange-400` warning token) which the tailwind config on the other
      pages had not yet aliased
- [x] Every data-bound band has a written binding spec — source id · view id · env · columns ·
      filters · fetch mode — as an HTML comment on the band itself
- [x] Every band is county-agnostic. Re-read as a thin county: profile cards have a specified empty
      state; the stat strip reads correctly at 1 jurisdiction / 0 actions; the hazard band renders
      whatever categories that county has, and the 12th doorway cell is static so the grid never
      looks truncated; every word of copy is county-independent
- [x] Every link on the page resolves to a page that exists in pattern 1300890 — **all 33 distinct
      slugs checked against the 2026-09-01 harvest** (rev 3; 56 links). Not checked *live* — re-verify
      before the live build writes them.
- [x] No base64 image data in the file
- [x] `design/README.md` updated — folder tree, a new `## pages/lhmp/` section with the
      live-vs-redesign table, and the section table (which was also missing LHMP Admin)

## Next — the live build has its own task

**[`mny-lhmp-home-live-build.md`](./mny-lhmp-home-live-build.md)** (scoped 2026-09-09) converts this
design into a live DMS page at slug **`home_new`** in pattern 1300890, hidden in nav, draft only,
built alongside `home` (1300803) rather than replacing it. It carries the section→size→binding table,
the inherited gotchas from the county-actions builds, and the seven findings this design pass
produced. **One correction it makes to this file:** platform finding 4 below (`mnyHeader.note` is a
single string prop, so geography in the header needs a library change) is **wrong** — the component
already resolves the note from the first column flagged `note: true`
(`mnyHeaderDataDriven.jsx:208-220`), and section 2175337 already carries `geography_topography` with
`note: false`. It is one flag, not a library ask.

**Also settled there:** the design's 5/7 hazard split is not expressible in the mny size map (no 5 or
7 step, and `"1"` is col-span-9 not full), so it becomes `1/3` + `2/3`; and the breakout illustration
cannot ride on `cardHints.fullBleed`, whose wrapper is `overflow-hidden`.

The design is a mockup, as scoped — **nothing was written to `mitigat-ny-prod`.** Once the owner has
reviewed it, the live build is its own task: it writes draft sections to page **1300803** in pattern
**1300890** and then propagates to the four duplicates
(`suffolk_draft` 2249247 · `schenectady_draft` 2304223 · `delaware_draft` 2323808 ·
`MitigateNY_Nassau_V2` 2407262) through the
[propagating-county-template-changes-to-duplicates](../../skills/propagating-county-template-changes-to-duplicates.md)
skill. Publishing stays a human decision.

9. **NEW (rev 3) — should `mnyHeader.note` accept a bound column?** That is what putting
   `geography_topography` in the header needs (platform finding 4). Additive and small, but it is a
   library change, so it wants a decision before the live build.
10. **NEW (rev 3) — is `disaster_declaration_threshold` safe to publish?** It is on the bound row and
    reads as a real county figure ($349,091 for Sullivan), but nothing in this task confirms what
    DHSES means by it. It is in the facts strip, unglossed, and is the one value on the page whose
    *meaning* I could not verify. Say the word and it comes out.
