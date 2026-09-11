# Report graph-card header + the double-title problem

**Project:** TransportNY · **Topic:** themes / report pages · **Status:** **BUILT + live-verified
2026-09-11 on `reports/snapshot`.** All four decisions answered by Ryan the same day. One report
regenerated and awaiting his review; the other 11 catalog templates and the converter are next.
· **Started:** 2026-09-11

▶ **START HERE**

**Verify URL:** `http://www.localhost:5173/npmrds/reports/snapshot?routes=2207390&asOf=2026-08-20`
(note the `/npmrds` prefix — the probe takes a bare slug, the browser does not).
**Expect:** every graph card has ONE title, in a 40px bordered band at the top of the card —
15px/500 Oswald `#0F1722`, sentence case — with a quiet mono meta line at the right
(`mph · all day, every day`, `hours · Weekdays only`, `mph · AM Peak`) and no title inside the
chart. Route Map / Route Compare / Info Box get the band but no meta line. 0 console errors.
**Control:** `reports/annual_average_study` (NOT regenerated) must still show the OLD look — the
50px black-Oswald band plus an in-card "Speed (mph)". Both states live at once is correct, and
that pair is the standing control for any future change to the band.

### Ryan's decisions, 2026-09-11

1. **Placement** — header band inside the card, TSMO-style. ✅ built
2. **Reach** — NPMRDS reports only; Macro View / MAP-21 / TSMO untouched. ✅ verified live
3. **Backfill** — none. Regenerate ONE curated report (`snapshot`), he verifies, then the 12
   templates. The change must live in the write paths (`report_build.mjs` + the converter), not be
   a one-off patch. ✅ `report_build.mjs` done; **converter NOT done**
4. **Amber kicker** — band heads only, not per card. Band heads turn out to be a curated-only
   device with no equivalent for an auto-generated report, so **nothing amber ships here**; the
   card's meta line is slate mono. Band heads stay a plain Lexical section an author adds — zero
   new mechanism, out of scope for this file.

### What shipped

| where | change |
|---|---|
| `section_components.jsx` (submodule) | `ViewSectionHeader` gained header-band tokens (`headerRow`/`headerInner`/`headerTitleWrap`/`headerTitle`/`headerKicker`/`headerActions`/`headerExtensionsInline`+`…InlineRow`), each defaulting byte-for-byte to the literal it hardcoded before. Renders the section's `description` as the kicker when a theme opts in. |
| `section.theme.jsx` (submodule) | the same keys declared with their historical values + a "Section Header" group in the admin theme editor. |
| `section.jsx` (submodule) | `pages.section` is now style-selectable per section via `value.activeStyle` (was site-wide); passes the resolved style + header extensions into the band; new `updateAttributes` multi-key writer on all four extension-context action bags. |
| `themev2.js` | new `pages.section` style `reportCard` — the 40px band, sentence-case 15px title, `hidden xl:block` mono kicker, inline extensions. |
| `vocabulary.json` | `titlePhrase` on all 11 measures ("average speed", "total hours of delay", "AADT") — stored mid-sentence so a prefix composes and one capitalisation handles acronyms. |
| `composeMeasureConfig.js` | `composeAutoTitle` rewritten (measure + grouping + window, sentence case, "Difference in …"); new `composeAutoKicker` (unit + window), `composeSectionTitlePatch`, `isKickerDirty`. |
| `MeasurePicker/index.js` | stopped writing `display.title`; `applyMeasurePick` now RETURNS the section patch. |
| `composeMapConfig.js` | same for Map, via `composeMapSectionTitlePatch`. |
| `QuickControls/index.jsx`, `npmrdsMeasureMenu` | merge the patch into ONE section write. |
| `useAddGraphSection.js`, `report_build.mjs`, `reportSectionDefaults.js` | stamp `activeStyle: 'reportCard'` + the composed title/kicker; clear `display.title` centrally for every graph type. |

**Tests — 53 green.** 15 golden BC tests locking `ViewSectionHeader`'s pre-token HTML (captured
from the unmodified code; regenerate ONLY via
`packages/dms/tests/fixtures/capture-viewSectionHeaderLegacy.mjs`, which is a deliberate act —
154,632 MitigateNY sections render through that component), 9 token-behaviour tests, 16 composer
wording tests.

**Regression evidence, not assertion.** `probe_corpus.mjs` reports the same blockers with this
work `git stash`ed as without it (all of the form "was blank → has content", i.e. data that has
landed since the goldens were captured) — checked, not assumed. MAP-21 renders 0 titled sections
and 0 `reportCard` bands; `tsmo/congestion_v2` the same; `annual_average_study` still renders
`flex w-full min-h-[50px] items-center pb-2` verbatim. 0 console/page/SQL errors everywhere.

### Two bugs found and fixed while building

1. **The kicker composed before the route windows existed.** `applyMeasurePick` runs long before
   `report_build.mjs` resolves route assignment, so every card claimed `all day, every day` —
   including snapshot's two AM/PM-peak summaries. Fixed by recomposing the patch inside the
   route-resolution pass. Caught on the first regenerated report.
2. **`headerExtensions.length` is not a render signal.** The first version hid the kicker whenever
   extensions were present; an extension builder returns a node whose component may render `null`
   (Quick Controls do exactly that outside page-edit mode), so the meta line vanished on every card
   in view mode — the one mode it exists for. Both now share the slot and the kicker yields by
   breakpoint instead. Locked by a regression test.

### Round 2, same day — legends, sentence case, honest windows

Ryan's follow-ups after seeing the regenerated snapshot, all built:

1. **Duplicate unit label** (legend caption "MPH" + kicker "mph · …") — *"i think tis fine"*. Left.
2. **Sentence case** — *"yes, use sentence case. or whatever the designs ask for."* All **115**
   graph titles across the 12 specs rewritten
   (`/home/ryan/.claude/jobs/.../sentence_case.py`, acronym/month/`%n`-token allowlist; seasons
   lowercased, which is correct English). Verified the specs are otherwise byte-identical: the
   whole diff is title case plus JSON re-indentation, checked structurally rather than eyeballed.
3. **All legends top-right** — *"i think all legends should go top right"*, scoped to NPMRDS report
   graphs (*"i meant, for JUST npmrds reports graphds"*). That scoping is inherent: the default
   lives in `DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE`, reached only by the three NPMRDS-report mint
   paths (`useAddGraphSection.js`, `report_build.mjs`, `compose_bridge.mjs`).
4. **Multi-window kicker** — *"it should either drop the window part, or show something like
   'multiple windows', otherwise it is misleading"*. Built, then corrected — see below.

#### ⚠ This needed a DMS graph-code change, and it is not cherry-pickable

`top-right` on a Bar/Line/Pie/Treemap/Sunburst chart **rendered nothing at all** before this.
Five of the six wrappers matched `legend.position` with strict equality against the four bare edges
(`legend.position !== "top"`), so a corner value hit no branch and the legend silently disappeared —
no fallback, no warning. Only GridGraph understood corners, and the author-facing option list
happened to offer them only for GridGraph, which hid the gap instead of closing it.

Fixed with three shared helpers in `graph_new/components/utils.js` (`isTopLegend` /
`isBottomLegend` / `isColumnLegendPosition` / `legendRowJustify`), used by all five wrappers.
A bare `top`/`bottom` still resolves to `justify-center` — the literal every wrapper hardcoded — so
no existing legend anywhere moves; locked by `tests/legendPosition.test.js`. The two split
"Legend Position" option lists (`legend` / `legendForGridGraph` in `graph_new/config.jsx`, and
`LEGEND_POSITION_OPTIONS(_GRID)`) are now one list of all eight positions for every graph type,
since the split only ever encoded the bug.

**Ryan is aware this moves with the deploy** (*"itll break the live deploy once we regenerate the
dynamic reports. not a huge deal just need to be aware"*) — the `top-right` default depends on
these helpers, so a regenerated report on a build without them loses its legends entirely.

#### The window caption, corrected twice

First version read only the first assigned route's first window — so the AM/PM/Off-Peak summaries
announced themselves as "AM Peak". Replaced with "collect every window, name it only if they agree,
else `multiple time windows`". Ryan then caught THAT on the line graph: *"it says 'multiple
windows', but thats wrong"*, and *"it should only show that when the series dont have the same time
or dow window. not dates"*.

The code never looked at dates. What it found was real — snapshot's `line_speed` overlays
`current_year` (`{}`, all days) against `trailing_3yr` (`{weekdays: {saturday:false, sunday:false}}`),
a deliberate spec asymmetry documented in that graph's own `why` (*"Trailing 3 Years keeps its
weekend exclusion via routeWindows"*). The caption was accurate; it was too coarse to say so.

**Final shape:** time-of-day and day-of-week are reported as INDEPENDENT axes. `multiple time
windows` only when the times disagree, `mixed days` only when the days do, both when both, and a
shared restriction is still named alongside a disagreement on the other axis ("AM Peak, mixed
days"). Dates are deliberately never mentioned — two series over different years is the normal case
for a comparison chart. Live result on snapshot: the line graph reads `mph · mixed days`, the peak
summaries `mph · multiple time windows`. Ryan: *"ohhh ok, got it. just the time needs to be
aligned."*

### Open / next

- **The converter** (`convert_old_reports_lib/`) does NOT stamp `activeStyle`/title/kicker/legend
  position yet, so a newly converted old report still gets the old look. Decision 3 asked for this.
- **The `line_speed` spec asymmetry is still there** — comparing a full-week Current Year against a
  weekday-only Trailing 3 Years is arguably not like-for-like. The caption now surfaces it
  (`mixed days`) instead of hiding it. Ryan's call whether the spec should change; not touched.
- Plot padding (`px-4 pt-4`) and moving the legend below the plot are contract clauses 4 and 2,
  owned by the sibling `graph-card-padding-and-legend-theming.md`. Deliberately not touched here.

Everything below is the original grounding, kept so a future session doesn't re-derive it.

Design artifact (the visual side of this): see "Design artifact" near the bottom.

## Where this came from

Ryan, 2026-09-11, pointing at `http://www.localhost:5173/tsmo/congestion_v2`:

- the TSMO graph cards look markedly better than the NPMRDS report cards — borrow/copy the
  treatment, "via themes, or however"
- some Dynamic Reports put the section title *inside* the card, some *outside* — why?
- report graphs show a **double title**: a descriptive one on top ("Daily Average Speed By Month")
  and a units-y one inside ("Speed (mph)"). Drop the bottom one?
- keep the auto-title feature, but point it at the **top** title, with richer wording
- give that top title real styling — maybe the `// TEXT` amber kicker used elsewhere in TransportNY

**This is the explicit revisit of a deferred decision.** `npmrds-reports-routes-feedback-triage.md`
line 506 (2026-09-04): *"decided: smaller lift for now. Keep titles graph-native (not migrating to
section titles)"*, and line 562 files the broad migration as *"Backlog, not scheduled … revisit only
if he asks for it."* He is asking. The new direction is the reverse of the 09-04 call — flagged, not
silently reversed.

## The four findings

### 1. The TSMO look is 100% authoring, not code. Zero new mechanism.

`congestion_v2`'s "top graph" is not one section — it is a **three-section compound card**
(page 2175676, published sections 2198106/2198107/2198108):

| # | id | type | `border` | `radius` | `bg` | `padding` |
|---|---|---|---|---|---|---|
| header | 2198106 | `lexical` | all 4 sides | `{tl,tr}` | `tint` (`bg-slate-50/60`) | `{bottom:"0"}` |
| plot | 2198107 | `AVL Graph` | `{left,right}` | — | `white` | `{top:"0",bottom:"0"}` |
| footer | 2198108 | `lexical` | `{left,right,bottom}` | `{bl,br}` | `white` | `{top:"0"}` |

Shared edges are zeroed, so the three render as one 8px-rounded card with a tinted header band.

**All three sections have `title: ''`.** The section-title attribute is not used anywhere on that
page. The header is Lexical content: a `layout-container` with
`templateColumns: "items-center grid-cols-[auto_1fr]"` holding two `styled-paragraph`s —

- left: `styleKey: "cardTitleSM"` → `font-display font-medium text-[15px] leading-[1.15]
  tracking-tight uppercase text-[#0F1722]` → **"Delay composition by year"**
- right (format `right`): `styleKey: "kicker"` → `font-mono! text-[11px]! uppercase
  tracking-[0.2em] text-[#CA8A04]!` → **"// 02   excessive delay by year · attribution buckets ·
  M veh-hrs"**

The graph section's own `display.title.title` is `""` and `display.legend.show` is `false` — the
legend chips in the footer are hand-authored Lexical too. So TSMO uses **neither** of the two title
mechanisms the report pages use.

Design source: `TransportNY Design System/dms_design_system_v2/pages/tsmo-congestion.html:156-205`
(the `h-11 px-3 … border-b … bg-slate-50/60` header strip, the `// 02` amber kicker, the legend chip
row, the footnote line).

### 2. Inside-vs-outside is the section's `border` field and the report's build date — not the spec.

Ryan's guess was a spec-JSON difference. It isn't; `snapshot.json` and `annual_average_study.json`
are structurally the same and neither has a chrome field.

`report_build.mjs:1600-1604` started stamping `border: DEFAULT_GRAPH_SECTION_BORDER` (`'full'`,
`reportSectionDefaults.js`) on **2026-09-04**, with the comment *"Future-default only, not
retroactive — existing reports keep their current chrome until an author (or a future --update run)
touches them."*

- `reports/annual_average_study` (page 2216519, rebuilt after) — every graph section has
  `border: "full"` → theme preset `rounded-[8px] border border-zinc-950/10 bg-white shadow-sm`
  → DOM-measured chrome box at `[108, 398, 1448, 660]` enclosing both title and plot. **Inside.**
- `reports/snapshot` (page 2216599, built before) — `border: null` on all 13 graph sections →
  `sectionChrome()` returns `''` → the section wrapper paints nothing. The only white box is
  `GraphComponent`'s own outer div (`w-full h-fit bg-white … p-4`, measured `[108, 1138, 1448, 408]`)
  which begins *below* the title row. **Outside.**

The title never moves. It is always the first child of the section wrapper (`section.jsx:568-576` →
`ViewSectionHeader`). What changes is whether a card is drawn around the section at all.

**Census** (51 report pages under `reports/`, 383 graph/map/spreadsheet sections):

| | count |
|---|---|
| sections with a `border` (title inside a card) | **106** |
| sections with no `border` (title floating on the page gray) | **277** |

### 3. The double title is two independent mechanisms, and 315 of 383 sections have both.

- **Top** = the section row's `title` attribute (`page.format.js:29`, plain text). Written by
  `report_build.mjs:1597` from the spec's hand-written `g.title`. The UI "+ Add Graph" path
  (`useAddGraphSection.js:101-113`) sets **no title at all**.
- **Bottom** = `display.title.title` inside element-data, rendered by `GraphComponent.jsx`'s
  `GraphTitle` with the `avlGraph` style's `title` token. Written **automatically** by
  `applyMeasurePickToState` (`MeasurePicker/index.js:227-230`) as
  `composeAutoTitle(pick)` = the measure's `vocabulary.json` label (+ a time-window fragment),
  guarded by `isTitleDirty` so a hand-typed value is never overwritten.

| | count |
|---|---|
| both titles set | **315** |
| section title only | 61 |
| graph title only | 6 |
| neither | 1 |

Worked example — `reports/snapshot`:

| section | section `title` | `display.title.title` |
|---|---|---|
| 2224013 | `Daily Average Speed By Month` | `Speed (mph)` |
| 2224011 | `Average Speed` | `Speed (mph)` |
| 2224012 | `Avg. Hours of Delay` | `Avg. Hours of Delay` ← literally the same string, twice |

**`report_build.mjs:1175-1183` carries a stale comment** claiming it deliberately does not write an
in-card title, *"Writing it into state.display.title too used to double it (once above the card, once
inside it) — see report-route-ui-parity-gaps.md."* It is true that `report_build.mjs` itself never
assigns `state.display.title` — but it calls `applyMeasurePickToState` first, and **that** writes it
unconditionally. Nothing clears it. The doubling the comment says was fixed is live on every
spec-built report. Fix the comment as part of whatever lands here.

Asymmetry worth knowing: `Spreadsheet`-backed sections (Info Box, Route Compare) **store**
`display.title` but have no render path for it, so they already show one title. `Map` likewise.
Only `AVL Graph` doubles.

### 4. The section title has no theme tokens at all. It cannot be styled from a theme today.

`section_components.jsx:19-28` hardcodes the whole header band:

```jsx
<div className="flex w-full min-h-[50px] items-center pb-2">
  <div className="flex-1 flex flex-row pb-2 font-display font-medium uppercase scroll-mt-36 items-center">
    <div className="flex-1">
      <TitleComp className={`w-full ${theme.heading?.[value?.level] || theme.heading?.default}`} … />
```

- `pages.section`'s token list (`section.theme.jsx`) is `wrapper / wrapperHidden / topBar /
  topBarSpacer / topBarButtonsEdit|View / menuPosition / editIcon / contentWrapper /
  headerExtensionsRow / editMinHeight / heights`. **No `header`, `headerRow`, `title`, `kicker`,
  `subtitle`.**
- `theme.heading` is a *root* key. transportny's `themev2.js` doesn't define one, so the core
  default applies — and report sections carry no `level`, so it resolves to `heading.default` =
  `""` (`defaultTheme.js:62-67`).
- DOM-measured on `reports/snapshot`: the title renders `16px` Oswald, `rgb(0, 0, 0)`, in a 50px
  band with 8+8px of padding below it. Pure black, no size token, no tracking, no color — exactly
  the "VERY plain looking, and VERY padded out" complaint. (The warm cast in Ryan's screenshot is
  subpixel antialiasing; the computed colour is `text-slate-700` for the *inner* title and plain
  black for the outer one.)
- The section row also already registers an unused **`description`** attribute (`page.format.js:59`)
  that nothing renders — a free subtitle/kicker carrier, no schema change needed.

**Blast radius of touching `ViewSectionHeader`:** `dms_mitigat_ny_prod` has **154,632** component
rows with a non-empty `title`, vs 5,007 in `dms_npmrdsv5`. Any token added there must default to the
current literal byte-for-byte (same discipline as the `Legend.jsx` `classNames` layer).

## What the design system already says

`dms_design_system_v2/pages/npmrds-report.html:38-45` — **graph-card contract clause 1**, written
before this conversation:

> Header h-10, one line: title · measure chip · quick-control pills right · kebab last.
> **No separate section title above the card — the header IS the title**
> (`feedback_deprecate_section_title`). The title token is **cardTitleSM (15px/500)** rendered
> sentence-case.

and it draws it (`:677-700`):

```html
<div class="rounded-[8px] border border-zinc-950/10 bg-white shadow-sm overflow-hidden">
  <div class="h-10 px-4 flex items-center gap-2 border-b border-zinc-950/08">
    <span class="font-display font-medium text-[15px] text-[#0f1722] truncate flex-1 min-w-[112px]">Travel time by hour of day</span>
    <div class="shrink-0 flex items-center justify-end gap-1.5" data-qc="g1"></div>   <!-- QuickControls -->
    <button class="size-6 …"><!-- kebab --></button>
  </div>
  <div class="w-full h-fit px-4 pt-4"> … plot … </div>
  <div class="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5"> … legend chips … </div>
  <div class="px-4 py-1.5 border-t border-zinc-950/05 font-mono text-[9.5px] uppercase tracking-[0.18em] text-slate-400 truncate"> … attribution … </div>
</div>
```

The amber `// TEXT` treatment Ryan remembers is drawn there too, but at **band** scale, not per-card
(`:662-674`): a "fused lexical head" with `// 01` + a mono meta line + an `h2` question ("Did travel
time change?"), naming a GROUP of graphs. So the design's answer is *both, at two different scales* —
band heads outside, card titles in a header band inside.

Note `feedback_deprecate_section_title` is referenced but no such memory/doc exists in the repo; the
clause text is the only record of that call.

## Recommendation (for Ryan to accept / redirect)

1. **Drop the graph-native title on report pages.** Stop *writing* `display.title` from the measure
   picker when `isReportPage`; clear it on existing report sections in a migration. Do **not** remove
   `GraphTitle` — it still renders for Macro View, MAP-21, and any hand-authored graph elsewhere.
2. **The surviving title lives in a header band at the top of the card**, per design clause 1 — not
   floating outside on the page gray. "Outside" today is the *absence* of card chrome on 277
   sections, not a designed state, and a title on the page background loses its association with the
   plot as soon as two graphs sit side by side.
3. **Make the section header themeable** — add `header` / `headerRow` / `title` / `kicker` tokens to
   `pages.section`, each defaulting to today's literal string, then set transportny's to the design's
   `h-10 px-4 … border-b` + `cardTitleSM` + `kickerSM`. Submodule change; BC by construction.
4. **Re-point the auto-title at the section title** and make it more descriptive. `composeAutoTitle`
   already has measure + resolution + comparison mode + window in the pick; today it emits only the
   measure label. Callers that can write a section title already have `actions.updateAttribute`
   (`QuickControls/index.jsx:217-218` already uses that exact channel for `element`).
   `isTitleDirty`'s pristine check protects every hand-written spec title by construction.
5. **Use the `description` attribute as the header's right-hand kicker line** (the TSMO
   `// 02 · … · M veh-hrs` slot) rather than adding a field.
6. **Backfill** the 277 chrome-less sections and strip the 315 duplicate graph titles with a
   migration script, so old and new reports stop looking like two different products.

## Decisions — ANSWERED 2026-09-11, see the START HERE block

## Open questions (new, raised by building it)

All three answered and built the same day — see "Round 2" above. Kept as a record:

1. ~~The unit appears twice on a gradient-legend card~~ — Ryan: fine as-is. Left alone.
2. ~~Curated titles stay Title Case~~ — all 115 spec titles sentence-cased.
3. ~~A multi-window graph's kicker names only the first window~~ — rebuilt twice; now reports the
   time-of-day and day-of-week axes independently.

Still open: whether the composer should name the cards outright instead of the specs' own titles.
The design system's own drawn examples ("Travel time by hour of day") are the composer's shape, not
the specs' structural names ("Route line graph, speed"). Deleting `title` from a spec already falls
through to the composer, so this is a one-line change per graph if wanted.

## Original decisions asked (all answered above)

1. Title placement — card header band (recommended, matches design clause 1 + TSMO), floating
   outside, or both scales (band heads outside + card titles inside)?
2. Retire the graph-native title on report pages only (recommended), or site-wide?
3. Backfill the 277 border-less + 315 double-titled existing report sections now, or leave them and
   only fix forward?
4. Does the amber `// NN` kicker belong on every graph card, or only on band heads?

## Design artifact

**https://claude.ai/code/artifact/946812be-d6cc-4067-9c22-d44950c788d1** ("Report Graph Card
Titles", published 2026-09-11) — the visual entry point and the right thing to send anyone. Renders
all four states as live HTML using the product's own class strings (today-without-card,
today-with-card, TSMO `congestion_v2`, and the proposed header band), then a glossary, the
why-they-differ explanation, the real snapshot double-title rows, six See→Why→After change items,
and the four decisions with recommendations. Built in the TransportNY design language so the
specimens are accurate rather than approximated.

## Cross-references

- **`src/dms/planning/tasks/current/section-header-tokens-and-legend-corners.md`** — the submodule
  half: the header-band token contract, the per-section `pages.section` selector, the legend corner
  helpers, and the full back-compat argument for both. Read that before touching
  `ViewSectionHeader` or any graph wrapper's legend placement.
- `planning/transportny/tasks/current/npmrds-reports-routes-feedback-triage.md` — Phase 3 decision
  log line 506 (the 09-04 "keep titles graph-native" call) and Phase 5 line 562 (this backlog item).
- `planning/transportny/tasks/current/graph-card-padding-and-legend-theming.md` — the sibling Phase 5
  file; its `display.padding` work and this file's header band both land inside the same card.
- `src/dms/planning/tasks/current/avlgraph-legend-and-padding-theming.md` — the submodule half of the
  legend/padding work; any `pages.section` token work here belongs in a submodule task file too.
- `src/dms/skills/authoring-graphs.md` — the "header + hero-stat card above a chart" pattern, which
  is the compound-card recipe TSMO uses.
