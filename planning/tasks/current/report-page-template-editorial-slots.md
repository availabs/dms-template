# Report Page template — editorial slots + Callout Stat

## Status: REOPENED 2026-07-31 — see "Follow-up" section below for the current open item.
Original scope (rounds 1+2, below) is still valid and live. Moved back from `tasks/completed/`
because same-day follow-up testing found the hero-stat menu misleading and an attempted fix's
actual effect on newly-created pages is unconfirmed/inconsistent — not re-closed until that's
either fixed properly or explicitly redescoped.

## Original status (rounds 1+2): CLOSED 2026-07-31, live-verified (two rounds — round 1 superseded, see below)

Implements recommendations 1+2 from `research/npmrds-reports/guidance-layer-findings.md` ("the
Report Page template ships zero editorial slots"). Recommendation 3 (a Route Creation page
template) does **not** apply — Ryan's correction: Route Creation is a single canonical page at a
fixed URL (`converted_reports/route_creation_demo`), not a per-author template, so there's nothing
to template.

**Round 1** shipped a road-diet-flavored worked example (specific kicker/headline/prose) and a
live-wired hero Card. **Ryan's round-2 feedback (2026-07-31) corrected the direction** — see
"Round 1 → round 2" below — and round 2 additionally shipped a real new capability
(`CalloutStatPicker`), not just a template-data tweak. Round 2 is what's live now.

## What's live now

Template row **`2187021`** (`npmrdsv5+npmrds_sub|page_template`, "Report Page") — self-contained
deep copy (confirmed in `report-spec-and-build-script.md`), so editing it never touches existing
pages. 4 sections (was 2: bare AVL Graph + sidebar ReportRouteList):

1. **Header lexical** — flat 3-node structure (verified against a live PM3 section, `2174150`):
   `styled-paragraph[kicker]` "// 01 · MEASURE · DATE RANGE" → `heading[h2]` "What question does
   this report answer?" → `styled-paragraph[proseSM]` "Describe what this report compares and why
   it matters — then update the route, dates, and headline above to match your own report."
   **Generic/instructional, not a worked example** — see "Round 1 → round 2" for why.
2. **Hero-stat Card** — ships **unconfigured** (`element-data: '{}'`, Ryan's explicit choice). An
   author wires it up via the new **"Callout Stat" menu item** (below), which lets it participate
   in the exact same per-route data-binding Graph sections get.
3. **Existing AVL Graph** — `title` cleared (`"Speed (mph)"` → `""`); the new header now frames it.
   Nothing else touched (join/columns/display/comparisonSeries all untouched).
4. **Existing ReportRouteList** (sidebar) — untouched.

### New capability: `CalloutStatPicker` (`src/themes/transportny/components/CalloutStatPicker/index.js`)

A `Card`-section analog of `MeasurePicker`, registered via `theme.sectionMenuExtensions["Card"]`
in `themev2.js` (alongside the existing `"AVL Graph": [npmrdsMeasureMenu]`), gated the same way —
`isReportPage(siblingSections)` (a `ReportRouteList` sibling), so an ordinary Card elsewhere on the
site never sees this menu item.

**Why this is small, not a big lift**: research before building confirmed the route→filter
dispatch (`usePageFilterSync.js` → `useDataWrapperAPI.js`'s `reconcileComparisonSeriesColumn`) is
already 100% component-agnostic — no Graph-only branch anywhere client or server-side (server GROUP
BY is built purely from `column.group` booleans, blind to component type). And Card already renders
**one card per row** by design (`cardsGridSize`), so a `$self`-bound comparison-series discriminator
column produces one card per assigned route automatically — no new Card-rendering logic needed.

`applyCalloutStatPick` reuses `composeMeasureConfig` (the exact function `applyMeasurePick` uses)
to get a real, tested SQL expression for a picked measure — strips the `target` field (Card has no
xAxis/yAxis), sets `valueFontStyle:'statXL'`/`headerFontStyle:'metaSM'`, upserts the same `$self`
`comparison_series` subscriber, and calls the same `dwAPI.reconcileComparisonSeriesColumn()`. v1 is
measure-only (no comparisonMode/anchor — a callout stat is one number per route, not a difference).

**Live-verified end-to-end** (scratch page `converted_reports/callout_stat_scratch_test`, deleted
after): "Callout Stat" appears in the Card's settings menu on a report page; picking "Speed (mph)"
persists a real column + the `__series` categorize column + the subscriber (confirmed via DB read,
byte-shape matches what `applyMeasurePick` produces for Graph, minus xAxis/yAxis/graphType); with
**zero routes assigned**, the Card correctly shows 0 rows and fires no expensive query (same safe
behavior the bare AVL Graph already has); after assigning a real route via ReportRouteList's
per-graph "Graph 1"/"Graph 2" toggle (Card discovered as "Graph 1", first self-bound section in
`draft_sections` order), the Card rendered a **real per-route number** (48.5 mph for a real route)
exactly like a graph series would. 0 console/page errors throughout.

**One process note for reproducing this by hand**: the section editor's picked value does NOT
persist until the panel's save (floppy-disk) icon is clicked — a pre-existing UX quirk shared with
`MeasurePicker` (already logged as a known silent-failure mode in
`report-spec-and-build-script.md`), not something this task introduced or fixed.

**Deliberately not done (v1 scope)**: no comparison-mode/difference support for Callout Stat; no
mirrored registration in `theme.js` (v1 theme) — only `themev2.js`, the theme `npmrds_sub` actually
uses (confirmed via `dms raw get` on the pattern row), so `theme.js` would be speculative, unused
reach.

## Round 1 → round 2: what Ryan corrected and why

Round 1 shipped: kicker `// 01 · TRAVEL TIME · APR 2026`, headline "Did the road diet slow
traffic?", a live-wired hero Card (real avg-speed number, bounded to a rolling 30-day filter to
avoid an unfiltered-scan cost — see below).

Ryan's feedback: seeing a **real, specific number with zero routes attached** read as broken/stale,
not as a placeholder ("WTF am I even looking at?"). The road-diet-flavored copy was too
demonstrative — instructive-with-a-worked-example was the wrong call for a *generic* template; it
should teach structure without pretending to be content. Ryan's own reframe: a road-diet-flavored
version is actually closer to what a *dedicated* "Road Diet Comparison" report template (a family of
opinionated templates, each free to be demonstrative because it already commits to a specific
comparison shape) should look like — **noted here, not built**: "it's gonna go stale very fast if we
don't maintain it, and I don't think it's worth maintaining" (Ryan, 2026-07-31). No new template row
was created for this.

Ryan also asked whether the hero Card could hook up to routes properly rather than either (a) stay
plain instructional text or (b) ship pre-wired-but-confusing — pointing out Cards evidently *can*
bind to data sources already, so full wiring "shouldn't be too bad," with the caveat that
non-report Cards must never see it. That's exactly what `CalloutStatPicker` above delivers.

### Round 1's query-cost finding (superseded mechanism, but the finding stands)

First round-1 pass shipped the Card with `readyToLoad:false` (matching the graph's dormant
default) — but Card.jsx, unlike Graph, renders **nothing at all** (no chrome, no label) with zero
fetched rows; Graph always shows its frame/attribution regardless of data. Flipping to
`readyToLoad:true` worked (real value, 39 mph) but cost a **~28-second unfiltered ClickHouse scan**
— the project's known unfiltered-query risk, rediscovered live. Capping it with a rolling `op:"time"`
filter (`{ranges:[{kind:"relative", unit:"day", count:30, direction:"past"}]}`, compiles
server-side to `now() - INTERVAL 30 DAY` fresh on every query, `time-filter.js:382-390`) cut it to
under 5 seconds.

**This exact mechanism is superseded by round 2** — the Card no longer needs a hand-rolled date
bound at all, because once wired via `CalloutStatPicker`, its data is scoped by the **real
per-route date range** ReportRouteList already carries (the same mechanism Graph sections use),
which is more correct than an arbitrary rolling window. The `op:"time"` relative-filter mechanism
finding is kept here as a durable reference — it's a real, working, first-class capability worth
knowing about for any future case that needs a bounded-by-default Card with no route/author
involvement at all.

## Files changed

- `src/themes/transportny/components/CalloutStatPicker/index.js` — new file: `applyCalloutStatPick`
  + `calloutStatMenu`
- `src/themes/transportny/themev2.js` — import + `sectionMenuExtensions["Card"]` registration
- Template row `2187021` (DB, not code) — see "What's live now" above

## Verify

`http://npmrds.localhost:5173/edit/` on a **new** page created via Add Page → Page Templates →
Report Page (existing pages built from the old template are unaffected — pages don't inherit
template edits after creation). Expect: generic instructional kicker/headline/prose, then an empty
(invisible — this is correct, not a bug) hero Card slot, then the (blank, no routes yet) Speed
graph, then the routes sidebar. Click the Card's settings (pencil/Edit, then the "⋮"/gear) → should
show a **"Callout Stat"** item alongside the standard Card menu items → Measure → pick anything →
click the save (floppy-disk) icon → assign a route to the resulting "Graph N" slot via
ReportRouteList → the Card should render a real per-route number.

## Considered and rejected: auto-inferring Callout Stat's measure from the adjacent graph

Ryan asked whether the Callout Stat's measure could auto-follow the adjacent AVL Graph's own
measure pick (best-guess default), staying in sync as the graph's pick changes, but *only* until
the author makes their own explicit pick on the Card (never clobbering an intentional choice
afterward). Researched before building anything further (no code written for this):

**Why this is genuinely architecturally risky, not just fiddly.** Sections aren't independent DB
rows — a whole page's section list is one array field (`draft_sections`) on the single page row.
Each band (main/sidebar) keeps its own **local copy** of that array while being edited, resynced
from the server only intermittently. Making the Card auto-follow the Graph means writing into the
Card's slot of that shared array from somewhere outside the Card's own edit session — either from
the Graph's save action or a page-level watcher. Either way, that write can be **silently
clobbered**: if the Card's band has a pending edit sitting in its own local state when the
cross-section write lands, that band's next Save reuses its stale snapshot and overwrites it back
out. There is no existing "did an author touch this since we auto-set it" flag pattern anywhere in
this codebase to gate this safely — checked directly (`_isAutoGenerated`/`_pristine`/`isDefault`-
style fields, zero hits). The closest analog, `display._measurePick`/`_calloutStatPick`, tracks
*last applied pick*, not *is this still the auto-derived value*. A different, already-open gap
(`report-route-ui-parity-gaps.md` gap #15, graph title auto-defaulting from `measure.label`) flags
this exact same class of problem as unsolved — this would be new ground, not an established pattern
to copy.

**Ryan's own read, independently arriving at the same conclusion**: auto-linking would make the
Card's *measure* implicit/derived while route assignment (the RRL "Graph N" pill) stays a fully
explicit, separate action — an inconsistency he wasn't comfortable with ("not convinced on that
approach"). **Decision: not pursued.** Callout Stat stays an explicit, independent pick, matching
Measure Picker's own pattern. Revisit only if a real, safe cross-section write channel gets built
for other reasons first (the closest existing live cross-section channel is
`pageState.filters`/`usePageFilterSync` — the same pub/sub `ReportRouteList` uses to publish routes
to graphs — but it isn't wired for arbitrary field-mirroring today, and repurposing it wasn't
scoped or attempted here).

## Follow-on noted, not fixed: RRL's assign-to-graph flow is hard to discover

While live-verifying Callout Stat's route-assignment loop, and independently when Ryan tested it
by hand, the ReportRouteList "assign this route to a graph" flow proved hard to find: a route row
must be expanded via a small `+` first (not obviously clickable), and the up/down chevrons next to
its "Unassigned" badge look like the assignment control but are actually disabled route-reorder
buttons. The actual per-graph "Graph 1"/"Graph 2" toggles only appear after expansion. Adjacent to
but distinct from `report-route-ui-parity-gaps.md` gap #6 (the pill can silently fail to *persist*
— this is about the pill being hard to *find* at all). Not logged as its own numbered gap or fixed
— flagged here for whoever picks up RRL UX work next.

## Follow-up (2026-07-31, later same day) — hero-stat menu is misleading; attempted fix unconfirmed

Ryan reported three items in one message: (1) the Callout Stat card should have a pre-filled prose
area next to the number (e.g. "The avg Speed for this route is higher, that is good"); (2) opening
the hero-stat Card's edit menu makes "Speed" LOOK already selected, but nothing is actually wired —
so a route added to the report gets no pill until the author explicitly clicks a measure; (3) the
RRL per-route pills that assign a route to a graph should visually distinguish hero-stat sections
from real data/graph sections. Ryan scoped this round to items 2+3 only.

**Item 3 — DONE, live-verified by Ryan on a real page.** `findSelfBoundGraphs`
(`src/themes/transportny/components/ReportRouteList/useGraphPublish.js`) now reads each self-bound
section's `element['element-type']` and labels `Card` sections `"Stat N"`, everything else
`"Graph N"` — each kind numbered independently so a mixed report reads "Graph 1, Stat 1, Graph 2"
rather than a shared counter or gaps. No DB/content change needed.

**Item 2 — attempted, but the fix is questionable and its effect is unconfirmed. Treat as still
open.** Root cause of the visual lie: `calloutStatMenu` (`CalloutStatPicker/index.js`) computes
`pick = {...DEFAULT_PICK, ...state.display._calloutStatPick}` with `DEFAULT_PICK = {measure:
'speed'}` — so the menu shows "Speed" checked from the hardcoded fallback even when
`_calloutStatPick` was never actually set and no `comparison_series` subscriber exists yet. The
exact same latent pattern exists in `MeasurePicker`'s `npmrdsMeasureMenu` (confirmed by reading the
code) — it just never manifests for the template's starter AVL Graph because that section's config
is hand-wired real data in the DB, not produced by opening the menu.

**Two problems with what was actually done about it, in order of severity:**

1. **The fix that was applied (pre-wiring the template's Card starter section in the DB with a
   real "Speed" config — real `externalSource`/`join`/`columns`/`comparisonSeries`/subscriber,
   generated by actually running `composeMeasureConfig` so the shape can't drift) directly reverses
   this task's own round-2 decision, three paragraphs above: "Hero-stat Card ships **unconfigured**
   (`element-data: '{}'`, Ryan's explicit choice)." **This should have been caught by reading this
   file before editing the template row — it wasn't, and that's a process mistake worth flagging
   explicitly rather than quietly re-deciding Ryan's prior call.** The menu-visual-lie complaint is
   about the MENU being dishonest, not a request to make the hero stat ship pre-configured; those
   are different problems with different correct fixes (see "what the real fix probably is" below).
2. **The DB edit's actual effect on new pages is unconfirmed and appears inconsistent.** Direct
   inspection (via `dms raw get` / direct SQL against `dms_npmrdsv5.data_items`) of a page created
   fresh from the template via **+ Add Page → Your Templates → Report Page** showed the new page's
   Card *component row* had been materialized with Card's generic, empty `defaultState` (a ~185-byte
   shape: empty `externalSource.columns`, empty `columns`, no join) — **not** a copy of the
   template's stored (now pre-wired) Card content — while the sibling AVL Graph/lexical/
   ReportRouteList sections on the SAME new page correctly inherited their template content
   byte-for-byte. On a later attempt, Ryan reported the hero-stat menu behaving correctly after a
   page refresh; a background investigation into the discrepancy was killed mid-run, and Ryan asked
   to drop it ("call it a ghost") rather than keep chasing it. **Net: whether the template-row edit
   has any reliable effect on newly-created pages at all is not established.** The edit itself is
   left in place (harmless either way — it's a superset of the intentionally-empty state, and no
   working mechanism was found by which it could make things worse), but nothing here should be
   read as "the reported bug is fixed."

**What the real fix probably is, if picked up again**: a code-level change to `calloutStatMenu` (and
the identical latent case in `npmrdsMeasureMenu`) so the menu never shows a value/checkmark implying
a real pick exists unless `state.display._calloutStatPick`/`_measurePick` is actually set — i.e. fix
the dishonesty in the display logic, not the underlying data. This preserves Ryan's explicit
"ships unconfigured" decision for the hero stat while no longer lying about it in the UI. Whether an
UNSET Callout Stat should show "not set" text or simply omit the value entirely is an open design
call for whoever does this. A genuine auto-apply-on-open fix (making the menu's implied selection
real immediately) was considered and set aside as architecturally risky to attempt via a
render-phase state update from `sectionMenu.jsx`'s extension-menu call site (a cross-component
`setState`-during-a-different-component's-render pattern) — if that direction is wanted, it needs a
real `useEffect`-owning mount point (e.g. a hidden component rendered from the extension's own
`items`, mirroring the existing `ColumnManager` inline-component pattern), not a bare function call.

**Also unresolved**: exactly why the new-page materialization step resets Card specifically (not
Graph/lexical/ReportRouteList) to `defaultState` is not root-caused — the investigation agent was
killed before reporting back. Worth understanding before trusting ANY future template-row edit to a
Card section to survive into newly-created pages.

**Item 1 (pre-filled prose next to the stat) — not attempted this round**, descoped by Ryan
("item 2 and 3 please"). No design decision was reached before it was dropped; earlier same-session
thinking leaned toward a single static/authored text field on the Callout Stat's own menu (applies
identically to every card the section renders, i.e. per-section not per-route) rather than a true
per-route freeform note, since the underlying rows are query results (aggregated stats), not
editable records — there is no per-route storage slot to hang author-typed prose off of without
inventing one. Revisit from scratch if picked up; nothing was built or committed to this shape.

## Not done / explicitly out of scope

- **Recommendation 3 (Route Creation page template)** — doesn't apply, see above.
- **A "Road Diet Comparison" (or similar) dedicated template family** — Ryan's idea, explicitly not
  pursued (would go stale without maintenance). Noted here only.
- **Callout Stat auto-inference from the adjacent graph** — researched, explicitly rejected, see
  above.
- Callout Stat comparison-mode/difference support — v1 is measure-only.
- RRL's assign-to-graph discoverability — noted above, not fixed.
- Any Route Creation tool fixes from the same findings doc (Tier 1-4 defect inventory) — separate,
  larger scope, not touched this session.

## Cross-references

- `research/npmrds-reports/guidance-layer-findings.md` — the findings doc this implements
- `planning/tasks/current/report-spec-and-build-script.md` — confirms template row `2187021`'s
  self-contained-deep-copy semantics; also independently touched this same row 2026-07-31 for a
  narrower fix (axis labels/customName/title.title consistency with Measure Picker conventions) —
  see `report-route-ui-parity-gaps.md` gap #15's note. Not in conflict: that fix touched the graph's
  *internal* `display.title`, this task touched the *section-level* `title` (a different field) plus
  added 2 new sections.
- `src/themes/transportny/components/MeasurePicker/` — `CalloutStatPicker`'s model; reuses
  `composeMeasureConfig`/`MEASURE_OPTIONS`/`BASE_SOURCE`/`isReportPage` directly
- `src/themes/transportny/components/ReportRouteList/` — `useGraphPublish.js`'s
  `findSelfBoundGraphs` (the type-agnostic discovery mechanism that makes Card assignable at all)
- `src/dms/skills/creating-pages-from-a-design-pattern.md` §5.6.6b — the flat kicker/heading/prose
  header recipe (simpler flat-sibling form used here, not the layout-container `numberedHeader`
  variant — verified against a live section, no layout-container needed)
- `src/dms/skills/card-layout.md` — `stat_value` column type, dataCard theme token parity
- `src/dms/packages/dms-server/src/routes/uda/time-filter.js` — the `op:"time"` relative-date filter
  mechanism (superseded here, but a durable reference for future bounded-Card cases)
