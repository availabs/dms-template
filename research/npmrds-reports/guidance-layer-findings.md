# Reports & Routes — the guidance/feedback layer (findings, 2026-07-31)

**Trigger.** Ryan compared the NPMRDS reports/routes work against the MAP-21 PM3 dashboard he'd
run into at `/map_21` and asked whether the difference is that his pages give the user no
*direction* — no text hierarchy, no prose, no sense of what you're looking at or how to use it —
and asked for pushback if that reading was wrong.

**Scope correction applied mid-investigation (Ryan's steer).** The subject is the **two tools**,
not the content of any individual report:

- **Part 1 — Route Creation**, `converted_reports/route_creation_demo` (page `2195792`). This is
  the page all users will go to in order to create/edit routes.
- **Part 2 — Creating a Report**, `Add Page → Page Templates → Report Page` (template row
  `2187021`), then editing the resulting page.

A converted report's own copy, colors and titles are **author artifacts** (mostly reproduced
faithfully from the 2017–2019 tool by `convert_old_reports.py`) and are not critiqued here. Every
observation below is aimed at what the *template and tool* produce or fail to produce.
Everything in this arc is **dev-only** — no page is live or client-facing.

## The axis

Three distinct axes now exist for "why does this feel unfinished," and they need different inputs
to surface:

| Axis | Question | Where tracked |
|---|---|---|
| Capability / parity | Does the mechanism work? | `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` |
| First-touch authoring | Can an author get in the door? | `cold-open-ux-findings.md` (same day) |
| **Guidance / feedback** | **Does the tool or page tell the user anything?** | **this doc** |

Zero of the ~30 items on the 2026-07-30 consolidated gap list belong to the third category. A
spec-parity audit structurally cannot produce "the tool never says what it did," because producing
that requires driving the tool and reading its output states, not auditing its capabilities.

## Reference — what the PM3 page actually does

Section inventory (`dms_npmrdsv5.data_items`, page `2173915`):

| element-type | count |
|---|---|
| `lexical` | **20** |
| `Card` | 10 |
| `AVL Graph` | 4 |
| `Spreadsheet` | 2 |
| `Filter` | 1 |
| **total** | **37** |

**54% of that page is text sections.** The mechanism is documented in its own build log
(`src/dms/planning/tasks/completed/map21-single-page-dms-build.md`, session 2026-06-03): *clear the
data section's bare `title`, then frame it with sibling lexicals* — mono kicker + question-form
`h2` + `proseSM` above, `proseXS` footnote below. That recipe lives in
`creating-pages-from-a-design-pattern.md` §5.2.1. It is why every section head reads "Are we meeting
our 4-yr FHWA targets?" instead of "LOTTR INTERSTATE."

**Provenance matters for calibration.** PM3 was built *backwards from a hand-authored HTML mockup*
(`src/themes/transportny/.../dms_design_system_v2/pages/map-21-system-performance.html`) across
eight phases, shipping ~15 new primitives on the way: `status_pill` / `target_bar` / `delta` column
types, a `percent` formatFn, themeable `UI.Pill`, Card `headerJustify`/`headerCase`, named
`dataCard` / `table` / `filters` theme styles each with a per-section style picker, avlGraph
area/interpolation/dash/domain/tooltip tokens, `download_button`, `height:'fill'`. The in-page nav
rail landed later (`in-page-nav-themeable-sidebar.md`, DONE 2026-06-09) and section header
extensions after that (`section-header-extensions.md`, DONE 2026-07-22).

So the polish is not taste — it is a mockup plus eight phases of primitive work. Those primitives
are now built and author-accessible, which is what makes the recommendations below cheap.

**One thing that cannot be copied:** PM3's entire idiom is *compliance* — "MEETS TARGET", "4.8 pts
above target", `status_pill` — because a federal benchmark exists. An arbitrary route report has no
target and no "should." Do not port `status_pill` onto a report page and then discover there is no
status. The analogous hero strip for a route report must be **descriptive** (worst hour, peak
delay, Δ vs the comparison period), not evaluative.

## Finding 1 — report *output* is in better shape than first assessed (record corrected)

The initial read was taken from `converted_reports/rexford_bridge_pre_post_comparison_created_on_6_14_19`
(page `2190874`), which is **old-architecture** output and not representative. Corrected comparison:

| page | `lexical` | total sections |
|---|---|---|
| PM3 dashboard `2173915` | 20 | 37 |
| Poughkeepsie, new arch `2196582` | **1** | 9 |
| Rexford, old arch `2190874` | 0 | 7 |

`converted_reports/poughkeepsie_garden_st_road_diet` already carries a page title, a real
three-paragraph deck with methodology *and* scope caveats, per-graph "how to read this" captions,
axis labels with units, semantically-chosen series colors (green baseline / orange closure) with
descriptive legend labels carrying date ranges, attribution collapsed to **one** line, and clean
x-axis ticks. That is nearly the entire list of things initially reported as missing.

**But it proves capability, not guidance.** That prose exists because an author knew to add a
`lexical` section. The new architecture emits **one** editorial block at the top and then nothing —
every graph after it carries only its own bare `title`. Nothing in the tool leads anyone there.

## Finding 2 — the Report Page template ships zero editorial slots

Template row **`2187021`** (`npmrds_sub|page_template`, name "Report Page") contains exactly two
`draft_sections`:

1. an **`AVL Graph`** titled "Speed (mph)" — pre-wired to NPMRDS Production V6 (source 583/view 982)
   ⋈ TMC Identification V5/V6 (455/3464) on `tmc`, `comparisonSeries.enabled: true`, `LineGraph`,
   `epoch` x-axis with `epoch_time` format, axis labels "Time of Day" / "Speed (mph)", 20-color
   palette
2. a **`ReportRouteList`** in the `sidebar` group — pre-wired to `reports_snap_2` (2177438/2177440)
   ⋈ `routes_data` (2107426/2107427)

**No `lexical` section. No title slot, no deck slot, no placeholder text, not one word of
guidance.** A fresh report page is a route panel, one speed chart, and silence. Nothing cues the
author that a title is expected, that a description belongs anywhere, or that `lexical` sections
are the mechanism the polished page next door uses twenty times.

Cheapest possible fix, and it needs no new primitives: `page-templates.md` records that the generic
**theme** templates already ship "Lexical placeholder text (heading + body paragraph)." Seeding a
template with placeholder prose is an implemented, established convention in the template system.
The Report Page template simply does not use it.

**Also: there is exactly one `page_template` row in the entire pattern.** There is no Route Page
template. To create a route an author must know to make a page, add a `Map` section, and attach the
"Route Creation Plugin" symbology by name.

## Finding 3 — Route Creation tool: defect inventory

Code: `src/themes/transportny/components/routecreation/` (ported natively into dms-template
2026-07-29; transportNY's copies are no longer the develop/test target).

**Calibration first — the mechanism is in good shape.** Click-to-select works, marker mode
auto-routes with a green→yellow→red sequence gradient, mileage sums live, Remove Last / Clear All
have mode parity, the TMC search zooms the map to the matched segment via `setGeoBounds`, and the
save modal's *"Saving will overwrite it, not create a new one"* in red is the single
best-designed warning in the tool. What follows is almost entirely one layer above the mechanism.

> **Verification status:** items in Tier 1 are **source-derived, not yet live-verified** — a live
> click-through was set up but not executed this session. Tiers 2–4 are visible in the rendered
> panel and/or unambiguous in source. Confirm Tier 1 empirically before scoping fixes.

### Tier 1 — silently produces wrong routes

1. **No continuity check.** `hooks/useMapTmcHandler.js` `toggleTmc` appends any clicked TMC with no
   adjacency test. A segment in Buffalo plus a segment in Albany is an accepted "route," which then
   feeds reports that sum travel time and delay along it. For a tool whose output is a corridor,
   silently accepting a discontiguous set is the most consequential gap here.
2. **No direction check, and the field is not even fetched.** TMCs are directional; nothing prevents
   mixing NB and SB in one route. Source 455 carries a `direction` column, but
   `hooks/useRouteData.js` requests only `["tmc","miles","intersection"]`. The one field that would
   let a user catch a wrong-direction click is neither fetched nor displayed.
3. **Sequence is invisible in the default mode.** `tmc_array` order *is* the path. Marker mode
   conveys order via `MARKER_GRADIENT_COLORS`; **TMC Click mode — the default
   (`DEFAULT_CREATION_MODE`) — has no sequence affordance at all.** No list numbering, no
   drag-to-reorder (despite `UI.DndList` existing and being used elsewhere), no sort-along-path.
   Clicking segments out of order leaves Remove Last as the only recovery.
4. **Silent truncation at 200 segments.** `useRouteData.js` caps `dataByIndex` at
   `{from: 0, to: 200}` and then filters out any row without a numeric `miles`. A 250-segment route
   renders 200 rows and a **Total Miles that is quietly wrong**, with no "showing 200 of 250."
5. **Routing failure is indistinguishable from "nothing happened."** `hooks/resolveRoute.js` returns
   `[]` for `data.err`, for a thrown fetch, *and* legitimately for <2 points;
   `hooks/useMapMarkerHandler.js` writes that `[]` straight into `tmc_array`. Per the comment on
   `DEFAULT_ROUTING_YEAR` in `constants.js`, failure is the **common** case outside 2020–2022. So the
   user drops two markers, watches them land, and the TMC list simply stays empty — no error, no
   "couldn't match a route between these points," no hint that the year is why. The `console.error`
   goes somewhere no author will look. `DEFAULT_ROUTING_YEAR = 2022` is hardcoded with no UI, so
   someone building a 2025 corridor silently gets a 2022 network match.

### Tier 2 — the empty state is where the guidance belongs, and it is empty

6. **No title, no purpose statement.** The panel opens with two buttons. Nothing on the page says
   what the tool is or what a route is for.
7. **`tmcRows` returns `null` when the list is empty** (`components/RouteEditor.jsx`), so the largest
   region of the panel renders literally nothing on arrival. That blank box is the highest-value
   real estate in the tool. It should carry the instruction — *"Click segments on the map to add
   them"* / *"Drop at least two markers — we'll match a route between them"* — because nothing
   currently tells the user **the map is the input surface**.
8. **"TMC Click" / "Markers" are implementation names.** A first-timer does not know what a TMC is,
   and nothing explains the tradeoff: clicking is exact, markers auto-route and can fail.
9. **Mode switching destroys work with no confirmation.** `comp.jsx:94` `setCreationMode` calls
   `clearAllMarkers()` *and* wipes `tmc_array` — deliberate, documented as old-tool parity. A user
   with 40 segments who taps "Markers" out of curiosity loses all of it instantly, no undo. Most
   damaging click in the tool, styled as a harmless tab.
10. **Destructive actions have inverted visual priority.** `Remove Last`, `Clear All` and each row's
    `Remove` are `<div onClick>` — no keyboard focus, no Enter/Space, no focus ring, invisible to
    assistive tech — while `Clear All` (fully destructive, no undo) renders *smaller and lighter*
    than the mode toggle, which correctly uses `UI.Button`.

### Tier 3 — entry paths

11. **There is no way to open an existing route.** Editing requires arriving with `?route_id=<id>`
    (`comp.jsx:202`, `PAGE_FILTER_KEY`). No route list, no picker, no recents. **The edit half of
    "create/edit routes" has no entry point on the page** — the largest functional hole relative to
    the page's stated purpose.
12. **The opening viewport cannot do the primary task.** The map lands at whole-Northeast zoom where
    the network is a white hairball and individual segments are sub-pixel; the only path to a
    corridor is manual pan/zoom. No place search, geocoder, or county picker. The one search that
    exists needs an exact 9-character TMC code — useful only to someone who already has the ID.
13. **No hover preview.** `useMapTmcHandler.js` binds `click` only — no cursor change, no highlight,
    no road-name tooltip, so on overlapping lines you cannot tell what you are about to select
    before committing. `queryRenderedFeatures` then takes `features[0]` (topmost) with no
    disambiguation. Same shape as report-side gap #3.
14. **Click is a toggle and nothing says so.** `toggleTmc` *removes* an already-present TMC, so
    clicking a segment you already added silently deletes it from the middle of the route. No
    "already in route" state is painted on the map.
15. **The panel occludes the map with no collapse or drag.** 318px × up to 520px pinned
    `top: 25px; right: 8px`. Albany at default zoom falls roughly under it. The in-file comments show
    this was already fought once with a magic offset — the signal that *collapsible* is the real fix
    rather than another number.
16. **The "Layers" tab is a visibly empty labeled container** (section config:
    `tabs: [{name: "Layers", rows: []}]`).

### Tier 4 — save flow

17. **Hand-rolled modal.** `comp.jsx:261` — `position: fixed; top: 10%; left: 25vw; width: 50vw;
    height: 60vh`, `display: none/block`, `zIndex: 1001`, `opacity: .9`. Bypasses `UI.Modal`,
    against `src/dms/CLAUDE.md`'s ThemeContext convention: no focus trap, no Escape-to-close, no
    backdrop, not responsive — and a 60vh box holding two fields with the buttons pinned
    bottom-right, ~30vh away from them.
18. **Name is not required.** `addItem` posts an empty name happily; no validation, no duplicate
    check. The Save button carries `disabled:` classes but never receives a `disabled` prop.
19. **`<input type="textarea">`** in `SaveRouteModal.jsx`'s `ModalInputField` — not a real type;
    browsers fall back to `text`. Description is a single-line field that looks multi-line.
20. **No save feedback either way.** Success navigates to `?route_id=<id>`; failure just closes the
    modal. No toast, no error — the only signal of failure is that the URL did not change.
21. **`externalPanel: () => {}`** (`routecreation.plugin.jsx`) returns `undefined` rather than a
    component or `null` — latent React footgun if anything ever renders it. `internalPanel.jsx` is
    mapeditor-admin only (a single "Shapefile Layer" select).

## Through-line

Almost every item above is **missing feedback, not missing capability**: no empty-state
instruction, no hover preview, no sequence indicator, no continuity/direction warning, no
routing-failure message, no truncation notice, no save confirmation, no guard on either destructive
action; and on the report side, no editorial slots in the template. The mechanisms work. What is
absent is the layer that tells the user what happened.

That is why "the mechanism works" and "it feels unfinished" are simultaneously true, and why
closing parity items one at a time has not moved the feeling — the parity list tracks capability,
and this is entirely the layer above it.

## Recommendations, ranked

**Route Creation** (cheapest first, except #3 which is placed by consequence not cost):

1. Empty-state instruction text per mode — pure copy in the `tmcRows === null` branch.
2. Routing-failure message + surface the routing year — distinguish `err` from `<2 points` in
   `resolveRoute`, return a reason, render it.
3. Fetch and show `direction`; warn on mixed-direction and non-adjacent segments. Largest of the
   five but the only one that prevents actually-wrong reports.
4. Confirm before the mode-switch wipe and before Clear All; make all three destructive actions real
   `<button>`s.
5. "Showing 200 of N" when the cap bites.

Then Tier 3's route-picker (#11) — it is the biggest functional hole, but it is a feature, not a
copy fix.

**Report Page template `2187021`** — three edits, (1) and (2) are template-data only, no code:

1. Add a header `lexical` as section 1, **pre-styled at PM3's three levels with real example copy**
   (mono kicker `// 01 · TRAVEL TIME · APR 2026`, question-form display headline "Did the road diet
   slow traffic?", one-sentence prose scope note). Placeholder-as-worked-example beats
   placeholder-as-blank: an author edits in place and inherits the hierarchy whether or not they
   understand it. `"Add a description here"` teaches nothing.
2. Promote the single bare graph into **one complete compound band** — `lexical` (kicker + section
   headline) → `Card` (hero stat) → `AVL Graph` — so the author's "duplicate this section" instinct
   propagates good structure instead of a naked chart. Probably the highest-leverage single change
   available, and it is a template edit.
3. Add a **Route Creation page template** (only one `page_template` row exists today).

Both align with `CLAUDE.md`'s author-empowerment principle: move design capability into the
author's hands via templates and primitives rather than custom components.

## Environment gotcha — required to reproduce any of the map findings

Browser automation renders every MapLibre page in this project (route creation, macroview, a
report's Route Map section) as a **featureless dark rectangle** with 2–3 dim unlabeled controls. No
console errors; waiting does not help (tested to ~35s). `read_page` shows only `region "Map"` →
`tablist` → an *empty* `tabpanel`, so the plugin UI is genuinely absent from the accessibility tree.

Cause: the automation tab's WebGL canvas never becomes visible, rAF is throttled, MapLibre's `load`
never fires, so the plugin host never mounts `Comp`. Tell-tales: `read_page`'s viewport
(2476×1236) disagrees with the screenshot size (1568×783), and the map shows *fewer* controls than
the user sees — the layers-stack icon is the one that goes missing.

Fix: call `resize_window` after navigating. One resize (e.g. 1600×1000) + ~6s brings up the basemap
and the plugin panel; a **second** resize at a different size (e.g. 1750×1100) + ~16s brings in the
vector-tile data layers. Verified against Ryan's own screenshot of the same page.

## Corrections made during this session

- **Retracted: "the route creation tool has no chrome at all."** That was an artifact of the blank
  canvas above. `components/RouteEditor.jsx` renders a 318px panel with a TMC Click/Markers mode
  toggle, live count, Remove Last / Clear All, a validating TMC Search, a per-segment list with
  mileage and intersection, running Total Miles, and a contextual Save/Update button. `comp.jsx:239`
  renders it unconditionally, so its absence always means the map never initialized. Never
  characterize a map tool from an unresized screenshot.
- **Retracted: the "20 lexical vs 0" headline.** That compared PM3 against *old-architecture*
  output. See Finding 1 for the corrected numbers.
- **Route creation's remaining criticism reduces to visibility**, per Ryan: the sidebar's `Routes`
  and `Reports` items resolve to `/folders/routes` and `/folders/reports`, which have no backing
  page and fall through to the PM3 dashboard. To be fixed when the new tools launch — already noted
  as a minor aside in `cold-open-ux-findings.md`.
- The one substantive Part 1 capability gap is already in the docs, not new here:
  `route-creation-tool.md` records **`points` persistence as NOT DONE** — a marker-built route
  reloads as a flat TMC list. Create-rich / edit-poor, the same asymmetry as the report-side
  findings.

## Cross-references

- `cold-open-ux-findings.md` — the first-touch authoring axis (same day, different axis)
- `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` — the capability/parity axis
- `planning/transportny/tasks/current/route-creation-tool.md` — route arc orientation; `points` persistence gap
- `research/route-creation/findings.md` — full route-creation investigative trail
- `src/dms/planning/tasks/completed/map21-single-page-dms-build.md` — how PM3 was built, and the
  primitive ledger it shipped
- `src/dms/planning/tasks/current/page-templates.md` — the template system, incl. the
  lexical-placeholder convention the Report Page template does not use
- `src/dms/skills/creating-pages-from-a-design-pattern.md` §5.2.1 — the clear-title + framing-lexical
  recipe
