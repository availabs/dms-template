# Build the Jurisdiction Prioritization page live in MitigateNY

**Status:** SUPERSEDED 2026-08-31 — folded into the JOINT task
[`planning/mitigateny/tasks/current/jurisdiction-prioritization-county-workspace-live-build.md`](../../../../planning/mitigateny/tasks/current/jurisdiction-prioritization-county-workspace-live-build.md)
(root hub), which builds JP + the County Workspace together on the post-dashboard stack
(actions_cleaned 13272 reads, filter_control band, mny-inventory worklist, section auth gates).
The section-by-section analysis below is still useful; the BINDINGS are stale (predates 13272).
**Topic:** content (+ themes, + dms library escalation)
**Design source:** `src/themes/mny/design/pages/county-actions/jurisdiction-prioritization.html`
**Design task:** [`mny-county-actions-jurisdiction-prioritization.md`](./mny-county-actions-jurisdiction-prioritization.md)
**Closest prior art (read this first):** [`mny-action-prioritize-v2-live-build.md`](./mny-action-prioritize-v2-live-build.md)
— the same conversion for the county page, including the five library features it shipped that this
page reuses.

## Objective

Instantiate the approved `jurisdiction-prioritization.html` mockup as a **live DMS page**: a single
jurisdiction's worklist where the jurisdiction sets its **own** ranking (`local_priority`) and closes
the four data gaps plan review sends back, with the "Needs your attention" band as the entry point.

Its sibling — the county workspace (`county_priority` only) — is already live as page **2262755**
(v2 build). This page is the jurisdiction-scoped counterpart, not a replacement.

**Draft-only discipline:** this task creates a page and its `draft_sections` and **never publishes**.
`dms page publish` is a human decision.

## Environment

```
VITE_DMS_APP=mitigat-ny-prod
VITE_DMS_TYPE=prod
VITE_DMS_PG_ENVS=hazmit_dama
```

CLI equivalents (see [`authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md)):

```bash
export DMS_HOST=http://localhost:3001 DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=<minted; never bake into a script>
```

The local dms-server writes the **same remote DB** the hosted `county_template.devmny.org` reads, so
a page created locally appears on the live subdomain (in `/edit` until published). Theme edits do
**not** reach devmny — verify those on a local Vite server:

```bash
VITE_DMS_APP=mitigat-ny-prod VITE_DMS_TYPE=prod VITE_DMS_PG_ENVS=hazmit_dama VITE_API_HOST=http://localhost:3001 node node_modules/vite/bin/vite.js --port 5199 --strictPort
```

then `http://county_template.localhost:5199/edit/<slug>`. Ports 5173/5174 are the user's TransportNY
servers — leave them alone, and stop 5199 when done.

## The one data source

**Actions-Revised** — `source_id: 1029065`, `view_id: 1074456`, `mitigat-ny-prod+actions_revised`.
Every section on this page binds to it and nothing else. No join, no second source.

```jsonc
"externalSource": {
  "source_id": 1029065,
  "view_id": 1074456,
  "isDms": true,
  "env": "hazmit_dama",
  "columns": [ /* the FULL source schema — copy verbatim from a reference section */ ]
}
```

`externalSource.columns` must be the complete schema or the renderer can't resolve field names and
the section renders blank. Copy it from an existing bound section rather than hand-writing it —
`dms raw get 2262760` (the v2 Spreadsheet) or `2239704` (the actions_index Spreadsheet).

### ⚠ Pre-flight — confirm the schema before writing any section

I could not read the live source in this checkout: no `DMS_HOST` is configured, there is no `.env`,
and the CLI is not linked, so **no column name below is verified against the source**. They are
taken from what the repo already records:

| Column | Where it is attested |
|---|---|
| `action_name`, `control`, `county`, `county_geoid`, `geoid_juris` | v2 task doc (live page 2239721 audit) |
| `implementation_status`, `county_priority`, `cost_range`, `primary_hazard_type` | v2 task doc + design page comments |
| `description_of_the_problem_problem_statement`, `description_of_the_solution_action_description`, `lead_agency_department` | [`full-text-search-filter.md`](../../../src/dms/skills/full-text-search-filter.md) §2 |
| **`local_priority`** | design pages only (`action-edit.html`, `action-view.html`) — **the page's central column, and the least verified** |
| action type, critical facility, action number | **not attested anywhere** — the design calls them "Action Type" / "Crit. Fac." / "Action #" but the real column names are unknown |

**First step of implementation, before anything else:** open the source's properties/schema view (or
`dms raw get 1029065` / `dms dataset dump`) and write the real names into this table. Three of the
four editable columns on this page are in the unverified set, so guessing here would waste the whole
build.

**Also profile `local_priority` while you are there** — the design's fill figures are placeholders
(see the design task's data note). The build needs the real distinct values and counts, because they
determine the `tierRank` map, the meter's segment list, and whether an "Other value" segment exists
at all:

```sql
select coalesce(nullif(trim(data->>'local_priority'), ''), '(unset)') as v, count(*)
from <actions_revised view table>
where data->>'county_geoid' like '%36105%'
group by 1 order by 2 desc;
```

## Scope

- **In:** one new draft page under pattern `MitigateNY_County_Template` (**1300890**), app
  `mitigat-ny-prod`; its section groups + draft sections; the page-variable registry; mny theme
  additions; specs + escalation for any library change.
- **Out:** publishing; touching page 2262755 or 2239721; any change to the Actions-Revised source or
  its views; the design system's page-index footer (review scaffolding, never ships).

### Page identity

| Field | Value |
|---|---|
| Title | `Jurisdiction Prioritization` |
| Slug | `track_progress/actions_database/actions_index/jurisdiction_prioritization` |
| Parent | `2175309` (Actions Index) — **confirm**; makes it a sibling of `action_prioritize` / `action_prioritize_v2` |
| published | `draft` |
| hide_in_nav | `true` (reached from the jurisdictions page, like its siblings) |
| authPermissions | mirror the siblings — `{"users":{"656":["*"]},"groups":{"public":[]}}` |

### Page variables — `data.filters` registry

This is the load-bearing glue ([`creating-interactive-pages.md`](../../../src/dms/skills/creating-interactive-pages.md) §0):
**a control not registered here is inert.** Register:

| Key | useSearchParams | Role |
|---|---|---|
| `geoid` | | county scope (36105) |
| `geoid_juris` | ✅ | **the page's scope** — which jurisdiction's worklist this is |
| `id` | ✅ | row → action detail |
| `implementation_status` | ✅ | stat-strip cells (needed for `activeOnSearchParam`) |
| `search` | | keyword box |
| `needs_local_priority` | ✅ | needs-attention tile 1 |
| `needs_cost` | ✅ | tile 2 |
| `needs_action_type` | ✅ | tile 3 |
| `critical_facility_state` | ✅ | tile 4 (state filter, not a unary empty) |
| `cost_state` | ✅ | the "64 hold a status note" drill-in |
| `needs_solution`, `needs_hazard`, `needs_problem`, `needs_location` | ✅ | the "Also missing" row |

---

## Sections to create — components and their data bindings

Layout is one boxed `content` band (the design section's rule: nothing sits on the topo canvas).
Rows are formed by section `size`: in the mny sectionArray map **`size:"2"` = full width** and
`"1"` = col-span-9 — see the v2 doc's correction. Side-by-side rows use the `1/3` + `2/3` pair.

Order: header → (lede + stat strip) → needs-attention → filter bar → worklist.

### 1. `lexical` — work header · full width

Static: breadcrumb (Track Progress / Sullivan County Actions / Jurisdictions / **jurisdiction**),
H1 "Jurisdiction Prioritization", the purpose line with its inline link to the county workspace,
"All jurisdictions" back-link, "Create Action" button.

**No data binding.** One caveat: the design shows the live jurisdiction name ("Fallsburg (Town)") in
the breadcrumb and purpose line, and **lexical cannot interpolate a page variable**. Options, in
preference order:
1. Ship the header generic ("this jurisdiction") — no gap, no fidelity.
2. A one-cell `Card` grouped by `geoid_juris` (`pageSize: 1`) rendering the jurisdiction name beside
   the lexical header — real data, costs a section.
3. A library enrichment (page-variable interpolation in lexical) — **out of scope**, flag only.

Recommend option 2 for the breadcrumb tail, option 1 wording elsewhere.

### 2a. `Card` — local-priority lede · `1/3`

Aggregate-only card, **`pageSize: 1`** (a whole-table aggregate card with `pageSize: 10` renders the
one real row plus nine zero clones — datawrapper skill §1.5).

| Cell | Column (`name`) | Config |
|---|---|---|
| the big count | `count(*) FILTER (WHERE local_priority IS NOT NULL AND local_priority <> '') as lp_set` | `origin:'calculated-column'`, `customName:"Local priority set"`, `type:'text'` (or `stat_value` if a unit is wanted), `valueFontStyle` = an Oswald 24px token |
| meter + legend | any calc (value unused), e.g. `count(*) as lp_host` | `type:'stacked_bar'`, `segments:[{col:'lp_high',label:'High',color:'#EAAD43'},{col:'lp_medium',label:'Medium',color:'#37576B'},{col:'lp_low',label:'Low',color:'#6D96AE'},{col:'lp_other',label:'Other',color:'#C5D7E0'},{col:'lp_unset',label:'Not set',color:'#FFFFFF'}]`, `showLegend:true`, `hideHeader:true`, `cellSpan` = full grid |
| segment feeds | `lp_high`, `lp_medium`, `lp_low`, `lp_other`, `lp_unset` | five `count(*) FILTER (WHERE …) as lp_x` calcs, `selectOnly:true` (fetched, no cell), `origin:'calculated-column'` |

`stacked_bar` reads its segments off **sibling columns on the same row** and computes proportions
client-side, so the meter *and* its counts legend are one cell — this is the whole lede in two
visible cells.

**Two hard SQL rules for every calc column on this page:**
- **No commas inside a calc expression.** On a DMS-internal (`isDms`) source, a comma fragments the
  SELECT list and the cell silently renders `0` — this bit the v2 build on page 2262755
  (`[[reference_dms_calc_column_no_commas]]`). So no `COALESCE`, `NULLIF`, `concat()`, or `IN (…)`.
  Use `LIKE`, `=`, `IS NULL`, `~`, nested `CASE`.
- No `;` inside a string literal (silently NULLs the cell); `round()` needs `::numeric`.

Styling: `cellBorderColor` for the amber left rule; `headerValueLayout:'row'` for label-left /
count-right (see the theme prerequisite below).

### 2b. `Card` — status stat strip · `2/3`

One aggregate row, four link cells (`cellsGridSize: 4`, `pageSize: 1`), scoped to the jurisdiction.

| Cell | Column | `location` | Config |
|---|---|---|---|
| All | `count(*) as st_all` | `?` | `isLink`, `activeOnSearchParam:true`, `cellBorderColor:'#2D3E4C'`, `customName:"<jurisdiction> actions"` |
| Proposed | `count(*) FILTER (WHERE implementation_status = 'Proposed') as st_proposed` | `?implementation_status=Proposed` | same + `cellBorderColor:'#C5D7E0'` |
| In-Progress | `… = 'In-Progress'` | `?implementation_status=In-Progress` | + `'#6D96AE'` |
| Completed | `… = 'Completed'` | `?implementation_status=Completed` | + `'#54B99B'` |

`activeOnSearchParam` (shipped in v2) reads `pageState.filters` and applies `dataCard.cellActive`;
the empty `?` location is the group's "All" cell, active only when no group key is set. This is why
`implementation_status` must be registered `useSearchParams`.

The design deliberately carries **no sublines** ("93% of Fallsburg" etc. were removed) — which
happens to retire the v2 build's deferred "stat-card caption sublines" item for this page.

### 3. `Card` — needs-attention band · full width

Four gap tiles + the "Also missing" row. Counts are calc columns; each tile links to its filter.

| Tile | Count column | Link |
|---|---|---|
| No local priority set | `count(*) FILTER (WHERE local_priority IS NULL OR local_priority = '') as gap_local_priority` | `?needs_local_priority=1` |
| No cost range | `… cost_range IS NULL OR cost_range = '' … as gap_cost` | `?needs_cost=1` |
| No action type | `… <action_type col> IS NULL … as gap_action_type` | `?needs_action_type=1` |
| Critical facility unanswered | `count(*) FILTER (WHERE <cf col> IS NULL OR <cf col> = '' OR <cf col> = 'Not Reported') as gap_cf` | `?critical_facility_state=unanswered` |

"Also missing" (`needs_solution` 60 · `needs_hazard` 30 · `needs_problem` 17 · `needs_location` 3):
either four more cells or a `lexical` line of links — the design renders them as plain links, so
lexical is the cheaper faithful choice.

**This is the section with the real fidelity gap.** Each tile in the mockup is a count + a bold
label + a description sentence + a toggle. A Card cell has two slots (header + value), so the
description has nowhere to go, and `isLink` is a one-way link — it cannot turn its own filter off.
Two library enrichments are proposed below (`toggleSearchParam`, `cellCaption`). Until they land:

- Phase 1: build the tiles as count + label (`customName`) with `isLink` + `activeOnSearchParam`.
  They filter correctly and show active state; they can't un-toggle (clear via the filter bar's
  Clear-all) and carry no description line.
- The band's lede sentence — including the "Local priority counts <jurisdiction>; the other three
  count the whole county" scope note — goes in a `lexical` section above the tiles.

### 4. `Filter` — filter bar · full width

`display.gridSize: 3` so the three controls render in one row. Set it **inside** the stringified
`element-data`, not as a top-level `data.display` — `dms section update --set display.gridSize=3`
writes a bogus key the filter never reads (v2 gotcha).

| Control | Column | Config |
|---|---|---|
| Search | any real column (the op is what matters) | `operation:'like'`, `searchParamKey:'search'`, `isMulti:false`, `usePageFilters:true`, `display.hideExternalToggle:true` |
| Jurisdiction | `geoid_juris` | `operation:'filter'`, `searchParamKey:'geoid_juris'` — a **switcher**, not a clearable filter (the page is jurisdiction-scoped by definition) |
| Status | `implementation_status` | `operation:'filter'`, `searchParamKey:'implementation_status'` |

Opt into the shipped filter chrome with `display.showActiveTokens` / `showClearAll`
(`filter-interactive-chrome`, v2).

### 5. `Spreadsheet` — the worklist · full width

The page's core. **Four editable columns**, per the design: local priority + the three gap fields.

| Column | Type / config |
|---|---|
| `action_name` | `isLink` → action view (`?id=`); the design bolds it (`font-[600]`) → a `valueFontStyle` token |
| `implementation_status` | `status_pill` + `pillColors` → mny `status_*` styles (shipped in v2) |
| `<action_type col>` | editable `select`, `allowEditInView`, `mapped_options` |
| `cost_range` | editable `select`, `allowEditInView`, `mapped_options` |
| `<critical_facility col>` | editable `select`, `allowEditInView`, `mapped_options` |
| **`local_priority`** | **`priority_tier`**, `allowEditInView`, with `tierRank: {"High":1,"Medium":2,"Low":3}`, `pillColors: {"High":"local_high","Medium":"local_medium","Low":"local_low"}`, `options` from the profiled distinct values |
| open / edit | link cells |

Requirements the dataWrapper enforces (v2 doc + `spreadsheet` config):
- source must be internal/editable and `apiUpdate` present — `dataWrapper/index.jsx:479` gates
  `allowEdit` on `(isDms || isEditable) && display.allowEditInView && apiUpdate`;
- **do not group by any column** — the same line forces `allowEdit` false when
  `groupByColumnsLength` is set;
- select columns need `mapped_options` for the dropdown (`index.jsx:531`);
- editable columns still render when empty (`index.jsx:665` exempts `allowEditInView` from the
  `hideIfNull` skip) — that is what lets a gap show as an empty control;
- `display.pageSize` is required even with `usePagination:false`.

**Filters** (section-level tree, `op:'AND'`):
- `county_geoid` like `%36105%` (county scope) + `geoid_juris` = page var (jurisdiction scope);
- the keyword `OR` group — one `like` leaf per searchable column, all
  `usePageFilters:true, searchParamKey:'search'` (see the skill; **replicate the same OR group on
  every section that should react to the search box**);
- one `empty`-op leaf per needs-* page variable (`local_priority`, `cost_range`, action type) and a
  value leaf for `critical_facility_state` / `cost_state`.

**Providers / display:**
- `_functions.providers` → `conditional_row_style`:
  `{column:'local_priority', when:'empty', styleKey:'rowAccentAmber'}` (shipped in v2) — the amber
  left edge on unranked rows;
- `display.openOutMode:'inline'` for the expanded problem/solution panel (shipped in v2; its live
  expand render was never eyeballed — verify here).

---

## New functionality needed

Most of what this page needs already exists, because the v2 county build shipped it: `priority_tier`,
`stat_value`, `stacked_bar`, `activeOnSearchParam`, `cellBorderColor`, `conditional_row_style`, the
`empty`/`notempty` filter op, `filter-interactive-chrome`, and `openOutMode:'inline'` are all present
in `src/dms/packages/dms/src` (verified in this session). What follows is what is genuinely missing.

### A. mny theme (`src/themes/mny/theme.js`) — no library change

1. **`dataCard.itemFlexRow` / `itemFlexCol` + a row-aligned card style — the load-bearing one.**
   The whole condensed hero geometry is `headerValueLayout:'row'` (toolbar: *Value Placement →
   Inline*), which puts the label inline left of the value with a `headerWidth`/`valueWidth` split.
   Two documented gotchas apply directly (`card-layout.md` §216): (a) if a site's `dataCard` omits
   `itemFlexRow`/`itemFlexCol`, `row` **silently** falls back to `flex-col` and everything stacks —
   check whether mny's `dataCard` has them and add `flex-row!` if not; (b) the default `header`/
   `value` classes carry asymmetric vertical padding tuned for stacked cells, which offsets label vs
   value even with `items-center` — add an mny card style whose `header`/`value` use horizontal-only
   padding (transportny's `rowaligned`: `header:"px-3"`, `value:"px-3"` is the precedent).
   **Without this the hero cannot be narrow**, which is the entire point of the redesign.
2. **`theme.pill`: `local_high` / `local_medium` / `local_low` / `local_unset` / `local_unknown`.**
   The `tier_1..4` + `tier_unset` palette from v2 already exists; add the local-priority variants
   (or alias them) so `priority_tier` on `local_priority` reads in brand.
3. **`theme.stackedBar.fills` + legend token** — brand fills for the rank meter (amber `#EAAD43`,
   steel `#37576B`, `#6D96AE`, `#C5D7E0`, white-with-dashed-amber for "Not set") and an 11px Proxima
   legend instead of the library's mono default.
4. **`theme.priority_tier.rankBadge`** — mny badge tints per rank.
5. Already present from v2, reuse as-is: `dataCard.cellActive`, `table.rowAccentAmber`,
   `table.openOutInline*`, `theme.filters` toggle/token/clear-all styling, `pill.status_*`.

### B. `@availabs/dms` library — escalate to `src/dms/planning/`

Each of these should get its own task doc under `src/dms/planning/tasks/current/` before any code,
per the submodule's planning rules. All four are additive/backward-compatible.

1. **`toggleSearchParam` Card-cell flag** *(needed for the needs-attention band to work as designed)*.
   `activeOnSearchParam` already computes whether a link cell's `location` params match the live page
   filters — but `location` is a static string, so an active cell still links to its own ON state and
   the tile can never be switched off. Proposal: a sibling flag that, when the cell is active, emits
   the **cleared** href instead (drop this cell's own params, keep the rest). Implementation sits
   next to `isLocationActive` in `ComponentRegistry/Card.jsx`, plus a `Card.config.jsx` checkbox.
   Small, and it makes every "filter tile" design in the system work, not just this page.
2. **A static caption line on a Card cell (`cellCaption`)** *(fidelity, not function)*. A cell has
   header + value and no third slot, so the tiles' description sentences ("Grant scoring needs a
   dollar band on every action.") have nowhere to live. This is the same gap the v2 build deferred as
   "stat-card caption sublines", so it is wanted by more than one design — which is the bar for a
   Card enrichment. Proposal: an optional per-column `cellCaption` string rendered under the value
   with a themed `dataCard.caption` class.
3. **`priority_tier`: `badgeLabel` override.** The badge renders the integer rank; the design wants
   **H / M / L** letters for local priority. `tierRank` already accepts a function or object map, so
   mirror that: `badgeLabel: {"High":"H","Medium":"M","Low":"L"}`, defaulting to the rank as today.
   ~5 lines in `priorityTier.jsx`.
4. **`priority_tier`: distinguish "unrecognized value" from "unset".** `local_priority` is **free
   text** in the source, so a row can hold something outside the ladder ("Priority 1 of 3"). Today
   `rankOf` returns null and `pillStyleFor` falls through to `tier_unset`, so a junk value is styled
   identically to a blank one — the design gives it the red "bad value" treatment that `cost_range`
   already uses. Proposal: when the value is non-empty but unranked, use a `tier_unknown` style key
   (theme-overridable), leaving `tier_unset` for genuinely empty.

**Blocking check before wiring the needs-* toggles:** the v2 task records the `empty`/`notempty` op
as code-complete but notes the *deployed* dms-server on devmny may not have it, and warns against
wiring a page against a server without the new code (`$N` placeholder desync). Confirm the deployed
server before enabling tiles 1–3.

### C. Not proposed, deliberately

- **Page-variable interpolation in lexical** (for the live jurisdiction name in the header) — a real
  gap, but a much larger change than this page justifies. Use the one-cell Card instead.
- **A composite `gap_tile` column type** rendering count + label + description + toggle in one cell.
  This is the tempting shortcut and it is the wrong one: `src/themes/CLAUDE.md` explicitly names
  "one big column type that renders an entire composite layout" as the anti-pattern, because it
  recreates the Card grid in a place authors can't reach. The two small enrichments (B1 + B2) get
  the same result and every future page benefits.

---

## Build method

A seed script under `scratchpad/mitigat-ny-prod-prod/` (gitignored), following
`build_action_prioritize_v2.mjs`:

1. `dms page create` → capture the id;
2. `dms raw update <id> --set` for `data.filters`, `hide_in_nav`, `authPermissions`,
   `draft_section_groups` (one `content` band);
3. per section, `dms section create <pageId> --element-type <t> --data '<json>'` with the band's
   `group` UUID and the section `size`;
4. print the new page id + slug.

Note there is **no idempotency guard** in the v2 script — re-running creates a second page. Delete
the page first when rebuilding.

## Testing checklist

- [ ] Pre-flight: every column name in the schema table above verified against the source; the four
      unattested ones resolved.
- [ ] `local_priority` distinct values + counts profiled; `tierRank` / `options` / meter segments
      built from real data, and the design page's placeholder figures updated to match.
- [ ] Page exists as a **draft** sibling under Actions Index; only `draft_*` populated.
- [ ] `/edit/<slug>` renders every section without errors.
- [ ] Lede: count + `stacked_bar` meter + legend render; segment counts sum to the jurisdiction total.
- [ ] Stat strip: four counts correct for the jurisdiction; active ring follows
      `?implementation_status=`; the `?` cell is active only when no status is set.
- [ ] Needs-attention: each tile's count matches its filter's result count; each tile filters the
      table.
- [ ] Filter bar: search narrows across all searchable columns; empty box returns everything;
      jurisdiction switcher re-scopes; Clear-all clears.
- [ ] Worklist: all four editable columns edit **and persist** (round-trip one value per column);
      `priority_tier` shows the dashed "Set priority" chip on unranked rows; unranked rows carry the
      amber left edge; inline open-out expands.
- [ ] No calc cell renders `0`/blank from a comma or `;` in its expression.
- [ ] No-regression spot check: one other Card-heavy and one other Filter page in mny still render
      (theme additions are global).
- [ ] (human) publish decision.
