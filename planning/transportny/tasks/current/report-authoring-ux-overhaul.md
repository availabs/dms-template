# Report Authoring UX Overhaul

**Project:** TransportNY · **Topic:** themes · **Status: Tiers 1-10 all DONE and live-verified**
(last shipped 2026-08-24) — full build record moved to
[`report-authoring-ux-overhaul-archive.md`](./report-authoring-ux-overhaul-archive.md) on
2026-08-25 (file had grown past 2500 lines; same live+archive split this project already uses for
`dynamic-reports-and-route-tags.md`/`npmrds-design-v2-implementation.md`/`old-reports-conversion.md`).
**Only the three items in this file's own Parked section below are still open** — everything else
is closed and archived. This arc is no longer the active focus; see
[`routes-reports-users-mesh.md`](./routes-reports-users-mesh.md) for the current priority
(Routes/Reports/Users interaction points, kicked off 2026-08-25). · **Started:** 2026-08-19

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

- [`report-authoring-ux-overhaul-archive.md`](./report-authoring-ux-overhaul-archive.md) — full
  Tier 1-10 build record + Progress log, moved here 2026-08-25.
- [`routes-reports-users-mesh.md`](./routes-reports-users-mesh.md) — the current active initiative
  (2026-08-25-), scoped to Routes/Reports/Users interaction points (route/report picker modals,
  curated+user-data merge/prioritization, lightweight ownership filtering). Separate from this arc's
  in-page report-canvas-authoring scope; cross-link, don't merge.
- [`src/dms/skills/traversing-dms-pages.md`](../../../src/dms/skills/traversing-dms-pages.md) — §2
  updated 2026-08-19 with the durable, generic version of item 4's core finding (a section mounted
  under `SectionView` already has a working persistence channel, `actions.updateAttribute`, distinct
  from the `dwAPI.setState` channel that only works under `SectionEdit`). Read that section for the
  fully-cited version of the mechanism summarized under Item 4 in the archive.
- [`report-route-ui-parity-gaps.md`](./report-route-ui-parity-gaps.md) — gaps #15, #16, #17, #18 all
  cross-referenced in the archive; this file's item 1 = that file's gap #18, this file's gap #16 =
  that file's gap #16.
- [`report-page-template-editorial-slots.md`](./report-page-template-editorial-slots.md) — the
  still-open, still-unconfirmed "Card resets to `defaultState` on new pages" mystery, referenced
  under Item 5 in the archive.
- [`compact-sidenav-margin-bug.md`](../tasks/completed/compact-sidenav-margin-bug.md) — the prior
  (2026-08-07) sidebar-style fix, scoped to 16 already-published pages only, never the template.
- `src/themes/transportny/components/ReportRouteList/README.md` — corrected 2026-08-19 per Item 3 in
  the archive (its "Edit-mode gating" section used to narrate a dead orphan-cleanup effect).

---

## Parked — explicitly deferred per 2026-08-19 decisions (the only open items in this arc)

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
  there's a real feel for whether the lack of undo/staging actually bites in practice. One more
  affected surface, found 2026-08-19 (see the archive's Item 4B): `toggleDynamicReport`
  (`ReportRouteList.jsx:225-237`) writes `filters` straight onto the page row itself, also un-staged,
  also missed by Discard — fold into this item's eventual fix scope alongside `routes`.

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

### Gap #16 / Facet 2's broader scope — MOSTLY DONE as of 2026-08-21, fully closed 2026-08-24

Originally: confirmed (via grep) that `AddGraphModal.jsx` had **zero** references to Info Box or
Route Compare section types — the only way to create either was `report_build.mjs`'s Python-side
spec grammar or the old Python converter, a pure authoring-surface absence, not a rendering bug.

**2026-08-21 triage + build (see the archive's Tier 8 for the full account)**: Info Box turned out to
need no new authoring surface at all for `speed`/`travelTime`/`hoursOfDelay` — Table+Summary (Tier
5D) already produces an equivalent section. The two real gaps were Route Compare's delta column (8A,
DONE) and Info Box's `reliability`-bucket measures LOTTR/TTTR/Freeflow (8B, DONE) — both now have a
live authoring path via AddGraphModal + QuickControls, no Python converter needed. Info Box's
`length`/`aadt` measures ported to `vocabulary.json` 2026-08-24 (Tier 9), closing the last piece.

`CalloutStatPicker` (Card's hero-stat picker) is a partial precedent — it DOES have a creation path (a
Settings-drawer menu item, `sectionMenuExtensions["Card"]`), just no header pill yet (that part is
Item 4's territory if ever built).

**Still open, not addressed**: a unified "Add Report Section" picker — one coherent UI covering AVL
Graph variants + Route Compare + Reliability + Callout Stat, replacing/extending today's
`AddGraphModal.jsx` (which now has quite a few Table-only sub-toggles stacked in one modal) — a UX
consolidation question, not a missing-capability one anymore. Discussed with Ryan 2026-08-24:
**explicitly deferred to a future UX pass by someone else, not this arc's work.**

---

## Testing / verification requirements (standing convention, kept for future work in this file)

Per this project's standing convention (see `regression-testing-npmrds-reports.md`,
`traversing-report-pages.md`): **the golden-corpus batch check and a `traversing-report-pages.md`
update are mandatory on every RRL/report touch, not optional.** Whenever Item 9 or Item 1 above gets
picked up:

- Run `node scripts/npmrds-reports/probe_corpus.mjs` before starting (baseline) and after the change
  lands.
- Update `src/dms/skills/traversing-dms-pages.md` / `traversing-report-pages.md` in the same session
  if live verification surfaces anything they don't already say.
- Never live-test a multi-step click-path against a page the user might have open — use a dedicated
  scratch report (`converted_reports/claude_scratch_*`), delete after.
- For any item touching `draft_sections`/`sections` directly, confirm via `dms raw get` after each
  live-verify step rather than trusting on-screen state alone.

(Full account of how this convention was applied/deviated-from across Tiers 1-10 — including the
2026-08-24 `probe_corpus.mjs` re-baseline that caught two real harness bugs — is in the archive's
Progress log.)
