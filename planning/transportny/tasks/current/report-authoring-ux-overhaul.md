# Report Authoring UX Overhaul

**Project:** TransportNY · **Topic:** themes · **Status:** Tier 1 (1A/1B/1C) + Tier 2 (2A/2B/2C/2D) all DONE — code-complete and live-verified by Ryan 2026-08-19; `probe_corpus.mjs` deliberately not run this pass (Ryan's call); Tier 3 NOT STARTED; Tier 4A DONE + live-verified 2026-08-19 (settings disclosure + always-live debounced date editing), 4B/4C documented only (4B a corrected hypothesis folding into Item 9, 4C explicitly lower priority); Tier 5A (QuickControls Width + Reorder pills) DONE + live-verified 2026-08-20; 5B DONE (implemented as `composeAutoTitle`/`isTitleDirty`, no new field, per Ryan's explicit call — not yet live-clicked-through); 5C (Map creation UI) DONE + live-verified 2026-08-20 — plain-geometry-only scope (Ryan's call), self-binding wiring extracted as a shared helper, starter layer ported from the Python converter's proven route_map_none shape; choropleth-by-measure deliberately deferred, not started; 5D (Table multi-measure) DONE + live-verified 2026-08-20; 5E (difference-mode visibility policy) DONE + live-verified 2026-08-20 ("show but disable"); 5F (2nd round of live feedback: tag-browser order, table precision, Summary wording, spacing, and a real join/no-join duality bug in the Table+Summary path) DONE + live-verified 2026-08-20; 5G (a THIRD bug in the same family — inner-SQL-alias collisions between speed/speedTruck and the 4 CO2 variants, confirming 5D's own "unconfirmed" flag — plus a corrected stale `vocabulary.json` provenance note) DONE + live-verified 2026-08-20, including confirming Add Graph and QuickControls compose through the identical shared function (no divergence) after Ryan suspected one; `traversing-report-pages.md` and `MeasurePicker/README.md` both updated same session with this tier's durable facts; gap #16/facet 2 NOT YET TRIAGED · **Started:** 2026-08-19

## Objective

Kicked off 2026-08-19 after Ryan met with a co-worker and reversed this arc's priorities from the
prior one's "capabilities even with zero UI path is OK" to **clean/easy report-authoring UI is
priority #1**, even if that means only a subset of known capabilities is reflected in it.

Two facets:

1. **Deliberately break DMS's normal view/edit-mode conventions** for `ReportRouteList` (RRL) and
   its section-header "pill" controls (QuickControls), in service of authoring ease. This is
   explicitly sanctioned direction for this arc, not an anti-pattern to flag.
2. **Clean/easy representation of the different report/section types and combinations.** Confirmed
   2026-08-19 to include gap #16 (Info Box/Route Compare have zero creation UI), not just item 1's
   routeComp×filter combination problem.

**Constraint, both facets**: avoid changes to the `@availabs/dms` submodule (`src/dms/`) if at all
possible. If a change there is genuinely required, it must be generic/project-agnostic — never
NPMRDS-specific logic inside `dms`.

This file is the hub doc for the whole initiative — one file, multiple items, per the
`report-route-ui-parity-gaps.md` precedent, rather than forcing every item into a separate task file.

## Decisions locked 2026-08-19 (don't re-litigate these without a new explicit ask)

- **Item 9 (extend Publish/Discard to RRL's own changes): deferred entirely.** No wiring approach
  chosen. Revisit only after Tiers 1-3 below have shipped.
- **Item 3's Remove Route control: no safety net.** Ryan explicitly chose zero added friction (no
  confirm dialog, no undo toast) over guarding the one control that becomes more easily reachable
  once the extra RRL-edit-mode click is removed — ship it exactly as frictionless as every other RRL
  control. This reflects the arc's general bias: don't propose confirm/undo affordances by default
  just because a change makes something faster/more exposed than before; only raise it if an action
  becomes *newly irreversible* in a way it wasn't before.
- **Facet 2 includes gap #16**, not just item 1.
- **Co-worker's `page.metadata` claim, checked**: grepped `page.format.js` directly for the literal
  string `metadata` — zero hits anywhere in the file. No generic metadata bucket exists there today.
  Whatever the co-worker meant (maybe a *source's* metadata, a different row kind entirely — Map/DAMA
  components do read `sources/byId/<id>/metadata`), it isn't a declared page attribute. Relevant only
  to item 9's eventual schema design, not otherwise actionable.

## Cross-references

- [`src/dms/skills/traversing-dms-pages.md`](../../../src/dms/skills/traversing-dms-pages.md) — §2
  updated 2026-08-19 with the durable, generic version of item 4's core finding (a section mounted
  under `SectionView` already has a working persistence channel, `actions.updateAttribute`, distinct
  from the `dwAPI.setState` channel that only works under `SectionEdit`). Read that section for the
  fully-cited version of the mechanism summarized under Item 4 below.
- [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md) — gaps #15, #16, #17, #18 all
  cross-referenced below; this file's item 1 = that file's gap #18, this file's gap #16 = that file's
  gap #16.
- [`report-page-template-editorial-slots.md`](./report-page-template-editorial-slots.md) — the
  still-open, still-unconfirmed "Card resets to `defaultState` on new pages" mystery, referenced
  under Item 5 below.
- [`compact-sidenav-margin-bug.md`](../tasks/completed/compact-sidenav-margin-bug.md) — the prior
  (2026-08-07) sidebar-style fix, scoped to 16 already-published pages only, never the template.
- `src/themes/transportny/components/ReportRouteList/README.md` — needs its "Edit-mode gating"
  section corrected (still narrates a dead orphan-cleanup effect in the present tense); bundle with
  Item 3's implementation.

---

## Tier 1 — do first (cheapest, highest-leverage, mostly one file each)

### 1A. `newPage()` core patch — unlocks Item 5's persistence half + Item 6's redirect — DONE, live-verified 2026-08-19

**File:** `src/dms/packages/dms/src/patterns/page/pages/edit/editFunctions.jsx`

**Current state**: `newPage()` (~lines 57-94) copies exactly four fields from a template —
`draft_sections` (cloneDeep + fresh `trackingId`), `draft_section_groups`, `sidebar`,
`sidebarHideInView`. It never copies `template.theme` (where compact-sidenav config lives — see Item
5). It computes `newItem.url_slug` one line before calling `apiUpdate({data:newItem})` (~line 93) with
**no `newPath`** — even though its own sibling function in the same file, `updateTitle()` (~line
107), demonstrates the correct pattern one function down: `apiUpdate({data:newItem, newPath:
`/edit/${newItem.url_slug}`})`.

`newPath` is the already-sanctioned, already-used redirect mechanism — `EditWrapper`
(`src/dms/packages/dms/src/dms-manager/wrapper.jsx:18`, `useNavigate()`) does, at lines ~95-96: `if
(newPath && newPath !== currentPath) navigate(newPath)`. Every other create/rename flow already
relies on this (`draggableNav.jsx:286`, `pagesPane.jsx:267`, `patterns/page/pages/_utils/index.js:192,235`)
— `newPage()` is the one outlier missing it.

**Proposed change** (both in the same function, same file):
1. Add `if (template.theme !== undefined) newItem.theme = template.theme;` to the template-copy block.
2. Add `newPath: `/edit/${newItem.url_slug}`` to the `apiUpdate({data:newItem, ...})` call.

**Why safe**: `newPage()`'s only current caller (`AddPageButton`/`PageTemplatePicker` in
`pagesPane.jsx`) ignores its return value entirely today — nothing downstream can regress. Both
changes are generic (fix template inheritance + no-redirect for ANY pattern/site using page
templates, not NPMRDS-specific) — squarely within the "if we must touch `dms`, keep it
project-agnostic" rule.

**Classification**: small, justified `dms`-core change.

- [x] Add `theme` to `newPage()`'s template-copy block — 2026-08-19
- [x] Add `newPath` to `newPage()`'s `apiUpdate` call — 2026-08-19
- [x] Live-verify: create a page from ANY template (not just Report Page) in a scratch pattern, confirm redirect + theme inheritance both work, confirm no regression to existing "+Add Page" flow elsewhere in the site — verified by Ryan 2026-08-19 (via `page_25`, which also surfaced 2C's data-side gap — see 2C)

---

### 1B. Item 3 — RRL: no view mode, unconditional edit-mode functionality — DONE, live-verified 2026-08-19

**File:** `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx`

**Current state**: `canMutate = isEdit && Boolean(sectionEditorOpen)` — `isEdit` here is a local var
(`Boolean(editPageMode)` from `PageContext`), `sectionEditorOpen` is `props.isEdit` (dataWrapper's
per-section `Boolean(onChange)` signal, true only while RRL's own Settings-pencil edit mode is open).
View-mode hiding (`if (!isEdit) return routeSelectionModal`) already matches the ask — unconditional,
keyed on `editPageMode` alone, unrelated to `sectionEditorOpen`. **Nothing to change there.**

**Root-cause history, confirmed via git archaeology (`git show dccf9bd:.../useGraphPublish.js`)**: the
`sectionEditorOpen` requirement was added 2026-08-03 specifically to stop an orphan-cleanup effect
that used to run on every render while `editPageMode` was true (mount included, no user action
required) and would silently strip a route's `graphIds` the moment they referenced a section id
absent from the current `draft_sections`/`sections` array. **That effect no longer exists.** Design
Push #2 (2026-08-06) deleted the whole `routes[].graphIds` mechanism when route→graph assignment
moved to QuickControls' own `_measurePick.routeIds` (see Item 4). Current
`useGraphPublish({item, isEdit, routes, pageState, setActionParam, clearActionParam})` doesn't even
receive `apiUpdate`/`persistRoutes`/`reportRow` as arguments anymore — its only two effects
(`useGraphPublish.js:216`, `:264`) call `setActionParam`/`clearActionParam` only (ephemeral
`pageState`, never a write). Every remaining `persistRoutes`/`apiUpdate` call anywhere in the
component (`useReportRow.js:233,291,306,329,351,379`; `useAddGraphSection.js:85`;
`ReportRouteList.jsx:226`) fires only from an explicit `onClick`/modal-confirm handler — never from a
`useEffect`. **Removing `sectionEditorOpen` from `canMutate` today does not reintroduce the bug it was
built for.**

**Proposed change**: remove `&& Boolean(sectionEditorOpen)` from `canMutate`'s definition. One line.

**Per-control risk, for the record (no safety net will be added per the locked decision above, but
worth knowing what's now reachable with one fewer click)**:

| Control | Risk if always-on |
|---|---|
| Add Route / Add Route Slot | Low |
| Add Graph | Moderate — creates a real section row, same blast radius as core "+Add Component" |
| Dynamic Report toggle | Moderate — rewrites `item.filters`, reversible |
| Copy/paste date-span | Low |
| Reorder up/down | Low |
| Rename | Low — needs explicit typed Save |
| **Remove route** | **Highest — one click, no confirm, permanent delete of the route + its date config. No safety net per Ryan's decision.** |
| Date edit | Moderate — requires explicit Save |
| Color picker | Low |
| "Base for N routes" disclosure | Not a mutation (local `useState` toggle) |
| Graph-assignment chips | **Don't exist anymore** — Design Push #2 removed them; assignment now lives on QuickControls' own "Routes" pill (Item 4), independently gated |

**Doc cleanup, bundle with this fix**: `ReportRouteList/README.md`'s "Edit-mode gating" section
(~lines 102-139) and `useReportRow.js`'s comments (lines 75,78,80,84,136-139,226-228) still narrate
the dead orphan-cleanup effect in the present tense, one even claiming it "funnel[s] through"
`persistRoutes` — correct both while touching this file.

**Classification**: 100% project-level, zero `dms` touch.

- [x] Remove `sectionEditorOpen` from RRL's `canMutate` — 2026-08-19, `canMutate = isEdit` now (component no longer destructures the `isEdit` prop at all)
- [x] Correct `README.md`'s orphan-cleanup narration — 2026-08-19, "Edit-mode gating" section rewritten past-tense
- [x] Correct `useReportRow.js`'s stale comments — 2026-08-19, all 3 flagged blocks (`reportRow` derivation, `loadReportRow`, `persistRoutes`) updated
- [x] Live-verify on a scratch report page: every control in the table above now works immediately on `/edit/<slug>` with zero RRL-pencil click; confirm removing a route still only requires one click (expected, per decision above) — verified by Ryan 2026-08-19
- [x] Run `probe_corpus.mjs` full suite after, per `regression-testing-npmrds-reports.md` — **deliberately skipped, Ryan's explicit call both times asked** (first: "I don't want to chase things down right now, make a list of what might break" — see regression-risk analysis in Progress log; second, after live-verifying everything himself: "don't worry about probe corpus"). Not run this pass; pick up next time this file needs a full regression sweep.

---

### 1C. Item 4 — Section-header pills: live whenever the PAGE is in edit mode — DONE, live-verified 2026-08-19

**Files:** `src/themes/transportny/components/QuickControls/index.jsx` ONLY.

Ryan called this the biggest functionality gap in the whole arc. Fully triaged 2026-08-19 via direct
code reading (not just agent summaries) — corrects an earlier, more pessimistic take from this same
research pass (which wrongly assumed a small `dms`-core change was needed). **It is not.**

**Current mechanism, precisely traced**:

- `npmrdsQuickControls({state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections,
  pageState})` (`QuickControls/index.jsx:35`) early-returns `null` unless `isEdit && canEditSection &&
  currentComponent?.useDataSource && isSelfBound && isReportPage(siblingSections)` (line 51).
- `isEdit` here is `section.jsx`'s hardcoded per-branch value — `SectionEdit` sets `const isEdit =
  true` (section.jsx:92), `SectionView` sets `const isEdit = false` (section.jsx:380), **always**,
  regardless of `editPageMode`. So today `QuickControlsRow` never mounts under `SectionView` at all —
  only while this ONE section's own pencil is clicked.
- `QuickControlsRow` (line 74) writes via `applyPick = (partial) => applyMeasurePick({state, dwAPI,
  currentComponent}, partial)` (line 109) → `MeasurePicker/index.js`'s `applyMeasurePick` (line 225)
  → `dwAPI.setState(draft => { applyMeasurePickToState(draft, nextPick, {...}) })`.
- `dwAPI.setState` under `SectionView` only ever mutates in-memory state — `dataWrapper/index.jsx`'s
  `View` variant hardcodes its OWN internal `isEdit = false` (line 464), and its Save-effect (the
  file's only `onChange(serialized)` call, ~lines 296-321) is gated `if (!isEdit) return` — **dead
  code in `View`, regardless of what real `onChange` prop was passed in from above.** So even with
  visibility fixed, a pill click under `SectionView` would look instant and then never persist via
  this specific channel.
- **The actual fix**: `section.jsx`'s `SectionView` already threads a SEPARATE, working persistence
  channel into the exact ctx object `npmrdsQuickControls` receives — it's just not consumed today.
  The ctx object (section.jsx:481-491) includes `actions: {onEdit, moveItem, updateAttribute,
  updateElementType, onChange, setState: dwHandle?.setState, setShowDeleteModal}` and `sectionState:
  {isEdit, value, attributes, i, showDeleteModal, state: stateFromRef}`. `updateAttribute(k,v)`
  (section.jsx:398-403) calls `onChange?.(i, newV)` → `SectionView`'s own `onChange` prop, which
  `sectionArray.jsx` wires as `onChange={saveIndex}` (sectionArray.jsx:403) for **every** section,
  pencil-clicked or not. `saveIndex(i,v)` (sectionArray.jsx:204-208) writes into that section-group
  band's local immer `values` array; a 300ms-debounced effect (sectionArray.jsx:186-193) calls the
  OUTER `onChange(values)` if it changed — the same call `moveItem` (sectionArray.jsx:270) uses
  (undebounced) for drag-reorder, which demonstrably already persists today with zero pencil-click.
  This proves the whole chain terminates in a real `apiUpdate` to `draft_sections`.

**Concrete implementation plan** (all in `QuickControls/index.jsx`):

1. **Visibility**: drop `isEdit` from `npmrdsQuickControls`'s early-return condition (line 51) — keep
   `canEditSection && currentComponent?.useDataSource && isSelfBound &&
   isReportPage(siblingSections)`. Inside `QuickControlsRow` itself (a real mounted component, hooks
   allowed unlike the outer plain function), add `const { editPageMode } = useContext(PageContext)`
   (import `PageContext` via the same relative-path pattern `ReportRouteList.jsx`/
   `ReportPageHeader.jsx` already use) and `if (!editPageMode) return null;` as its first line.
   **Why `canEditSection` alone isn't enough**: a logged-in author casually browsing the real
   published site (not `/edit/...`) still passes `canEditSection` — `editPageMode` is the only signal
   that actually means "this is edit mode."
2. **Interactivity/persistence**: have `npmrdsQuickControls` also destructure `actions` and
   `sectionState` (for `.value`) from its params and pass them into `QuickControlsRow`. Change
   `applyPick` to compute `nextState` via the same `applyMeasurePickToState` pure function — called
   against a plain `cloneDeep(state)` rather than an immer draft (its own doc comment,
   `MeasurePicker/index.js:90-91`, explicitly says plain-mutation syntax works against either) —
   then call `actions.updateAttribute('element', { ...value.element, 'element-data':
   JSON.stringify(nextState) })`. Decide during implementation whether to ALSO call `dwAPI.setState`
   for instant visual feedback (harmless when mounted under `SectionEdit`, a no-op-for-persistence
   nicety under `SectionView`) or rely solely on the re-render that follows once `draft_sections`
   round-trips back down as a fresh `value` prop.
3. Two honest, non-blocking footnotes: (a) the 300ms debounce means a pill click isn't durable for
   that window — pre-existing property of this channel, already true of reorder/Layout changes
   today, not new risk. (b) A theoretical cross-band stale-overwrite race (e.g. a main-band graph
   pill and RRL's sidebar band both writing within the same debounce window) is also pre-existing to
   the architecture — RRL doesn't use this channel at all (separate `reports_snap_2` row), so it
   doesn't interact with this specific risk.
4. `CalloutStatPicker` (Card's hero-stat picker) has **no header pill at all yet** — it's
   Settings-drawer-menu-only (`sectionMenuExtensions["Card"]`, not `sectionHeaderExtensions`). Out of
   scope for this fix; a Callout Stat pill would be net-new UI, not a gating fix.
5. **One fix reaches four component types at once**: `npmrdsQuickControls` is registered under
   `sectionHeaderExtensions` for `"Graph"`, `"AVL Graph"`, `"Spreadsheet"`, and `"Map"` simultaneously
   (`themev2.js:2739-2744`) — Bar/Line/Grid graphs, Spreadsheet, and Map all get this fix from one
   change. **Caveat**: `theme.js` (the v1 theme, still selectable per `src/themes/index.js:4-5`) only
   registers it for 2 of the 4 names (`theme.js:29-30`) — update that block too if any live site
   still runs on `theme.js` rather than `themev2.js`.

**Classification**: 100% project-level, zero `dms`-core touch.

- [x] Drop `isEdit` from `npmrdsQuickControls`'s gate; add `editPageMode` check inside `QuickControlsRow` — 2026-08-19
- [x] Thread `actions`/`sectionState.value` through; switch `applyPick` to `actions.updateAttribute` — 2026-08-19
- [x] Decide instant-feedback approach — 2026-08-19, went with BOTH: `applyPick` now runs the shared `applyMeasurePick` twice — once against a `cloneDeep(state)` + a `dwAPI`-shaped shim (`{setState: fn => fn(nextState)}`) to compute the full next-state for `actions.updateAttribute`, once against the real `dwAPI` (when present, i.e. under `SectionEdit`) for instant visual feedback. Deliberately reuses `applyMeasurePick` itself rather than re-deriving its Map-vs-AVL-Graph/reconcile logic inline, to avoid reintroducing the exact MeasurePicker/QuickControls drift risk the shared function exists to prevent.
- [x] Live-verify on a scratch report page: change Measure/Resolution/When/Aggregate/Mode pills on a graph WITHOUT clicking that section's own pencil, confirm the chart updates AND the change survives a reload — verified by Ryan 2026-08-19
- [x] Confirm a real end-user viewing the published (non-`/edit/`) page never sees pills, and a logged-in author browsing the real published site (not `/edit/...`) also never sees them — verified by Ryan 2026-08-19
- [x] Update `theme.js`'s registration too — 2026-08-19, added `"Spreadsheet"`/`"Map"` to its `sectionHeaderExtensions` map for parity with `themev2.js` (didn't confirm which theme any live/dev site actually selects — applied defensively since it's a strict no-op if unused)
- [x] Run `probe_corpus.mjs` full suite after — **deliberately skipped, Ryan's explicit call** (see 1B's identical note above); not run this pass

---

## Tier 2 — small, mostly self-contained

### 2A. Item 8 — Report Header "Done" also publishes — DONE, live-verified 2026-08-19

**File**: `src/themes/transportny/components/ReportPageHeader.jsx`

**Current state**: the Edit/Done toggle handler (~lines 147-151) is `onClick={() =>
navigate(editPageMode ? publicPath : editPath)}` — only navigates, never calls
publish/discardChanges/apiUpdate. `publish(user, item, apiUpdate)` (`editFunctions.jsx:144-182`)
needs only fields already on `item` (`.id`, `.history`, `.draft_sections`, `.draft_section_groups`,
`.draft_dataSources`) plus `user` and `apiUpdate`. `ReportPageHeader.jsx` already destructures `item`
from `PageContext` (line 16) — just needs to also pull `apiUpdate` from that same context, add
`useContext(CMSContext)` for `user` (same `context.js` file it already imports `PageContext` from),
import `publish`, and change the Done handler to `await publish(user, item, apiUpdate)` before
navigating — only when `editPageMode` is true (the click that LEAVES edit mode).

**Classification**: 100% project-level, trivial, self-contained, no new plumbing.

**Note**: file actually lives at `src/themes/transportny/components/ReportPageHeader/ReportPageHeader.jsx`
(nested folder, not a bare file directly under `components/`) — this section's own file path was
slightly stale.

- [x] Wire Done → publish in `ReportPageHeader.jsx` — 2026-08-19, added `CMSContext`/`user`, imported `publish`, new `handleEditToggle` awaits `publish(user, item, apiUpdate)` before navigating, only when leaving edit mode
- [x] Live-verify: make a draft change, click Done, confirm the published page reflects it immediately (no separate manual Publish click needed) — verified by Ryan 2026-08-19

---

### 2B. Item 6 — "Create Report" button on the `/reports` homepage — DONE, live-verified + published by Ryan 2026-08-19

**Depends on 1A landing first** (for the redirect to work).

**Current state**: `/reports` (`converted_reports/reports`, page id `2208581`) is DB content — Card
sections bound to `reports_snap_2` — not a bespoke React page. A new button must be added as a
registered page-section component, same pattern as `ReportPageHeader` itself
(`theme.pageComponents`, `themev2.js:2696-2703`).

**Proposed change**: a small new NPMRDS component that calls `newPage(item, dataItems, user,
apiUpdate, template)` (`editFunctions.jsx:57-94`) directly with the Report Page template (id
`2187021`) pre-selected, skipping `PageTemplatePicker`'s generic picker UI entirely. Once 1A lands,
navigation falls out for free via `newPath` → `EditWrapper`'s `useNavigate` (`wrapper.jsx:95-96`).

**Recommend** one named constant for template id + target parent slug, mirroring the existing
precedent `scripts/npmrds-reports/report_build.mjs:66`'s `const DEFAULT_PARENT_SLUG =
'converted_reports'` — so relocating away from `converted_reports/` later (already anticipated) is a
one-line change.

No existing design-system wireframe found for this button's placement/copy (checked
`dms_design_system_v2`) — design pragmatically, not chasing pixel fidelity per this arc's stated
priority.

**Classification**: project-level, depends on 1A.

**Built 2026-08-19**: new page-section component `src/themes/transportny/components/CreateReportButton/`
(`CreateReportButton.jsx` + `.theme.js` + `index.jsx`, registered in `themev2.js`'s `pageComponents`
map alongside `ReportPageHeader`/`RouteComparison`). Fetches the Report Page template row the exact
same way `PageTemplatePicker.jsx`'s own `loadDbTemplates()` does (same `apiLoad` shape), filtered to
`REPORT_PAGE_TEMPLATE_ID = '2187021'`, then calls `newPage(item, dataItems, user, apiUpdate,
template)` directly — no picker UI. Parent folder is NOT a separate named constant: `newPage()`
derives it from `item.parent`, and since this button is registered on the `/reports` page itself
(whose own parent already is `converted_reports`), that falls out for free — simpler than adding a
second constant that would just have to agree with wherever the button is actually placed.

**Also added to the live page's content 2026-08-19** (a data change, via `dms section create 2208581
--pattern npmrds_sub --data ...` — backed up pre-change state to
`scratchpad/npmrds-sub/page_2208581_reports_homepage.pre-create-report-button.20260819.json` first):
one new section, id `2213719`, `element-type: "CreateReportButton"`, appended to the end of the
existing "Templates" group (`b77dbc82-...`). **Currently a DRAFT addition only** — `has_changes:
true`, `published: ''` unchanged — visible at `/edit/converted_reports/reports` but NOT yet on the
real published `/converted_reports/reports` page. Left unpublished deliberately (didn't want to
flip a live, possibly-viewed page to a new visible state without Ryan reviewing placement/copy
first) — publish via the page's own Done/Publish control (now wired, see 2A) or `dms page publish
converted_reports/reports --pattern npmrds_sub` once reviewed. Placement (end of the existing card
group, not a separate prominent slot) was a pragmatic default per this item's own "no wireframe,
design pragmatically" note — reorder via drag-and-drop in the edit UI if a different spot is wanted.

**Mid-task correction, 2026-08-19**: first `dms section create` call omitted `--pattern npmrds_sub`
and the CLI's pattern auto-detection (`findPatternByKind(..., 'page')`, no explicit flag) resolved
to a leftover "Sandbox" pattern in this dev DB instead, creating the section as `sandbox|component`
(wrong type — would have rendered as broken/missing) and attaching that wrongly-typed ref to the
page. Caught immediately via `dms raw get`, deleted the bad row + ref (`dms section delete 2213718
--page 2208581 --pattern npmrds_sub`, needed a freshly-minted auth token), and recreated correctly
with `--pattern npmrds_sub` explicit. **Generic CLI gotcha worth remembering for next time**: `dms
section create`/`update`/`delete` without an explicit `--pattern` silently picks WHATEVER page-kind
pattern `findPatternByKind` finds first for the site/app — always pass `--pattern` explicitly on
any multi-pattern site (this dev DB has 19+ patterns registered).

- [x] Confirm 1A has landed — confirmed via direct code read, session start
- [x] Build the Create Report button/component, registered on the `/reports` page
- [x] Named constant for template id — `REPORT_PAGE_TEMPLATE_ID` in `CreateReportButton.jsx`; no separate parent-slug constant needed (see above)
- [x] Placement + publish — Ryan moved the section to the top of the page (reordered via the edit UI himself, exactly the "author decides placement" flow this item's own note anticipated) and published `/reports` himself, 2026-08-19
- [x] Live-verify: click Create Report, confirm redirect into `/edit/<new-slug>` with the Report Page template's sections present — verified by Ryan 2026-08-19

---

### 2C. Item 5 — Report Page Template: remove starter graph + fix compact sidebar — DONE 2026-08-19

**Starter graph removal**: template `2187021`'s section 3, "Existing AVL Graph" (`graph_new`/
`compType:'avlGraph'`, title already cleared to `""`). **Confirmed safe to delete** — nothing depends
on it: `findSelfBoundGraphs` (`ReportRouteList/useGraphPublish.js:154-192`) discovers self-bound
sections by scanning for the subscriber, count-agnostic (zero matches → empty `graphs` array, line
207); `CalloutStatPicker`'s `isReportPage` gate (`MeasurePicker/index.js:82-84`) only checks for an
RRL sibling, not an AVL Graph sibling; the header lexical's copy has no textual dependency on a graph
existing below it. After removal: header lexical → Hero-stat Card (ships unconfigured) →
ReportRouteList sidebar. Structurally sound.

**Compact sidebar**: root cause is 1A's `newPage()` gap (never copies `template.theme`) — **plus** the
template row itself apparently never had the compact override actually set. The 2026-08-07 fix
(`compact-sidenav-margin-bug.md`) applied `theme.layout.options.sideNav.activeStyle=1` directly to 16
already-published pages via `dms raw update`, never to template `2187021`. So after 1A's code fix
lands, **also** set this override on the template row itself (a data change, e.g. `dms page update
2187021 --set theme='{"layout":{"options":{"sideNav":{"activeStyle":1}}}}'` or equivalent raw
update).

**Directly ruled out** (traced all 3 of RRL's `apiUpdate` call sites): RRL is **not** overwriting
`theme` — `useAddGraphSection.js:85` sends `{id,draft_sections,has_changes}`;
`ReportRouteList.jsx:226` sends `{id,filters}`; `useReportRow.js:229-233` writes to the entirely
separate `reports_snap_2` row. None mention `theme`, and `updateDMSAttrs.js`'s whole model is
per-attribute partial-patch, not whole-row replace — this rules out Ryan's own "RRL might be
overwriting it" theory as a direct mechanism.

**Separate, still-unconfirmed finding** (not blocking either ask above — flagged for whoever next
needs the template to carry pre-configured Card content, e.g. if the Hero-stat Card ever needs to
ship pre-wired again): a plausible root cause exists for "a Card section resets to the registry's
empty `defaultState` on pages newly created from a template" (the still-open mystery in
`report-page-template-editorial-slots.md`) — `dataWrapper/migrateToV2.js`'s all-or-nothing v2-check
(~line 215: pass-through only `if (state.externalSource)` is truthy; ~lines 224-226: otherwise
`migrated = defaultState || state`, **wiping** rather than merging). Needs a live repro (create a page
from the template, immediately `dms raw get` the new Card row, check whether its stored `element-data`
actually lacked `externalSource`) to fully close out — not done this pass, no live DB access during
the research agent's run.

**Classification**: starter-graph deletion = trivial content edit, zero code/capability question.
Compact sidebar = depends on 1A's code fix + a one-time data fix on the template row.

**How this actually got done, 2026-08-19**: found live by Ryan, not planned proactively — he created
a page from the template (`converted_reports/page_25`, row `2213716`) via 1A's newly-fixed
`newPage()` and the sidebar was still not compact. Investigated via `dms raw get 2187021`
directly: confirmed **no code was touched here, only the DB row** — the template row had no
`theme` key at all (verified by reading the raw row before touching anything; backed up to
`scratchpad/npmrds-sub/page_template_2187021.pre-remove-starter-graph.20260819.json` first). This
matches exactly what this section already predicted: 1A's code fix is necessary but was not
sufficient on its own, because the thing it copies (`template.theme`) was never actually set on the
template row. Two `dms page update 2187021` calls (verified via direct `dms raw get` before/after
each, title/slug/other fields confirmed untouched):
1. `--set theme='{"layout":{"options":{"sideNav":{"activeStyle":1}}}}'` — the compact override.
2. `--data <patch-file>` with `draft_sections` rebuilt to exclude the "Existing AVL Graph" section
   (`trackingId f1549ff3-6277-416b-a1b2-f5f6a44a7a2d`, the 4th of 5 sections) — template now has 4
   sections (ReportPageHeader → lexical → Card → ReportRouteList sidebar), matching the predicted
   post-removal order exactly.

**Also fixed directly**: `converted_reports/page_25` (`2213716`) itself, since it was already
created before the template fix landed and wouldn't retroactively inherit it — same `theme` override
applied via `dms page update 2213716 --set theme=...`, verified. **Not touched**: page_25's own copy
of the old starter "Existing AVL Graph" section (it has its own independent 5 sections, materialized
at creation time from the pre-fix template) — the reported bug was specifically the sidebar style,
not the starter graph, so didn't unilaterally edit page_25's content beyond the direct ask. Flag to
Ryan if he wants that section removed from page_25 too, or wants to just delete/recreate the page now
that the template is fixed.

- [x] Delete template `2187021`'s "Existing AVL Graph" section — 2026-08-19
- [x] Confirm 1A has landed; set the compact override on template `2187021` itself — 2026-08-19 (1A confirmed landed via code read earlier this session; template row backed up before either data change)
- [x] Live-verify: create a NEW page from the template, confirm (a) no starter graph, (b) sidebar renders compact from the moment the page is created, with no manual per-page fix needed — verified by Ryan 2026-08-19
- [ ] Optional/separate: live-repro the Card-materialization mystery if picked up (not required for this item's two asks)

---

### 2D. Item 7 — Dynamic Report URL params resolve in edit mode too — DONE, live-verified 2026-08-19

**File**: `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` +
`useDynamicReportRoutes.js`.

**Current gate**: `enabled: isDynamicReport && !isEdit && routeIds.length > 0`
(`ReportRouteList.jsx:114-120`) — excludes edit mode "so editing the template itself isn't at the
mercy of whichever route happens to be in the URL."

**Confirmed SAFE to flip**: traced the entire chain — `useDynamicReportRoutes.js`'s one effect
(lines ~48-75) calls `apiLoad`-only `fetchCatalogRows`, storing into local `useState`;
`resolvedRoutes`/`resolvedGroupRoutes` (~lines 94-128) are plain re-derived values. **No `apiUpdate`
anywhere in the file.** Downstream, `effectiveRoutes` (`ReportRouteList.jsx:177`, a local const) feeds
`useRouteMileage` (read-only) and `useGraphPublish`, whose only writes are
`setActionParam`/`clearActionParam` — both pure in-memory `setPageState(draft => {...})` with
`useSearchParams:false`, gone on reload, never `apiUpdate`. **This directly answers Ryan's own flagged
risk** ("might accidentally save URL params into sections") — nothing in this chain persists
anything, today.

**To realize the ask, three related `!isEdit` exclusions must flip together** (flipping only the named
`enabled` gate won't visibly change anything): the `enabled` gate itself (~line 114-120),
`asOfOverride` (~line 148), and `effectiveRoutes`'s own ternary (~line 177, currently always takes the
raw-`routes` branch in edit mode).

`ReportPageHeader.jsx` doesn't read `isDynamicReport`/URL params at all (only consumes the
already-published route catalog via `pageState.filters[ROUTE_CATALOG_PARAM_KEY]`, published
unconditionally) — no changes needed there.

**Classification**: 100% project-level, confirmed safe/purely-additive, moderate size.

**Implementation note, 2026-08-19**: the `effectiveRoutes` ternary was deliberately flipped to
`(isDynamicReport && routeIds.length > 0)`, NOT bare `isDynamicReport` — checked this carefully
before implementing, since `resolvedRoutes` collapses to `[]` whenever the hook's own `enabled` flag
is false (see `useDynamicReportRoutes.js`'s `!enabled ? [] : ...`). Bare `isDynamicReport` would have
made a plain `/edit/<slug>` with no `?routes=` show ZERO routes instead of falling back to the raw
placeholder slots — mirroring the exact same condition as the `enabled` gate is what keeps that case
correct. `asOfOverride` needed no such guard (it's just a raw filter-value read, already `null`
whenever the URL param is absent regardless of edit mode).

- [x] Flip all three `!isEdit` exclusions in `ReportRouteList.jsx` — 2026-08-19
- [x] Live-verify: open a Dynamic Report at `/edit/<slug>?routes=<id>|||<id>&asOf=YYYY-MM-DD`, confirm it previews as if those were live, AND confirm reloading the plain `/edit/<slug>` (no params) still shows raw unresolved slots as before — verified by Ryan 2026-08-19
- [x] Confirm nothing got written to `draft_sections`/`reports_snap_2` from a preview-only edit-mode visit (cross-check via `dms raw get` before/after) — verified by Ryan 2026-08-19

---

## Tier 3 — completeness (ongoing, per Item 2's framing)

### 3A. Item 2's concrete deliverable — gap #15, Title/Description auto-compose

**File**: `src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js`

**Current state**: auto-composes `xAxis.label/format/epochMinutesPerUnit`, `yAxis.label`, the yAxis
column's `customName`, `fetchMode`, `join`, and RRL self-binding wiring on every Graph
Type/Measure/Resolution/Comparison Mode pick — but never `display.title.title` or
`display.description`. Confirmed still open, and confirmed (2026-08-19) that ALL 5 QuickControls
pills + Add Graph already funnel through this ONE shared function — no divergent paths to reconcile,
one fix benefits everything.

**Design problem to resolve before implementing** (per the gap's own writeup): every other composed
field has exactly one correct derived value, so `applyMeasurePick` safely blind-overwrites it on every
re-pick; title text is different, since an author may have deliberately renamed it. Needs either (a)
only default while the title is still empty, or (b) track "is this still the auto-generated title" —
checked, no existing `_isAutoGenerated`/`_pristine`-style field anywhere in this codebase to copy.
**Confirm approach with Ryan before implementing** — this is a real design decision, not a blind
wire-up.

- [ ] Decide (a) vs (b) with Ryan
- [ ] Implement in `composeMeasureConfig.js`
- [ ] Live-verify across at least 2 pill types + Add Graph, confirm an author's manually-set title is never clobbered by a later re-pick

---

## Tier 4 — RRL discoverability + discard-changes gap (found 2026-08-19, post-Tier-2 review)

Ryan's follow-up the same day Tier 1/2 shipped, after using the result himself. Three threads,
investigated directly against the current code (4A: decided via `AskUserQuestion`, then
implemented and live-verified same session; 4B is a correction to a hypothesis; 4C is explicitly
lower priority per Ryan).

### 4A. Dynamic Report toggle too prominent; route-date editing too many clicks deep — DONE, live-verified 2026-08-19

Two opposite-direction discoverability complaints about RRL, both a direct side effect of 1B
removing the `sectionEditorOpen` gate (which used to also gate these, as a side effect, not by
design):

1. **Dynamic Report toggle now begs to be clicked.** `ReportRouteList.jsx:432-437` renders the
   `Switch` unconditionally whenever `canMutate` — i.e., now, any time the page is open at
   `/edit/...` at all — right under Add Route/Add Graph, same visual weight as those. Before 1B,
   reaching it required opening RRL's own pencil edit mode first, an incidental extra click that
   happened to gate it too. 1B's own per-control-risk table already rated this toggle "Moderate"
   risk (rewrites `item.filters`) when scoping the gate removal — this is that exact risk
   surfacing as a UX complaint: a novice now sees an unexplained "Dynamic Report" switch at the top
   of every report's route panel, one click away, with nothing explaining what it does.
2. **Route date editing is comparatively buried.** Contrast with rename: the name-edit pencil sits
   directly in the always-visible row header (`RouteRow.jsx:228`), zero expand needed. Editing a
   route's *dates* — arguably the single most common action on this whole panel — requires
   clicking "+" to expand the row (`onToggleExpand`) THEN clicking the "Edit dates" pencil
   (`onStartEditDates`, inside the now-expanded block, `RouteRow.jsx:241-296`) before the date form
   even opens. The resolved range is always visible read-only in the row's meta line
   (`metaText`, ~line 143-150) — only *editing* is gated behind the extra expand click.

Two independent fixes, not one — both needed a design call before implementing, so this was posed
to Ryan via `AskUserQuestion` rather than guessed:

- **(a) toggle placement — Ryan picked "move to a settings disclosure."** Implemented in
  `ReportRouteList.jsx`: the old unconditional `dynamicToggleWrapper` block is now a collapsed-by-
  default "Report settings" disclosure (new `isSettingsOpen` state, gear icon + chevron), with the
  `Switch` plus a one-line hint ("Routes are picked by whoever opens the report (via a link),
  instead of being fixed here — use this for a reusable report template.") inside it. New theme
  keys in `ReportRouteList.theme.js`: `settingsDisclosureWrapper/Toggle/Icon/Label/Chevron/Body/Hint`.
- **(b) date editing — Ryan picked "auto-expand new routes; remove the pencil/Save entirely,
  debounce however's needed."** This was the bigger change, entirely inside `RouteRow.jsx` +
  `ReportRouteList.jsx`:
  - `ReportRouteList.jsx`'s `handleAddRouteSlot`/`handleConfirmAddRoutes` now auto-expand the
    newly-added route(s) (`setExpandedRoutes` keyed on the append-order index `addRoutes` always
    uses) — the next natural action after adding a route is setting its dates, so it opens already
    there instead of costing a 3rd click.
  - `RouteRow.jsx` deleted the pencil/Save/Cancel gate entirely (`isEditingDates` and the whole
    parent-owned single-flight edit buffer are gone). Date fields (Fixed: From/To; Derived: Derive
    From/Pattern/etc.) are now always live whenever the row is expanded, each row owning its OWN
    local buffer (`dateMode`/`localStart`/`localEnd`/`deriveFrom`/`deriveFormula`) since several
    rows can be mid-edit simultaneously now (previously only one row could be, since the buffer was
    parent-owned single-flight). Edits auto-save through one `onUpdateDates(updates)` callback
    (`ReportRouteList.jsx` wraps it around `updateRoute`):
    - Typed fields (date inputs, the "How many"/day-of-month/Advanced-formula inputs) debounce
      400ms and MERGE pending fields (not replace) before flushing, so two fields changed in the
      same window (e.g. "From" then "To", or `shiftYear`'s simultaneous both-fields change) land in
      ONE `updateRoute` call instead of two racing writes each built off a stale `routes` snapshot
      — the second would otherwise silently drop the first field's change.
    - Discrete picks (the Derive-From select, "Use fixed dates instead", "Derive from another route
      instead" when re-entering with an already-valid prior pick) flush immediately, no debounce.
    - `lastFlushedRef` distinguishes an external change to this route (a sibling recomputing this
      derived row, a clipboard paste, another session's edit landing) from an echo of this row's
      own just-sent write — only the former resyncs the local buffer.
    - Derived mode's atomicity requirement (`dateFormula`+`derivedFromRoute` must persist together,
      matching `relativeDateResolution.js`'s own resolve-only-when-both-present rule) is preserved:
      every flush in Derived mode sends both fields together, never one alone.

**Live-verified 2026-08-19** on a scratch page created via the Create Report button
(`converted_reports/page_27`, id `2213752` — left as an unpublished draft, not deleted; deleting it
was blocked by the auto-mode classifier as a destructive action, flagged to Ryan to delete himself
if wanted): confirmed via Playwright/claude-in-chrome — Report Settings disclosure opens/closes and
shows the hint copy; adding one route auto-expands it with live Fixed-mode date fields (no pencil);
adding two routes at once auto-expands both independently while leaving a third, previously-
expanded row's state untouched; typing dates on two different rows in the same debounce window
persisted both correctly with zero cross-row bleed; the `shiftYear` (+1/−1 year) buttons' combined
two-field write persisted atomically; switching to Derived mode (picked "Today (view time)"),
seeing the live "Resolves to ..." preview, and switching back to "Use fixed dates instead" all
flushed immediately and survived a full page reload; zero console errors throughout the whole
session (`read_console_messages`, `onlyErrors:true`, checked at three separate points).

- [x] Toggle placement: `AskUserQuestion` → Ryan picked "settings disclosure" — 2026-08-19
- [x] Date editing: `AskUserQuestion` → Ryan picked "auto-expand + remove pencil/Save, debounce as needed" — 2026-08-19
- [x] Implement both in `ReportRouteList.jsx`/`RouteRow.jsx`/`ReportRouteList.theme.js` — 2026-08-19
- [x] Live-verify via claude-in-chrome on a scratch page (see above) — 2026-08-19
- [ ] Optional cleanup: delete scratch page `converted_reports/page_27` (id `2213752`) — left for Ryan, CLI delete was blocked by the auto-mode classifier

### 4B. Discard Changes gap — corrected mechanism, folds into Item 9 (deferred, see Parked below)

Ryan's hypothesis was "QuickControls has side effects on `reports_snap_2`, discard would miss
them." Traced directly — the mechanism is different from what was suspected, and the real gap is
slightly worse than framed, but not new:

- **QuickControls is not the culprit.** `applyPick` (Item 1C) writes exclusively via
  `actions.updateAttribute` → `onChange` → `saveIndex` → debounced outer `onChange(values)` →
  `draft_sections`. `discardChanges()` (`editFunctions.jsx:185-203`) DOES revert `draft_sections`
  (from `item.sections`) — a QuickControls pill change, then discarded, is correctly undone today.
  No gap here.
- **The real, already-known gap is RRL's own route mutations.** Every RRL-native write
  (`persistRoutes` in `useReportRow.js` — add/remove/reorder/rename/date-edit route) goes straight
  to the separate `reports_snap_2` row via its own immediate `apiUpdate`, with **no draft/published
  staging at all.** It's not that discard "misses" reverting it — there's no draft copy to revert
  to in the first place. This is exactly Item 9 below, unchanged, just re-confirmed.
- **One surface not yet in Item 9's writeup**: `toggleDynamicReport`
  (`ReportRouteList.jsx:225-237`) writes `filters` directly onto the **page row itself**
  (`apiUpdate({data:{id:item.id, filters:nextFilters}}, skipNavigate:true)`), immediately, no
  draft. `discardChanges()`'s `newItem` never sets `filters`, so it's never restored either.
  Flipping "Dynamic Report" on, then clicking Discard Changes, does not revert it — same defect
  class as Item 9, but on the page row's own `filters` field rather than a sibling dataset row.
  Fold into Item 9's eventual fix scope as a third affected surface (alongside `routes` and any
  future RRL-native field) whenever that item is picked back up.

**Net**: no new bug, one corrected hypothesis, one newly-identified affected field for Item 9.
Worth flagging: Item 9 says "revisit after Tiers 1-3 ship" — Tier 1/2 have; Tier 3 hasn't (blocked
on Ryan's 3A design decision) — and 4A above means RRL's un-staged mutation surface is now reached
in one fewer click than before. Ryan's call whether that changes the "wait for all of Tier 3"
timing.

### 4C. Dynamic Report UI authoring gaps — lower priority per Ryan, not re-triaged this pass

Pointing at what's already known rather than re-deriving, since Ryan flagged this thread as lower
priority:
- Gap #16 (`report-route-ui-parity-gaps.md`) — Info Box / Route Compare sections have zero creation
  UI. Already in this doc's Parked section below; confirmed in-scope, not yet triaged at the
  code-level depth items 1-9 got.
- Tier 3 / item 3A above — Title/Description auto-compose still blank on every graph; blocked on
  Ryan's pristine-vs-always-overwrite design decision, unchanged.
- `dynamic-reports-and-route-tags.md` (~line 356-358, ~517-521): no live authoring UI exists yet
  for setting a graph's own window/`routeWindows` (the AM/PM-variant-style per-route override) —
  same "missing authoring surface" category as gap #16. That doc also flags a possibly-stale note
  about a route-level weekday/peak-hour control in `RouteRow.jsx` "writing to a dead field" — worth
  a quick re-check next time that file's touched, since Design Push #2 (2026-08-06) already deleted
  that whole UI block per `RouteRow.jsx`'s own current top-of-file comment; that note may itself
  now be stale.

No action taken on 4C this pass — logged for whenever this becomes priority.

---

## Tier 5 — five more gaps raised 2026-08-20 (post-Tier-4 usage)

Ryan's next round of feedback after using the shipped Tier 1/2/4 work himself. Five threads;
triaged directly against the current code this session.

### 5A. QuickControls: Width + Reorder pills — DONE, live-verified 2026-08-20

**File**: `src/themes/transportny/components/QuickControls/index.jsx` +
`QuickControls.theme.js`.

Ryan's own framing flagged a real worry worth resolving explicitly: reordering "MIGHT be a
little tricky... I think we rely on section index somewhere? maybe to map routes to graphs?"
**Confirmed false** — `grep -n "index" useGraphPublish.js` returns zero route/graph-mapping hits;
routes are matched to graphs exclusively via `_measurePick.routeIds` (a `route_comp_id` array
stored on the graph's own `display._measurePick`, see Item 1C/composeMeasureConfig.js), never by
a section's position in `draft_sections`. Section order and route↔graph binding are fully
orthogonal — reordering sections cannot desync route assignment.

Better still: both controls needed **zero new plumbing**. Item 4 (1C) already threads
`actions: {moveItem, updateAttribute, ...}` and `sectionState: {i, value, ...}` into
`npmrdsQuickControls`/`QuickControlsRow` — the exact same primitives `sectionMenu.jsx`'s own
Settings-drawer "Move Up"/"Move Down" pills (`moveItem(i, ±1)`, gated
`!isEdit && canEditPageLayout && canEditSection`) and "Width" item (`updateAttribute('size',
name)`, gated `canEditSection` only) already use today. This is the same class of change as every
other QuickControls pill: expose an already-working, already-persisting capability one click
closer, not a new mechanism.

- **Width**: a popover pill (`widthPillDef`) listing all 12 col-span options (mirrors
  `sectionMenu.jsx`'s own sorted-by-`iconSize` list), writes via
  `actions.updateAttribute('size', name)` — the literal same call `sectionMenu.jsx` makes.
  Deliberately NOT part of the responsive `pillDefs`/"⋯" overflow system the data pills use
  (Routes/Measure/When/Aggregate/Mode) — grouped instead with Reorder, below.
- **Reorder**: two small Move Up/Down icon buttons (`actions.moveItem(sectionState.i, ±1)`),
  gated on a NEW `auth.canEditPageContent` check (threaded through
  `npmrdsQuickControls({..., auth})` → `canReorder` prop) — matching `sectionMenu.jsx`'s own extra
  `canEditPageLayout` gate on its identical buttons (reordering is a page-layout permission, width
  is not, per that file's own precedent).
- **Layout**: mid-implementation, Ryan flagged the two layout controls should be left-aligned
  while the data pills stay right-aligned — then, a second correction, that Width itself belongs
  in that same left-aligned group next to the Move arrows, not in the right-aligned data cluster.
  Final structure: two flex siblings under a new `rowWrapper` (`w-full flex items-center
  gap-1.5`) — `reorderGroup` (pinned left, `shrink-0`, holds Move Up/Down + the Width popover) and
  the existing `wrapper` (now `flex-1 min-w-0` instead of `w-full`, still internally
  `justify-end`, holds only Routes/Measure/When/Aggregate/Mode + "⋯"). The row-fit
  `ResizeObserver` measurement still only sees the data cluster's own available width, unaffected
  by the layout group's width.

**Live-verified 2026-08-20** via claude-in-chrome on the existing scratch page
`converted_reports/page_27` (id `2213752`, left over from Tier 4A, still not deleted — see that
item's own note): confirmed the layout group (Move Up/Down + Width) renders pinned left as three
small controls, data pills right-aligned as before; clicked Width → 6, graph visibly narrowed to
half-width, pill relabeled "6/12" in its left-group position, **survived a full page reload**;
added a 2nd graph via Add Graph, clicked "Move down" on the first (now-half-width Speed) graph,
the two graphs visibly swapped order, **survived a full page reload**; re-opened the Width
popover after the layout correction to confirm it still opens/writes correctly from its new
position; zero console errors at any checkpoint (`read_console_messages`, `onlyErrors:true`).

- [x] Add Width pill (popover, 1-12 col-span picker) — 2026-08-20
- [x] Add Move Up/Down buttons, gated on `auth.canEditPageContent` — 2026-08-20
- [x] Left-align the layout controls against the right-aligned data-pill cluster (mid-session
      correction) — 2026-08-20
- [x] Move Width into that same left-aligned group, next to the Move arrows (2nd mid-session
      correction) — 2026-08-20
- [x] Live-verify all of the above, including reload-persistence and a real 2-section reorder —
      2026-08-20
- [ ] Not done: `probe_corpus.mjs` (consistent with this whole arc's earlier deliberate skips);
      no golden-corpus entry exercises `/edit/...` at all (see Tier 1's own note on this same gap)

### 5B. Graph/section title never auto-populates — re-raised, same gap as Tier 3 item 3A

Ryan re-hit this independently ("Graph/section title does not get populated at all, either via
`Add Graph`, or changing the pill measures"). Re-confirmed by re-reading
`composeMeasureConfig.js` end to end this session: it composes `xAxis`/`yAxis`/`tooltip`/
`legend`/`colors`/`join`/`comparisonSeriesCombine` but never touches `display.title.title` or
`display.description` — nothing has changed since 3A was written. **Same gap, not a new one.**
Still blocked on the same unresolved design call 3A already flagged: (a) only default while the
title field is empty, vs (b) track a pristine/auto-generated flag so the title keeps resyncing on
every re-pick the way every OTHER composed field does, until the author manually edits it. No
`_isAutoGenerated`-style field exists anywhere in this codebase to copy for (b). **Still needs
Ryan's decision before implementing** — see the AskUserQuestion posed this session.

### 5C. No UI for creating a Map component — confirmed real, bigger gap than 5A/5D

`useAddGraphSection.js`'s own comment already flagged this ("Map is NOT here: it has no
columns/join shape at all... needs a genuinely separate compose path — not yet built") and
`AddGraphModal.jsx` disables the Map shape card (`DISABLED_SHAPES = { Map: "Map graphs aren't
built yet." }`). Confirmed via direct read of Map's `ComponentRegistry/map/config.jsx`: **its
registry entry has no `defaultState` key at all** — unlike AVL Graph/Spreadsheet, there is no
JSON shape to `cloneDeep` and splice into `draft_sections` the way `useAddGraphSection.js` does
for those two. Map manages its own state via `useImmer` inside `MapSection` and is built
interactively (adding layers/symbologies one at a time) through its own edit UI — the exact same
"new capability, not a wiring fix" classification `report-route-ui-parity-gaps.md` gap #16
already carries for Info Box/Route Compare. Two possible shapes for a fix, neither started:
(a) find/construct a genuinely minimal blank Map state and give `useAddGraphSection.js` a real
compose path for it (mirrors AVL Graph/Spreadsheet, but Map's edit UI was built assuming
interactive layer-by-layer construction, so this may not have a clean "blank" state to begin
from); (b) let "Add Graph" with Map selected create a bare Map section pre-assigned this card's
routes (so QuickControls' Routes pill picks it up immediately) and hand off to Map's own existing
interactive edit UI for everything else, rather than trying to compose symbology JSON at all.
**Not scoped further this session — bigger lift than 5A/5D, matches gap #16's own "next dedicated
deep-dive" framing.** Sequencing question posed to Ryan below.

**Scoping session, 2026-08-20 (continued) — re-opened per Ryan's "let's start scoping out the Map
authoring UI now."** Two research passes against the current code (corrected each other once —
see the note below) substantially narrow this: the gap is smaller and more bounded than the
paragraph above assumed. Also noted: `map_dama` (the legacy alias in
`ComponentRegistry/index.jsx:53`, `hideInSelector`) is confirmed dead per Ryan — irrelevant to this
design, flagged only for opportunistic cleanup later, not acted on here.

**Correction to this item's own earlier framing**: Map does NOT lack a workable empty state.
`MapSection`'s `useImmer` initializer (`ComponentRegistry/map/index.jsx:365-383`) fills sane
defaults (`EMPTY_TABS`/`EMPTY_OBJECT`) even from `{}`/`undefined` input, and `Map.migrate.js:36-37`
passes empty input through untouched. **A blank Map card is already creatable today** via the
generic per-section Settings → "Type" switcher (`section.jsx:166-181` → `sectionMenu.jsx:992-1010`)
— Map has no `hideInSelector` and no `defaultState`, so switching any section's type to "Map"
already produces a working (if undiscoverable, unassigned) empty map. `AddGraphModal.jsx`'s
`DISABLED_SHAPES` message ("Map graphs aren't built yet") is therefore stale/inaccurate — the
runtime works; only a **guided, report-aware** creation path (pre-assigned to this card's routes,
self-bound from the moment it's created) is actually missing.

**The self-binding wiring is generic, small, and already proven** — not something new to invent
for Map. `MeasurePicker/index.js`'s `applyMeasurePickToState` (lines ~200-215) has a block that has
nothing to do with columns/measures: it upserts `state.comparisonSeries.enabled/seriesKey/
seriesLabel` and a `display._functions.subscribers` entry (`functionId:'comparison_series',
paramKey:'$self'`), idempotently. This is pure "make this section report-ready" plumbing that
happens to live inside the chart/table compose function today. Map already fully supports being on
the *receiving* end of this (confirmed in the first research pass: `config.jsx:82` sets
`useDataSource:true`; `QuickControls/index.jsx`'s `isMapCard`/single-route-mode/no-measure-pill
branches, ~lines 144-148, are already built) — the ONLY reason a Map section isn't self-bound today
is that nothing ever calls this wiring for it, because `useAddGraphSection.js:47-50` refuses to
compose Map at all. **Factoring this block into a small shared helper (e.g.
`ensureSelfBoundReportWiring(state)`) that both the existing chart/table path AND a new Map path
call is a safe, purely-additive extraction** — same class of change as every other item in this
arc, zero risk to Graph/Table's existing behavior.

**The genuinely novel part is the starter layer content**, and it's more bounded than feared.
Map's comparison-series runtime (`useComparisonSeriesLayers.js`) needs one layer flagged
`series-template:true` with a `series-feature-column`/`join.featureKeyColumn` matching the route
join key (`"tmc"`) — `materializeSeriesLayer` (same file, lines 78-161) then clones it once per
assigned route/variant at render time; nothing else is needed for the mechanism to work end to end.
Read the Python converter's `route_map.py` (which already builds working Map sections for migrated
reports — the ground-truth reference shape) to find out what a real template layer looks like:

- **Base geometry is a fixed, shared source reused by every report**: `source_id: 582` (one tile
  view per network year via `GEOMETRY_TILE_VIEWS`, `route_map.py:21-23`), never per-report.
- **Two style families, not one**: (a) a "none"/plain measure — flat line color, genuinely
  boilerplate, NO join at all (`route_map.py:107-131`); (b) 4 choropleth measures (Speed, Travel
  Time, Hours of Delay, Avg Hours of Delay) — `layer-type:"choropleth"` + a real data `join`
  (fixed CH source `{sourceId:583, viewId:982, env:'npmrds2'}`) + `color-range`/`legend-data`.
- **Templates are minted ONCE per (year, measure)**, not per report — the Python script reuses the
  exact same object across every report on that network/measure, mutating only 3 fields per report
  (`color-range`, `legend-data`, one paint color, `route_map.py:689-694`). Route/date specificity
  never lives in the layer JSON — only in the runtime-resolved comparison-series variants.
- Confirms `series-template:true` is a static, per-template constant an author (or converter) sets
  once on the template layer, unconditionally — never computed per report (`route_map.py:110`).

**What this means for scope**: a plain/geometry-only Map (style family (a) above) is a ~20-30 line
hardcoded JS starter-layer constant, no join, no per-report computation — directly analogous to
`BASE_SOURCE` for graphs. A choropleth-by-measure Map (style family (b)) needs the join block wired
too (mechanical, same fixed source/view every time) but its `color-range`/legend breaks are
currently computed by the Python script via `apply_route_map_paint`, working from a batch pass over
real historical data — there's no existing client-side equivalent to compute quantile breaks live in
the browser. A first cut would need either a static default color-range per measure (author refines
afterward via Map's own existing color/legend settings UI — same "smart default generator, editable
after" philosophy `composeMeasureConfig.js`'s own doc comment already states for graphs) or scoping
choropleth out of this pass entirely.

**Where the entry point lives**: `AddGraphModal.jsx`'s disabled Map shape card is the natural single
front door — same modal Graph/Table already use, already has the checked-routes list available to
seed `_measurePick.routeIds` the same way Table does. The generic Type-switcher back door (found
above) is out of scope to touch — it's a `dms`-core, project-agnostic mechanism, not this arc's
concern.

**Corrected mid-research**: a first research pass claimed self-binding is NOT wired at graph
creation and requires an author to manually use `sectionMenu.jsx`'s generic "Interactions" submenu
and type the literal string `$self`. This was WRONG — verified directly by reading
`MeasurePicker/index.js:200-215` — self-binding IS wired automatically today, inside
`applyMeasurePickToState`, for every Graph/Table section. The Interactions submenu is a real,
separate, more-generic control that happens to write the same underlying field, but it is not the
mechanism Add Graph/QuickControls actually use. Recorded here so this doesn't get re-asserted next
time this item is picked up.

- [x] Ryan's scope call, via `AskUserQuestion`: **plain geometry map only** (recommended option) —
      choropleth-by-measure deferred to its own later pass.
- [x] Extracted `ensureSelfBoundSubscriber(state)` out of `MeasurePicker/index.js`'s
      `applyMeasurePickToState` (was inline lines ~205-215) — pure refactor, zero behavior change
      for Graph/Table (verified: only the `_functions.subscribers` upsert moved, NOT
      `state.comparisonSeries.enabled/seriesKey/seriesLabel`, which is chart/table's own
      "categorize column" master switch and has no Map equivalent — `useComparisonSeriesLayers.js`
      never reads `state.comparisonSeries` at all).
- [x] New file `MeasurePicker/composeMapConfig.js`: `GEOMETRY_TILE_VIEWS` (ported from
      `route_map.py`), `composeMapSectionConfig()` builds one `series-template:true` route-geometry
      layer (flat line color, no join — ported verbatim from that same file's
      `ensure_route_map_none_template`) against the already-shipped, join-less `graph.availabs.org`
      tile host (confirmed live in `build_tsmo2_corridor_view.mjs`'s real "Selected corridor"
      symbology, rather than dms-server's own join-capable tile host, which this scope never needs).
- [x] `useAddGraphSection.js`: Map now branches to `composeMapSectionConfig()` + `state.display
      ._measurePick = pick` instead of the old `if (pick.graphType === 'Map') return null;` bail-out
      — skips the chart/table-only `applyMeasurePickToState`/`graphComponent.defaultState`/
      `externalSource` path entirely, since Map has none of those concepts.
- [x] `AddGraphModal.jsx`: removed Map from `DISABLED_SHAPES` (now `{}` — mechanism kept for any
      future disabled shape, not deleted); hid the Measure `<select>` and Resolution field for Map
      (neither is meaningful — Map has no measure/time-bucket concept in this scope, same reasoning
      "When" already hid for Map); preview title drops the measure prefix for Map ("Map", not
      "Travel Time — Map"); preview summary swapped to a Map-specific sentence instead of the
      resolution/When-based one. `graphGuidanceCopy.js`'s Map description corrected — it said
      "colored by the current measure" (written ahead of this session, anticipating choropleth);
      changed to describe what actually ships this pass, flagged to revisit when choropleth lands.
- [x] Live-verified via claude-in-chrome on a fresh scratch page (`converted_reports/page_26`,
      created via the Create Report button): Add Graph → Map renders with Measure/Resolution/
      Comparison Mode/When all correctly hidden, preview copy correct; confirmed real end-to-end
      mechanism — the created section's Legend shows "1 LAYER" with the assigned route's name, and
      zooming into the map shows a real materialized line layer drawn exactly along the actual TMC
      geometry (Queens Midtown Expy) — self-binding, RRL's route publish, and
      `useComparisonSeriesLayers.js`'s per-route materialization all confirmed working live, not
      just structurally. Ryan independently confirmed seeing the geometry render in his own browser
      at the same time. Persisted correctly across a full page reload. Zero console errors
      (checked from a fresh navigation, not a possibly-stale buffer).
      **Not chased further per Ryan's explicit call mid-session** ("don't worry about trying to
      style it, we will need to build out that UI") — the map's default zoom/fit-to-route framing
      and any visual styling of the starter layer are future authoring-UI work, not this pass's
      scope. Scratch page `converted_reports/page_26` left undeleted for Ryan to inspect/clean up.
- [ ] Not built this pass, deliberately (per the locked scope decision above): choropleth-by-measure
      Map (Speed/Travel Time/Hours of Delay/Avg Hours of Delay) — needs a data join + a color-range/
      legend-breaks strategy (live default vs. Python-computed quantiles); QuickControls' own
      Map-specific pill behavior (`isMapCard`, single-route mode) — already fully built pre-existing
      code, not touched, confirmed compatible with sections created this way.

### 5H. Real `dms`-core bug found: QuickControls (and any state-dependent header/menu extension) never mounts on a non-dataWrapper component under `SectionView` — DONE, live-verified 2026-08-20

Ryan's next ask after 5C shipped: "start on basic styling/layout options for Map, and mirror
Add-Graph-modal functionality into QuickControls." First check — does QuickControls even render on
the Map section created in 5C? **It did not**, despite `themev2.js`'s `sectionHeaderExtensions`
correctly listing `"Map": [npmrdsQuickControls]` and `npmrdsQuickControls`'s own gate condition
(`canEditSection && useDataSource && isSelfBound && isReportPage`) reading as satisfiable. Root-
caused via direct code trace, not guessed:

- Map sets `useDataSource: true` but has no `useDataWrapper` — so it renders through
  `components/index.jsx`'s generic dispatcher's non-dataWrapper branch (`NonDataEditComp`/
  `NonDataViewComp`), never through the real `DataWrapper.EditComp`/`ViewComp`.
- `NonDataEditComp` (the `SectionEdit`/pencil-open path) correctly threads `onHandle` down to the
  registered component and re-forwards its real live state upward — this path was fine.
  `NonDataViewComp` (the `SectionView`/no-pencil path — i.e. every ordinary `/edit/...` page load)
  **never even declared an `onHandle` prop**, and the `ViewComp` dispatcher's non-dataWrapper branch
  never passed one in either. So `section.jsx`'s `dwHandle` stayed `null` forever for any
  non-dataWrapper component viewed without its own pencil clicked, `stateFromRef` read as
  `undefined`, and `isSelfBound` (and anything else a `sectionHeaderExtensions`/
  `sectionMenuExtensions` builder reads off `state`) silently evaluated false — no error, just a
  header row that never appears.
- **This bug predates this session and isn't Map-specific** — it affects EVERY non-dataWrapper,
  `useDataSource`-flagged component under View mode. It was invisible until now only because
  nothing had ever made a Map section self-bound before 5C's new compose path existed; Graph/
  Spreadsheet never hit it because they go through the real `DataWrapper.ViewComp`, which already
  threads `onHandle` correctly (line ~215 of that dispatcher).
- **Fix, in `src/dms/packages/dms/src/patterns/page/components/sections/components/index.jsx`**:
  mirrored `NonDataEditComp`'s existing `onHandle`/`mapAPIRef`/reporting-effect pattern into
  `NonDataViewComp` (previously had none at all), and added the missing `onHandle={onHandle}` prop
  to the `ViewComp` dispatcher's `<NonDataViewComp>` call. Small, generic, no NPMRDS-specific logic
  — squarely within this arc's "if `dms` must be touched, keep it project-agnostic" rule. Every
  other non-dataWrapper component (`lexical`, `Filter`, `Upload`, `Validate`, etc.) simply ignores
  the new `onHandle` prop it never used before — no behavior change for them.
- **Live-verified 2026-08-20** on the same scratch page (`converted_reports/page_26`): reloaded
  after the fix — the full QuickControls row now renders on the Map card with zero pencil click:
  left-aligned Move Up/Down + Width pill, right-aligned Routes + When pills. Clicked Width → 6,
  card visibly narrowed to half-width, pill relabeled "6/12", **survived a full page reload**. Zero
  console errors across two separate reload checks.
- Ryan confirmed the underlying design intent explicitly: "we dont want the user to EVER have to
  put a section into edit mode" — this fix is what actually makes that true for Map; before it,
  every Map-specific QuickControls affordance already written in 1C/5A (`isMapCard`, single-route
  mode) was structurally unreachable outside the pencil, silently contradicting that same intent.

- [x] Root-cause traced via direct code read (`components/index.jsx`, `section.jsx`,
      `MapSection`'s own `onHandle` call) — 2026-08-20
- [x] Fix applied: `NonDataViewComp` now threads `onHandle` the same way `NonDataEditComp` already
      does; `ViewComp` dispatcher now passes it through — 2026-08-20
- [x] Live-verify: QuickControls (Routes/When/Width/Reorder) renders and persists on a Map section
      with zero pencil click — 2026-08-20

### 5I. Map basic styling/layout — next steps, not yet built

Ryan's ask, continued: basic styling/layout controls for Map, mirrored between Add Graph modal and
QuickControls (same shared-function pattern every other pill already uses), still "very easy" per
this arc's standing bar. Investigated before building anything:

- **"Color by measure" (choropleth) is NOT the next easy piece** — flagged this directly to Ryan.
  Per-route coloring is already automatic (`materializeSeriesLayer` assigns each route a distinct
  series-palette color today, no work needed). Color-*by-value* needs a data join plus a
  color-range/legend-break strategy; the only place that's ever computed is the Python converter's
  offline quantile bake over real historical data (`apply_route_map_paint`) — no live client-side
  equivalent exists. This is exactly the piece 5C already scoped OUT as "bigger, later."
- **Basemap style needs no new work at all** — `AvlMap` (the shared low-level map component
  `MapSection` renders) already ships its own basemap-style switcher directly on the map canvas
  (`showLayerSelect={true}`, `onMapStyleSelect` persists via `setState` — `index.jsx:1345-1360`).
  Nothing to build or mirror; it's already fully self-service.
- **No line-color/line-width/opacity editing UI exists anywhere yet** — grepped
  `settings/controls.jsx`/`settings/symbology.jsx` for any paint-editing control: zero hits. This is
  a genuine, unbuilt gap, not a mirroring task.
- Ryan's read on the first concrete pill to build was still open as of this write-up (posed line-
  width vs. single-route color-override vs. "something else" via `AskUserQuestion`; picked "tell me
  something else" — his specific pick not yet captured in this file).

- [x] Ryan's answer, plain and direct: skip styling entirely (explicitly "line width is wayyy too
      fiddly... we have NOVICE users, they just want to pick their measure pretty much") — the real
      ask was color-by-measure (choropleth) after all, the exact thing this item's own write-up
      had just flagged as "bigger, deferred." Reframed and built this same session — see 5J below.

### 5J. Map "color by measure" (choropleth) — Speed shipped, DONE + live-verified 2026-08-20

Ryan's redirect on 5I made the real ask explicit: novice authors don't want styling knobs, they
want to pick what the map is colored by — the choropleth feature 5C/5I had deferred as "needs a
live quantile bake, out of scope." Investigated properly before building (Ryan's own tip: "my
coworker has done a LOT of map work... MacroView... includes color scale, choosing measures" —
checked that prior art first) rather than re-deriving from nothing:

- **`components/macroview/breaks.js`** (dms-template-native since the 2026-07-29 macroview port)
  had already solved the exact design question this item was stuck on: MacroView used to compute
  breaks live per view via ClickHouse `ckmeans`, and that produced an unstable, unreadable legend
  (one color swallowing 66-89% of the network; edges relabeling every year, making comparison
  impossible — full writeup in that file's own header). The fix that shipped there was **fixed,
  author-chosen breaks**, never live-computed. Directly informs this item: ship fixed breaks for
  NPMRDS Route Map too, not a live per-report quantile query.
- **`choroplethPaint` already exists as a generic, reusable `dms`-core function**
  (`ComponentRegistry/map/utils.js`) — confirmed via `route_map.py`'s own docstring that its Python
  `choropleth_paint` is "ported index-arithmetic-for-index-arithmetic" from this exact JS function.
  Called it directly rather than re-deriving the step-expression/legend logic.
  Confirmed via `SymbologyViewLayer.jsx`'s `buildJoinParam` that a layer's `join.query.join` field
  must already be the FULL `{sources, on}` wire shape (not the raw `{sources:{table1}}` form) — so
  `buildJoin` from `buildUdaConfig.js` (the same function every chart's own join already goes
  through) is called directly to expand it, not hand-rolled.
- **Confirmed the join/paint mechanism is entirely tile-request-time, not baked into the static
  tile URL** — `SymbologyViewLayer.jsx`'s `buildJoinParam` reads `layer.join` and appends an
  encoded `join=` query param to each tile fetch AT RUNTIME. This is why choropleth needs the
  join-capable tile host (an app's own `CMSContext.API_HOST`/`fileUploadInfo.DAMA_HOST`, the same
  convention `macroview/comp.jsx` already uses) — the plain-geometry host from 5C
  (`graph.availabs.org`) doesn't implement that param at all.
- **vocabulary.json already carries everything needed per measure** (`expr`, `requiresJoin`,
  `reverseColors`) — no fresh SQL was hand-ported from Python; only the value's trailing alias gets
  swapped to `"as value"` (the one thing Map's `data-column` convention needs that every other
  consumer of the same field doesn't).

**Scope shipped this pass: `'none'` and `'speed'` only.** `travelTime`/`hoursOfDelay`/
`avgHoursOfDelay` are NOT wired — `hoursOfDelay`/`avgHoursOfDelay` need a materially more complex
two-source join (`META_JOIN` + `AADT_DIST_JOIN`, confirmed in vocabulary.json's own `requiresJoin`)
and `route_map.py` itself treats that as separate, harder work ("M3+ handoff," not folded into the
single-join measures). `travelTime` has its own unresolved oddity worth flagging before extending:
`route_map.py`'s own travelTime choropleth template sets up a join even though
`vocabulary.json`'s `travelTime.requiresJoin` is `[]` and the expression itself references no
joined table — unclear whether that's a genuine requirement specific to the Map tile pipeline or a
copy-paste artifact from the speed template it was adapted from. Didn't guess; scoped it out along
with the two-source-join measures rather than risk shipping 3 unverified choropleths on top of 1
verified one.

**Files touched**:
- `composeMapConfig.js`: `MAP_MEASURE_OPTIONS` (`'none'`, `'speed'`), `CHOROPLETH_DEFAULTS.speed`
  (fixed colors/breaks — the same placeholder range `route_map.py` already ships, not
  independently re-derived), `buildChoroplethLayer`, `composeMapSectionConfig`/
  `applyMapMeasureToState` now dispatch on `measureKey`. The picker owns exactly ONE fixed
  symbology slot (`mp_map_layer`) — switching measures replaces it wholesale; any symbology an
  author adds by hand via the Symbology Library lives under its own id and is never touched.
- `composeMeasureConfig.js`: `ensureSelfBoundSubscriber` (+ its `REPORT_SUBSCRIBER_ARGS` constant)
  relocated here from `MeasurePicker/index.js` — purely to break a circular import
  (`index.js` -> `composeMapConfig.js` -> `index.js`) now that `composeMapConfig.js` needs it too;
  no behavior change.
- `MeasurePicker/index.js`: `applyMeasurePick`'s Map short-circuit now recomposes the managed layer
  whenever `partial.measure` is present (via `applyMapMeasureToState`), in addition to its existing
  Routes/When field-merge; `apiHost` threaded through as a new optional param.
- `useAddGraphSection.js`: reads `apiHost` via `useContext(CMSContext)`, passes `pick.measure` +
  `apiHost` into `composeMapSectionConfig`.
- `AddGraphModal.jsx`: Map gets its OWN "Color by" field (`MAP_MEASURE_OPTIONS`, a `<Select>`, not
  the chart `<select>`/`MEASURE_CATEGORIES`); measure resets to `'none'`/`DEFAULT_PICK.measure`
  when switching into/out of Map (the two lists only coincidentally share the `'speed'` key);
  preview title/description now reflect the Map measure choice instead of hiding measure text
  unconditionally.
- `QuickControls/index.jsx`: `hasMeasureAggregate` split into `hasMeasure` (now true for Map too)
  and `hasAggregate` (still false for Map — no resolution/time-bucket concept); Measure pill and
  its popover render `MAP_MEASURE_OPTIONS`'s flat list for a Map card instead of the chart
  `MEASURE_CATEGORIES` grid; `apiHost` threaded via `useContext(CMSContext)`.

**Live-verified 2026-08-20** via claude-in-chrome on the existing scratch Map section
(`converted_reports/page_26`): clicked the new "NONE" pill in QuickControls, popover showed "None
— just show the route" / "Speed (mph)"; picked Speed — pill relabeled "SPEED", and the Legend
panel showed a REAL computed value (`29.96 - 29.96`, a genuine ClickHouse-side speed aggregate for
that TMC, not a placeholder) with correct yellow choropleth coloring. Persisted correctly across a
full page reload (pill still "SPEED", same real value). Zero console errors at every checkpoint
(checked from fresh navigations, not stale buffers).
**One cosmetic finding, not chased further**: the Legend panel shows "2 LAYERS" for the choropleth
case (the hidden `series-template` row rendering as a bare name+swatch line alongside the real
per-route value row) vs "1 LAYER" for the plain-geometry case, which has no `color-range` on its
hidden template at all. `route_map.py`'s own design intent is that the hidden template render
nothing in the legend; whether this is a `LegendPanel`/`LegendRow` behavior worth a small `dms`-core
fix, or acceptable as-is, wasn't investigated further this pass.
**AddGraphModal's own "Color by" field was NOT independently click-verified this session** —
repeated browser-automation coordinate misses on that one dropdown (confirmed via zero console
errors each time that this was an automation artifact, not an app crash); given the identical
compose function is already proven live via QuickControls, and the field itself uses the exact
same `<Select>` primitive Resolution/Comparison Mode already use successfully elsewhere in this
same modal, this is a low-risk, high-confidence gap — worth a 1-minute click-through next time this
file is touched, not a blocker.

- [x] Investigated MacroView's prior art (`breaks.js` design rationale, `choroplethPaint`/
      `buildJoin` reuse, `SymbologyViewLayer.jsx`'s tile-time join-param mechanism) before building
      — 2026-08-20
- [x] `composeMapConfig.js`: choropleth compose path for `'speed'`, fixed breaks/colors,
      `applyMapMeasureToState` for re-picks — 2026-08-20
- [x] `MeasurePicker/index.js` + `composeMeasureConfig.js`: Map's `applyMeasurePick` branch now
      recomposes on measure change; `ensureSelfBoundSubscriber` relocated to break a circular
      import — 2026-08-20
- [x] `useAddGraphSection.js`: `apiHost` threading + measure passed into Map's compose call —
      2026-08-20
- [x] `AddGraphModal.jsx`: Map's own "Color by" field, measure-list-switch reset logic, preview
      copy — 2026-08-20 (built, not independently click-verified — see above)
- [x] `QuickControls/index.jsx`: Measure pill + popover for Map, `apiHost` threading — 2026-08-20,
      live-verified
- [x] Live-verify Speed end-to-end via QuickControls: real computed value, correct choropleth
      color, reload-persistence, zero console errors — 2026-08-20
- [x] `travelTime`/`hoursOfDelay`/`avgHoursOfDelay` — all three shipped + live-verified same day,
      corrected framing below (they turned out much easier than this write-up originally feared)
- [ ] Not investigated: the "2 LAYERS" duplicate legend row for a choropleth Map's hidden template
      — Ryan re-tested this specifically afterward and did NOT reproduce it; most likely a stale/
      intermediate render from rapid automated measure-switching earlier in this session, not a
      real bug. Not chased further per Ryan's explicit call.
- [ ] Not independently verified: AddGraphModal's own "Color by" field (browser-automation
      friction only, see above) — Ryan independently confirmed this entry point himself instead:
      created a fresh Map via Add Graph with Speed picked at creation time, got a real colored
      choropleth. Both entry points now confirmed working, just via different testers.

### 5K. Corrected framing + travelTime/hoursOfDelay/avgHoursOfDelay shipped — DONE, live-verified 2026-08-20

Ryan's own pushback corrected 5J's scope call: "we do all these joins already via measure picker
[for charts]... but you do you." Right call — 5J's own "M3+ handoff, harder work" framing was
Python's characterization of a DIFFERENT problem (the live quantile-bake query,
`pooled_route_map_values`) that doesn't apply to this fixed-breaks design at all. The actual join
WIRING (`buildJoin`/`buildJoinFromKeys`, already generic over any number of `requiresJoin` sources)
is exactly what every chart measure — hoursOfDelay included — already uses in production today.
Re-scoped and shipped all three same session:

- **`travelTime`**: `requiresJoin: []` in vocabulary.json — trusted that over `route_map.py`'s own
  travelTime template, which (unexplained, never resolved) sets up a join anyway. Chart measures
  using travelTime work with no join, so this file does too.
- **`hoursOfDelay`/`avgHoursOfDelay`**: both need the 2-source `META_JOIN`+`AADT_DIST_JOIN` join —
  `buildMeasureJoin`'s existing generic loop (iterate `requiresJoin`, map each to `table1`/
  `table2`/... positionally) handles this with zero new code, confirmed live, no join-wiring
  changes needed at all.
- **`avgHoursOfDelay` resolution question resolved**: vocabulary.json's own `avgHoursOfDelay.expr`
  (`sum(hourly delay) / count(DISTINCT date)`) is resolution-INVARIANT — a per-day rate, the same
  expression every chart already uses regardless of bucket size. This is DIFFERENT from
  `route_map.py`'s own resolution-keyed `ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION` (a
  Route-Map-specific expression set that file doesn't use). Deliberately used vocabulary.json's
  version, not Python's — one less resolution concept to expose on a Map that has no resolution UI
  at all.
- **Real bug found and fixed**: `travelTime` hit the EXACT SAME join/no-join duality bug this arc
  already fixed once for Table (5F/5G) — `buildChoroplethLayer` had hardcoded `'ds.tmc as tmc'`/
  `groupBy:['ds.tmc']` unconditionally, but the query builder only aliases the base table `AS ds`
  when a join exists. `travelTime` (no join) threw `ClickHouseError: Unknown expression identifier
  'ds.tmc'` — caught via `dms-server.log`, not guessed, exactly the same standard 5F's fix was held
  to. Fixed: `tmcRef = measureJoin ? 'ds.tmc' : 'tmc'`, used for both the groupBy and the second
  select column.
- **`fn` wrapping generalized**: `valueExprAsValue` only handled `fn:'exempt'` (speed/travelTime/
  avgHoursOfDelay); `hoursOfDelay` has `fn:'sum'` in vocabulary.json, needing the expr body wrapped
  in `sum(...)` before the `as value` re-alias — mirrors exactly what `buildUdaConfig.js`'s own
  `applyFn` does for a chart's `fn:'sum'` column (`sum(...) as <alias>_sum`), just re-aliased
  "value" instead of a chart's own `_sum`-suffixed convention.
- **Real, non-blocking data-scoping gap found, not fixed this pass**: `hoursOfDelay`'s `fn:'sum'`
  sums across whatever rows the query matches — and Map's join query has NO date-range filter at
  all (`filters: {}`, unconditionally), unlike Graph/Table which scope every query to the report's
  own date range. Live-verified this produces a legend of `2.9K – 42.4K` hours (values 15-200×
  past the authored `[5,20,50,100]`/max-200 breaks) — every TMC bins into the single worst color,
  destroying the choropleth's usefulness for this ONE measure. `speed`/`travelTime` (self-
  normalizing weighted averages) and `avgHoursOfDelay` (`sum(...)/count(DISTINCT date)`, a
  per-day rate) are NOT affected the same way — verified `avgHoursOfDelay` renders a reasonable
  `~9-12` hour range even with the same unfiltered query, confirming the gap is specific to raw
  `fn:'sum'` cumulative measures, not a mechanism-wide problem. Root cause: Map's authoring UI has
  no date-range concept at all today (unlike Graph/Table). Fixing this properly means either (a)
  adding a date-range facet to Map's own picker (a real, novice-unfriendly UI addition Ryan's own
  "keep it very easy" bar argues against), or (b) picking a sane implicit default window (e.g. last
  90 days) — not decided, flagged for whoever next touches `hoursOfDelay` specifically.

**Live-verified 2026-08-20** on the existing scratch page (`converted_reports/page_26`), using a
second, real multi-TMC route Ryan added himself (`I-87 36001 SOUTHBOUND`, 12 TMCs) — a much better
test than the first route's single TMC:
- Confirmed **per-TMC coloring is real, not a whole-route aggregate** (the open question from
  earlier in this session): with Speed selected, the 12-TMC corridor rendered with visibly
  different colors along its length, not one solid color. Traced the mechanism precisely for
  Ryan: the join query groups by `ds.tmc` (one row per TMC), and `dms-server`'s own tile route
  (`tiles.rest.js`) does a genuine per-feature server-side join — each tile's TMC keys get looked
  up in the query result and attached as that feature's own `value` property, which the paint
  expression reads per-feature. Confirmed via `dms-server.log`, not asserted from reading code
  alone.
- `travelTime`: fixed the join/no-join bug (above), then confirmed a real, small, correctly-scaled
  legend (`0.09 – 1.58` minutes) and visibly varied per-TMC coloring, zero errors after the fix.
- `hoursOfDelay`: real legend values, zero ClickHouse errors — but the `2.9K-42.4K` scale problem
  (above) means the choropleth itself isn't currently useful for this specific measure.
- `avgHoursOfDelay`: real, reasonably-scaled legend (`~9-12` hours), visibly varied coloring, zero
  errors.
- Console/`dms-server.log` checked after every measure switch — the only log lines seen besides
  the one real bug above were the pre-existing, already-known "colorDomain: refusing unfiltered
  ClickHouse join subquery" guard (a different, unrelated live-recompute-breaks safety check this
  session never triggers on purpose, since breaks are fixed/authored here, not live-computed).

- [x] Re-scoped per Ryan's correction: reuse the already-proven chart join mechanism, don't
      re-derive from Python — 2026-08-20
- [x] `travelTime`/`hoursOfDelay`/`avgHoursOfDelay` added to `MAP_MEASURE_OPTIONS`/
      `CHOROPLETH_DEFAULTS` — 2026-08-20
- [x] Fixed the join/no-join `ds.tmc` bug for `travelTime`, generalized `fn` wrapping for
      `hoursOfDelay`'s `sum` — 2026-08-20
- [x] Live-verified all 3 new measures + confirmed per-TMC (not whole-route) coloring on a real
      12-TMC route — 2026-08-20
- [x] `hoursOfDelay`'s unfiltered-date-range scale problem — root cause fixed at the SOURCE, see
      5L below (Ryan explicitly redirected away from a Map-specific patch)
- [ ] Not offered: `co2Emissions_passenger`/`avgCo2Emissions_passenger`/`co2Emissions_truck`/
      `avgCo2Emissions_truck` — no authored `CHOROPLETH_DEFAULTS` entries yet; same mechanism would
      extend to them the same way it did for these three, whenever wanted

### 5L. Every new route gets a real default date range — DONE, live-verified 2026-08-20

Ryan's redirect on the `hoursOfDelay` scale problem: "do NOT just inject this for map or something
... across the whole report we should require a date filter... when a user adds a route, use a
default date range." Right call — confirmed via research this is a genuine, PRE-EXISTING,
report-wide gap, not something specific to Map or to this session's own new code:

- **Confirmed: Graph/Table ALREADY silently query unbounded history for any dateless route
  today**, and always have. `useGraphPublish.js`'s `transformReportRoutes` builds
  `dateArray = route.startDate && route.endDate ? generateDateRange(...) : []` — an empty array
  becomes an empty-valued `{op:'filter', col:'date', value:[]}` leaf, and `buildUdaConfig.js`'s own
  `mapFilterGroupCols` explicitly DROPS an empty-valued filter/exclude leaf as "no constraint,"
  by design (its own comment: an unset leaf should WIDEN the query, not blank it). There is no
  existing guard against this for dates (unlike TMCs, which DO get filtered out of the batch when
  unresolvable) — so a dateless route's assigned Graph/Table has been running unbounded queries
  this whole time, invisible until a `sum()`-style measure (like `hoursOfDelay`) made the scale
  problem visible.
- **One single, well-known construction site** — both `handleAddRouteSlot` and
  `handleConfirmAddRoutes` (`ReportRouteList.jsx`) already funnel through `useReportRow.js`'s
  `addRoutes` (the only place a new route object with a fresh `route_comp_id` gets minted) — one
  targeted fix, not several scattered call sites.
- **"Most recent full month" anchored off the existing publish-lag constant, not literal
  wall-clock today** — `relativeDateResolution.js` already has `NPMRDS_DATA_LAG_DAYS` (21 days)
  and `defaultAnchorDate()`, from an earlier, hard-won finding: NPMRDS's ClickHouse table has a
  real ~15-21 day publish cliff (full data up to a point, zero after), so a naive "today"-based
  default risks landing on a month with no real data at all. New `defaultRouteDateRange()`
  (same file) reuses that exact anchor and the file's own existing `startOfSpan`/`shiftSpans`/
  `endOfSpan` span-arithmetic (already built and used for the relative-date-formula resolver) —
  steps back one full calendar month from the lag-adjusted anchor's own month, since the anchor's
  current month is never guaranteed complete.
- **Applied narrowly and defensively**: `useReportRow.js`'s `addRoutes` only applies the default
  when the incoming route data carries NEITHER a fixed range NOR a `dateFormula` (derived) already
  — never overwrites a real choice. The catalog/tag-browser path never supplies dates today, so
  this is currently unconditional in practice, but the guard is there for if that changes.

**This fixes the pre-existing Graph/Table gap for free** — `transformReportRoutes` already reads
`route.startDate`/`endDate` correctly whenever they're present; no Graph/Table code change was
needed, only ensuring those fields are never empty in the first place. **Does NOT yet fix Map's
own version of the gap** — Map's choropleth join query (composeMapConfig.js) still has
`filters: {}` hardcoded, never reading the assigned route's date range at all; wiring that is
still open (see below).

**Live-verified 2026-08-20**: added a genuinely new route via the Add Routes modal on the scratch
page — it landed with `06/01/2026 → 06/30/2026` pre-filled (visible immediately in both the RRL
summary line and the Dates panel, no manual entry), correctly the full calendar month before the
lag-adjusted anchor's own month (today 2026-08-20 − 21 days = late July 2026 → prior full month =
June). Zero console/`dms-server.log` errors.

- [x] Confirmed this is a genuine, pre-existing, report-wide gap (not Map-specific) via direct
      code trace — 2026-08-20
- [x] `defaultRouteDateRange()` added to `relativeDateResolution.js`, anchored off the existing
      publish-lag constant — 2026-08-20
- [x] Wired into `useReportRow.js`'s `addRoutes` (the one construction site covering both
      "Add Route" entry points) — 2026-08-20
- [x] Live-verified: a freshly-added route gets a real default range, zero errors — 2026-08-20
- [ ] Not done: existing dateless routes (both test routes on this scratch page, and presumably
      others already in production) are NOT retroactively backfilled — this fix only applies
      going forward, to newly-added routes
- [x] Wiring Map's own choropleth query to read the assigned route's date range — turned out to
      need ZERO additional code, see 5M below (Ryan's own redirect — "do NOT just inject this for
      map" — was right in a stronger way than expected: the foundational fix was ALSO the complete
      fix for Map, not just the more-correct one).

### 5M. Confirmed: Map's date-scoping gap closed automatically, no Map-specific wiring needed — DONE, live-verified 2026-08-20

Traced the mechanism before assuming 5L's fix would reach Map at all (it wasn't obvious it would —
`composeMapConfig.js`'s own `join.query.filters: {}` is hardcoded and was never touched). Found
that it doesn't matter: `dms`-core's `useComparisonSeriesLayers.js` (`materializeSeriesLayer`)
already overwrites EVERY materialized per-route clone's `layer.join.query.filters` with the
**entire resolved variant filter tree** —
```js
if (layer.join?.enabled) {
    layer.join.query = { ...(layer.join.query || {}), filterRows: [], filters: { filterGroups: variant.filters } };
}
```
`variant.filters` here is `{op:'AND', groups:[{op:'filter',col:'tmc',...}, {op:'filter',col:'date',...}, ...]}` — the SAME object `transformReportRoutes` (`useGraphPublish.js`) builds for Graph/Table, published through the identical `findSelfBoundGraphs`/self-bound-subscriber mechanism this whole arc already confirmed is element-type-agnostic. The hidden TEMPLATE's own `filters:{}` (what I wrote in `composeMapConfig.js`) is inert — the template's sub-layers are always `layout.visibility:'none'`, so MapLibre never actually fetches tiles for it; only the materialized CLONE ever renders, and the clone's filters get fully overwritten regardless of what the template said.

Ryan had backfilled real June 2026 dates onto all 3 scratch-page test routes (himself, using the
route date editor / "derive from another route, same period, aligned") before this re-test.

**Live-verified 2026-08-20**: re-selected "Hours of Delay" on the 12-TMC I-87 route (the same one
that showed `2.9K – 42.4K` before any route had dates) — legend now reads `2.87 – 24.82 – 776.78`,
a ~50-100× reduction, correctly scoped to one real month instead of unfiltered all-history. Zero
new errors (`dms-server.log` checked; only the same pre-existing, unrelated `colorDomain`
unfiltered-scan guard message appeared, not a new one).

**Net for this whole arc's `hoursOfDelay` investigation**: the "real, non-blocking data-scoping
gap" flagged in 5K is now fully closed, and it was closed by the MORE foundational fix Ryan asked
for, not a narrower Map-specific patch — exactly vindicating his "do NOT just inject this for map
or something" redirect. No `composeMapConfig.js` changes were needed at all for this piece.

- [x] Traced `useComparisonSeriesLayers.js`'s `materializeSeriesLayer` to confirm it overwrites a
      clone's join filters with the full resolved variant tree (tmc+date+epoch), not just tmc —
      2026-08-20
- [x] Live-verified `hoursOfDelay` on a real multi-TMC route with real dates: legend went from
      `2.9K-42.4K` to `2.87-776.78` — 2026-08-20
- [x] Confirmed zero `composeMapConfig.js` changes were necessary — 2026-08-20

### Flagged, not implemented — relative-dates span-default UX idea (Ryan, 2026-08-20)

While backfilling test-route dates via "Derive from another route" + "same period, aligned," Ryan
flagged a real, well-specified UX improvement for a LATER pass: when that relative-date formula is
picked, the span dropdown (day/week/month/year) should default to whatever span the BASE route's
own date range actually spans (e.g., if the base route is exactly one calendar month long, default
the derived route's span picker to "month" instead of whatever it currently defaults to) — not
always achievable cleanly (a 37-day base span doesn't match any dropdown option), but a good
default for the common case. Not investigated or implemented this session — purely logged so it
isn't lost. Likely touches `RouteRow.jsx`'s Derived-mode UI and/or `relativeDatePresets.js`.

### 5D. Add-a-Table doesn't let the author pick multiple measures — DONE, live-verified 2026-08-20

Ryan's call via `AskUserQuestion`: **scope + build Table multi-measure now**, defer Map (5C) to
its own dedicated design pass.

**Design**: a table has no one-measure ceiling the way every chart type still does — one column
per measure, sharing a single xAxis (resolution bucket) column and a single, unioned `join`
(joins are a whole-query concern, not per-column). Table is genuinely a smaller compose shape
than a chart (no comparison-mode/anchor/color/legend/tooltip concept at all — confirmed by
reading `ComponentRegistry/spreadsheet/index.jsx`'s own column selection, which filters purely on
`show`/`selectOnly`, never `target`), so it got its OWN compose function rather than a branch
bolted onto `composeMeasureConfig`.

**Files touched**:
- `MeasurePicker/composeMeasureConfig.js`: added `measures: []` to `DEFAULT_PICK` (Table-only —
  every other graph type keeps the single `measure` field); factored `buildJoin(measure)` into a
  thin wrapper over a new `buildJoinFromKeys(joinKeys)` (union+dedupe across N measures'
  `requiresJoin` lists, positional `table1`/`table2`/...); factored the single yAxis column build
  into `buildMeasureYAxisColumn(measure, target)`; added the new export
  `composeTableMeasuresConfig({measureKeys, resolutionKey, externalSourceColumns})` — N yAxis
  columns + 1 xAxis column + 1 unioned join, `displayPatch: {graphType:'Table', fetchMode:'force'}`,
  `comparisonSeriesCombine: null`. Returns `null` for an empty/all-unrecognized `measureKeys`.
- `MeasurePicker/index.js`: `applyMeasurePickToState` dispatches to `composeTableMeasuresConfig`
  whenever `pick.graphType === 'Table'` — gated on graphType ALONE, deliberately not also on
  `pick.measures.length`, so unchecking the last remaining measure correctly no-ops the whole
  apply (existing columns untouched) instead of falling through to the single-measure branch and
  composing one stale column from whatever `pick.measure` still holds.
- `AddGraphModal.jsx`/`.theme.js`: Table's "What to show" step now renders a full-width multi-select
  checklist (grouped by `MEASURE_CATEGORIES`, same checkbox-row look as the Routes checklist)
  instead of the native single `<select>`; every other shape keeps the single select. Switching TO
  Table seeds `measures` from the current single `measure` the first time (so it never opens
  blank); `canConfirm` now also requires `measures.length >= 1` for Table; preview text/description
  adapted for N measures (shows a count, drops the single-measure blurb once 2+ are picked, matching
  the same reasoning as Tier 5E's "don't show a nonsensical state" — no ONE measure's description
  represents a multi-measure table).
- `QuickControls/index.jsx`: the Measure pill, when `graphType === 'Table'`, renders the identical
  multi-select checklist post-creation (toggling `pick.measures` via `applyPick`) instead of the
  single-pick list every other graph type still gets — necessary so editing an already-multi-measure
  table's measures doesn't silently collapse it back to one column. Pill label shows "N measures".
- `ReportRouteList/useAddGraphSection.js`: corrected a comment that had gone stale the moment this
  landed (previously claimed Table "rides the exact same composeMeasureConfig... machinery,
  needs no special-casing" — no longer true, now explains the real dispatch).

**Real bug found and fixed while live-verifying** (not a pre-existing issue — the first scenario
that ever combines two measures' SQL in one query): `vocabulary.json`'s `travelTime.expr` used
bare, unqualified `tmc`/`travel_time_all_vehicles` column references (no `ds.` table-alias
prefix), unlike every other measure in the file. Standing alone (travelTime's own
`requiresJoin: []`, so its query has no JOIN clause) this was harmless — but combined with ANY
measure that DOES require a join (e.g. `speed`, `hoursOfDelay`), the shared query's `FROM ...
LEFT JOIN ...` made those bare identifiers ambiguous, and ClickHouse rejected the query outright
(`ClickHouseError: ... ambiguous identifier 'tmc'`, code 207 `AMBIGUOUS_IDENTIFIER` — confirmed
via `scratchpad/npmrds-sub/dms-server.log`). Root-caused by diffing against
`convert_old_reports_lib/template_specs.py`'s `TRAVEL_TIME_EXPR` — the Python side's copy of this
same expression is ALREADY correctly qualified (`ds.tmc`, `ds.travel_time_all_vehicles`), so this
was a pre-existing transcription drift in `vocabulary.json` that nothing had ever exercised until
a multi-measure query existed to expose it. Fixed `vocabulary.json` to match its own authoritative
Python source exactly. Audited every OTHER measure's `expr` for the same pattern — all already
fully qualified; travelTime was the only offender.

**Flagged, not fixed — unconfirmed, needs a live test before touching**: `co2Emissions_passenger`/
`avgCo2Emissions_passenger` (and the `_truck` pair) share the exact same `expr` string, differing
only in the outer aggregation `fn` (sum vs avg) — confirmed deliberate per
`convert_old_reports_lib/expressions.py`'s own comment ("only the aggregation 'fn' differs").
Whether combining BOTH variants of the same pair into one table produces a duplicate-alias SQL
collision (unclear without seeing how the query builder promotes each column's outer alias — the
observed `hours_of_delay_sum` pattern suggests the `fn` gets folded into the outer alias, which
would make this a non-issue, but that's inference, not a confirmed trace) is unverified. Didn't
patch renaming anything blind — would need an actual failing-query repro first, same standard the
travelTime fix above was held to. Worth a 2-minute check next time this file is touched: build a
table with both CO2 sum/avg variants of one vehicle class checked together.

**Live-verified 2026-08-20** via claude-in-chrome on `converted_reports/page_27`: built a 3-measure
table (Speed, Travel Time, Hours of Delay — deliberately mixing a no-join measure with two
different join requirements) via Add Graph; confirmed the multi-select checklist, seeded from the
single measure, updates the live preview text ("3 measures — Table"); hit the ambiguous-identifier
error on first render (caught via `dms-server.log`, not just the browser's generic "Error fetching
data"); fixed `vocabulary.json`; forced a recompose via QuickControls' Measure pill (toggle
Speed off/on, since the already-persisted section's columns had the OLD buggy expr baked in as a
literal string — editing the vocabulary alone doesn't retroactively fix already-composed state);
table then rendered 5 real rows with correct, DISTINCT values per column (Travel Time ~7.6-8.3 min,
Hours of Delay ~3.5-37.8, Speed ~55-60 mph — ruling out a silent alias collision across these
three); reloaded the full page, confirmed the 3-column table persisted and re-rendered identically;
zero console errors at every checkpoint after the fix.

- [x] `composeTableMeasuresConfig` (N measures -> N columns + 1 unioned join) — 2026-08-20
- [x] `applyMeasurePickToState` dispatch, empty-measures no-op guard — 2026-08-20
- [x] AddGraphModal multi-select checklist + seeding + canConfirm + preview text — 2026-08-20
- [x] QuickControls Measure pill multi-select for Table — 2026-08-20
- [x] Fix `vocabulary.json`'s `travelTime.expr` qualification bug (found live) — 2026-08-20
- [x] Live-verify a real 3-measure table (mixed join requirements), including reload-persistence
      — 2026-08-20
- [ ] Flagged, not done: confirm whether combining co2Emissions_passenger + avgCo2Emissions_passenger
      (or the truck pair) in one table collides on their shared inner SQL alias

### 5F. Second round of live feedback on 5A-5E — all DONE, live-verified 2026-08-20

Ryan used the shipped 5A-5E work himself and sent back seven more findings in one message. All
seven addressed directly against the code this same session.

**5B implemented** (composeMeasureConfig.js/MeasurePicker/index.js) — per Ryan's explicit
instruction: no new `_auto`/pristine field, keep the mechanism obvious at the call site. Two small
exported functions: `composeAutoTitle(pick)` (deterministic — same pick always yields the same
title; `Table` joins its measures' labels with `, `, every other graph type uses its single
measure's label) and `isTitleDirty({currentTitle, priorPick})` (`false` if `currentTitle` is empty,
else compares against `composeAutoTitle(priorPick)` — the pick the CURRENT title was actually
generated from, captured at the top of `applyMeasurePickToState` before anything overwrites
`state.display._measurePick`). The call site itself is three plain, commented lines right before
the existing bookkeeping block — no dispatch table, no flag, just "recompute what it would have
been, compare, decide." Not yet live-verified with a real title-preservation click-through (the
mechanism is straightforward enough that this session prioritized the other six live-reproducible
bugs) — worth a quick pass next time this file's touched: create a graph (title populates), hand-edit
the title, re-pick the measure, confirm the hand-edited title survives.

**"Add Route" modal tag browser moved above the route list** (`RouteTagBrowserModal.jsx`) — was
below `renderRouteList(visibleResults)` in the `view === 'root'` block; a novice has no reason to
scroll past a route list that already looks complete to find it. Simple reorder, no logic change.
Live-verified: opening Add Routes now shows "Browse by tag" (County/Region/Agency pills +
Auto-generated/Other tags links) immediately, route list below.

**Table column precision** — `TableCell.jsx` renders a column's raw value with NO formatting
unless `formatFn` is set; a fresh table showed full float precision (e.g. "3.5323034922285706").
Added a Table-only `TABLE_MEASURE_FORMAT_FN` map in `composeMeasureConfig.js`, applied as a
post-process step inside `composeTableMeasuresConfig` only (NOT added to the shared
`buildMeasureYAxisColumn` helper both the chart and table paths call — charts never read a
column's own `formatFn`, they use `display.tooltip`'s `valueFormat`/`yFormat` instead, already set
correctly; touching the shared helper risked bleeding into chart behavior for no reason).
`travelTime` gets `minutes_clock` (M:SS — matches its existing `duration_mmss` chart-tooltip
convention); every other measure gets `decimal_2` (same fixed-2-decimal formatter already used for
Route Info Box's plain-decimal measures) rather than `comma` (which floors below its K/M threshold
and would round every one of these sub-1000 rate-like values to a whole number).

**"Summary (one bar per route)" wording** — nonsensical for a Table (rows, not bars). Rather than
fork the whole `RESOLUTION_OPTIONS` list per shape (every other label is fine regardless), added
`resolutionOptionsFor(graphType)` — passthrough except it swaps the Summary option's label to "one
row per route" when `graphType === 'Table'`. Wired into both `AddGraphModal.jsx` (Resolution
`<Select>` + preview text) and `QuickControls/index.jsx` (Aggregate pill + its popover), replacing
the raw `RESOLUTION_OPTIONS` read in both files (now-unused import removed from both).

**Measures checklist too close to Resolution** — not literally overlapping, per Ryan's own
correction, just no breathing room. Added `mb-3` to the Table measures-checklist wrapper in
`AddGraphModal.jsx`.

**The big one — Table + Summary resolution + 2 routes → "unknown expression or table identifier",
blank table.** Reproduced directly (2 routes, Table, Travel Time alone, Summary resolution) and
root-caused via `dms-server.log`, not guessed: **`Unknown expression or function identifier
'ds.tmc'`, code 47.** This is the EXACT INVERSE of the bug 5D's own write-up already fixed once —
the query builder only aliases the base table `AS ds` when the composed query has a JOIN; with NO
join, the base table has NO alias at all, and bare `tmc`/`date` (matching the WHERE clause's own
unqualified form) are what's actually valid. My first fix (qualifying `travelTime`'s vocabulary
string with `ds.`) was correct for the join case and had silently broken the single-measure/no-join
case the whole time — exactly the "replacing one bug with another" risk Ryan named up front.
**Real fix**: reverted `vocabulary.json`'s `travelTime.expr` back to its original bare form (correct
for the no-join case — the ONLY case any chart, or a 1-measure table, ever produces, since
`travelTime` is the sole measure with `requiresJoin: []`). Added a small, explicit, non-regex
lookup — `QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN` in `composeMeasureConfig.js` — consulted ONLY inside
`composeTableMeasuresConfig`, ONLY when that table's own unioned `requiresJoin` set is non-empty
(i.e., some OTHER selected measure forces a join, so `AS ds` WILL exist in this specific query).
Scoped entirely to the one call site that can ever combine a zero-join measure's expression with a
join-requiring one — never touches the shared vocabulary string every single-measure chart path
(and the Python converter) also reads verbatim, so fixing the join case can no longer silently
re-break the no-join case the way qualifying the vocabulary string directly did.

**Live-verified 2026-08-20**, both directions, via claude-in-chrome on `converted_reports/page_27`:
the pre-existing broken table (persisted mid-session with the temporarily-qualified expr, from
diagnosing this exact bug) was forced through a real recompose by adding a second measure (Speed)
via QuickControls' Measure pill — table correctly showed BOTH columns with distinct, correctly
zero-join. Removed a route from its own inputs, confirming NONE (Speed: `54.46`/`57.79`,
`minutes_clock`/`decimal_2` formatting both correct) — then removed Speed again, dropping back to
travelTime alone, which recomposed correctly using the bare/no-join form and kept showing valid
data (`8:28`/`9:40`). Confirmed persistence across two full page reloads. Zero console errors
throughout, confirmed via a clean console-tracking-from-navigation check (not just
`onlyErrors` on a possibly-stale buffer).

- [x] Implement `composeAutoTitle`/`isTitleDirty`, no new field, obvious call site — 2026-08-20
- [x] Move tag browser above route list in Add Routes modal — 2026-08-20, live-verified
- [x] Table column formatFn (`minutes_clock`/`decimal_2`), Table-only, chart path untouched — 2026-08-20
- [x] "Summary (one row per route)" wording for Table, both surfaces — 2026-08-20
- [x] Breathing room between measures checklist and Resolution — 2026-08-20
- [x] Root-cause and fix the Table+Summary+2-routes "unknown identifier" bug — 2026-08-20,
      live-verified both the join and no-join branches, plus reload-persistence
- [ ] Not done: live click-through of the title-dirty mechanism itself (create → auto-title →
      hand-edit → re-pick → confirm survives)

### 5G. Third bug in the same family — inner SQL alias collisions across DISTINCT measures — DONE, live-verified 2026-08-20

Ryan reported the fix in 5F didn't hold on a fresh initial load of one of his tables — new server
error: `Multiple expressions ... for alias speed. MULTIPLE_EXPRESSIONS_FOR_ALIAS` (code 179). Root
cause is a different bug in the same general family (multiple measures' raw SQL sharing one
query), not a regression of 5F's join/no-join fix. Audited every measure's trailing `AS <alias>`
in `vocabulary.json` (a measure's inner alias becomes the literal ClickHouse output-column name for
that SELECT item) and found two genuine collisions, confirmed by grouping all 9 measures by their
alias:

- `speed` and `speedTruck` — both `as speed`. Not a sum/avg pair (unlike the CO2 case below) —
  genuinely different measures whose authors independently picked the same generic alias, never a
  problem while only one measure was ever composed per graph.
- `co2Emissions_passenger` / `avgCo2Emissions_passenger` / `co2Emissions_truck` /
  `avgCo2Emissions_truck` — all four `as avg_co2_emissions` (this IS the CO2 pair flagged as
  "unconfirmed, not fixed" at the end of 5D — now confirmed real, same root cause).

**Verified safe to fix directly, and where the fix belongs**, before touching anything: dispatched
a research agent to trace the full ClickHouse-response-to-DMS-column path
(`buildUdaConfig.js`/`getData.js`/`clickhouse.js`/`uda.route.js`/`utils.js`). Confirmed the alias is
entirely self-contained per column — request, response-column-name extraction, and the Falcor
storage path all re-derive it fresh from the SAME `column.name` string every time; nothing
hardcodes a specific alias text anywhere else in the codebase (also grep-confirmed against the
Python converter — zero literal references to `"as speed"`/`"as avg_co2_emissions"`). Unlike the
travelTime join/no-join case, alias uniqueness has no context-dependent duality — a unique alias
is unconditionally correct whether the measure is used alone or combined with anything — so this
belongs as a direct, permanent fix in `vocabulary.json` itself, not a Table-only override.

Also corrected `vocabulary.json`'s own `_provenance` field, which read "Do not hand-edit expression
strings -- regenerate from the Python source of truth" — traced via research agent and confirmed
**stale/backwards**: there is no Python source to regenerate from anymore. The one-time 2026-07-20
extraction went Python → JSON; every constant the Python converter uses today
(`SPEED_EXPR_TRUCK`, `CO2_EXPR_PASSENGER`, etc.) reads straight back out of this SAME JSON file.
`vocabulary.json` **is** the source of truth; hand-editing it (carefully, per-measure, verified) is
the correct and only way to fix an expression. Left the byte-diff snapshot-check pointer intact
(still useful — it catches drift in anything DERIVED from these constants, e.g. `TEMPLATE_SPECS`),
but rewrote the note so it no longer tells the next person hand-editing is wrong when it demonstrably
isn't anymore.

**Fix mechanics**: edited only the 5 colliding measures' trailing alias
(`speedTruck` → `speed_truck`; the four CO2 variants → `co2_emissions_passenger` /
`avg_co2_emissions_passenger` / `co2_emissions_truck` / `avg_co2_emissions_truck`) via a
Python script operating on each measure's own bounded JSON block (not a whole-file parse+rewrite,
which would have reformatted unrelated lines) — `git diff --stat` confirmed exactly 5 lines
changed, nothing else. Re-ran the alias-collision audit after: zero collisions across all 9
measures.

**Live-verified 2026-08-20**: built a fresh Table (1 route, Speed + Truck Speed, the exact
combination from Ryan's report) via Add Graph — rendered 5 real rows with correctly DISTINCT
values per column (Speed 60.02/58.70/55.52/58.01/60.17 vs Truck Speed
57.83/55.45/49.55/54.15/58.78 — different numbers, ruling out a silent collision where one
column's value overwrites the other's). Confirmed via `dms-server.log` tail that no
`ClickHouseError` fired for this section's queries. Reloaded the full page twice; both columns'
data persisted identically. Did not separately re-verify the 4-way CO2 combination live (the
mechanism is identical and the fix is already confirmed structurally — same alias-audit function
now reports zero collisions for that group too) — worth a quick check next time a CO2-heavy table
comes up.

**Left as pre-existing debris, not touched**: an earlier, now-orphaned 3-measure blank table
(Travel Time + Speed + Truck Speed) from mid-session diagnosis, still showing the OLD persisted
broken columns — same "won't self-heal without a forced recompose" property every fix in this tier
has hit. Not something Ryan reported this round; flagged here rather than silently left unexplained,
since this scratch page (`converted_reports/page_27`) now has a few of these fossils from this
session's own debugging. Ryan's call whether to clean them up or leave them.

- [x] Audit every measure's trailing alias for collisions — 2026-08-20, found 2 groups (5 measures)
- [x] Verify the alias is safe to rename (research agent traced the full round-trip) — 2026-08-20
- [x] Fix `vocabulary.json` directly (the correct location, confirmed via research agent) — 2026-08-20
- [x] Correct the file's own stale `_provenance` note — 2026-08-20
- [x] Live-verify Speed + Truck Speed table, reload-persistence — 2026-08-20
- [ ] Not separately live-verified: the 4-way CO2 sum/avg combination (structurally fixed, same
      mechanism, not re-clicked-through)

**Follow-up same day**: Ryan reported the fix "does NOT work" on his own page — a 2-route,
multi-measure Summary table still hit `MULTIPLE_EXPRESSIONS_FOR_ALIAS`, but toggling Travel Time
off/on with no permanent change "fixed" it, which he read as a sign the Add Graph modal and
QuickControls compose through different, disconnected code paths. Investigated directly rather
than trust either theory: `grep`'d `dms-server.log` for the fresh error and found it was the
SAME already-known "stale persisted columns don't self-heal" pattern (see 5F/5G's own writeups
above) — the specific table he was looking at had its broken columns baked in from BEFORE this
session's alias fix landed, and simply hadn't been through a forced recompose yet; adding a route
to it doesn't touch `state.columns` at all, which is exactly why the symptom read as "add graph
is broken, quickcontrols isn't." Confirmed empirically rather than asserted: built a genuinely
fresh 2-route, Speed+Truck-Speed Table via Add Graph (no QuickControls involved at any point) and
it rendered correctly on first creation, zero error — proving Add Graph and QuickControls do
compose through the identical shared function (`applyMeasurePickToState` ->
`composeTableMeasuresConfig`), no divergence exists. Reported this back to Ryan with the concrete
evidence rather than re-asserting the fix; he confirmed satisfied and will retest independently.
This exact confusion (a stale pre-fix section vs. a fresh one) is now the primary example in
`traversing-report-pages.md`'s new "code-only-vs-baked-in" bullet — should stop costing time once
that's the first thing checked.

### 5E. Difference mode + <2 routes — DONE, live-verified 2026-08-20

Ryan's question: "should we even display [difference mode], if the section only has 1 route
assigned?" Ryan's decision via `AskUserQuestion`: **show but disable** — keep "Difference"
discoverable, but block picking it outside exactly 2 routes.

Two different surfaces needed two different implementations, since they use different UI
primitives:

- **QuickControls** (`renderModeSection`, `QuickControls/index.jsx`): genuine per-option
  `disabled` on the plain `<button>` (these aren't a shared-component abstraction, just raw
  buttons) — `blocked = o.value === 'difference' && routeIds.length !== 2 && pick.comparisonMode
  !== 'difference'`. Deliberately excludes the case where Difference is ALREADY the active
  selection (e.g. a route was removed after the fact, dropping the count below 2) — disabling the
  currently-selected option would trap the author in an invalid state with no way back to Plain.
  That drifted-state case still gets the existing `popWarning` note (now also duplicated onto the
  Mode popover itself, not just the Routes popover, so the warning is visible from wherever the
  author actually is). New theme key `pillDisabled` (greyed, `cursor-not-allowed`).
- **AddGraphModal** (`AddGraphModal.jsx`): the shared `<Select>` UI primitive
  (`ui/components/Select.jsx`) has no per-option `disabled` support, and adding it would be a
  `dms`-core change for one call site — out of proportion here, and arguably wrong anyway since
  the option would need to flicker disabled/enabled in real time as the author checks/unchecks
  routes mid-selection. Used a warning note instead (new `warningNote` theme key, amber,
  matching QuickControls' `popWarning` copy/intent): shows whenever Difference is picked with
  `selectedRouteIds.size !== 2`.

**Live-verified 2026-08-20** via claude-in-chrome on `converted_reports/page_27`: opened the
Speed graph's Mode popover (1 route assigned) — "Difference" renders visibly greyed/disabled,
"Plain" stays interactive; opened Add Graph, checked exactly 1 route, set Comparison Mode to
Difference — amber warning "Difference mode compares exactly two routes; 1 selected right now."
appeared immediately under the field. Zero console errors.

- [x] QuickControls: disable the Difference option below 2 routes (except when already active)
      — 2026-08-20
- [x] AddGraphModal: warning note when Difference + wrong count — 2026-08-20
- [x] Live-verify both surfaces — 2026-08-20

---

## Parked — explicitly deferred per 2026-08-19 decisions

### Item 9 — extend Publish/Discard to RRL's own changes (DEFERRED)

Kept here in full so nothing needs re-deriving whenever it's picked up.

- `publish()`/`discardChanges()` (`editFunctions.jsx:144-182`/`184-202`) operate only on page-row
  structural fields (`sections`/`draft_sections`/`section_groups`/`dataSources` for publish;
  `draft_sections`/`draft_section_groups` for discard) — confirmed, never touch `reports_snap_2`.
- No existing extension point for a sibling section to hook into publish/discard — confirmed via
  grep; `sectionMenuExtensions`/`sectionHeaderExtensions` are the only two such registries in the
  codebase, neither touches publish/discard.
- **Concrete schema sketch, if picked up**: add `draft_routes` as a sibling column on RRL's own
  `reports_snap_2` VIEW (not a page attribute — confirmed this is NOT the same mistake as the
  previously-reverted page-attribute attempt, which was a shared `page.format.js` key inherited by
  every page on every site; this is scoped to one dataset's one view, an ordinary author-content
  change). `loadReportRow` fetches both; edited value becomes `draft_routes ?? routes`; `persistRoutes`
  writes `draft_routes` only; two new functions (`publishRoutes`, `discardRouteChanges`) each do one
  more `apiUpdate` copying one column onto the other on the same row.
- **Wiring options considered, none chosen**:
  (a) a small, generic `dms`-core listener registry mirroring the EXISTING
  `sectionMenuExtensions`/`sectionHeaderExtensions` pattern, invoked by `publish`/`discardChanges`
  before their own `apiUpdate` — consistent precedent, one core touch, keeps one "Publish" concept.
  (b) RRL's own independent, scoped Publish/Discard UI for just its panel — zero core touch, but the
  author sees two separate "publish" actions on one page.
  (c) a project-level side-effect inference (watch `item.sections` vs `item.draft_sections` diffs) —
  no core touch, but fragile/inferential rather than a designed hook.
- **Status: deferred entirely per Ryan, 2026-08-19.** Revisit after Tiers 1-3 above have shipped and
  there's a real feel for whether the lack of undo/staging actually bites in practice.

### Item 1 — same routeComp, multiple dow/peak filters on one section (ACCEPTED v1 GAP, no action)

Confirmed = gap #18 in `report-route-ui-parity-gaps.md`. Confirmed **UI-only**: the `routeWindows`
data model (`graphs[].routeWindows: {[route_comp_id]: [{weekdays,start,end,color}, ...]}`) already
supports one `route_comp_id` mapping to an ARRAY of windows — `useGraphPublish.js`'s
`transformReportRoutes` already `.flatMap`s over that array, emitting one independently-labeled series
per entry (already exercised in production, e.g. AM+PM bars of a Bar Graph Summary). The gap is purely
that QuickControls' own `toggleRoute` (`QuickControls/index.jsx:122-143`) treats `routeIds` as a
DEDUPLICATED SET — clicking an already-assigned route REMOVES it rather than adding a 2nd instance —
and every write path always writes a single-element array, never appends
(`QuickControls/index.jsx:99-102`'s own comment: "this pill has no concept of a route with 2+
variants"). **No action planned.** Whenever picked up (v2), start at `toggleRoute`.

### Gap #16 / Facet 2's broader scope (NOT YET TRIAGED — next research step)

Confirmed (via grep) that `AddGraphModal.jsx` has **zero** references to Info Box or Route Compare
section types — the only way to create either today is `report_build.mjs`'s Python-side spec grammar
(`build_route_info_box_section_state`, `ensure_route_compare_template`) or the old Python converter.
Both types render correctly once built (live-verified elsewhere, e.g. `annual_average_study`'s
year-over-year Route Compare panel) — this is a pure authoring-surface absence, not a rendering bug.
Genuinely different in kind from items 1-9: new capability, not a gating/wiring fix.

`CalloutStatPicker` (Card's hero-stat picker) is a partial precedent — it DOES have a creation path (a
Settings-drawer menu item, `sectionMenuExtensions["Card"]`), just no header pill yet (that part is
Item 4's territory if ever built).

**Open questions for the next triage pass** (not yet answered):
- Does ANY JS-side (theme-layer) composition logic exist for Info Box/Route Compare at all, or would
  a JS equivalent of `useAddGraphSection.js`/`applyMeasurePickToState` need to be built from scratch,
  porting the shape from `convert_old_reports_lib`'s Python composition functions?
- What would a unified "Add Report Section" picker look like — one coherent UI covering AVL Graph
  variants + Info Box + Route Compare + Callout Stat, replacing/extending today's
  `AddGraphModal.jsx`, matching facet 2's "clean representation of types" spirit?

**Status: confirmed in scope 2026-08-19, not yet triaged at the code-level depth items 1-9 got.**
Next step is a dedicated deep-dive (same treatment Item 4 got) before this can be sequenced —
explicitly flagged to Ryan as the next thing to dig into.

---

## Testing / verification requirements (apply to every item above)

Per this project's standing convention (see `regression-testing-npmrds-reports.md`,
`traversing-report-pages.md`): **the golden-corpus batch check and a `traversing-report-pages.md`
update are mandatory on every RRL/report touch, not optional.** — **deviated from deliberately for
Tier 1/2 this pass, both by Ryan's own explicit direction**, logged here rather than silently
skipped:

- [x] Run `node scripts/npmrds-reports/probe_corpus.mjs` before starting (baseline) and after each
      Tier's changes land — **not run at all this pass.** Ryan's call, stated twice: first as "make
      a list of things you think might break, don't chase it down right now" (a reasoned regression-risk
      analysis was written into the Progress log instead of an actual run — see 2026-08-19 entries),
      then again after live-verifying everything himself ("don't worry about probe corpus"). No
      baseline exists for Tier 1/2's changes as of this write-up — the next session that touches RRL/
      QuickControls/report pages again should run a full `probe_corpus.mjs --capture` pass to establish
      one, since it's still missing.
- [x] Update `src/dms/skills/traversing-dms-pages.md` / `traversing-report-pages.md` in the same
      session if live verification surfaces anything they don't already say — **not updated this
      pass**: Ryan did the live verification himself directly (not via this session's own browser
      automation), so no new page-traversal facts surfaced on this end to record. If anything about
      the click-paths themselves (menu locations, DOM structure) turned out to differ from what those
      skills already say, that's still worth a follow-up update whenever next noticed.
- [x] Never live-test a multi-step click-path against a page the user might have open — use a
      dedicated scratch report (`converted_reports/claude_scratch_*`), delete after — **N/A this
      pass**: no browser-automation live-testing was done on this end at all; Ryan verified
      everything directly in his own editor/browser, including against real content (`page_25`,
      the actual `/reports` homepage) rather than a scratch page, which is his own call to make on
      his own session.
- [x] For any item touching `draft_sections`/`sections` directly (Items 3, 4), confirm via `dms raw
      get` after each live-verify step rather than trusting on-screen state alone — done for the 2B/2C
      data changes made directly this session (template row, `page_25`, `/reports` section add) via
      `dms raw get` before/after each; Ryan's own live-verification of Items 3/4's actual UI behavior
      was outside this session's own tooling, so not independently re-confirmed via `dms raw get` here.

## Progress log

- **2026-08-19**: Task kicked off from a co-worker meeting. 5 parallel research agents (core DMS
  edit/publish plumbing, RRL mutation-gating, QuickControls/composeMeasureConfig, Report Page
  Template + materialization, reports homepage + Report Header) plus a direct, code-verified
  deep-dive on Item 4 (superseding the agents' more pessimistic initial take) completed. Decisions
  locked: Item 9 deferred entirely, Item 3 ships with no safety net, facet 2 confirmed to include gap
  #16. Zero implementation started. This file created as the source of truth for the whole
  initiative; `traversing-dms-pages.md` updated same day with Item 4's durable generic finding.

- **2026-08-19 (same day, later)**: Tier 1 (1A/1B/1C) implemented per Ryan's "let's start on this" /
  "do Tier 1" instruction. All three code changes match the plan above exactly (see each item's
  checklist for specifics). Doc cleanup (README.md, useReportRow.js stale comments) bundled with 1B
  as planned. `theme.js` updated for `sectionHeaderExtensions` parity while at it.
  **Explicitly NOT done this session, per Ryan's own instruction** ("make a list of things you
  think might break [`probe_corpus.mjs`]... I don't want to chase things down right now"): no live
  browser verification of any of the three items, and `probe_corpus.mjs` was not run. In its place,
  a static regression-risk analysis of the golden corpus:

  **Regression-risk analysis (reasoned, not run) — `scripts/npmrds-reports/report_probe_fixtures/golden-corpus.json`**

  Checked the manifest directly: **all 8 entries have `authRequired: false`, and none target a
  `/edit/...` URL** — every corpus entry is a plain, anonymous, published-page load. This matters a
  lot for what Tier 1 can possibly disturb:

  - **1B (RRL `canMutate`) and 1C (QuickControls visibility/persistence) should show ZERO diff on
    this corpus.** Both changes only alter behavior when `editPageMode` is true (a page open at
    `/edit/...`) or (for 1C's outer gate) `canEditSection` is true (an authenticated author) — the
    corpus never exercises either state. RRL's own `!isEdit` view-mode return branch
    (`routeSelectionModal || <span class="dms-rail-collapsed">`) is untouched by my edit; the
    `canMutate` line only gates controls inside the `isEdit` branch, which the corpus never reaches.
    `QuickControlsRow` (where the new `editPageMode` check and the rewritten `applyPick` live) never
    even MOUNTS for an anonymous view-mode request, because `npmrdsQuickControls`'s outer
    `canEditSection` check (unchanged) still returns `null` first.
  - **The one genuinely new code path the corpus COULD exercise**: `theme.js`'s newly added
    `"Spreadsheet"`/`"Map"` `sectionHeaderExtensions` registrations mean `npmrdsQuickControls` now
    gets CALLED (not just skipped-over) on Spreadsheet/Map sections under `theme.js`, if any site
    the corpus's dev instance renders through still selects `theme.js` over `themev2.js` (unconfirmed
    — didn't check which theme the dev site's DB row actually points at). The function body up to
    its early return is simple, unchanged boolean logic, so this is low-risk, but it is new
    execution in view mode where there was none before.
  - **Most realistic actual failure mode**: a plain mistake in the edited files (typo, wrong import
    path, a `cloneDeep`/`PageContext` import that resolves wrong) throwing inside
    `npmrdsQuickControls` or `ReportRouteList.jsx` during a normal page render. Because
    `sectionHeaderExtensions` builders run inside a `try/catch` per section.jsx, this would surface
    as a **new console error logged for every corpus entry containing an AVL Graph/Spreadsheet/Map
    section** (i.e. most of the 8) rather than a visual/content diff — a "we broke the module" signal,
    not a "we broke the feature" signal. Worth checking for first if the suite is ever run.
  - **1A (`newPage()`)** can't be exercised by this corpus at all — it only runs when a NEW page is
    created from a template, and the corpus only ever loads pre-existing published pages.
  - **The real gap this surfaced**: the golden-corpus manifest has no `authRequired: true` entry and
    no `/edit/...` entry at all, so **it structurally cannot regression-test anything Tier 1 actually
    changes** (all three items are edit-mode/authoring-only by design). If Tier 1's behavior is meant
    to be covered by this suite going forward, the manifest needs at least one authenticated
    `/edit/<slug>` entry added — not done this session, flagging for whenever regression coverage of
    the authoring UX itself becomes a priority.

  **Update, later same session**: Ryan live-verified all three Tier 1 items himself — see the
  2026-08-19 entries below. `probe_corpus.mjs` was never run (Ryan's call, twice — see the Testing
  section above); the "expected clean, modulo the module-breakage risk" prediction above was never
  empirically checked against the golden corpus specifically, only against Ryan's own direct
  verification of the real authoring behavior.

- **2026-08-19 (same day, Tier 2)**: Ryan live-tested 1A by creating `converted_reports/page_25` from
  the Report Page template and found the sidebar still not compact — this surfaced 2C's own
  already-predicted gap (template row never had `theme` actually set) and got it fixed same-session
  (see 2C above for the full account, including a mid-fix mistake caught and corrected: an
  `dms section create` call without `--pattern npmrds_sub` briefly created a wrongly-typed
  `sandbox|component` row, deleted and redone correctly). With that resolved, moved on to the rest of
  Tier 2 per Ryan's "once you resolve that, move onto t2": 2A (Done-also-publishes) and 2D (Dynamic
  Report URL params in edit mode) implemented as coded; 2B (Create Report button) built as a new
  registered component AND added to the live `/reports` page's content as an unpublished draft
  section.

- **2026-08-19 (same day, wrap-up)**: Ryan live-verified all of Tier 1 and Tier 2 himself and
  confirmed "looks great" — every item above marked DONE + live-verified reflects this. He also
  moved the Create Report button (2B) to the top of `/reports` and published the page himself.
  Explicitly told this session not to worry about running `probe_corpus.mjs` — no golden-corpus
  baseline exists for any of Tier 1/2's changes as of this write-up (see the Testing section above
  for the full reasoning and what's still owed whenever that gets picked back up). **Tier 1 and Tier
  2 are both fully DONE.** Remaining open work in this file: Tier 3 (item 2's title/description
  auto-compose — needs a design decision from Ryan before implementing) and gap #16/facet 2's
  broader triage (still not started).

- **2026-08-19 (same day, Tier 4)**: Ryan raised three more threads after using Tier 1/2 himself
  (RRL toggle prominence + date-editing friction — wanted the toggle handled sooner; a suspicion
  about QuickControls/discard interaction; an open "any Dynamic Report UI gaps?" lower-priority
  question). Investigated all three directly against code (see Tier 4 above for 4A/4B/4C). For 4A,
  posed the two independent design questions to Ryan via `AskUserQuestion` rather than guessing:
  toggle → "move to a settings disclosure"; date editing → "auto-expand new routes, remove pencil/
  Save entirely, debounce however's needed." Implemented both same session in `ReportRouteList.jsx`/
  `RouteRow.jsx`/`ReportRouteList.theme.js`, then live-verified end-to-end via claude-in-chrome on a
  fresh scratch page created through the Create Report button (`converted_reports/page_27`) —
  single-add auto-expand, multi-add auto-expand (2 at once, independent of a 3rd already-expanded
  row), simultaneous multi-row date typing with zero cross-row bleed, the `shiftYear` combined-
  field atomic write, and a full Derived-mode round trip (pick → live preview → switch back to
  Fixed) all confirmed correct and persisting through a real reload, zero console errors at any
  checkpoint. Left the scratch page undeleted (CLI delete blocked by the auto-mode classifier as a
  destructive action) — flagged above for Ryan to remove if he wants it gone. **4A DONE.** 4B
  corrected Ryan's own hypothesis (QuickControls itself is clean; the real un-staged-write gap is
  RRL's own route mutations plus, newly found, `toggleDynamicReport`'s `item.filters` write — both
  already Item 9's territory, still deferred). 4C intentionally not re-triaged (lower priority per
  Ryan) — pointed at already-known gaps instead (gap #16, item 3A, `routeWindows` authoring).

- **2026-08-20 (Tier 5)**: Ryan raised five more items after using the shipped work himself — two
  new QuickControls controls (width, reorder), the still-unaddressed title-auto-populate gap
  (re-raised, same as Tier 3's 3A), no Map creation UI, Add-a-Table not supporting multiple
  measures, and difference-mode staying pickable on a card with the wrong route count. Triaged all
  five directly against the code before implementing anything (see Tier 5 above for each item's
  findings). 5A (width + reorder) built directly — both controls turned out to need zero new
  plumbing, since Item 4 (1C) already threads `actions.moveItem`/`actions.updateAttribute`/
  `sectionState.i` into QuickControls; also resolved Ryan's own stated worry that reordering
  might be coupled to route→graph mapping via section index — confirmed via grep that
  `useGraphPublish.js` has zero index-based route/graph coupling, routes are matched via
  `_measurePick.routeIds` only. Mid-implementation, Ryan corrected the layout twice (layout
  controls should be left-aligned against the right-aligned data pills; then, Width itself
  belongs in that same left group next to the arrows, not the right-aligned cluster) — both
  applied and re-verified live. Posed 5B/5E/5C-vs-5D-sequencing to Ryan via `AskUserQuestion`:
  5B got a clarifying question back (where would a pristine-title marker live — answered in
  conversation: `display.title.title`/`display.description` are the fields, per
  `graph_new/config.jsx`'s Settings-drawer control; no final decision made yet, still open); 5E
  picked "show but disable"; sequencing picked "Table now, Map later." Implemented 5E (QuickControls
  disables the Difference option below 2 routes via a real `disabled` button since these are plain
  buttons, not the shared `<Select>`; AddGraphModal gets a warning note instead, since `<Select>`
  has no per-option disable and didn't seem worth a `dms`-core change for one call site) and 5D
  (Table multi-measure — a new `composeTableMeasuresConfig` compose function, a multi-select
  checklist in both AddGraphModal and QuickControls' Measure pill, and a real `vocabulary.json`
  bug this surfaced and got fixed: `travelTime`'s SQL expression was missing `ds.` table-alias
  qualification that every other measure already has, which only broke once a multi-measure query
  existed to make the bare identifiers ambiguous — root-caused against the Python converter's own
  already-correct copy of the same expression). Both live-verified via claude-in-chrome on the
  existing scratch page (`converted_reports/page_27`), including a real 3-measure table with mixed
  join requirements rendering correct distinct values per column and surviving a reload. One
  unconfirmed-but-flagged item left for later: whether combining a CO2 sum/avg pair (which share
  one SQL alias by design) in one table collides — not verified either way, deliberately not
  patched blind. 5C (Map) deliberately not started this session per Ryan's own sequencing choice.

- **2026-08-20 (Tier 5F/5G — same day, continued)**: two more rounds of live feedback from Ryan
  after using the Tier 5 work himself, both handled the same session (see 5F/5G above for full
  writeups). 5F: seven findings in one message (Add Route modal's tag browser buried below the
  route list; Table column precision; "one bar per route" wording on a Table; measures/resolution
  spacing; and the big one — a real Table+Summary+multi-route bug, root-caused via
  `dms-server.log` rather than guessed, that turned out to be the EXACT INVERSE of the join
  qualification fixed a few hours earlier in the same session — my own fix had silently broken the
  no-join case the whole time it fixed the join case, precisely the "replacing one bug with
  another" risk Ryan named up front when asking for this work). Real fix: reverted the shared
  vocabulary string to its universally-correct no-join form, added a narrow context-aware override
  scoped ONLY to the Table compose path for the one case that needs qualification. 5G: Ryan
  reported the fix still didn't hold with multiple routes — found a SECOND, different bug in the
  same family (inner SQL alias collisions between distinct measures, not the join/no-join duality)
  affecting `speed`/`speedTruck` and all four CO2 sum/avg variants; verified safe to fix via a
  dedicated research trace of the full ClickHouse-response-to-column pipeline before touching
  anything, then fixed directly and permanently in `vocabulary.json` (no context-dependent
  duality this time — alias uniqueness is unconditionally correct). Also corrected two stale
  "do not hand-edit, regenerate from Python" notes (`vocabulary.json`'s own `_provenance` field and
  `MeasurePicker/README.md`'s "Regenerating/verifying" section) that both described a data flow
  that no longer exists — Python now reads FROM this JSON, not the other way around — and would
  have told a future editor the wrong thing at exactly the moment they needed the right one.
  One final round: Ryan reported the alias fix "does NOT work" with multiple routes; investigated
  via the server log rather than re-guessing, found it was the SAME "stale pre-fix section doesn't
  self-heal" pattern the session had already hit twice, and confirmed empirically (a genuinely
  fresh 2-route Speed+TruckSpeed table via Add Graph, zero error) that Add Graph and QuickControls
  compose through the identical shared code — no divergence between them exists. Reported back
  with the concrete evidence; Ryan confirmed satisfied.

  **Docs updated same session, per standing instruction to keep this current rather than after the
  fact**: `src/dms/skills/traversing-report-pages.md` (QuickControls' new left-aligned layout
  group + Table's multi-select Measure pill + Difference-mode disabling; the Add Route modal's
  tag-browser reorder; a new, generalized "stale composed columns don't self-heal" bullet — the
  single most time-costly lesson of this whole session, now written down once instead of
  re-discovered per bug; a new §6 table row pointing at `dms-server.log` for real ClickHouse error
  text; Table promoted from "3 things a Spreadsheet can be" to "4"). `MeasurePicker/README.md`
  (the same stale regeneration note fixed there too; documented the new alias-uniqueness
  constraint; documented `composeTableMeasuresConfig`/`composeAutoTitle`/`isTitleDirty`/
  `resolutionOptionsFor` as composition-layer additions living in the JS file, not the JSON).
