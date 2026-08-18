// macroview — THE CHOROPLETH BREAK TABLE, as data.
//
// Until 2026-08-18 the ramp was recomputed on every render by the UDA `colorDomain`
// route with `method: "ckmeans"`, keyed on the selected view. Two measured consequences
// (full evidence: planning/transportny/research/macroview-legend-breaks-analysis.md):
//
//   1. ONE COLOUR HELD MOST OF THE NETWORK. ckmeans minimises within-class variance, so
//      on a long right tail the cheapest split is to isolate the outliers. Across the 57
//      columns a viewer can land on, the biggest single bin averaged **66.1 %** of the
//      coloured network (max 89.1 % on `phed_truck_freeflow_pmp_all_xdelay_vhrs`), and
//      **128 of 399 bins (32 %) held under 1 %** of it — invisible ink. LOTTR's own bins
//      straddled the federal 1.50 test with a [1.45, 1.78) class holding 64.3 % of every
//      failing segment in the state, so the map could not be read for pass/fail at all.
//   2. THE LEGEND RE-LABELLED ON EVERY YEAR CHANGE. `colorDomain` is per view, so the
//      same red meant LOTTR ≥ 2.90 in 2023 and ≥ 6.75 in 2025; TED's top edge ran
//      2.08 M → 4.88 M → 6.75 M → 6.17 M → 2.86 M across 2021-2025 (a spread of 163 % of
//      the 2025 value). Year-over-year comparison on the map was impossible.
//
// So the breaks are now AUTHORED DATA: fixed numbers, chosen against the whole
// distribution of all 57 columns on all five year views, anchored to policy where policy
// exists (LOTTR 1.50, TTTR 2.00) and to round decades where it does not (PHED/TED) or to
// the unit itself (speed, 10 mph). With these sets the biggest bin averages **24.9 %**
// (max 33.8 %, holding on every year).
//
// NO IMPORTS ON PURPOSE, same rule as measures.js: this file is read by the plugin AND by
// plain node verification scripts (scratchpad/npmrdsv5-dev2/legend_breaks_impl/), so the
// numbers a probe scores are literally the numbers the map paints.
//
// ── THE SHAPE THE CODE EXPECTS ───────────────────────────────────────────────────
// `colorDomain` returns 7 numbers for 7 bins where **[0] is the domain floor, not an
// edge** — `choroplethPaint` turns them into
//     ['step', value, colors[0], b0, colors[0], b1, colors[1], … b6, colors[6]]
// and `stats.js`'s `binCaseExpr` slices [0] off to get the 6 interior edges. An authored
// set must therefore be supplied in the SAME shape: `breaks = [floor, e1 … e6]`. That is
// what `resolveBreakSet()` returns; the table below authors the 6 edges plus the floor
// separately so the edges can be read against the analysis document line for line.
//
// ── WHY THE TOP BIN IS OPEN-ENDED ────────────────────────────────────────────────
// A fixed set has no business claiming a maximum: the observed max is per year and per
// column (LOTTR 8.78 on 2025, lower on 2021), and quoting it in the legend would put a
// moving number back on a scale whose whole point is that it does not move. So authored
// sets carry NO max — `drawn.max` stays null, the panel's last bin gets `to: null`, and
// the tick row simply has no label at the right-hand end: the last colour means
// "≥ the last edge". The worst-N panel and its point overlay are the tool for "who is
// worst"; a colour holding 5 segments never was.
//
// ── WHY ONE SET PER MEASURE IS IMPOSSIBLE FOR PHED/TED ───────────────────────────
// The `Unit` control is not cosmetic — it multiplies the magnitude. Same segments, view
// 3425, median value: person-hours 1,878 · vehicle-hours 964 · delay-hours 6.8, and
// trucks shift each again (530 / 61 / 7.8). Three orders of magnitude between the
// extremes, so a single set would collapse two of the three units into one colour. Peak
// and threshold variants, by contrast, move the median by at most ~2.8× inside a family,
// which a log set absorbs. Hence the authoring grain is the **(traffic type × unit)
// family**: 6 sets covering PHED's 28 columns, 6 more covering TED's 12.
//
// ── FALLBACK ─────────────────────────────────────────────────────────────────────
// `resolveBreakSet()` returns null for anything it does not recognise — a new traffic
// type (`singl`/`combi` are commented out in updateFilters today), a new unit, a measure
// family the data does not compute yet — and comp.jsx then falls back to the old
// per-view ckmeans query. A column that is not in this table renders a defensible ramp
// rather than a blank map.

// Seven bins, and the number lives in one place: the ramp (`getColorRange(7, …)` in
// updateFilters), the authored sets below (6 edges + floor) and `numbins` on the paint
// call all have to agree or the last colours go unused.
export const NUM_BINS = 7;

// How the legend block captions itself. `author-set breaks` was already the note the
// panel drew (the design's honest "there is no viewer edit affordance here" statement);
// it is TRUE for the first time now that the breaks really are authored.
export const BREAKS_CAPTION = {
  manual: { bins: "fixed bins", note: "author-set breaks" },
  ckmeans: { bins: "ckmeans bins", note: "computed per view" },
};

// ── THE TABLE ────────────────────────────────────────────────────────────────────
// `edges`  — the 6 interior breaks, exactly as the analysis recommends them.
// `floor`  — breaks[0]: the bottom of the ramp's domain, not an edge. LOTTR/TTTR are
//            ratios floored at 1.00 by construction; PHED/TED and speed are floored at 0
//            (PHED/TED have no exact zeros — the smallest non-null value measured is
//            0.005 — and speed's data floor is ~3 mph, so 0 is a safe, quotable domain
//            bottom in both cases).
// `format` — the d3-format the legend ticks, the stats and the worst-N values are drawn
//            with. It belongs WITH the break set, not with the measure: the delay
//            families' `,.2~s` SI format is right for decade edges (100000 → "100k") and
//            wrong for the delay-hours family, where 0.1 formats as "100m" (100 milli).
// `label`  — the method, drawn as the legend block's right-hand note.
const SETS = {
  // ── LOTTR · 1.50 IS A COLOUR BOUNDARY ─────────────────────────────────────────
  // The plugin paints LOTTR with getColorRange(7, "RdYlBu").reverse() =
  //   #4575b4 #91bfdb #e0f3f8 #ffffbf #fee090 #fc8d59 #d73027
  // whose cool→warm hue flip is exactly the bin-4/bin-5 boundary. 1.50 — the federal
  // LOTTR reliability test, and the same `>= 1.5` the PM3 view's own SQL uses — is edge
  // index 3, i.e. that boundary. So "warm = fails the federal test" is true by
  // construction, with #ffffbf reading as "approaching the threshold" (1.30–1.50).
  // The four sub-threshold bins divide the 81.6 % of the network below 1.50 evenly:
  // 2025 AM shares 15.0 / 24.6 / 20.0 / 21.9 / 10.9 / 5.0 / 2.5, worst bin 24.6 %
  // (was 44.3 %), and across 4 peaks × 5 years worst bin 24.6–32.6 % with not one bin
  // under 1 %.
  lottr: { edges: [1.1, 1.2, 1.3, 1.5, 1.75, 2.1], floor: 1, format: ",.2f", label: "policy-anchored" },

  // ── TTTR · 2.00 IS A COLOUR BOUNDARY ──────────────────────────────────────────
  // 2.00 is NYSDOT's applicable TTTR target, verified against
  // gis_datasets.s2027_v3460_fhwa_map_21_targets.tttr_interstate_applicable_target = 2
  // for every year 2023-2030 (the table the live PM3 cards bind to). TTTR is painted
  // with RdYlGn reversed, so putting 2.00 at edge index 3 again lands it on the hue flip
  // (#ffffbf → #fee08b): warm = worse than the statewide target. 2025 AM shares
  // 9.7 / 16.3 / 15.0 / 14.4 / 23.0 / 15.6 / 6.1; across 5 peaks × 5 years worst bin
  // 20.3–25.9 %, zero bins under 1 % anywhere.
  tttr: { edges: [1.25, 1.5, 1.75, 2, 2.5, 3.5], floor: 1, format: ",.2f", label: "target-anchored" },

  // ── PERCENTILE SPEED · ONE SET FOR ALL EIGHT PERCENTILES ──────────────────────
  // The failure mode here was not the histogram (ckmeans behaves on a bounded, broad
  // distribution) but that each of the eight percentile choices got its own ramp: p5
  // topped out at 51.67 and p95 at 68.31, so stepping p5 → p50 → p95 — the obvious way
  // to read a speed distribution — re-labelled the legend three times. One 10 mph set
  // makes the eight settings one instrument: #d53e4f always means "under 10 mph", and
  // the percentile control now shows the distribution shifting across a fixed scale.
  // 10 mph because that is the unit posted speeds come in; posted-speed-relative breaks
  // are not possible on this source (no reference-speed column — checked all 121).
  speed: { edges: [10, 20, 30, 40, 50, 60], floor: 0, format: ",.0f", label: "10 mph steps" },

  // ── PHED · A LOG SET PER (TRAFFIC × UNIT) FAMILY ──────────────────────────────
  // Log-normal data with no upper policy anchor: the p1–p99 working range of the default
  // column alone spans 5.4 decades. Round powers of ten are both distribution-
  // appropriate and quotable — "10 / 100 / 1,000 / 5,000 / 25,000 / 100,000
  // person-hours" is a legend a person can read out loud. Worst bin per family across
  // 2021-2025: 31.4 / 24.2 / 19.9 / 32.3 / 27.1 / 19.1 %, against 67.4–89.1 % today.
  "phed:all:phrs": { edges: [10, 100, 1000, 5000, 25000, 100000], floor: 0, format: ",.2~s", label: "log decades" },
  "phed:all:vhrs": { edges: [10, 100, 500, 2500, 10000, 50000], floor: 0, format: ",.2~s", label: "log decades" },
  "phed:all:hrs": { edges: [0.1, 1, 3, 10, 30, 100], floor: 0, format: ",.2~f", label: "log decades" },
  "phed:truck:phrs": { edges: [1, 10, 100, 1000, 5000, 25000], floor: 0, format: ",.2~s", label: "log decades" },
  "phed:truck:vhrs": { edges: [1, 10, 50, 250, 1000, 5000], floor: 0, format: ",.2~s", label: "log decades" },
  "phed:truck:hrs": { edges: [0.1, 1, 3, 10, 30, 100], floor: 0, format: ",.2~f", label: "log decades" },

  // ── TED · the same, one step further right ────────────────────────────────────
  // TED is PHED without the peak restriction and without the occupancy factor, so its
  // magnitudes sit above PHED's in the same units. It tolerates fixed log breaks even
  // better — zero sub-1 % bins on any of its 12 columns in any of the five years —
  // precisely because it has no peak control to shift the magnitude.
  "ted:all:phrs": { edges: [10, 100, 1000, 10000, 50000, 250000], floor: 0, format: ",.2~s", label: "log decades" },
  "ted:all:vhrs": { edges: [10, 100, 1000, 5000, 25000, 100000], floor: 0, format: ",.2~s", label: "log decades" },
  "ted:all:hrs": { edges: [0.1, 1, 5, 25, 100, 500], floor: 0, format: ",.2~f", label: "log decades" },
  "ted:truck:phrs": { edges: [10, 100, 1000, 5000, 25000, 100000], floor: 0, format: ",.2~s", label: "log decades" },
  "ted:truck:vhrs": { edges: [1, 10, 100, 500, 2500, 10000], floor: 0, format: ",.2~s", label: "log decades" },
  "ted:truck:hrs": { edges: [0.1, 1, 5, 25, 100, 500], floor: 0, format: ",.2~f", label: "log decades" },
};

// The unit token `getMeasure()` appends last. Order matters only for readability — the
// three suffixes are mutually exclusive (`…_all_xdelay_phrs` does not end in
// `_xdelay_hrs`).
const delayUnit = (column) => {
  if (column.endsWith("_all_xdelay_phrs")) return "phrs";
  if (column.endsWith("_all_xdelay_vhrs")) return "vhrs";
  if (column.endsWith("_xdelay_hrs")) return "hrs";
  return null;
};

// The traffic token is the SECOND segment of a PHED/TED column, and it is matched
// EXPLICITLY rather than by "does the name contain truck": `singl` / `combi` are real
// values in the Traffic Type domain (commented out today) whose magnitudes are neither
// the all-traffic nor the truck family's, so they must fall through to ckmeans instead
// of silently borrowing the truck ramp.
const delayTraffic = (token) => {
  if (token === "truck") return "truck";
  // no traffic token at all — the next token is the threshold, the peak or the unit
  if (token === "freeflow" || token === "all" || token === "amp" || token === "pmp" || token === "xdelay") {
    return "all";
  }
  return null;
};

const RATIO_COLUMN = { lottr: /^lottr(_[a-z]+)?_lottr$/, tttr: /^tttr(_[a-z]+)?_tttr$/ };
const SPEED_COLUMN = /^speed_pctl_\d+$/;

// column → the key of the authored set that covers it, or null.
export const breakSetKey = (column) => {
  const col = typeof column === "string" ? column : "";
  if (!col) return null;
  if (RATIO_COLUMN.lottr.test(col)) return "lottr";
  if (RATIO_COLUMN.tttr.test(col)) return "tttr";
  if (SPEED_COLUMN.test(col)) return "speed";
  if (col.startsWith("phed_") || col.startsWith("ted_")) {
    const parts = col.split("_");
    const unit = delayUnit(col);
    const traffic = delayTraffic(parts[1]);
    if (!unit || !traffic) return null;
    return `${parts[0]}:${traffic}:${unit}`;
  }
  return null;
};

// THE RESOLVER the plugin calls. Returns the authored set in the shape the paint and the
// bin-count SQL expect — `breaks[0]` is the floor, `breaks.slice(1)` the 6 edges — or
// null, which means "use the per-view ckmeans query".
export const resolveBreakSet = (column) => {
  const key = breakSetKey(column);
  const set = key && SETS[key];
  if (!set) return null;
  return {
    key,
    breaks: [set.floor, ...set.edges],
    edges: set.edges,
    floor: set.floor,
    format: set.format,
    label: set.label,
    // no authored maximum — see the header. The panel draws the top bin as open-ended.
    max: null,
  };
};

// Every authored key, for the coverage probe (57 reachable columns must all resolve).
export const breakSetKeys = () => Object.keys(SETS);
