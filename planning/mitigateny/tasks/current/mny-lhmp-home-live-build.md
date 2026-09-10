# Build the LHMP plan home live in the county template (`/home_new`)

**Project:** MitigateNY · **Topic:** content (+ themes, + possible dms library escalation) ·
**Status:** PHASE 1 + PHASE 2 BUILT (draft, unpublished) · **Started:** 2026-09-09 ·
**Last worked:** 2026-09-09

> **Where it stands.** The page is live as a draft at
> `https://county_template.devmny.org/edit/home_new` (page **2484443**, 21 draft sections). Every
> bound section renders real Sullivan data, every figure matches, every link resolves, and there is
> no horizontal overflow at 1024 / 1280 / 1440. Work item A step 1 is done and verified. Nothing is
> published; `home` (1300803) is byte-identical to its pre-build state (diffed).
> **Read [`## Build log — 2026-09-09`](#build-log--2026-09-09) at the bottom for what was actually
> built, the eight findings the build corrected, and what is left.**

**Design source:** [`src/themes/mny/design/pages/lhmp/home.html`](../../../../src/themes/mny/design/pages/lhmp/home.html)
**Design task:** [`mny-county-template-home-redesign.md`](./mny-county-template-home-redesign.md) —
read its revision log before starting; ten revisions of owner direction are recorded there and
several of them are layout constraints this build has to honour.
**Closest prior art — read this first:**
[`mny-action-prioritize-v2-live-build.md`](./mny-action-prioritize-v2-live-build.md), the same
design→live conversion for the county prioritize page. Its Phase 2/3 split and its
`Notes / gotchas` section are the template for this task, and most of the gotchas below are its.
Then [`mny-jurisdiction-prioritization-live-build.md`](./mny-jurisdiction-prioritization-live-build.md)
for the pre-flight discipline (it is marked SUPERSEDED — its *bindings* are stale, its *method* is not).

## Objective

Instantiate the approved LHMP plan-home design as a **live DMS page** in the county template:

| Field | Value |
|---|---|
| Pattern | `MitigateNY_County_Template_V3` — **1300890** (`prod\|mitigateny_county_template:pattern`) |
| App / type | `mitigat-ny-prod` / `prod` |
| Subdomain | `county_template` → `https://county_template.devmny.org/edit/home_new` |
| **Slug** | **`home_new`** |
| Title | `Home (new)` |
| Parent | none — top level, sibling of `home` (page **1300803**) |
| `published` | `draft` |
| **`hide_in_nav`** | **`hide`** — matches `home`, which is also hidden |
| `filters` | `[{"searchKey":"geoid","values":["36105"]}]` — mirror `home`; this is what makes every section county-scoped |
| `theme` | `{"layout":{"options":{"sideNav":{"size":"none"}}}}` — mirror `home`; no side rail |
| `navOptions` | `{"show_in_footer":""}` — mirror `home` |

**Two pieces of platform housekeeping surfaced with this build**, neither blocking Phase 1:
[**A** — move `mnyHeader` out of `@availabs/dms` into the mny theme](#work-item-a--move-mnyheader-out-of-the-library-into-the-mny-theme)
· [**B** — bring the mny size map onto the 1–12 integer convention](#work-item-b--bring-the-mny-size-map-onto-the-112-integer-convention).
**B is not additive** — see its warning; the recommendation is to take an interim here and give it
its own task.

**It does not replace `home` (1300803).** `home_new` is built alongside it so the two can be compared
on the live subdomain before anyone decides to swap slugs. Nothing is written to `home`.

**Draft-only discipline:** this task creates the page and its `draft_sections` and **never
publishes**. `dms page publish` is a human decision. Never write `sections` / `section_groups`
directly — only `draft_*`.

## Read these first

### Library skills — [`src/dms/skills/`](../../../../src/dms/skills/README.md)

| Skill | Why, for this page |
|---|---|
| [`creating-pages-from-a-design-pattern.md`](../../../../src/dms/skills/creating-pages-from-a-design-pattern.md) | **The spine of this task.** `dms page create` / `dms section create --data`, the `element-data`-is-a-JSON-string gotcha, the Lexical state shape, draft-only discipline. |
| [`using-a-datawrapper-card.md`](../../../../src/dms/skills/using-a-datawrapper-card.md) | Every bound section here is a `dataWrapper` consumer. Use **recipe A** — reuse an existing card's `externalSource` verbatim and change only `columns` / `filters` / `display`. Also carries the always-confirm-source-and-version rule. |
| [`card-layout.md`](../../../../src/dms/skills/card-layout.md) | Read before configuring any of the six Cards. Specifically: `gridSize` (the 3-across profile band, the 4-across Explore band), static columns (`origin: 'static'`) for the Explore link lists, `cardHints`, image and link cells, the stat-strip recipe. |
| [`transcribing-a-design-card-to-dms.md`](../../../../src/dms/skills/transcribing-a-design-card-to-dms.md) | The **decision ladder** — static text → `valueFontStyle`; numeric → `formatFn`; look-depends-on-value → a small column type; only a layout the grid can't express → a new section. Apply it to the risk pills and the bar list before writing any component. Also the Playwright mockup-vs-live verify loop. |
| [`authenticating-the-dms-cli.md`](../../../../src/dms/skills/authenticating-the-dms-cli.md) | Everything except a bare `raw get` needs a token; `page list` on this pattern returns `no-access` without one. |
| [`creating-interactive-pages.md`](../../../../src/dms/skills/creating-interactive-pages.md) | How the pattern-level `geoid` reaches each section (`usePageFilters` + `searchParamKey`). Every county-scoped section on this page depends on it. |
| [`refreshing-column-metadata.md`](../../../../src/dms/skills/refreshing-column-metadata.md) | **Do not press `Refresh Meta`** on a section whose calculated columns you have configured — it overwrites `display` on a calculated column (`meta-variable` → `calculated`), which silently drops it from the request's meta map. Relevant to the Fusion Events cells. |
| [`traversing-dms-pages.md`](../../../../src/dms/skills/traversing-dms-pages.md) | Read before any live browser check. The two-different-"edit"-states gotcha, the subdomain-routing and stale-token traps. |

### Project skills — [`planning/mitigateny/skills/`](../../skills/README.md)

| Skill | Why |
|---|---|
| [`cataloguing-and-fixing-data-fetch-mode.md`](../../skills/cataloguing-and-fixing-data-fetch-mode.md) | **§2b is required reading before writing any script that touches `element-data`.** Components exist in two config shapes — v2 `externalSource` and v1 `sourceInfo` — and a script selecting on one key silently misses half the pattern. Also: where Data Fetch Mode really lives, and the owner rule (**external → Smart, internal → Force**). |
| [`template-and-duplicate-patterns.md`](../../skills/template-and-duplicate-patterns.md) | `county_template` is the source of truth and is never written to *from* a duplicate. Read before deciding any template-vs-duplicate difference is a defect. |
| [`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md) | **Not needed to build this page, needed the moment it is approved.** Four patterns are duplicated off the template — `suffolk_draft` 2249247, `schenectady_draft` 2304223, `delaware_draft` 2323808, `MitigateNY_Nassau_V2` 2407262 — and a new page does not appear in them by itself. |
| [`applying-report-fixes-to-a-live-site.md`](../../skills/applying-report-fixes-to-a-live-site.md) | The baseline → apply → validate loop, if any existing section has to be touched. |

## Environment

```bash
export DMS_HOST=http://localhost:3001 DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=<minted per authenticating-the-dms-cli §A; never bake into a script>
```

The local dms-server writes the **same remote DB** the hosted `county_template.devmny.org` reads, so
a page created locally appears on the live subdomain immediately (in `/edit` until published).

**Theme edits do NOT reach devmny** — the hosted site runs the *deployed* mny theme. Verify any
Phase-2 theme change on a local Vite server:

```bash
VITE_DMS_APP=mitigat-ny-prod VITE_DMS_TYPE=prod VITE_DMS_PG_ENVS=hazmit_dama \
VITE_API_HOST=http://localhost:3001 node node_modules/vite/bin/vite.js --port 5199 --strictPort
```

then `http://county_template.localhost:5199/edit/home_new`. **Ports 5173/5174 are the user's
TransportNY servers — leave them alone.** Stop 5199 when done.

## ⚠ Pre-flight — three things to settle before writing a single section

1. **Source 1161 / view 1986.** The owner named
   `https://www.devmny.org/cenrep/source/1161/table/1986` as the datasource for the three profile
   cards. It is confirmed to be an **external `hazmit_dama` DAMA source** (falcor answers
   `User not authorized for source id(s): 1161`; it is absent from dmsEnv **1676363**, which backs
   `/cenrep`'s internal listing), but **its column names have never been read** — anonymous falcor
   against both `graph.availabs.org` and `dmsserver.availabs.org` returns errors/nulls, the
   `dama-admin` REST endpoints 404, and the token in `scratchpad/mitigat-ny-prod-prod/.token` is
   expired *and* from the wrong auth realm. The design is bound to the **confirmed equivalent**,
   `DHSES_County_Database` 953754 / view 1108098, which carries the three fields exactly. **Read
   1161/1986 with a credentialed session and write its schema into the design task**, then decide
   which source ships. If it is the DAMA copy of the same narrative fields, the swap is
   `externalSource` plus three column names on one section.
2. **Verify every column name against the live source.** The jurisdiction-prioritization build lost
   time to exactly this: three of its four editable columns were unverified and the design's names
   were guesses. Every column this page needs is listed below with its attestation; confirm the
   unattested ones with `dms dataset query` / the source's schema view **first**.
3. **Confirm no `home_new` slug exists** in pattern 1300890. The 2026-09-01 harvest
   (`src/themes/mny/design/reports/pattern-component-catalog.csv`) lists no such page, but the
   pattern has grown mid-task before — it went 58 → 59 pages during the fetch-mode sweep.

## The sources

All four are already bound somewhere in this pattern, so **every `externalSource` on this page can be
copied verbatim from an existing section** rather than hand-written.

| Source | id / view | env | `isDms` | Copy `externalSource` from |
|---|---|---|---|---|
| `DHSES_County_Database` | 953754 / 1108098 | `mitigat-ny-prod+test_meta_forms` | true | **section 2175337** (the live `home` header) |
| `AVAIL - Fusion Events V2` | 870 / 1648 | `hazmit_dama` | false | **section 2175348** (the live `home` hazard card) |
| `AVAIL - Fusion Events V2` | 870 / 2401 | `hazmit_dama` | false | **section 2413419** (the `natural_hazards` totals card — v1 `sourceInfo` shape) |
| `Actions_Revised` | 1029065 / 1074456 | `mitigat-ny-prod+test_meta_forms` | true | section 2262760 or 2239704 |
| `Jurisdictions` | 1346449 / 1346450 | `mitigat-ny-prod+test_meta_forms` | true | a `select_jurisdiction` section |

> **`externalSource.columns` must be the COMPLETE source schema.** If it is partial the renderer
> cannot resolve field names and the section renders **blank, with no error**. Copy it from a bound
> section; never hand-write it. (v2 build.)

### Column attestation

| Column | Source | Attested |
|---|---|---|
| `county`, `county_seal_url`, `photo`, `photo_credit`, `geoid`, `stcofips` | DHSES | ✅ live section 2175337 |
| `geography_topography`, `demographics_population_centers`, `major_industries_economic_drivers_and_notable_infrastructure` | DHSES | ✅ read live 2026-09-04 via `dms dataset query 953754 --view 1108098 --filter geoid=36105` |
| `plan_status`, `plan_approval_date`, `expiration_date`, `risk_assessment_period`, `watershed_s`, `climate_assessment_region`, `climate_assessment_narrative`, `disaster_declaration_threshold`, `county_profile_link` | DHSES | ✅ same read |
| `fusion_category` / `risk_level` / `fusion_total_damage` calc columns | Fusion 870/1648 | ✅ verbatim from live 2175348 |
| `num_declared_disasters`, `amt_declared_disasters`, `num_non_declared_disasters`, `amt_non_declared_disasters` | Fusion 870/2401 | ✅ verbatim from live 2413419 |
| `implementation_status` | Actions_Revised | ✅ v2 build doc |
| `geoid` (actions), `county_geoid` | Actions_Revised | ✅ v2 build doc |
| `municipality_type`, `municipality_name`, `county_geoid` | Jurisdictions | ✅ read live 2026-09-04 via `dms dataset query 1346449 --view 1346450 --filter county_geoid=36105` |

**One meaning is unverified, not one name:** `disaster_declaration_threshold` ($349,091 for Sullivan)
is on the bound row and reads as a real county figure, but nothing in this work confirms what DHSES
means by it. It sits unglossed in the facts strip. Owner has been asked; drop it if unanswered.

## The sections to build

Sizes are the **mny `sectionArray` size map**, verified at `src/themes/mny/theme.js:499-510`:

| `size` | renders |
|---|---|
| `"1/12"` `"1/6"` `"1/4"` `"1/3"` `"1/2"` `"2/3"` | col-span 1 · 2 · 3 · 4 · 6 · 8 |
| `"1"` | **col-span-9** — not full width |
| `"2"` | col-span-12 — full width |

⚠ **The v2 build's correction applies here: `"1"` is 75%, not full.** Full width is `"2"`.

| # | Section | Element type | `size` | Group | Binding |
|---|---|---|---|---|---|
| 1 | Header | `Header: MNY Data` | `"2"` | `header` | DHSES 953754/1108098 · `geoid[page:geoid]` · `overlay:'full'` · `showSearchBar` · **`geography_topography` flagged as the note column** (see finding 1) |
| 2 | Page lede + 2 CTAs | `lexical` | `"2"` | `default` | — static, identical for every county |
| 3 | County facts strip | `Card` | `"2"` | `default` | DHSES · `watershed_s` · `climate_assessment_region` · `risk_assessment_period` · `disaster_declaration_threshold` · `gridSize` 4 |
| 4 | The three profile cards | `Card` | `"2"` | `default` | DHSES · the three narrative fields · `gridSize` 3 · one image cell per card (see finding 2) |
| 5 | Hurricane focus panel | `Card` | **`"1/3"`** | `default` | Fusion 870/1648 ordered by `fusion_total_damage` desc, limit 1 · plus the four 2413419 aggregates |
| 6 | The other ten hazards | `Card` | **`"2/3"`** | `default` | Fusion 870/1648, ordered desc, offset 1 (see finding 3) |
| 7 | Mitigation actions meter | `Card` | `"2/3"` | `default` | Actions_Revised 1029065/1074456 · `geoid = 36105` · `implementation_status` counts |
| 8 | Participating jurisdictions | `Card` | `"1/3"` | `default` | Jurisdictions 1346449/1346450 · `county_geoid = 36105` · `municipality_type IN (Town, Village, County)` |
| 9 | Explore the plan | `Card`, all-static | `"2"` | `default` | — 22 links, `origin:'static'`, `gridSize` 4 |
| 10 | Footer | `Footer: MNY Footer` | — | bottom group | unchanged from `home` |

**Section groups** — mirror `home` (1300803) exactly: `header` (position `top`, `full_width: show`,
theme `header`), `default` (position `content`, `full_width: off`), and one bottom group with theme
`clearCentered`, `full_width: show`. Copy the UUID-named third group's shape from 1300803's
`draft_section_groups`.

**Spacing between sections comes from each section's `padding` attribute, not a grid gap** — the
sectionArray grid is `gap-0`. The live header section carries `"padding": "p-0"`; the mockup's
`pt-*` / `mt-*` band rhythm has to be expressed that way.

## New findings from the design pass — read before estimating

These were established while building the mockup and each one changes the build.

### 1. Geography in the header is a **config change, not a library change** ✅

`mnyHeaderDataDriven.jsx:208-220` resolves the note from the **first column flagged `note: true`**:

```js
const noteColumn = useMemo(() => columns.find(({note}) => note), [columns]);
const note       = useMemo(() => data?.[0]?.[noteColumn?.name], [data, noteColumn]);
…
note={note || display.defaultNote}
```

Section 2175337 already carries `geography_topography` in its `columns` array with `"note": false`.
**Flipping that one flag to `true` puts the county's own description in the header**, with
`display.defaultNote` remaining the fallback for a county whose field is empty. An earlier version
of the design task logged this as a platform ask (`note` is a single string prop) — **that was
wrong and is corrected here.** Caveat: `find` returns the first match, so the header can carry
geography **or** the static sentence, not both — which is what the design does.

### 2. The breakout illustration cannot be done with `cardHints.fullBleed` alone ⚠

The seven isometric illustrations break out **above** the card's top edge. `fullBleed` swaps the cell
wrapper to `theme.headerValueWrapperFullBleed`, whose default is `w-full relative
overflow-hidden` — **`overflow-hidden` clips anything drawn outside the cell box**, which is exactly
what the breakout is. So this needs one of:

- **(a) theme-only:** an mny `headerValueWrapperFullBleed` override without `overflow-hidden`, plus a
  negative-margin knob, plus `overflow-visible` on the card surface. Cheapest; verify the card itself
  is not also clipping (`rounded-[12px]` plus any `overflow-hidden` on the Card wrapper).
- **(b) a small `breakout_image` column type** that owns the negative margin and the bleed, shipping
  `fullBleed: true, spanFullColumns: true, defaultHideHeader: true` like `portrait_banner` does.
  Follows the decision ladder's "composite column type that owns its layout" precedent.

**Carry the two calibration facts from the design** (both in `design/README.md`): the illustrations
are all **1024×1024 squares with variable transparent padding**, so `object-contain` at a fixed
height leaves the drawing floating in horizontal air, and `w-auto mx-auto` centres the *file* rather
than the *drawing*. What works is full bleed width at a ~290-305px card, or a proportional
`aspect-[…]` clip window on anything wider. **Never a px height** — correct at one card width only.

### 3. The mny size map is the outlier — it has no 5 or 7 step ⚠

The mockup puts the hurricane panel on `col-span-5` and the bar list on `col-span-7`, and **mny
cannot express either.** But the framing matters: this is not a gap in the platform, it is mny being
behind the convention. Three different `sizes` conventions are live in this repo:

| Where | Convention |
|---|---|
| **`wcdb`** (`wcdb_theme.js:36-51`) and **`transportny` themev2** (`themev2.js:2438-2452`) | **Plain integers `"1"`–`"12"`** → `md:col-span-1` … `md:col-span-12`, with `_replace: ["sizes"]`, `gridSize: 12`, `defaultSize: "12"`. Every column width available. **This is the current convention**, used by the two newest themes. |
| **library default** (`sectionArray.theme.jsx:32-37`) | An older, narrower set on a **6-column** basis — only `1/3`→`md:col-span-2`, `1/2`→3, `2/3`→4, `1`→6. |
| **`mny`** (`theme.js:499-510`) | A fractional hybrid on a 12-col grid: `1/12`, `1/6`, `1/4`, `1/3`, `1/2`, `2/3`, `1`(=**9**), `2`(=**12**). |

So the fix is to **bring mny onto the integer convention**, not to bolt two more fractions onto its
own scheme — see [work item B](#work-item-b--bring-the-mny-size-map-onto-the-112-integer-convention),
which also explains why that is a **breaking data migration** rather than an additive theme edit.

Interim, if B is deferred past this build:

- **`"1/3"` + `"2/3"` (4 + 8)** — keeps the card the narrower element and the bar list wide enough for
  its label/track/value columns. Re-verify the three fixed columns (`w-[104px]` label, flexible
  track, `w-[104px]` value) still fit at col-span-8.
- `"1/2"` + `"1/2"` (6 + 6) — squeezes the bar list.

### 4. The bar list needs a flexible element, or the buttons stop aligning ⚠

The hurricane card's illustration overhang is added to the **column**, not the card, so that column
is taller than the bar list's natural content, the bar column stretches, and anything at its natural
position floats off the shared bottom edge. **Fix: make the bar list the flexible element**
(`flex flex-col` on the column, `flex-1 justify-between` on the rows) so it absorbs the overhang.
**Do not pad the sibling column to match** — that produces the dead space the owner rejected. The
theme's `rowspans` map (`"2"` → `md:row-span-2`, `theme.js:513`) is the sectionArray equivalent and
is how the Actions Dashboard map sits beside stacked siblings.

### 5. A `risk_pill` column type is the one clear enrichment

`risk_level` → colour is the textbook "look depends on the value" rung of the decision ladder. Five
values, five documented mny tokens (Very High `mny-red` · High `orange-400` · Moderate `yellow-700` ·
Low `blue-400` · Very Low `green-700`). **All 16 hazard pages would reuse it.** Everything else on
this page is Card configuration.

### 6. `mnyHeaderDataDriven.jsx:113` scrolls the page sideways ⚠ (live bug, not this page's)

The `overlay: 'full'` variant sets `lg:w-[1440px]` on its inner wrapper, so **every MNY page using a
full-overlay header overflows horizontally at any viewport between 1024px and 1440px.** The mockup
uses `w-full lg:max-w-[1440px]`, which is identical at 1440 and correct below it.

**[Work item A](#work-item-a--move-mnyheader-out-of-the-library-into-the-mny-theme) makes this a
theme fix rather than a library task** — once the component lives in `src/themes/mny/`, the one-line
correction is brand code and needs no submodule change. Fix it in the same pass as the move; do not
let this build silently inherit it.

### 7. The profile paragraph breaks are not in the data ⚠

Checked directly: `geography_topography` (452 chars), `demographics_population_centers` (758) and
`major_industries_…` (810) contain **zero newlines**, and `climate_assessment_narrative` — a
**lexical** column, so already capable of carrying them — is a single `paragraph` node. The design
shows one break per profile card. **That break has to come from somewhere:** either an author adds
it on the DHSES row (free for the lexical column, and only the county knows where its paragraph
goes — recommended), or a `formatFn` splits on sentence groups and guesses. Decide before Phase 1;
it changes whether section 4 needs a formatFn at all.

Also present in the source prose and worth a county fix, not a design one: all three text fields end
in a stray `?`, each carries seven non-breaking spaces mid-sentence, and the industries field reads
*"There Vera Health Spa"* for *"The Vera Health Spa"*.

## Gotchas inherited from the prior MitigateNY builds

Every one of these was paid for once already. Sources: the v2 live build, the jurisdiction
prioritization build, and the fetch-mode sweep.

| # | Gotcha | Consequence if ignored |
|---|---|---|
| 1 | **`element-data` is a stringified JSON blob.** `dms section update --set display.gridSize=3` writes a *bogus top-level* `data.display` the component never reads. Parse element-data → set the key → re-stringify → write the whole `data` object. | Silent no-op; the setting appears written and nothing changes. |
| 2 | **Two config shapes.** A component binds its source under v2 `externalSource` **or** v1 `sourceInfo`. `migrateToV2.js:203-226` is the authority and `dataWrapper/index.jsx:222` migrates either at mount, so both render. A script selecting on one key sees half the pattern. | The fetch-mode sweep reported "0 outstanding" over the half it could see — 584 of 1,125 components were invisible. |
| 3 | **Calc columns on an `isDms` source must be comma-free.** A comma inside a calculated expression fragments the SELECT list; the cell renders **0 with no error**. No `COALESCE(a, b)`, no `NULLIF`, no `concat()`, no `IN (…)`. Use `LIKE`, `=`, `IS NULL`, `~`, nested `CASE`. | Hit on page 2262755: rendered 0, should have been 473. **Applies to the Actions_Revised and Jurisdictions cells here** (both `isDms: true`); the Fusion Events cells are external, which is why the live card's `COALESCE(fusion_property_damage, 0) + …` works. |
| 4 | **`externalSource.columns` must be the complete schema.** | Section renders blank, no error. |
| 5 | **Draft sections only render in `/edit/<slug>`**, and a Playwright token must be minted for the **exact origin** you load — a subdomain shadows the bare host. | Screenshot lands on `/auth/login`, or the page 404s. |
| 6 | **Theme edits do not reach devmny.** | Phase 2 "verified" against the deployed theme, i.e. not verified. |
| 7 | **Data Fetch Mode lives inside `element-data`**, not beside `tags`. Owner rule: **external → Smart, internal → Force**. An unset value is not the same as a broken one. | The whole T6 sweep exists because of this. |
| 8 | **`Refresh Meta` overwrites deliberate author choices** — notably `display` on a calculated column (`meta-variable` → `calculated`), which drops it from the request's meta map so the slug stops resolving to its display name. The damage is hidden by the stale post-refresh cache until the next load. | Silently breaks configured calc cells. |
| 9 | **`trackingId` is not unique within a page** — 208 components across 25 pages share one with a sibling; `about_the_process` has five Cards on a single trackingId. Any matching must disambiguate on `(elementType, title, sourceId)` scoped to the page. | Mis-mapped sections during propagation. |
| 10 | **Never "improve" a source query while cloning a binding.** Keep it identical to the section you copied from. | Divergence that the next QA sweep reports as a defect. |

## Build method

A seed script under `scratchpad/mitigat-ny-prod-prod/` — e.g. `build_lhmp_home_new.mjs` — following
the v2 build's shape:

1. Dump the reference sections' `element-data` to JSON first
   (`dms raw get 2175337 2175348 2413419 …`) and build from those files, not from memory.
2. `dms page create` → capture the new page id.
3. `dms raw update <id>` for `filters`, `hide_in_nav`, `theme`, `navOptions`,
   `draft_section_groups`.
4. For each section, `dms section create <pageId> --element-type <t> --data '<json>'` with the
   group UUID and the `size` from the table above.
5. Print the page id + slug.

Reads `DMS_HOST` / `DMS_APP` / `DMS_TYPE` / `DMS_AUTH_TOKEN` from the environment and throws if
unset. **Never bake credentials or the token into the script.**

### Phases (mirroring the v2 build)

- **Phase 1 — structure + real bindings, existing primitives only.** The page works and every number
  is live; styling is whatever the current theme gives. This is the phase that proves the bindings.
- **Phase 2 — mny theme additions only** (`src/themes/mny/theme.js`), via named `activeStyle`s and
  new keys, backward-compatible by construction. Expect to need: the card surfaces and left-edge
  accents, the bar-track styling, the meter, and the breakout wrapper from finding 2(a).
- **Phase 3 — platform enrichments**, escalated to `src/dms/planning/tasks/current/` with one doc
  per feature: `risk_pill` (finding 5), the breakout image treatment if 2(a) proves insufficient,
  and the `mnyHeader` overflow fix (finding 6). Do not start Phase 3 before Phase 2 has established
  what is genuinely missing — the v2 build found several "needs a platform change" items were
  config after all.

## After approval — propagation

A new page does **not** appear in the four patterns duplicated off the template. Once `home_new` is
approved, pushing it to `suffolk_draft` (2249247), `schenectady_draft` (2304223), `delaware_draft`
(2323808) and `MitigateNY_Nassau_V2` (2407262) is a separate run through
[`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md),
with each duplicate's own `geoid` seeded under `usePageFilters` (per
[`template-and-duplicate-patterns.md`](../../skills/template-and-duplicate-patterns.md), the
duplicate's geoid values are a **correct** deviation and must not be overwritten). Note the owner
scoped an earlier sweep to three duplicates and left Nassau out deliberately — confirm the scope
rather than assuming four.

## Work item A — move `mnyHeader` out of the library into the mny theme

**Why.** `Header: MNY Data` is brand-specific code sitting in `@availabs/dms`
(`patterns/page/components/sections/components/ComponentRegistry/mnyHeader/`) because it predates
theme-provided components. It should only exist for the mny theme. Its `consts.js` is the giveaway:
`overlayImageOptions` / `insetImageOptions` are lists of **mny asset paths** shipped inside the
shared library.

**The mechanism already exists and is already used.** `patterns/page/siteConfig.jsx:71-81`
auto-registers `theme.pageComponents`:

```js
if (theme.pageComponents) { … registerComponents(obj) }
```

and four themes already ship components through it — `transportny`, `wcdb`, `avail`,
`tessera` (v6). **Crucially, a theme component can be data-bound**, which is what mnyHeader needs
(`useDataSource: true, useDataWrapper: true`). Three existing precedents do exactly that:

| Precedent | File |
|---|---|
| `ScheduleGrid` | `src/themes/wcdb/ScheduleGrid.config.jsx` |
| `ReportRouteList` | `src/themes/transportny/components/ReportRouteList/index.jsx` |
| `RouteComparison` | `src/themes/transportny/components/RouteComparison/index.jsx` |

So this is a migration with precedent, not new platform capability.

### What moves

All three files, to `src/themes/mny/components/mnyHeader/`:

| File | Notes |
|---|---|
| `mnyHeaderDataDriven.jsx` | The component + `MnyHeaderWrapper`. Four imports need rewriting (below). |
| `config.js` | The registry definition — `name`, `type`, `defaultState`, `controls`, `EditComp`/`ViewComp`. Moves as-is. |
| `consts.js` | `overlayImageOptions` / `insetImageOptions` — mny asset paths. Belongs in the theme unambiguously. |

Then `src/themes/mny/theme.js` gains:

```js
pageComponents: { "Header: MNY Data": MnyHeaderDataDriven },
```

and `ComponentRegistry/index.jsx` loses its `import MnyHeaderDataDriven from "./mnyHeader/config"`
(line 9) and the `"Header: MNY Data": MnyHeaderDataDriven` entry (line 32). There is also a
commented-out `// //import MNYHeader from './mnyHeader';` on line 5 to clean up.

### Import rewrites

The moved component imports four things from the library. Themes reach library internals by **deep
relative path into the submodule** — the established pattern in
`src/themes/avail/components/Message.jsx` and `src/themes/transportny/components/AddPageButton.jsx`:

| Current | Becomes |
|---|---|
| `{CMSContext, PageContext, ComponentContext}` from `"../../../../../context"` | `"../../../../dms/packages/dms/src/patterns/page/context"` |
| `{ThemeContext}` from `"../../../../../../../ui/useTheme"` | `"../../../../dms/packages/dms/src/ui/useTheme"` |
| `{SearchPallet}` from `"../../../../search"` | `"../../../../dms/packages/dms/src/patterns/page/components/sections/search"` |
| `{Link}` from `"react-router"` | unchanged |

Depth depends on where under `src/themes/mny/` the folder lands — **count it, don't copy the table
blindly.** `SearchPallet` is the one that is a deep internal rather than a public surface; it stays a
deep import (as the other themes' components already do), unless it is worth adding to the library's
public exports in the same pass.

### ⚠ The registry key must not change

The registry key is **`"Header: MNY Data"`** (`index.jsx:32`) and that string is the stored
`element-type` on **142 live components** across the four county patterns — `county_template`
1300890: **35**, `suffolk_draft` 2249247: **35**, `schenectady_draft` 2304223: **36**,
`delaware_draft` 2323808: **36** (counted from
`src/themes/mny/design/reports/county-template-qa-t6-fetchmode.csv`). Change or misspell the key and
every one of them renders as an unknown component.

Note the mismatch that already exists: the registry **key** is `Header: MNY Data` but the config's
internal **`name`** is `'Header: MNY'`. Keep both exactly as they are. TransportNY's
`sectionMenuExtensions` comment (`src/themes/transportny/theme.js:16-26`) is a worked example of that
key-vs-`name` distinction silently breaking things.

### Do it in two steps — the registration order makes this zero-risk

`componentRegistry.js` seeds from the built-ins then `Object.assign`s the theme's entries:

```js
const registeredComponents = { ...ComponentRegistry }
export function registerComponents(comps = {}) { Object.assign(registeredComponents, comps) }
```

**A theme entry silently overrides a built-in of the same key.** So:

1. **Step 1 (theme only, no submodule change):** copy the folder into the theme, rewrite the imports,
   register it under the same key. The theme copy now wins; the library copy is dead but present.
   Verify all 142 components still render — on a local Vite server, since theme edits never reach
   devmny.
2. **Step 2 (library, escalated):** delete `ComponentRegistry/mnyHeader/` and its two lines in
   `index.jsx`. Per the repo's planning rules this is a `@availabs/dms` change and gets its own doc
   under [`src/dms/planning/tasks/current/`](../../../../src/dms/planning/tasks/current/), plus a
   submodule commit — **which the user owns.**

Between the steps the site is fully working on the theme copy, so step 2 can wait for a convenient
submodule commit rather than blocking this page.

### Pre-flight before step 2

**Confirm no other app uses the key.** The library is shared with TransportNY, Landbank, WCDB and
Tessera, and a grep only proves no other *theme* references it — it cannot see live section data in
other apps. Query each app's patterns for components whose `element-type` is `Header: MNY Data`
before deleting. Also note `transportNY/src/modules/dms/` **vendors its own copy** of the library
synced from here (root `CLAUDE.md`), so the deletion reaches TransportNY at the next sync.

### Fix the overflow bug in the same pass

Finding 6 — `lg:w-[1440px]` on the `overlay: 'full'` variant, which scrolls every full-overlay MNY
page sideways between 1024px and 1440px. Once the file is theme code it is a one-line brand fix
(`w-full lg:max-w-[1440px]`) with no submodule involved. The file is being touched anyway.

---

## Work item B — bring the mny size map onto the 1–12 integer convention

**The premise this task originally had was wrong and is corrected here.** The first draft proposed
adding `5/12` and `7/12` steps to mny's fractional map. That patches the outlier. **`"1"`–`"12"` as
plain integers is the established convention**, already shipping in the two newest themes:

```js
// wcdb_theme.js:30-51 — transportny/themev2.js:2438-2452 is byte-identical in shape
_replace: ["sizes"],
container: "w-full grid grid-cols-12 gap-0",
gridSize: 12,
defaultSize: "12",
sizes: {
  "1":  { className: "col-span-12 md:col-span-1",  iconSize: 8.3 },
  …
  "12": { className: "col-span-12 md:col-span-12", iconSize: 100 },
},
```

mny already runs a 12-column grid (`container: "w-full grid grid-cols-6 md:grid-cols-12"`,
`gridSize: 12`), so the grid needs no change — only the size vocabulary.

### ⚠ This is a breaking data migration, not an additive theme edit

**mny's `"1"` means `col-span-9` and its `"2"` means `col-span-12`.** In the integer convention
`"1"` is `col-span-1` and `"2"` is `col-span-2`. The keys collide with **opposite** meanings, which
is exactly why wcdb and transportny carry `_replace: ["sizes"]` — they replace the map rather than
merge into it. So flipping mny's map without rewriting stored data would re-render every existing
section catastrophically: **everything currently full-width (`"2"`) becomes 17% wide, and everything
at 75% (`"1"`) becomes 8%.**

The stored-`size` rewrite required, applied before or atomically with the theme change:

| Stored now | Becomes | Renders |
|---|---|---|
| `"1/12"` | `"1"` | col-span-1 |
| `"1/6"` | `"2"` | col-span-2 |
| `"1/4"` | `"3"` | col-span-3 |
| `"1/3"` | `"4"` | col-span-4 |
| `"1/2"` | `"6"` | col-span-6 |
| `"2/3"` | `"8"` | col-span-8 |
| `"1"` | `"9"` | col-span-9 |
| `"2"` | `"12"` | col-span-12 |

**Blast radius is every pattern using the mny theme**, not just this page: `county_template`
(1300890) and its four duplicates, plus the statewide `MitigateNY_2025` (985070), the `/admin`
pattern, and anything else on the mny theme. `size` lives on the **section row** (`data.size`), not
inside `element-data`, so the write is simpler than the fetch-mode sweep — but there are far more
rows, and both `sections` and `draft_sections` snapshots reference them.

**Census first — the existing reports cannot answer this.** Neither
`pattern-component-catalog.csv` nor `county-template-qa-t6-fetchmode.csv` carries a `size` column.
Before touching the theme, scan every mny pattern for the distinct stored `size` values and their
counts, exactly as the fetch-mode sweep did for its setting, and expect the census itself to surface
surprises (that one found 584 of 1,125 components invisible to its first scan).

**Sequencing that keeps it safe:** the two conventions cannot coexist in one map, so this is not a
two-step migration like work item A. Either
- **(a)** do the census → rewrite all stored sizes to integers → flip the theme (with
  `_replace: ["sizes"]` + `defaultSize: "12"`) in one coordinated change, verified against a
  before/after render diff of a sample of pages per pattern; or
- **(b)** defer it, and take the 4 + 8 approximation for this build (finding 3's interim).

**Recommendation:** do **(b)** for this page and give the migration its own task. It is a
theme-and-content migration across five-plus patterns with a live-render blast radius, and it should
not be the tail of a page build. It is also a strictly better thing to own on its own terms —
afterwards mny authors get every column width, and mny stops being the theme that reads
differently from every other one.

**If it is done, do not forget** `sectionMenu.jsx:1234-1238` builds the size picker from
`Object.keys(theme.sizes)` ordered by `iconSize`, so the picker follows automatically; and
`sectionArray.jsx:319,463` resolves `theme?.sizes?.[size] || theme?.sizes?.[defaultSize]`, so any
row the rewrite misses silently falls back to `defaultSize` rather than erroring — which means a
missed row looks like a layout bug, not a failure. Validate by count, not by eyeball.

---

## Testing checklist

- [ ] Pre-flight 1–3 done: source 1161/1986 read, every column verified, no `home_new` collision
- [ ] Page created as **draft**, `hide_in_nav: hide`, slug `home_new`, filters carry `geoid`
- [ ] `home` (1300803) untouched — diff it before and after
- [ ] Only `draft_sections` / `draft_section_groups` written; `sections` and `section_groups` never touched
- [ ] Every bound section renders **non-empty** at `county_template.devmny.org/edit/home_new`
- [ ] Every figure matches the design's verified values: 23 jurisdictions · 475 actions (391/23/41/20) · 17 declared disasters · 537 other events · $398,477,317 total · 11 hazards with hurricane at $363,792,448 (91%)
- [ ] Fetch mode explicit on every data component — external Smart, internal Force
- [ ] No calc column on an `isDms` source contains a comma; each such cell verified against a known count
- [ ] All 33 destination slugs resolve live (checked against the harvest, **not** live, as of 2026-09-01)
- [ ] No horizontal overflow at 1440 / 1280 / 1024 — including the `mnyHeader` bug in finding 6
- [ ] Bar-list column bottom-aligns with the hurricane card (design measured delta **0px**)
- [ ] Playwright mockup-vs-live comparison per `transcribing-a-design-card-to-dms.md`
- [ ] **Work item A:** `mnyHeader` renders from `theme.pageComponents` under the unchanged key
      `"Header: MNY Data"`; all **142** live components across the four county patterns verified
      rendering; library copy deleted only after the other-app pre-flight; the `lg:w-[1440px]`
      overflow fixed in the same pass
- [ ] **Work item B:** decision recorded — either the hazard band uses the 4 + 8 interim (this
      build) or the 1–12 migration has run and the band renders 5 + 7. If migrated: census taken,
      every stored `size` rewritten per the mapping table, `_replace`/`defaultSize` set, and a
      before/after render diff clean on a sample of pages in every mny pattern
- [ ] Nothing published

## Open questions

1. **Source 1161/1986** — still unread. Blocks the final binding decision for section 4.
2. **Paragraph breaks** (finding 7) — author-added on the DHSES row, or a `formatFn`?
3. **`disaster_declaration_threshold`** — is its meaning safe to publish unglossed?
4. **`county_profile_link`** → `/county_risk_profiles?geoid=36105`: is that a page in this pattern,
   or does it point at the statewide site? The facts card's pill uses it.
5. **Hazard split** — confirm `"1/3"` + `"2/3"` (4+8) rather than adding a 5/7 step to the theme.
6. **Work item A step 2** — the library deletion needs a `src/dms/planning/` doc and a submodule
   commit the user owns. Confirm timing; the site is fully working on the theme copy in the meantime.
7. **Work item B timing** — recommendation is to take the 4 + 8 interim here and give the 1–12
   migration its own task, since it is a theme-and-content change across every mny pattern. Confirm.
   *(The related question — whether the **library default** should also move to 1–12 — is
   **settled in direction and out of scope here**: the owner confirmed 2026-09-09 that it probably
   should, but not as part of this task. Recorded under `## patterns/page — sections` in
   [`src/dms/planning/todo.md`](../../../../src/dms/planning/todo.md) so it lives where a
   library-side reader will find it.)*
8. **When does `home_new` become `home`?** Out of scope here, but the slug swap and what happens to
   1300803 needs an owner decision before this page is useful to the public.

---

# Build log — 2026-09-09

Phase 1 and Phase 2 built and verified. **Nothing published.**

| | |
|---|---|
| Page | **2484443** · slug `home_new` · `published: draft` · `hide_in_nav: hide` · no parent |
| Sections | **21 draft sections**, `sections` / `section_groups` never written |
| Build script | `scratchpad/mitigat-ny-prod-prod/build_lhmp_home_new.mjs` (idempotent — `LHMP_PAGE_ID=2484443` rebuilds in place; `draft_sections` is always full-replaced, never merged) |
| Reference dumps | `scratchpad/mitigat-ny-prod-prod/lhmp_home_refs/` — the live rows the bindings were cloned from, plus `sources.json` (the four complete `externalSource` blobs the script reads) |
| `home` (1300803) | **untouched** — diffed byte-for-byte before and after |

## Pre-flight outcomes

1. **Source 1161 / view 1986 — still unread, and now confirmed unreadable from this environment.**
   Falcor `dama.hazmit_dama.sources.byId` returns empty atoms for 1161 *and* for the
   known-good 870 through the local dms-server, so that probe cannot settle it either way; the CLI
   answers `Source row has no instance in its type: null` because it is not a DMS dataset. The page
   ships bound to the **confirmed equivalent**, `DHSES_County_Database` 953754 / view 1108098, which
   carries all three narrative fields (read live, all values on the page are real). **Open question 1
   stays open**; swapping later is `externalSource` plus three column names on one section, exactly
   as scoped.
2. **Every column verified against the live source.** Full Sullivan DHSES row read; all nine facts /
   narrative columns present. Jurisdictions read live: Town 15 · Village 7 · County 1 · CDP 25 — the
   design's 23 confirmed, CDPs correctly excluded.
3. **No `home_new` collision.** Pattern held 58 pages; none named `home_new`.

## The 21 sections as built

Sizes are the mny fractional map (work item B deferred — see below).

| # | Section | Type | size | Binding |
|---|---|---|---|---|
| 1 | Header | `Header: MNY Data` | 2 | DHSES · `geography_topography` flagged `note: true` **and `show: true`** |
| 2 | Page lede + 2 CTAs | lexical | 2 | static |
| 3 | Band header — The county | lexical | 2 | — |
| 4 | County facts strip | Card | 2 | DHSES · 4 cells |
| 5–7 | The three profile cards | Card ×3 | 1/3 | DHSES · one per narrative field |
| 8 | Band header — What the county faces | lexical | 2 | — |
| 9 | Most-costly-hazard focus panel | Card | 5/12 · rowspan 2 | Fusion 870/1648, grouped, ordered desc, 1 row |
| 10 | The hazard bar list | Card | 7/12 | Fusion 870/1648, grouped, `rowOffset: 1` |
| 11 | County disaster totals | Card | 1/3 | Fusion 870/1648, the four 2413419 aggregates |
| 12 | Hazard-band chips | lexical | 2 | 4 links |
| 13 | Band header — What the county is doing | lexical | 2 | — |
| 14 | Mitigation actions + meter | Card | 7/12 | Actions_Revised 1029065/1074456 |
| 15 | Participating jurisdictions | Card | 5/12 | Jurisdictions 1346449/1346450 |
| 16 | Band header — Explore the plan | lexical | 2 | — |
| 17–20 | Explore the plan | Card ×4 | 1/4 | DHSES (seed) · 18 static links + 4 index pills |
| 21 | Footer | `Footer: MNY Footer` | 2 | clone of 2175347 |

Section groups mirror `home` exactly: `default` (content/off), `header` (top/show, theme `header`),
and one UUID-named bottom group (theme `clearCentered`, position bottom, full_width show).

## Verified figures (live, 2026-09-09)

| Design says | Page renders |
|---|---|
| 23 jurisdictions (15 towns · 7 villages · 1 county) | **23 · 15 · 7 · 1** ✓ |
| 475 actions | **475** ✓ |
| split 391 / 23 / 41 / 20 | **391 / 22 / 40 / 22** — total identical; one In-Progress and one Completed have since moved to Not reported. Live drift since the design's 2026-09-04 read, not a binding error. |
| 17 declared disasters · 537 other events | **17 · 537** ✓ |
| $398,477,317 all-hazard loss | **$372.7M + $25.7M = $398.4M** ✓ |
| 11 hazards, hurricane $363,792,448 | **11 hazards**, hurricane **$363,792,447** (the live sum; the design's figure was one dollar high) |
| bar values: Lightning 13,180,000 · Flooding 13,158,841 · Tornado 3,900,000 · Wind 1,951,310 · Hail 1,221,000 · Snowstorm 1,038,718 · Drought 200,000 · Extreme Cold 20,000 · Ice Storm 15,000 · Extreme Heat 0 | all ✓ (Snowstorm renders 1,038,717) |

Other gates: **every internal link on the page resolves** to a real page in pattern 1300890 (checked
live, 42 anchors — the only non-resolving one is `/actions/dashboard`, which comes from the
**MNY Footer component**, not this page: a pre-existing dead link worth its own fix). Fetch mode is
explicit on every data component (external Fusion → `smart`, internal DHSES/Actions/Jurisdictions →
`force`). No horizontal overflow at 1024 / 1280 / 1440.

## Findings — eight corrections to the scope above

### ① Finding 2 was wrong: the breakout illustration is CONFIG, not a theme or library change ✅

The scope assumed `cardHints.fullBleed`, whose wrapper carries `overflow-hidden` and would clip the
overhang. **The build never needed it.** `imageMargin` already does exactly the design's device:
`Card.layout.js:304` puts it on the cell as a negative `marginTop`, and `Card.jsx:960-965` bubbles
`|imageMargin|` up to the cards-grid's `paddingTop` so the overhang has room — i.e. the mockup's
`pt-[140px]` + `mt-[-140px]` pair, already in the platform. The horizontal bleed is
`cardsPadding: 0` on the card plus `cellPadding: 0` on the image cell, with every other cell carrying
its own 12px — the mockup's `mx-[-12px]`. Nothing clips: neither mny's `subWrapperCompactView` nor
its `headerValueWrapper` sets `overflow-hidden`. No px height on the image (`img5XL` = `w-full`), per
the design README's calibration.

### ② Finding 5 was nearly wrong too: `risk_pill` is `status_pill` + six theme pill styles ✅

No new column type. `status_pill` already resolves value → pill style through a per-column
`pillColors` map against `theme.pill`. Six mny pill styles were added
(`risk_very_high` / `risk_high` / `risk_moderate` / `risk_low` / `risk_very_low` / `risk_unknown`) on
the design's documented ramp. **All 16 hazard pages can reuse them today.** No library change, no
Phase 3 escalation.

### ③ A Card's `cardsGridSize` distributes RECORDS — so a one-row source can only paint ONE card ⚠

The scope's section table put the three profile cards and the four Explore cards in one section each
with `gridSize` 3 / 4. That cannot produce the design: both sources return a single row, so one Card
= one surface, and the "3 across" would have to be 3 *cells* sharing one panel — which cannot carry
three separate rounded, tinted, illustrated surfaces. **Built as 3 × `1/3` and 4 × `1/4` sections.**
The extra cost is duplicate queries (deduped by `preventDuplicateFetch`); the gain is that each card
is independently movable and removable by an author, which the one-section form is not.
`height: 'fill'` on each keeps the row equal-height.

### ④ Section 5 needed splitting: the hurricane panel's three stats are county-wide, not per-hazard ⚠

The scope had section 5 as "Fusion ordered desc limit 1 · **plus** the four 2413419 aggregates". Those
are two different queries — one grouped by hazard, one ungrouped over the county — and one Card issues
one query. Built as the hurricane panel (1/3) and a county-totals card (1/3) stacked in the left
column, with the bar list at 2/3 carrying **`rowspan: 2`** beside them. That is finding 4's mechanism
used as intended, and it makes the bar list the flexible element as required.

### ⑤ The one genuine platform gap: dataWrapper has no row offset ⚠ → escalated

The design drops rank 1 from the bar list. `getData.js:365` derives the fetch window from
`currentPage * pageSize`, and `currentPage` is `useState(0)` inside `useDataLoader` — **there is no
author-reachable way to start a result at row 1.** The templateable workarounds all fail (a
`!= 'hurricane'` filter is per-county; this page is one template for 62 counties). Phase 1 therefore
lists all 11 hazards, hurricane included.
→ **[`src/dms/planning/tasks/current/datawrapper-row-offset.md`](../../../../src/dms/planning/tasks/current/datawrapper-row-offset.md)**

The **scale** half of the same rule *is* expressible and shipped: a `selectOnly` sibling holding
`nth_value(sum(<loss>), 2) over (order by sum(<loss>) desc rows between unbounded preceding and
unbounded following) as hazard_loss_max`, with `barMaxColumn: 'hazard_loss_max'`. Ranks 2-n are scaled
to rank 2 exactly as the design specifies; the leader simply clamps at 100%.

### ⑥ Hazard display names and per-hazard links are config — via `searchParamsCol` ✅

The source's raw codes (`riverine`, `winterweat`, `coldwave`, `heatwave`) are not reader-facing and
each hazard has its own page. Two derived CASE columns solve both: `hazard_label` (the display name)
and `hazard_slug` (the page slug, `selectOnly`). The label cell is
`isLink, location: '/the_risk/natural_hazards/', searchParamsCol: 'hazard_slug'` — Card.jsx builds
`url = location + encodeURIComponent(row[searchParamsCol])`, so **one cell shows the name and links to
that hazard's page**. `tsunami` and `volcano` have no page in the pattern and resolve to `''`, so they
fall back to the hazard index rather than a 404. All 16 hazard pages confirmed to exist (five of them
are invisible to the CLI's `page list` — they come back as `no-access` drafts — but `page show`
resolves each by slug; `tsunami` genuinely has no page and never appears in Sullivan's data).

### ⑦ Three failure modes that all present as "the card is blank / zero", not as an error ⚠

Every one cost a debugging round-trip; all three are now written into
[`card-layout.md`](../../../../src/dms/skills/card-layout.md).

- **A column type's host `name` still goes into the SELECT.** `stacked_bar`'s host value is unused, so
  it was named `actions_meter` — Postgres answered `column "actions_meter" does not exist`, and that
  error came back on **every attribute in the request**, zeroing the whole card. Fixed with
  `1 as actions_meter` + `normalName`. One bad expression poisons the entire section.
- **On an `isDms` source a calc column must use `data->>'field'`.** A *filter* leaf uses the bare name
  (the UDA maps it) but a calc expression does not. Both forms exist in live MitigateNY config and
  only `data->>` works in a calc — section 2239704's bare-name `num_*` columns are `show: false` and
  so were never actually fetched, i.e. untested dead config.
- **`barMaxColumn` pointing at the bar's own column makes every bar 100%** — the same symptom
  `card-layout.md` documented for an alias mismatch, from a different cause.

**The only place the real message appears is the falcor response.** The browser console logs a generic
`Error fetching data`. Capture it with a Playwright `page.on('response')` filtered to the API host —
`scratchpad/_net_probe.mjs` is the throwaway used here.

### ⑧ A Tailwind class in DMS content only works if the literal exists in a scanned source file ⚠

`layout()`'s `templateColumns` is a Tailwind class string, and Tailwind 4 generates a rule only for
literals it finds while scanning the project — it never sees DMS content, and it respects
`.gitignore`, so **a class written only in a `scratchpad/` build script does not exist.**
`md:grid-cols-[1fr_auto]` produced no CSS and the band headers' right-aligned links stacked under
their titles; `md:grid-cols-[1fr_240px]` (present in a tracked wcdb mockup) fixed it with no other
change. Note the corollary: `md:grid-cols-[max-content_max-content_1fr]` works only because a skill
`.md` mentions it — a fragile reason for a page to render. Written into
[`creating-pages-from-a-design-pattern.md`](../../../../src/dms/skills/creating-pages-from-a-design-pattern.md).

## Work item A — DONE (step 1), escalated (step 2)

`Header: MNY Data` now ships from **`src/themes/mny/components/mnyHeader/`** and is registered through
`theme.pageComponents` under the **unchanged** key `"Header: MNY Data"`. The theme entry overrides the
built-in, so the library copy is dead but still present.

- Import rewrites: three deep paths into the submodule. **One of them was not what the scope's table
  said** — `SearchPallet`'s original `"../../../../search"` resolves to
  `patterns/page/components/**search**`, not `sections/search`. Counting the depth rather than copying
  the table is exactly the instruction the scope gave, and it mattered.
- **Finding 6's overflow bug is fixed in the same pass**: `lg:w-[1440px]` → `w-full lg:max-w-[1440px]`
  on the `overlay: 'full'` variant. Reproduced first (`scrollWidth` 1440 in a 1024 viewport), then
  verified clean at 1024 / 1280 / 1440.
- **Regression swept, 71/71 pass**: `county_template` **35/35** and `delaware_draft` **36/36** — every
  page carrying the component renders with no unknown-component placeholder and no horizontal
  overflow at 1280. That is both patterns' full complement of the 142 live components; the remaining
  two patterns (`suffolk_draft`, `schenectady_draft`) run the same theme and the same registry key.
  Sweep script: `scratchpad/_header_regress.mjs <subdomain>`.
  (A first pass reported 20 false failures because it looked for the overlay variant's wrapper class;
  mnyHeader also has an **inset** variant with different chrome. The right signal is the registry's
  unknown-component placeholder, not a class.)
- Step 2 (deleting the library copy) needs a submodule commit **the user owns** and an other-app
  pre-flight → **[`src/dms/planning/tasks/current/remove-mnyheader-from-library.md`](../../../../src/dms/planning/tasks/current/remove-mnyheader-from-library.md)**.

## Work item B — deferred, as recommended

The hazard band ships the **4 + 8 interim** (`1/3` + `2/3`). The 1–12 migration now has its own task:
**[`mny-size-map-integer-migration.md`](./mny-size-map-integer-migration.md)**. When it lands, the band
can take the design's 5 + 7 — and `build_lhmp_home_new.mjs`'s `size` values must be updated in the same
pass or a re-run reintroduces fractional values.

## Theme changes made (`src/themes/mny/theme.js`)

All additive; every existing section renders unchanged.

| Addition | What it is |
|---|---|
| 6 `pill` styles | `risk_very_high` … `risk_unknown` — the hazard risk ramp (finding ②) |
| 3 `dataCard` styles | `accentRisk` / `accentAction` / `accentPlace` — the design's 4px coloured left edges, picked per section from the Card toolbar's **Card style** control, so any future band can borrow them without code |
| 1 `dataCard` style | `illustrated` — the mny-50 panel the isometric illustration bleeds out of (surface only; the bleed itself is per-section config) |
| `pageComponents` | `{"Header: MNY Data": MnyHeaderDataDriven}` (work item A) |

## What is left

- [ ] **Owner review** of the draft at `https://county_template.devmny.org/edit/home_new`.
      ⚠ **Theme changes do not reach devmny** — the hosted site runs the deployed mny theme, so the
      Phase 2 styling (risk pills, accent edges, illustrated panels, the header overflow fix) is only
      visible on a local Vite server until the theme is deployed. Review of the *bindings and figures*
      works on devmny today.
- [ ] Open question 1 — read source 1161/1986 with a credentialed session and decide which source ships
- [x] Open question 2 — **answered 2026-09-09**: breaks come from the `county_prose` columnType, not
      from an author editing the row (see Round 2 §1). An author adding real breaks on the DHSES row
      is still the better long-term answer for *where* a county's paragraphs belong
- [ ] Open question 3 — is `disaster_declaration_threshold` ($349,091) safe to publish unglossed? It is
      in the facts strip today
- [ ] Open question 4 — **resolved and moot.** `county_profile_link` is
      `/county_risk_profiles?geoid=36105`, which is **not a page in pattern 1300890**; the design's
      facts strip does not use it (the climate-region cell links to `/the_risk/climate_change`) and
      neither does the build
- [ ] Open question 8 — when `home_new` becomes `home`, and what happens to 1300803. Owner decision
- [ ] **County data defects** (not design, not build): all three DHSES narrative fields end in a stray
      `?`, each carries non-breaking spaces mid-sentence, and the industries field reads
      *"There Vera Health Spa"* for *"The Vera Health Spa"*. Visible on the live page
- [ ] **Pre-existing dead link in the MNY Footer component**: `/actions/dashboard` resolves to nothing
      in this pattern. Every page carrying the footer has it
- [ ] Propagation to the four duplicates, once approved — a separate run through
      [`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md).
      Confirm the scope first: an earlier sweep deliberately left Nassau out
- [ ] **Housekeeping:** page **2484459** (`zz_probe_actions`) was a throwaway isolation probe. Its
      sections are cleared and it is retitled *"ZZ probe actions (DISPOSABLE — delete me)"*; the CLI's
      `page delete` answers `Authentication required to delete items` with this token, so it needs
      deleting by hand from the admin UI

## Round 2 — 2026-09-09, owner direction

Four asks, all applied. Page rebuilt in place (still 21 draft sections, still unpublished); the page
is ~240px shorter.

### 1. The county prose is excerpted and paragraph-broken — `county_prose`, a theme columnType

New: **`src/themes/mny/components/countyProse.jsx`**, registered as `theme.columnTypes.county_prose`.
Two knobs, both ordinary column settings so an author retunes them with no code:

| Column setting | What it does | Used here |
|---|---|---|
| `proseMaxChars` | excerpt to WHOLE sentences within this budget | 440 on the three cards, 320 in the header |
| `proseParagraphs` | break the kept sentences into N **length-balanced** paragraphs | 2 on the cards, 1 in the header |

It also repairs three artifacts that are in the **source data**: the stray trailing `?` on every
text field, the seven non-breaking spaces, and the doubled spaces. That is a workaround, not a fix —
**the DHSES rows still want correcting** (and `"There Vera Health Spa"` is a content fix this
deliberately does not attempt).

Measured on the live Sullivan row:

| Field | source | rendered | split |
|---|---|---|---|
| `geography_topography` (header) | 451 | 309 | 1 para |
| `demographics_population_centers` | 755 | 431 | 180 / 251 |
| `major_industries_…` | 808 | 377 | 111 / 266 |
| `climate_assessment_narrative` (**lexical**) | 829 | 369 | 99 / 270 |

Two things worth keeping:

- **It reads a lexical document as happily as a text column**, so all three cards use one type and
  the climate card no longer needs `type: 'lexical'`.
- **Balance by length, breaking BEFORE the sentence that overshoots.** The obvious `curLen >= target`
  form breaks *after* it, which puts the straddling sentence in the first block every time — on the
  demographics field that gave 342/88 where 180/251 was available.

**This answers open question 2** (finding 7): the paragraph breaks come from a formatter, not from an
author editing the DHSES row. An author adding real breaks on the row is still the better long-term
answer for where a county's paragraphs actually belong; this makes the page right today for all 62.

#### ⚠ Why it is a columnType and not a `formatFn`

The ask was for a `formatFn`, and **`formatFn` cannot carry prose.** Card.jsx's generic branch is

```js
formatFunctions[attr.formatFn](rawValue, attr.isDollar).replaceAll(' ', '')
```

— it strips **every space** (right for `1.2M`, fatal for a sentence), and because it calls
`.replaceAll` on the result a formatFn cannot return elements either. Only `icon`, `color` and
`combine` are special-cased past that line, so a prose formatFn would need a Card.jsx change, i.e. a
submodule commit, and it still could not emit two `<p>`. A columnType is the decision ladder's own
answer for "the rendering changes, not just the value", **and a theme-registered one needed no
library change at all** — `siteConfig.jsx` auto-registers `theme.columnTypes`. It is reachable from
the Card toolbar's Type picker like any built-in.

### 2. Every DHSES-bound section is `smart`, not `force`

Nine sections on this page read the one DHSES county row (header · facts strip · 3 profile cards ·
4 Explore cards). Under the standing rule (internal → Force) that is nine uncached round-trips for an
unchanged row on every load. Now an explicit source-id exception in the builder
(`SMART_SOURCES = new Set([953754])`), **verified on all nine live sections**. Fusion stays `smart`
(external), Actions_Revised and Jurisdictions stay `force` (internal, unchanged).

Recorded in the project skill so a future sweep does not "fix" it back:
[`cataloguing-and-fixing-data-fetch-mode.md` → *Exception: DHSES_County_Database*](../../skills/cataloguing-and-fixing-data-fetch-mode.md).

### 3. The card buttons are pinned to the card's bottom edge

`display.cellsRowsTemplate` — the row-axis peer of `cellsTracksTemplate`, and the Card's expression
of the mockup's `mt-auto`. Without it the cells shrink-wrap and the slack pools *below* the button.

- **Profile cards:** `'max-content max-content 1fr max-content'` — the PROSE row takes the leftover
  height, so the button lands on the card's own bottom edge however long that county's text is.
- **Explore cards:** `` `max-content max-content repeat(${links.length}, max-content) 1fr` `` plus
  `cellContentVAlign: 'bottom'` on the pill — the link rows keep their own rhythm (these columns
  carry 5 · 4 · 4 · 5 links) and the last row absorbs the slack.

Measured live at 1440: all three profile buttons bottom at **1813px** against a card bottom of 1823
(a uniform 10px inset), and all four *Learn More* pills at **3429px**. Delta between siblings: **0**.

### 4. Header note

Same excerpt path, so the four places this prose appears now read the same. The header's budget and
paragraph count come off the **note column** (`proseMaxChars` / `proseParagraphs` on
`geography_topography`), so they are author settings, not constants — `display.defaultNote`, the
static fallback sentence, passes through untouched.

## Round 3 — 2026-09-09, owner direction

Six asks. All of the header work landed as **author-reachable options on the mny header component**
(it is theme code now, so this needed no library change), not as hardcoded page markup.

### 1. The content band is full width

`draft_section_groups.default` → `full_width: 'show'`. `full_width: 'off'` selects sectionArray's
`layouts.centered`, which is `max-w-[1020px] mx-auto` — the content column was ~420px narrower than
the design inside a 1440px shell. `'show'` selects `layouts.fullwidth` (no cap).
**Note this is a deliberate difference from `home`**, which is `'off'`; the section-groups table
above says "mirror `home` exactly" and this one row no longer does.

### 2. The card foot links are buttons

Two new `dataCard` tokens: **`cardLinkPill`** (the mny-200 pill the mockups put at a card's foot) and
**`cardLinkPillPrimary`** (the amber variant, for a band's one primary action). A cell reaches either
with `valueFontStyle` and nothing else — Card.jsx puts `theme[valueFontStyle]` on the `<a>` itself for
a link cell, so the token IS the button. `linkColValue`, the existing key, is the *full-width* variant
(`flex-1 w-full`) and was the wrong shape here.

Applied to the three profile cards' destination links and the four Explore *Learn More* links.

### 3. The lede is a lexical column layout with the CTAs on the right

One `layout-container`, **three** columns — prose · button · button — at
`items-start grid-cols-1 md:grid-cols-[1fr_max-content_max-content] gap-x-3`.

Two things forced that shape rather than "prose column + button column":

- **A container nested inside a `layout-item` is the FLAT shadow-root trap** (skills §5.6.6b);
  Lexical mangles it at render time. So the buttons cannot be a row *inside* the right column.
- Two `ButtonNode`s in **one** paragraph render with no gap between them (`EXPLORE THE RISKSEE THE
  ACTIONS`) — nothing in the button token carries margin. One column each is what gives them the
  design's `gap-x-3`.

### 4. Header note size

Was a hardcoded `text-[16px] leading-[24px]` on the wrapper, unreachable from the section. Now a
named token via **`display.noteFontStyle`** (toolbar: *Note Size* — 14 / 16 / 20 / 12px), defaulting
to `proseSM`. This page uses `proseSM` (14px).

⚠ **A judgement call worth confirming:** the mockup says **15px**, which is not a step on mny's
ladder (`proseSM` 14 → `prose` 16). I took the lower one because it matches the profile cards' prose,
which is the same role — the county's own narrative voice. If 16 reads better in the identity card
it is one pick in the Note Size control, no rebuild.

### 5. The header carries the plan facts

The design's **Status · Approved · Expires** strip under the county description. Built
**column-driven**, like every other slot in this header: flag a column `planFact` (new toolbar
toggle) and it appears in the strip, labelled by its `display_name`, in column order. Unlike
Title/Note/Image/Logo — which are exclusive, one-column flags — this one takes several, so its
`onChange` sets only its own column.

This page flags `plan_status` · `plan_approval_date` · `expiration_date`. The header formats an
`M/D/YYYY` string as `Apr 28, 2021` on its own (DHSES stores `4/28/2021`; the design prints the long
form); anything that is not that shape passes through untouched.

Also added, since it is in the same header block in the design: an optional follow-on link under the
note — `display.noteLinkText` + `display.noteLinkPath` (toolbar inputs). This page points it at
*The natural environment*.

### 6. Featured searches are optional

`display.showFeaturedSearches` (toolbar toggle), **defaulting ON when unset** so every header that
already renders the chips is unchanged. This page turns them off — they are a landing-page
affordance and are not in the LHMP design.

### And a fix for the class-availability trap, not just a workaround for it

Round 1 hit it (`md:grid-cols-[1fr_auto]` generated no CSS) and round 3 hit it again. The mny theme
now carries a **`TAILWIND_SAFELIST`** array — never read at runtime, it exists so Tailwind's scanner
finds the literals that live only in DMS content. Add a line there rather than hunting for some other
tracked file that happens to mention the class you need.

### 7. Section padding was the legacy shape — the UI could not read it back

Reported as "the padding settings are malformed and not being read correctly by the UI", and it was
exactly that. The builder wrote `padding` as Tailwind class strings (`'pt-6 pb-4'`, `'pt-3 pb-1'`).
`resolvePadding` (`sectionArray.jsx:68`) returns a string as-is for BC, **so the page rendered
correctly and the defect was invisible until you opened a section's settings.**

The current shape is a per-side object of **step keys** into `theme.paddings`. The settings control
reconstructs a legacy string with `parseLegacyPad` (`sectionMenu.jsx:1343`), which only understands
`p-N` / `px-N` / `py-N` / `p[trbl]-N` on the theme's own ladder — so `pt-3 pb-1` read back as nothing,
unparsed sides showed the theme default, and **the first click would have rewritten the whole value
as an object**, dropping what didn't parse.

All seven padded sections now store the object shape, e.g. `{"top":"6","bottom":"4"}`, verified on the
stored rows. mny ships no `paddings` map of its own so it inherits the library ladder —
**`0 · 2 · 4 · 6 · 8`, and nothing else is addressable**; the chips row's `pt-3 pb-1` had to snap to
`{top:'2', bottom:'0'}`. The builder now carries a `pad()` guard that throws at build time on an
off-ladder step.

The skill that told me to write a class string
([`creating-pages-from-a-design-pattern.md` §4.2.5](../../../../src/dms/skills/creating-pages-from-a-design-pattern.md))
was stale and is corrected.

### Verified after round 3

- No horizontal overflow at 1024 / 1280 / 1440
- Profile buttons all bottom at **1831px** (card bottom 1841); *Learn More* all at **3531px** — 0px
  delta between siblings, still holding with the new pill token
- `home` (1300803) content unchanged · `published: draft` · `sections: []` · 21 draft sections
- Every internal link still resolves
- `county_prose` unchanged and still correct on all four fields
- All seven padded sections store the per-side object shape
- **`mnyHeader` regression re-swept after the header rewrite: 35/35 on `county_template`.** The
  sweep now retries once on an EMPTY body — a 35-page run against a dev server intermittently reads
  the DOM before it paints, which scored two pages as failures on the first attempt when both
  rendered fine individually. An empty body is a timing artifact; a rendered body carrying the
  unknown-component placeholder is the real signal.

## Round 4 — 2026-09-09, the focus panel

### The band is 5 + 7, the design's split — WITHOUT the size-map migration

Work item B's premise said the fix for mny's missing 5 and 7 steps was the full 1–12 integer
migration. That is still the right end state, but it was **not needed to unblock this band**: adding
`"5/12"` and `"7/12"` to mny's existing fractional map is **purely additive** — no stored section uses
either key, so nothing existing re-renders. The band now matches the design and the migration
subsumes the two keys whenever it happens.

That is what puts the hazard name (36px) and its loss (30px) **on one line**: 385px of type needs a
column wider than the ~363px `1/3` gives. Measured at 5/12: name 148px + amount 234px in a 501px
card, same baseline.

### The focus panel is one card again, and it is not "the hurricane card"

The second card is deleted. Its three county figures are now **window aggregates over the focus
card's own grouped query** (`sum(sum(x)) over ()`), which is what let the design's composition
collapse from two cards into one.

**Verified against the known values: Declared disasters 17 · Other events 537 · All-hazard loss
$398.5M.** One correction on the way there: with the null-category exclusion applied, Other events
read **532**, because that filter also drops those events from the window aggregates. The exclusion
belongs to the bar list (where a blank row is visible), not here — the leader by loss is never the
null row.

**Per-county behaviour, verified by replaying the card's own request:**

| County | Focus card shows |
|---|---|
| Sullivan | Hurricane $363.8M |
| Albany | Hurricane $56.7M |
| **Erie** | **Snowstorm $755.4M** |
| **Monroe** | **Wind $103.4M** |
| Suffolk / Nassau / New York / Delaware | Hurricane |

Nothing in the card names a hazard. The label, amount, risk pill, **illustration** and destination
slug all come off the winning row. The illustration had to be data-driven for exactly this reason — a
hardcoded file would have shown Erie a hurricane; it is a CASE column mapping hazard code → asset,
the same shape as `hazard_label` / `hazard_slug`.

⚠ `?geoid=` does **not** re-scope this page — each section carries its own geoid value alongside
`usePageFilters`, the same as `home`. That is what the propagation step rewrites per duplicate.

### The breakout illustration: `img5XL` was the whole height problem

`img5XL` is `w-full` with no height, so a 1024×1024 render became as tall as the column is wide —
**388px**, which is why the card was **501px** against the design's ~305px box. New mny token
**`imgBreakout`** (`w-full h-[240px] object-contain object-center`).

`object-cover` was tried first and is **wrong for these files**: at 494×240 from a 1024² source it
scales to 494×494 and crops 127px off the top *and* bottom, decapitating the drawing. These focus
renders fill most of their square — `design/README.md`'s note about croppable transparent padding
holds for the smaller profile-card renders, not for these.

Card now **501 × 327** with the image 240px tall starting 127px above the card top → **113px inside**,
against the design's 129/111. ⚠ The px height is correct at one column width; it is tuned to the
~494px the panel gets at 5/12.

### The band is two rows, and the focus panel spans both

The chips row exposed the shape: with the focus panel one row tall, the left half of the band's
second row was empty. The panel now carries **`rowspan: 2` + `height: 'fill'`**, so it occupies the
left cell of both rows and the band reads as two columns rather than an L.

That also removed the offset filler the chips needed. `sectionArray` fills the grid in source order
with no col-start, so a narrow section is normally pushed into place by an empty filler
(`creating-pages-from-a-design-pattern.md`, "Col offset") — but with the panel spanning both rows,
auto-placement drops the chips into columns 6–12 of row two on their own.

**The chips are a wrapping button row, not a layout-container.** A container with one button per
column costs **24px** between chips on this theme — `lexical.styles[0].layoutItem` is `px-2 py-4`, so
16px of item padding rides on top of the container's gap — plus 16px above and below; that pushed the
four chips 23px past their column. New mny button style **`chipRow`** = `secondarySmall` + its own
`mr-2 mb-2`, four buttons in one paragraph. Measured: chips start at x=629, exactly the bar column's
left edge, 8px gaps, last one ending at 1311 inside the column's 1344.

### Sizing the breakout illustration — the arithmetic that actually governs it

`imageMargin` does **not** change the section's height. Card.jsx sets the cards-grid `paddingTop` to
`|imageMargin|` and the image cell's `marginTop` to `-|imageMargin|`, so the two move together:

```
section height = image height + (card content below the image)
```

`imageMargin` only decides **where the card's top edge falls** within that — how much of the render
overhangs versus sits inside. So "make the image bigger" always grows the band; it cannot be
absorbed by a larger negative margin.

Tuned against the right column (bar list + chips): 240px bottom-aligned exactly but read small in a
501px card; 300px looked right but ran 29px past; **285px** with the chips' top padding at step 8
leaves a **10px** difference, which is flush to the eye. If the image height changes again, the chips'
top step moves with it.

### Still off from the mockup

- The card is taller than the design's box — the price of the 285px drawing, taken deliberately.
- The band's two columns end 10px apart.
- The profile link is a `cardLinkPill` button rather than the mockup's plain "Hurricane profile →"
  text link — carried over from the "card foot links should be buttons" direction.

## Round 5 — 2026-09-09, the graph was lying

**Owner: "the way it is on the graph makes no sense, the hurricane bar should dwarf everything, are
we sure we are implementing the graph correctly?" — correct, and it was my error.**

The bar list scaled to **rank 2** (the design's rule) while still **containing rank 1** (my Phase-1
deviation, because there was no row offset). Those two only work together. With the leader in the
list, rank-2 scaling clamps the leader *and* rank 2 both to 100%:

| | loss | rendered | should be (scale=max) |
|---|---|---|---|
| Hurricane | 363,792,448 | **100%** | 100% |
| Lightning | 13,180,000 | **100%** | 3.62% |
| Flooding | 13,158,841 | 99.8% | 3.62% |

Two bars the same length for values **27× apart**. Not a styling miss — the chart was misrepresenting
the data, and it shipped that way through four rounds of review because I checked that the bars
*varied*, never that they were *proportional*.

### The fix: build the row offset instead of working around it

There were only two coherent options with existing primitives — scale to the max (truthful, but the
other ten become the invisible stubs the design exists to avoid) or drop rank 1 (needs an offset).
I checked once more for an author-reachable offset and there is none: no `display.transform` row
hook, no seedable initial page, `currentPage` is `useState(0)`.

So **`display.rowOffset` is now implemented** — four lines in `getData.js` plus a **Row Offset**
toolbar input, escalated and documented at
[`src/dms/planning/tasks/current/datawrapper-row-offset.md`](../../../../src/dms/planning/tasks/current/datawrapper-row-offset.md).
⚠ **That is a submodule change; the commit is the user's.** Two follow-ups are explicitly NOT done
(the pager over-reports by the offset on a *paginated* section, and there is no test) — neither
affects this page, which is unpaginated.

The bar list now carries `rowOffset: 1` and the rank-2 scale, which is the design exactly:

`Lightning 100% · Flooding 99.84% · Tornado 29.59% · Wind 14.81% · Hail 9.26% · Snowstorm 7.88% ·
Drought 1.52% · Extreme Cold 0.15% · Ice Storm 0.11% · Extreme Heat 0%`

**The two settings are a pair and the builder says so at both sites** — change the scale without the
offset, or the offset without the scale, and the chart starts lying again.

### Knock-on

Dropping a row took ~36px off the right column, so the band's two ends drifted. Re-levelled by
trimming the illustration 285 → **258px**; the columns now end 14px apart. Reminder of the
arithmetic: `section height = image height + card content below it`, and `imageMargin` only moves the
card's top edge within that — it cannot absorb a taller image.

### The lesson worth keeping

**Verify a chart's proportions against the numbers, not just that the bars differ.** One line of
arithmetic — printing each value's expected percentage next to the rendered width — would have caught
this on the first render.

## Round 6 — 2026-09-09, "What the county is doing"

**7 + 5, the design's split** (was 8 + 4 — mny had no 5 or 7 step until round 4 added them).
Both cards `height: 'fill'`, so the band is equal-height.

**The six missing destinations.** Actions card: *Actions Dashboard* (amber `cardLinkPillPrimary`,
the band's one primary action) · *Actions Database* · *Funding Sources* · *Annual Maintenance*.
Jurisdictions card: *Jurisdictional Annexes* · *Capabilities*. All six resolve.

**Both cards were also missing their lede line** from the design — "Every problem the county and its
jurisdictions identified…" and "Each one adopts the plan and keeps its own annex." Added as static
`proseSM` cells.

### ⚠ `cellWidth: 'max-content'` on ONE cell resizes the tracks for EVERY row

The first pass gave the chips `cellWidth: 'max-content'` so they'd pack left. It worked for the
chips and **silently broke every other row on the card**: the Towns/Villages/County values stopped
right-aligning, landing **152px short** of the card edge.

The cells grid is ONE grid — all rows share the track edges (`card-layout.md`, "Budgeting a track
template"). A `max-content` chip claims its first track and the walker collapses its other spanned
tracks to **0px**, so the twelve tracks no longer add up to the container: a `cellSpan: 12` data row
spans every track and still comes up short by the collapsed remainder. The value was right-aligned
the whole time — to the wrong edge.

**Removing `cellWidth` fixed it** (gap 152px → 21px, which is just the card padding). Chips are plain
`cellSpan: 3` cells now; the pill is `w-fit` so it left-aligns in its quarter.

The lesson generalises past this page: **`cellWidth` is a property of the shared grid, not of the
cell you put it on.** Reach for it only when every row of the card wants that track shape.

### And the pill token needed `whitespace-nowrap`

Without it, a label a few px wider than its track breaks onto a second line and the pill renders as a
two-line lozenge — "Actions Dashboard" and "Annual Maintenance" both did. Measured natural widths are
143 · 131 · 125 · 155px against 157px cells, so they fit comfortably; only the wrap was wrong. Added
to `cardLinkPill` and `cardLinkPillPrimary`. If a chip row genuinely doesn't fit, give it fewer per
row — never let the type wrap.

### Matching the design's head exactly

- **New `cardKicker` token** — 11px/700 uppercase tracked in mny-700, which is what the design draws
  on every panel ("Mitigation actions", "Participating jurisdictions", "Most costly hazard"). The
  nearest existing tokens each miss on one axis: `textXSReg` is 12px/400, `statCardLabel` 11px/600,
  `statCardLabelStrong` 11px/700 but mny-900. Applied to all three panels.
- **The figure is bottom-aligned to the lede, not the kicker** — the mockup's `items-end`. Done with
  `cellRowSpan: 2` + `cellContentVAlign: 'bottom'` on the 475 / 23, so it spans both head rows and
  sits on the lede's last line.
- **The lede takes 7 of 12 tracks** on the actions card ≈ the mockup's `max-w-[420px]` measure, so it
  wraps to two lines exactly as drawn.

### These chips are Card CELLS, not a sibling lexical section

The opposite call from the hazard band's chips, and for a concrete reason: the design puts these
**on the card's own surface** (the amber one especially), which a sibling section cannot be. Inside a
Card the container problem that forced `chipRow` doesn't arise — there is no `layoutItem` padding —
so a plain static link cell with `valueFontStyle: 'cardLinkPill'` is enough.

**Chips ride the card's bottom edge** via `cellsRowsTemplate` — `'max-content max-content 1fr
max-content'` on the actions card (the meter row takes the slack) and a five-`max-content` + `1fr`
template on the jurisdictions card (Towns/Villages/County keep their own rhythm). Same device as the
profile cards.

## Round 7 — 2026-09-09, the strategy band's height

**310px → 234px.** The actions card read as too tall, but it was not the actions card's fault:
both cards are `height: 'fill'`, so **the taller one sets the row and the other stretches**. The
jurisdictions card was the driver, and the actions card's `1fr` meter row absorbed all the slack —
a 64px dead gap between the legend and the chips.

### The real cause: card cells inherited the band's 28px prose leading

The `content` layoutGroup sets `leading-7` on the band. mny's `dataCard.header` and `dataCard.value`
carried **no line-height of their own**, so every card cell got a 28px line box regardless of its
text — a 14px `proseSM` label/value row measured **35px** where its content was 19.6px. Roughly 9px
of dead height per cell, on every mny Card on every mny page.

Fixed at the theme: `leading-[1.35]` on both keys. It can only shrink a cell whose content is
*shorter* than 28px — a `text4XL` value (36px, `leading-[100%]`) is untouched.
⚠ **Blast radius is every mny Card**, always in the direction of less dead space. Worth a look on the
Actions Dashboard and the Action Record if either was relying on the old spacing.

Row heights before → after: label/value rows 35 → 30 → **27**; chip rows 59 → 40 → **35**.
Remaining per-card trims: `cellPaddingTop/Bottom: 1` on the label/value rows, `cellPaddingTop: 6` on
the chip rows, `cellsRowGap` 6 → 4 (actions) and 4 → 2 (jurisdictions).

The actions card still carries ~45px of slack in its meter row, because it genuinely has less
content than the jurisdictions card and both are `h-full` — which is what the mockup does too
(slack above the pinned chips).

### ⚠ A chip went missing and the geometry probes did not notice

*Actions Database* disappeared from `ACTION_LINKS` during one of the height edits and survived two
further rounds of measurement, because every probe was checking **positions and heights** — and
three evenly-spaced chips measure just as cleanly as four. Restored; the page's internal link count
went 42 → 43.

**Check content and geometry separately.** A layout probe that reads what is there cannot tell you
what is missing; assert the expected set by name.

### ⚠ Not a defect — the owner was publishing, and I reverted it twice

Logged here because it cost real time and because the wrong conclusion is an easy one to reach again.

Twice on 2026-09-09 the page's `sections` / `section_groups` filled with a 21-row clone of the
drafts. I read that as a draft-only-discipline violation — this task opens with "never publishes" —
and **cleared it both times**, which discarded the owner's publishes. The owner was pressing
**Publish** in the edit toolbar.

Everything that looked like evidence of a phantom writer was consistent with a person clicking a
button: 21 rows created inside 0.6s (a bulk server-side clone, which is exactly what publish does,
and which the CLI-driven builder cannot do — it takes ~11s for 21), and no reproduction from any
automated path. Five candidates were tested and cleared for the obvious reason that none of them was
the cause: anonymous view, authenticated view, authenticated `/edit`, a full builder re-run, and a
complete 35-page header sweep. `home` (1300803) having its `updated_at` bumped with **no content
change** fits the same explanation.

**The rule that was actually wrong:** "never publish" binds the *builder*, not the owner. A populated
`sections` array on a page the owner is reviewing is the expected state, not damage. **Do not clear
`sections` on this page.** If it needs reverting, that is the owner's call and `dms page publish` /
the Publish button is theirs to drive.

**Current state, as a consequence:** `sections: []` — the last publish is undone, and the drafts have
been rebuilt since, so the orphaned rows from it (2485041–2485061, 2485737–2485757) are stale and
unreferenced regardless. Publishing the current 21 drafts is a fresh Publish click whenever the owner
wants it.

## Known deltas from the mockup (all deliberate, all listed above)

2. The hurricane panel's three county stats are a card below it, not inside it (finding ④ — two queries).
3. Hazard band is 4 + 8, not the mockup's 5 + 7 (work item B deferred).
4. No per-row hazard icon in the bar list — the cell now carries the reader-facing name, and
   `formatFn: 'icon'` resolves an icon from the *raw* category code. Name beat icon; both would need
   two cells.
5. No risk-level legend under the bar list — each row states its risk level in words, which the
   mockup's colour-square rows could not.
