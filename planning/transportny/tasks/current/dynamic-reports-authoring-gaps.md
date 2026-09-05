# Dynamic Reports — authoring gaps (route-slot naming, add-slot UX, preview-swap, static↔dynamic conversion)

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS — **item 1 DONE + live-verified
2026-09-05** · **Started:** 2026-09-05

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

## Sub-item 2 — Add Route Slot: reuse vs. distinct (not yet designed in detail)

Today `handleAddRouteSlot` always creates a new distinct group. Needs: a picker (reuse
`RouteTagBrowserModal`'s existing group-list data, or a smaller inline menu) listing the report's
already-added slot groups by their `catalogRouteName`/first-slot name, so an author can either pick
"new distinct route" (today's behavior, unchanged) or "another view of `<existing group>`" — which
sets the new slot's `route_slot_group` to the chosen existing group's key instead of leaving it
unset. Ryan's note (triage doc): "the json-spec layer can already express this" (confirmed above —
`route_slot_group` is a plain spec field already) — so this is very likely UI-only, no new
resolution-side mechanism. Confirm during implementation, not assumed.

## Sub-item 3 — Header preview-swap button (not yet designed in detail)

Add a button to `ReportPageHeader.jsx`, visible in both view and edit mode (same visibility gate as
the "Viewing as of" control — i.e. whenever the report is a Dynamic Report with a `routeSlots`
filter registered, not just when routes are unresolved), that reopens `RouteTagBrowserModal` in
`selectionMode="exact"` / `requiredCount={routeSlotGroups.length}` (same props the entry gate
already uses) pre-populated with the currently-resolved routes, and on a fresh pick, `navigate`s
with an updated `?routes=` — same raw-`location.search` patch approach as "Viewing as of", so
`?asOf=` (if present) survives untouched. No RRL/`persistRoutes` involvement — this never touches
the page's own persisted `routes[]` slot array, purely a URL/view-time swap, same as `?asOf=`.

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

Sub-items 2–3 (not started):
- `ReportRouteList.jsx` — sub-item 2's reuse-vs-distinct picker; may also touch the
  `routeSlotGroups`/`needsRouteSelection` computation if reuse changes group cardinality live.
- `RouteRow.jsx` — sub-item 2's slot-creation entry point if exposed per-row rather than only via
  the top-level "+ Add Route Slot" button.
- `ReportPageHeader.jsx`, `ReportPageHeader.theme.js` — sub-item 3's new button + modal wiring.
- `RouteTagBrowserModal.jsx` — sub-item 3 needs it invokable from outside RRL's entry gate; check
  it doesn't assume it's always the blocking first-load gate.

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

Sub-items 2–4: not started, no checklist yet.

Scratch page: `reports/claude_scratch_pct_template` (id 2218565) — **kept, not deleted, per Ryan's
2026-09-05 call**, for reuse across the rest of this Phase 4 arc. Left in a clean one-slot state.

## Cross-references

- `planning/transportny/tasks/current/npmrds-reports-routes-feedback-triage.md` — parent triage
  doc, Phase 4 section (where this was scoped out of).
- `planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` — the underlying "core
  mechanism DONE" Dynamic Reports build this extends; read before implementing.
- `src/themes/transportny/components/ReportRouteList/README.md` — component's own design history.
