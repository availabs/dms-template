# Report page redesign — old npmrds tool vs. new DMS report page

**Project:** TransportNY

## Current status

Three gaps identified by a direct old-tool-vs-new-tool audit (see
[`research/report-page-redesign/findings.md`](../../../../research/report-page-redesign/findings.md)
for the audit itself, old-tool architecture ground truth, and methodology — this file tracks only
current status and open items).

| Gap | What | Status |
|---|---|---|
| 01 | Inline Measure/Comparison Mode quick-control pills in the AVL Graph card header, instead of only via the Settings drawer | **DONE**, fully live-verified 2026-07-22 |
| 02 | Per-route identity color, consistent across every graph a route appears on | **Implemented and live-verified end-to-end** 2026-07-22; several testing-checklist items still open (below) |
| 03 | Visual/density polish of the graph cards (shadow, header casing, attribution divider, footer whitespace, legend precision) | **Settled** 2026-07-23 after a scope review — 3 of 5 atoms kept, 2 fully reverted (below) |

Full implementation detail (code traces, file-change tables, live-verification walkthroughs, bugs
found along the way) for all three gaps has been moved to
[`report-page-redesign-archive.md`](./report-page-redesign-archive.md) — this file used to be three
separate task files (`avl-graph-quick-controls.md`, `report-route-color-assignment.md`,
`report-card-visual-density-polish.md`); they're merged here because all three are one audit with
one shared origin, and were drifting out of sync with each other (see "Note on a drift this merge
fixed" below).

## Gap 01 — Inline quick controls

**DONE.** Library primitive: `sectionHeaderExtensions` registry, shipped in the `dms` submodule
(`src/dms/planning/tasks/completed/section-header-extensions.md`). Theme consumer: new
`QuickControls` component (Measure + Comparison Mode pills), reusing the Measure Picker's exact
apply logic via an extracted `applyMeasurePick` function so the two entry points can't drift.

Live-verified: pill labels match the Settings drawer, picking a value updates both simultaneously,
gate correctly excludes non-report AVL Graph sections, independent state across multiple graphs on
the same report.

**One claim from the original live-verification pass is corrected here**: a note was made that the
View-mode section "⋮" Settings trigger is `display:none` at all desktop widths. That claim was
**investigated further the same day and retracted** — the trigger's gating is correct product
behavior (hidden when the page itself is in view mode; reachable via hover when the page is in edit
mode), and the original test almost certainly didn't trigger a real `:hover` event, or checked a
second section's trigger while a different section already held edit focus (intentionally
disallowed). Don't treat this as a known bug. See the archive's Gap 01 section for the full
corrected reasoning if it resurfaces.

**Regression found and fixed, 2026-08-05 — the pills silently stopped rendering on real reports.**
The `migrate-legacy-graph-to-graph-new.md` library task (`src/dms/planning/tasks/current/`, shipped
2026-08-03) renamed the theme-side `sectionMenuExtensions`/`sectionHeaderExtensions` registrations
from key `"AVL Graph"` to `"Graph"` to follow a `.name` rename — but missed that
`ComponentRegistry/index.jsx` force-overrides `.name` back to the literal `'AVL Graph'` for every
section actually persisted with `element-type: "AVL Graph"`, which is virtually every real report
graph (the Report Page template's starter graph, everything RRL's "+ Add Graph" modal creates,
every converted old report). Net effect: both `npmrdsQuickControls` (these pills) and
`npmrdsMeasureMenu` (the Settings-drawer Measure item-group) stopped firing for nearly all graphs —
only bare legacy `element-type: "Graph"` sections still matched. Fixed by registering both keys
(`"Graph"` and `"AVL Graph"`) in both `theme.js` and `themev2.js`. Live-verified via Chrome
automation against `converted_reports/claude_scratch_tag_browser` — pills render again, Measure
dropdown lists the full vocabulary. See the library task's "Post-ship bug + fix #3" for full detail.

## Gap 02 — Route/graph color assignment

**Implemented and live-verified end-to-end** 2026-07-22. Split across two files: this repo's
`route.color` schema/picker/publish-threading, and the `dms` submodule's render-path primitive
(`src/dms/planning/tasks/current/comparison-series-explicit-color.md` — read that before touching
any library-side color code).

Two real bugs were found and fixed live during verification (both in the shared `ColorPicker`
component, both dormant until this task's `RouteRow.jsx` became the first caller to exercise the
affected code paths): an infinite render loop from an unstable `onChange` callback, and a saturation
gradient that silently failed to render under this project's Tailwind v4 setup. Full mechanism
detail in the archive.

A third bug was found and is **explicitly not fixed here** — two routes/variants with an identical
name collapse into one series/legend line, because `comparisonSeries` uses the display label as its
only series discriminator. This is now its own tracked fix in the `dms` submodule
(`comparisonseries-stable-series-key.md`) — pre-existing, not caused by the color work, not
duplicated in this file.

**Open testing-checklist items** (not yet directly verified):
- A fresh `addRoute` call gets a color distinct from existing routes on the same report (cycling
  palette, no immediate repeats)
- The same route shows the identical color across two different graphs on the same report
- Adding/removing/reordering routes on a graph doesn't shift other routes' colors
- Bar/Pie/Treemap rendering (LineGraph is proven, same code path, but untested)
- GridGraph/SunburstGraph regression check
- Existing non-report AVL Graph sections are unaffected (library-side regression check)
- `colors.scheme`/`colors.reverse` (Gap 02b, already-shipped before this task) still work unchanged
  on a report graph after this change

## Gap 03 — Card visual/density polish

**Settled 2026-07-23** after a scope review with the user. Final disposition, per atom:

1. **Shadow control — KEPT, restyled.** New `resolveShadow()`/`theme.shadows` primitive; the
   toolbar control itself was rebuilt to match the checkmark-list convention used by
   Style/Width/Height/Rowspan (not Background's swatch-pill — a shadow doesn't preview meaningfully
   at swatch size).
2. **Header uppercase → normal-case — FULLY REVERTED**, mechanism removed too, not just
   transportny's opt-in. User: "just ditch the uppercase stuff, I don't want to change it for the
   whole site." Site-wide reach was more than wanted.
3. **Attribution divider — KEPT, unchanged status.** Capability-only; transportny doesn't opt in.
4. **Footer whitespace (`mt-auto`) — FULLY REVERTED.** A DB query confirmed all 28 live sections
   using `height:'fill'` anywhere in the app are `Card`/`lexical`, never `AVL Graph` — the fix was
   provably inert everywhere, not worth carrying speculatively.
5. **Legend/tooltip float precision — KEPT.** Independently verifiable by construction (a
   `d3-interpolate` `quantize` argument fix), never in doubt.

**Note on a drift this merge fixes**: the original `report-card-visual-density-polish.md` task file
had this exact final disposition at its top, but its own atom-inventory table and testing checklist
further down still described atoms #2 and #4 as shipped/"DONE" from earlier in the same session,
before the revert. Reading only the top of that file (or only the bottom) gave two different
answers. This file states only the final, correct disposition; the archive preserves both the
original build and the revert for anyone who needs the full sequence.

A process incident happened during this gap's work: a wrong theory that `@availabs/dms` needs a
`dist/` rebuild before source edits take effect led to a false-positive "no visible change" reading
partway through. The theory was disproven the same day (this app imports `@availabs/dms` from
source, not the built package — no rebuild is ever needed). See the `dms-package-dist-rebuild`
memory/reference for the corrected mechanism if this comes up again elsewhere in the repo.

## Cross-references

- [`research/report-page-redesign/findings.md`](../../../../research/report-page-redesign/findings.md) — the original audit: old-tool architecture ground truth, screenshots, methodology. Also carries some bug-triage content found later during dogfooding that isn't part of these three gaps (RRL row overflow, a shared graph tooltip epoch-format bug, a cross-repo ColorPicker divergence) — see that file directly, not duplicated here.
- `src/dms/planning/tasks/completed/section-header-extensions.md` — Gap 01 library primitive
- `src/dms/planning/tasks/current/comparison-series-explicit-color.md` — Gap 02 library render-path primitive
- `src/dms/planning/tasks/current/comparisonseries-stable-series-key.md` — the duplicate-label-collapse bug found during Gap 02, fixed separately
- `src/dms/planning/tasks/current/bargraph-byvalue-scheme-color-nan-bug.md` — a bar-graph color bug found during this research pass, root-caused but not yet fixed, tracked on its own
- [`report-page-redesign-archive.md`](./report-page-redesign-archive.md) — full historical detail for all three gaps
