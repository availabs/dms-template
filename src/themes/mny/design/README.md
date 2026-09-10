# MitigateNY (mny) Design System

**Version:** 1.0  
**Date:** 2025-11  
**Source:** Figma handoff — MitigateNY UX/UI (Client Copy, Nov 12 2025)  
**Live reference:** https://mitigateny.org

---

## Brand Summary

MitigateNY is New York State's hazard mitigation planning platform — a serious public-information site for emergency managers, county planners, and citizens. The visual identity communicates authority, trust, and accessibility through a deep steel-blue palette, restrained use of amber/yellow as the sole warm accent, and Oswald (display) paired with Proxima Nova (body) as its two-family type system.

The defining surface texture is a topographic line-art background (topolines.png) used on the page canvas, masked behind a near-white or dark wash. Content lifts off this canvas on white rounded cards with a soft shadow.

---

## Folder structure

```
mny/design/
├── README.md                         ← this file
├── ds-nav.js                         ← the floating nav widget, shared by every page
│                                       section-contextual: lists the current section's
│                                       pages + one jump link per other section
├── theme/
│   └── index.css.additions           ← @font-face aliases + brand surface utilities
│                                       canonical source; linked by all mockup pages
├── design-system/                    ← five DMS-shaped documentation pages
│   ├── theme.html                      color / type / icons / spacing / shadows
│   ├── layouts.html                    Layout + LayoutGroup variants (page chrome)
│   ├── grid.html                       sectionArray column grid
│   ├── components.html                 every UI primitive skinned in the mny brand
│   └── patterns.html                   composed multi-primitive patterns
├── pages/                            ← example product surfaces in the mny brand
│   ├── home.html · home-v2.html        public landing
│   ├── section-landing.html            a topic landing page
│   ├── actions-dashboard.html          action tracking for one county
│   ├── actions-prioritize.html         prioritize actions — list/worklist view (stat strip + filter bar + editable table)
│   ├── actions-prioritization.html     prioritize actions — card view (tiers across counties)
│   ├── actions-location-overview.html  MapLibre map (donut clusters by status) + statewide exec summary
│   ├── datasets-files.html             the datasets pattern
│   ├── site-management*.html           admin surfaces
│   ├── admin-home-v2.html              ADMIN PANEL HOME — redesign of live page 2379993.
│   │                                   ⚠ THE ONE PAGE HERE DRAWN INSIDE THE ADMIN SHELL: 302px
│   │                                   sidenav to scale, NO topnav (admin sets topNav.size:'none'),
│   │                                   bands that are already white cards, and the real
│   │                                   **908px section canvas** (sectionArray caps every group at
│   │                                   max-w-[1020px] minus 56px gutters, at ANY viewport width).
│   │                                   Read its header comment before drawing any admin-pattern
│   │                                   page — the 1440px full-bleed canvas the other mockups use
│   │                                   does not exist inside /admin.
│   │                                   Content: dark identity band · the four 44 CFR 201.6 plan
│   │                                   elements 4-across · six dataset tiles 3-across · three
│   │                                   destinations across. No band is split, no rowspan used.
│   ├── admin-home.html                 earlier admin landing (2026-07 pass; superseded by v2)
│   ├── admin-forms.html                PLAN DATA · task view — dataset index, statewide scope,
│   │                                   Browse/Add/Bulk-edit per card. Redesign of Forms (1336681).
│   ├── admin-forms-insights.html       PLAN DATA · insight view — county-planner audience,
│   │                                   measured county-scoped metrics, one button per dataset.
│   │                                   This is the one built live on page 2369408.
│   ├── admin-forms-lisa-frank.html     PLAN DATA · palette study (Lisa Frank). Same data, for fun.
│   ├── admin-{state,county,jurisdiction}-actions-*.html
│   │                                   15 tier-duplicated Actions pages (2026-07 Phase 1;
│   │                                   superseded shape — see the redesign task doc)
│   ├── plan-status-dashboard.html      county plan-health metrics (adoption, coverage, NFIP)
│   ├── lhmp/                         ← LHMP DESIGN — the public county plan surfaces
│   │   └── home.html                   PLAN HOME — redesign of the county template home
│   │                                   (pattern 1300890, page 1300803, driven by the
│   │                                   pattern-level `geoid`). Geography prose in the
│   │                                   header beside the county photo; three stacked 9-wide
│   │                                   prose sections (demography · major industries ·
│   │                                   climate outlook) with a County facts card beside
│   │                                   them; the dominant hazard pulled out as
│   │                                   the page's focus object with the other ten as a bar
│   │                                   list; actions and jurisdictions as meters; and the
│   │                                   six lexical nav blocks collapsed into four Explore
│   │                                   cards carrying every page of the plan (56 links,
│   │                                   33 pages). Real Sullivan County data throughout
│   │                                   (geoid 36105).
│   ├── lhmp-admin/                   ← LHMP ADMIN — plan-status surfaces (2026-08)
│   │   ├── plan-status-admin.html      plan status · in the admin panel (Direction A)
│   │   └── plan-status-plan.html       plan status · in the plan (Direction B)
│   └── county-actions/               ← COUNTY ACTIONS WORKFLOW — one linked 6-page flow
│       ├── dashboard.html              1 · county actions dashboard (stats + map + table + gap hand-off)
│       ├── jurisdictions.html          2 · pick a jurisdiction, or tier the whole county
│       ├── jurisdiction-prioritization.html
│       │                               3 · one jurisdiction's worklist — LOCAL priority + the
│       │                                   needs-attention band + create-action modal
│       ├── workspace.html              4 · county worklist — COUNTY priority, the only editable column
│       ├── action-view.html            5 · read one action (redesign of the live /actions/view)
│       └── action-edit.html            6 · edit one action (same IA, editable + sticky save bar)
├── reports/                          ← data-analysis reports (NOT for DMS migration)
│   ├── actions-qa.html                 actions data-quality / location-precision audit
│   ├── duplicate-actions.html          same-place redundant rows — cause + safe-to-delete case
│   ├── boilerplate-actions.html        cross-jurisdiction template reuse — where + how to shape it
│   ├── location-from-text.html         recovering site coords from action text (mining the descriptions)
│   ├── capabilities-vs-capacity.html · capability-inventory.html · capacity-assessment-architecture.html
│   │                                   the capability/capacity concept + data series
│   ├── priority-coverage.html · state-capability-catalog.html
│   ├── admin-panel-information-architecture.html   the July 2026 within-panel consolidation study
│   ├── admin-workflow-current-state.html            ┐ Admin Panel Review series (2026-08):
│   ├── admin-direction-consolidate.html             │ current state · Direction A (clean up /admin)
│   ├── admin-direction-dissolve.html                ┘ Direction B (move work into the plan; recommended B1)
│   ├── admin-panel-status.html         page-by-page status of admin pattern 566466 — IA diagram with
│   │                                   per-page status, the form-family analogy matrix, every dead
│   │                                   link, the county_template (1300890) → /admin audit, and a
│   │                                   fix list grouped by type
│   ├── admin-panel-status-v2.html      the same audit narrowed to the planner-facing panel: the seven
│   │                                   form families (Actions, Capabilities, Hazards of Concern, High
│   │                                   Hazard Dams, Participation, Roles, Jurisdictional Annex Entry)
│   │                                   plus Home and the Forms hub — everything under other_forms
│   │                                   dropped. Assumes NO page naming convention: the only question
│   │                                   asked of a link is whether its target exists. Centrepiece is
│   │                                   the create story — the modals are authored on 19 pages and
│   │                                   nothing can open them.
│   ├── admin-panel-fix-list-v2.csv     the v2 fix list as a tracking sheet — 50 rows, same fix IDs as
│   │                                   the report, with Status / Assigned to / Date fixed / Notes
│   │                                   columns left empty
│   ├── admin-panel-status-v3.html      the v2 audit re-run on 2026-08-14 against a fresh harvest, same
│   │                                   scope. Verdict on all 50 v2 fixes (19 live dead links → 1), plus
│   │                                   four new passes: a create-button/modal diagnostic (23 modals, 0
│   │                                   triggers, 21 CREATE buttons repointed at an empty target), a
│   │                                   fetch-mode audit (22 of 158 data components on Force), a
│   │                                   county/jurisdiction geoid ⁄ geoid_juris binding audit, and the
│   │                                   LHMP_IA text-box permission review on the annex page. Leads with
│   │                                   what the DEPLOYED bundle actually supports, since that decides
│   │                                   which findings are live and which are latent until the next deploy.
│   ├── admin-panel-fix-list-v3.csv     the v3 fix list as a tracking sheet — 254 rows in 9 types, same
│   │                                   fix IDs as the report, with a v2 ID column for traceability and
│   │                                   Status / Assigned to / Date fixed / Notes left empty
│   ├── admin-panel-status-v4.html      2026-08-17 (rev 2). Narrower scope again — six families (High
│   │                                   Hazard Dams out) plus Home and the Forms hub. Leads with the DELETE
│   │                                   LIST: 40 dropped-section component IDs (20 published + 20 draft),
│   │                                   quarantined so every other fix type excludes anything inside them.
│   │                                   rev 2 applied two client directions: the create modals are ACCEPTED
│   │                                   as configured (72 items retired), and Force + Smart are both
│   │                                   acceptable fetch modes, so fetch mode became a four-way INVENTORY
│   │                                   (force / smart / cache / no setting selected) reporting both the
│   │                                   stored setting and the resolved behaviour. rev 3 re-harvested after
│   │                                   the capabilities/view fix: all 145 in-scope components now re-query
│   │                                   (0 resolve to Cache), so fix type 2 is CLOSED. Result: 0 reachable
│   │                                   dead links, 48/48 row actions correct, every page acceptable on
│   │                                   fetch mode, and 68 tracked fixes — 40 of them the delete list.
│   ├── admin-panel-fix-list-v4.csv     the v4 fix list as a tracking sheet — 68 rows in 4 open types, with a
│   │                                   Component ID column and Status / Assigned to / Date fixed / Notes
│   │                                   left empty
│   └── admin-panel-fetchmode-v4.csv    the full fetch-mode inventory — 145 rows, one per fetch-mode-capable
│                                       component in scope: page, dataset, stored setting, readyToLoad,
│                                       resolved behaviour, acceptable y/n, in-create-modal y/n
├── assets/mny/                       ← logo, topolines, hazard glyphs, county art
└── references/                       ← original Figma handoff exports (read-only)
    └── MitigateNY UX_UI [...]/*.jpg
```

> **`reports/` vs `pages/`.** `pages/` holds product-surface mockups meant to be built as real DMS
> pages. `reports/` holds standalone **analysis outputs** — HTML that renders a data finding for a
> human, never intended to migrate to DMS. They still wear the mny brand (same tokens, hero, nav
> widget) so a finding reads like part of the product.
>
> The three `reports/*.html` are backed by **real data** — every number comes from
> `references/actions/` (analysis scripts in `references/actions/scripts/`, findings in
> `references/actions/report/actions-data-quality.md`), not from placeholder copy.
> `pages/actions-location-overview.html` loads MapLibre GL + the generated
> `assets/mny/data/actions_locations.geojson`, so it (and the reports, for their relative asset
> links) must be viewed over a local server (`python3 -m http.server` in `design/`), not `file://`.
> The same applies to `pages/county-actions/dashboard.html`, which fetches
> `assets/mny/data/sullivan_boundaries.geojson` and `sullivan_actions.geojson`.

---

## `ds-nav.js` — the nav widget

Every page in `design-system/`, `pages/` and `reports/` ends with one line:

```html
<script src="../ds-nav.js"></script>       <!-- ../../ from pages/county-actions/ -->
```

The widget is **section-contextual**, mirroring how a real DMS site navigates. It reads
`location.pathname`, finds which of the eight sections owns the current page, and renders:

1. **the current section, expanded** — its pages numbered in flow order, the current one
   highlighted in `yellow-700` on a `yellow-50` row;
2. **`jump to section`** — one link per *other* section, pointing at that section's landing
   page with its page count.

So the panel is 9–11 links instead of the 22-link flat dump the old inline widget carried, and
any page is at most two hops from any other. The sections are the site's real IA:

| Section | Folder | Landing |
|---|---|---|
| Design System | `design-system/` | `theme.html` |
| Public Site | `pages/` | `home.html` |
| Actions (Statewide) | `pages/` | `actions-dashboard.html` |
| County Actions Workflow | `pages/county-actions/` | `dashboard.html` |
| Admin Panel | `pages/` | `admin-home-v2.html` |
| Site Management | `pages/` | `site-management-v2.html` |
| Authoring Reference | `pages/` | `page-templates.html` |
| LHMP Admin | `pages/lhmp-admin/` | `plan-status-admin.html` |
| LHMP Design | `pages/lhmp/` | `home.html` |
| Reports | `reports/` | `actions-qa.html` |

**Adding a page: add one line to that section's `pages` array in `ds-nav.js`, and the script tag
to the page.** Nothing else. A section's `dir` may be nested (`pages/county-actions`) — hrefs are
recomputed from the current page's depth, so no section needs to know where another one lives, and
the relative paths hold whether you serve `design/` as the root or open a file directly.

Widget styling stays out of `theme.js` — it is review scaffolding and never ships on a live site.

---

## `pages/county-actions/` — the County Actions Workflow

One **linked six-page flow**, not six independent mockups: a planner moves
dashboard → jurisdictions → jurisdiction prioritization → county workspace → action view ⇄
action edit, and every page carries the breadcrumb and footer index back out. It is the design
for the live `actions` pattern
(`mitigat-ny-prod`, pattern `2265530`, base_url `actions`), whose `view` page is currently the
actions form transcribed as eight flat half-width Cards.

**Every number, name and quoted sentence on these six pages is real Sullivan County data** —
geoid `36105`, 475 actions across 23 jurisdictions, pulled from the DMS internal actions dataset
(source `1029065` / view `1074456`). **One exception, stated on the page itself:** the
local-priority *fill* figures on `jurisdiction-prioritization.html` are placeholders —
`local_priority` isn't in the baked aggregate, so refresh them from the source before quoting
them. Fallsburg's status split on that page (30 actions · 28 proposed · 1 active · 1 done) is
real. Aggregates are baked by
[`references/actions/scripts/16_sullivan_map.mjs`](../../../../references/actions/scripts/16_sullivan_map.mjs)
into `references/actions/data/sullivan_stats.json`; re-run it to refresh them. The specimen action
on pages 4 and 5 is id `1100379` (*Delaware — Kohlertown Route 52, Culvert Issues*), prose verbatim.

**Layout rule for this section: one boxed `content` LayoutGroup per page, and nothing on the topo
canvas.** No page here uses an unboxed `header` or `footer` group — identity bands, stat strips and
the footer page index all sit inside the white surface with everything else, and the topo texture
shows only in the Layout's outer gutter. Only genuinely fixed chrome floats over the canvas (TopNav,
the `action-edit` sticky save bar, the design-system widget). Note the knock-on when copying patterns
out of these pages: chrome toned for the topo canvas (`bg-white` pills, `hover:bg-white`) goes
invisible on the white surface — the tinted `bg-mny-50` variants here are the version that reads.

**Two worklists, one editable column each.** The split is the load-bearing idea of the section:
`jurisdiction-prioritization.html` is a jurisdiction working its own actions — it owns **local
priority** plus the three data-completeness gaps (action type, cost range, critical facility), and
it hosts the **Needs your attention** band, because a gap tile has to land somewhere the fix is
possible. `workspace.html` is the county tiering across jurisdictions, and **county priority is
its only editable column**; the other three columns stay visible there because a tier can't be
judged without them, but they are read-only. So `jurisdictions.html`'s 23 tiles all open the
jurisdiction worklist, and only the explicit all-475 route opens the county workspace.

Two facts the pages state rather than hide, because they shape the design:

- **County priority is unset on all 475 actions.** The county workspace's progress meter is
  therefore empty by design — that is the job the page exists to do, not a placeholder.
- **Nothing in Sullivan has a site coordinate.** 472 mapped actions sit on 26 town/county
  centroids, so the dashboard map draws the **county outline and 21 jurisdiction polygons** under
  the donut clusters: the polygon is the real unit of precision, and the caveat panel says so.
  Ateres (Village) has 11 actions but no polygon in the NFIP layer, and is flagged as such.

Sullivan was chosen over higher-fill counties (Chemung, Niagara) for continuity with the existing
`actions-prioritize.html` / `actions-dashboard.html` mockups. Its trade-off: `estimated_cost` is
empty on every row and point-of-contact on 439 of 475, so pages 4–5 double as the reference for how
**empty** fields present (collapsed behind a "show 18 empty fields" toggle on view; dashed amber
`.mny-field-empty` inputs on edit).

Full rationale, per-page section tables and the figures: `planning/mitigateny/tasks/current/county-actions-workflow-design.md`.

---

## `pages/lhmp/` — LHMP Design

The **public plan surfaces** — what a resident sees when they open their county's Local Hazard
Mitigation Plan. Distinct from `pages/` (the statewide MitigateNY site), from `pages/lhmp-admin/`
(plan-status surfaces for planners) and from the Admin Panel section (the authoring console).

`home.html` is the redesign of the county template home — live pattern **1300890**
(`MitigateNY_County_Template_V3`, subdomain `county_template`), page **1300803**, driven by the
pattern-level filter `geoid`. **Every number, name and sentence on it is real Sullivan County data**
(geoid 36105): profile prose and plan dates from `DHSES_County_Database` (953754 / v1108098),
hazard losses and disaster counts from `AVAIL - Fusion Events V2` (870 / v1648, `hazmit_dama`),
23 jurisdictions from `Jurisdictions` (1346449 / v1346450), 475 actions from `Actions_Revised`
(1029065 / v1074456). Only the one-paragraph lede and the four Explore column headings are authored
copy — and that copy is identical for all 62 counties.

**The governing constraint is templateability**, carried over from the admin home redesign: *every
band is identical for every county plan; only values and the county name vary — never the copy,
never which cards appear.* This pattern is duplicated into `suffolk_draft` (2249247),
`schenectady_draft` (2304223), `delaware_draft` (2323808) and `MitigateNY_Nassau_V2` (2407262), so a
band that has to be re-authored per county is not a design, it's five maintenance jobs.

What changed from the live page, and why:

**The body is drawn in the `pages/county-actions/` design language** — one boxed content group on a
12-column grid, a reading column beside a sticky facts rail (`action-view.html`), counts rendered as
meters with legends rather than flat tiles (`jurisdiction-prioritization.html`), and a share-of-max
bar list (`dashboard.html`). Only the photo header is its own thing.

| Live | Redesign |
|---|---|
| 11 sections, **2** of them data-bound | 7 sections, **5** data-bound — the page now answers *what is this county* and *what shape is its plan in* from data, not prose |
| A paragraph describing **the template** ("places for counties … to input content") | A 20px lede describing **the plan** — what an HMP is, who adopts it, why it matters |
| No county profile | **Geography in the header; demography · major industries · climate outlook as three stacked 9-wide prose sections** (each set in two CSS columns) with a County facts card spanning them — the section this redesign exists for |
| No plan status anywhere | Status · approved · expires, in the header card, off three columns already on the bound row |
| No sense of scale | 475 actions as a **segmented meter** (391 proposed · 23 in progress · 41 complete · 20 not reported) and 23 jurisdictions broken to towns/villages/county — the numbers given a shape rather than a tile |
| 11 hazards paged **4 at a time**, all tiles the same size | The leader — **hurricane, 91% of all recorded loss** — pulled out as the page's focus object at 36px; the other ten as a bar list scaled to the largest of *them*, so they are legible instead of stubs |
| **Six** lexical blocks for one nav menu (×5 patterns = 30 hand-maintained rich-text bodies) | **One** all-static Card, four **breakout-illustration cards** — one configuration, restyleable from the theme, and the link set becomes data an audit can read |
| Base64 PNGs inlined in lexical | Brand assets from `assets/mny/` |
| **14 links, 3 of them broken, reaching 13 pages** | **56 links reaching 33 distinct pages — every page of the plan**, all 33 slugs checked against the 2026-09-01 harvest |
| Nothing in the header but the county name | The county's own description of itself (`geography_topography`) plus plan status · approved · expires |
| Profile prose in one unbroken run | 2–3 paragraphs per card, each running the **full** DHSES field. **The breaks are not in the data** — all three text fields hold zero newlines and the lexical one is a single paragraph node — so the live build needs authors to add them, or a `formatFn` that splits on sentence groups |

The page's focus ladder is its type ladder: **36px** the dominant hazard · **30px** `$363,792,448`
and `475` · **20px** the page lede · **16px** band and card titles · **14px** prose and card lists ·
**12px** labels and pills.

**The breakout-illustration card** is `pages/home.html`'s device, used twice — three cards for the
county profile, four for the Explore navigation: `pt-[Npx]` on the wrapper reserves the overhang and
the image carries `mt-[-Npx] mx-[-12px] w-[calc(100%+24px)]`, so the isometric render bleeds to both
card edges and rises above the top one.

**The breakout-illustration card is a DOORWAY form** — an illustration, a title, a short link list,
one destination. On this page that is the Explore band at the foot, and only that. Four revisions
went into resizing, cropping and re-scaling it to hold 750 characters of county profile prose before
the container itself turned out to be the problem: at 304px such a card is ~700px tall, and three
side by side own the page. It was never the card that was wrong — it was the card *plus a 1024²
illustration at 304px*. Prose wants a wide card with no render: the LHMP home stacks three Card
sections at 9 columns with the text full width. **Reach for the ILLUSTRATED card when the content is
a list of links.**

**Give the breakout card a ~290–305px column and it needs no correction at all.** That is the width
`home.html`'s 4-across cards and the client's reference image were drawn at, and the width the
LHMP home now uses for *both* its card rows — three profile cards and one info card at 3 columns
each, four Explore cards at 3 columns each. At that width a full-bleed square lands at the right
proportion on its own: `mx-[-12px] mt-[-110px] w-[calc(100%+24px)]`, nothing else.

**Read the rest of this only if a card has to be wider than that.** Every file in
`assets/mny/illustrations/` is **1024×1024 — a square, with a variable amount of transparent padding
baked in**, and that one fact defeats both obvious CSS approaches. `h-[Npx] object-contain` scales the
square to N×N, so on a 414px card the drawing is only 240px wide and floats in ~170px of air, reading
as off-centre and unaligned card to card (each file pads differently). Plain full bleed gets the width
right but makes the image as *tall* as the card is *wide*, which swamps the prose. What works is a
**clipped window**: the image inset and wrapped in a shorter `overflow-hidden flex items-center` box,
so the square's dead top and bottom are cropped. **Use an aspect ratio, not a px height** — a fixed
height is correct at exactly one card width, and the same value that crops 17px at 1440 crops nothing
at 1024 (the float returns) and decapitates the windmill on a wider card. The only card on the LHMP
home that still needs this is the hurricane focus panel, which is 5 columns wide by design: inset to
70% and cropped `aspect-[10/9]`, which lands it at roughly the same *graphic* size as the 304px cards
even though its card is wider.

**The one platform enrichment the page asks for** is a `risk_pill` column type (value → colour, five
documented risk tokens), which the 16 hazard pages would reuse. Everything else is Card configuration.

**Three platform findings were logged building it** (see the task file): `mnyHeaderDataDriven.jsx:113`
sets `lg:w-[1440px]`, which scrolls every page with a full-overlay header sideways between 1024 and
1440; `border-l-4 border-<c> border-y border-r border-<c2>` silently loses its coloured edge (both
utilities set all four sides, the later CSS rule wins) — **several `pages/county-actions/` bands use
that shape** and are probably rendering flat boxes where an accent edge was intended; and
`mnyHeader`'s `note` is a single string, so the header can hold only one prose slot, which is what
`geography_topography` in the header needs.
Full spec, the datasource review and the open questions:
[`planning/mitigateny/tasks/current/mny-county-template-home-redesign.md`](../../../../planning/mitigateny/tasks/current/mny-county-template-home-redesign.md).

---

## Color tokens

| Token name       | Hex       | Role                                    |
|------------------|-----------|-----------------------------------------|
| `blue-900`       | `#2D3E4C` | ink — headings, section titles          |
| `blue-700`       | `#37576B` | body text, icons, links                 |
| `blue-400`       | `#6D96AE` | secondary accents, placeholder text     |
| `blue-200`       | `#C5D7E0` | dividers, tag backgrounds, borders      |
| `blue-100`       | `#E0EBF0` | hover tints, submenu backgrounds        |
| `blue-50`        | `#F3F8F9` | table header bg, subtle section fills   |
| `yellow-700`     | `#EAAD43` | primary CTA, heading underline accent   |
| `yellow-500`     | `#F1CA87` | softer accent, save buttons             |
| `yellow-50`      | `#FCF6EC` | accent tint background                  |
| `white`          | `#FFFFFF` | cards, nav, overlays                    |
| `page-bg`        | `#F4F4F4` | topo-textured canvas base               |
| `red-700`        | `#AA2E26` | danger dark                             |
| `red-500`        | `#DD524C` | error / cancel / delete                 |
| `orange-400`     | `#EA8954` | warning / high-risk indicator           |
| `green-700`      | `#54B99B` | success / very-low-risk indicator       |

---

## Type tokens (textSettings)

Two font families: **Oswald** (display, always uppercase) and **Source Sans 3** proxy for **Proxima Nova** (prose).

| Token          | Family      | Size  | Weight | lh    | Other          | Role                          |
|----------------|-------------|-------|--------|-------|----------------|-------------------------------|
| `displayHero`  | Oswald      | 96px  | 500    | 95%   | uppercase, -track | Hero KPI numbers, splash heads |
| `displayXL`    | Oswald      | 72px  | 500    | 100%  | uppercase      | Large stat banners            |
| `displayLG`    | Oswald      | 60px  | 500    | 100%  | uppercase      | Section number callouts       |
| `displayMD`    | Oswald      | 48px  | 500    | 100%  | uppercase      | Feature headings              |
| `displaySM`    | Oswald      | 36px  | 500    | 100%  | uppercase, -track | H1 page titles             |
| `displayXS`    | Oswald      | 30px  | 500    | 100%  | uppercase, -track | H2 / sub-headings           |
| `metaLG`       | Oswald      | 24px  | 500    | 100%  | uppercase      | Card section titles           |
| `metaMD`       | Oswald      | 16px  | 500    | 100%  | uppercase      | Table headers, eyebrows       |
| `metaSM`       | Oswald      | 14px  | 500    | 100%  | uppercase      | Column headers, labels        |
| `metaXS`       | Oswald      | 12px  | 500    | 100%  | uppercase      | Pagination, micro labels      |
| `proseLG`      | Proxima Nova| 20px  | 400    | 140%  |                | Lead body text                |
| `prose`        | Proxima Nova| 16px  | 400    | 140%  |                | Body text (base)              |
| `proseSM`      | Proxima Nova| 14px  | 400    | 140%  |                | Table cells, captions         |
| `proseXS`      | Proxima Nova| 12px  | 140%   |       |                | Attribution, footnotes        |

Modifier axes (not separate tokens): color (`text-[#37576B]` / `text-white`), weight (`font-semibold`/`font-bold`), italic, `uppercase`, `tabular-nums`.

---

## Radius

- `rounded-sm` (2px) — tooltip/legend chips, input chips
- `rounded-[12px]` — cards, nav panels, table containers, overlays
- `rounded-full` (1000px) — buttons, pill tags, input fields

---

## Shadows

- `mny-shadow-sm` — `0px 0px 6px 0px rgba(0,0,0,.02), 0px 2px 4px 0px rgba(0,0,0,.08)` — cards, form elements
- `mny-shadow-md` — `0px 0px 4px 0px rgba(0,0,0,.04), 0px 4px 8px 0px rgba(0,0,0,.06)` — layout white-card panels

---

## Layout choices

- Max page width: **1440px** (`max-w-[1440px] mx-auto`)
- Content cap (centered sectionArray): **1020px** (`max-w-[1020px] mx-auto`)
- Side gutters: `md:px-4 xl:px-[64px]` (16px → 64px)
- TopNav: **floating** — fixed, rounded at md+, 80px height, white bg, shadow
- SideNav: optional (compact 302px or icon-only 64-84px strips)
- LayoutGroup content wrapper: `pt-[118px]` offset to clear the floating nav

---

## What this theme is designed for

✅ Public information / risk-assessment dashboards  
✅ Data-heavy pages with tables, statistics, and hazard cards  
✅ Long-form content with typographic hierarchy  
✅ Map workbench pages  
✅ Auth (sign-in) pages  

Not designed for: print-first layouts, dark-mode-first surfaces.

---

## Translation

Hand this design system to `translating-design-system-to-dms-theme.md` to produce the
runnable `theme/theme.js` overlay. The current `src/themes/mny/theme.js` is the live
production theme and can be reconciled against the design system specification here.
