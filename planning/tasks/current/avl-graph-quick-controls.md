# AVL Graph quick controls — inline Measure/Comparison Mode pills in the card header

## Status: NOT STARTED. Scoped 2026-07-21.

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

**Open visual question, flagged during research, resolve before/while implementing**: the gray
head-band background visible in the reference screenshots wasn't traceable to an obvious class in
`section.jsx`/`themev2.js`'s title-row styling — it may come from a different wrapper layer than
assumed. **First implementation step should be opening devtools on a real AVL Graph card and
confirming which DOM node actually produces that background**, so the new row's background is
applied to match reality rather than an assumption carried over from the mockup screenshot.

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

2. **Refactor `MeasurePicker/index.js`**: extract the apply sequence into an exported function,
   e.g. `applyMeasurePick(ctx, {measureKey, resolutionKey, comparisonModeKey, graphType})` where
   `ctx` is `{state, dwAPI, externalSource, ...}` (whatever the current inline closure captures) —
   containing the existing `composeMeasureConfig` call → `dwAPI.setState(...)` →
   `dwAPI.reconcileComparisonSeriesColumn()` sequence, byte-identical to what's inline today.
   `MeasurePicker/index.js`'s own `onClick` handlers call this instead of duplicating it. Also
   export whatever `isReportPage`-equivalent gate helper exists (currently a local function, line
   81) so the new component can reuse the exact same gating condition rather than re-deriving it.

3. **New file** `src/themes/transportny/components/QuickControls/index.js`, exporting a builder
   matching the new `sectionHeaderExtensions` contract:
   ```js
   export function npmrdsQuickControls({state, dwAPI, isEdit, canEditSection, currentComponent, siblingSections}) {
     if (!(isEdit && canEditSection && currentComponent?.useDataSource && isReportPage(siblingSections))) return null;
     const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };
     // read current measure label + comparison mode from `pick`, same source MeasurePicker uses
     return (
       <>
         <MeasurePill pick={pick} onPick={(measureKey) => applyMeasurePick({state, dwAPI}, {...pick, measureKey})} />
         <ComparisonModePill
           value={pick.comparisonModeKey}
           onToggle={() => applyMeasurePick({state, dwAPI}, {...pick, comparisonModeKey: pick.comparisonModeKey === 'difference' ? 'plain' : 'difference'})}
         />
       </>
     );
   }
   ```
   (Exact prop/function names to be finalized against whatever `MeasurePicker/index.js` actually
   exports after the refactor in item 2 — this is illustrative of the shape, not a literal diff.)
   - **Measure pill interaction**: clicking opens a small anchored dropdown. Reuse `NavigableMenu`
     (the same primitive the Settings drawer and Measure Picker's nested selects already use) with
     a `config` containing just the Measure options, and a custom trigger (`children` prop —
     `NavigableMenu` already supports swapping its own trigger button per
     `ui/components/navigableMenu/index.jsx:289/300`) styled as the pill. This avoids inventing a
     new dropdown/popover component.
   - **Comparison Mode pill interaction**: no menu — the pill's `onClick` directly calls
     `applyMeasurePick` with the flipped value.

4. **Register** in `src/themes/transportny/themev2.js` (the active theme file), alongside the
   existing `sectionMenuExtensions` entry:
   ```js
   sectionHeaderExtensions: { "AVL Graph": [npmrdsQuickControls] },
   ```
   Mirror into `theme.js` too, matching how `sectionMenuExtensions` is registered in both files
   today (per the Measure Picker precedent).

5. **Visual spec** (colors sampled directly from the live product, not invented — see the design
   audit artifact for the exact sampling): head-band background `#e0e4ed`, pill background
   `#f1f5f9`, pill border `#e2e8f0`, pill text `#3a4a5e` (all approximate Tailwind slate-100/200/600
   — confirm against the live-rendered DOM, not just the screenshot, once the "open visual
   question" above is resolved). Add a hover state (border/background shift) — not sampled from any
   screenshot since neither reference tool's hover state was captured; use a reasonable Tailwind
   slate step darker.

## Files requiring changes

| File | Change |
|---|---|
| `src/themes/transportny/components/MeasurePicker/index.js` | Extract apply-sequence into an exported `applyMeasurePick` (or similar) function; export the `isReportPage` gate helper; call the extracted function from the existing drawer `onClick` handlers instead of inlining |
| `src/themes/transportny/components/QuickControls/index.js` (new) | Builder function for the new `sectionHeaderExtensions` contract; renders Measure + Comparison Mode pills |
| `src/themes/transportny/components/QuickControls/MeasurePill.jsx` / `ComparisonModePill.jsx` (new, or inlined in index.js — decide based on size once written) | Pill UI, reusing `NavigableMenu` for the Measure pill's dropdown |
| `src/themes/transportny/theme.js`, `themev2.js` | Register `npmrdsQuickControls` under `sectionHeaderExtensions: {"AVL Graph": [...]}`, alongside the existing `sectionMenuExtensions` entry |
| `src/themes/transportny/themev2.js` (theme styling) | `headerExtensionsRow` styling (background/padding) — the library task's theme key (`pages.section.styles[i].headerExtensionsRow`) has landed and is empty-by-default; still pending here is resolving the live DOM background question below before setting real values |

(Depends on the library-side files listed in `section-header-extensions.md`'s own table — not
repeated here.)

## Testing checklist

- [ ] Live devtools check on a real AVL Graph card confirms which DOM node produces the head-band
      background, before finalizing `headerExtensionsRow` styling.
- [ ] On a **scratch report page** (per `[[feedback_use_own_scratch_page_for_ui_testing]]` — not a
      page the user has open), the pill row appears only on AVL Graph sections that are report-page
      graphs (same `isReportPage` gate as Measure Picker) — confirm it does NOT appear on an
      arbitrary AVL Graph section with no `ReportRouteList` sibling.
- [ ] Measure pill shows the correct current measure label on load.
- [ ] Clicking the Measure pill opens the same option list as Settings → AVL Graph Settings →
      Measure → Measure, and picking one produces identical resulting state — verify via Column
      Manager (same columns as picking the equivalent option in the drawer) and the attribution
      line (same join wired in for measures that require one).
- [ ] Comparison Mode pill shows "Plain" or "Difference" correctly and toggling it flips
      `comparisonSeries.combine` — verify the chart re-renders correctly and, if possible, that the
      underlying query's `seriesCombine` option changes (network tab).
- [ ] Two AVL Graph cards on the same page show independent pill state (no shared/stale reference
      across sections).
- [ ] Refactored `MeasurePicker` drawer item-group still works identically post-refactor (Measure/
      Comparison Mode selects in the Settings drawer produce the same result as before the
      `applyMeasurePick` extraction — regression check on the existing, already-shipped feature).
- [ ] Live-verify with the Playwright probe harness (`node scripts/report_probe.mjs <slug> --auth`
      per `[[reference_report_probe_harness]]`) rather than only manual clicking.
