# MNY — avlGraph brand defaults (palette · axes · bar spacing)

**Project:** MitigateNY · **Topic:** themes · **Status:** NOT STARTED · **Created:** 2026-08-25

## Objective

Give the MitigateNY (`mny`) theme a real `avlGraph` block with brand `chartDefaults`, so every
AVL Graph section on a MitigateNY site renders on-brand with **no per-section configuration**:

1. **Colors in line with the theme** — series palette drawn from the MNY blue/amber palette
   instead of the library's generic blue↔red diverging default.
2. **Axes that read like the design system** — Proxima tick labels in `mny-400`, Oswald axis
   titles in `mny-700`, `mny-100` axis rules, faint gridlines. Both axes need work; today they
   inherit browser/`currentColor` defaults.
3. **Default spacing between bars** — a non-zero d3 band-scale inner padding so bar charts stop
   rendering as one solid touching block.

## Scope

**In scope**
- `src/themes/mny/theme.js` — add an `avlGraph` key (`options`/`styles` shape) carrying
  `chartDefaults`, plus a `dark` style for the dark hero bands.
- Optionally: a **Graphs** spec section in `src/themes/mny/design/design-system/components.html`
  so the chart vocabulary is documented where every other MNY primitive is (see
  [Design reference](#design-reference-where-the-numbers-come-from) — it currently only exists
  implicitly inside page mockups).

**Out of scope**
- Any change to `@availabs/dms` (`src/dms/`). Everything below is expressible in existing
  `chartDefaults` keys. The three genuine library gaps found while scoping are listed under
  [Library gaps](#library-gaps-not-in-scope---escalate-only-if-the-owner-wants-them) and would
  need their own task under `src/dms/planning/` if wanted.
- The legacy `graph` component theme (`theme.js:987`). It stays exactly as-is — see the
  **uppercase cascade** gotcha for why the new block must not just reuse it.
- Restyling individual live sections. Sections inherit; nothing gets edited per-section.

## Current state

**The `mny` theme has no `avlGraph` key at all.** Top-level keys in `src/themes/mny/theme.js`
run `layout, layoutGroup, richtext, pages, auth, pageOptions, logo, heading, button, levelClasses,
pageControls, navPadding, table, stackedBar, damaMap, dataBar, attribution, label, pill, dataCard,
tabs, filters, multiselect, input, graph, icon, scrollbar, lexical` — `graph` (line 987) is the
**legacy** flat theme for `ui/components/graph/`, not `graph_new`/avlGraph.

So every MNY AVL Graph today falls back to the library defaults in
`src/dms/packages/dms/src/ui/components/graph_new/theme.js` → `ChartDefaults`:

| Key | Library default MNY inherits today | Problem |
|---|---|---|
| `colors` | `["#2166ac","#67a9cf","#d1e5f0","#fddbc7","#ef8a62","#b2182b"]` | A blue→red **diverging** ramp used as a categorical palette. Off-brand, and the middle stops are near-invisible. |
| `margin` | `{top:20, right:20, bottom:50, left:100}` | `left:100` is enormous for MNY's small counts; wastes a quarter of a narrow card. |
| `xAxis`/`yAxis` fonts | `tickFontSize:"0.75rem"`, `tickFontFamily:"inherit"`, `tickFontWeight:"normal"`, `tickColor:"currentColor"` | Ticks inherit the wrapper font and ink color — no Proxima, no `mny-400`. |
| `xAxis`/`yAxis` `axisColor` | `"currentColor"` | Axis rule is full-strength ink instead of the `#E0EBF0` hairline the design system uses everywhere. |
| `paddingInner` | not set → `GraphComponent.jsx:176` `get(graphFormat,"paddingInner", 0.0)` | **0 = bars touch.** This is the bar-spacing complaint. |
| `barOpacity` | not set → avl-graph CSS `0.75` | Bars render washed out against MNY's light surfaces. |
| `legend` | `{show:true}` | On by default; MNY's dashboard mockups label rows directly and carry no legend. |

For comparison, both sibling brands already ship this block:
`src/themes/transportny/themev2.js:1878` and `src/themes/landbank/theme.js:1372`
(`avlGraphChartDefaults`). This task is MNY catching up, with MNY's own tokens.

## Design reference (where the numbers come from)

**The MNY design system has no dedicated Graphs/Charts spec page.** `design-system/components.html`
covers topnav, sidenav, buttons, forms, filter-bar, pills/tags, column-type pills, datacard,
linked-stat-chip, table, overlays, lexical — no charts. The chart vocabulary below is therefore
read off the page mockups that actually draw charts:

- **`pages/home.html:316-346`** — dark-band hero bar chart. Bars `bg-mny-y700` (`#EAAD43`) on the
  dark topo band, the highlighted bar white, category label Proxima 13px/600 `mny-200`, value
  Proxima 11px `mny-400`, `rounded-t-md`, `gap-6` between bars.
- **`pages/county-actions/dashboard.html:427-500`** — the slim horizontal-bar "mix" charts.
  Track `bg-mny-50`, fill `bg-mny-400` (hazards) / `bg-mny-700` (action types), de-emphasized
  rows `bg-mny-200`, 14px track height, counts Proxima 11px/700 `tabular-nums` outside the bar,
  category labels Proxima 12px/600 `mny-700`.
- **`pages/county-actions/state-dashboard.html:1540-1600`** — 100%-stacked county rows. This is
  the best evidence for **categorical series order**:
  `#37576B` → `#6D96AE` → `#EAAD43` → `#54B99B` → `#C5D7E0` → `#F3F8F9` (Not Reported).
- **`design-system/theme.html:13-25`** — the palette tokens themselves, and the stated rule at
  `theme.html:132`: *"Blue is the primary family; amber-yellow is the sole warm accent."*
- **`design-system/theme.html:217-236`** — the **Meta** type ladder (Oswald, uppercase) is what
  chart chrome/labels use; **Prose** (Proxima Nova / Source Sans 3) is what values and category
  labels use, always with `tabular-nums`.

Font stacks, from `src/themes/mny/design/theme/index.css.additions`:
- `font-display` → `"Oswald", "Bebas Neue", sans-serif`
- `font-proxima` → `"Source Sans 3", "Proxima Nova", system-ui, sans-serif`

## Proposed changes

Add the block below to `src/themes/mny/theme.js`, near the existing `graph` key (line 987), and
add `avlGraph` to the theme object. Values are chosen to match the design reference above.

```js
// ─────────────────────────────────────────────────────────────────────────────
// avlGraph — brand chart defaults for the AVL Graph section (graph_new).
// `chartDefaults` merges UNDER a section's own `display` (per-section author
// overrides always win) — see graph_new/index.jsx mergeChartDefaults.
// ─────────────────────────────────────────────────────────────────────────────

// CSS font stacks (NOT Tailwind classes — the axis renderers apply these inline
// via .style("font-family", …)). Mirrors design/theme/index.css.additions.
const MNY_F_DISPLAY = `"Oswald", "Bebas Neue", sans-serif`;
const MNY_F_PROSE   = `"Proxima Nova", "Source Sans 3", system-ui, sans-serif`;

// Categorical series palette. Blue is the primary family, amber the sole warm
// accent (design-system/theme.html), so a 2-series chart — by far the common
// case — lands on blue-700 + amber-700, the highest-contrast on-brand pair.
// Later stops follow the stacked-bar order used in state-dashboard.html.
const MNY_GRAPH_PALETTE = [
  "#37576B", // blue 700   — primary series
  "#EAAD43", // yellow 700 — the accent
  "#6D96AE", // blue 400
  "#54B99B", // green 700
  "#EA8954", // orange 400
  "#C5D7E0", // blue 200
  "#DD524C", // red 500
];

const mnyChartDefaults = {
  colors: { type: "palette", value: MNY_GRAPH_PALETTE },
  // left 64 (was the library's 100): fits MNY's count-sized numeric ticks and
  // horizontal-bar category labels without eating a quarter of a narrow card.
  margin: { top: 16, right: 20, bottom: 44, left: 64 },
  height: 300,

  // Line look — slightly bolder line, smooth curve. `area` stays opt-in so
  // non-trend graphs aren't forced into area mode.
  interpolation: "catmullrom",
  strokeWidth: 2,
  area: false,
  areaOpacity: 0.14,

  // Bars — solid fills (the 0.75 CSS default reads washed out on MNY's white
  // and mny-50 surfaces), and real spacing between bars. `paddingInner` is the
  // d3 band-scale inner padding: 0.3 reads like the design-system bar rows;
  // the library default is 0.0, i.e. bars touching.
  barOpacity: 1,
  paddingInner: 0.3,
  paddingOuter: 0.15,

  // Axis chrome. Ticks = Prose voice (Proxima, mny-400); axis titles = Meta
  // voice (Oswald, mny-700). axisColor is the mny-100 hairline used for every
  // border in the design system.
  xAxis: {
    show: true, showGridLines: false, rotateLabels: false, tickDensity: 2,
    gridLineOpacity: 0.12, axisColor: "#E0EBF0",
    tickFontFamily: MNY_F_PROSE, tickFontSize: "11px", tickFontWeight: "600", tickColor: "#6D96AE",
    labelFontFamily: MNY_F_DISPLAY, labelFontSize: "12px", labelFontWeight: "500", labelColor: "#37576B",
  },
  yAxis: {
    show: true, showGridLines: true, format: "Integer",
    gridLineOpacity: 0.12, axisColor: "#E0EBF0",
    tickFontFamily: MNY_F_PROSE, tickFontSize: "11px", tickFontWeight: "600", tickColor: "#6D96AE",
    labelFontFamily: MNY_F_DISPLAY, labelFontSize: "12px", labelFontWeight: "500", labelColor: "#37576B",
  },

  // MNY's dashboard mockups label rows/bars directly and carry no legend.
  // A section turns it back on with display.legend = {show:true, position:"right"}.
  legend: { show: false },
};

const mny_avlGraph = {
  options: { activeStyle: 0 },
  styles: [
    {
      name: "default",
      bgColor: "bg-white",
      textColor: "text-[#2D3E4C]",
      // Built-in breathing room so the plot doesn't sit flush against the section edge.
      padding: "p-4",
      chartDefaults: mnyChartDefaults,
      // ⚠ NOT the legacy `graph.text` — that one is `uppercase font-[Oswald]`, which
      // cascades into the SVG and would upper-case every category tick label
      // ("Community infrastructure" → "COMMUNITY INFRASTRUCTURE"). See gotcha #2.
      text: `font-['Proxima_Nova'] text-[12px] text-[#37576B]`,
      headerWrapper: "flex items-baseline justify-between gap-3 mb-2",
      title: "font-[Oswald] font-[500] text-[16px] text-[#2D3E4C] uppercase leading-[1] shrink-0",
      subtitle: "font-['Proxima_Nova'] text-[12px] text-[#6D96AE] leading-[140%] text-right",
      columnControlWrapper: "px-1 font-semibold border border-[#E0EBF0] bg-[#F3F8F9] text-[#37576B]",
      scaleWrapper: "flex rounded-[8px] divide-x border w-fit border-[#E0EBF0] overflow-hidden",
      scaleItem: "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-[#2D3E4C] text-center leading-[100%] uppercase cursor-pointer",
      scaleItemActive: "bg-white",
      scaleItemInActive: "bg-[#F3F8F9]",
    },
    {
      // For the dark topo bands (home.html hero). Bars go amber on dark, ticks
      // go mny-200, per pages/home.html:316-346.
      name: "dark",
      bgColor: "bg-transparent",
      textColor: "text-white",
      padding: "p-4",
      chartDefaults: {
        ...mnyChartDefaults,
        colors: { type: "palette", value: ["#EAAD43", "#FFFFFF", "#F1CA87", "#C5D7E0", "#6D96AE"] },
        xAxis: { ...mnyChartDefaults.xAxis, tickColor: "#C5D7E0", labelColor: "#C5D7E0", axisColor: "rgba(255,255,255,0.25)" },
        yAxis: { ...mnyChartDefaults.yAxis, tickColor: "#C5D7E0", labelColor: "#C5D7E0", axisColor: "rgba(255,255,255,0.25)" },
      },
      text: `font-['Proxima_Nova'] text-[12px] text-[#C5D7E0]`,
      headerWrapper: "flex items-baseline justify-between gap-3 mb-2",
      title: "font-[Oswald] font-[500] text-[16px] text-white uppercase leading-[1] shrink-0",
      subtitle: "font-['Proxima_Nova'] text-[12px] text-[#C5D7E0] leading-[140%] text-right",
    },
  ],
};
```

Then register it in the exported theme object (the `graph` key stays untouched):

```js
  graph: { /* unchanged — legacy ui/components/graph theme */ },
  avlGraph: mny_avlGraph,
```

## Files requiring changes

| File | Change |
|---|---|
| `src/themes/mny/theme.js` | Add `MNY_F_DISPLAY` / `MNY_F_PROSE` / `MNY_GRAPH_PALETTE` / `mnyChartDefaults` / `mny_avlGraph` near the existing `graph` key (line 987); add `avlGraph: mny_avlGraph` to the theme object. Leave `graph` alone. |
| `src/themes/mny/design/design-system/components.html` | *(optional, recommended)* Add a `data-dms="section" data-name="graphs"` spec block documenting the palette order, axis type ladder, and bar spacing, so the chart vocabulary lives with the rest of the primitives instead of only inside page mockups. Note this file has **uncommitted changes** (a new filter-bar section) — rebase on those, don't clobber them. |

## Gotchas found while scoping

1. **`mergeChartDefaults` is shallow, and `undefined` still wins.**
   `graph_new/index.jsx:21` does `{...defaults, ...display}`, then re-merges one level deep for
   `margin`/`xAxis`/`yAxis`/`legend`/`title`/`colors` only. Two consequences:
   - `paddingInner` / `paddingOuter` / `barOpacity` / `height` / `strokeWidth` are **top-level**,
     so a section whose `display` already carries `paddingInner: 0` keeps its 0 — the theme
     default won't reach it. Same for a key explicitly present as `undefined`.
   - So this task fixes *new and sparse* sections for free, but any existing section that already
     wrote these keys needs a per-section pass. **Pre-flight: enumerate live MNY AVL Graph
     sections and check which already carry `display.paddingInner`/`barOpacity`/`colors`.**

2. **`theme.text` cascades into the SVG — don't reuse the legacy `graph.text`.**
   The legacy MNY `graph.text` (theme.js:988) is
   `text-[#2D3E4C] font-[Oswald] font-semibold text-[12px] … uppercase`. The avlGraph wrapper
   applies `theme.text` to the outer div (`index.jsx:150`), and the axis renderers set inline
   `font-family`/`font-size`/`font-weight`/`fill` on ticks but **not `text-transform`** — so an
   `uppercase` wrapper class would upper-case every category tick label. Design mockups show
   category labels in sentence case. Hence the separate non-uppercase `text` above.

3. **Gridline color is hardcoded.** `AxisLeft.jsx:215/304/313/350/360` and the AxisBottom
   equivalents draw gridlines with `.attr("stroke","currentColor")` — only `gridLineOpacity` is
   themeable. Gridlines therefore follow the wrapper's `textColor` (`#2D3E4C` in the light style),
   not `axisColor`. `gridLineOpacity: 0.12` is the closest achievable approximation of the
   design system's `#E0EBF0` gridlines; a true `gridLineColor` token would be a library change.

4. **Only whitelisted axis keys pass through.** `GraphComponent.jsx:196-250` explicitly enumerates
   the axis props it forwards. `axisOpacity` exists in the axis renderers (default 1) but is
   **not** forwarded, so setting `xAxis.axisOpacity` in `chartDefaults` silently no-ops. Don't
   add keys that aren't in that whitelist.

5. **A section-level `padding` key overrides both paddings.**
   `avl-graph/utils/index.js:163` does `scale.paddingInner(padding || paddingInner)` — a section
   that sets the single `padding` key wins over the theme's `paddingInner`/`paddingOuter`.

6. **Legend position.** BarGraph only renders a legend at `position: "left" | "right"`;
   `{show:true}` with no position renders nothing. Since the default here is `{show:false}`,
   a section turning it on must also set a position.

7. **`groupMode` defaults to `stacked`.** Not changed by this task, but worth knowing when
   verifying a 2-series bar chart: side-by-side bars need `display.groupMode: "grouped"`, and
   that's the case where `paddingInner` spacing is most visible.

## Library gaps (not in scope — escalate only if the owner wants them)

Each would be a small additive change under `src/dms/planning/`:

- **`gridLineColor`** — see gotcha #3. Today gridlines can only be dimmed, not colored.
- **Bar corner radius** — every MNY mockup draws bars with `rounded-t-md` (vertical) or
  `rounded-full` (horizontal tracks). `BarGraph.jsx` has no `rx`/radius prop, so live bars are
  square. This is the single biggest remaining visual delta from the mockups.
- **`labelTextTransform`** (or an `uppercase` axis-label token) — the Meta type ladder is
  uppercase Oswald, but there's no way to set `text-transform` on an axis title from the theme;
  the author has to type the label in caps.

## Testing checklist

- [ ] `npm run dev` — a page with an AVL Graph renders with no console errors.
- [ ] **Bar spacing:** a BarGraph shows a visible gap between bars with **no section config**
      (the headline ask). Check both `orientation: "vertical"` and `"horizontal"`.
- [ ] **Grouped bars:** `groupMode: "grouped"` with 2 series — bars are side-by-side, groups are
      separated, and the two series read as blue-700 / amber-700.
- [ ] **Palette:** a categorize-mode graph with ≥5 categories walks the MNY palette in order and
      no two adjacent series are near-indistinguishable.
- [ ] **Axes:** tick labels render in Proxima 11px `#6D96AE`; axis titles in Oswald `#37576B`;
      the axis rule is the `#E0EBF0` hairline, not full-strength ink.
- [ ] **Tick labels are NOT upper-cased** (gotcha #2) — verify with a long sentence-case category
      like "Community infrastructure".
- [ ] **Gridlines** are faint, not black.
- [ ] **LineGraph** unaffected in a bad way: 2px stroke, smooth curve, no forced area fill.
- [ ] **Dark style:** switch a graph section to the `dark` avlGraph style inside a dark topo band
      — amber bars, `#C5D7E0` ticks, transparent background, nothing black-on-black.
- [ ] **Margins:** `left: 64` still fits the longest y-tick and horizontal-bar category label on
      a real MNY chart; no clipping.
- [ ] **No regression on existing sections:** for each live MNY AVL Graph found in the pre-flight
      (gotcha #1), screenshot before/after and confirm the change is an improvement, not a
      surprise — sections carrying their own `colors`/`paddingInner` are expected to be unchanged.
- [ ] Legend off by default; a section that sets `{show:true, position:"right"}` still gets one.

## References

- Skill: [`src/dms/skills/authoring-graphs.md`](../../../../src/dms/skills/authoring-graphs.md) —
  the theme-vs-settings split, the BarGraph pattern section, and the axis-typography keys.
- Skill: [`src/dms/skills/translating-design-system-to-dms-theme.md`](../../../../src/dms/skills/translating-design-system-to-dms-theme.md).
- Library source of truth: `src/dms/packages/dms/src/ui/components/graph_new/theme.js`
  (`ChartDefaults`), `graph_new/index.jsx` (`mergeChartDefaults`), `graph_new/GraphComponent.jsx`
  (the axis-key whitelist), `graph_new/components/avl-graph/components/Axis{Left,Bottom}.jsx`.
- Sibling implementations to copy the shape from: `src/themes/transportny/themev2.js:1878`,
  `src/themes/landbank/theme.js:1372`.
