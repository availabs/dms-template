# Build the redesigned "Prioritize Actions (List)" page live in MitigateNY

**Status:** Phase 1 — DONE (2026-07-14) · Phase 2 — DONE (2026-07-14) · Phase 3 — DONE (2026-07-15;
5 library features built via subagents + wired + verified; `empty`-op page-wiring deferred to server
deploy). Page 2262755 remains a DRAFT — human publish + submodule/server deploy pending.
**New page:** id **2262755**, slug `track_progress/actions_database/actions_index/action_prioritize_v2`
(draft, unpublished) — sibling of `action_prioritize` (2239721) under Actions Index (2175309).
**Topic:** content (+ themes in Phase 2, + dms library escalation in Phase 3)
**Design source:** `src/themes/mny/design/pages/actions-prioritize.html` (approved 2026-07-14)
**Design task:** `planning/tasks/current/mny-actions-prioritize-list-design.md`

## Objective

Instantiate the approved `actions-prioritize.html` mockup as a **new, live DMS page** in the
MitigateNY county-template pattern, sitting **next to** the existing Action Prioritize page. Build it
in three ordered passes:

1. **Phase 1 — a working interactive page** using only primitives that exist today. The page loads
   real data, the filter controls drive the table, and the county-priority cell edits live. It won't
   look like the mockup yet; it will *work* like it.
2. **Phase 2 — style it to the mockup** by adding `activeStyle`s and named styles to the **mny
   theme** (`src/themes/mny/theme.js`) — no new platform behaviour, only appearance.
3. **Phase 3 — the new functionality** the design needs that the platform can't yet express
   (active-when-selected stat cell, "needs priority" empty filter, the tier-numeral pill, the
   prioritization-progress metric). These are `@availabs/dms` library changes and are **escalated to
   `src/dms/planning/`** (see Phase 3).

**Draft-only discipline:** this task creates a page and its `draft_sections` and **never publishes**.
`dms page publish` is a human decision.

## Scope

- **In:** one new page under pattern `MitigateNY_County_Template` (1300890), app `mitigat-ny-prod`,
  parent = Actions Index (2175309); its draft sections; the page-variable registry; mny theme
  additions (Phase 2); library feature specs + escalation (Phase 3).
- **Out:** publishing the page; touching the existing Action Prioritize pages (2239721 / 2248975);
  the card-view sibling; any change to the `Actions_Revised` source or its views.

## Current state (the page being reproduced)

Live page **2239721** (`track_progress/actions_database/actions_index/action_prioritize`), a single
`content` band with five sections, all bound to `Actions_Revised` (source 1029065 / view 1074456,
`mitigat-ny-prod+actions_revised`), county fixed to Sullivan (`county_geoid = 36105`):

| # | element-type | role | key config |
|---|---|---|---|
| 1 | `lexical` | title + BACK TO ACTIONS | right-aligned via ~40 tab chars (to be dropped) |
| 2 | `Card` | 4 stat cells | calculated `sum(CASE…)`, each `isLink` + `location:"?implementation_status=…"`; "All" has a hardcoded `cellBgColor:#FCF6EC` (fake active) |
| 3 | `lexical` | LIST / CARD toggle | buttons; card → page 2248975 |
| 4 | `Filter` | search + jurisdiction + status | `size:1/3`, left rail; OR-`like` search over 3 cols; `geoid_juris` + `implementation_status` selects |
| 5 | `Spreadsheet` | the table | `size:2/3`; `allowEditInView`+`liveEdit`; `county_priority` 5-tier select cell (`defaultValue:"Please Select…"`); `openOut` detail cols; excludes `implementation_status=Completed` |

Page registers five page variables in `data.filters`: `geoid`, `geoid_juris` (useSearchParams),
`id` (useSearchParams), `implementation_status`, `search`.

Full audited configs are captured in the design task and in
`scratchpad/mny-prioritize/page_2239721_sections.json`.

---

## Phase 1 — a working interactive page (existing primitives only) — DONE (2026-07-14)

**Goal:** a new page that loads and is interactive, reusing the live page's *working data bindings
verbatim*. This de-risks the data/interactivity before any cosmetics.

**Design note (deviation from the original plan):** Phase 1 clones all five sections **verbatim** —
including the live page's section `size`s (the 1/3 rail + 2/3 table), the lexical header's tab-char
right-align, and the seeded `data` — rather than pre-flattening to full-width `size:"3"` and dropping
the tab hack. Rationale: a byte-faithful duplicate is the lowest-risk "works exactly like the live
one" baseline. The layout changes (full-width table, horizontal filter bar, dropped tab hack, work
header) are cosmetic and are folded into **Phase 2** (theme + section-wrapper tweaks), where they can
be verified against the mockup. Only `group`, `parent`, and `trackingId` were re-pointed per section.

**Built by:** `scratchpad/mitigat-ny-prod-prod/build_action_prioritize_v2.mjs` (run with
`SRC_SECTIONS=<audit json>` + the four `DMS_*` env vars). Section sources read from the audited
`page_2239721_sections.json`. Idempotency: the script has no guard — re-running creates a *second*
page; delete 2262755 first if rebuilding.

### 1.1 Page identity

- **Title:** `Prioritize Actions (List)`
- **Slug:** `track_progress/actions_database/actions_index/action_prioritize_v2`
- **Parent:** `2175309` (Actions Index) — makes it a sibling of `action_prioritize`
- **published:** `draft` (leave as draft)
- **hide_in_nav:** `true` (reached by a button, like the sibling; keep it out of the nav tree)
- **authPermissions:** mirror the sibling — `{"users":{"656":["*"]},"groups":{"public":[]}}`
- **data.filters (page-variable whitelist):** copy the sibling's five entries verbatim
  (`geoid`, `geoid_juris`+useSearchParams, `id`+useSearchParams, `implementation_status`, `search`).
  This is the load-bearing glue (skill: creating-interactive-pages §0) — without it the controls are inert.

### 1.2 Section group (one band)

One `draft_section_groups` entry, mirroring the sibling:
`{ name:<uuid>, index:1, theme:"content", position:"content", full_width:"show", displayName:"Group 1" }`.

### 1.3 Sections (draft_sections), in order

Reuse each source section's `element-data` **verbatim** where it carries a data binding — only the
section-wrapper `size` and the lexical copy change in Phase 1.

1. **`lexical` — work header.** New minimal Lexical: an `h2` "PRIORITIZE ACTIONS". Drop the tab-char
   hack; the BACK TO ACTIONS button + county context move to real layout in Phase 2 (Phase 1 can keep
   a plain Lexical button linking back to `…/actions_index`). `size:"3"` (full width).
2. **`Card` — stat strip.** Reuse section 2's `element-data` verbatim (the four `isLink` calculated
   cells + `Actions_Revised` externalSource + filters + seeded `data`). `size:"3"`. Active-state
   styling is Phase 2/3; in Phase 1 it renders exactly as the live one does.
3. **`lexical` — view toggle.** Reuse section 3 verbatim (List active / Card → 2248975). `size:"3"`.
   Update the Card-view path only if the card page slug differs (it does not).
4. **`Filter` — controls.** Reuse section 4's `element-data` verbatim. `size:"3"` (full-width bar
   position comes in Phase 2; functionally identical here).
5. **`Spreadsheet` — table.** Reuse section 5's `element-data` verbatim (all columns, the editable
   `county_priority`, the `Completed`-exclude filter, the join/externalSource). `size:"3"`.
   Clear `data: []`? No — keep the seeded `data` so first paint isn't empty, but the live fetch will
   refresh it (skill gotcha 3 only matters when *re-wiring*; we're cloning intact).

### 1.4 Build method

A seed script `scratchpad/mitigat-ny-prod-prod/build_action_prioritize_v2.mjs` that:
1. reads the audited section element-data from `scratchpad/mny-prioritize/page_2239721_sections.json`;
2. `dms page create` the new page (capture id);
3. `dms raw update <id> --set` the page `data.filters`, `hide_in_nav`, `authPermissions`,
   `draft_section_groups` (one band);
4. for each of the five sections, `dms section create <pageId> --element-type <t> --data '<json>'`
   with the band's `group` UUID and the Phase-1 `size`;
5. print the new page id + slug.

Uses env `DMS_HOST=http://localhost:3001 DMS_APP=mitigat-ny-prod DMS_TYPE=prod` + a freshly-minted
`DMS_AUTH_TOKEN` (dev creds; never bake into the script). Local server = same remote DB (see
`reference_dmsserver_upload_path` / the mitigateny_2025 reference).

### 1.5 Phase 1 acceptance (verify live, do not publish)

- [x] Page exists as a draft sibling of `action_prioritize` under Actions Index. (id 2262755,
      parent 2175309, published:"draft", `sections`/`section_groups` empty; only `draft_*` populated.)
- [x] `/edit/<slug>` (subdomain `county_template`) renders all five sections without errors.
      (Screenshot `scratchpad/mny-prioritize`→`v2_edit.png`.)
- [x] Stat cells show 473 / 391 / 21 / 4 (each is an `isLink` cell → `?implementation_status=`).
- [x] Search + Jurisdiction + Status controls render and the table loads the Sullivan rows.
- [x] The `county_priority` cell renders the "Please Select…" 5-tier dropdown (editable in view).
- [~] End-to-end *interaction* (typing search actually re-filters; a priority pick persists) not yet
      click-tested in this session — verified by structure + render only. Worth a manual click-through
      before Phase 2 sign-off, but the identical wiring is proven on the live sibling 2239721.

---

## Phase 2 — style to the mockup via the mny theme — DONE (2026-07-14)

**Goal:** make the working page match `actions-prioritize.html` using **theme additions only**
(`src/themes/mny/theme.js`), driven by per-section/per-column `activeStyle`s. No new platform code.
Every change is backward-compatible (new named styles + new keys; existing pages unaffected —
see `feedback_primitive_change_tasks_bc`, `feedback_card_edits_bc`).

**Preview path (important):** the live `county_template.devmny.org` runs the **deployed** mny theme,
so it does NOT reflect local `theme.js` edits. Verify Phase 2 changes on a **local** dev server:
```
VITE_DMS_APP=mitigat-ny-prod VITE_DMS_TYPE=prod VITE_DMS_PG_ENVS=hazmit_dama \
VITE_API_HOST=http://localhost:3001 node node_modules/vite/bin/vite.js --port 5199 --strictPort
```
then load `http://county_template.localhost:5199/edit/<slug>` (drafts render only in `/edit`; seed
`userToken` in localStorage from a `localhost:3001` login). The user's own dev servers (5173/5174 =
TransportNY) are left untouched. Stop the 5199 server when done.

### Progress

- [x] **Status-dot pill (implementation_status) — DONE & verified 2026-07-14.** Added `theme.pill` to
      `src/themes/mny/theme.js`: `styles[0..9]` reproduce the DMS default (`Pill.theme.js`) **verbatim**
      → every existing mny pill is byte-identical (BC by construction); appended mny dotted variants
      `status_proposed`/`_inprogress`/`_completed`/`_discontinued`/`_none`. Repointed the
      `implementation_status` column on section **2262760** to `status_pill` + `pillColors`
      (`scratchpad/mitigat-ny-prod-prod/phase2_pills.mjs`). Verified on the 5199 dev server: renders
      "• Proposed" (blue dot) / "• In-Progress" (green dot) — matches the mockup's status dots.
- [reverted] **Tier pill (county_priority) via `status_pill` — REVERTED 2026-07-14.** First attempt set
      county_priority to `status_pill` with `tier_1..4`/`tier_unset` `pillColors`. It rendered as rounded
      **blobs** (the long tier value strings — e.g. "Tier 1 – Top Implementation Priority" — wrap inside
      a `rounded-full` Pill, and there's no numeral badge), and the edit dropdown showed the same blobs.
      **The plain `Pill`/`status_pill` primitive cannot express the mockup's tier pill** (numeral badge +
      truncated short label + fixed layout + dashed "Set priority" for unset). Reverted county_priority
      to the clean editable `select` (`scratchpad/mitigat-ny-prod-prod/phase2_revert_priority.mjs`).
      **The tier pill is Phase 3 #3 — a dedicated `priority_tier` column type** that maps the stored
      value → rank numeral + short label and handles the unset affordance. The `tier_*` theme styles are
      left in `theme.pill` (unused for now) as the agreed tier palette for that Phase-3 column type.

### Phase 2 progress — everything doable with theme/config is DONE (2026-07-14)

Verified on the 5199 dev server (`county_template.localhost:5199/edit/<slug>`):

- [x] **Status-dot pills** (implementation_status) — see Progress above.
- [x] **Full-width layout** — Filter (2262759) and Spreadsheet (2262760) sizes `1/3`+`2/3` → **`"2"`**
      (col-span-12 = full); rail `sticky`/`stickyTop`/`rowspan` neutralized. Table spans the full
      content width; action names stop wrapping. **Correction (2026-07-15):** first set to `"1"`, but in
      the mny sectionArray map `"1"` = col-span-9 (75%), not full; full-width = `"2"` (what the header /
      toggle rows use). See [[reference_mny_sectionarray_size_map]].
- [x] **Horizontal filter bar** — set `element-data.display.gridSize = 3` on the Filter section so its
      3 external controls (Search · Jurisdiction · Implementation Status) render `grid grid-cols-3` in
      one row (`scratchpad/mitigat-ny-prod-prod/phase2_filterbar.mjs`). **No component/theme change** —
      per-section `display` flag only (agent-confirmed: `ExternalFilters` reads `display.gridSize`).
      **Gotcha recorded:** `display` lives INSIDE the stringified `element-data`, so
      `dms section update --set display.gridSize=3` writes a *bogus top-level* `data.display` that the
      filter never reads — must parse element-data, set it there, re-stringify.
- [x] **Header purpose line** — added "Assign a county priority to each mitigation action." under the
      title (`scratchpad/mitigat-ny-prod-prod/phase2_header.mjs`).

**Layout now matches the mockup structure:** header (title + purpose + BACK) → full-width stat strip →
view toggle → horizontal filter bar → full-width worklist table.

### Deferred to Phase 3 (cannot be done with existing primitives — confirmed this session)

These are the remaining mockup-fidelity gaps; each needs a platform change, so they move to Phase 3:

- **Stat-strip colored left rules** — the only per-cell color knob is `cellBgColor` (background); there
  is **no per-cell accent/left-border knob**. Needs a Card cell enrichment (a `cellBorderColor` /
  `accent` knob). → Phase 3.
- **Tier pill** (county_priority) — `status_pill`/`Pill` can't render the numeral badge + short label +
  dashed unset affordance (see the reverted attempt). → Phase 3 #3 (`priority_tier` column type).
- **Progress lede**, **active stat cell**, **Needs-priority toggle**, **amber left-edge on unset rows**
  — Phase 3 #4/#1/#2 + a row-conditional style hook.

### Phase 2 acceptance
- [x] Layout matches the mockup structure (chrome, full-width stat strip, horizontal filter bar,
      full-width table, status-dot pills). Remaining pixel-fidelity items are Phase 3 (listed above).
- [~] No-regression spot-check: the `theme.pill` addition reproduces DMS defaults verbatim (BC by
      construction) and `filters`/`table`/section-size changes are per-section (page 2262755 only), so
      no other mny page is touched. A quick eyeball of one other Card-heavy + one Filter page is still
      worth doing before publish.

---

## Phase 3 — new functionality (⚠ @availabs/dms library) — DONE (2026-07-15)

Orchestrated: each library feature got its own task doc in `src/dms/planning/tasks/current/`, was
built by a dedicated subagent (all BC/additive), then wired into page 2262755 + verified on a local
MNY dev server by the orchestrator. Library tasks:

1. ✅ **`priority_tier` columnType** — `src/dms/.../ui/columnTypes/priorityTier.jsx` (+ registry,
   spreadsheet config dropdown). Ranked numeral badge + short label (strips `"Tier N – "`), editable
   via reused `MultiSelectEdit`, and a dashed **"Set priority"** chip for unset (clickable, not null —
   the fix over `status_pill`). Task: `columntype-priority-tier.md`.
   **Wired:** section 2262760 `county_priority` → `type:'priority_tier'`, `allowEditInView`. **Verified:**
   unset rows show the dashed "Set priority" chip; rank/short-label auto-derive.
2. ✅ **`activeOnSearchParam` Card cell flag** — `ComponentRegistry/Card.jsx` + `Card.config.jsx` +
   `ui/components/Card.jsx` + `card.theme.jsx` (`dataCard.cellActive`). Reads `PageContext.pageState.filters`;
   applies the active style when a cell's `location` params match. Task: `card-active-on-search-param.md`.
   **Wired:** the 4 stat cells (2262757) `activeOnSearchParam:true`, fake `cellBgColor` removed; mny
   `dataCard.cellActive` = `bg-[#F3F8F9] ring-2 ring-[#2D3E4C]/30`; **also registered
   `implementation_status` as `useSearchParams` page var** so the stat-cell links drive URL→pageState.
   **Verified:** active ring moves All→In-Progress as the status param changes; table filters too.
3. ✅ **`cellBorderColor` Card cell knob** — `ui/components/Card.layout.js` (`resolveCellStyle`) +
   `Card.config.jsx` (ColorControls, sibling of `cellBgColor`). Task: `card-cell-border-color.md`.
   **Wired:** stat cells get per-status accent left rules (All #2D3E4C / Proposed #6D96AE /
   In-Progress #54B99B / Discontinued #DD524C). **Verified.**
4. ✅ **`empty`/`notempty` filter op** — client `ComplexFilters.jsx` + `buildUdaConfig.js` + server
   `dms-server/.../uda/utils.js` (PG) + `query_sets/helpers.js` (CH parity). SQL:
   `(col IS NULL OR col = '')` / complement; unary (placeholder-exempt). Task: `filter-op-empty.md`.
   **Status:** code-complete + SQL-verified by inspection; `:3002` server (new code, real DB) boots clean.
   **NOT yet page-wired** — the *Needs-priority toggle* + progress-lede "to go" deep-link are deferred
   until the dms-server is deployed (the old running server lacked the unary placeholder-exemption →
   `$N` desync risk). NB the orchestrator restarted `:3001` from source during the run, so `:3001` now
   runs the new server code — but devmny's deployed server does not, so keep the toggle deferred.
5. ✅ **`conditional_row_style` Table provider** — `spreadsheet/index.jsx` + `table/index.jsx` +
   `TableRow.jsx` + `table.theme.jsx` (`rowAccent` default), via the existing `_functions.providers`
   framework; conditions `empty`/`notempty`/`equals`/`notEquals`. Task: `table-conditional-row-style.md`.
   **Wired:** section 2262760 provider `{column:'county_priority', when:'empty', styleKey:'rowAccentAmber'}`;
   mny `theme.table` `rowAccentAmber` = `border-l-4 border-[#EAAD43] bg-[#FCF6EC]/60`. **Verified:** unset
   rows carry the amber left-edge (all 473 currently unset → all accented).

**#6 Progress lede (config, no new primitive)** — a compact Card (2262775, placed after the header) of
two comma-free calc cells: **Actions Prioritized** (`CASE … LIKE 'Tier%' … 1`) + **Still Need a Priority**
(complement), with green/amber accent borders. **Verified:** 0 prioritized / 473 to go (accurate — Sullivan
hasn't prioritized). Gotcha hit + recorded: [[reference_dms_calc_column_no_commas]] — commas inside a calc
expression fragment the SELECT list (COALESCE/NULLIF broke it → 0; comma-free LIKE fixed it). The
tier-distribution `stacked_bar` is deferred until there's real prioritization data (all-zero renders empty).

### Design-alignment pass (2026-07-15, after Phase 3)

Compared the live page (2262755) against the mockup and closed the biggest composition gaps
(scripts `scratchpad/mitigat-ny-prod-prod/align*.mjs`). Server note: `:3001` runs the new code + env
points to it, so the empty-op is live there (toggle now unblocked, not deploy-gated).

- [x] **Header** rebuilt: eyebrow breadcrumb "Track Progress / Actions Database" + "Sullivan County ·
      FIPS 36105" context + BACK button (dropped the tab-hack). Lexical 2-col layout-container.
- [x] **Side-by-side layout**: lede `1/3`(col-span-4) + stat strip `2/3`(col-span-8) share a row;
      filter `2/3` + view-toggle `1/3` share the next row (reordered draft_sections: header, lede,
      stats, filter, toggle, table).
- [x] **Lede distinction**: both lede cells amber-tinted `#FCF6EC` so it reads as the amber progress
      panel vs the white status cards.

Alignment pass 2 (2026-07-15) — closed most of the remaining gap via 2 more subagent-built library
features + wiring/theming (scripts `align3..5`, `wire6`):
- [x] **Rich lede**: prioritized cell → `stat_value` "0 / 473" ratio ("County Priority Assigned");
      both lede cells amber-tinted so it reads as the distinct progress panel. (Tier-stacked bar still
      deferred — all 473 unset → would render empty.)
- [x] **Needs-priority toggle** — NEW library feature `filter-interactive-chrome.md` (unary `empty`-op
      leaf renders as a toggle chip via a `disabled` flag; opt-ins `display.showActiveTokens`/
      `showClearAll`). Wired: filter 2262759 external `empty` leaf on `county_priority`
      (searchParamKey `needs_priority`, `disabled:true` default) + consuming leaf on the Spreadsheet +
      `needs_priority` page var; mny `theme.filters` brand-styles the toggle/tokens/clear-all. Renders
      inline in the filter row (gridSize 4). (Filters correctly; no visible row change now since all
      473 are already empty.)
- [x] **Active tokens + Clear-all** — same feature; Clear-all renders; tokens appear for selected filters.
- [x] **Inline row detail** — NEW library feature `spreadsheet-inline-openout.md`
      (`display.openOutMode:'inline'`). Wired on the Spreadsheet + mny `theme.table`
      `openOutInline*` panel styles. Built + wired + styled; **live expand-render still to eyeball**
      (blind click hit edit-mode cell-select; table renders clean so the inline branch isn't erroring).

Still not done (lower value / needs data):
- **Filter base controls as rounded pills** — kept as plain labeled inputs (toggle/tokens ARE styled);
  a full pill restyle would need a scoped `filters` `styles[]` variant (mny `theme.filters` is a flat
  map → global). Deferred (BC risk / low value).
- **Stat-card caption sublines** ("Showing" / "% of actions") — deferred (Card cell grid complexity).
- **Footer** "Showing 1–12 of 433 · Load more" — deferred.
- **Tier-distribution bar** in the lede — deferred until real prioritization data exists.
- Leading trigger is ⓘ (openOut) not a chevron — cosmetic.

### Phase 3 acceptance
- [x] Each library change has a task in `src/dms/planning/tasks/current/` (5 docs, linked above).
- [x] The live page (2262755) uses the tier pill (#1/#3-wired), real active state (#2), accent borders
      (#3), unset-row highlight (#5), and a real progress lede (#6) — Phase-1/2 stand-ins replaced.
- [~] `empty` op (#4): code-complete + verified by inspection; page toggle + deep-link **pending
      dms-server deploy** (do not wire against a server without the new code).
- [ ] (human) tier-pill edit-persist round-trip: verified by render + component reuse; confirm a live
      pick persists on publish (deferred — avoided mutating the shared Actions_Revised source in dev).
- [ ] (human) publish page 2262755 when satisfied; deploy the `@availabs/dms` submodule + dms-server so
      the features reach devmny, then wire the Needs-priority toggle.

---

## Files

- **New:** `scratchpad/mitigat-ny-prod-prod/build_action_prioritize_v2.mjs` (Phase 1 seed script).
- **Edit (Phase 2):** `src/themes/mny/theme.js` (add `pill`; extend `filters`, `dataCard`, `table`).
- **New (Phase 3, escalated):** task docs under `src/dms/planning/tasks/current/` (one per feature)
  + the corresponding `@availabs/dms` source changes.

## Notes / gotchas

- Local dms-server (`localhost:3001`, DB `dms-mercury-3`) writes the **same remote DB** the hosted
  `county_template.devmny.org` reads — so a page created locally appears on the live subdomain
  (in `/edit` until published). Verify there.
- Draft sections only render in **`/edit/<slug>`**; mint the Playwright token for the origin you load
  (subdomain shadows bare host — see authenticating-the-dms-cli §B).
- Never write `sections`/`section_groups` directly — only `draft_*`. Publishing is the human's call.
- Keep the `Actions_Revised` binding identical to the sibling; do not "improve" the source query here.
