# Action Prioritize (List) v3 — Design-Fidelity Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec: `mny-action-prioritize-v3-design-fidelity.md`.

**Goal:** Close the six design-fidelity gaps on the DRAFT Action Prioritize (List) page 2262755 so it matches `src/themes/mny/design/pages/actions-prioritize.html`.

**Architecture:** Enrich existing primitives (theme styles, columnTypes, `_functions` providers) rather than build custom sections. Three genuine `@availabs/dms` library changes (filter style mechanism, `edit_publish` provider, `county_badge` columnType) each get a `src/dms/planning/tasks/current/` doc and a dedicated subagent; everything else is mny-theme + per-section config.

**Tech Stack:** DMS CLI (`src/dms/packages/dms/cli/bin/dms.js`), `@availabs/dms` (submodule `src/dms/`), mny theme (`src/themes/mny/theme.js`), local Vite :5199 + dms-server :3001 (same remote DB), Playwright for screenshots.

## Global Constraints

- **No git, no publish, no deploy.** The user owns version control and deployment (workspace CLAUDE.md). No task ends in a commit. Page 2262755 stays `published:"draft"` throughout.
- **Backward-compatible by default.** New theme `styles[]` entries, new columnTypes, new provider functionIds — never change existing defaults. Filter `styles[0]` and table `styles[0]` must remain byte-identical to today.
- **Verification = dev-server render + Playwright screenshot + BC spot-check**, not unit tests. Drafts render only at `county_template.localhost:5199/edit/<slug>` (start Vite with `VITE_DMS_APP=mitigat-ny-prod VITE_DMS_TYPE=prod VITE_DMS_PG_ENVS=hazmit_dama VITE_API_HOST=http://localhost:3001 … --port 5199`; seed `userToken` from a :3001 login). Stop the server when done.
- **Every new activeStyle / columnType / theme key is registered in** `src/themes/mny/design/design-system/components.html` (columnTypes also in `column-types.html`) as part of its task.
- **Calc columns contain no commas** (`reference_dms_calc_column_no_commas`).
- **Never touch** `sections`/`section_groups` (only `draft_*`); never mutate the `Actions_Revised` source.
- Each `@availabs/dms` change: its own `src/dms/planning/tasks/current/<feature>.md`, built by a subagent, BC/additive, then wired + verified by the orchestrator.
- Section IDs on 2262755: header (lexical), lede Card **2262775**, stat Card **2262757**, view-toggle (lexical), Filter **2262759**, Spreadsheet **2262760**. Page var of interest: `geoid` (=36105). Confirm each id with `dms raw get 2262755` before editing (align passes may have renumbered).

---

> **Phase A — DONE (2026-07-16), verified on :5199.** A1: added `theme.table.styles[2]` "mny-clean"
> (bottom-border-only `cell`), set `display.tableStyle:2` on 2262760 → no vertical dividers, other
> tables untouched. A2: column sizes on 2262760 — geoid_juris 190 / implementation_status 150 /
> action_name `stretch` / county_priority 280 (open-out was already `openOutMode:inline` + 5 fields).
> A3: lede 2262775 → 5 per-tier count columns (`fn:"sum"`, **`show:true`+`selectOnly:true`**) + a
> `stacked_bar` column (`name:"1 AS _tierbar"`, `fn:"sum"`, reads the counts via `segments`) + mny
> `theme.stackedBar` palette. Both new styles registered in `design-system/components.html`.
> **Gotchas (debugged live):** aggregate calc cols need `fn:"sum"` or mixed bare-CASE/sum(CASE) →
> invalid GROUP-BY → empty card; the bar column must have a `name` (`splitColNameOnAS`) so
> `origin:"static"` fails; hidden feeder cols must be `show:true`+`selectOnly:true` (not `selectOnly`
> alone → 0 rows; not `hideValue` → empty boxes). Scripts: `v3_phaseA_apply.mjs`, `v3_a3_fix.mjs`.
> Page 2262775/2262760 pre-change backups in `scratchpad/mitigat-ny-prod-prod/v3_backup_*.json`.

## Phase A — theme + config quick wins (no library change)

### Task A1: Borderless table style (#6)

**Files:**
- Modify: `src/themes/mny/theme.js` (the `table` block — add a `styles[]` variant)
- Modify: `src/themes/mny/design/design-system/components.html` (register the activeStyle)
- Config: Spreadsheet section 2262760 (select the style) — via `scratchpad/mitigat-ny-prod-prod/v3_a1_table_style.mjs`

**Interfaces:**
- Produces: a named table style (e.g. index `styles[N]`, styleKey label `"mny-clean"`) whose `cell` drops the vertical rule.

- [ ] **Step 1:** `dms raw get 2262755` → confirm the Spreadsheet section id and read its `element-data.display` (does it already set a table `activeStyle`?). Read the current mny `theme.table` styles array.
- [ ] **Step 2:** Add a new entry to mny `theme.table.styles` inheriting from `styles[0]`, overriding only:
  `cell: 'relative flex items-center min-h-[35px] border-b border-mny-100'` (bottom rule only — was `border border-slate-50`). Leave `rowAccentAmber`, `openOutInline*` intact.
- [ ] **Step 3:** Point section 2262760 at the new style (the table style selector writes `display.activeStyle` or the section-level style index — confirm the key from `spreadsheet/config.jsx` "Layout Group Styles" control). Parse element-data, set inside it, re-stringify (the `display`-is-inside-element-data gotcha).
- [ ] **Step 4:** Render `…:5199/edit/<slug>`, screenshot the table → **verify no vertical dividers, horizontal row rules only**, amber unset-row edge still shows.
- [ ] **Step 5:** BC: load one other mny table page (e.g. an actions-dashboard section) → confirm unchanged (still `styles[0]`).
- [ ] **Step 6:** Register "mny-clean table" in `components.html` (table-styles area) with a before/after note.

### Task A2: Table column sizing + inline open-out (#5)

**Files:**
- Config: Spreadsheet 2262760 element-data columns — via `scratchpad/mitigat-ny-prod-prod/v3_a2_columns.mjs`

**Interfaces:**
- Consumes: the `spreadsheet-inline-openout` feature (`display.openOutMode:'inline'`, built Phase 3) and per-column `size`/`openOut` knobs.

- [ ] **Step 1:** Read 2262760 columns. Map design → columns: caret/gutter (40) · Jurisdiction (`size:190`) · Status (`size:150`) · Action Name (`stretch:true`, no fixed size) · County Priority (`size:280`).
- [ ] **Step 2:** Set each column's `size`/`stretch` + order to the above. Keep `county_priority` as the `priority_tier` type and `implementation_status` as `status_pill`.
- [ ] **Step 3:** Choose the open-out detail field set to match the design's expanded panel (`actions-prioritize.html:374-411` — problem statement, solution/description, hazard, cost, lead agency, etc.); mark those columns `openOut:true` and set `display.openOutMode:'inline'`.
- [ ] **Step 4:** Render + screenshot → **verify column widths/order match the design; caret expands an inline detail panel** with the chosen fields.
- [ ] **Step 5:** No design-system entry (uses existing knobs). Note the chosen open-out field list in the spec's Log.

### Task A3: Progress-lede stacked bar (#2)

**Files:**
- Config: lede Card 2262775 element-data — via `scratchpad/mitigat-ny-prod-prod/v3_a3_stacked_lede.mjs`
- Modify: `src/themes/mny/theme.js` (add `stackedBar` fills)
- Modify: `components.html` (register the `stackedBar` palette)

**Interfaces:**
- Consumes: `stacked_bar` columnType (`ui/columnTypes/stacked_bar.jsx`), `segments:[{col,label,color}]`, reads sibling `selectOnly` count columns.

- [ ] **Step 1:** Read 2262775. Add five aggregate count calc columns over `Actions_Revised` (comma-free, `fn:"exempt"`, `selectOnly:true`), e.g. `count(*) filter (where data->>'county_priority' like 'Tier 1%') as t1` … `t4`, and `count(*) filter (where nullif(trim(coalesce(data->>'county_priority' '')) '') is null) as tnone` — **verify each fragment has no comma** (rewrite any `coalesce(a, b)` as nested/`||`-free forms; test the SQL via `q.mjs` before wiring).
- [ ] **Step 2:** Add a `stacked_bar` column with `segments:[{col:'t1',label:'T1',color:'tier1'},{col:'t2',…},{col:'t3',…},{col:'t4',…},{col:'tnone',label:'Not set',color:'tierNone'}]`, `showLegend:true`, `emptyText:"No priorities set yet"`.
- [ ] **Step 3:** Add mny `theme.stackedBar.fills`: `tier1:'bg-[#EAAD43]'`, `tier2:'bg-[#37576B]'`, `tier3:'bg-[#6D96AE]'`, `tier4:'bg-[#C5D7E0]'`, `tierNone:'bg-white border border-mny-200'`. Keep the "N / 473 · %" `stat_value` + "X to go" chip already present.
- [ ] **Step 4:** Render + screenshot → **verify the stacked bar + legend renders** (≈100% "Not set" for Sullivan today — expected/honest).
- [ ] **Step 5:** Register the `stackedBar` tier palette in `components.html`.

---

## Phase B — data-driven county header (#1)

### Task B1: Confirm the counties reference source

- [ ] **Step 1:** Verify a bindable counties source with `name` + `geoid`. Candidate: TIGER counties used by the actions_location worker — `tiger.tl_s1567_v2157` (source **1567** / view **2157**, `hazmit_dama`). Check it's in `data_manager.sources` with `metadata.columns` (via `q.mjs hazmit_dama "select source_id, name, metadata->'columns' from data_manager.sources where source_id=1567"`), and that view 2157 exposes `geoid`,`name`.
- [ ] **Step 2:** If 1567/2157 isn't Card-bindable (no metadata.columns), find the counties source the app already exposes (`dms dataset list`) or add `metadata.columns` (BC merge). Record the final source/view id in the spec Log.

### Task B2: `county_badge` columnType (library, subagent) — OR decide Card cells

**Files:** `src/dms/planning/tasks/current/columntype-county-badge.md` (new); `src/dms/.../ui/columnTypes/countyBadge.jsx` + `index.jsx`; `components.html` + `column-types.html`.

- [ ] **Step 1:** Decide: if the pin-icon pill can be a Card `image`/static-icon cell + two text cells, skip the columnType (config only). If it needs the composed pill (icon + "{name} County" + "FIPS {geoid}") as one cell, spin the columnType.
- [ ] **Step 2 (if columnType):** Write `src/dms/planning/tasks/current/columntype-county-badge.md`; dispatch a subagent to build `countyBadge.jsx` (renders pin icon + name + FIPS from the row; themed; BC/additive; registered in `ui/columnTypes/index.jsx`).
- [ ] **Step 3:** Register in `column-types.html` + `components.html`.

### Task B3: Wire the header Card

**Files:** header section on 2262755 (replace the static county text); `scratchpad/mitigat-ny-prod-prod/v3_b3_county_header.mjs`.

- [ ] **Step 1:** Add/repoint a small Card bound to the counties source (Task B1), `externalSource` env `hazmit_dama`, with a `usePageFilters` leaf on the county `geoid` column keyed to the page `geoid` var.
- [ ] **Step 2:** Show `name` + `geoid` via `county_badge` (or cells) styled as the design's pill; remove the hardcoded "Sullivan County · FIPS 36105" from the Lexical header.
- [ ] **Step 3:** Render + screenshot → **verify the header pill shows "Sullivan County / FIPS 36105" from data**; changing the `geoid` var (temp) changes the header.

---

## Phase C — filter pill styles (#3, library)

### Task C1: Filter `activeStyle`/`styles[]` mechanism (subagent)

**Files:** `src/dms/planning/tasks/current/filter-scoped-styles.md` (new); Filter theme + `ExternalFilters`/`RenderFilters` theme consumption + `Filter` config selector in `src/dms/…`.

- [ ] **Step 1:** Write the src/dms task doc: mirror the table theme pattern — `filters.options.activeStyle` (default 0) + `filters.styles[]` (styles[0] = today's flat map, verbatim → BC), and a per-section "Filter Style" selector in the Filter config that writes the chosen index into element-data. `getComponentTheme(theme,'filters',activeStyle)` resolves with inheritance from styles[0].
- [ ] **Step 2:** Dispatch a subagent to implement it (BC/additive). Acceptance in that doc: existing filters (styles[0]) render byte-identical; a section can select a variant.
- [ ] **Step 3:** Orchestrator verifies BC on an existing filter page (unchanged) + confirms the selector appears.

### Task C2: mny `pillBar` variant + wire 2262759

**Files:** `src/themes/mny/theme.js` (`filters.styles[]` pillBar); config on 2262759; `components.html`.

- [ ] **Step 1:** Add a `pillBar` entry to mny `theme.filters.styles` reproducing the design chrome: bar `bg-mny-50 rounded-[12px] border border-mny-100`; each control `bg-white rounded-full px-3 py-1.5 border border-mny-200`; search pill with icon; keep the already-styled toggle/tokens/clear-all keys.
- [ ] **Step 2:** Select `pillBar` on Filter 2262759 (the Task C1 selector). Keep `gridSize`/the Needs-priority toggle wiring.
- [ ] **Step 3:** Render + screenshot → **verify the filter bar matches the design** (pill controls + chevrons + toggle + tokens + clear-all + count + view switch).
- [ ] **Step 4:** BC: another filter page still uses styles[0] (unchanged). Register the `pillBar` activeStyle in `components.html`.

---

## Phase D — immediate data reflection (#4, library)

### Task D1: `edit_publish` provider (subagent)

**Files:** `src/dms/planning/tasks/current/provider-edit-publish.md` (new); dataWrapper edit/persist path + `_functions` provider registration in `src/dms/…`.

- [ ] **Step 1:** Write the src/dms task doc: define an `edit_publish` provider — on a successful `liveEdit`/`allowEditInView` cell persist, publish a fresh value (e.g. the edited row id or a tick) to `paramKey` (an action page-filter), same publish path `add_publish` uses. Subscribers (`data_refresh`, already in `useDataLoader.js:213`) then refetch. BC: no effect unless a section declares the provider.
- [ ] **Step 2:** Dispatch a subagent to implement it (BC/additive; unit of change = the spreadsheet/dataWrapper persist success handler + provider registry). Acceptance: editing a liveEdit cell bumps the param; a subscribed section refetches.
- [ ] **Step 3:** Orchestrator verifies the mechanism on the dev server without mutating the shared source where possible (e.g. a scratch section), per the "don't mutate Actions_Revised in dev" rule.

### Task D2: Wire the refresh (all three sections)

**Files:** config on 2262760 (provider), 2262775 + 2262757 + 2262760 (subscribers); `scratchpad/mitigat-ny-prod-prod/v3_d2_refresh_wire.mjs`.

- [ ] **Step 1:** On Spreadsheet 2262760 add `display._functions.providers:[{functionId:'edit_publish', enabled:true, paramKey:'priority_v'}]`; register `priority_v` as an action page var.
- [ ] **Step 2:** Add `display._functions.subscribers:[{functionId:'data_refresh', enabled:true, paramKey:'priority_v'}]` to the lede Card 2262775, the stat Card 2262757, and the Spreadsheet 2262760 itself (fetchMode smart/force on subscribers).
- [ ] **Step 3:** Render `…/edit/<slug>`; assign a `county_priority` on one row → **verify the lede count + tier bar, the stat cells, and the table all refetch with no reload** (and the row drops if the Needs-priority toggle is on). Use a single controlled pick; note that a true persisted round-trip against the shared source is a human/publish-time confirmation.

---

## Wrap
- [ ] All new activeStyles (mny-clean table, pillBar filter), columnType (county_badge if built), and theme keys (stackedBar fills) registered in `components.html` / `column-types.html`.
- [ ] BC spot-check: one other Card page, one Filter page, one Table page unchanged.
- [ ] Update the spec doc + memory; page 2262755 remains DRAFT (hand publish/deploy to the owner).

## Self-review notes
- Spec coverage: all six gaps + the design-system-registration discipline have tasks (A1 #6, A2 #5, A3 #2, B #1, C #3, D #4). ✓
- The three library changes are isolated to their own src/dms docs/subagents (filter styles, edit_publish, county_badge). ✓
- Verification adapted to DMS (render/screenshot/BC) since there is no unit-test harness for theme/config/columnType work; no git steps (workspace rule). ✓
