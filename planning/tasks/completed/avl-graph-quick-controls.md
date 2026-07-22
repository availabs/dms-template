# AVL Graph quick controls — inline Measure/Comparison Mode pills in the card header

## Status: DONE. Scoped 2026-07-21, code complete and fully live-verified 2026-07-22 (Proposed
changes items 1-4 + entire Testing checklist, including both items originally deferred as
code-review-only — non-report AVL Graph gating and two-card independence — since separately
confirmed live by the user on real report pages). See "Testing checklist" and "Live-verification
notes" for detail. One unrelated pre-existing bug found and flagged (not fixed): the View-mode
Settings trigger is `display:none` at desktop widths — see
[[project_section_settings_button_display_none_bug]].

## Origin

Follow-up to `research/report-page-redesign/findings.md`'s Gap 01 ("Inline quick controls vs.
Settings drawer" — the highest-confidence gap in the old-tool-vs-new-tool audit). The user reviewed
a design-audit artifact showing three placement variants mocked directly onto real screenshot pixels
of the `tappan_zee_cashless_toll_version_2` report's "Route Bar Graph, Speed" card, picked **Variant
A — a new row inserted directly under the title, inside the header band** — and asked to fully scope
it out. This file is that scope. See findings.md and the artifact for the visual reference; this
file is the implementation plan, not a re-derivation of the visual rationale.

## Objective

Let an author toggle a graph section's **Measure** and **Comparison Mode** — today only reachable
via Settings → AVL Graph Settings → Measure (3-4 clicks, per `findings.md` Gap 01) — from **one or
two clicks directly in the card's own header**, without opening the Settings drawer at all. Must
reuse the exact same underlying state and vocabulary as the already-shipped Measure Picker
(`src/themes/transportny/components/MeasurePicker/`) — this is a new entry point onto the same
brain, not a parallel config system.

## Scope

### In scope (this round)
1. Register a new theme-side header extension (via the library primitive shipped in
   [section-header-extensions.md](../../src/dms/planning/tasks/completed/section-header-extensions.md)
   — **DONE 2026-07-22, this prerequisite has shipped**; see that task file's "Design deviation
   found during implementation" note before building against it — the extension row renders
   independent of the section's own title/`showHeader`, which matters for AVL Graph's empty-title
   "header + hero-stat" pattern) for the `"AVL Graph"` component, gated by the same `isReportPage`
   check `npmrdsMeasureMenu` already uses.
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

### Explicitly out of scope this round
- **Graph Type and Resolution** — not exposed as quick controls. The audit's Variant A mockup only
  showed Measure + Comparison Mode; Graph Type changes a section's whole shape (not a quick toggle)
  and Resolution is lower-frequency. Add later if the user asks, following the same pattern.
- **Variant B (inline with the title, old-tool-style) and Variant C (segmented control +  boolean
  toggle chip)** — both were shown in the audit artifact but not picked. Same underlying header-
  extension mechanism would support either later; don't build them speculatively.
- **Applying this to any card type other than `"AVL Graph"`** — no other card type was discussed.
- **Route/graph color assignment and card visual/density polish** — Gaps 02/03 from the audit;
  separate, unscoped, lower-confidence items per `findings.md`. Not touched here.

## Architecture decision: library vs. theme boundary

Same boundary the Measure Picker itself already established (see
`src/dms/planning/tasks/completed/report-graph-vocabulary-picker.md`, "Architecture decision"
section) — confirmed as the right precedent to repeat rather than re-litigate:

- **Library-side (`src/dms/`), small and generic**: the header-extension registration/render
  mechanism itself. Shipped as its own task,
  [section-header-extensions.md](../../src/dms/planning/tasks/completed/section-header-extensions.md)
  (DONE 2026-07-22) — unlike `sectionMenuExtensions`, which already existed when Measure Picker was
  built, this primitive didn't exist before this pair of tasks. Genuinely reusable: any theme could
  register header content for any component type.
- **Theme-side (`src/themes/transportny/`), the actual bulk of the work**: the NPMRDS-specific
  pills, reusing the existing Measure/Comparison Mode vocabulary and state-writing logic.

## Current state (confirmed by direct code reading, 2026-07-21)

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

## Non-obvious risk to design around

Measure Picker's apply logic (the full `setState` + `reconcile` sequence) currently lives inline in
`MeasurePicker/index.js`'s nested-select `onClick` handlers. If the new quick-controls component
reimplements this from scratch instead of calling the same function, the two entry points will
silently drift the first time either one is edited (e.g. someone adds a new field to the compose
patch and only updates one call site) — exactly the kind of duplication the vocabulary-JSON
extraction in the parent task (`report-graph-vocabulary-picker.md`) was built to eliminate. **Do
the extraction (see Proposed changes, item 2) before writing the quick-controls component**, not
after — it's a small refactor now and a much messier one once two call sites exist independently.

## Proposed changes

1. **Prerequisite — DONE**: [section-header-extensions.md](../../src/dms/planning/tasks/completed/section-header-extensions.md)
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

## Files requiring changes — all DONE 2026-07-22, not yet live-verified

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
`tappan_zee_cashless_toll_version_2` title Card actually uses (still open, see above) hasn't been
done either.

## Testing checklist

- [x] ~~Live devtools check on a real AVL Graph card confirms which DOM node produces the head-band
      background~~ — resolved 2026-07-22 by direct code reading (not live devtools): it's a sibling
      Card section's `"title_bar"` style, not this task's own row, so `headerExtensionsRow` doesn't
      need to match it (see resolved "Open visual question" above). Still open, lower priority:
      confirming which `cardStyle` `tappan_zee_cashless_toll_version_2`'s actual title Card uses.
- [x] **Live-verified 2026-07-22** on the existing scratch page `claude_scratch_measure_picker`
      (id 2195034, per `[[feedback_use_own_scratch_page_for_ui_testing]]`) via
      `node scripts/report_probe.mjs edit/claude_scratch_measure_picker --auth --eval <probe>`.
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
      `scratchpad/npmrds-sub/tmp/qc_*.mjs`, per `[[reference_report_probe_harness]]`) — see
      "Live-verification notes" below for the interaction sequence and one real, pre-existing bug
      found along the way (unrelated to this task).

## Live-verification notes (2026-07-22)

Getting to a state where the pills were even reachable took real digging — worth recording so a
future session doesn't have to re-discover this:

1. **The `/edit/<slug>` route does not put sections into `SectionEdit` by default.** Sections
   render as `SectionView` (with `editPageMode=true`, but the component-local `isEdit` is hardcoded
   `false` there — see `section.jsx`) until a specific section is switched into `SectionEdit` via
   `sectionArray.jsx`'s per-section `edit.index === i` state, toggled by clicking an "Edit" pencil
   pill *inside that section's own Settings popup*. This is why `npmrdsQuickControls` (and the
   pre-existing Measure Picker drawer item) render nothing on first page load — `isEdit` is false
   until that click happens, exactly as designed; nothing was wrong with the gate.
2. **Found along the way, NOT part of this task, NOT fixed here**: the View-mode section's Settings
   trigger button (`NavigableMenu`'s default icon button, `btnVisibleOnGroupHover=true` in
   `SectionView`) is **unconditionally `display:none` at any desktop viewport width (≥640px)**,
   confirmed via `getComputedStyle`. Root cause: `theme.navigableMenu.styles[].buttonHidden =
   "sm:hidden"` gets appended after `theme.button`'s own `"hidden group-hover:flex"`, and Tailwind's
   responsive variant ordering means `sm:hidden` wins over `group-hover:flex` at ≥640px — so the
   button never becomes visible on hover on any normal desktop screen, regardless of `group-hover`
   state. Confirmed on **both** this scratch page and a real `converted_reports` page
   (`buffalo_skyway_11_5_2019_6_9_pm_hourly_bins`), so it's systemic, not scratch-page-specific.
   Worked around for this test via a native `element.click()` in `page.evaluate()` (bypasses
   Playwright's visibility-gated `.click()`). **This may be blocking real authors** from ever
   entering per-section edit mode via that hover button on a normal desktop browser — flagging for
   a separate task, not touched here since it's pre-existing and out of this task's scope.
3. Once in `SectionEdit` mode, the pills and the drawer both worked exactly as designed — no bugs
   found in this task's own code.
