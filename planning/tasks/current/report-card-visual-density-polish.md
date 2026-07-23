# Report card visual/density polish — Gap 03 of the report-page redesign audit

## Status: SETTLED 2026-07-23 after a scope review with the user. Final disposition per atom:

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
irrelevant dist rebuild did), so of course nothing changed. See
[[reference_dms_package_dist_rebuild]] (retracted and rewritten) for the full corrected story —
don't reach for a dist rebuild for anything in this repo; verify a stuck-looking change with a
network-request capture instead of theorizing from `package.json` fields.

### Shadow control — final style

`sectionMenu.jsx`'s "Shadow" item now mirrors Style/Width/Height/Rowspan exactly: top-level
`value`/`showValue` shows the current pick inline in the Layout list; drilling in shows a plain
vertical list of `none`/`sm`/`md`, each with a `CircleCheck` icon when active and `Blank` otherwise
(no color swatch, no pill background). `onClick` writes `undefined` for `'none'` (matching Height's
pattern) instead of the literal string, keeping unset sections clean in the DB.

## Not yet moved to `tasks/completed/` — several checklist
items are code-verified-only rather than click-verified; move once/if those matter enough to
someone to re-test, or accept as-is.

## Origin

Gap 03 from `research/report-page-redesign/findings.md` — the last of the three ranked gaps in the
old-vs-new report tool audit, and the only one still unscoped (Gaps 01/02 are done — see
`planning/tasks/completed/avl-graph-quick-controls.md` and
`planning/tasks/current/report-route-color-assignment.md`). Findings.md described it only loosely
("spacing, borders, legend placement, and the attribution-line treatment differ from the old
tool's cleaner card chrome"). This file replaces that loose description with a concrete atom
inventory, built by direct screenshot comparison (`~/Pictures/Screenshots/old_33.png`,
`old_33_edit.png`, `report_914_avg_winter.png` vs `tappan_latest_dms.png`, `edit_graph.png`,
`edit_measure_dms.png`) plus a code trace of the current card-chrome mechanism.

## Method

Followed `src/dms/skills/transcribing-a-design-card-to-dms.md` Steps 1-2: decompose into atoms,
then walk the decision ladder per atom (reshaped static text → formatFn → column type → Card
display knob → last-resort new component). Unlike the KPI-card worked example in that skill, none
of these atoms land on "new section component" — they're all either small theme-token fixes,
one genuinely missing `display` knob, or straightforward layout bugs.

## Atom inventory

| # | Atom | Old tool | New tool (current) | Decision ladder rung | Authorable now? |
|---|------|----------|---------------------|----------------------|------------------|
| 1 | Card shadow | Every card has a visible drop shadow as part of its unified box | `avlGraphTheme` (inner panel) has no border/radius/shadow keys at all; the *section's* chrome (`sectionArray.jsx` `resolveBorder`/`resolveRadius`/`resolveBg`) has author-facing Border/Radius/Background controls in `sectionMenu.jsx` — but no Shadow control or `resolveShadow` exists anywhere in that granular path. A `shadow-sm` class exists only on legacy preset border strings the current toolbar never writes. | rung 4 (Card `display` knob) — but the knob doesn't exist | **built 2026-07-23**: new `resolveShadow()` in `sectionArray.jsx` (mirrors `resolveBg` exactly), folded into `sectionChrome()`; new "Shadow" control group in `sectionMenu.jsx` (mirrors "Background" exactly — themed swatch list, writes `v.shadow`); `themev2.js` `shadows: { none, sm, md }` map. Unset/`'none'` → `''`, byte-identical default for every existing section. Documented in `card-layout.md`. This is an author-facing per-section toggle (like Border/Radius/Background) — not auto-applied to any real page; an author opts in via the toolbar |
| 2 | Header title casing | Title Case, single line, reads compactly | Hardcoded `uppercase` in `section_components.jsx:21` (shared across all patterns/brands, not theme-driven, no toggle). On a narrow card (Settings drawer open) an all-caps multi-word title like "ROUTE DIFFERENCE GRAPH, SPEED" wraps to 4 lines, pushing the chart down significantly (see `edit_graph.png`) | rung 1 (reshaping static text) | **fixed 2026-07-23**: `section_components.jsx:22`'s wrapper className now reads `${theme.sectionHeaderCase ?? 'uppercase'}` instead of a bare hardcoded `uppercase` — unset (every theme except transportny) falls back to the exact previous literal, byte-identical, zero regression. transportny's `theme.js` and `themev2.js` both set `sectionHeaderCase: "normal-case"` so report-page (and every other transportny) section titles render in their authored case. Bonus finding: mny's own `theme.heading[2]`/`[3]` deliberately omit `uppercase` (unlike `[1]`/`[4]`), but the old hardcoded wrapper silently forced all of them uppercase via CSS inheritance anyway — mny doesn't set the new key so this latent conflict is unchanged/not fixed here (out of scope), but now has a documented escape hatch if mny wants it later |
| 3 | Attribution line weight/placement | Doesn't exist in old tool | Exists (`Attribution.jsx` + `.theme.js`), already has a `display.showAttribution` visibility toggle (shipped, not part of this gap). Font-size/color are theme-editable (`themev2.js:1680-1684`) but not admin-UI-editable. The two-column `border-r` divider layout is hardcoded inline in `Attribution.jsx` (lines 23/40/52), not part of `theme.attribution` — can't be restyled/removed without a code change | rung 1, partly done | **fixed 2026-07-23**: new `divider` key added to `attributionTheme` (`Attribution.theme.js`), defaulting to the exact previous literal (`'border-r-1 last:border-r-0 px-1'`) — BC for every theme. `Attribution.jsx` now resolves `theme.attribution.divider ?? attributionTheme.divider` once and uses it at all 3 call sites instead of the hardcoded string. transportny's own `attribution` object (`themev2.js:1680-1684`) does NOT set `divider`, so it still falls back to the same default — **visual output for transportny is unchanged this round** (lowest-priority atom, scoped as "make it possible," not "change the current look") |
| 4 | Blank whitespace below chart+attribution when a sibling card in the same row is taller | Never happens — cards size to their own content independently | `value.height:'fill'` (`sectionArray.jsx` `resolveHeight`) stretches the section's chrome box to `h-full flex flex-col` so side-by-side compound cards compose flush (deliberate, documented behavior — see the comment above `resolveHeight`). But the graph itself renders at a **fixed pixel height** (`graphFormat.height`, default 300 — `GraphComponent.jsx:83-87,108-110`, outer div is `w-full h-fit`) — chart libs need an explicit pixel height, so it can't organically grow to fill a taller stretched box. The dead space is therefore unavoidable *somewhere*; today it lands below the Pagination/Attribution footer, inside the card's visible border, reading as an empty dead zone. Visible in `tappan_latest_dms.png` (Route Bar Graph card, stretched to match the taller Route Map card) | structural bug in the existing height mechanism, not a new primitive — and NOT a "make the chart bigger" fix (that would need a ResizeObserver-driven responsive chart height, a much bigger, riskier change touching every graph on every page) | **fixed 2026-07-23**: added `mt-auto` to the Pagination/Attribution footer `<div>` in both `dataWrapper/index.jsx` Edit (~445) and View (~701) returns. Pins the footer to the bottom edge of the stretched box instead of leaving it floating above a dead gap — the unavoidable slack now sits between the chart and the footer (reads as intentional whitespace) instead of below the footer (reads as a bug). No-op when `height` isn't `'fill'` (nothing to push into) |
| 5 | Legend tick-label precision | Clean rounded bucket ranges (e.g. `38.12 - 42.32`, 2 decimals) | Raw unrounded floats on the diff-graph color-scale legend (`-11.549389864340476`, `5.774694932170238`, …) — see `edit_graph.png`/`edit_measure_dms.png` | rung 2 (reformatting a number the same way for every row — a formatFn) | **fixed 2026-07-23**: `BarGraph.jsx:207` and `GridGraph.jsx:191` both already fed the color-scale legend's `format` prop from `props.hoverComp?.valueFormat` — a shared field also used for the hover tooltip. `GraphComponent.jsx:95` was resolving it with `getFormatFunc` (raw `identity` passthrough when unset) instead of the already-written-but-never-wired `getTooltipFormatFunc` (1-decimal rounding default — see its doc comment in `utils.js:421-426`, written specifically for this float-artifact problem on the tooltip's Total sum, but the import at `GraphComponent.jsx:5` was dead code, never called). Changed line 95 to call `getTooltipFormatFunc` instead — fixes the legend AND completes the tooltip fix its own comment already promised. No other `valueFormat`/`format` call site touched (yAxis ticks, pieAxis — out of scope, unaffected, already read fine in the screenshots) |

Everything else noted in the original findings.md prose (grid gap/density between cards, general
spacing) checked out as already comparable/already authorable via existing `display.padding`/grid
knobs — no further atom needed there.

## Explicitly out of scope this round

- **Bar/line value-driven color banding** (heatmap-style backgrounds in the old tool's bar/diff
  graphs) — this is the already-tracked `colors.byValue` NaN bug,
  `src/dms/planning/tasks/current/bargraph-byvalue-scheme-color-nan-bug.md`. Don't duplicate here.
- **Gaps 01/02** (quick controls, route color) — done, see cross-references.

## Recommended priority (smallest/most isolated first)

1. **#4 blank whitespace** — one-line `flex-1` fix, clearest bug, no visual-design judgment calls.
2. **#5 legend float precision** — small, high-value, likely a one-line formatFn application.
3. **#2 header uppercase/wrap** — small but touches a component shared by every pattern; needs a
   regression check across non-report pages after making it theme-driven.
4. **#1 card shadow** — genuinely missing primitive; more work (new resolver + toolbar control +
   `card-layout.md` doc update) but still small and mirrors an existing pattern (`resolveBg`).
5. **#3 attribution divider** — lowest priority; the visibility toggle already covers the main
   "takes too much space" complaint, this is pure polish.

## Files requiring changes (by atom)

| Atom | File(s) |
|---|---|
| #1 shadow | `src/dms/packages/dms/src/patterns/page/components/sections/sectionArray.jsx` (new `resolveShadow` — DONE), `.../sections/sectionMenu.jsx` (new control — DONE), `src/themes/transportny/themev2.js` (`shadows` map — DONE), `src/dms/skills/card-layout.md` (doc — DONE) |
| #2 uppercase | `src/dms/packages/dms/src/patterns/page/components/sections/section_components.jsx:22` (DONE); `src/themes/transportny/theme.js`, `src/themes/transportny/themev2.js` (new `sectionHeaderCase: "normal-case"` — DONE) |
| #3 attribution divider | `src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/components/Attribution.jsx`, `Attribution.theme.js` (both DONE) |
| #4 whitespace | `src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/index.jsx` (~445, ~701 — DONE) |
| #5 legend precision | `src/dms/packages/dms/src/ui/components/graph_new/GraphComponent.jsx:95` (one-line change — DONE) |

## Testing checklist

Live-verified 2026-07-23 on two real pages: `converted_reports/tappan_zee_cashless_toll_version_2`
(read-only view-mode probe, `scripts/report_probe.mjs`) and
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
      confirmed on the real Tappan Zee page: "Route Map, Speed", "Route Bar Graph, Speed", "Route
      Difference Graph, Speed", "TMC Info Box, AADT", etc. all render in normal case
- [ ] #2: narrow-card wrap behavior specifically (Settings drawer open) — not re-tested after the
      fix; normal-case text is shorter than the all-caps version that wrapped to 4 lines, so lower
      risk, but not directly re-shot in that narrow state
- [ ] #2: regression check on every other theme (mny, wcdb, catalyst, avail) — not live-tested,
      but by inspection none set `sectionHeaderCase`, so `?? 'uppercase'` is byte-identical
- [x] #2: open scope question resolved by observation — this is now the look on EVERY transportny
      report-page section, not just AVL Graph (it's a shared component); no other transportny page
      type was checked live to confirm this is universally wanted, only inferred as low-risk
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
      reproduced live**. Neither real page currently has a section with `height:'fill'` set (the
      Tappan Zee page's cards are content-sized, not stretched), so the dead-space bug this fixes
      couldn't be directly re-shot before/after. The fix itself (`mt-auto` on the Pagination/
      Attribution footer div) is verified correct by code trace (see atom #4's row above) and is
      structurally a no-op for every section that isn't using `fill` — but this is the one atom
      that's code-verified only, not click-verified. Flagging honestly rather than claiming a
      screenshot proof that doesn't exist.
- [ ] #4: regression — a section NOT using `height:'fill'` unaffected — not directly re-shot, but
      by construction `mt-auto` only acts on leftover flex space that doesn't exist without `fill`

## Cross-references

- `research/report-page-redesign/findings.md` — Gap 03 origin, screenshot list
- `planning/tasks/completed/avl-graph-quick-controls.md` — Gap 01, sibling task, same
  library/theme boundary precedent
- `planning/tasks/current/report-route-color-assignment.md` — Gap 02, sibling task
- `src/dms/planning/tasks/current/bargraph-byvalue-scheme-color-nan-bug.md` — related but
  explicitly out of scope here
- `src/dms/skills/card-layout.md` — Card display knobs reference, needs updating if #1 ships
- `src/dms/skills/transcribing-a-design-card-to-dms.md` — methodology used for this inventory
