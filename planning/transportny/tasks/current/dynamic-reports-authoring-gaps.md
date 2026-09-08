# Dynamic Reports — authoring gaps (route-slot naming, add-slot UX, preview-swap, static↔dynamic conversion)

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS — **items 1, 2, and 3 DONE +
live-verified** (1 and 3: 2026-09-05; 2: 2026-09-08) · **Started:** 2026-09-05

## Objective

Phase 4 of `npmrds-reports-routes-feedback-triage.md`'s 2026-09-04 feedback batch (Item 2 there),
split into its own file per that doc's own instruction (`dynamic-reports-and-route-tags.md` is
already large; this is new work on top of its "core mechanism DONE" state, not a rework of it).
Four sub-asks, ordered smallest/least-coupled first — same order carried over from the triage doc:

1. `%n`/`%y` route-slot name template substitution; default a new slot's name to `%n`.
2. Add Route Slot UI: let an author mark a new slot as "another date/settings view of an
   already-added route" vs. "a distinct route" — today it's always distinct.
3. Header button (view + edit) that reopens the routes-picker modal to swap the current
   `?routes=` query-param routes, preview-only, no persistence.
4. Bidirectional static↔dynamic conversion (routes ⇄ route slots + URL params). Biggest unknown —
   do last, expect its own design pass before implementation.

Read `dynamic-reports-and-route-tags.md` first for the full mechanism this builds on (route slots,
`route_slot_group`, `useDynamicReportRoutes.js`, the entry gate, Mechanism A/B relative dates) —
not re-derived here.

## Current state (grounded this session, 2026-09-05)

**Route slot naming/resolution today** — no `%n`/`%y` convention exists anywhere in the codebase;
every shipped catalog template (`scripts/npmrds-reports/dynamic_report_specs/*.json`) hand-authors
plain-text slot names ("Current Year", "1 Year Ago", "Trailing 3 Years", "Winter (Avg Day)").
The mechanism this sub-item extends:

- `ReportRouteList.jsx`'s `handleAddRouteSlot` (~line 278) creates a new slot via
  `addRoutes([{ name: `Route Slot ${routes.length + 1}`, isPlaceholderName: true }])` — no
  `route_slot_group` set, so it always falls back to grouping by its own (unique)
  `route_comp_id` → always a distinct group (see sub-item 2).
- `useDynamicReportRoutes.js`'s resolution (~line 106): `isPlaceholderName: true` means the slot's
  `name` is **entirely replaced** by the resolved catalog route's real name at view time;
  `isPlaceholderName: false` (any deliberate rename, even to something generic — see
  `RouteRow.jsx:213-218`) means `name` is authoritative and never touched again.
- `relativeDateResolution.js`'s `resolvedRouteLabel(route)` (line 226) is the **one existing choke
  point** both consumers already share: `ReportPageHeader.jsx`'s routes disclosure (line 341) and
  `useGraphPublish.js`'s chart-legend label (line 113) both call it, so a header pill and its
  chart's legend can never disagree. Today it does exactly one substitution, automatically, with
  no opt-in: if `route.dateFormula` is a **year-span** relative-date formula (`yearof` / `year±N`),
  swap the authored name for the resolved calendar year(s) (`yearRangeForDateFormula`, trailing
  `(NB)`/`(SB)`-style suffix preserved). Day/week/month/calendar-span formulas are untouched.
- The name-edit UI is `RouteRow.jsx`'s title `<input>` (line 318), buffered in `localName`,
  committed on Save (`handleSave`, line 207) — the same buffer/Save-Discard mechanism the
  2026-09-05 Phase 2 follow-up gave dates. This is where an author would type a `%n`/`%y` token.

**Add-slot / entry gate** — `handleAddRouteSlot` (above) is the only place a slot is created; the
Dynamic Report toggle registers a `routeSlots`-typed page filter (`ReportRouteList.jsx` ~line 258)
whose URL values feed `useDynamicReportRoutes`. The entry gate is `RouteTagBrowserModal.jsx`,
opened with `selectionMode="exact"` + `requiredCount={routeSlotGroups.length}` (`ReportRouteList.jsx`
~line 405) — one pick per **distinct group**, not per slot row.

**Preview-swap precedent** — the persistent "Viewing as of" control
(`ReportPageHeader.jsx`, built 2026-09-03, see `dynamic-reports-and-route-tags.md`'s dedicated
section) is the closest existing precedent for sub-item 3: it writes `?asOf=` via `navigate` built
off raw `location.search` (only the touched key rewritten, so `?routes=`'s `|||`-delimited value is
never at risk of being re-encoded), with zero new persistence or page-filter mechanism. Sub-item 3
should follow the identical shape for `?routes=` instead of inventing a new one.

## Sub-item 1 (`%n`/`%y`) — DONE + live-verified 2026-09-05

**Design decisions, confirmed with Ryan before implementing:**
- `%y` computes off any resolved dates (formula-derived or plain literal) — not gated to year-span
  relative-date formulas (the more general of the two options put to him).
- The new-slot default carries **both** tokens: `"%n (%y)"`, not just `%n`.
- Ryan's call, given specs get rebuilt anyway: **retire** the old automatic (non-opt-in) year-formula
  name-swap entirely rather than keep it alongside the new tokens as a second mechanism. Consequence
  (accepted, not fixed this pass): the 4 catalog templates that relied on it (`year_over_year`,
  `annual_average_study`, `single_route`, `monthly_speed_comparisons`'s year-level comps) will show
  their literal spec names ("Current Year", "1 Year Ago"...) until those specs are updated to use
  `%y` explicitly and rebuilt — **explicitly deferred**, Ryan: don't regenerate the official
  templates until all of Phase 4's refactors are done, not per sub-item.

**Implementation:**
- `relativeDateResolution.js` — new `applyNameTemplate(route)`: substitutes `%n`→`route.catalogRouteName`
  and/or `%y`→the resolved year-span of `route.startDate`/`route.endDate` (via a new `yearSpanOf`
  helper, factored out of the old `yearRangeForDateFormula`'s date math). `resolvedRouteLabel()` now
  just calls this, falling back to the bare authored `name` when neither token is present. The old
  `yearRangeForDateFormula`/automatic-swap code is gone (confirmed its only caller before removal).
- `useDynamicReportRoutes.js` — dropped the `isPlaceholderName` full-name-replace special case in the
  resolved-routes merge (`name: slot.name` now, unconditionally) — fully redundant with `%n`/`%y`,
  since the tokens' presence in the string is now the whole signal, no separate boolean needed.
- `ReportRouteList.jsx` — `handleAddRouteSlot`'s default name is now the literal string `"%n (%y)"`.
- `RouteRow.jsx` — removed the now-dead `isPlaceholderName: false` clearing line from `handleSave`.

**Real bug found live, fixed same pass**: the header's per-variant pill (`ReportPageHeader.jsx`,
via `resolvedRouteLabel`) reads route data from `useGraphPublish.js`'s **broadcast catalog**
(`ROUTE_CATALOG_PARAM_KEY`), not from `effectiveRoutes` directly — that catalog object explicitly
whitelists which fields it carries, and `catalogRouteName` wasn't one of them (it only fed
`baseRouteName`, a different field). Never mattered under the old automatic swap (which didn't need
`catalogRouteName`), but is exactly what `%n` needs. Fixed in `useGraphPublish.js` by also carrying
`catalogRouteName` on the broadcast catalog entry itself. The chart-legend consumer (same file, the
`resolvedRouteLabel(route)` call inside `transformReportRoutes`) reads `effectiveRoutes` directly and
already had the field — unaffected.

**Live-verified** on a scratch Dynamic Report (`reports/claude_scratch_pct_template`, page id
2218565, built via `report_build.mjs` from a throwaway one-route-slot spec — **kept, not deleted,
per Ryan's call, for reuse across the rest of this Phase 4 arc**):
- Resolved view (`?routes=2207838&asOf=2026-07-23`, a real TMC route/date already used elsewhere in
  this arc): header pill and chart legend both read
  `35E 36081 Queens Midtown Expy Westbound (2024) (2026)` — `%n` and `%y` both substituted, header
  and legend agree (the whole point of the shared `resolvedRouteLabel` choke point).
- Unresolved/raw-authoring view (no `?routes=`): RRL's row list shows the literal stored template
  (`"%n (%y)"`) unresolved — correct, RRL edits the template rather than a resolved value; the
  header's own preview pill shows just `(2026)` (`%n` empty since no real route is picked yet, `%y`
  still resolves off the slot's own formula-derived dates) — self-consistent, no crash.
- Clicked "+ Add Route Slot" live 3 times: each new slot's stored `name` was confirmed (via direct DB
  read) to be `"%n (%y)"`, with `addRoutes`' existing dedup suffixing working unchanged
  (`"%n (%y) (2)"`, `"(3)"`, `"(4)"`) — extra test slots removed afterward, scratch page left with
  one clean slot for the next sub-item.
- 0 console/page errors throughout (`report_probe.mjs` + live browser console checks).

**Found, not fixed (unrelated to this change, flagged for awareness)**: `report_build.mjs`'s fresh
page-create path created all 3 sections (ReportPageHeader/ReportRouteList/the one graph) as rows but
only attached the LAST one to the new page's `draft_sections` array — the other two existed in the DB
but never rendered until manually patched via `dms raw update` on this one scratch page. Pre-existing
in the script (nothing in this sub-item touches `report_build.mjs`), not chased further — out of
scope here, worth a look if it recurs on a real build.

**Golden-corpus regression note**: `probe_corpus.mjs` currently fails on every entry, including
plain static graphs with zero relation to route naming — isolated via `git stash` (stashed this
sub-item's 4 edited files, reran, identical failures on the clean tree) to confirm this is a
pre-existing environment/baseline-staleness issue, not caused by this change. Not investigated
further as part of this pass; the targeted live-verification above stands in for it this round.

## Sub-item 2 — Add Route Slot: reuse vs. distinct — DONE + live-verified 2026-09-08

Confirmed UI-only, exactly as scoped: `route_slot_group` was already a fully working field on both
the resolution side (`useDynamicReportRoutes.js`) and the persistence side (`addRoutes` already
spreads arbitrary passthrough fields into a new slot) — real converter output (`transforms.py`)
already produces this shape for old templates like "Year Over Year" (11 comps, one shared
`routeId`/group, each with its own `dateFormula`). Zero resolution/persistence/converter changes.

**Design decisions, confirmed with Ryan before implementing:**
- Entry point: an inline `<select>` next to "+ Add Route Slot" (not a modal, not a per-row action)
  — matches the existing plain-`<select>` vocabulary the date-derive UI already uses
  (Derive-From/Pattern/Span/Direction). Only rendered once `routeSlotGroups.length > 0` — the first
  slot on a report is always new, nothing to reuse yet.
- Group labels: **positional** (`"Slot group 2 (3 views)"`), not the group's real route name — at
  authoring time there's no `?routes=` yet, so no `catalogRouteName` has resolved; a group's own
  slots may still carry the literal, unresolved `%n (%y)` template string, which would be a
  confusing label.
- A visual "shares this route with: ..." indicator on grouped rows — approved as in-scope, reusing
  `RouteRow.jsx`'s existing `derivedFromRouteName`/`baseForNames` disclosure vocabulary
  (`t.dependentsRow`/`t.dependentsToggle`/`t.dependentsPillList`/`t.miniPill`) rather than new
  tokens.

**Implementation:**
- `ReportRouteList.jsx` — `newSlotGroupChoice` state (`''` = new route, reset after every add);
  `routeSlotGroupOptions` (positional labels, built from raw `routes` + `routeSlotGroupKey`);
  `handleAddRouteSlot` threads `route_slot_group` through to `addRoutes` only when a group was
  chosen (empty choice reproduces the original call byte-for-byte); the select itself, rendered
  next to "+ Add Route Slot" inside the `isDynamicReport` branch; `groupSiblingNamesByCompId` (a
  `baseForNamesByCompId`-shaped lookup, built off `effectiveRoutes` so it works identically for raw
  authoring and a resolved preview — `resolveRouteDates` is an identity-stable pass-through for
  `route_slot_group`, confirmed by reading it, not assumed) passed to each `RouteRow` as
  `sameGroupSiblingNames`.
- `RouteRow.jsx` — new `groupOpen` disclosure state; a "shares this route with N other view(s)"
  block at the top of `expandedContainer` (before the date-span block — identity, not dates, so it
  comes first), reusing the "base for N routes" pattern's exact theme tokens.
- `ReportRouteList.theme.js` — one new token, `addSlotGroupSelect` (matches `dateFieldInput`'s
  vocabulary, sized to `addRouteBtn`'s `h-8`).
- Both edited component files syntax-checked with `esbuild` before live-verifying.

**Live-verified** on the same kept scratch Dynamic Report as sub-items 1 and 3
(`reports/claude_scratch_pct_template`, page id 2218565, `?routes=2216791` = "Route 5 Part"):
- Select rendered "New route" + "Slot group 1 (1 view)" (`value="comp-4"`, the existing slot's own
  fallback group key) — confirmed via direct DOM read (`document.querySelectorAll('select')`), not
  just visually.
- Chose the existing group, clicked "+ Add Route Slot": new slot (`comp-5`) persisted with
  `route_slot_group: "comp-4"` — confirmed via direct DB read (`dms dataset query`). RRL's own
  panel count went to 2 (raw slot count, unaffected by grouping, as designed); the header's "N
  routes in this report" stayed at **1** (`routeGroups.length`, sub-item 3's own count) — the first
  real cross-test of sub-item 3 against a 2-groups-sharing-a-slot report, flagged as untested in
  sub-item 3's own checklist below.
- "Change Routes" (sub-item 3's header button) opened asking for exactly **1** more route
  (`requiredCount = routeSlotGroups.length = 1`), not 2 — confirms `needsRouteSelection`/the entry
  gate correctly treat 2 grouped slots as one pick.
- Resolved both slots against the real catalog route "Route 5 Part": header pill/title and both
  RRL rows' `%n` substitution all read "Route 5 Part," `%y` differing per slot's own date span
  (2026 vs. 2026, both same year this round — the two slots' underlying dates weren't deliberately
  offset, not a defect); collapsed-row TMC/mileage (6 TMCs · 5.3 mi) picked up correctly on both
  rows post-resolution.
- "Shares this route with 1 other view" disclosure confirmed on **both** rows (bidirectional, not
  just the newly-created one) — expanding it showed the sibling's raw stored name (not run through
  `resolvedRouteLabel`, same convention `baseForNames` already uses for the identical reason —
  worth a future look if it reads confusingly once both are `%n`/`%y` templates, not fixed here).
- Cleanup: discarded the edit-mode buffer, removed the added `comp-5` slot, confirmed via a second
  DB read the scratch page is back to its documented single-slot state (`comp-4`, no group) — left
  exactly as sub-item 3 left it, for reuse by sub-item 4.
- 0 console errors, confirmed on a **fresh page load** (console tracking only captures from when
  the tool is first called, so re-loaded before the pass specifically to catch load-time errors,
  not just interaction-time ones).
- `traversing-report-pages.md` updated (living-document convention) — new §5 gotcha: driving a
  plain `<select>` via `claude-in-chrome`'s `computer` tool doesn't work (native OS dropdown, not
  screenshot/click-able); read/set via `javascript_tool` with React's controlled-input path
  (native property setter + `dispatchEvent('change')`) instead of a bare `.value =`.

### Sub-item 2 follow-up (2026-09-08, same day): no auto-expand + a light group border replaces the disclosure

Two more rounds of Ryan's live feedback, same session:

1. **Newly added routes/slots should land collapsed (view mode), not auto-expanded into edit
   mode.** This **reverses** the 2026-08-19 item 4A decision ("auto-expand a newly added route so
   the author lands straight on its date editor"), and Ryan explicitly widened it beyond just
   sub-item 2's own new select: "a route in general I guess" — so it applies to BOTH
   `handleAddRouteSlot` (Dynamic Reports) and `handleConfirmAddRoutes` (the static "+ Add Route"
   multi-select flow). Flagging the reversal explicitly rather than treating it as a bug, per this
   doc family's own convention (see `npmrds-reports-routes-feedback-triage.md`'s "Phase 2
   follow-up" for the identical treatment of an earlier reversal). Both handlers' `setExpandedRoutes`
   calls are simply gone — `RouteRow`'s own `isExpanded` prop already defaults every row to
   collapsed, nothing else needed.
2. **The original "shares this route with N other views" indicator was invisible while collapsed,
   and Ryan found the wording unclear even when he did see it** ("even I don't know what that
   means??"). His own proposed fix: "some LIGHT visual border, or something, that shows the
   groups." Redesigned:
   - `ReportRouteList.jsx`'s `groupSiblingNamesByCompId` became `routeGroupInfoByCompId` — one
     combined map (siblings AND a shared colour, built off one grouping pass instead of two) keyed
     by `route_comp_id`, value `{ siblingNames, color } | undefined`. `color` is the group's
     earliest-added member's own identity colour, reused directly rather than minting a second
     palette — a group's anchor row's own colour dot and its border always match.
   - `RouteRow.jsx` applies `color` as an inline `borderLeftColor` on the row's own outer wrapper
     (`rowStyle`) — visible in BOTH collapsed and expanded states, the "glanceable without opening
     anything" fix. `ReportRouteList.theme.js`'s `row`/`rowOpen` tokens gained a permanent, reserved
     `border-l-[3px] border-l-transparent` baseline so an ungrouped row's width never shifts
     relative to a grouped sibling elsewhere in the list — only the colour is conditional.
   - The click-to-expand disclosure (`groupOpen` state, `dependentsRow`/`dependentsToggle`/
     `dependentsPillList`/`miniPill` reuse) is gone — replaced with one always-shown (no toggle)
     plain sentence, still expanded-state-only (`"● Same route as X — just its own dates."`, new
     `t.groupNote`/`t.groupNoteDot` tokens, the dot repeating the same border colour) — clearer
     wording, and simpler code (one fewer piece of state).

**Live-verified** on the same kept scratch report, same recipe as sub-item 2's original pass (add a
slot reusing the existing group via the select, screenshot, discard/remove, confirm DB back to the
original single-slot state):
- New slot landed collapsed (pencil-icon view state, not the name `<input>`/Save-Discard header) —
  confirmed visually, both for the reuse-a-group add and (by code inspection — the same removed
  `setExpandedRoutes` call, not independently re-clicked this round) the static "+ Add Route" path.
- Both rows (the pre-existing anchor and the new grouped sibling) showed the same green left-border
  accent, collapsed AND expanded — confirmed via a zoomed screenshot.
- Expanded the new row: the flat "Same route as %n (%y) (2) — just its own dates." note rendered
  with a matching colour dot, no toggle.
- 0 console errors. Cleanup: discarded the edit buffer, removed the added slot, confirmed via a
  fresh DB read the scratch report is back to its single-slot (`comp-4`, no group) state.

## Sub-item 3 — Header preview-swap button — DONE + live-verified 2026-09-05

**Real gap found while scoping, fixed as a prerequisite**: `ReportPageHeader.jsx` has no join
source of its own configured (confirmed via `dms raw get` on the header section's `element-data` —
no `join` key at all, unlike RRL's own section, which has the "Routes Data" source/view
2107426/2107427 bound), so it had no `routeSourceInfo` to hand `RouteTagBrowserModal` and couldn't
open a real picker. Rather than requiring every report (old and new) to get a second, redundant
"Add Join Source" binding added to its header section, RRL now broadcasts its own `routeSourceInfo`
the same way it already broadcasts the route catalog — new `ROUTE_SOURCE_INFO_PARAM_KEY`
(`useGraphPublish.js`), a second `isEqual`-guarded effect alongside the existing catalog broadcast,
gated on `routeSourceInfo` itself having resolved. `ReportRouteList.jsx` passes its own
`routeSourceInfo` into `useGraphPublish` for this. Zero authoring changes needed on any existing
report — works immediately everywhere RRL is already the sidebar.

**Second real gap found + fixed in the same pass**: the broadcast route catalog
(`ROUTE_CATALOG_PARAM_KEY`) never carried each entry's real catalog `id` — harmless for its
original two consumers (the header's routes disclosure, the chart legend), which only ever display
a route, never re-identify one. This header button needs `.id` to pre-populate
`RouteTagBrowserModal`'s selection (keyed by `.id`) and to build the `?routes=` id list on confirm.
Added `id: r.id` to the catalog map in `useGraphPublish.js`.

**Implementation** (`ReportPageHeader.jsx`): reads `isDynamicReport` (a `type: 'routeSlots'` page
filter, same test RRL's own uses) and the broadcast `routeSourceInfo`. A "Change routes" button
renders next to the existing "N routes in this report" toggle, whenever `isDynamicReport &&
routeGroups.length > 0` (nothing to swap when the report has zero route slots yet) — disabled with
a tooltip if `routeSourceInfo` hasn't broadcast yet. Clicking it opens `RouteTagBrowserModal` with
`selectionMode="exact"` / `requiredCount={routeGroups.length}` (identical props to the entry gate),
pre-populated via a small derived array (`swapInitialRoutes` — `routeCatalog` with each entry's
`name` run through `resolvedRouteLabel` first, so the modal's selected-chip shows the same resolved
display name the header/legend already show, not an unresolved `%n`/`%y` template literal — found
live, fixed same pass). On confirm, `handleRouteSwapConfirm` rewrites `?routes=` via the identical
raw-`location.search`-patch approach `handleAsOfChange` ("Viewing as of") already uses, so a
sibling `?asOf=` survives untouched. No RRL/`persistRoutes` involvement — purely a URL/view-time
swap, never touches the page's own persisted `routes[]` slot array.

**Live-verified** on the same kept scratch Dynamic Report as sub-item 1
(`reports/claude_scratch_pct_template`, page id 2218565, real URL:
`localhost:5173/npmrds/reports/claude_scratch_pct_template?routes=2207838&asOf=2026-07-23` — the
`/npmrds` path-mount prefix is required, already documented in `traversing-dms-pages.md`'s §4
subdomain/mount gotcha):
- Button renders next to "1 route in this report", opens the modal with the current route
  pre-selected (chip read `"35E 36081 Queens Midtown Expy Westbound..."`, the resolved name, not
  the raw `%n (%y) (2)` template — confirms the chip-label fix), full real route search/browse
  working (60 routes, tag facets, "Best match" sort) — confirms `routeSourceInfo` actually resolved
  and the query against the real "Routes Data" catalog works.
- Deselected the current route, selected "Route 5 Part" (a different real catalog route, 6 TMCs),
  confirmed "Add 1 Route" → URL became `?routes=2216791&asOf=2026-07-23` (`asOf` untouched), header
  pill + title + chart legend all updated to "Route 5 Part" in the same render, with genuinely
  different ClickHouse data plotted (confirms this isn't just a label swap).
- Reloaded with the ORIGINAL `?routes=2207838` — resolved back to the original route exactly as
  before, proving the swap never persisted anything to the report's own storage.
- Regression check: `reports/beacon_9_d_jan_25_vs_26` (a real, published, unmodified STATIC report)
  shows "1 route in this report" with **no** "Change routes" button next to it — confirms the
  `isDynamicReport` gate correctly hides this for every non-Dynamic-Report page.
- 0 console errors across every navigation in this pass.

## Sub-item 4 — Bidirectional static↔dynamic conversion (deferred, own design pass)

Not scoped beyond the triage doc's framing: a 1:1 mapping between a static report's `routes[]`
(concrete tmc_array/dates baked in) and a Dynamic Report's route slots + `?routes=` URL params, so
toggling the "Dynamic Report" switch (`ReportRouteList.jsx`'s existing `toggleDynamicReport`,
~line 245) preserves what's currently displayed instead of leaving stale hardcoded routes (dynamic
→ static) or empty/unresolved slots (static → dynamic). Explicitly the biggest unknown in this
batch — do not start until 1–3 are done and until this gets its own scoping/design session.

## Files touched / likely touched

Sub-item 1 (DONE — see above):
- `src/themes/transportny/components/ReportRouteList/relativeDateResolution.js` — `%n`/`%y`
  substitution (`applyNameTemplate`), `resolvedRouteLabel` rewritten around it, old automatic
  year-formula swap removed.
- `src/themes/transportny/components/ReportRouteList/useDynamicReportRoutes.js` — dropped the
  `isPlaceholderName` full-replace special case.
- `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` — `handleAddRouteSlot`
  default name.
- `src/themes/transportny/components/ReportRouteList/RouteRow.jsx` — dropped dead
  `isPlaceholderName` clearing line.
- `src/themes/transportny/components/ReportRouteList/useGraphPublish.js` — **not originally
  scoped for sub-item 1**, but needed: added `catalogRouteName` to the broadcast route catalog so
  `%n` resolves for the header's pill consumer, not just the chart-legend consumer.

Sub-item 3 (DONE — see above):
- `ReportPageHeader.jsx` — `isDynamicReport`/`routeSourceInfo` derivation, `swapInitialRoutes`,
  `handleRouteSwapConfirm`, the "Change routes" button, and the `RouteTagBrowserModal` render.
  Imports `RouteTagBrowserModal` and `ROUTE_SOURCE_INFO_PARAM_KEY` — **not** originally scoped to
  need `RouteTagBrowserModal` invokable from outside RRL's entry gate at all; turned out to just
  work unmodified (`dismissible` defaults `true`, no assumption inside it about being a blocking
  gate) once fed a real `routeSourceInfo`.
- `ReportPageHeader.theme.js` — new `routesToggleRow`/`changeRoutesBtn`/`changeRoutesIcon` tokens.
- `useGraphPublish.js` — **not originally scoped for sub-item 3**, but needed: added `id: r.id` to
  the broadcast route-catalog entries, and a new broadcast key (`ROUTE_SOURCE_INFO_PARAM_KEY`) +
  effect carrying RRL's own `routeSourceInfo` so the header never needs its own join-source binding.
- `ReportRouteList.jsx` — passes its own `routeSourceInfo` into `useGraphPublish`.

Sub-item 2 (DONE — see above):
- `ReportRouteList.jsx` — `newSlotGroupChoice` state, `routeSlotGroupOptions`, the select JSX,
  `handleAddRouteSlot`'s `route_slot_group` passthrough, `groupSiblingNamesByCompId`.
- `RouteRow.jsx` — `groupOpen` state + the "shares this route with" disclosure block. Entry point
  ended up staying top-level (the inline select), not per-row — see the design-decision note above.
- `ReportRouteList.theme.js` — new `addSlotGroupSelect` token.

## Testing checklist

Sub-item 1:
- [x] Golden-corpus regression attempted (`probe_corpus.mjs`) — found unrelated pre-existing
  failures on every entry, isolated via `git stash` to confirm not caused by this change (see
  above); not a clean pass either way, targeted live-verification used instead this round.
- [ ] All 12 existing catalog templates' resolved names/legends re-checked live once rebuilt with
  the new mechanism (not done this pass — Ryan's call, rebuild happens once all of Phase 4 lands).
- [x] A fresh scratch Dynamic Report: new slot defaults to `"%n (%y)"`, confirmed live + via direct
  DB read, 3 times (dedup-suffixed correctly each time).
- [x] `%n`+`%y` together, resolved: confirmed against a real route (header pill + chart legend
  agree). `%y` alone, unresolved (no real route picked yet): confirmed shows just the year, no crash.
- [ ] `%y` on a plain-literal-dates (non-formula) slot specifically — not yet exercised (the scratch
  slot used a `dateFormula`); the code path is identical regardless (`yearSpanOf` only reads
  `startDate`/`endDate`), so this is expected to work, just not separately clicked-through.

Sub-item 3:
- [x] Button renders next to "N routes in this report", only when `isDynamicReport &&
  routeGroups.length > 0` — confirmed present on the Dynamic Report scratch page, confirmed absent
  on a real static report (`reports/beacon_9_d_jan_25_vs_26`).
- [x] Opens pre-populated with the current route, resolved-label chip (not the raw `%n`/`%y`
  template).
- [x] Full route search/browse works inside the modal (confirms the broadcast `routeSourceInfo`
  resolves and queries the real catalog).
- [x] Confirm swap rewrites `?routes=`, preserves `?asOf=`, updates header pill/title/chart legend
  live with genuinely different data.
- [x] No persistence: reloading with the original `?routes=` resolves back to the original route.
- [x] 0 console errors across every navigation exercised.
- [x] Cross-tested against a report with 2 slots sharing 1 group (2026-09-08, once sub-item 2
  shipped): "Change Routes" correctly asked for 1 pick, not 2 — `requiredCount` counts groups, not
  raw slots. Still not tested against 2+ DISTINCT groups (e.g. a real NB/SB Dynamic Report) — no
  such scratch report exists yet.

Sub-item 2:
- [x] Select renders "New route" + one option per existing group, positional label, once
  `routeSlotGroups.length > 0`; hidden on the very first slot (nothing to reuse yet) — confirmed via
  direct DOM read of the select's options.
- [x] Choosing an existing group and adding a slot persists `route_slot_group` matching the chosen
  key — confirmed via direct DB read.
- [x] Grouped slots resolve against the same real catalog route at view time; `%n` agrees across
  both, `%y` reflects each slot's own date span; collapsed-row TMC/mileage populates on both once
  resolved.
- [x] Header's "N routes in this report" / "Change Routes" `requiredCount` both correctly count 2
  grouped slots as 1 (see sub-item 3's checklist above — this is that cross-test).
- [x] "Shares this route with N other view(s)" disclosure appears on both sides of a group
  (bidirectional), expands to show the sibling's name.
- [x] Cleanup round-trip verified: remove one of two grouped slots, confirm via DB read the report
  is back to its exact original single-slot state.
- [x] 0 console errors on a fresh page load through the full add-with-reuse flow.
- [ ] Not tested: 3+ slots in one group (only 2 were exercised); a group with slots that have
  genuinely different resolved years (only same-year slots were available on the scratch report
  this round, so `%y` differing across siblings wasn't visually exercised, just reasoned about from
  the code path being identical to sub-item 1's already-verified `%y` logic).

Sub-items 2 and 4: not started, no checklist yet.

Scratch page: `reports/claude_scratch_pct_template` (id 2218565) — **kept, not deleted, per Ryan's
2026-09-05 call**, for reuse across the rest of this Phase 4 arc. Left in a clean one-slot state.

## Cross-references

- `planning/transportny/tasks/current/npmrds-reports-routes-feedback-triage.md` — parent triage
  doc, Phase 4 section (where this was scoped out of).
- `planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` — the underlying "core
  mechanism DONE" Dynamic Reports build this extends; read before implementing.
- `src/themes/transportny/components/ReportRouteList/README.md` — component's own design history.
