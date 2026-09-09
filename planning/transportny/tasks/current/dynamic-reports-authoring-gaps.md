# Dynamic Reports — authoring gaps (route-slot naming, add-slot UX, preview-swap, static↔dynamic conversion)

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS — **all four sub-items DONE +
live-verified** (1 and 3: 2026-09-05; 2: 2026-09-08; 4: 2026-09-09). **All 12 catalog templates
regenerated + republished 2026-09-08** (see "Catalog regeneration" under sub-item 1 below) — the
deferral note that originally blocked this is superseded by Ryan's explicit go-ahead. A second real
bug (route-name dedup wrongly suffixing `%n`/`%y` templated names) found + fixed same day, 8
templates re-published again — see "Dedup-suffix bug on templated names" below. **Two more bugs
found, both FIXED + live-verified 2026-09-08** — same root cause (graph title/caption text baked as
a static string at build time instead of resolving live): difference-graph captions on 3 templates
(`seasonality`/`single_day_advanced`/`single_route`), and all 14 of `bi_directional`'s graph titles
hardcoding an unenforced "Northbound"/"Southbound" claim — see "Combined fix — scoped + built +
live-verified 2026-09-08" under sub-item 1 below for the full design + live-verification. **Sub-item
4 (bidirectional static↔dynamic conversion) built + live-verified 2026-09-09** — see its own section
for the full design, Ryan's 3 answered open questions, implementation, a real bug found + fixed
during live-verification (frozen `%n`/`%y` tokens going permanently blank), and the verification
record. · **Started:** 2026-09-05

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

### Catalog regeneration — all 12 templates — DONE + live-verified 2026-09-08

Ryan's explicit go-ahead, reversing the deferral above: regenerate and publish now rather than
waiting for all of Phase 4 (item 4 is still unbuilt, but confirmed to touch neither
`dynamic_report_specs/*.json` nor `report_build.mjs`, so it doesn't block this).

**Audit before touching anything**: the deferral note above named only 4 templates as relying on
the retired auto year-swap. Re-verified against the actual retired regex (`RELATIVE_DATE_REGEX`'s
`span` group, git history `fe0064fe~1`) — the swap fired for **any** year-span `dateFormula`
(`yearof`/`year±Nyear->Myear`), which turned out to hit **all 12** templates, not just 4. Fixed:
every year-formula route slot, in every template, renamed to `%n (%y)` (Ryan's call — keep it
basic, don't build fancier date-granularity tokens now; day/week/month/calendar-position slots like
"Yesterday"/"January"/"This Month" are untouched — `%y`'s year-only granularity would have made
sibling slots in `monthly_congestion` (12 months), `one_week_study` (5 day-slots),
`seasonality` (4 seasons) and `single_day_advanced` (6 incident-window slots) collapse into
identical labels, since most fall within the same year — that's a real information-loss bug, not
a style choice, so those slots keep their literal descriptive names for now).

**`bi_directional`'s `(NB)`/`(SB)` suffixes dropped entirely** — `%n` already carries the real
picked route's own name/direction, so the suffix was redundant once templated.

**`seasonality`'s `winter_weekday` route retired** (Ryan's ask: audit every template for a route
slot made redundant by the routeWindows migration — same dates + same `route_slot_group`,
differentiated only by resolution prose). Found exactly one instance, confirmed vestigial by the
spec's own comments: `bar_weekday_allseasons`'s "why" field already documented that Spring/Summer/
Fall's equivalent dedicated weekday sub-routes were deleted and replaced with `resolution:
"weekday"` applied directly to the shared season route — `winter_weekday` (feeding only
`bar_weekday_winter`) was the one never cleaned up. Fix: deleted the route, added
`bar_weekday_winter` to the `winter` route's own `graphs[]` list (identical pattern to
`bar_weekday_allseasons`). Also stripped the dead `(Avg Day)`/`(Weekday)` resolution-prose suffix
from `current_year`/`winter`/`spring`/`summer`/`fall`'s names (Ryan's point 1: resolution now lives
on the graph, not the route) — `winter`/`spring`/`summer`/`fall` are calendar-position formulas, not
year-formulas, so they keep plain literal names (`"Winter"`, not `%n (%y)`), just without the
prose.

**Rebuilt + published all 12** via `report_build.mjs <spec> --update <slug> --publish`: `year_over_
year`, `annual_average_study`, `single_route`, `monthly_speed_comparisons`, `bi_directional`,
`monthly_congestion`, `one_week_study`, `seasonality`, `single_day_advanced`, `snapshot`,
`this_month_vs_last_month_vs_last_year`, `weekly_average` — all 12 passed the script's own
structural checks, each revision log showing exactly the intended routes modified (and, for
`seasonality`, `route winter_weekday removed`) and nothing else.

**Verified**: `report_probe.mjs --auth` on all 12 — 0 console/page/sql errors across every one
(all hit the unresolved "Add Routes" entry gate in that automated pass, so this only proves no
JS crashes, not real-data rendering). Followed with a live `claude-in-chrome` check against a real
picked route (catalog id 2216791, "Route 5 Part") on `seasonality` and `year_over_year`: route pills
correctly read `"Route 5 Part (2026)"` (%n+%y both substituted), season pills read plain
`"Winter"`/`"Spring"`/`"Summer"`/`"Fall"` (no more resolution prose), and `seasonality`'s
previously-empty graphs (`Daily Hours of Delay`, `Avg. Hours of Delay per Season by 5-Min`)
rendered real data once a route was actually picked — confirming those were just the expected
unresolved-entry-gate state, not a regression. `year_over_year`'s 4 slots initially resolved to
`"Route 5 Part (2026)"`/`"(2025) (2)"`/`"(2024) (3)"`/`"(2024–2026) (4)"` — the `(N)` suffix turned
out to be a **real bug**, not a pre-existing disambiguator; see the dedup fix below (same-day,
same session).

### Dedup-suffix bug on templated names — found + fixed 2026-09-08

Ryan noticed the `(N)` suffixes on `year_over_year`'s pills and asked why, since `%n (%y)` already
resolves to distinct text per slot (different years). Root cause, confirmed by direct code
reading: `report_build.mjs:705-733` builds a `Set` of every route's **literal, unresolved** `name`
string before persisting, and appends `" (2)"`/`" (3)"`/etc. whenever it sees a repeat — this exists
because a route's stored name doubles as the SQL-alias/legend/color series key, so two routes
persisted under the identical name risk actually collapsing into one series. It has zero awareness
that `%n`/`%y` tokens will differentiate the *resolved* output later — 4 routes all literally named
`"%n (%y)"` look exactly like 4 routes literally named `"Untitled Route"`. The suffix gets baked
into the **stored** name (`"%n (%y) (2)"`), and `applyNameTemplate`'s substitution runs on top of
that, which is why the rendered pill showed `"Route 5 Part (2025) (2)"` rather than a bare `(2)`.
The identical logic, independently duplicated, also lives in the live UI's add-route-slot path
(`useReportRow.js:392-398`, `dedupeAgainst`) — sub-item 1's own doc had actually documented this
firing as expected/working, not flagged as a mismatch with the new templating feature.

**Scope**: 8 of the 12 rebuilt templates had 2+ slots sharing the identical literal `"%n (%y)"`
string and so hit this: `year_over_year`, `annual_average_study`, `single_route`,
`weekly_average`, `monthly_speed_comparisons`, `snapshot`, `monthly_congestion`, and worst-case
`bi_directional` (all 8 NB+SB slots chained together, `(2)` through `(8)`, since NB/SB aren't
scoped separately by this check). Not affected: `seasonality`, `single_day_advanced`,
`this_month_vs_last_month_vs_last_year`, `one_week_study` (only one year-formula slot each, nothing
to collide with).

**Fix**: skip the dedup/suffix whenever the candidate name contains `%n` or `%y` — one-line guard
at both call sites (`report_build.mjs:725` `isTemplated` check; `useReportRow.js:393`'s
`dedupeAgainst`). Checked before applying: none of the 8 templates have two slots sharing both the
same template *and* the same `dateFormula` (each year-offset is intentionally distinct), so there's
no real duplicate-series risk introduced in any of today's 12 templates — the only residual risk is
a hypothetical future author creating two genuinely identical templated+dated slots, the same
pre-existing category of risk this dedup exists for generally.

Rebuilt + republished all 8 affected templates via `report_build.mjs --update <slug> --publish`.
**Verified**: direct DB read of `year_over_year`'s persisted `routes[]` — all 4 entries now store
the literal `"%n (%y)"` with zero suffix. Live `claude-in-chrome` check on
`reports/year_over_year?routes=2216791`: pills read `"Route 5 Part (2026)"`, `"(2025)"`, `"(2024)"`,
`"(2024–2026)"` — clean, no `(N)` suffixes, real map/legend data rendering. (The revision log for
this rebuild says "no detected change" for all 8 — that's `diffSpecs` comparing the raw `_spec`
JSON, which is unchanged since this fix lives in the build script, not the spec files; the actual
persisted `routes[]` field is confirmed changed via the direct DB read above.)

### Static graph text vs. live route resolution — two bugs found, NOT fixed, needs one scoping pass

**Bug A — difference-graph caption, found 2026-09-08 (Ryan's call: skip the quick fix, this needs
the real fix, not a patch)**: `seasonality`'s 4 difference-mode
graphs (`diff_winter`/`diff_spring`/`diff_summer`/`diff_fall`) show a literal, unsubstituted
`"Base: %N (%Y) · Comparison: Winter"` subtitle instead of a resolved name. Root cause:
`report_build.mjs`'s difference-graph caption builder (~line 1174) bakes
`anchorRoute.name`/`compareRoutes.map(r => r.name)` into a **static string at build time** — a
third route-name consumer sub-item 1 never touched (it lives in `report_build.mjs`, not
`relativeDateResolution.js`), and unlike the header pill/RRL row/chart legend, it never re-resolves
live. Before this rename it baked in generic-but-readable text ("Base: Current Year (Avg Day)");
now it bakes in raw token syntax. Affects 3 templates' diff-mode graphs: `seasonality` (4 graphs,
anchor `current_year`), `single_day_advanced` (1 graph, compare-side `year`), `single_route` (1
graph, both anchor and compare sides).

A quick fix was floated (swap in the already-imported `resolvedRouteLabel` at that call site —
provably safe for every other report, since it falls through to the original name whenever no
`%n`/`%y` token is present) but **explicitly rejected**: at build time there's no real picked
route and no resolved date window yet (a `dateFormula` route never gets literal dates until live
view-time resolution), so `%n`/`%y` would both come back empty and the caption would become
`"Base:  () · Comparison: Winter"` — a cosmetic patch, not a real fix. **What's actually needed**:
make this caption live-resolving like the other three consumers (header pill/RRL row/chart legend),
which means it can no longer be a static string baked once at build time — touches the render
pipeline (`graph_new`/`GraphComponent.jsx`'s difference-mode subtitle path), not just
`report_build.mjs`. Not scoped yet — needs its own pass (open questions: does the render layer even
have access to `effectiveRoutes` at the point this subtitle renders, or does it need threading
through; should a static report's difference caption stay build-time-baked since its names are
already real forever, with only the Dynamic Report path made live).

**Bug B — `bi_directional`'s graph titles hardcode an unenforced direction claim, found
2026-09-08.** All 14 of `bi_directional.json`'s graph titles bake in "Northbound"/"Southbound"
literally (`"Hours of Delay - Northbound"`, `"Route Compare Component - Southbound"`, etc.) —
but nothing in the platform enforces that the two route groups an author picks at view time are
actually opposite directions of the same corridor; they could pick the same route for both, or two
unrelated routes entirely. **Proven live**: picked the identical real route (`2216791`, "Route 5
Part") for both the NB and SB groups via `?routes=2216791|||2216791` — both sets of graphs still
confidently labeled themselves Northbound/Southbound. Scanned all 12 templates' graph titles for
directional language (`north|south|east|west|nb|sb|eb|wb`) — **only `bi_directional` has this**,
none of the other 11 assert anything about route identity in a title (their titles reference time
windows like "Trailing 3 Years," which stay accurate regardless of which real route fills a slot).
Checked route→graph bindings: every one of the 14 graphs draws from exactly one route group each
(never mixes NB+SB into one graph), so a `%n` token in the title would be completely unambiguous —
`"Hours of Delay - %n"` would cleanly resolve to whichever real corridor the author picked.

**Same root cause as Bug A**: a graph's `title` (like its `caption`) is a static string baked once
at build time (`report_build.mjs`) and never re-resolves live — `%n`/`%y` tokens in a title would
suffer the identical empty-token problem a build-time quick-fix would have for captions. **Do not
fix these as two separate patches** — one mechanism ("live-resolve `%n`/`%y` in any graph-rendered
text sourced from the spec — title or caption") covers both. Of the two, Bug B is the more valuable
half to build first: it's the only thing standing between `bi_directional` and being a trustworthy
template (an author *will* eventually pick non-directional or swapped routes and get a visibly
wrong title), whereas Bug A only degrades a subtitle's cosmetics. **TODO: scope and build this
combined fix soon** — open questions: does the render layer even have access to `effectiveRoutes`
at the point titles/captions render, or does it need threading through; should a static report's
titles/captions stay build-time-baked (their route identity is real and permanent) with only the
Dynamic Report path made live.

### Combined fix — scoped + built + live-verified 2026-09-08

Traced the actual render pipeline by reading the real files (not guessed) to answer both open
questions above. No code written this pass — this is scoping only.

**Two separate render sites, not one:**
- **A) Section-level `title`** (bi_directional's 14 hardcoded "Northbound"/"Southbound" strings) is
  generic DMS-core, section-type-agnostic code: `report_build.mjs`'s `graphSectionData()` (~line
  1574) writes it into the section row's `element-data.title`; rendered by `TitleComp` in
  `src/dms/packages/dms/src/patterns/page/components/sections/section_components.jsx:24-27`,
  invoked from `SectionView` in `section.jsx:385,552-558`. (Per `report_build.mjs:1159-1166`'s own
  comment, this section title is deliberately the ONLY place a graph's title shows —
  `state.display.title` is left blank on purpose to avoid doubling it.)
- **B) Difference-mode `caption`** (`state.display.description`, the "Base: X · Comparison: Y"
  string, baked at `report_build.mjs:1167-1182`) is rendered by `GraphTitle` inside
  `src/dms/packages/dms/src/ui/components/graph_new/GraphComponent.jsx:23-50` (the `description`
  div, line 46), fed from `graph_new/index.jsx:171`'s `mergeChartDefaults`.

**Both sites already have everything they need except the resolution call itself — no missing React
plumbing:**
- Both already sit inside `PageContext` (`section.jsx:355`; `graph_new/index.jsx:71-77` via its
  parent `ComponentRegistry/graph_new/index.jsx:40`) and already read the live `state.display`
  object (`_measurePick.routeIds`, `comparisonSeries.combine.invert`) — the exact fields needed to
  know which route(s) a graph belongs to.
- The catalog broadcast (`ROUTE_CATALOG_PARAM_KEY`, already carrying `catalogRouteName`/
  `dateFormula`/etc.) rides on the same generic page-filter/`setActionParam` channel every DMS page
  filter already uses — reading a named `pageState.filters` entry from core code isn't a layering
  violation by itself. What WOULD be a violation is core calling `resolvedRouteLabel`/
  `applyNameTemplate` directly, since those live in the transportny theme (`relativeDateResolution.js`),
  not `@availabs/dms` core — per `src/dms/CLAUDE.md`, core never imports theme code. The existing
  pattern for exactly this problem is a theme-supplied hook read off `theme` (already used for
  `theme.chartDefaults`/`theme.titleInlineWithLegend` in `graph_new/index.jsx:102-103`) — e.g.
  `theme.resolveDisplayText?.(rawText, {routeIds, invert, pageState}) ?? rawText`, called from both
  `section.jsx` (before handing `value.title` to `TitleComp`) and `graph_new/index.jsx` (before
  `mergeChartDefaults`). Core stays route-name-agnostic; transportny's implementation is the only
  thing that knows `%n`/`%y`/`resolvedRouteLabel` exist.

**Which route(s) a graph is "about" is already stored — no new spec field needed:**
`state.display._measurePick.routeIds`, an ordered array of `route_comp_id`s written by
`report_build.mjs:1479,1495-1499`. For a difference graph, index 0 is anchor / rest are compare,
unless `comparisonSeries.combine.invert === true` swaps them (mirrors `report_build.mjs`'s own
`g._invert ? g._assigned[1] : g._assigned[0]` at lines 1179-1180). bi_directional's 14 single-route
graphs have exactly one id here each — unambiguous which route a title token would resolve against.

**`resolvedRouteLabel`/`applyNameTemplate` (`relativeDateResolution.js:223-245`) as-is:**
- **Title fix (single route, bi_directional) is a near-zero-cost reuse**: once the render site
  resolves `routeIds[0]` against the broadcast catalog to get a route object, it needs to run
  token substitution against arbitrary text (`"Hours of Delay - %n"`), not just a route's own
  `name` field — `applyNameTemplate(route)` today only does the latter. Needs one small factor-out:
  extract the substitution core so it runs against an arbitrary string + route object
  (`substituteTokens(text, route)`, with `applyNameTemplate(route) = substituteTokens(route.name,
  route)` becoming a thin wrapper) — a ~5-line refactor, not a redesign.
- **Caption fix (two routes) is not a token-substitution problem** — the "Base: X · Comparison: Y"
  phrase is a fixed wrapper built from two independently-resolved labels, not a spec string with
  tokens embedded in it. Two real options:
  1. Stop baking the caption as a finished string at build time; mark it auto-generated (e.g.
     `description: null` + a flag) and have the render site rebuild the identical phrase live from
     `routeIds`/`invert` + the broadcast catalog — a near-verbatim port of
     `report_build.mjs:1181-1182`'s own expression, swapping `.name` for `resolvedRouteLabel(...)`
     and moving it to render time. Duplicates ~2 lines of wrapper-phrase text between the build
     script and the theme runtime (acceptable — one fixed phrase, not business logic likely to drift).
  2. Keep the wrapper phrase in the baked string but store per-route-id placeholders instead of
     names (e.g. `"Base: {{route:comp_4}} · Comparison: {{route:comp_9}}"`), and give the render
     site one generic `{{route:ID}}`-scanning resolver that could ALSO subsume the title case (one
     mechanism for both A and B, not two). More general, but introduces a second token syntax
     alongside `%n`/`%y` for one narrow use today.

  Leaning option 1 (no new token syntax, smaller diff, the caption phrasing only has this one shape
  today) — flagging for Ryan's steer since option 2 generalizes better if a third
  static-text-with-routes case shows up later.

**No existing precedent for template-resolution-at-render-time inside any graph-rendering code** —
confirmed zero calls to `resolvedRouteLabel`/`applyNameTemplate` (or any other template mechanism)
inside `GraphComponent.jsx`, `graph_new/index.jsx`, `section.jsx`, `section_components.jsx`. The
three existing consumers — header pill, chart legend, and RRL's own row label
(`RouteRow.jsx:240`, a third consumer the original bug write-up above didn't name) — are all
theme-layer components already inside the transportny tree; this would be the first time resolution
crosses into DMS-core rendering code, hence the new `theme.resolveDisplayText` hook rather than
reusing an existing wired path.

**Static-report behavior must stay unaffected**: `theme.resolveDisplayText`/the caption-rebuild path
should be a no-op passthrough whenever a route's `name` has no `%n`/`%y` tokens (real, permanent
names on static reports) and whenever `_measurePick.routeIds` doesn't resolve against a live
broadcast catalog (i.e., not a Dynamic Report) — `resolvedRouteLabel` already falls back to the bare
name when no tokens are found, so this should hold by construction with zero special-casing, but
worth confirming live once built (static reports must render byte-identical titles/captions to today).

**Decisions, confirmed with Ryan 2026-09-08:**
1. Caption rebuild: **option 1** — no new token syntax; rebuild the "Base: X · Comparison: Y" phrase
   live at render time from `routeIds`/`invert`, near-verbatim port of `report_build.mjs:1181-1182`
   with `.name` swapped for `resolvedRouteLabel(...)`.
2. **One combined change** — both the title fix (bi_directional) and the caption fix ship together,
   not staged, since they share the same `theme.resolveDisplayText`-style hook and core/theme
   boundary work.

### Implementation — DONE + live-verified 2026-09-08

**Real architectural question resolved before writing code**: could a theme-supplied FUNCTION
actually survive to the live client, or would SSR hydration serialize the theme through JSON (which
drops functions)? Traced `src/main.jsx`: the client re-runs the SAME dynamic `import()` for the
theme module on hydration (`await loadThemes(...)`) — only `defaultData`/`hydrationData` (real DMS
content) round-trip through `window.__dmsSSRData`; the theme itself is always a live, freshly-
imported JS module on both server and client. A function-valued theme key is safe. (The admin theme
EDITOR's `JSON.stringify` in `editTheme.jsx` is a separate DB-override path this hook is never meant
to go through — irrelevant here.)

**`relativeDateResolution.js`** — extracted `substituteTokens(text, route)` (the `%n`/`%y`
substitution core, now operating on ANY text string, not just `route.name`) out of
`applyNameTemplate(route)`, which is now a thin wrapper (`substituteTokens(route?.name, route)`).
Guards `typeof text !== 'string'` — load-bearing, since `substituteTokens` will be called
unconditionally from DMS-core on section titles that are normally Lexical rich-text objects on
every OTHER (non-report) section, on transportny and every other site.

**New file `resolveReportDisplayText.js`** (same directory) — the one function that live-resolves
both bugs, reusing the SAME `ROUTE_CATALOG_PARAM_KEY` broadcast catalog the header pill/chart
legend/RRL row already read through `resolvedRouteLabel`:
- Title / explicit-caption case: look up `routeIds[0]` in the catalog, `substituteTokens(rawText,
  that route)`, fall back to `rawText` unchanged if no catalog entry or no tokens present (safe
  no-op for static reports and for anything not yet resolved).
- Auto-diff-caption case (`isAutoDiffCaption: true`): ignore `rawText` entirely (there is none —
  see below); rebuild `` `Base: ${resolvedRouteLabel(anchor)} · Comparison:
  ${compares.map(resolvedRouteLabel).join(', ')}` `` from `routeIds`/`invert`, index-for-index
  identical to `report_build.mjs`'s own retired `g._invert ? g._assigned[1] : g._assigned[0]` /
  `g._invert ? [g._assigned[0]] : g._assigned.slice(1)` logic. Returns `null` (renders nothing) if
  the catalog hasn't broadcast yet or fewer than 2 routes resolve — a transient, self-correcting
  state, not an error.

**`themev2.js`** — wired in as a plain **top-level** theme key, `resolveReportDisplayText` (not
namespaced under `avlGraph`/`pages` — both call sites already have the ROOT theme object in scope
before narrowing to a namespace, and a shared top-level hook avoids defining the same function
twice under two different namespaces).

**`section.jsx` (DMS-core)** — before handing `value.title` to `TitleComp`, calls
`fullTheme?.resolveReportDisplayText(value?.title, { routeIds, invert, pageState })` using
`dwHandle?.state?.display?._measurePick`/`comparisonSeries?.combine?.invert` — already tracked here
via `dwHandle` (same object read for the pre-existing `hideSection` check), no new plumbing needed.
Builds a `headerValue` (original `value` with just `title` swapped) rather than changing
`ViewSectionHeader`'s own signature. No-op on every other DMS site (hook undefined) and on every
other transportny section type (hook itself no-ops on non-templated/non-string text).

**`graph_new/index.jsx` (DMS-core)** — before `mergeChartDefaults`, calls
`contextTheme?.resolveReportDisplayText(display.description, { routeIds: display._measurePick
?.routeIds, invert: display?.comparisonSeries?.combine?.invert, isAutoDiffCaption:
Boolean(display._autoDiffCaption), pageState })` (`pageState` already destructured from
`pageContext` here); patches `description` into a copy of `display` only when it actually changed.

**`report_build.mjs`** — the difference-mode auto-caption branch no longer bakes
`"Base: ... · Comparison: ..."` as a literal string; it sets `state.display._autoDiffCaption =
true` instead and leaves `description` unset. The explicit-`g.caption` branch is untouched (still
bakes literal text — now also opportunistically run through `substituteTokens` at render time, a
free capability for any future author who types `%n`/`%y` into a custom caption; a no-op today
since no spec's `caption` field uses tokens). Checked both other consumers of `state.display.
description` (`--from-page`'s drift check at line ~477, its spec-recovery capture at line ~592) —
both come out MORE correct with this change: a genuinely-unedited auto-diff graph no longer
registers as spuriously "drifted," and `--from-page` recovery no longer accidentally freezes the
auto phrase into an explicit `caption` forever after one round-trip.

**`bi_directional.json`** — all 14 graph `title` fields changed from a literal `"...
Northbound"`/`"... Southbound"` suffix to `"... - %n"`. Confirmed safe even though several of these
graphs are fed by 4 routes at once (e.g. `routecompare_nb`: `current_nb`+`y1ago_nb`+`y2ago_nb`
+`trailing_nb`) — all 4 share the same `route_slot_group`, so they always resolve to the identical
real `catalogRouteName`; `routeIds[0]` is representative of the whole group by construction (the
mechanism sub-item 2 of this same doc built).

**Rebuilt + republished all 4 affected templates** via `report_build.mjs <spec> --update <slug>
--publish`: `bi_directional` (14 graphs modified, structural checks passed), `seasonality`,
`single_day_advanced`, `single_route` (each: reconciled cleanly, structural checks passed).
`report_probe.mjs` on all 4: 0 console/page/SQL errors (unresolved-entry-gate state only, same as
every prior automated pass in this doc).

**Live-verified** via `claude-in-chrome` against real picked routes:
- `bi_directional?routes=2216791|||2216791` (the exact repro from the original bug report — the
  SAME real route picked for both NB and SB): every one of the 14 section titles now reads
  `"... - ROUTE 5 PART"` — correctly reflects that the same route was picked for both groups,
  instead of the old false, unenforced `"... - Northbound"`/`"... - Southbound"` claim.
- `bi_directional?routes=2216791|||2207838` (two DIFFERENT real routes): each group's 7 titles
  correctly resolved to its OWN route's name (`"ROUTE 5 PART"` for the first group, `"35E QUEENS
  MIDTOWN EXPY WESTBOUND"` for the second) — no cross-group mixing, across every graph type
  (AVL Graph, Map, Route Compare, Info Box). 0 console errors on a fresh load.
- `seasonality?routes=2216791`: all 4 difference-graph captions now read `"BASE: ROUTE 5 PART
  (2026) · COMPARISON: WINTER"` / `"...SPRING"` / `"...SUMMER"` / `"...FALL"` — the exact literal-
  token bug (`"Base: %N (%Y) · Comparison: Winter"`) is gone. 0 console errors.
- `single_route?routes=2216791` (the one template needing BOTH anchor and compare sides resolved):
  `"SPEED - CURRENT YEAR COMPARED TO 3 YEARS AGO"` graph's caption reads `"BASE: ROUTE 5 PART
  (2023) · COMPARISON: ROUTE 5 PART (2026)"` — both sides correctly resolved to the same real
  route's name with their own distinct years. 0 console errors.
- Regression check on the real, published, unmodified STATIC report `reports/
  beacon_9_d_jan_25_vs_26` (built by the old converter, not `report_build.mjs` — its difference
  graph has no `_autoDiffCaption` flag at all): every title/caption renders exactly as before,
  byte-identical, no stray `%n`/`%y`/`"Base: ... · Comparison: ..."` text anywhere. 0 console errors.

**Files changed**: `src/themes/transportny/components/ReportRouteList/relativeDateResolution.js`,
`resolveReportDisplayText.js` (new), `src/themes/transportny/themev2.js`,
`src/dms/packages/dms/src/patterns/page/components/sections/section.jsx`,
`src/dms/packages/dms/src/ui/components/graph_new/index.jsx`,
`scripts/npmrds-reports/report_build.mjs`,
`scripts/npmrds-reports/dynamic_report_specs/bi_directional.json`.

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

## RRL follow-up (2026-09-08): resolved-name display in RRL + edit/delete icon grouping

Two more rounds of Ryan's live feedback, same session, both scoped to `RouteRow.jsx`'s collapsed
row and header layout — not new sub-items, but recorded here since they touch the same file/area:

1. **RRL's own row never showed the resolved real name, only sub-items 1/3's other two consumers
   did.** The header's routes disclosure and the chart legend both already read through
   `resolvedRouteLabel` (sub-item 1's choke point); RRL's own collapsed title never did — it always
   showed the raw authored/template string (`r.name`), even once a real route resolved via
   `?routes=`. Ryan's ask, clarified over two messages: (1) "when routes are in the URL... I want
   the RRL to use the actual Route Names when the route... is in view mode. When the user clicks
   into edit mode for THAT Route, then it should show the template text"; (2) clarifying follow-up —
   unresolved (no `?routes=` yet, the default state) should keep showing the raw placeholder as-is,
   not a partially-substituted string, and once resolved, show "their template-name in light text
   below it" rather than just discarding it.
   - `RouteRow.jsx`: `isResolved = r.catalogRouteName != null` — this field is set ONLY by
     `useDynamicReportRoutes.js`'s resolve-merge, never on a raw unfilled slot and never on a static
     route, so it's a reliable per-row "did a real route actually get supplied via the URL" signal
     (distinct from the report-level `isDynamicReport` flag, which stays true even before any
     `?routes=` is picked). Unresolved: `displayName = r.name` verbatim — deliberately NOT run
     through `resolvedRouteLabel` (that would still partially substitute a lone `%y` off the slot's
     own formula-derived dates, without needing a real route at all — half-filled, not an honest
     placeholder). Resolved: `displayName = resolvedRouteLabel(r)`, with the original template kept
     visible underneath in light text (`showTemplateHint`, new `t.routeTitleTemplate` token) whenever
     it differs from the resolved value.
   - Edit-mode input needed NO change — it already showed `localName` (buffered from the raw
     `r.name`), never the resolved label, so "click into edit mode, see the template" was already
     true; only the COLLAPSED view was wrong.
   - New tokens: `routeTitleWrap` (the `flex-1 min-w-0` that used to live on `routeTitle` itself,
     now on a wrapper so the title can be a 2-line stack), `routeTitleTemplate`.
2. **Edit and delete icons moved to sit next to each other.** Previously opposite ends of the row
   header (`[pencil] ... route name ... [trash]`); Ryan: "edit/delete icons should be next to each
   other." Both are now inside `iconContainer`, after the title, wrapped in a new `rowActionsGroup`
   span — the pencil (or, mid-edit, the Discard/Save pair) immediately followed by the trash icon.
   Dropped the now-inapplicable `mt-0.5` from `expander`/`expanderOpen`/`saveIconBtn` (that offset
   was for sitting directly in the outer `items-start` header row; they're now nested one level
   deeper, inside `iconContainer`'s own `items-center` row). Reorder buttons and the colour dot were
   NOT touched — only the edit-toggle/delete pairing moved, per the literal ask.

**Live-verified** on the same kept scratch report (`reports/claude_scratch_pct_template`):
- Unresolved (`?routes=` empty): row showed the literal placeholder `"%n (%y) (2)"`, unchanged —
  confirmed via zoomed screenshot; edit/delete icons confirmed grouped together, right side of the
  header.
- Resolved (`?routes=2216791`, "Route 5 Part"): row's primary title read `"Route 5 Part (2026) (2)"`
  with `"%n (%y) (2)"` directly underneath in light grey — matches the header pill/chart legend
  exactly (all three consumers now agree, closing a real pre-existing 3-way inconsistency, not just
  a cosmetic ask). Opened edit mode on the same row: input showed the raw `"%n (%y) (2)"`, confirming
  the "template in edit mode" half of the ask was already correct and stayed correct.
- Regression check on the real, published, unmodified static report `reports/beacon_9_d_jan_25_vs_26`
  (2 routes, plain names, no `%n`/`%y`): both rows show their plain name with no template-hint line
  (correct — `catalogRouteName` is never set on a static route, so `isResolved` is false there by
  construction), edit/delete icons confirmed grouped there too, and the page's own "NO CHANGES"
  indicator confirmed viewing didn't mutate anything.
- Discarded the edit-mode buffer opened during this pass; confirmed via a fresh DB read the scratch
  report's one persisted slot (`comp-4`) is unchanged. 0 console errors throughout.

### Same-day fix: two layout regressions from the above, both Dynamic-Report-only

Ryan caught both live, screenshotted one: "the identity color dot doesn't seem centered... a bunch
of small alignment issues" and "the css for the RRL actual header is realllly wonky for dynamic
reports." Both traced to the two features just above — neither ever showed on a static report,
which is why Ryan's own read ("we have a bunch of extra/different changes there") was exactly
right:

1. **Header misalignment.** The template-hint line (`routeTitleTemplate`) was nested INSIDE the
   header row itself, under the title, making that row 2 lines tall on any resolved Dynamic Report
   route — but only there (`showTemplateHint` is `false` on every static route and every unresolved
   slot). `colorDotButton`/`reorderButtons` sit outside that title block as `items-start` siblings
   with small fixed top-margins (`mt-1`/`mt-0.5`) tuned for a single-line title; against a suddenly
   2-line-tall sibling, those fixed offsets left them sitting too high. **Fix**: moved the template
   hint OUT of the header row entirely, into its own line in the collapsed `metaIndent` block
   (alongside `dateMeta`/`tmcMileageMeta`) — the header row is now unconditionally single-line
   height again, exactly the shape `colorDotButton`/`reorderButtons`'s offsets were always tuned
   for, regardless of dynamic/static or resolved/unresolved. Retired the now-unneeded
   `routeTitleWrap` token (title reverted to a single `<span>`, not a 2-line flex-col).
2. **Actions-row button wrapping.** Sub-item 2's group-reuse `<select>` shared one `flex` row with
   the "+ Add Route Slot" and "+ Add Graph" buttons — three items competing for the narrow rail's
   width squeezed both buttons until their own labels wrapped onto 2 lines inside the fixed-height
   button, reading as broken/overlapping text (Ryan's screenshot). Static reports never show this
   row's 3rd item (no select there at all), which is why only Dynamic Reports were affected. **Fix**:
   `actionsRow` is now `flex-col` — the two buttons stay together on their own row
   (`actionsRowButtons`, unchanged content/order), and the select drops to a second row
   (`addSlotGroupRow`, now with an "Add as" label and free width to breathe) only when it renders at
   all. Added `whitespace-nowrap` to `addBtnLabel` as a defense-in-depth hardening — even if a future
   change squeezes this row again, a label should overflow/clip, never wrap into overlapping text.

**Live-verified** (same scratch report, `?routes=2216791` for resolved / bare for unresolved):
- Resolved row: `colorDotButton` vs. the title text measured via `getBoundingClientRect()` (not
  eyeballed off a screenshot, per this repo's own alignment-verification convention) — vertical
  centers **1px apart** (244+7=251 vs. 242.25+9.75=252). Template hint now renders as its own line
  below the header, still present and correct.
- Unresolved row: single-line header, no stray hint line, unchanged from before either fix.
- Actions row: "+ Add Route Slot"/"+ Add Graph" render on one clean line, no wrapping; "Add as: New
  route ▾" renders on its own line below once a group exists to reuse.
- Regression check on `reports/beacon_9_d_jan_25_vs_26` (static, unaffected by construction):
  actions row still a single clean line (no select ever rendered there), row headers unchanged,
  byte-for-byte the same layout as every prior live-verification pass on this report.
- 0 console errors. No DB writes made this pass (navigation + measurement only).

### Same-day fix, round 2: dot still off while editing, template hint indented + spaced wrong

Ryan, watching live: "the identity color dot doesn't seem centered again [while editing]... prob
cause the input element looks off compared to just a text element" (correct diagnosis, confirmed);
then, after the alignment-round-1 fix landed: "im watching ur chrome, the template route name is
still way too low" plus "theres some space there, under the route title and still next to the color
dot" — two more real, precisely-measured issues, both DOM-measured (not eyeballed) before and after:

1. **Dot still off-center while editing.** `colorDotButton` sat as a direct sibling of
   `iconContainer` inside the outer `items-start` `rowHeaderWrapper`, with a fixed `mt-1` nudge
   tuned against ONE specific sibling height. That height differs between collapsed (a ~19.5px
   `routeTitle` span) and editing (the 32px-tall `titleInput`) — the same fixed-offset fragility as
   the earlier header-height bug, just exposed by a different pair of states this time. **Fix**:
   new `titleRow` wrapper (`flex items-center`) around JUST the colour dot + `iconContainer` —
   genuine flex centering against whatever `iconContainer` actually contains, correct in both
   states with no tuned number at all. Dropped the now-redundant `mt-1` from `colorDot`/
   `colorDotButton`. Reorder buttons deliberately left outside this wrapper (still directly in
   `rowHeaderWrapper`, still `items-start`) — untouched, never reported as wrong.
   - **Verified**: dot vs. `titleInput` vertical centers, measured — **0px apart** (both 256).
2. **Template hint (and, it turns out, dateMeta/tmcMileageMeta too) indented 10px short of the
   title, PLUS a 10px vertical gap under the title specifically for the hint line.** Two separate,
   independently-measured causes, same block:
   - *Horizontal*: `metaIndent`'s `pl-7` (28px) was 10px short of the title's real left edge —
     measured on ALL THREE lines in the block (title at x=137; hint/dateMeta/tmcMileageMeta all at
     x=127, a **pre-existing** gap on the two older lines too, just never flagged before the hint
     line made a direct visual comparison to the title unavoidable). Fixed: `metaIndent` →
     `pl-[38px]`, the exact measured value, shared by both its usage sites (this block, and the
     expanded-mode name-error message — both want the corrected indent).
   - *Vertical*: `rowHeaderWrapper`'s own height is set by its TALLEST child — the reorder
     up/down-arrow stack, 32px, versus the single-line `titleRow`'s 24px — so the whole collapsed
     summary block (positioned right after the header row, not right after the title specifically)
     started 10px below the title's real bottom edge (measured: reorder-buttons bottom at y=274,
     title-row bottom at y=264). Fixed with a new `collapsedSummaryPullUp` token (`-mt-[10px]`)
     applied ONLY where the collapsed summary block renders — deliberately NOT folded into the
     shared `metaIndent` token, since the OTHER place that reuses `metaIndent` (the expanded-mode
     name-error message, whose own header has an `<input>` only ~2px shorter than the reorder-
     button stack, not 10px) would overshoot and risk overlapping its own header if pulled up the
     full 10px.
   - **Verified**: title left=137, hint/dateMeta/tmcMileageMeta left=137 (**exact match**, was
     -10px); title bottom=261.75, hint top=266 (**4.25px gap**, a normal tight-caption spacing, was
     14.25px).
   - **Regression-checked** on `reports/beacon_9_d_jan_25_vs_26` (static): the fix also tightened
     dateMeta's own gap under the title there — a general improvement (dateMeta always shared the
     same underlying bug, just never called out), not a behavior change anyone would object to;
     confirmed visually, 0 console errors, no DB writes (this report was never edited).
3. 0 console errors throughout both rounds. No DB writes on the scratch report either — every check
   this round was navigation + `getBoundingClientRect()`/`getComputedStyle()` measurement only.

### Same-day fix, round 3: the residual gap was on the wrong side of the hint line

After round 2, a screenshot: "the '%n %y' are still too low... that gap above them, should prob
just be below them, that might fix it." Round 2's measurement (title bottom 261.75, hint top 266)
was already a tight 4.25px — genuinely small, but Ryan's own diagnosis of the FIX (not just the
symptom) was exactly right: the hint is conceptually PART of the title (same name, resolved vs.
template), so it should hug the title tightly above, with the visual breathing room instead
separating it from the date-range/TMC block below (a different kind of information). `routeTitleTemplate`'s
own `mt-0.5` (top margin) became `mb-1` (bottom margin) — nothing else changed. **Verified**,
gap-from-previous-line for all three: hint now 2.25px below the title (was 4.25px above-heavy),
`dateMeta` now 4px below the hint (was 2px) — the asymmetry is now in the direction Ryan asked for.
Only touches `routeTitleTemplate`, which renders exclusively inside `showTemplateHint` — zero
static-report impact (confirmed: token has no other consumer). 0 console errors.

### Same-day fixes, rounds 4-7: the root cause was line-height, then the hint's own container

Four more rounds, fast iteration with Ryan watching live in Chrome:

- **Round 4**: "that 2.25 should be at most 1px... add it to the bottom" — moved 1.25px from
  `collapsedSummaryPullUp`'s magnitude to `routeTitleTemplate`'s own bottom margin. Verified: 1px
  above, 5.25px below.
- **Round 5**: Ryan, inspecting live in Chrome DevTools: "the line height for the title is too
  big... compared to the font inside." Correct — `routeTitle`'s default line-height baked several
  invisible px above/below the glyph into its own box, which every `getBoundingClientRect()`
  measurement had been counting as real distance. Added `leading-none` to `routeTitle` and
  `routeTitleTemplate`. This shrank the title's box (19.5px → 13px) and threw off every
  hand-tuned offset calibrated against the old, taller box — expected, given they were tuned
  against real (if now-outdated) measurements, not guesses.
- **Round 6**: Ryan named the actual architectural problem: "your problem, is the hint subtitle,
  is in a different place than the title... it prob needs to be in the same div/container...
  prob flex-col." Correct diagnosis — the hint had lived in the separate `metaIndent` block this
  whole time, positioned relative to the ENTIRE header row (dominated by the reorder-button
  stack), never relative to the title specifically, which is why every fix up to this point was a
  fragile pixel offset that broke again the moment anything else changed. Moved the hint into
  `routeTitleWrap`, the SAME flex-col as the title (see that token's theme comment) — normal
  document flow, no cross-container math needed for title↔hint at all. Safe to do this time
  (an identical restructuring in round 1 was reverted) because the colour dot's own alignment fix
  (round 2, `titleRow`'s real flex centering) no longer depends on the title being single-line.
- **Round 7**: with the hint now living in the header instead of `metaIndent`, the OTHER content
  that still lives in `metaIndent` (`dateMeta`/`tmcMileageMeta`) inherited the exact bug the hint
  used to have — and `leading-none` made it worse by tightening the title further. Found on the
  real, published `beacon_9_d_jan_25_vs_26` (a plain static report, no hint involved at all):
  reorder-buttons bottom at row-relative 34px, title bottom at 18.5px, a 17.5px gap (Ryan: "theres
  too much space, in the static RRL, between title and dates"). A single pull-up
  (`collapsedSummaryPullUp`) undershot on a plain title and overshot into the hint once one was
  showing (Ryan: "now the space underneath the sub-title is too small") — split into two
  independently-measured values, `collapsedSummaryPullUpNoHint`/`collapsedSummaryPullUpWithHint`,
  selected in `RouteRow.jsx` by `showTemplateHint`.

**Final settled state**, live-verified via `getBoundingClientRect()`/`getComputedStyle()` on both
the scratch Dynamic Report and the real static `beacon_9_d_jan_25_vs_26`, 0 console errors, no DB
writes made during any of this verification:

- Colour dot vs. title/input: **0px** off, collapsed or editing (real flex centering via
  `titleRow`, not a tuned offset).
- Title/hint left edge: **identical** (same container, automatic — no indent math for these two).
- Title → hint gap: **2px**. Hint → dateMeta, dateMeta → tmcMileageMeta: **2px each** — a
  consistent rhythm end to end, both with and without a hint present.
- Static report (`beacon_9_d_jan_25_vs_26`): title → dateMeta now also **2px** (was 17.5px before
  round 7) — this was always a latent bug on every report, not something introduced by the hint
  feature; fixing it is a pure improvement, not a behavior change anyone would object to.
- One known, accepted imperfection, not fixed: the colour dot centers against the FULL title+hint
  block when a hint is present (not against the title line specifically) — off by ~5.75px from the
  title's own line. Found during verification, not reported by Ryan; his call once shown: "i think
  ur good with current state." A proper fix exists (decouple dot+title into their own row,
  separate from the hint) but wasn't built — flag here for whoever next touches this area, since
  it's a real, measured gap, just an accepted one.
- Code cleaned up per Ryan's explicit ask ("clean up the random margins/padding") — comments
  consolidated to explain the FINAL shape concisely rather than narrate all 7 rounds inline; the
  round-by-round record lives here instead.

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

## Sub-item 4 — Bidirectional static↔dynamic conversion — SCOPED 2026-09-08, not yet built

### The original ask, as fully as it exists anywhere

Traced back to the very first commit of `npmrds-reports-routes-feedback-triage.md` (`5078eec7`,
2026-09-04) — the wording there is **byte-identical** to the current cross-reference in that file,
and no fuller/more verbatim capture of Ryan's original message exists anywhere in the repo (no raw
notes file, nothing in `dynamic-reports-and-route-tags.md`/its archive, which never discusses
conversion at all — only the toggle mechanism's own build). This is the complete ask, not a lossy
summary of something richer:

> "Bidirectional static↔dynamic conversion — the 1:1 mapping Ryan describes (routes ⇄ route slots +
> URL params) so switching modes preserves what's displayed instead of leaving stale hardcoded
> routes or empty slots."

The problem it names is real and independently confirmed in the current code: `toggleDynamicReport`
(`ReportRouteList.jsx:269`) only adds/removes the `routeSlots`/`baseDate` page-filter registration —
its own comment says so directly: **"Does NOT retroactively convert any already-added concrete
routes into slots — build a Dynamic Report starting from a blank routes list."** Flip the switch on
today and every already-added route just silently stops resolving (no `tmc_array`, no `id` — a slot
needs a URL id it never got); flip it off and any resolved-via-URL preview is discarded, the report
reverts to whatever static `routes[]` happened to be sitting there (usually empty, since a Dynamic
Report is normally *authored* with slots from the start).

### Current-state grounding: the two shapes, and what actually differs

**Static route** (`useReportRow.js`'s `addRoutes`, and old-converter's `build_route_entry`):
`name`, `color`, `route_comp_id`, `startDate`/`endDate` (or `dateFormula`+`derivedFromRoute`, same
Mechanism B every route type already supports), plus **concrete catalog data baked in at add time**:
`tmc_array`, `id` (the real catalog row's own id — `route_id` as a legacy fallback, per
`excludeRouteIds`'s own comment: "every catalog row has one regardless of provenance"),
`description`/`points`/`metadata`/`conflation_array`/`conflation_version`/`created_at`/`created_by`/
`updated_at`/`isValid`/`graphIds` (the last is dead weight — Design Push #2 moved graph assignment
off the route entirely).

**Dynamic Report route SLOT** (`handleAddRouteSlot`, old-converter's `build_slot_entry`): exactly
`name`/`color`/`route_comp_id`/dates-or-formula/`route_slot_group` — **no catalog snapshot at all**.
`useDynamicReportRoutes.js` resolves a slot against a real catalog row **at view time only**, from
the URL's `?routes=` ids, merging `{...slot, ...catalogRow}` into `effectiveRoutes` — never
persisted back to storage.

**A static report can already have 2+ routes sharing one real catalog id** (nothing in `addRoutes`
prevents re-adding the same route with different dates — its own comment: "a different date range
is a legitimate use case") — this is the *exact static-side equivalent* of a Dynamic Report's
`route_slot_group`, which de-risks the static→dynamic direction: grouping-by-shared-id is already a
real, precedented shape, not a new concept being invented for this conversion.

**Load-bearing finding: graph assignment survives the conversion untouched, in both directions.**
A graph's `_measurePick.routeIds` (`useGraphPublish.js:233`, `routesByCompId.get(id)`) binds by
**`route_comp_id`**, never by the catalog `id`/`tmc_array`. Since the conversion (below) never
touches `route_comp_id` — only adds/strips the catalog-snapshot fields around it — every graph's
route assignment keeps working with **zero graph-side code changes**, in either direction. This is
the single biggest de-risking fact for this whole sub-item; confirmed by reading the binding code,
not assumed.

### Proposed design

**Static → Dynamic** (author flips the switch on):
1. Compute the distinct real ids currently in use across `routes[]` (`r.id ?? r.route_id`), in
   first-appearance order.
2. Build the new slot array from the *same* `routes[]` entries: keep `name`/`color`/
   `route_comp_id`/dates-or-formula/**`route_comp_ids`** (plural — see the correction below, this
   was wrongly scoped out in the first draft of this section); strip every catalog-snapshot field
   (`tmc_array`, `id`, `route_id`, `description`, `points`, `metadata`, `conflation_array`,
   `conflation_version`, `created_at`, `created_by`, `updated_at`, `isValid`, `graphIds`); set
   `route_slot_group` on any entry sharing a real id with an earlier entry (group key = that
   earlier entry's own `route_comp_id` — same convention sub-item 2 already uses).
3. `persistRoutes(slots)` + register the `routeSlots`/`baseDate` filters (existing
   `toggleDynamicReport` logic, unchanged).
4. Immediately `navigate` to `?routes=<the distinct ids>` (same raw-`location.search`-patch
   approach sub-item 3's "Change Routes" and the "Viewing as of" control already use) — so the
   author's own view stays visually identical the instant the switch flips, instead of falling
   through to "Select routes to view this report."

**Dynamic → Static** (author flips the switch off):
1. Require a fully resolved current preview first (`effectiveRoutes.length === routes.length` —
   every slot has actually resolved to something, not just URL-id-count matching group-count,
   which wouldn't catch a stale/bad id). If not resolved, there is nothing displayed to preserve —
   see the open question below on what happens then.
2. Build the new static `routes[]` **directly from `effectiveRoutes`** — it's already the fully
   merged `{...slot, ...catalogRow}` shape (`useDynamicReportRoutes.js`), so this is close to a
   pass-through: drop only `catalogRouteName` (a resolution-only field `useDynamicReportRoutes.js`
   adds, never part of the real static-route contract). Any `dateFormula`/`derivedFromRoute` a slot
   had carries straight through unchanged — Mechanism B is identical on both sides, nothing
   dynamic-specific about it, so a derived-date relationship stays live and derived, not frozen into
   a snapshot; `route_slot_group` is left in place too (inert on the static side, same as it already
   is on old converter-imported static rows).
3. `persistRoutes(newRoutes)`, then clear the `routeSlots`/`baseDate` filters, then `navigate` back
   to the bare pathname (`?routes=`/`?asOf=` are no longer meaningful once static).

### Does this match what Ryan asked for?

**Yes, on the core ask** — both directions genuinely preserve what's on screen at the moment of the
flip (real routes ⇄ real slots, same `route_comp_id`s, same dates, same graph bindings, no stale
hardcoded leftovers, no empty slots) rather than today's silent data-loss/blank-state behavior. The
"1:1 mapping" is literal: each static route becomes exactly one slot (or joins an existing slot
group when it shares a real id with a sibling), and each resolved slot becomes exactly one static
route.

**One place this proposal adds a condition beyond the original one-sentence ask**, flagged rather
than silently decided: dynamic→static requires the report to already be resolved (a real `?routes=`
picked) before allowing the flip — if nothing's been picked yet, there IS no "what's currently
displayed" to preserve, so the literal ask doesn't fully specify behavior for that case. See open
question 1.

### Open questions for Ryan

1. **Dynamic → static with nothing resolved yet** (a freshly authored/reused Dynamic Report, no
   `?routes=` in the address bar): block the toggle-off with a message ("pick routes to convert, or
   they'll be lost")? Silently fall back to today's behavior (empty `routes[]`)? Or open the
   blocking picker inline right there so the author resolves it as part of turning the switch off?
2. **Should this now-real data mutation get a confirm step?** Today the Switch fires
   `toggleDynamicReport` directly on toggle with no confirmation — that was fine when it only
   touched page filters, but this makes it a real `routes[]` rewrite (reversible by flipping back,
   but not obviously so to an author mid-click).
3. **Static→dynamic naming**: a static route's name (e.g. "Route 5 Part") carries over literally,
   with no `%n`/`%y` tokens auto-added — so if the author later swaps which real route fills that
   slot (via the header's "Change Routes"), the display name goes stale (still says "Route 5 Part"
   even if swapped to a different route). Leaving names exactly as authored (not auto-rewriting
   them) is my default, but flagging since it's a real, visible quirk, not a bug — an author can
   already retype a name to include `%n`/`%y` by hand if they want it to adapt, no new mechanism
   needed.

**Ryan's answers (2026-09-09):**
1. **Open the picker** (the modal, `RouteTagBrowserModal` — Ryan's explicit correction mid-session:
   "by picker — thats the modal, right? inline would look AWFUL in just the sidebar, dont inline
   it"), with an additional message explaining why it opened.
2. **No confirm step required — IF the conversion is built so switching modes is genuinely
   lossless/nothing-changing** when routes are already in the report or already in the URL. Not "no
   confirm step, accept some risk" — the bar is zero data loss, full stop; a confirm step becomes
   unnecessary once that bar is met, not despite not meeting it.
3. Leave static→dynamic naming as scoped (literal carryover, no auto-`%n`/`%y`) — "I think we will
   end up circling back on this."

### Correction (verified 2026-09-08, before presenting this scoping): `route_comp_ids` IS in scope

The first draft of this section claimed `route_comp_ids` (plural — `useGraphPublish.js:87,233`, the
converter-era comp-merge compatibility field: several old comps sharing one `routeId`+calendar
dates collapsed into one live `routes[]` entry at conversion time, which then lists every absorbed
comp id so a graph still bound to one of those old, now-gone ids can still resolve) was "orthogonal,
nothing here interacts with it," reasoning that "the live UI never produces merged comps." That's
true, but beside the point — this conversion doesn't need to PRODUCE a merged entry, it needs to not
DROP one that's already there. **Confirmed live**, not just by reading code: the real, published,
already-converted `reports/beacon_9_d_jan_25_vs_26` (`report_id` 2216846, queried directly from
`reports_snap_2` this session) has exactly this shape today —
`{route_comp_id: "comp-0", route_comp_ids: ["comp-0", "comp-2"], ...}`. If that report were ever
toggled to Dynamic and the conversion silently dropped `route_comp_ids` (as the original strip-list
didn't explicitly exclude it, and every other converter-only field around it — `_old_report_id`,
`_old_settings` — genuinely is safe to drop), any graph still keyed to the absorbed `comp-2` id
would stop resolving — a real, silent regression on exactly the kind of older-converted report this
feature is likely to be used on first. Fixed above: `route_comp_ids` is now explicitly on the KEEP
list for static→dynamic, alongside `route_comp_id`. Dynamic→static needs no equivalent fix — a
Dynamic Report slot is only ever created by `handleAddRouteSlot` (never produces `route_comp_ids`),
and freezing `effectiveRoutes` into `routes[]` already carries any field a slot happens to have
(including `route_comp_ids`, if a report was static→dynamic-converted before and is now being
converted back) through unchanged — no separate handling needed there, confirmed by reading the
spread order (`{...slot, ...catalogRow}`) `useDynamicReportRoutes.js` already uses.

### Explicitly not touched by this design

- **Graphs** — zero changes needed once `route_comp_ids` is preserved (see the correction above and
  the load-bearing finding above it).
- Sub-item 2's grouping mechanism itself — reused as-is (`routeSlotGroupKey`/
  `distinctRouteSlotGroups`), not modified.

### Implementation — DONE + live-verified 2026-09-09

**`mergeSlotWithCatalogRow(slot, catalogRow)`** extracted from `useDynamicReportRoutes.js`'s own
`resolvedRoutes` construction into a standalone exported function (the hook now just calls it) — so
the conversion below can build the exact same `{...slot, ...catalogRow, route_comp_id, color, name,
catalogRouteName}` merge shape off catalog rows it already has in hand, instead of round-tripping
through a URL navigation + a second `fetchCatalogRows` call just to get back to a shape it could
build directly.

**`convertStaticToDynamic()`** (`ReportRouteList.jsx`) — static → dynamic: builds slots from
`routes[]`, grouping any two entries that share a real catalog id (`r.id ?? r.route_id`, first-
appearance order) via `route_slot_group` (mirrors sub-item 2's own convention exactly — the later
entry gets the earlier entry's `route_comp_id` as its group key); strips `CATALOG_SNAPSHOT_FIELDS`
(`tmc_array`/`id`/`route_id`/`description`/`points`/`metadata`/`conflation_array`/
`conflation_version`/`created_at`/`created_by`/`updated_at`/`isValid`/`graphIds` — deliberately
excludes `route_comp_ids`, see the Correction above). `persistRoutes(slots)`, then registers the
`routeSlots`/`baseDate` filters (unchanged from the old `toggleDynamicReport`), then **immediately
navigates to `?routes=<the distinct real ids>`** — built via `URLSearchParams(location.search)` +
`.set('routes', ...)`, the same raw-search-patch convention `ReportPageHeader.jsx`'s "Change
Routes"/"Viewing as of" controls already use, so any unrelated sibling query param survives. A blank
report (no routes yet) skips the navigate — nothing to preview, matches the original "start from a
blank routes list" behavior.

**`convertDynamicToStatic(resolvedList)`** — dynamic → static: takes an already-fully-resolved list
(the `{...slot, ...catalogRow}` shape) and does the reverse — persists it as the new static
`routes[]` (dropping only `catalogRouteName`), clears the `routeSlots`/`baseDate` filters, then
strips just the `routes`/`asOf` search-param keys (same raw-search-patch approach, not a full
query-string replace). Two callers hand it a resolved list: `toggleDynamicReport` itself (passing
`effectiveRoutes`, already `resolveRouteDates()`'d, when every group is already resolved) and
`handleConvertToStaticConfirm` (below, when it wasn't).

**`groupsFullyResolved`** — `routeSlotGroups.length > 0 && resolvedGroupRoutes.length ===
routeSlotGroups.length`. Deliberately NOT a raw `routeIds.length` count match (per this doc's own
earlier design note: that wouldn't catch a stale/bad id that never resolved to a real catalog row —
`resolvedGroupRoutes` already drops those).

**`toggleDynamicReport(enabled)`** rewritten as the dispatcher: `enabled` → `convertStaticToDynamic`.
`!enabled` → if `groupsFullyResolved`, convert directly (`convertDynamicToStatic(effectiveRoutes)`);
otherwise **open the blocking picker** (`isConvertToStaticModalOpen`) instead of converting — per
Ryan's answer to open question 1. `isDynamicReport` (derived from `pageState.filters`) doesn't
change until a conversion actually persists, so the Switch itself visually stays "on" while the
picker is open — no separate pending/loading UI needed.

**The picker** — reuses `RouteTagBrowserModal` (**Ryan's explicit correction mid-session**: "by
picker — thats the modal, right? inline would look AWFUL in just the sidebar, dont inline it" — the
design as scoped already called for the modal, this just confirms it), `selectionMode="exact"`,
`requiredCount={routeSlotGroups.length}`, `initialSelectedRoutes={resolvedGroupRoutes}` (identical
props to the existing view-mode entry gate). New `message` prop added to `RouteTagBrowserModal.jsx`
(rendered under the header, new `headerMessage` theme token) — every other caller omits it and is
unaffected; this caller passes "Switching to a static report freezes today's picked routes in place
— pick a route for every slot below first, or the un-picked ones will be lost." Cancel (dismissible,
default) is a true no-op — confirmed live: nothing persists, Switch stays on.

**`handleConvertToStaticConfirm(selectedRoutes)`** — rebuilds by GROUP POSITION (mirrors the existing
view-mode entry gate's own `onConfirm`), but keyed off actual row PRESENCE in the modal's returned
selection (`rowById.has(priorId)`) rather than bare `routeIds[j]` truthiness — the existing gate's
own logic would let a stale/never-resolved id silently claim a slot with no real row behind it;
this version can't, since it only trusts a group's prior id if that id is actually among the
freshly-returned catalog rows. Groups not claimed that way are filled from whichever selected rows
are left over, in selection order. Result is run through `resolveRouteDates()` (with
`todayAnchorEntry` in the mix, filtered back out) before handing to `convertDynamicToStatic` — same
live-date-resolution pass `effectiveRoutes` already gets, so a Today-anchor-derived slot picked via
this path gets real resolved dates too, not stale/absent ones.

**Real bug found live, fixed same pass**: converting to static left the header pill/chart legend
reading a blank, broken label (`" (2026) (2)"` instead of `"Route 5 Part (2026) (2)"`). Root cause:
a slot's `name` can still carry unresolved `%n`/`%y` tokens (the default `"%n (%y)"` an author never
customized away from) — `resolvedRouteLabel`/`substituteTokens` substitutes `%n` from
`route.catalogRouteName`, which `convertDynamicToStatic` deliberately drops (it's a resolution-only
field, never part of the real static-route contract) — so any consumer that later calls
`resolvedRouteLabel` on the now-static route (the header pill, chart legend — RRL's own row is
unaffected, it gates on `catalogRouteName != null` and shows the raw name verbatim when absent)
silently blanks the token forever, since a static route has no live mechanism left to ever fill it
back in. This is the SAME underlying blank-`%n` behavior sub-item 1 already documented and accepted
for an *unresolved Dynamic Report* ("self-consistent, no crash") — but there it's transient (fixes
itself the moment a route resolves); here it would be **permanent**, which fails Ryan's explicit
"zero data loss / nothing changing or going wrong" bar for this conversion. **Fix**: `convertDynamic
ToStatic` now runs each route through `resolvedRouteLabel(r)` (using its still-present
`catalogRouteName`) and freezes the RESULT into the new static `name` field, before dropping
`catalogRouteName` — the frozen text becomes the permanent literal name, matching the semantics of
"switching to static freezes routes in place" extended to the display name, not just the TMC/date
data. Safe no-op for any name with no tokens (a custom literal name, or an already-frozen one from a
prior conversion, carries straight through unchanged) — confirmed by `resolvedRouteLabel`'s own
existing fallback behavior, not a new code path.

**Live-verified** on the same kept scratch Dynamic Report (`reports/claude_scratch_pct_template`,
page id 2218565), logged in via the dev creds (`r.k.dubowsky@gmail.com` / `test123`, project
`npmrdsv5`), full round-trips both directions:
- **Dynamic → static, unresolved (no `?routes=` yet)**: clicking the Switch off opened the picker
  (not inline — confirmed visually, matches the modal precedent), showing the explanatory message
  and "Select 1 more (0/1)". Picked "Route 5 Part," confirmed: Switch flipped off, "+Add Route Slot"
  replaced by "+Add Route," "Change Routes" gone, URL back to bare pathname, row shows real "6 TMCs ·
  5.3 mi" — **before the fix**, header pill read the broken `" (2026) (2)"`; **after the fix**,
  header pill AND chart legend both correctly read `"Route 5 Part (2026) (2)"`. 0 console errors.
- **Direct DB read** (`dms dataset query reports_snap_2 --filter "report_id=2218565"`) confirmed the
  exact persisted shape: `name: "Route 5 Part (2026) (2)"` (frozen, post-fix), `dateFormula:
  "startDate=>yearof"` / `derivedFromRoute: "__TODAY__"` carried through unchanged (Mechanism B
  preserved, not snapshotted), real `tmc_array`/`id`/`created_at`/`metadata`/etc. all correctly
  baked in from the catalog row, no leftover `route_slot_group` (single ungrouped slot, as expected).
- **Static → dynamic**: clicking the Switch on immediately navigated to `?routes=2216791` with zero
  manual picking needed — header pill/chart legend/RRL row all showed "Route 5 Part (2026) (2)" in
  the same render, genuinely different real ClickHouse data plotted (same as sub-item 3's precedent
  check). 0 console errors.
- **Dynamic → static, ALREADY resolved** (`?routes=2216791` present): clicking the Switch off
  converted directly, no picker — Switch off, URL back to bare pathname, header pill/chart legend
  both correctly read the frozen resolved name. 0 console errors.
- **Cancel**: opened the picker (unresolved state), clicked Cancel — Switch stayed ON, "+Add Route
  Slot" still shown, `0 TMCs · 0.0 mi` unchanged, "NO CHANGES" indicator confirmed nothing persisted
  — a true no-op.
- **Regression check** on the real, published, unmodified static report
  `reports/beacon_9_d_jan_25_vs_26`: renders byte-identical to every prior pass in this doc (2 real
  routes, real difference-graph data), Report Settings' Dynamic Report switch shows OFF as before,
  0 console errors — confirms the rewritten `toggleDynamicReport` is inert for a report nobody
  touches the switch on.
- **Cleanup**: retyped the scratch slot's name back to the documented `"%n (%y) (2)"` template
  (frozen from testing back to `"Route 5 Part (2026) (2)"` mid-session, then restored) via the
  normal RouteRow edit UI — confirmed via a final DB read the scratch report is back to its
  documented single-slot, unresolved-template baseline (`comp-4`, no `route_slot_group`, no catalog
  snapshot fields), ready for reuse by future work in this arc.
- Not yet exercised live: 2+ DISTINCT route groups (a real NB/SB-shaped report) through either
  conversion direction — same gap sub-item 3's own checklist already flags as untested (no such
  scratch report exists yet); the grouping logic itself (`seenIdToGroupCompId` for static→dynamic,
  the group-position rebuild for dynamic→static) is unit-reasoned but only exercised here against a
  single-group report.

### Three more real bugs, found live on the actual `bi_directional` template — all fixed 2026-09-09

The scratch-page testing above caught the `%n`/`%y`-freeze bug. Testing the SAME feature against
the real, published `bi_directional` template (Ryan: "I tried to toggle bi_directional, from
dynamic to static") surfaced three more real bugs, none reachable from the scratch page's simpler
single-slot shape:

**Bug 1 — `item.filters` isn't always a real array.** `TypeError: (item.filters || []).filter is
not a function`, thrown inside `convertDynamicToStatic`. Root cause: on a FRESH page load (not yet
through a local `updateAttribute` round-trip), `item.filters` can arrive as the raw JSON STRING the
DB stores it as, not a parsed array — the exact same gotcha `getPageVariableRegistry`/
`mergeFilters` (DMS core) already defend against for `pageState.filters` via a `parseIfJSON`
helper, which this new code never reused. The scratch page never hit this because every test on it
stayed within one page session (so `item.filters` was always the locally-set real array from a
prior `updateAttribute` call, never a fresh DB fetch) — `bi_directional`, loaded fresh, hit the DB
string directly. **Fix**: both `convertStaticToDynamic` and `convertDynamicToStatic` now read
`item.filters` through `parseIfJSON(item.filters, [])` (imported from DMS core's own
`pages/_utils`) instead of `(item.filters || [])` — a safe no-op when it's already a real
array/object.

**Consequence of Bug 1, found while diagnosing**: the crash happened AFTER `persistRoutes(newRoutes)`
had already succeeded, so `bi_directional`'s `routes[]` was left genuinely converted to the static
shape while its `filters` stayed registered as Dynamic — a real inconsistent intermediate state on
a live, published report. Resolved (Ryan's call, "complete the conversion") by re-running the
now-fixed toggle live rather than hand-patching the DB.

**Bug 2 — a route/section's `%n`/`%y` tokens go permanently blank once frozen, in a SECOND
location the route-name fix never covered.** Confirmed live: every one of `bi_directional`'s 14
graph titles (`"Hours of Delay - %n"`, from sub-item 1's own "Combined fix") rendered as
`"HOURS OF DELAY -"` on the published view after converting to static — same root cause as the
route-name bug (the broadcast catalog's `catalogRouteName` no longer exists once static, so `%n`
silently substitutes to empty), but a different consumer: a graph SECTION's own `title`/caption
fields (`draft_sections`/`sections` on the PAGE row), not anything `routes[]` touches.
  - **Fix, scoped to what the app's own architecture supports**: new `freezeSectionDisplayText
    (sectionList, catalog)` (`ReportRouteList.jsx`) reuses `resolveReportDisplayText` — the SAME
    mechanism a live Dynamic Report already resolves titles/captions through — fed a `pageState`-
    shaped catalog built from `resolvedList` instead of the live broadcast, so no new substitution
    logic. Called from `convertDynamicToStatic` on `item.draft_sections` **only**. Handles both the
    plain-title case and the auto-diff-caption case (`_autoDiffCaption: true` → rebuilds the "Base:
    X · Comparison: Y" phrase live and freezes it, clearing the flag), reusing the exact
    `resolveReportDisplayText` contract other report pages already depend on.
  - **Deliberately draft-only, not published, after a second real finding**: an attempt to also
    directly overwrite `item.sections` (published) via the same `apiUpdate` call was **silently a
    no-op** — confirmed live (wrote it, re-read the DB, unchanged). Traced the reason: every OTHER
    section edit in this codebase (`sectionGroup.jsx`'s `updateSections()`, `useAddGraphSection.js`)
    writes `draft_sections` exclusively; published section CONTENT only ever changes through the
    page's own explicit Publish action, which mints entirely NEW published-row ids (confirmed:
    `report_build.mjs --publish` produced brand-new published section ids on every rebuild this
    session, never editing the existing ones in place) — not something a generic attribute write
    can do. This matches how every OTHER edit on a report page already behaves (a draft change
    needs an explicit Publish to go live); the `routes[]` freeze is the one exception, only because
    `reports_snap_2` has no draft/published split at all. **Consequence, not yet built**: converting
    a Dynamic Report with `%n`/`%y` titles to static freezes the DRAFT titles correctly, but the
    PUBLISHED copy keeps showing blank titles until the author separately clicks Publish — same as
    any other edit, but worth flagging since it's not obviously the same rule to someone expecting
    the toggle to be fully self-contained. No auto-publish step was built (Ryan: "focus on getting
    the feature working," not scope this further this pass).

**Bug 3 — static→dynamic grouping collapsed two real, distinct route-slot groups into one.**
Found while round-tripping `bi_directional` back to dynamic to re-test Bug 2's fix: "Change Routes"
went from asking for 2 picks to 1. Root cause: `convertStaticToDynamic`'s grouping logic groups
purely by "do two routes share a real catalog id right now" — with no awareness that
`bi_directional`'s own NB (`route_slot_group: "$0"`) and SB (`"$1"`) groups had both temporarily
been resolved against the SAME test route (`Route 5 Part`, id 2216791, from sub-item 1's own
2026-09-08 verification pass: `?routes=2216791|||2216791`) when they were converted to static. Re-
deriving grouping purely by shared id silently merged them — a real viewer would then only be
asked to pick ONE route, and both directions would show identical data, permanently discarding the
NB/SB split. **Fix**: `convertStaticToDynamic` now only auto-derives grouping-by-shared-id for
routes with NO existing `route_slot_group` marker; an existing one (meaning this report was already
Dynamic once, went static, and is converting back) is preserved verbatim, independent of whether
the routes it names currently happen to share a real id. Only a plain, never-been-dynamic static
report (no route ever carries `route_slot_group`) needs the shared-id heuristic at all — unchanged
behavior for that case. The preview-URL builder (`orderedIds`) was also corrected to build one id
per DISTINCT GROUP (not per distinct real id), since two distinct groups can legitimately share one
real id.

**`bi_directional` itself**: rather than hand-reconstruct the exact live DB state through this
sequence of bugs, Ryan's call — "we can always just remake bi_directional from the json... focus on
getting the feature working... use one of the report building scripts to re-gen from the known good
json spec" — rebuilt + republished 3 times over the course of this diagnosis (each time via
`node scripts/npmrds-reports/report_build.mjs scripts/npmrds-reports/dynamic_report_specs/
bi_directional.json --update 2216541 --publish`, `--update` given the numeric page id since
`--update bi_directional` alone doesn't resolve — the CLI's own `dms page show` needs either the
full slug or the id), each time confirmed via `report_probe.mjs reports/bi_directional --auth`
(0 console/page/SQL errors) and a direct DB read (`dms raw get`/`dms dataset query`). Left at the
clean spec baseline (2 groups, `route_slot_group: "$0"`/`"$1"`, templated `"%n (%y)"` route names,
templated `"... - %n"` section titles, Dynamic Report ON) — not touched further after the final
rebuild.

**Full live-verification, this round** (real dev-site login, `r.k.dubowsky@gmail.com`/`test123`,
project `npmrdsv5`, both `localhost:5173` and the correct `www.localhost:5173` host — Ryan caught a
navigation to the wrong host mid-session, which is why `bi_directional` briefly rendered with zero
routes; corrected and unrelated to any of the three bugs above):
- Static → dynamic with 2 genuinely different real routes (`Route 5 Part` id 2216791, `35E Queens
  Midtown Expy Westbound` id 2207838): immediate `?routes=2216791|||2207838` preview, both groups
  correctly distinct, both real datasets plotted, titles correctly resolved to each group's own
  route name (`"HOURS OF DELAY - ROUTE 5 PART"` / `"...- 35E QUEENS MIDTOWN EXPY WESTBOUND"`).
  0 console errors.
- Dynamic → static from that fully-resolved state: converted directly (no picker), 0 console
  errors. Direct DB read confirmed: `filters: []`, both groups preserved (`$0`/`$1`, not
  collapsed), both route names correctly frozen to their own real, distinct text.
- Repeated the identical round-trip a second time (this was the pass that caught Bug 3, before its
  fix): confirmed the grouping-collapse regression concretely (2 groups → 1), then confirmed after
  the fix that a repeat of the same round-trip preserves 2 groups correctly.

**Files changed** (supersedes the file list above — same files, three more edits): adds
`parseIfJSON` to `ReportRouteList.jsx`'s existing `pages/_utils` import; adds
`freezeSectionDisplayText` (module-level) plus its `resolveReportDisplayText`/
`ROUTE_CATALOG_PARAM_KEY` imports; `convertStaticToDynamic`'s grouping loop and `orderedIds`
construction rewritten as described in Bug 3.

**Living-doc fix, same session**: `src/dms/skills/traversing-report-pages.md`'s Dynamic Reports
section had a stale 2026-08-11 note claiming `?routes=` is silently inert on any `/edit/...` URL —
that was true then but was changed 2026-08-19 (report-authoring-ux-overhaul.md item 7) and this
session's own live testing repeatedly confirmed the current, correct behavior (edit-mode `?routes=`
resolves fully). Corrected in place per that doc's own living-document convention.

**Files changed**: `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx`,
`useDynamicReportRoutes.js`, `src/themes/transportny/components/RouteTagBrowserModal/
RouteTagBrowserModal.jsx`, `RouteTagBrowserModal.theme.js`,
`src/dms/skills/traversing-report-pages.md`.

### Unrelated bug, root-caused + FIXED: `report_build.mjs --update` silently never reconciled draft sections

Found while answering Ryan's question about `bi_directional`'s draft view showing stale literal
"Northbound"/"Southbound" titles — NOT caused by anything in this sub-item, and confirmed
independent of the spec file (the spec correctly has `"Hours of Delay - %n"` etc. for all 14
graphs, verified by reading `dynamic_report_specs/bi_directional.json` directly).

**Root cause, fully isolated** (Ryan: "i would like to know full scope / cause", "please stop
messing with bi_directional, make/use a scratch test page" — all further investigation and the fix
verification below used a disposable scratch page, `reports/claude_scratch_report_build_test`,
built from a copy of `weekly_average.json` with a different title; deleted after):

1. Manually running `dms section update <draftId> --data '{"title":"...","size":"..."}'` — even
   with the FULL payload shape `report_build.mjs` itself sends (`element`/`parent`/`trackingId`/
   `border`/`activeStyle` included) — always correctly persists. So the CLI/server write path
   itself is fine.
2. Added temporary debug logging to `report_build.mjs`'s own reconcile loop (reverted after) to
   print the exact section id it was calling `dms section update` on. **It was a different id than
   the one `draft_sections` actually references** — despite matching by the correct `trackingId`.
3. Traced why: the CLI's own `dms page dump --sections` (`packages/dms/cli/src/commands/page.js:
   149-152`) builds its `_expanded_sections` candidate list as `[...sections (published) ids,
   ...draft_sections ids]`, deduped only by **row id** — never by `trackingId`. Since Publish (the
   `DO_PUBLISH` block) mints an entirely NEW set of published-row copies on every single run while
   deliberately keeping each graph's original `trackingId` (its own comment says so: "Publishing
   creates a SEPARATE set of component rows sharing trackingIds"), `_expanded_sections` ends up
   holding TWO rows per graph under the identical trackingId — a (possibly stale) published copy
   AND the real draft row — with the published one listed FIRST. `report_build.mjs`'s reconcile
   does `updateCtx.sections.find(s => s.data?.trackingId === tid)` in three places (the framework-
   section match, the per-graph match, the orphan-deletion sweep) — all three therefore always
   matched the PUBLISHED row, never the actual draft one `draft_sections` points at.
4. This is why `bi_directional`'s PUBLISHED copy was never affected: Publish doesn't depend on this
   lookup at all — it independently rebuilds fresh rows straight from the spec every time,
   completely masking the bug for anyone only ever checking the published page.

**Scope**: not title-specific — confirmed on the scratch page that `size` (a second spec-driven
field) had the identical problem, and the mechanism (a `.find()` picking the wrong row) would affect
any field any of the three reconcile call sites write, on ANY already-existing section on ANY
`report_build.mjs --update`-managed report — not just `bi_directional`, and not just cosmetic title
text.

**Fix, verified**: `report_build.mjs`'s `--update` preflight now filters `_expanded_sections` down to
only the ids actually present in `dump.data.draft_sections` (`new Set(...).has(...)`) before it's
stored as `updateCtx.sections` — the one array all three reconcile call sites read from. Verified on
the scratch page: changed a graph's `title` AND `size` in a copy of the spec, reran `--update
--publish` — this time the DRAFT row (same id throughout, `2221379`) picked up both new values
correctly (previously it never had); reran again with an unchanged spec to confirm no reversion/
flapping; `report_probe.mjs edit/... --auth` showed the new title rendering live in the real app (not
just via a raw DB read), 0 console/page/SQL errors. Scratch page deleted after.

**`bi_directional` itself**: was hand-patched (all 14 draft titles set directly via `dms section
update`) BEFORE this root cause was found — that hand-fix is real and already verified, and this
`report_build.mjs` fix means it will keep reconciling correctly on any future `--update` run rather
than needing another hand-fix.

**Files changed**: `scripts/npmrds-reports/report_build.mjs` (the `updateCtx.sections` filter fix,
inside the `--update` preflight block, ~line 950-965).

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

Sub-item 4 (DONE — see above):
- `ReportRouteList.jsx` — `CATALOG_SNAPSHOT_FIELDS`, `groupsFullyResolved`,
  `isConvertToStaticModalOpen` state, `convertStaticToDynamic`/`convertDynamicToStatic`/
  `handleConvertToStaticConfirm`, `toggleDynamicReport` rewritten as the dispatcher, the new picker
  modal render.
- `useDynamicReportRoutes.js` — `mergeSlotWithCatalogRow` extracted and exported.
- `RouteTagBrowserModal.jsx`/`.theme.js` — new `message` prop / `headerMessage` token.
- `src/dms/skills/traversing-report-pages.md` — stale-note fix (see above), unrelated to the
  conversion mechanism itself but touched the same session.

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

Sub-item 4:
- [x] Static → dynamic converts every route into a slot, groups any sharing a real catalog id,
  strips catalog-snapshot fields, immediately previews via `?routes=<ids>` — confirmed live, header
  pill/legend/RRL row all resolve correctly in the same render.
- [x] Dynamic → static, already fully resolved: converts directly, no picker — confirmed live +
  via direct DB read (frozen name, `dateFormula`/`derivedFromRoute` preserved, real catalog fields
  baked in).
- [x] Dynamic → static, NOT fully resolved: opens the blocking picker (the modal, not inline —
  Ryan's explicit correction) with an explanatory message, pre-populated with whatever's already
  resolved; confirming converts correctly (same frozen-name fix applies via the shared
  `convertDynamicToStatic` function).
- [x] Cancel on the picker is a true no-op — Switch stays on, nothing persists, confirmed live.
- [x] Real bug found + fixed: unsubstituted `%n`/`%y` tokens going permanently blank once frozen to
  static — fixed by freezing the RESOLVED label into `name` at conversion time, verified both via
  the picker path and the already-resolved path.
- [x] Regression check on a real, published, unmodified static report
  (`reports/beacon_9_d_jan_25_vs_26`) — byte-identical render, Switch shows OFF as before, 0 console
  errors.
- [x] 0 console errors across every conversion direction/path exercised.
- [ ] Not tested: 2+ DISTINCT route groups (e.g. a real NB/SB Dynamic Report) through either
  conversion direction — no such scratch report exists yet (same gap sub-item 3's own checklist
  flags).

Scratch page: `reports/claude_scratch_pct_template` (id 2218565) — **kept, not deleted, per Ryan's
2026-09-05 call**, for reuse across the rest of this Phase 4 arc. Left in a clean one-slot state.

## Cross-references

- `planning/transportny/tasks/current/npmrds-reports-routes-feedback-triage.md` — parent triage
  doc, Phase 4 section (where this was scoped out of).
- `planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` — the underlying "core
  mechanism DONE" Dynamic Reports build this extends; read before implementing.
- `src/themes/transportny/components/ReportRouteList/README.md` — component's own design history.
