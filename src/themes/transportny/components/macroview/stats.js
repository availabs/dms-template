// macroview — the plugin's own UDA side-queries.
//
// The map draws its NETWORK only from tiles (project_mapeditor_renders_only_from_tiles);
// everything here feeds PANELS — the value distribution, the legend's per-bin counts, the
// worst-N list and the segment search. None of it changes what the choropleth paints.
//
// ONE exception since 2026-08-17, and it is deliberate: `fetchWorstSegments` also returns
// a centre point per segment (PT_X_ATTR / PT_Y_ATTR) which comp.jsx draws as a 25-feature
// client-side GeoJSON circle layer ON TOP of the tile layer (worstPoints.js). Twenty-five
// points do not justify a tile route, and routing them through the DaMa tile pipeline
// would mean a second published view; the tile-drawn PM3 network itself is untouched.
//
// Non-component module (no JSX, no hooks) so the .jsx files stay Fast-Refresh clean.
//
// `udaFilter` is the MERGED envelope built in comp.jsx (the layer's static filter PLUS
// the geography chips, which live in the layer's `dynamic-filters`) — since 2026-08-17 it
// can therefore carry a `filterGroups` tree, and any query that wants filterGroups of its
// own has to NEST rather than overwrite (see fetchSegmentMatches).
//
// VERIFIED against source 1410 / view 3425 (PM3 2025, 52,127 rows) on 2026-08-12: the
// four queries below together return in ~0.5s, which is why the design-set's
// "value-distribution histogram" escalation was reassigned from the Map section to this
// plugin. Numbers observed then: count 52,127 · p50 1.24 · p80 1.46 · 8,459 rows above
// 1.50 · 7 ckmeans bins [23070, 17837, 7798, 2823, 526, 68, 5].
//
// TWO OF THOSE NUMBERS WERE WRONG, and both are fixed below (2026-08-18):
//   · `8,459 above 1.50` counted `> 1.50` where the federal rule and the PM3 view's own
//     SQL use `>= 1.50`. 1,132 segments sit exactly on 1.50, so the honest figure is
//     **9,591 (18.4 %)**, not 8,459 (16.2 %).
//   · the bin counts put every NULL row in the top bin (`NULL < b` is NULL in SQL), which
//     on PHED drew a top bin of 30,945 where the true count is 5.
// The breaks themselves are no longer computed per view either — they are authored data
// in breaks.js.
//
// Route facts that shape the code (see uda.route.js / uda/postgres.js):
//   · `filter`/`exclude` values MUST be arrays; `gt/gte/lt/lte/like` MUST be scalars.
//   · The response leaf is keyed by the EXACT attribute string sent, not the SQL alias —
//     hence every attribute is built once and reused for the read.
//   · There is NO histogram/percentile route: aggregates are written as SQL in the
//     attribute list. `sanitizeName` strips select/create/drop/update/delete/insert/
//     alter/exec/union/CAST and `;` at word boundaries — so no `CAST(...)` (use `::`).
//   · An ungrouped aggregate makes `length` lie; pass `ungroupedAggregate: true`.
//   · `length` must never carry `orderBy`.
//   · A grouped query that GROUP BYs an output alias needs `groupByAliasExprs` so the
//     length query can resolve the same expression.

const unwrap = (v) => (v && typeof v === "object" && "$type" in v ? v.value : v);
const at = (obj, path) => path.reduce((a, k) => (a == null ? a : a[k]), obj);

// Reads a ranged `dataByIndex` result out of a falcor response, falling back to the
// cache (a fully-cached `get` resolves with an empty `json`).
const readRows = (res, falcor, path, count) => {
  const fromJson = at(res?.json, path);
  const bag = fromJson || at(falcor.getCache(), path) || {};
  const rows = [];
  for (let i = 0; i < count; i++) {
    if (bag[i]) rows.push(bag[i]);
  }
  return rows;
};

// The bin index a NO-DATA row is reported under — outside 0…N so it can never be read as
// a bin. See binCaseExpr.
export const NO_DATA_BIN = -1;

// The CASE expression that buckets a value into the bins the map is actually drawing.
// `breaks` is the ramp's domain array whose [0] is the floor, so the bin edges are
// breaks.slice(1) and there is one more bin than there are edges.
//
// ⚠ THE LEADING NULL BRANCH IS LOAD-BEARING, and its absence was a measured lie
// (fixed 2026-08-18). In SQL `NULL < b` is NULL, not true, so without it every no-data
// row falls through the whole ladder into the ELSE branch and is counted in the TOP bin.
// PHED/TED are NULL on ~59 % of the 2025 network — they are computed only on urbanized-
// area segments, which is the federal rule, and those nulls are OUT OF SCOPE, not zero
// (the smallest non-null value anywhere is 0.005). So the histogram drew
// `phed_all_xdelay_phrs`'s worst bin as **30,945 segments when the true count is 5**:
// the biggest bar on the chart was 30,940 segments the map itself paints grey.
// Reporting them under NO_DATA_BIN keeps them countable — the panel states the no-data
// figure rather than silently redistributing it — and matches the analysis's own scoring
// SQL (legend_breaks/score.mjs `binSql`), so a probe and the panel agree by construction.
export const binCaseExpr = (column, breaks) => {
  const edges = (breaks || []).slice(1);
  if (!edges.length) return "";
  return (
    "case " +
    `when ${column} is null then ${NO_DATA_BIN} ` +
    edges.map((b, i) => `when ${column} < ${b} then ${i}`).join(" ") +
    ` else ${edges.length} end`
  );
};

// median · 80th percentile · rows beyond the measure's threshold, in ONE row.
// `threshold` may be null (measures with no reliability threshold) — then the
// beyond-threshold attribute is not requested at all.
export async function fetchMeasureStats({ falcor, pgEnv, viewId, column, udaFilter, threshold }) {
  if (!column || !viewId) return null;
  const attrs = [
    `count(${column}) as mv_n`,
    `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${column}) as mv_p50`,
    `percentile_cont(0.8) WITHIN GROUP (ORDER BY ${column}) as mv_p80`,
  ];
  if (threshold != null) {
    // ⚠ `>=`, NOT `>` (fixed 2026-08-18). The federal LOTTR rule is "unreliable when
    // LOTTR >= 1.5" and the PM3 view's own reliability SQL agrees
    // (`greatest(lottr_amp, lottr_midd, lottr_pmp, lottr_we) >= 1.5`, verified on
    // gis_datasets.s2001_v3394 — the view the live MAP-21 page reads). Values are stored
    // to two decimals and **1,132 segments sit exactly on 1.50**, so `>` under-reported
    // the statewide share as 16.2 % where the rule gives **18.4 %**. The higher number is
    // the correct one — do not "fix" it back.
    attrs.push(`sum(case when ${column} >= ${threshold} then 1 else 0 end) as mv_beyond`);
  }
  const opts = { ...(udaFilter || {}), ungroupedAggregate: true };
  const optsKey = JSON.stringify(opts);
  const base = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "dataByIndex"];
  const res = await falcor.get([...base, { from: 0, to: 0 }, attrs]);
  const row = readRows(res, falcor, base, 1)[0];
  if (!row) return null;
  const n = Number(unwrap(row[attrs[0]]));
  const beyond = threshold != null ? Number(unwrap(row[attrs[3]])) : null;
  return {
    n: Number.isFinite(n) ? n : null,
    p50: Number(unwrap(row[attrs[1]])),
    p80: Number(unwrap(row[attrs[2]])),
    beyond: Number.isFinite(beyond) ? beyond : null,
    beyondPct: Number.isFinite(beyond) && n ? (beyond / n) * 100 : null,
  };
}

// Per-bin row counts over the bins the map is drawing, plus the no-data count.
//
// Returns `{ counts, noData }` — `counts[i]` is the number of rows the map paints in bin
// i and `noData` the number it paints grey because the column is NULL for them. The two
// together are the row count under the same filter envelope (`filteredCount` in
// comp.jsx), which is exactly why they are reported separately: the histogram's bars sum
// to the VALUE-BEARING population by construction, and the panel can state the no-data
// figure instead of implying those rows have a value.
//
// `count(1)` is deliberate and now correct: the null rows have their own group
// (NO_DATA_BIN), so inside every real bin `count(1)` counts rows that DO have a value.
export async function fetchBinCounts({ falcor, pgEnv, viewId, column, udaFilter, breaks }) {
  const caseExpr = binCaseExpr(column, breaks);
  if (!caseExpr || !viewId) return null;
  const attrs = [`${caseExpr} as mv_bin`, "count(1) as mv_ct"];
  const opts = {
    ...(udaFilter || {}),
    groupBy: ["mv_bin"],
    groupByAliasExprs: { mv_bin: caseExpr },
    orderBy: { mv_bin: "asc" },
  };
  const optsKey = JSON.stringify(opts);
  const base = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "dataByIndex"];
  const nBins = breaks.length;
  // nBins real bins PLUS the no-data group, which sorts first (-1 asc) — so the range has
  // to be one row longer than the bin count or the top bin would fall off the end.
  const res = await falcor.get([...base, { from: 0, to: nBins }, attrs]);
  const rows = readRows(res, falcor, base, nBins + 1);
  const counts = new Array(nBins).fill(0);
  let noData = 0;
  rows.forEach((r) => {
    const i = Number(unwrap(r[attrs[0]]));
    const ct = Number(unwrap(r[attrs[1]]));
    if (!Number.isFinite(i)) return;
    if (i === NO_DATA_BIN) noData = Number.isFinite(ct) ? ct : 0;
    else if (i >= 0 && i < nBins) counts[i] = Number.isFinite(ct) ? ct : 0;
  });
  return { counts, noData };
}

// The meta columns source 1410 actually has. There is NO road_name, NO segment length
// and NO AADT on the PM3 source (verified 2026-08-12, 105 columns) — the design's popup
// and search copy assume a network join that this source does not carry. Panels render
// what exists and say so; adding the join is the pm3-runner task.
export const SEGMENT_META = ["tmc", "county", "region_code"];

// The CENTRE OF A SEGMENT, as two scalar attributes — what the worst-N map overlay draws.
//
// ⚠ A falcor attribute key MUST NOT CONTAIN A COMMA: the path key is comma-split
// (reference_dms_calc_column_no_commas), which is why every expression in this file is
// comma-free and why `ST_LineInterpolatePoint(wkb_geometry, 0.5)` — the obvious
// mid-of-line function — is NOT available here. ST_PointOnSurface is single-argument and
// also strictly better than ST_Centroid for this data: it guarantees the point lies ON
// the geometry, where a centroid falls off a curved or L-shaped segment, and every row
// here is a road segment.
//
// VERIFIED before any of this was built (2026-08-17, probe
// scratchpad/npmrdsv5-dev2/macroview_worst/geom.mjs, source 1410):
//   · `wkb_geometry` is exposed by the view (geometry type ST_MultiLineString)
//   · ST_SRID(wkb_geometry) = **4326** on the VALUES — not one of the `srid 0` views
//     (reference_dama_srid0_breaks_tiles) — so the numbers are already lon/lat and go
//     straight into a GeoJSON coordinate pair with no reprojection
//   · 25/25 rows finite; statewide x ∈ [-78.643, -72.501], y ∈ [40.732, 44.992]
//   · every point lands inside its own segment's bbox (ST_XMin/XMax/YMin/YMax), 25/25
//   · holds on ALL FIVE year views the Year select offers — 3425 · 2568 · 2567 · 2575 ·
//     2587 — so switching year cannot break the overlay
export const PT_X_ATTR = "ST_X(ST_PointOnSurface(wkb_geometry)) as pt_x";
export const PT_Y_ATTR = "ST_Y(ST_PointOnSurface(wkb_geometry)) as pt_y";

// Worst-N segments by the drawn measure, inside the current filter.
//
// The centre point comes back in the SAME query as the list row (one extra pair of
// columns, no extra round trip). That is not just an optimisation: the ordering has ties
// (ranks 24/25 are both 4.000 statewide on view 3425) and the server does not tie-break,
// so a second query for coordinates could legitimately return a different 25 segments.
// One query ⇒ the points on the map ARE the rows in the list.
// ⚠ NO-DATA ROWS MUST BE EXCLUDED, and that was a measured bug too (fixed 2026-08-18).
// Postgres sorts NULLS FIRST on `ORDER BY col DESC`, so on any measure that has nulls the
// "worst 25" were 25 rows with NO VALUE: with PHED selected the panel listed
// 104+10650 · MONROE … at "0" and dropped 25 points on the map in bin 1's colour, while the
// genuinely worst segment (120-05004, 1,932,190 person-hours) was not in the list at all.
// `exclude: {col: ["null"]}` is the UDA route's own IS-NOT-NULL form (uda_query_sets/
// helpers.js: exclude maps the sentinel `"null"` to `IS NOT`), and it is MERGED with any
// exclude the caller already has rather than replacing it.
export async function fetchWorstSegments({
  falcor, pgEnv, viewId, column, udaFilter, limit = 25,
}) {
  if (!column || !viewId) return null;
  const attrs = [...SEGMENT_META, column, PT_X_ATTR, PT_Y_ATTR];
  const opts = {
    ...(udaFilter || {}),
    exclude: { ...(udaFilter?.exclude || {}), [column]: ["null"] },
    orderBy: { [column]: "desc" },
  };
  const optsKey = JSON.stringify(opts);
  const base = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "dataByIndex"];
  const res = await falcor.get([...base, { from: 0, to: limit - 1 }, attrs]);
  return readRows(res, falcor, base, limit).map((r) => ({
    tmc: unwrap(r.tmc),
    county: unwrap(r.county),
    region: unwrap(r.region_code),
    value: Number(unwrap(r[column])),
    // lon/lat, SRID 4326 — see PT_X_ATTR. Left as raw Numbers (NaN if a row ever has no
    // geometry); the overlay drops non-finite pairs rather than inventing a location.
    x: Number(unwrap(r[PT_X_ATTR])),
    y: Number(unwrap(r[PT_Y_ATTR])),
  }));
}

// Segment lookup. `like` on Postgres is lower()ed on both sides, so this is
// case-insensitive; the `%` wildcards are ours to supply. Searching by TMC or county is
// all this source supports (no road_name column).
export async function fetchSegmentMatches({
  falcor, pgEnv, viewId, column, udaFilter, term, limit = 12,
}) {
  const t = (term || "").trim();
  if (t.length < 3 || !viewId) return null;
  const attrs = [...SEGMENT_META, column].filter(Boolean);
  const termGroup = {
    op: "or",
    groups: [
      { col: "tmc", op: "like", value: `%${t}%` },
      { col: "county", op: "like", value: `%${t}%` },
    ],
  };
  // `udaFilter` now carries the geography selection AS a filterGroups tree (comp.jsx →
  // buildLayerUdaFilterOptions), so spreading it and then assigning `filterGroups` would
  // throw the selection away — the search would look statewide while every other panel
  // number is scoped. Nest instead: (geography) AND (tmc|county LIKE term).
  const { filterGroups: scopeGroups, ...restOfFilter } = udaFilter || {};
  const opts = {
    ...restOfFilter,
    filterGroups: scopeGroups?.groups?.length
      ? { op: "AND", groups: [scopeGroups, termGroup] }
      : termGroup,
  };
  const optsKey = JSON.stringify(opts);
  const base = ["uda", pgEnv, "viewsById", +viewId, "options", optsKey, "dataByIndex"];
  const res = await falcor.get([...base, { from: 0, to: limit - 1 }, attrs]);
  return readRows(res, falcor, base, limit).map((r) => ({
    tmc: unwrap(r.tmc),
    county: unwrap(r.county),
    region: unwrap(r.region_code),
    value: column ? Number(unwrap(r[column])) : null,
  }));
}
