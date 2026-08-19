# Report Authoring UX Overhaul

**Project:** TransportNY · **Topic:** themes · **Status:** Tier 1 (1A/1B/1C) + Tier 2 (2A/2B/2C/2D) all code-complete 2026-08-19; live-verification and `probe_corpus.mjs` run still pending for all of them; Tier 3 NOT STARTED; gap #16/facet 2 NOT YET TRIAGED · **Started:** 2026-08-19

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

### 1A. `newPage()` core patch — unlocks Item 5's persistence half + Item 6's redirect

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
- [ ] Live-verify: create a page from ANY template (not just Report Page) in a scratch pattern, confirm redirect + theme inheritance both work, confirm no regression to existing "+Add Page" flow elsewhere in the site — NOT DONE this session

---

### 1B. Item 3 — RRL: no view mode, unconditional edit-mode functionality

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
- [ ] Live-verify on a scratch report page: every control in the table above now works immediately on `/edit/<slug>` with zero RRL-pencil click; confirm removing a route still only requires one click (expected, per decision above) — NOT DONE this session
- [ ] Run `probe_corpus.mjs` full suite after, per `regression-testing-npmrds-reports.md` — deliberately SKIPPED this session per Ryan's explicit ask ("make a list of things you think might break... I don't want to chase things down right now"); see regression-risk analysis appended to Progress log below instead

---

### 1C. Item 4 — Section-header pills: live whenever the PAGE is in edit mode

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
- [ ] Live-verify on a scratch report page: change Measure/Resolution/When/Aggregate/Mode pills on a graph WITHOUT clicking that section's own pencil, confirm the chart updates AND the change survives a reload — NOT DONE this session
- [ ] Confirm a real end-user viewing the published (non-`/edit/`) page never sees pills, and a logged-in author browsing the real published site (not `/edit/...`) also never sees them — NOT DONE this session
- [x] Update `theme.js`'s registration too — 2026-08-19, added `"Spreadsheet"`/`"Map"` to its `sectionHeaderExtensions` map for parity with `themev2.js` (didn't confirm which theme any live/dev site actually selects — applied defensively since it's a strict no-op if unused)
- [ ] Run `probe_corpus.mjs` full suite after — deliberately SKIPPED this session, see regression-risk analysis below

---

## Tier 2 — small, mostly self-contained

### 2A. Item 8 — Report Header "Done" also publishes — CODE DONE 2026-08-19

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
- [ ] Live-verify: make a draft change, click Done, confirm the published page reflects it immediately (no separate manual Publish click needed) — NOT DONE this session

---

### 2B. Item 6 — "Create Report" button on the `/reports` homepage — code + content DONE 2026-08-19, not yet published

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
- [ ] Live-verify: click Create Report, confirm redirect into `/edit/<new-slug>` with the Report Page template's sections present — NOT DONE this session (button is now live and positioned, but the actual click-through hasn't been exercised/confirmed yet)

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
- [ ] Live-verify: create a NEW page from the template, confirm (a) no starter graph, (b) sidebar renders compact from the moment the page is created, with no manual per-page fix needed — NOT DONE this session (page_25 was created BEFORE these fixes landed, so it doesn't count as this verification; a fresh page from the now-fixed template still needs a live check)
- [ ] Optional/separate: live-repro the Card-materialization mystery if picked up (not required for this item's two asks)

---

### 2D. Item 7 — Dynamic Report URL params resolve in edit mode too — CODE DONE 2026-08-19

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
- [ ] Live-verify: open a Dynamic Report at `/edit/<slug>?routes=<id>|||<id>&asOf=YYYY-MM-DD`, confirm it previews as if those were live, AND confirm reloading the plain `/edit/<slug>` (no params) still shows raw unresolved slots as before — NOT DONE this session
- [ ] Confirm nothing got written to `draft_sections`/`reports_snap_2` from a preview-only edit-mode visit (cross-check via `dms raw get` before/after) — NOT DONE this session

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
update are mandatory on every RRL/report touch, not optional.**

- [ ] Run `node scripts/npmrds-reports/probe_corpus.mjs` before starting (baseline) and after each
      Tier's changes land
- [ ] Update `src/dms/skills/traversing-dms-pages.md` / `traversing-report-pages.md` in the same
      session if live verification surfaces anything they don't already say
- [ ] Never live-test a multi-step click-path against a page the user might have open — use a
      dedicated scratch report (`converted_reports/claude_scratch_*`), delete after
- [ ] For any item touching `draft_sections`/`sections` directly (Items 3, 4), confirm via `dms raw
      get` after each live-verify step rather than trusting on-screen state alone

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

  **Next, not done this session**: live-verify all three Tier 1 items on a scratch report page, then
  actually run `probe_corpus.mjs` for an empirical baseline (expected: clean, per the analysis above,
  modulo the "we broke the module" risk).

- **2026-08-19 (same day, Tier 2)**: Ryan live-tested 1A by creating `converted_reports/page_25` from
  the Report Page template and found the sidebar still not compact — this surfaced 2C's own
  already-predicted gap (template row never had `theme` actually set) and got it fixed same-session
  (see 2C above for the full account, including a mid-fix mistake caught and corrected: an
  `dms section create` call without `--pattern npmrds_sub` briefly created a wrongly-typed
  `sandbox|component` row, deleted and redone correctly). With that resolved, moved on to the rest of
  Tier 2 per Ryan's "once you resolve that, move onto t2": 2A (Done-also-publishes) and 2D (Dynamic
  Report URL params in edit mode) implemented as coded; 2B (Create Report button) built as a new
  registered component AND added to the live `/reports` page's content as an unpublished draft
  section. All of Tier 2 is code-complete but **none of it has been live-verified in a browser yet**,
  and `probe_corpus.mjs` has still not been run this whole session — both remain outstanding across
  all of Tier 1 and Tier 2 as the next work.
