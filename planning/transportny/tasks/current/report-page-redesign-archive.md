# Report page redesign — archive

**Project:** TransportNY

Read-only historical detail for the three report-page-redesign gaps. Current status lives in
[`report-page-redesign.md`](./report-page-redesign.md) — this file exists only so the full
code-tracing, file-change tables, and live-verification walkthroughs aren't lost, without keeping
the live doc long. Nothing here is current; where this archive and the live doc appear to
disagree, the live doc wins (see its "Note on a drift this merge fixes" for one case where the
original files disagreed with themselves).

Merged into this archive 2026-07-30 from three separate task files, verbatim except for this
heading structure: `planning/tasks/completed/avl-graph-quick-controls.md`,
`planning/transportny/tasks/current/report-route-color-assignment.md`,
`planning/tasks/current/report-card-visual-density-polish.md`.

---

## Gap 01 — AVL Graph quick controls (originally `tasks/completed/avl-graph-quick-controls.md`)

### Status: DONE. Scoped 2026-07-21, code complete and fully live-verified 2026-07-22 (Proposed
changes items 1-4 + entire Testing checklist, including both items originally deferred as
code-review-only — non-report AVL Graph gating and two-card independence — since separately
confirmed live by the user on real report pages). See "Testing checklist" and "Live-verification
notes" for detail. One unrelated pre-existing bug was flagged during this task's live-verification
pass (item 2 in "Live-verification notes" below) and, at the time, believed confirmed — **it was
investigated further the same day and retracted; see `report-page-redesign.md`'s Gap 01 section for
the correction. Treat the claim below as historical, not current.**

### Origin

Follow-up to `research/report-page-redesign/findings.md`'s Gap 01 ("Inline quick controls vs.
Settings drawer" — the highest-confidence gap in the old-tool-vs-new-tool audit). The user reviewed
a design-audit artifact showing three placement variants mocked directly onto real screenshot pixels
of the `tappan_zee_cashless_toll_version_2` report's "Route Bar Graph, Speed" card, picked **Variant
A — a new row inserted directly under the title, inside the header band** — and asked to fully scope
it out. This file is that scope. See findings.md and the artifact for the visual reference; this
file is the implementation plan, not a re-derivation of the visual rationale.

### Objective

Let an author toggle a graph section's **Measure** and **Comparison Mode** — today only reachable
via Settings → AVL Graph Settings → Measure (3-4 clicks, per `findings.md` Gap 01) — from **one or
two clicks directly in the card's own header**, without opening the Settings drawer at all. Must
reuse the exact same underlying state and vocabulary as the already-shipped Measure Picker
(`src/themes/transportny/components/MeasurePicker/`) — this is a new entry point onto the same
brain, not a parallel config system.

### Scope

#### In scope (this round)
1. Register a new theme-side header extension (via the library primitive shipped in
   `section-header-extensions.md` — **DONE 2026-07-22, this prerequisite has shipped**; see that
   task file's "Design deviation found during implementation" note before building against it — the
   extension row renders independent of the section's own title/`showHeader`, which matters for AVL
   Graph's empty-title "header + hero-stat" pattern) for the `"AVL Graph"` component, gated by the
   same `isReportPage` check `npmrdsMeasureMenu` already uses.
2. Two pill controls in the new header row:
   - **Measure** — shows the current measure's label (e.g. "Speed (mph)"). Click opens a small
     anchored menu with the same measure options `MeasurePicker`'s Measure select already offers;
     picking one applies identically to picking it in the drawer.
   - **Comparison Mode** — shows "Plain" or "Difference". Click **directly toggles** between the
     two (no submenu — there are only ever two values, so a click-to-flip is simpler than a menu
     and matches the old tool's actual one-click "Main/Compare" button behavior).
3. Refactor `MeasurePicker/index.js` to extract its apply logic (the `dwAPI.setState(...)` +
   `dwAPI.reconcileComparisonSeriesColumn()` sequence, currently inline in the drawer's `onClick`
   handlers) into a shared function both the drawer item-group and the new quick-controls component
   call — single source of truth, per "Non-obvious risk" below.
4. Visual style matching the real product chrome exactly (pill background/border/text sampled
   directly from the live Settings-drawer's own value badges — see "Visual spec").

#### Explicitly out of scope this round
- **Graph Type and Resolution** — not exposed as quick controls. The audit's Variant A mockup only
  showed Measure + Comparison Mode; Graph Type changes a section's whole shape (not a quick toggle)
  and Resolution is lower-frequency. Add later if the user asks, following the same pattern.
- **Variant B (inline with the title, old-tool-style) and Variant C (segmented control +  boolean
  toggle chip)** — both were shown in the audit artifact but not picked. Same underlying header-
  extension mechanism would support either later; don't build them speculatively.
- **Applying this to any card type other than `"AVL Graph"`** — no other card type was discussed.
- **Route/graph color assignment and card visual/density polish** — Gaps 02/03 from the audit;
  separate, unscoped, lower-confidence items per `findings.md`. Not touched here.

### Architecture decision: library vs. theme boundary

Same boundary the Measure Picker itself already established (see
`src/dms/planning/tasks/completed/report-graph-vocabulary-picker.md`, "Architecture decision"
section) — confirmed as the right precedent to repeat rather than re-litigate:

- **Library-side (`src/dms/`), small and generic**: the header-extension registration/render
  mechanism itself. Shipped as its own task,
  `section-header-extensions.md`
  (DONE 2026-07-22) — unlike `sectionMenuExtensions`, which already existed when Measure Picker was
  built, this primitive didn't exist before this pair of tasks. Genuinely reusable: any theme could
  register header content for any component type.
- **Theme-side (`src/themes/transportny/`), the actual bulk of the work**: the NPMRDS-specific
  pills, reusing the existing Measure/Comparison Mode vocabulary and state-writing logic.

### Current state (confirmed by direct code reading, 2026-07-21)

**Measure Picker mechanism** (the precedent this reuses almost entirely) —
`src/themes/transportny/components/MeasurePicker/`:

- `index.js` exports `npmrdsMeasureMenu({state, dwAPI, currentComponent, isEdit, canEditSection,
  siblingSections})`, gated on `isEdit && canEditSection && currentComponent?.useDataSource &&
  isReportPage` (line 199) — `isReportPage` (line 81) checks `siblingSections` for a
  `ReportRouteList` sibling.
- Renders 4 nested-select item-groups (Graph Type/Measure/Resolution/Comparison Mode) via a local
  `selectItem()` helper (lines 58-71).
- Reads current pick from `state?.display?._measurePick` (bookkeeping only, line 74 — never read by
  the render/query pipeline, per the file's own comment).
- Writes changes via **one `dwAPI.setState(draft => {...})` call** (lines 101-172):
  `draft.columns` (replacing only `xAxis`/`yAxis`/`color`-targeted entries, never `categorize` —
  `MANAGED_TARGETS`, line 46), `draft.join`, `draft.display.graphType/fetchMode/xAxis/yAxis/colors`,
  and — the key one for this task — `draft.comparisonSeries.combine` (lines 138-142): set to
  `composed.comparisonSeriesCombine` (`{mode:'difference'}`) or deleted for "Plain". Followed by a
  separate imperative `dwAPI.reconcileComparisonSeriesColumn()` call (line 181).
- `COMPARISON_MODE_OPTIONS` (`composeMeasureConfig.js:54-57`): `[{value:'plain',label:'Plain'},
  {value:'difference',label:'Difference'}]` — this is the exact vocabulary behind the "Plain"/
  "Difference" pill.
- `composeMeasureConfig({graphType, measureKey, resolutionKey, comparisonModeKey,
  externalSourceColumns, defaultColors})` (pure, no React) returns `{columns, join,
  comparisonSeriesCombine, displayPatch}` — this is the composition math both the drawer and the
  new quick controls must call identically.

**Where `comparisonSeries.combine` actually matters** —
`buildUdaConfig.js:1615-1616`: `if (comparisonSeries.combine && typeof comparisonSeries.combine ===
"object") { options.seriesCombine = comparisonSeries.combine; }` — this changes the server-side
fan-out query, not a client-only visual toggle, so the toggle must go through the same
`dwAPI.setState`/`reconcileComparisonSeriesColumn` path as the drawer, not a shortcut.

**`display.graphType`/`display.colors`** are read directly by the chart component with no
indirection (`ui/components/graph_new/index.jsx:77`, `const {columns, data, display} =
state`) — any quick-control write to `display` takes effect immediately on next render.

**dwAPI** (`useDataWrapperAPI.js`) exposes `setState` (raw immer updater — what Measure Picker
uses for everything), `setDisplay(key, value)`, `setComparisonSeries(value)` (full-object replace),
`reconcileComparisonSeriesColumn()`, and read-only `config`/`runtime` getters. No pub-sub — plain
React re-render.

**Open visual question — RESOLVED (mechanism), one detail still open, 2026-07-22**: the gray
head-band is **not** part of the AVL Graph section's own chrome (`section.jsx`/`section.theme.jsx`
and the graph component itself are clean — no `bg-slate`/`bg-gray` on any header/title wrapper,
confirmed by full read). It comes from a **different, adjacent Card section** stacked above the
graph (the "header + hero-stat" pattern) — specifically the `dataCard` theme's `"title_bar"` named
style in `src/themes/transportny/themev2.js:1150-1154`:
```js
header: "h-11 px-3 flex items-center gap-2 border-b border-zinc-950/10 bg-slate-50/60 font-display font-medium text-[14px] text-[#2D3E4C]",
```
`bg-slate-50/60` on a fixed `h-11` row with `border-b` is the band. Render chain: `Card.jsx:563`
(header div uses `theme.header`) ← `Card.jsx:878` (`getComponentTheme(..., 'dataCard', activeStyle)`)
← `ComponentRegistry/Card.jsx:170` (`activeStyle = state.display?.cardStyle || activeStyle`) ←
author-facing "Card style" select, `ComponentRegistry/Card.config.jsx:469`.

**Still unconfirmed**: whether `tappan_zee_cashless_toll_version_2`'s actual title Card has
`display.cardStyle === "title_bar"` specifically, vs. `"context"` (themev2.js:1184-1189, also
`bg-slate-50/60` but tinting the whole card body via `subWrapperCompactView`, not a discrete
title strip — `"title_bar"` is the better visual match but not yet verified against that live page).
Check via `dms page show`/`dms raw get` on that section, or devtools, before finalizing
`headerExtensionsRow` styling to match. Since the head-band turned out to belong to a sibling Card
section rather than the AVL Graph section's own header row, **the new `headerExtensionsRow` (this
task's own new row, inside the AVL Graph section) does not need to visually match the head-band at
all** — they're different rows on different sections. Revisit the visual spec in item 5 below once
this is confirmed; it may not need the head-band's background at all.

### Non-obvious risk to design around

Measure Picker's apply logic (the full `setState` + `reconcile` sequence) currently lives inline in
`MeasurePicker/index.js`'s nested-select `onClick` handlers. If the new quick-controls component
reimplements this from scratch instead of calling the same function, the two entry points will
silently drift the first time either one is edited (e.g. someone adds a new field to the compose
patch and only updates one call site) — exactly the kind of duplication the vocabulary-JSON
extraction in the parent task (`report-graph-vocabulary-picker.md`) was built to eliminate. **Do
the extraction (see Proposed changes, item 2) before writing the quick-controls component**, not
after — it's a small refactor now and a much messier one once two call sites exist independently.

### Proposed changes

1. **Prerequisite — DONE**: `section-header-extensions.md`
   shipped 2026-07-22. Its `getSectionHeaderExtensions`/`registerSectionHeaderExtensions` registry,
   `siteConfig.jsx` auto-registration, and `section.jsx` render wiring are live; register
   `sectionHeaderExtensions: { "AVL Graph": [...] }` in the theme exactly like `sectionMenuExtensions`
   already is.

2. **DONE 2026-07-22 — Refactor `MeasurePicker/index.js`**: extracted the apply sequence into an
   exported `applyMeasurePick({state, dwAPI, currentComponent}, partial)` (`composeMeasureConfig`
   call → `dwAPI.setState(...)` → `dwAPI.reconcileComparisonSeriesColumn()`, byte-identical to what
   was inline before). `npmrdsMeasureMenu`'s own drawer `onClick` handlers now call this instead of
   duplicating it. Also extracted `isReportPage(siblingSections)` as its own exported function
   (previously a local const inside `npmrdsMeasureMenu`) so `QuickControls` reuses the exact same
   gating condition.

3. **DONE 2026-07-22 — New file** `src/themes/transportny/components/QuickControls/index.jsx`
   (`.jsx`, not `.js` — it renders real JSX, unlike `MeasurePicker/index.js`), exporting
   `npmrdsQuickControls` matching the `sectionHeaderExtensions` contract, plus a sibling
   `QuickControls.theme.js` (flat key map, mirrors the `ReportRouteList.theme.js` precedent) for
   pill styling. Actual shape:
   ```js
   export function npmrdsQuickControls({state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = []}) {
     if (!(isEdit && canEditSection && currentComponent?.useDataSource && isReportPage(siblingSections))) return null;
     return <QuickControlsRow state={state} dwAPI={dwAPI} currentComponent={currentComponent} />;
   }
   ```
   `QuickControlsRow` (a real named function component, so `useContext(ThemeContext)` obeys hooks
   rules — `npmrdsQuickControls` itself is a plain gating function, not a component) reads
   `UI.NavigableMenu`/`UI.Button` from `ThemeContext` and renders:
   - **Measure pill**: `<NavigableMenu config={measureMenuConfig} showTitle={false}>` with a
     `<Button>` custom trigger (children prop) styled as the pill — `measureMenuConfig` is a flat
     (unnested, unlike `MeasurePicker`'s nested-select item-groups) list of just the Measure options,
     each item's `onClick` calling `applyMeasurePick({state, dwAPI, currentComponent}, {measure: opt.value})`.
   - **Comparison Mode pill**: plain `<Button>`, no menu, `onClick` directly calls `applyMeasurePick`
     with the flipped value (`plain` ↔ `difference`).
   - Menu-item click does not auto-close the `NavigableMenu` popup (no `onClickGoBack`/explicit
     `close()` call) — confirmed as the existing codebase convention (`LayerPanel.jsx`'s
     `LayerMenu`'s plain-`onClick` items behave the same way); closes on outside-click instead, via
     `Popup`'s default `preventCloseOnClickOutside=false`.

4. **DONE 2026-07-22 — Registered** in both `src/themes/transportny/themev2.js` (the active theme
   file) and `theme.js`, alongside the existing `sectionMenuExtensions` entry:
   ```js
   sectionHeaderExtensions: { "AVL Graph": [npmrdsQuickControls] },
   ```
   Also set `pages.section.styles[0].headerExtensionsRow: "px-3 pb-2"` in both files (layout only —
   padding so the pill row doesn't sit flush against the section edges — **no background**, per the
   resolved head-band finding above: that background belongs to a different, sibling Card section,
   not this row).

5. **Visual spec — DONE 2026-07-22, not yet live-confirmed**: pill background `#f1f5f9`, pill
   border `#e2e8f0`, pill text `#3a4a5e` (approximate Tailwind slate-100/200/600), hover
   `hover:bg-[#e2e8f0]` (one slate step darker — not sampled from any screenshot since neither
   reference tool's hover state was captured). Implemented in `QuickControls.theme.js`. The
   **head-band background item dropped from this spec** — see the resolved "Open visual question"
   above: that background belongs to a different, sibling Card section's `"title_bar"` style, not
   this row, so there was nothing to match here after all.

### Files requiring changes — all DONE 2026-07-22, not yet live-verified

| File | Change |
|---|---|
| `src/themes/transportny/components/MeasurePicker/index.js` | Extracted `applyMeasurePick({state, dwAPI, currentComponent}, partial)` and `isReportPage(siblingSections)` as exports; drawer `onClick` handlers call `applyMeasurePick` instead of inlining |
| `src/themes/transportny/components/QuickControls/index.jsx` (new) | `npmrdsQuickControls` builder (gating, plain function) + `QuickControlsRow` (the actual component, reads `ThemeContext`, renders the two pills) |
| `src/themes/transportny/components/QuickControls/QuickControls.theme.js` (new) | Flat theme key map (`wrapper`, `pill`) — mirrors the `ReportRouteList.theme.js` pattern; pill UI inlined in `index.jsx` rather than split into separate `MeasurePill`/`ComparisonModePill` files (small enough not to warrant the split) |
| `src/themes/transportny/theme.js`, `themev2.js` | Registered `npmrdsQuickControls` under `sectionHeaderExtensions: {"AVL Graph": [...]}`, alongside the existing `sectionMenuExtensions` entry |
| `src/themes/transportny/theme.js`, `themev2.js` (theme styling) | `pages.section.styles[0].headerExtensionsRow: "px-3 pb-2"` — layout padding only, no background (see resolved head-band finding, item 4 above) |

(Depends on the library-side files listed in `section-header-extensions.md`'s own table — not
repeated here.)

**Not yet done**: live verification (see Testing checklist below) — no dev-server/Playwright check
has been run against this code yet, and the DOM confirmation of which `cardStyle` the
`tappan_zee_cashless_toll_version_2`'s actual title Card uses (still open, see above) hasn't been
done either.

### Testing checklist

- [x] ~~Live devtools check on a real AVL Graph card confirms which DOM node produces the head-band
      background~~ — resolved 2026-07-22 by direct code reading (not live devtools): it's a sibling
      Card section's `"title_bar"` style, not this task's own row, so `headerExtensionsRow` doesn't
      need to match it (see resolved "Open visual question" above). Still open, lower priority:
      confirming which `cardStyle` `tappan_zee_cashless_toll_version_2`'s actual title Card uses.
- [x] **Live-verified 2026-07-22** on the existing scratch page `claude_scratch_measure_picker`
      (id 2195034, per `feedback_use_own_scratch_page_for_ui_testing`) via
      `node scripts/npmrds-reports/report_probe.mjs edit/claude_scratch_measure_picker --auth --eval <probe>`.
      The pill row appears once the AVL Graph section is switched into `SectionEdit` mode
      (`isEdit` true) — same `isReportPage` gate as Measure Picker, confirmed via a temporary
      diagnostic log (removed after use) showing `isEdit`/`canEditSection`/`useDataSource`/
      `isReportPage` all evaluating correctly. **User-verified 2026-07-22**: checked a real
      non-report AVL Graph section (no `ReportRouteList` sibling) and confirmed the pills do NOT
      appear there — gate correctly excludes it.
- [x] Measure pill shows the correct current measure label on load — "Speed (mph)" (this section's
      actual measure, read via `DEFAULT_PICK` fallback since `_measurePick` was never set on this
      section) matched exactly.
- [x] Clicking the Measure pill opens the same 9-option list as the Settings drawer's Measure
      select (verified via screenshot — full vocabulary list shown, current selection checked).
      Picking "Travel Time (min)" updated the pill label AND the drawer's own "Measure" summary
      line simultaneously (`Travel Time (min) · 5 Minutes · Plain`) — confirms both entry points
      read the identical `state.display._measurePick`, proving the `applyMeasurePick` extraction
      didn't fork behavior between the two call sites.
- [x] Comparison Mode pill shows "Plain"/"Difference" correctly and toggling it updates both the
      pill and the drawer's Measure summary simultaneously (screenshot-confirmed:
      `Travel Time (min) · 5 Minutes · Difference`). **Not separately confirmed via network tab**
      that `seriesCombine` changed server-side — inferred from the shared-function argument (same
      `applyMeasurePick` write path Measure Picker's drawer already uses), not independently
      re-verified over the wire this round.
- [x] **User-verified 2026-07-22**: used the Measure pill on 2 different AVL Graph sections within
      the same real report — independent pill state confirmed, no shared/stale reference across
      sections.
- [x] Refactored `MeasurePicker` drawer item-group still works identically post-refactor — the
      drawer's "Measure" item-group (screenshot-confirmed both before and after each pill
      interaction) continued showing correct, live-updating values throughout; no regression.
- [x] Live-verified with the Playwright probe harness (`--eval` scripts under
      `scratchpad/npmrds-sub/tmp/qc_*.mjs`, per `reference_report_probe_harness`) — see
      "Live-verification notes" below for the interaction sequence and one real, pre-existing bug
      found along the way (unrelated to this task).

### Live-verification notes (2026-07-22)

Getting to a state where the pills were even reachable took real digging — worth recording so a
future session doesn't have to re-discover this:

1. **The `/edit/<slug>` route does not put sections into `SectionEdit` by default.** Sections
   render as `SectionView` (with `editPageMode=true`, but the component-local `isEdit` is hardcoded
   `false` there — see `section.jsx`) until a specific section is switched into `SectionEdit` via
   `sectionArray.jsx`'s per-section `edit.index === i` state, toggled by clicking an "Edit" pencil
   pill *inside that section's own Settings popup*. This is why `npmrdsQuickControls` (and the
   pre-existing Measure Picker drawer item) render nothing on first page load — `isEdit` is false
   until that click happens, exactly as designed; nothing was wrong with the gate.
2. **Found along the way, believed at the time to be a real, separate bug — later retracted the
   same day, see `report-page-redesign.md`'s Gap 01 section**: a claim was made here that the
   View-mode section's Settings trigger button (`NavigableMenu`'s default icon button,
   `btnVisibleOnGroupHover=true` in `SectionView`) is unconditionally `display:none` at any desktop
   viewport width (≥640px), based on a `getComputedStyle` check on two pages. The user pushed back
   the same day with the correct product model (view-mode pages shouldn't show the trigger at all;
   edit-mode pages should show it on hover, and the user directly observed that working) — re-reading
   the theme code found no `sm:hidden` baked into the actual `buttonHidden` class, and a valid
   `.group` ancestor does exist, so `group-hover:flex` should decisively win on real hover regardless
   of viewport. Most likely explanation for the original false positive: the computed-style check
   didn't genuinely trigger a real `:hover` event, or checked a second section's trigger while a
   different section already held edit focus (intentionally disallowed, and would also present as
   the trigger not appearing). **Don't cite this as a known bug**; if it resurfaces, verify with a
   real hover event before concluding anything.
3. Once in `SectionEdit` mode, the pills and the drawer both worked exactly as designed — no bugs
   found in this task's own code.

---

## Gap 02 — Report route color assignment (originally `tasks/current/report-route-color-assignment.md`)

### Status: IMPLEMENTED, live-verified 2026-07-22 (theme side). Scoped 2026-07-22, plan finalized
2026-07-22, built + verified same day.

**Cross-repo note:** `ReportRouteList` (the component this task edits) is manually
duplicated into transportNY with no sync mechanism — see
`research/npmrds-reports/reportroutelist-cross-repo-sync.md`.
Any change here must be manually ported there too if it needs to be user-testable
(transportNY is the only place the routecreation-tool end-to-end flow can run).

All 4 theme-side files done (schema/auto-assign, picker UI, publish wiring). Live-verified against
the pre-existing scratch page `claude_scratch_measure_picker` (id 2195034): color picker renders,
persists through `updateRoute` → `apiUpdate`, survives a full reload (dot + picker both show the
persisted color), and the identity dot renders in the collapsed row.

**A real bug was caught during live verification (by the user, not by me) and fixed same round**:
passing the inline `onChangeColor={(c) => updateRoute(...)}` callback straight through to the
library's `UI.ColorPicker` caused an infinite render loop — `Colorpicker.jsx`'s internal effect has
`onChange` itself in its dependency array (`useEffect(..., [selfColor, onChange])`), so a
freshly-identitied callback on every parent render re-fires `onChange` every render, which calls
`updateRoute`, which re-renders, which creates a new callback — unbounded. The user caught this via
their own DevTools Network tab (a request storm) while trying to verify the color-on-graph
rendering; I had missed it because my own automated verification only checked for JS errors/console
output, never actual request volume over time. Fixed in `RouteRow.jsx` by routing the callback
through a ref (`onChangeColorRef`) so the function identity handed to `ColorPicker` never changes
across renders, while always invoking the latest `onChangeColor` — confirmed live afterward: exactly
one POST per real color pick, zero requests at idle, persists correctly across reload. The two
pre-existing callers of `UI.ColorPicker` (`colorPickerComp.jsx`, `ColorControls.jsx`) never hit this
because they happen to pass a `useState` setter, which React guarantees is referentially stable —
this component was the first caller to pass a non-stable callback. Not fixed in the shared
`Colorpicker.jsx` itself (out of scope, unclear blast radius on other future callers); worth flagging
if `ColorPicker` gets a third consumer.

**Full end-to-end loop confirmed live 2026-07-22, after two more real bugs were found and fixed in
the same session:**

1. **The blank-graph scratch page was actually just "no routes assigned"** — once real routes were
   assigned to Graph 1 (by the user, testing independently), the LineGraph rendered real data
   immediately. Not a bug at all — the earlier "blank graph" note above was a false lead.
2. **Second bug, found by the user**: the ColorPicker's saturation/value gradient square rendered as
   a single flat color instead of the classic hue/saturation gradient — clicking around it DID
   change the underlying color value correctly, just with no visual feedback about where in the
   gradient you were clicking. Root cause: `ui/components/Colorpicker.jsx`'s
   `bg-[linear-gradient(...),_linear-gradient(...)]` Tailwind arbitrary-value utility silently
   compiled to `background-image: none` under this project's Tailwind v4 setup (confirmed via
   `getComputedStyle` in the live page) — a dormant bug, since both pre-existing callers of
   `ColorPicker` (`colorPickerComp.jsx`, `ColorControls.jsx`) pass `showColorPicker={false}` and so
   never actually render this gradient panel in production. `RouteRow.jsx`'s picker (`showColorPicker
   ={true}`) was the first real exercise of this code path. **Fixed** in `Colorpicker.jsx`: moved the
   two-layer gradient into an inline `backgroundImage` style (alongside the existing inline
   `backgroundColor` for hue) at both call sites (`ColorPicker` and `ColorPickerFlat`), removed the
   dead Tailwind class fragment. Rebuilt dist, confirmed live: gradient now renders correctly.
   (Note added later: the "rebuilt dist" step here was actually irrelevant — see Gap 03's
   "dist-rebuild dead end" below — but the source fix itself was real and correct.)
3. With the gradient fixed, a genuinely vibrant, visually-distinct color was picked and **confirmed
   live end-to-end**: the route's line color and legend swatch on the real chart updated to match,
   in real time, as the color was changed via the picker. Full loop proven.

**A third, separate, pre-existing bug was also found (by the user) and confirmed live — NOT part of
this task, not fixed here**: two routes sharing the identical `name`, both assigned to the same
graph, collapse into a single line/legend entry instead of two. Root cause (confirmed by
deliberately reproducing it): `comparisonSeries` uses the route's display `label` as the ONLY series
discriminator (both the server's `__series` SQL alias and the client's grouping key), so two variants
with an identical label are indistinguishable by design, merge into one data series, and
`colorsByKey` (keyed by that same label) just has the later duplicate's color overwrite the
earlier's in the map. This predates the color feature entirely and isn't something the color
threading caused or could avoid — see `comparison-series-explicit-color.md`'s note. **This was
later fixed separately** — see `comparisonseries-stable-series-key.md` in the `dms` submodule
(auto-suffix on add, block on rename, rather than threading a stable key through the whole engine).

**Decision confirmed with user 2026-07-22: Option A (library-side).** Full render-path plan is in
the library-side task, `src/dms/planning/tasks/current/comparison-series-explicit-color.md` — read
that first; it corrects one detail in this doc's original sketch (color never needs to reach
`buildUdaConfig`'s server-bound `options.seriesVariants` — it's a pure client-rendering concern
threaded via `state.comparisonSeries` directly into the chart-type wrappers). This doc still owns
everything below: the route schema, the picker UI, and publish-time threading (all dms-template
theme-side, no library dependency to start those in parallel).

### Origin

Gap 02 of `research/report-page-redesign/findings.md`'s old-tool-vs-new-tool audit (Gap 01, the
inline Measure/Comparison Mode quick controls, shipped separately — see
`report-page-redesign.md`'s Gap 01 section). The audit flagged this gap as
**unconfirmed** — whether anything in the new tool already covers the old tool's two color systems.
This document is that confirmation pass plus the resulting scope.

### Objective

Let an author assign each **route** in `ReportRouteList` a consistent identity color, so that route
appears in the same color on every graph in the report it's plotted on — mirroring the old tool's
per-route free-form color system. Auto-assign from a cycling palette when a route is added (matching
old-tool behavior), with a per-row override control.

### Old-tool ground truth (from findings.md, restated for this doc's self-containedness)

Two **independent** color systems existed:
- **(a) Per-route/station identity color** — free-form HSV picker
  (`Sidebar/components/ColorPicker.jsx`), new routes auto-assigned from a shared cycling palette
  (`COLORS`/`getRouteColor()`/`getStationColor()` in `store/index.js`). This is the gap this task
  covers.
- **(b) A separate graph color-***range*** picker** (`ColorRangeSelector.jsx`, ColorBrewer-style
  diverging/sequential palettes, length 3–9, reversible) for choropleth/heatmap-style graphs
  (`isColorfull` graph types) — colors grid cells/fills **by value**, unrelated to route identity.

### Current state (confirmed by direct code reading, 2026-07-22)

**(b) is already covered — not a gap.** `ComponentRegistry/graph_new/config.jsx` already exposes a
real Settings-drawer "Colors" section: `colors.scheme` (select, ColorBrewer categorical/diverging/
sequential/cyclical options built in `colorSchemeUnifier.js`) and `colors.reverse` (toggle), plus
`colors.byValue`/`byValueSymmetric`/`nullColor` for value-driven graphs (GridGraph, BarGraph). This
is a faithful, already-shipped equivalent of the old tool's `ColorRangeSelector`. One related wrinkle
worth noting but **not itself in scope**: `MeasurePicker/composeMeasureConfig.js`'s `buildDiffColors()`
auto-writes `display.colors` from the measure's vocabulary entry whenever Comparison Mode is
"difference" (`data-types/npmrds_graph_vocabulary/vocabulary.json`'s `comparisonModes.difference.
defaultColorRange`) — an author's manual `colors.scheme` override could get silently clobbered the
next time Measure or Comparison Mode is changed via the picker/QuickControls. Not addressed here;
flag if it becomes a real complaint.

**(a) is a confirmed, genuine gap.** `ReportRouteList.jsx`/`RouteRow.jsx` have **no route-color field
at all** — every "color" match in those files is a `Button`'s `themeOptions.color` (button chrome
styling), not route identity. Each route object (managed by `useReportRow.js`, persisted via
`persistRoutes`) carries `route_comp_id`, `name`, `tmc_array`, `startDate`/`endDate`, `weekdays`,
`graphIds` — no `color`.

**How series get colored today (positional, not identity-based)** — confirmed via direct read of the
chart rendering path:
- `avl-graph/utils/index.js` — `getColorFunc(colors)` returns `(d, i) => colorRange[i % colorRange.length]`
  — indexes into a flat color array **by the series' position in the current dataset**, not by any
  stable key. Used identically by BarGraph, LineGraph, PieGraph, SunburstGraph, TreemapGraph, GridGraph.
- `colorRange` is `display.colors.value` when `display.colors.type === "palette"` (resolved in
  `ui/components/graph_new/components/BarGraph.jsx`), or computed from `display.colors.scheme` via
  `getColorRange(scheme, keys.length)` otherwise.
- Default palette: `ComponentRegistry/graph_new/config.jsx` — `DefaultPalette = getColorRange(20,
  "div7")`, set as the component's `defaultState.display.colors`.
- Consequence: if a route is removed/reordered/added to a graph's route subset, **every other
  route's color on that graph can shift**, and the same route can show different colors across
  different graphs on the same report (each graph's own series ordering is independent). This is the
  precise gap the old tool's per-route identity color avoided.

**How routes reach a graph today** (`ReportRouteList/useGraphPublish.js`) — each graph discovers its
own assigned route subset and gets it published via `setActionParam` as an array of
`{label, filters}` **variants** (built by `transformReportRoutes()`, `useGraphPublish.js:62-88`) —
keyed to the graph's own self-derived `paramKey` (`$self` sentinel resolution, see
`ReportRouteList/README.md`). `buildUdaConfig.js` fans these variants out into the actual plotted
series. This is the natural place to thread a per-route `color` through: add `color: route.color` to
the object `transformReportRoutes` returns per route (`useGraphPublish.js:83-86`).

**Existing reusable primitive**: a generic `colorpicker` control type already exists
(`ui/components/navigableMenu/index.jsx`'s `ColorPickerControl`, used today for a graph's hover-
highlight color, richtext config, and sectionMenu). No per-list-item (per-row) usage exists yet, but
it's the right control to reuse rather than building a new swatch/picker from scratch.

### Scope

#### In scope
1. **`route.color` field** — added to the route object schema (`useReportRow.js`/`RouteRow.jsx`),
   auto-assigned from a cycling palette when a route is created (mirroring the old tool's
   `getRouteColor()` — likely reuse the same `DefaultPalette`/`getColorRange` primitive already used
   for the graph's own default series palette, for visual consistency between "no explicit color set"
   states and the picker's own swatch options).
2. **Per-row color swatch + picker** in `RouteRow.jsx`, using the existing `colorpicker` control
   (`ColorPickerControl`) — one swatch per route, click to override.
3. **Thread `color` through publishing** — `transformReportRoutes()` includes `color: route.color`
   in each variant it returns.
4. **Consume the explicit color in the render path** — the real design fork, see below.

#### Explicitly out of scope this round
- **The `buildDiffColors`/manual-override clobber wrinkle** noted above (color-range picker, not
  per-route identity) — separate, lower-priority, not raised as a real complaint yet.
- **Station color** (old tool's `getStationColor()`) — no equivalent "station" concept exists in the
  new tool's report model at all (routes only); out of scope unless stations get built as their own
  feature first.
- **Gap 03** (card visual/density polish) — separate item in `findings.md`, not touched here.

### Architecture decision — RESOLVED 2026-07-22

Option A confirmed. Full render-path plan (and the finding that `color` never needs to reach
`buildUdaConfig`'s server-bound `options.seriesVariants` — it's threaded client-side via
`state.comparisonSeries` instead) is in
`src/dms/planning/tasks/current/comparison-series-explicit-color.md`. Do not re-derive that plan
here; read it before touching any library code.

### Theme-side implementation plan (this repo, dms-template)

Everything below is scoped to this repo and has no dependency on the library task landing first —
`route.color` will simply have no visible effect on any graph until the library-side primitive
ships, but the schema/UI/publish-threading work is independently valid and can proceed in parallel.

#### 1. `useReportRow.js` — route schema + auto-assignment

- Import `getColorRange` from `../../../../dms/packages/dms/src/ui/components/graph_new/colorSchemeUnifier`
  (same module `ComponentRegistry/graph_new/config.jsx` uses for its `DefaultPalette = getColorRange(20,
  "div7")` — reuse the identical palette for visual consistency between a graph's own default series
  colors and a route's auto-assigned identity color).
- In `addRoute` (~line 214-242), when building `newRoute`, auto-assign a color cycling through that
  palette by the route's position: `color: PALETTE[routes.length % PALETTE.length]`. `routes.length`
  (the count *before* the new route is appended) is the right index — first route gets palette[0],
  etc. — mirrors old-tool `getRouteColor()`'s cycling behavior.
- No change needed to `updateRoute` — it already accepts an arbitrary `{ index, updates }` object
  and writes any field (`newRoutes[index][field] = finalValue` at line ~292), so
  `updateRoute({ index: i, updates: { color: newColor } })` from the picker just works today.

#### 2. `RouteRow.jsx` — per-row swatch + picker

- New prop `onChangeColor(newColor)` passed in from `ReportRouteList.jsx` (mirrors the existing
  `onToggleGraph`/`onRemove` callback-prop pattern — `RouteRow` stays purely presentational, owns no
  persistence).
- Use `UI.ColorPicker` (the library's already-exported, already-generic component —
  `ui/index.js:72`, default export of `ui/components/Colorpicker.jsx`) — **not** the internal
  `ColorPickerControl`/`ColorPickerFlat` used by `navigableMenu` (those aren't part of the public
  `UI` object; reaching for them would mean a direct deep import, violating this repo's "always
  access UI components through ThemeContext" convention documented in `src/dms/CLAUDE.md`).
  `UI.ColorPicker` takes `{ color, onChange, colors, showColorPicker }` — pass
  `colors={PALETTE}` (same palette as step 1, imported once and shared) and `showColorPicker={true}`
  to always show the full HSV/hex picker inline (mirrors the old tool's free-form picker, not just a
  fixed swatch grid).
- Placement: a small always-visible color dot next to `r.name` in the collapsed header (pure visual
  identity, no interaction) + the full `UI.ColorPicker` inside the expanded content (`isEdit` only),
  next to the other per-route edit affordances (dates, TMCs, remove).

#### 3. `ReportRouteList.jsx` — wire the callback

- Add `onChangeColor={(c) => updateRoute({ index: i, updates: { color: c } })}` to the `<RouteRow>`
  invocation in the `filteredEntries.map(...)` loop (~line 188-221), alongside the existing
  `onToggleGraph`/`onRemove` props.

#### 4. `useGraphPublish.js` — thread `color` into published variants

- `transformReportRoutes()` (~line 62-88) — the returned object (line 83-86) becomes:

  ```js
  return {
    label: route.name,
    filters: { op: "AND", groups: groups },
    ...(route.color ? { color: route.color } : {}),
  };
  ```

  This is the object that flows through `setActionParam` → page-state action param →
  `resolveComparisonVariants` (library-side task, step 1) → `state.comparisonSeries.config` on every
  graph the route is assigned to.

### Files requiring changes

| File | Change |
|---|---|
| `src/themes/transportny/components/ReportRouteList/useReportRow.js` | Add `color` to route schema; auto-assign from `getColorRange(20, "div7")` cycling on `addRoute` |
| `src/themes/transportny/components/ReportRouteList/RouteRow.jsx` | Color dot (collapsed) + `UI.ColorPicker` (expanded, edit mode) |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` | Wire `onChangeColor` → `updateRoute({ index, updates: { color } })` |
| `src/themes/transportny/components/ReportRouteList/useGraphPublish.js` | `transformReportRoutes()` includes `color: route.color` per variant (line 83-86) |
| *(library — see `comparison-series-explicit-color.md`)* | Render-path: `getColorFunc`/Legend keyed lookup, `resolveComparisonVariants` color passthrough |
| `src/dms/packages/dms/src/ui/components/Colorpicker.jsx` *(bugfix, found live)* | Saturation/value gradient moved to inline `backgroundImage` — dead Tailwind arbitrary-value class was compiling to no CSS |

### Testing checklist

- [ ] A new route gets an auto-assigned color distinct from existing routes on the same report (cycling palette, no immediate repeats) — not yet tested with a fresh `addRoute` call
- [x] Overriding a route's color via the picker persists — live-verified 2026-07-22 (survives full page reload, dot + picker both reflect the new color)
- [x] The explicit color actually renders as the line/legend color on a real chart, and updates live
      when changed — live-verified 2026-07-22 on `claude_scratch_measure_picker` (LineGraph, real
      ClickHouse data)
- [ ] The same route shows the identical color across two different graphs on the same report — not yet directly tested (only one graph available on the scratch page)
- [ ] Adding/removing/reordering routes on a graph does not shift other routes' colors — not yet directly tested
- [x] Two routes sharing the identical name on the same graph: confirmed they collapse into one
      series (pre-existing `comparisonSeries` limitation, not caused by this change — see Status).
      Not a pass/fail item for this task; documented as a known, separate limitation (since fixed,
      see `comparisonseries-stable-series-key.md`).
- [x] A route with no explicit color still renders sensibly (falls back cleanly, no crash) — confirmed both in code (`r.color || '#000000'` fallback in `RouteRow.jsx`) and live (pre-existing routes without a color rendered fine before one was set)
- [ ] Existing non-report AVL Graph sections (no `ReportRouteList` sibling) are unaffected — regression check — covered on the library side, not re-tested here
- [ ] `colors.scheme`/`colors.reverse` (Gap 02b, already-shipped) still work unchanged on a report graph after this change
- [x] Picker interaction does not cause a render loop / request storm — confirmed exactly one POST per real color pick, zero requests at idle, on repeated expand/collapse and repeated color picks
- [x] ColorPicker's saturation/value gradient renders correctly (not a flat color) — live-verified 2026-07-22 after the `Colorpicker.jsx` fix

---

## Gap 03 — Report card visual/density polish (originally `tasks/current/report-card-visual-density-polish.md`)

### Status: SETTLED 2026-07-23 after a scope review with the user. Final disposition per atom:

- **#1 Shadow — KEPT, restyled.** The knob itself (`resolveShadow`, `theme.shadows`) is unchanged,
  but the toolbar control was rebuilt to match `sectionMenu.jsx`'s dominant convention (the
  `CircleCheck`/`Blank` checkmark-list used by Style/Width/Height/Rowspan) instead of copying
  Background's swatch-pill style — a shadow doesn't preview meaningfully at swatch size, and the
  user flagged the swatch as reading like a non-functional checkbox. See "Shadow control" below.
- **#2 Header uppercase → normal-case — FULLY REVERTED**, mechanism included (not just transportny's
  opt-in). User: "just ditch the uppercase stuff, I don't want to change it for the whole site."
  Both `section_components.jsx` (back to hardcoded `uppercase`) and the two theme files (opt-in
  keys removed) are reverted. After the revert, the Tappan Zee report page's titles are confirmed
  back to ALL CAPS — the fix was real. The revert is a deliberate scope decision (site-wide reach
  was more than wanted), not a "doesn't matter anyway" call. See "The dist-rebuild dead end" below
  for why an earlier claim in this file called this a false positive — that claim was wrong too,
  for an unrelated reason (a misdiagnosed build mechanism, not anything about this atom itself).
- **#3 Attribution divider — KEPT, unchanged status.** Not raised in the scope review; still
  capability-only (transportny doesn't opt in, zero visual change).
- **#4 Whitespace `mt-auto` — FULLY REVERTED.** User: confirmed via DB query that all 28 sections
  currently using `height:'fill'` anywhere in the app (`map_21`, both pages) are `Card`/`lexical`,
  never `AVL Graph` — so the fix was provably inert everywhere, and not worth carrying speculatively
  for a combination nobody uses yet. `dataWrapper/index.jsx` is back to its original two `<div>`
  wrappers (no `mt-auto`) in both Edit and View.
- **#5 Legend/tooltip precision — KEPT as-is, re-confirmed.** `GraphComponent.jsx:95` still calls
  `getTooltipFormatFunc`. Re-verified against a clean, fully-rebuilt dist (see below) — this one's
  underlying mechanism was always independently provable by reading `d3-interpolate`'s `quantize`
  behavior, unlike #2's Lexical-adjacent mystery, so it doesn't carry the same doubt.

**A note on the rest of this archived file, below**: the atom-inventory table, files-changed
table, and testing checklist that follow were the *original* build record from earlier in the same
session, before the scope-review revert above. They still describe atoms #2 and #4 as shipped/DONE.
That's accurate for what was built and briefly live at the time, but **the disposition above is
final** — read it first. This is preserved verbatim as the historical build record, not updated
in place, so the sequence (build → live-verify → revert) stays legible.

### The dist-rebuild dead end (important — explains a wrong claim earlier in this file's history)

Mid-session, a theory surfaced that `@availabs/dms` needs `dist/` rebuilt (`npx babel src -d dist`)
before source edits reach the browser, based on `package.json`'s `main: dist/index.js` and a
`grep`/`curl` check against a specific dist file. **This theory was wrong**, and the user directly
disproved it: added a `console.log` to `sectionArray.jsx`, reloaded a page, saw it print — zero
rebuild involved. A real network-request capture then confirmed why: `src/App.jsx` imports
`{ DmsSite, adminConfig }` from `"./dms/packages/dms/src"` (a plain relative path into source, not
the npm package name), so every edit in this package has been live immediately, all session, via
Vite's normal source-serving — no dist/build step ever mattered. `dist/` rebuilds performed
mid-session were a complete no-op side quest.

This explains an earlier "false positive" claim about atom #2 cleanly: at one point, two
screenshots taken before/after a dist rebuild came out pixel-identical, which was (wrongly) read as
"this fix has no visible effect" and (wrongly) blamed on Lexical overriding `text-transform`. The
real explanation is mundane — no *source* edit happened between those two screenshots (only the
irrelevant dist rebuild did), so of course nothing changed. See the `dms-package-dist-rebuild`
reference memory for the full corrected story — don't reach for a dist rebuild for anything in this
repo; verify a stuck-looking change with a network-request capture instead of theorizing from
`package.json` fields.

### Shadow control — final style

`sectionMenu.jsx`'s "Shadow" item now mirrors Style/Width/Height/Rowspan exactly: top-level
`value`/`showValue` shows the current pick inline in the Layout list; drilling in shows a plain
vertical list of `none`/`sm`/`md`, each with a `CircleCheck` icon when active and `Blank` otherwise
(no color swatch, no pill background). `onClick` writes `undefined` for `'none'` (matching Height's
pattern) instead of the literal string, keeping unset sections clean in the DB.

### Origin

Gap 03 from `research/report-page-redesign/findings.md` — the last of the three ranked gaps in the
old-vs-new report tool audit, and the only one still unscoped (Gaps 01/02 are done — see
`report-page-redesign.md`). Findings.md described it only loosely
("spacing, borders, legend placement, and the attribution-line treatment differ from the old
tool's cleaner card chrome"). This file replaces that loose description with a concrete atom
inventory, built by direct screenshot comparison (`~/Pictures/Screenshots/old_33.png`,
`old_33_edit.png`, `report_914_avg_winter.png` vs `tappan_latest_dms.png`, `edit_graph.png`,
`edit_measure_dms.png`) plus a code trace of the current card-chrome mechanism.

### Method

Followed `src/dms/skills/transcribing-a-design-card-to-dms.md` Steps 1-2: decompose into atoms,
then walk the decision ladder per atom (reshaped static text → formatFn → column type → Card
display knob → last-resort new component). Unlike the KPI-card worked example in that skill, none
of these atoms land on "new section component" — they're all either small theme-token fixes,
one genuinely missing `display` knob, or straightforward layout bugs.

### Atom inventory (original build, before the scope-review revert — see Status above)

| # | Atom | Old tool | New tool (current) | Decision ladder rung | Authorable now? |
|---|------|----------|---------------------|----------------------|------------------|
| 1 | Card shadow | Every card has a visible drop shadow as part of its unified box | `avlGraphTheme` (inner panel) has no border/radius/shadow keys at all; the *section's* chrome (`sectionArray.jsx` `resolveBorder`/`resolveRadius`/`resolveBg`) has author-facing Border/Radius/Background controls in `sectionMenu.jsx` — but no Shadow control or `resolveShadow` exists anywhere in that granular path. A `shadow-sm` class exists only on legacy preset border strings the current toolbar never writes. | rung 4 (Card `display` knob) — but the knob doesn't exist | **built 2026-07-23**: new `resolveShadow()` in `sectionArray.jsx` (mirrors `resolveBg` exactly), folded into `sectionChrome()`; new "Shadow" control group in `sectionMenu.jsx` (mirrors "Background" exactly — themed swatch list, writes `v.shadow`); `themev2.js` `shadows: { none, sm, md }` map. Unset/`'none'` → `''`, byte-identical default for every existing section. Documented in `card-layout.md`. This is an author-facing per-section toggle (like Border/Radius/Background) — not auto-applied to any real page; an author opts in via the toolbar |
| 2 | Header title casing | Title Case, single line, reads compactly | Hardcoded `uppercase` in `section_components.jsx:21` (shared across all patterns/brands, not theme-driven, no toggle). On a narrow card (Settings drawer open) an all-caps multi-word title like "ROUTE DIFFERENCE GRAPH, SPEED" wraps to 4 lines, pushing the chart down significantly (see `edit_graph.png`) | rung 1 (reshaping static text) | **fixed 2026-07-23, later reverted 2026-07-23 — see Status above**: `section_components.jsx:22`'s wrapper className briefly read `${theme.sectionHeaderCase ?? 'uppercase'}` instead of a bare hardcoded `uppercase`, with transportny's `theme.js`/`themev2.js` setting `sectionHeaderCase: "normal-case"`. Reverted same day at user request (site-wide reach was more than wanted) |
| 3 | Attribution line weight/placement | Doesn't exist in old tool | Exists (`Attribution.jsx` + `.theme.js`), already has a `display.showAttribution` visibility toggle (shipped, not part of this gap). Font-size/color are theme-editable (`themev2.js:1680-1684`) but not admin-UI-editable. The two-column `border-r` divider layout is hardcoded inline in `Attribution.jsx` (lines 23/40/52), not part of `theme.attribution` — can't be restyled/removed without a code change | rung 1, partly done | **fixed 2026-07-23**: new `divider` key added to `attributionTheme` (`Attribution.theme.js`), defaulting to the exact previous literal (`'border-r-1 last:border-r-0 px-1'`) — BC for every theme. `Attribution.jsx` now resolves `theme.attribution.divider ?? attributionTheme.divider` once and uses it at all 3 call sites instead of the hardcoded string. transportny's own `attribution` object (`themev2.js:1680-1684`) does NOT set `divider`, so it still falls back to the same default — **visual output for transportny is unchanged this round** (lowest-priority atom, scoped as "make it possible," not "change the current look") |
| 4 | Blank whitespace below chart+attribution when a sibling card in the same row is taller | Never happens — cards size to their own content independently | `value.height:'fill'` (`sectionArray.jsx` `resolveHeight`) stretches the section's chrome box to `h-full flex flex-col` so side-by-side compound cards compose flush (deliberate, documented behavior — see the comment above `resolveHeight`). But the graph itself renders at a **fixed pixel height** (`graphFormat.height`, default 300 — `GraphComponent.jsx:83-87,108-110`, outer div is `w-full h-fit`) — chart libs need an explicit pixel height, so it can't organically grow to fill a taller stretched box. The dead space is therefore unavoidable *somewhere*; today it lands below the Pagination/Attribution footer, inside the card's visible border, reading as an empty dead zone. Visible in `tappan_latest_dms.png` (Route Bar Graph card, stretched to match the taller Route Map card) | structural bug in the existing height mechanism, not a new primitive — and NOT a "make the chart bigger" fix (that would need a ResizeObserver-driven responsive chart height, a much bigger, riskier change touching every graph on every page) | **fixed 2026-07-23, later reverted 2026-07-23 — see Status above**: added `mt-auto` to the Pagination/Attribution footer `<div>` in both `dataWrapper/index.jsx` Edit (~445) and View (~701) returns. Reverted same day after a DB query showed the combination it fixed (AVL Graph + `height:'fill'`) has zero live users |
| 5 | Legend tick-label precision | Clean rounded bucket ranges (e.g. `38.12 - 42.32`, 2 decimals) | Raw unrounded floats on the diff-graph color-scale legend (`-11.549389864340476`, `5.774694932170238`, …) — see `edit_graph.png`/`edit_measure_dms.png` | rung 2 (reformatting a number the same way for every row — a formatFn) | **fixed 2026-07-23**: `BarGraph.jsx:207` and `GridGraph.jsx:191` both already fed the color-scale legend's `format` prop from `props.hoverComp?.valueFormat` — a shared field also used for the hover tooltip. `GraphComponent.jsx:95` was resolving it with `getFormatFunc` (raw `identity` passthrough when unset) instead of the already-written-but-never-wired `getTooltipFormatFunc` (1-decimal rounding default — see its doc comment in `utils.js:421-426`, written specifically for this float-artifact problem on the tooltip's Total sum, but the import at `GraphComponent.jsx:5` was dead code, never called). Changed line 95 to call `getTooltipFormatFunc` instead — fixes the legend AND completes the tooltip fix its own comment already promised. No other `valueFormat`/`format` call site touched (yAxis ticks, pieAxis — out of scope, unaffected, already read fine in the screenshots) |

Everything else noted in the original findings.md prose (grid gap/density between cards, general
spacing) checked out as already comparable/already authorable via existing `display.padding`/grid
knobs — no further atom needed there.

### Explicitly out of scope this round

- **Bar/line value-driven color banding** (heatmap-style backgrounds in the old tool's bar/diff
  graphs) — this is the already-tracked `colors.byValue` NaN bug,
  `src/dms/planning/tasks/current/bargraph-byvalue-scheme-color-nan-bug.md`. Don't duplicate here.
- **Gaps 01/02** (quick controls, route color) — done, see cross-references.

### Recommended priority (smallest/most isolated first, original build order)

1. **#4 blank whitespace** — one-line `flex-1` fix, clearest bug, no visual-design judgment calls.
2. **#5 legend float precision** — small, high-value, likely a one-line formatFn application.
3. **#2 header uppercase/wrap** — small but touches a component shared by every pattern; needs a
   regression check across non-report pages after making it theme-driven.
4. **#1 card shadow** — genuinely missing primitive; more work (new resolver + toolbar control +
   `card-layout.md` doc update) but still small and mirrors an existing pattern (`resolveBg`).
5. **#3 attribution divider** — lowest priority; the visibility toggle already covers the main
   "takes too much space" complaint, this is pure polish.

### Files requiring changes (by atom, original build — #2 and #4 later reverted)

| Atom | File(s) |
|---|---|
| #1 shadow | `src/dms/packages/dms/src/patterns/page/components/sections/sectionArray.jsx` (new `resolveShadow` — DONE), `.../sections/sectionMenu.jsx` (new control — DONE), `src/themes/transportny/themev2.js` (`shadows` map — DONE), `src/dms/skills/card-layout.md` (doc — DONE) |
| #2 uppercase | `src/dms/packages/dms/src/patterns/page/components/sections/section_components.jsx:22` (DONE, then REVERTED); `src/themes/transportny/theme.js`, `src/themes/transportny/themev2.js` (new `sectionHeaderCase: "normal-case"` — DONE, then REVERTED) |
| #3 attribution divider | `src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/components/Attribution.jsx`, `Attribution.theme.js` (both DONE) |
| #4 whitespace | `src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/index.jsx` (~445, ~701 — DONE, then REVERTED) |
| #5 legend precision | `src/dms/packages/dms/src/ui/components/graph_new/GraphComponent.jsx:95` (one-line change — DONE) |

### Testing checklist (original build, before the #2/#4 revert)

Live-verified 2026-07-23 on two real pages: `converted_reports/tappan_zee_cashless_toll_version_2`
(read-only view-mode probe, `scripts/npmrds-reports/report_probe.mjs`) and
`converted_reports/claude_scratch_measure_picker` (edit-mode, id 2195034 — backed up first to
`scratchpad/npmrds-sub/backups/page_2195034.good.json`).

- [x] #5: diff-graph legend tick labels show rounded (1-decimal) values, not raw floats —
      confirmed on the real Tappan Zee page: Route Difference Graph legend reads
      `-11.5 / -5.8 / 0 / 5.8 / 11.5` (was `-11.549389864340476` etc pre-fix); TMC Difference Grid
      legend reads `-21.7 / -10.8 / 0 / 10.8 / 21.7`. Screenshot-confirmed via cropped zoom.
- [ ] #5: hover tooltip Total sum also shows rounded values (bonus fix) — not directly clicked/
      hovered live, lower risk (same code path as the legend, which is confirmed)
- [ ] #5: regression — explicit `tooltip.valueFormat` still honored unchanged — not tested live,
      but unchanged by inspection (only the identity-default branch changed)
- [x] #2: transportny report page headers render in authored title case, not forced uppercase —
      confirmed on the real Tappan Zee page **before the revert**: "Route Map, Speed", "Route Bar
      Graph, Speed", "Route Difference Graph, Speed", "TMC Info Box, AADT", etc. all render in
      normal case. **After the revert, confirmed back to ALL CAPS** — see Status above.
- [ ] #2: narrow-card wrap behavior specifically (Settings drawer open) — not re-tested after the
      fix, moot after the revert
- [ ] #2: regression check on every other theme (mny, wcdb, catalyst, avail) — moot after the revert
- [x] #2: open scope question resolved by observation — this was the look on EVERY transportny
      report-page section, not just AVL Graph, while it was live (it's a shared component) — this
      site-wide reach is exactly why it was reverted, see Status above
- [x] #1: Shadow control appears in the section toolbar (Settings → Layout → Shadow, right after
      Background) with None/Sm/Md swatches, "None" selected by default — confirmed live in edit
      mode on the scratch page. Clicking "Sm" produced a real, visible drop-shadow on the card
      (screenshot-confirmed) and persisted correctly (`shadow: "sm"` on section 2195244, verified
      via direct DB read). **Left set to `sm` on that scratch section** — the "Discard" toolbar
      button turned out not to revert already-saved component-level attribute edits (only
      page-level section list/ordering), and further blind Playwright clicking to hunt for a
      revert path wasn't worth the risk on a shared scratch resource; the residual change is
      harmless (demonstrates the working feature) and confined to one section on a dedicated test
      page — see `feedback_dont_over_engineer_against_orphaning` memory precedent.
- [x] #3: transportny (which doesn't set `attribution.divider`) renders byte-identical to before —
      confirmed on the real Tappan Zee page: divider still visible between attribution link
      segments, unchanged from the pre-fix screenshot reference
- [ ] #3: a theme actually setting `attribution.divider` to something else — not tested (no theme
      opts in yet; this atom only added the capability)
- [ ] #4: a report section with `height:'fill'` next to a taller sibling — **not visually
      reproduced live** before the revert. Neither real page currently has a section with
      `height:'fill'` set (the Tappan Zee page's cards are content-sized, not stretched), so the
      dead-space bug this fixed couldn't be directly re-shot before/after. Moot after the revert.
- [ ] #4: regression — a section NOT using `height:'fill'` unaffected — moot after the revert
