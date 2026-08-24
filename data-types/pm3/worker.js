/**
 * pm3 publish worker — per-year, per-TMC, PER-METRIC orchestrator.
 *
 * pm3 began as a re-parametrization of map21 and was FORKED from it on 2026-08-14: the
 * calculators, constants and helpers now live in ./lib/ as pm3's own copies. map21 is frozen
 * for calculation (FHWA submittal, backward compatibility); pm3 is not, and the two are meant
 * to diverge. pm3/tests/no-map21-import.unit.test.mjs enforces that pm3 never imports map21
 * again; map21/tests/golden.unit.test.mjs pins map21's output so the freeze is checkable.
 * See planning/transportny/tasks/current/pm3-fork-and-measure-implementation.md.
 *
 * Where it deliberately differs from map21:
 *
 *   - 12 metrics, not 3: speed_pctl (pm3-only, ./speedPercentilesCalculator),
 *     lottr, tttr, tttr_p80 (R1 — the truck ratio read at p80/p50, 297x cheaper in
 *     sample terms than TTTR's p95/p50), and the full phed/ted family (speed-limit +
 *     freeflow thresholds, all-vehicles + truck).
 *   - Persists the PHED threshold diagnostics (R3): threshold_speed,
 *     threshold_travel_time_sec, and tt_15_pct on the freeflow variants. map21 computes
 *     these and discards them.
 *   - Publishes per-bin completeness and precision (R4/R6) and coverage-era tags (R9).
 *
 * ## Read pm3/PROVENANCE.md before interpreting any published pm3 value
 *
 * It records what a consumer needs and cannot infer from the schema: that the feed arrives
 * already clamped at both ends by the vendor, that the 15-minute mean is the largest outlier
 * suppressor in the pipeline and was inherited rather than chosen, that coverage moves in nine
 * non-stationary eras whose boundaries differ BY STREAM, which delay yardstick a given column
 * used, and the list of screens deliberately NOT applied with the measurement that killed each.
 *   - PERMISSIVE checkMeta: legacy pm3 commented out every map21 meta gate —
 *     a TMC is skipped only when it has no meta row at all.
 *   - Per-metric DB writes (legacy METRIC_WRITES_DB=true): each metric result
 *     is upserted on its own against the named UNIQUE(tmc, year) constraint,
 *     with LOWERCASE metric-prefixed columns (legacy LOWER_CASE_COLUMNS=true,
 *     no FHWA header renames, no HPMS CSV).
 *   - Output lives in the `pm3` schema; multi-year rows
 *     (UNIQUE(tmc, year), deletes by `year in (...)` — not map21's
 *     single-year begindate regex).
 *   - Writes tiles metadata + rawViewIdsUsed to the view.
 *
 * ## Two relations per view (geometry de-duplication, 2026-08-07)
 *
 * `views.table_name` is a **Postgres VIEW**, not a table:
 *
 *   pm3.s{src}_v{view}_pm_3_metrics   table — ogc_fid, tmc, year + metric columns
 *   pm3.s{src}_v{view}_pm_3           view  — metrics ⋈ the year's npmrds_meta
 *                                             geometry table, adding wkb_geometry
 *                                             and the other 23 TMC attributes
 *
 * pm3 used to materialize all 25 static columns per view, which made geometry
 * 44.5% of every pm3 table (28 MB of 62 MB for 2025) and pinned each view to
 * whatever network vintage was current when it ran. It also drifted: live views
 * for 2021-23 have no `miles`/`directionalaadt` columns at all and 2024 has them
 * all-NULL. Reading them live through the view fixes both.
 *
 * Nothing downstream changes — tiles, colorDomain, the UDA table/filters,
 * gis-dataset/create-download and the macroview plugin all resolve
 * `views.table_name` and see the same columns, in the same order, with the same
 * types and values (verified: 0 diffs across 25 columns × 52,127 rows).
 *
 * The one hard requirement is a GIST index on the npmrds_meta geometry table —
 * those tables ship without one, and without it a single z9 tile takes 255s
 * instead of 22ms. `ensureMetaGeometryIndex` creates it idempotently per year.
 *
 * Structural changes vs the legacy publish.worker.mjs follow the map21 port:
 * flat ctx.task.descriptor, db/chDb adapters, ctx.dispatchEvent/updateProgress.
 * Dependency-injected via makeWorker(deps) so tests stub ClickHouse and route
 * all PHYSICAL data-table SQL through a recording `dataDb`.
 */

const {
  BIN_NAMES,
  ALL_VEHICLES,
  FREIGHT_TRUCKS,
  NPMRDS_CH_SCHEMA_NAME,
  PERCENTILES_FOR_MEASURES,
} = require('./lib/constants.js');
const {
  createDataTable,
  getListTmcId,
  generateTmcIdMetaQuery,
} = require('./lib/helpers.js');
const { calcTtrMeasure } = require('./lib/calcTtrMeasure.js');
const { calcPhed } = require('./lib/calcPhed.js');
const { hasPrecisionCurve, MIN_N } = require('./lib/precision.js');
const { coverageCalculator, coverageColumnNames } = require('./coverageCalculator.js');
const { speedPercentilesCalculator, PERCENTILES } = require('./speedPercentilesCalculator.js');
const {
  toMetricDbRow,
  generateUpdateColumnsSql,
  getDataRowInsertSql,
  META_COLUMNS,
  NUMERIC_META_COLUMNS,
  metaColumnType,
  buildAddMetaColumnsSql,
  buildPm3ViewSql,
  buildPm3UnionViewSql,
  pm3ViewColumnNames,
  ERA_COLUMNS,
} = require('./helpers.js');

// ── Metric registry ──────────────────────────────────────────────────────────

const PHED_TRUCK_CONFIG = {
  npmrdsDataKeys: FREIGHT_TRUCKS,
  secondaryDataKey: ALL_VEHICLES,
  avoKey: 'avgvehicleoccupancytruck',
  dirAadtKey: 'directionalaadttruck',
};
const PHED_ALL_VEHICLES_CONFIG = {
  npmrdsDataKeys: ALL_VEHICLES,
  avoKey: 'avg_vehicle_occupancy',
  dirAadtKey: 'directionalaadt',
};

// The CH meta table for speed_pctl is only known at run time, so the full
// config map is built per run.
//
// `kind` drives column-name enumeration for metadata.columns (see
// buildPm3SourceColumns) — it must describe the shape of the keys the
// calculator returns, so it stays next to the calculator it belongs to.
function buildMetricConfigs({ chMetaTableName }) {
  return {
    // Data coverage as its own measure: completeness is a property of (stream, time bin), not of a
    // performance measure. Published once per stream per bin instead of duplicated across every
    // measure that reads the same stream. See pm3/coverageCalculator.js.
    coverage: {
      kind: 'coverage',
      npmrdsDataKeys: ALL_VEHICLES,   // unused: the calculator iterates both streams itself
      calculator: coverageCalculator,
      timeBins: [BIN_NAMES.ALL],      // unused: bins come from COVERAGE_BINS
    },
    speed_pctl: {
      kind: 'speed_pctl',
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: speedPercentilesCalculator,
      timeBins: [BIN_NAMES.ALL],
      metadataTable: chMetaTableName,
    },
    lottr: {
      kind: 'ttr',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE],
      npmrdsDataKeys: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    tttr: {
      kind: 'ttr',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE, BIN_NAMES.OVN],
      npmrdsDataKeys: FREIGHT_TRUCKS,
      secondaryDataKey: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    // R1 — same truck data, same bins, same calculator, read at p80/p50 instead of p95/p50.
    // Needs 195 bins against TTTR's 6,297 for comparable precision (297× cheaper), so it is
    // estimable on 68.8% of the network where TTTR reaches 7.6%. TTTR above is untouched.
    // Rationale and measurements: pm3/lib/constants.js PERCENTILES_FOR_MEASURES.tttr_p80.
    tttr_p80: {
      kind: 'ttr',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.MIDD, BIN_NAMES.PMP, BIN_NAMES.WE, BIN_NAMES.OVN],
      npmrdsDataKeys: FREIGHT_TRUCKS,
      secondaryDataKey: ALL_VEHICLES,
      calculator: calcTtrMeasure,
    },
    phed: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_freeflow: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck_freeflow: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    ted: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_freeflow: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'speed_limit',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck_freeflow: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow',
      timeBins: [BIN_NAMES.ALL],
    },

    // ── R2: anchored free-flow reference ────────────────────────────────────
    // The four `*_freeflow` metrics above derive their p15 threshold from the PUBLISH year, which
    // makes the yardstick track the traffic it is measuring (H5: the p15's year-to-year movement
    // correlates with the median's at r = +0.998). These four are the same measures computed against
    // a FIXED single-era window instead — worth +6.69% on network delay, 36.3% of segments up >5%
    // against 9.6% down. See pm3/lib/eras.js FREEFLOW_REFERENCE_WINDOW.
    //
    // Both variants are published side by side deliberately. A silent switch would land a one-time
    // +6.69% step in the middle of a published trend and read as a data error, so consumers get an
    // overlap period in which they can see both series and migrate. **Retiring the transition is
    // simply deleting the four `*_freeflow` entries above** — no other code changes.
    phed_freeflow_anchored: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck_freeflow_anchored: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    ted_freeflow_anchored: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck_freeflow_anchored: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      timeBins: [BIN_NAMES.ALL],
    },

    // ── R13: unfloored (relative) delay ─────────────────────────────────────
    // 0.6 x achievable speed with NO 20 mph floor. RQ18 measured that the floor, not the reference,
    // is the dominant term for every non-freeway class -- removing it moves network delay -41.4%, and
    // -59.9% on principal arterials, which alone carry two thirds of the state total, while moving
    // Interstates only -1.3%.
    //
    // This is the ONLY form in which delay is comparable across functional classes: with the floor in
    // place an arterial figure is ~90% floored against a freeway's ~3%, so comparing them compares the
    // floor rather than congestion. Its own weakness is the mirror image -- on an intrinsically slow
    // street (13 mph achievable -> 7.8 mph threshold) genuine severe congestion can register as zero
    // delay. Neither form is correct for every purpose, which is why both are published and
    // PROVENANCE.md names which to use when.
    //
    // Paired with the ANCHORED reference only, deliberately: a measure worth making class-fair is also
    // worth making time-stable, and the own-year variants exist solely for the R2 transition overlap.
    // Not offered for the speed_limit base -- see the note in calcPhed.
    phed_freeflow_relative: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      thresholdFloorMph: 0,
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    phed_truck_freeflow_relative: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      thresholdFloorMph: 0,
      timeBins: [BIN_NAMES.AMP, BIN_NAMES.ALT_PMP],
    },
    ted_freeflow_relative: {
      kind: 'phed',
      ...PHED_ALL_VEHICLES_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      thresholdFloorMph: 0,
      timeBins: [BIN_NAMES.ALL],
    },
    ted_truck_freeflow_relative: {
      kind: 'phed',
      ...PHED_TRUCK_CONFIG,
      calculator: calcPhed,
      thresholdSpeedVersion: 'freeflow_anchored',
      thresholdFloorMph: 0,
      timeBins: [BIN_NAMES.ALL],
    },
  };
}

const METRIC_NAMES = Object.keys(buildMetricConfigs({ chMetaTableName: '' }));

// ── Permissive meta gate ─────────────────────────────────────────────────────
// Legacy pm3 commented out every one of map21's rules — only the existence of
// a meta row is required. Deliberate: pm3 keeps non-NHS / non-primary / rural
// TMCs that the FHWA submittal excludes.
function checkMeta({ tmcMeta }) {
  if (!tmcMeta) return false;
  return true;
}

// TMC attributes pulled from the per-year meta layer (legacy pm3 list — wider
// than map21's: adds geography, geometry, truck AVO/AADT).
const TMC_META_DATA_KEYS = [
  'tmc', 'urban_code', 'isprimary', 'direction', 'directionalAadt',
  'avgVehicleOccupancyTruck', 'directionalAadtTruck', 'avg_speedlimit', 'miles',
  'avg_vehicle_occupancy', 'functionalClass', 'congestion_level', 'directionality',
  'nhs', 'nhs_pct', 'f_system', 'faciltype', 'state_code', 'active_start_date',
  'region_code', 'county', 'ua_name', 'mpo_code', 'mpo_name', 'wkb_geometry', 'year',
];

// ── Source metadata.columns ──────────────────────────────────────────────────
// Enumerated FROM THE METRIC REGISTRY rather than hand-listed, because the
// macroview map builds column names by string construction (see
// themes/transportny/components/macroview/updateFilters.jsx `getMeasure`) and
// the download-modal column picker + the UDA table page read this list. A
// hand-maintained list drifts, and the symptom is a map that renders a column
// the author cannot select for download. The `metadata.columns ≡ physical
// columns` test in tests/source-columns.unit.test.mjs is the regression guard.
//
// PERCENTILES_FOR_MEASURES supplies the TTR percentile labels; calcTtrMeasure
// writes `${bin}_${metric}_${pct*100}_PCT` (calcTtrMeasure.js:155-160), and
// calcPhed relabels the ALT_PMP bin as PMP on write (calcPhed.js:152).
const PHED_UNIT_SUFFIXES = [
  ['all_xdelay_phrs', 'Person-Hours of Delay'],
  ['all_xdelay_vhrs', 'Vehicle-Hours of Delay'],
  ['xdelay_hrs', 'Excessive Delay (hrs)'],
];

const titleize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
const binLabel = (bin) => (bin === BIN_NAMES.ALT_PMP ? BIN_NAMES.PMP : bin).toLowerCase();

function metricColumnDescriptors(metricName, config) {
  const out = [];
  const push = (name, display_name) => out.push({ name, display_name, type: 'NUMERIC', desc: null });
  const M = metricName.toUpperCase();

  if (config.kind === 'speed_pctl') {
    for (const p of PERCENTILES) push(`${metricName}_${p}`, `Speed ${p}th Pctl`);
    return out;
  }

  if (config.kind === 'coverage') {
    // Column names are fully determined by (stream x bin), so they come from the calculator's own
    // enumeration rather than being rebuilt here — one source of truth.
    for (const name of coverageColumnNames()) {
      const m = /^coverage_(.+)_([a-z_]+)_pct_(bins|epochs)_reporting$/.exec(name);
      const [, stream, bin, unit] = m;
      const pretty = stream.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
      push(name, `Coverage ${pretty} ${bin.toUpperCase()} ${unit === 'bins' ? 'Bins' : 'Epochs'} Reporting (%)`);
    }
    return out;
  }

  if (config.kind === 'ttr') {
    const { upperPercentile, lowerPercentile } = PERCENTILES_FOR_MEASURES[metricName];
    const upper = `${upperPercentile * 100}_pct`;
    const lower = `${lowerPercentile * 100}_pct`;
    for (const bin of config.timeBins) {
      const b = binLabel(bin);
      push(`${metricName}_${b}_${metricName}`, `${M} ${b.toUpperCase()}`);
      push(`${metricName}_${b}_${metricName}_${upper}`,
        `${M} ${b.toUpperCase()} ${upperPercentile * 100}th Pctl Travel Time`);
      push(`${metricName}_${b}_${metricName}_${lower}`,
        `${M} ${b.toUpperCase()} ${lowerPercentile * 100}th Pctl Travel Time`);
      // n_bins is this measure's own sample size — what the percentile was taken over, and the
      // input to the precision band below. COMPLETENESS lives on the standalone `coverage` metric:
      // it is a property of (stream, bin), so publishing it per measure duplicated it across every
      // measure reading the same stream.
      push(`${metricName}_${b}_n_bins`, `${M} ${b.toUpperCase()} Observations (15-min bins)`);
      // Probe-depth quality, TRUCK METRICS ONLY: H6 found data_density adds nothing over a plain
      // count for the all-vehicle stream, while H9 found it carries real signal for trucks. The
      // value is computed for every stream but published only where it is known to be informative.
      if (config.npmrdsDataKeys === FREIGHT_TRUCKS) {
        push(`${metricName}_${b}_pct_epochs_density_a`,
          `${M} ${b.toUpperCase()} Epochs on 1-4 Probes (%)`);
      }
      // R6 — precision, published only where H1b actually measured a curve for that quantile
      // pair and stream. No curve means no claim: an extrapolated precision figure would be worse
      // than none. Advisory columns — pm3 flags a thin sample, it never suppresses the value.
      if (hasPrecisionCurve(metricName)) {
        push(`${metricName}_${b}_precision_band`,
          `${M} ${b.toUpperCase()} Expected SD at this Sample Size`);
        push(`${metricName}_${b}_min_n_bar`,
          `${M} ${b.toUpperCase()} Minimum Sample for +/-0.05 Precision`);
      }
    }
    return out;
  }

  if (config.kind === 'phed') {
    // Per-bin columns, then the annual accumulators calcPhed always returns.
    for (const bin of config.timeBins) {
      const b = binLabel(bin);
      for (const [suffix, label] of PHED_UNIT_SUFFIXES) {
        push(`${metricName}_${b}_${suffix}`, `${M} ${b.toUpperCase()} ${label}`);
      }
    }
    for (const [suffix, label] of PHED_UNIT_SUFFIXES) {
      push(`${metricName}_${suffix}`, `${M} ${label} (annual)`);
    }
    // R3 — threshold diagnostics. calcPhed computes all of these and, before this change, returned
    // them only inside a `meta` object that toMetricDbRow discards. Persisting them is what makes a
    // published PHED auditable: without them you cannot tell whether a segment's delay changed
    // because its traffic changed or because its threshold moved. Legacy
    // public.pm3_authoritative_view published tt_15_pct and threshold_speed for 2016-2019, so this
    // is a restoration rather than an invention.
    push(`${metricName}_threshold_speed`, `${M} Threshold Speed (mph)`);
    push(`${metricName}_threshold_travel_time_sec`, `${M} Threshold Travel Time (sec)`);
    // Only the freeflow variants have a percentile behind the threshold; the speed_limit variants
    // derive it from posted speed, so a tt_15_pct column there would be permanently null.
    if (config.thresholdSpeedVersion === 'freeflow'
        || config.thresholdSpeedVersion === 'freeflow_anchored') {
      push(`${metricName}_tt_15_pct`, `${M} 15th Pctl Travel Time (sec)`);
    }
    // Only the anchored variants can fall back: the own-year reference IS the fallback, and the
    // speed_limit variants have no percentile at all. 1 where a TMC had no data in the reference
    // window and its own year was substituted, NULL otherwise.
    if (config.thresholdSpeedVersion === 'freeflow_anchored') {
      push(`${metricName}_anchor_fallback`, `${M} Anchor Fell Back To Own Year`);
    }
    return out;
  }

  throw new Error(`metricColumnDescriptors: unknown metric kind "${config.kind}" for ${metricName}`);
}

function buildPm3SourceColumns(metricConfigs = buildMetricConfigs({ chMetaTableName: '' })) {
  const cols = [];
  const seen = new Set();
  const add = (c) => { if (!seen.has(c.name)) { seen.add(c.name); cols.push(c); } };

  // `ogc_fid` FIRST, and flagged isIndex.
  //
  // It was previously left undeclared on the grounds that it is an internal row id, not something a
  // consumer wants in a download picker. That was wrong for one specific reason: since the geometry
  // de-duplication the published relation is a VIEW, and a view has no PRIMARY KEY. uda's
  // `resolvePrimaryKey` therefore finds nothing in `pg_index` and falls back to `'id'`, so
  // `dataById` emits `WHERE id = ANY($1)` against a relation with no `id` column. Every map popup
  // fails its attribute fetch and sits on "Fetching Attributes" forever.
  //
  // `isIndex: true` is what `getEssentials` reads (routes/uda/utils.js) to override that detection.
  // Declaring it also aligns the source's list with `pm3ViewColumnNames`, whose first entry is
  // ogc_fid — the two describe the same relation and should agree.
  //
  // Source 1410 never hit this because its views are BASE TABLEs with a real PK on ogc_fid, so the
  // pg_index lookup succeeded. Sources 2133-2135 all shipped with broken popups.
  add({
    name: 'ogc_fid',
    display_name: 'OGC FID',
    type: 'INTEGER',
    isIndex: true,
    desc: 'Internal row id. Carried in the MVT feature id, and the key map popups resolve attributes by.',
  });

  for (const c of META_COLUMNS) {
    if (c === 'wkb_geometry') { add({ name: c, display_name: 'Geometry', type: 'GEOMETRY', desc: null }); continue; }
    add({
      name: c,
      display_name: titleize(c),
      type: NUMERIC_META_COLUMNS.includes(c) ? 'NUMERIC' : 'TEXT',
      desc: null,
    });
  }
  for (const [metricName, config] of Object.entries(metricConfigs)) {
    for (const c of metricColumnDescriptors(metricName, config)) add(c);
  }
  // R9/R4 — the view's era tags. Declared so the datasets pattern can see them.
  for (const c of ERA_COLUMNS) add(c);
  return cols;
}
/**
 * The metric columns a pm3 view exposes, in relation order, derived from the registry alone.
 *
 * This is the ordered half of the identical-columns invariant. Every view of a pm3 source has to
 * expose the same columns in the same positions (`metadata.columns` lives on the SOURCE — see
 * data-types/CLAUDE.md), and the way to guarantee that is to make the list a pure function of the
 * registry: no year, no run, no read of the physical table. Reading information_schema instead would
 * also pick up whatever the warm-up TMC's safety-net ALTER happened to add for a calculator key the
 * registry does not enumerate, which would land on one year's view and not another's.
 *
 * Same order and same de-duplication as buildPm3SourceColumns, so the source's declared list and the
 * view's actual list cannot diverge (asserted in tests/per-year-views.unit.test.mjs).
 */
function pm3MetricColumnNames(metricConfigs = buildMetricConfigs({ chMetaTableName: '' })) {
  const excluded = new Set(['ogc_fid', ...META_COLUMNS]);
  const seen = new Set();
  const out = [];
  for (const [metricName, config] of Object.entries(metricConfigs)) {
    for (const { name } of metricColumnDescriptors(metricName, config)) {
      if (excluded.has(name) || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

const PM3_SOURCE_COLUMNS = buildPm3SourceColumns();

// ── Small utilities ──────────────────────────────────────────────────────────

const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));
const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);

function formatYyyyMmDd(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// The metrics table's name. `views.table_name` stays the legacy `_pm_3` name
// and is the metrics⋈geometry VIEW; the metrics table sits beside it.
const METRICS_SUFFIX = '_metrics';
const metricsTableName = (table_name) => `${table_name}${METRICS_SUFFIX}`;

// Postgres truncates identifiers past 63 bytes SILENTLY, which would collapse two years' tables into
// one name. createDamaView caps the source-name slug at 40 chars, and with 7-digit source/view ids
// that is a 58-char base — long enough to matter — so every suffix is applied with the `_metrics`
// allowance already subtracted.
const PG_MAX_IDENTIFIER = 63;
const suffixedTableName = (base, suffix) =>
  `${base.slice(0, PG_MAX_IDENTIFIER - METRICS_SUFFIX.length - suffix.length - 1)}_${suffix}`;

// One view per year, and createDamaView names the table from the SOURCE name — identical for every
// view of the source — so the year goes in the table name too. Without it nine years of tables differ
// only by view id, which is unreadable at a psql prompt.
const yearTableName = (base, year) => suffixedTableName(base, String(year));

// The `version` string that identifies the source's cross-year union view, and the one value that
// must NOT look like a year: pickUnionMemberViews filters members on a bare 4-digit version, which is
// what keeps the union view (and the legacy multi-year views, whose version is empty) out of its own
// membership.
const UNION_VERSION = 'all_years';
const unionTableName = (base) => suffixedTableName(base, UNION_VERSION);

// ── Bounded concurrency ──────────────────────────────────────────────────────
// The per-TMC pass is ~11-13 ClickHouse round-trips, and network latency — not
// CPU or CH itself — dominates a run from outside the cluster (measured 2.5
// s/TMC locally ⇒ ~36h for a 52k-TMC year). TMCs are independent, so running
// them in a pool converts that latency into throughput.
//
// Raised 8 -> 16 and REVERTED to 8 on 2026-08-23, both on measurement. The revert is the interesting
// half, so it is recorded rather than quietly undone.
//
// The case for 16 was a ClickHouse throughput sweep: at max_threads=4 over 192 TMCs, c=8 gave 186 q/s
// and c=16 gave 368 q/s with mean latency flat at 42ms. Doubling looked free.
//
// What a real publish did (task 7161, two years, against 7159 at c=8):
//   wall per year        119.2 min -> 112.8 min   (-5.4%)
//   cumulative CH wait    20,863s  ->  35,863s    (+72%)
//   mean concurrent CH queries  3.5 ->     3.3    (unchanged, against 16 workers)
//
// 5% less wall clock for 72% more load. Measured mid-run, ClickHouse sat at 2.7 of 36 cores serving
// 21 q/s where the sweep said 368 q/s was available — so the extra workers were not issuing extra
// queries, they were queueing for the SINGLE JS THREAD, which is where parse and the metric
// arithmetic run. The sweep measured the wrong resource: it sized ClickHouse's headroom without
// checking whether the runner can feed it.
//
// 8 is where the JS thread saturates, so that is the setting. The two POOL raises stay
// (`max_open_connections` 24 on the clickhouse adapter, pg `max` 20 in the pgEnv config): they cost
// nothing idle, and they remove a cap that would otherwise bind the moment the JS bottleneck is
// actually addressed — which needs worker threads or multiple processes, not a config change.
const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 8;

/**
 * Run `fn(item, index)` over `items` with at most `limit` in flight.
 *
 * Unlike Promise.all over the whole list this bounds resource use, and unlike
 * a chunked `Promise.all` it never idles waiting for a slow item to finish its
 * chunk — a free slot takes the next item immediately.
 *
 * Failure semantics match the old serial loop: the FIRST error aborts the run
 * (no new items are started) and is rethrown after the in-flight ones settle,
 * so the task fails loudly rather than silently publishing a partial year.
 */
async function runPool(items, limit, fn) {
  const width = Math.max(1, Math.min(limit, items.length));
  let next = 0;
  let firstError = null;

  const runner = async () => {
    while (firstError === null) {
      const i = next++;
      if (i >= items.length) return;
      try {
        await fn(items[i], i);
      } catch (e) {
        if (firstError === null) firstError = e;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: width }, runner));
  if (firstError) throw firstError;
}

// Metric columns actually present on the metrics table. Columns arrive via
// ADD COLUMN IF NOT EXISTS as each metric is computed, so the view can only be
// built after the year loop — and a run where a metric produced nothing still
// yields a valid view.
async function readMetricColumns(dataDb, table_schema, table_name) {
  const { rows } = await dataDb.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [table_schema, table_name]
  );
  const excluded = new Set(['ogc_fid', ...META_COLUMNS]);
  return rows.map((r) => r.column_name).filter((c) => !excluded.has(c));
}

/**
 * The joined view needs a spatial index on the npmrds_meta geometry table or
 * every tile degenerates into a per-row ST_Intersects nested loop (measured
 * 2026-08-07: 255s vs 22ms for one z9 tile). These tables ship WITHOUT one, so
 * create it idempotently. It is additive, ~2MB per year, benefits every other
 * reader of that table (npmrds_meta's own tile views included), and is
 * deliberately NOT `CONCURRENTLY` — that cannot run inside the worker's
 * transaction and the tables are small enough (~50k rows, ~0.2s) not to need it.
 */
async function ensureMetaGeometryIndex(dataDb, { table_schema, table_name }) {
  const idxName = `${table_name}_wkb_geometry_gist`.slice(0, 63);
  await dataDb.query(
    `CREATE INDEX IF NOT EXISTS ${idxName}
     ON ${table_schema}.${table_name} USING GIST (wkb_geometry)`
  );
  return idxName;
}

// Read-modify-write a JSON column (portable across sqlite TEXT / pg JSONB).
async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const cur = rows[0] && rows[0][col];
  const obj = parseJson(cur);
  const next = { ...obj, ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

const PROD_URL = process.env.DAMA_PROD_URL || process.env.PROD_URL || '';

function defaultDeps() {
  return {
    getChDb: require('@availabs/dms-server/src/db').getChDb,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
    ensureSchema: require('@availabs/dms-server/src/dama/upload/metadata').ensureSchema,
    dataDb: null, // physical-table SQL adapter; defaults to ctx.db at run time
  };
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function pm3Publish(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const dataDb = deps.dataDb || db;

    const {
      source_id,
      npmrdsSourceId,
      years,
      customViewAttributes,
      viewMetadata,
      viewDependency,
      percentTmc = 100,
      dates = [],
      user_id,
      email,
      isNewSourceCreate = false,
      skipSpeedPctl = false,
      concurrency = DEFAULT_CONCURRENCY,
      // Opt-in rebuild of the source's `all_years` union view, after the per-year publishes.
      // Default off — see § 4 for why membership is a human decision.
      rebuildUnionView = false,
    } = task.descriptor || {};

    // `view_id` used to mean "append these years to this existing view", re-using one shared metrics
    // table. That mode is GONE (2026-08-24) — see § 2 for the three reasons. A descriptor still
    // carrying it is a caller expecting the old semantics, so refuse loudly rather than silently
    // publish somewhere else. `newVersion` is likewise no longer read: `version` IS the year now.
    if ((task.descriptor || {}).view_id != null) {
      throw new Error(
        'pm3: the append path (descriptor.view_id) was removed — a publish now creates ONE VIEW PER ' +
        'YEAR, each with its own metrics table and `version` set to the 4-digit year. Re-queue without ' +
        'view_id; the new views supersede the old ones, which can then be deleted.'
      );
    }

    // 1 restores the old strictly-serial behavior (useful for golden-diffing).
    const effectiveConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, MAX_CONCURRENCY));

    if (!source_id) throw new Error('source_id is required');
    if (!npmrdsSourceId) throw new Error('npmrdsSourceId is required');
    if (!Array.isArray(years) || years.length === 0) throw new Error('years (non-empty array) is required');

    const areDatesValid = dates.length === 2 && dates[0] !== '' && dates[1] !== '';
    const formattedDates = areDatesValid ? dates.map(formatYyyyMmDd) : [];

    let chDb;
    try {
      chDb = deps.getChDb(pgEnv);
    } catch (e) {
      throw new Error(`pm3 needs ClickHouse on pgEnv ${pgEnv}: ${e.message}`);
    }

    // PERF instrumentation. Before this, a finished run reported only its wall time — which cannot
    // distinguish millions of fast queries from a few slow ones. The cost here is query COUNT: 64
    // binned-data fetches per TMC before the memo, against 29 distinct (stream, bin) triples.
    // Wrapping the client keeps the counters out of every calculator signature.
    const chStats = { queries: 0, ms: 0, retries: 0 };
    const rawChDb = chDb;

    // Transient TRANSPORT failures only. A dropped socket says nothing about the query; a ClickHouse
    // SQL error (syntax, unknown identifier, memory limit) is deterministic and retrying it just
    // burns time before failing anyway, so those are rethrown on the first attempt.
    const isTransient = (e) => {
      const code = e && e.code;
      if (code && ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) return true;
      return /socket hang up|socket disconnected|read ECONNRESET|Connection terminated/i.test((e && e.message) || '');
    };

    // Task 7160 died 1 minute into a 2-year publish on a SINGLE ECONNRESET — one reset in the whole
    // log, no keep-alive warning from the client, just a dropped socket. With ~600k queries per
    // publish and `max_attempts: 1` on route-queued tasks, one transient blip anywhere kills hours of
    // work. That was always true; raising concurrency 8 -> 16 (more sockets, each idling longer
    // against ClickHouse's keep_alive_timeout of 3s) only made it likelier to be drawn.
    //
    // Retries are COUNTED and reported in pm3:FINAL, deliberately: a run that silently retried 40,000
    // times is a broken connection pool, not a healthy run, and the count is the only way to tell it
    // apart from one that retried twice.
    const CH_MAX_ATTEMPTS = 4;
    chDb = {
      ...rawChDb,
      query: async (...args) => {
        const t0 = Date.now();
        try {
          for (let attempt = 1; ; attempt += 1) {
            try {
              return await rawChDb.query(...args);
            } catch (e) {
              if (attempt >= CH_MAX_ATTEMPTS || !isTransient(e)) throw e;
              chStats.retries += 1;
              // 250ms, 1s, 4s — long enough for a keep-alive reset to clear, short enough that a
              // genuinely unreachable server still fails the task within seconds rather than minutes.
              await new Promise((r) => setTimeout(r, 250 * 4 ** (attempt - 1)));
            }
          }
        } finally {
          chStats.queries += 1;
          chStats.ms += Date.now() - t0;
        }
      },
    };

    await dispatchEvent('pm3:INITIAL',
      `pm3 publish started: years=${years.join(',')} — one view per year`, {
      source_id, years,
    });
    await updateProgress(0.02);

    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    // ── 1. Prod NPMRDS source: data table, raw-view→year map, CH meta table ─
    // Resolved BEFORE any pm3 view exists. It supplies the ClickHouse TMC meta table speed_pctl
    // needs and the per-year npmrds_meta layer each year's view joins, and none of it depends on the
    // pm3 view — so a bad prod source fails the task without leaving half-built views behind.
    const { rows: prodViewRows } = await db.query(
      `SELECT * FROM ${viewsTable} WHERE source_id = $1`,
      [npmrdsSourceId]
    );
    if (!prodViewRows[0]) throw new Error(`No prod NPMRDS view found for source_id=${npmrdsSourceId}`);
    const prodView = prodViewRows[0];
    const prodViewMeta = parseJson(prodView.metadata);
    const dataTableName = prodView.table_name;
    const npmrdsRawByYear = prodViewMeta.npmrds_raw_view_id_to_year || {};

    // ClickHouse TMC meta table for speed_pctl (legacy contract: carried on the
    // prod view metadata with a clickhouse. schema prefix).
    const chMetaTableName = (prodViewMeta.table_schema && prodViewMeta.table_name)
      ? `${prodViewMeta.table_schema}.${prodViewMeta.table_name}`.replace(/^clickhouse\./, '')
      : null;

    const { rows: prodSrcRows } = await db.query(
      `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`,
      [npmrdsSourceId]
    );
    const npmrdsMetaLayerByYear = parseJson(prodSrcRows[0] && prodSrcRows[0].metadata).npmrds_meta_layer_view_id || {};

    // The FULL registry defines the SOURCE's column set, and every view of the source must expose
    // exactly it — `metadata.columns` lives on the source, so one list describes every view (see
    // data-types/CLAUDE.md § "ALL VIEWS OF A SOURCE MUST HAVE EXACTLY THE SAME COLUMNS"). Column
    // enumeration is therefore a pure function of the registry: independent of the year, of the run,
    // and of which metrics this run actually computes.
    const metricConfigs = buildMetricConfigs({ chMetaTableName });
    const declaredMetricColumns = pm3MetricColumnNames(metricConfigs);

    // Which metrics this run COMPUTES — a separate question from which columns exist.
    let metricNames = Object.keys(metricConfigs);
    if (!chMetaTableName) {
      // A pm3 year with no speed percentiles is a broken year — live view 3566
      // (2017) is exactly that and silently renders a blank map when the
      // macroview's "Percentile Speed" measure is selected. Fail loudly unless
      // the caller opted out on purpose.
      if (!skipSpeedPctl) {
        throw new Error(
          `pm3: cannot resolve the ClickHouse TMC meta table for speed_pctl — prod view ` +
          `${prodView.view_id} (source ${npmrdsSourceId}) has no metadata.table_schema/table_name. ` +
          `Pass skipSpeedPctl: true to publish the other metrics without it.`
        );
      }
      await dispatchEvent('pm3:WARN',
        'skipSpeedPctl: prod view metadata has no table_schema/table_name — skipping speed_pctl', {});
      // The speed_pctl COLUMNS are still created, all NULL. Dropping them would give this year's
      // view a different column set from every other year's, and because metadata.columns lives on
      // the source the Table page and DataWrapper would still apply the full list to it — rendering
      // columns that silently resolve to nothing, with no error anywhere.
      metricNames = metricNames.filter((n) => n !== 'speed_pctl');
    }
    await updateProgress(0.05);

    // ── 2. ONE VIEW PER YEAR ─────────────────────────────────────────────────
    // A publish of N years produces N views on the source, one per year, each with its OWN metrics
    // table and its `version` set to the 4-digit year.
    //
    // This replaced an APPEND mode — `descriptor.view_id` re-used one view and one shared metrics
    // table, DELETEing the years being reprocessed and re-inserting them. It was removed on
    // 2026-08-24, not deprecated, for three reasons that are all properties of the shape rather than
    // bugs in the implementation:
    //
    //   - VERSION ISOLATION. A source is the unit of schema; a view is the unit of vintage. With one
    //     view per year you can publish a second version of a single year, diff it against the
    //     incumbent, and roll back by repointing a symbology or a page section at the older view.
    //     With a shared table the second attempt overwrites the first in place and there is nothing
    //     left to compare against or return to.
    //   - BLAST RADIUS. Task 7160 died one minute into a two-year publish on a single dropped socket
    //     and left the shared table partially written; recovery was a manual DELETE plus a re-run
    //     over years that had already succeeded. Per-year tables confine a failure to its own year,
    //     and the remedy is to discard that year's view.
    //   - IT WAS ITS OWN BUG CLASS. Both bugs found on 2026-08-24 existed ONLY because of append.
    //     (a) The append branch never merged `metadata.year`, so view 3731 advertised [2024, 2025]
    //     while its table held 2017-2025 — and consumers read `year` to build a year selector, so a
    //     stale list silently hides published years. (b) `npmrds_meta_layer_table` /
    //     `npmrds_meta_layer_view_id` were written as this run's years only, REPLACING the stored
    //     map — and since the joined view is REBUILT from that map, the append after an append would
    //     have dropped the earlier years' UNION branches and silently deleted published years from a
    //     live view. That is latent data loss. Both fixes went with the branch they patched: nothing
    //     merges any more, because a year's view only ever sees its own year.
    //
    // The recovery case append was kept for is dissolved rather than unsupported: a half-written year
    // is simply re-published, which yields a new view, and the dead one is deleted. That is why it is
    // not retained behind an opt-in flag — there is no scenario left that needs it.
    const perYearViews = [];
    const rawViewIdsUsed = [];
    // Ascending, so a multi-year publish assigns view_ids in year order and the union view's members
    // come out chronologically without a sort.
    const sortedYears = [...years].map(Number).sort((a, b) => a - b);

    for (let yi = 0; yi < sortedYears.length; yi++) {
      const year = sortedYears[yi];
      const yearStr = String(year);

      // ── 2a. This year's npmrds_meta layer ─────────────────────────────────
      // Resolved before the view row is created so a missing meta layer costs nothing.
      const metaLayerViewId = npmrdsMetaLayerByYear[year];
      if (!metaLayerViewId) {
        throw new Error(`No npmrds_meta_layer_view_id for year ${year} on prod source ${npmrdsSourceId}`);
      }
      const { rows: metaLayerRows } = await db.query(
        `SELECT table_schema, table_name FROM ${viewsTable} WHERE view_id = $1`,
        [metaLayerViewId]
      );
      if (!metaLayerRows[0]) throw new Error(`No meta-layer view found: view_id=${metaLayerViewId}`);
      const metaLayer = metaLayerRows[0];
      const metaTable = `${metaLayer.table_schema}.${metaLayer.table_name}`;

      // Republishing a year that already has a view is allowed — it IS the point of per-year views —
      // but it is announced, because the two views then carry the same `version` and the macroview's
      // year picker labels its options from `version`. Verify the new one, then repoint consumers at
      // it and delete the superseded view.
      const { rows: priorRows } = await db.query(
        `SELECT view_id FROM ${viewsTable} WHERE source_id = $1 AND version = $2`,
        [source_id, yearStr]
      );
      if (priorRows.length) {
        const priorIds = priorRows.map((r) => r.view_id);
        await dispatchEvent('pm3:WARN',
          `source ${source_id} already has ${priorIds.length} view(s) for ${year} (${priorIds.join(', ')}) — ` +
          `publishing another. Repoint consumers at the new view and delete the superseded one once verified.`,
          { year, existing_view_ids: priorIds });
      }

      // ── 2b. This year's view row ──────────────────────────────────────────
      const damaView = await deps.createDamaView({
        source_id,
        user_id,
        // etl_context_id is deliberately NOT set: data_manager.views has
        // views_etl_ctx_id_fkey → the LEGACY data_manager.etl_contexts table, and
        // a new-runner task_id has no row there, so passing it fails the insert
        // outright on any pgEnv that still has the FK (npmrds2 does). The new-path
        // convention is to carry the task id in metadata instead — see
        // dms-server/src/dama/upload/workers/csv-publish.js:28.
        metadata: {
          ...(customViewAttributes || {}),
          ...(viewMetadata || {}),
          npmrds_prod_source_id: npmrdsSourceId,
          year: [year],
          dates,
          email,
          task_id: task.task_id,
        },
        view_dependencies: viewDependency,
      }, pgEnv);

      // `version` IS the year. That is the convention source 1410's eleven views already use and the
      // one the 2026-08-24 split of source 2135 adopted, and the TransportNY macroview depends on it
      // twice: it labels the year selector from `version` (internalPanel.jsx `view.version ||
      // view.view_id`) and rewrites the tile URL's `&filter=year=` from the selected label
      // (dataUpdate.jsx). A view whose version is anything else drops out of the selector and leaves
      // the tile query filtering on the wrong year — which answers 204 / 0 bytes and makes the whole
      // PM3 network vanish from the map. The old `newVersion` descriptor field is therefore no longer
      // read: a free-text version cannot also be the year label.
      await db.query(`UPDATE ${viewsTable} SET version = $1 WHERE view_id = $2`,
        [yearStr, damaView.view_id]);
      damaView.version = yearStr;

      // Re-point the per-view table at the pm3 schema (createDamaView defaults to gis_datasets) and
      // put the year in the table name. createDamaView derives the name from the SOURCE name, which
      // is identical for every view of the source, so without the year suffix nine years of tables
      // differ only by view id — unreadable at a psql prompt. Capped so `<name>_metrics` still fits
      // Postgres's 63-character identifier limit.
      await deps.ensureSchema(dataDb, 'pm3');
      const table_schema = 'pm3';
      const table_name = yearTableName(damaView.table_name, year);
      const metricsTable = metricsTableName(table_name);
      await db.query(
        `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
        [table_schema, table_name, `${table_schema}.${table_name}`, damaView.view_id]
      );
      damaView.table_schema = table_schema;
      damaView.table_name = table_name;
      damaView.data_table = `${table_schema}.${table_name}`;

      await dispatchEvent('pm3:VIEW_READY', `created view ${damaView.view_id} for ${year}`,
        { view_id: damaView.view_id, version: yearStr, year, table: `${table_schema}.${table_name}` });

      // ── 2c. This year's metrics table: join key + UNIQUE(tmc, year) ───────
      // Metrics only. Geometry and the other 23 TMC attributes are NOT copied here — they come from
      // the year's npmrds_meta geometry table through the view built in 2f, so there is exactly one
      // copy of the network per year in the database instead of one per pm3 view.
      await createDataTable({ db: dataDb, table_schema, table_name: metricsTable, columns: false });
      await dataDb.query(buildAddMetaColumnsSql({ table_schema, table_name: metricsTable }));

      // No try/catch any more: the table is brand new (its name carries this run's view_id), so a
      // duplicate-constraint error is impossible and anything that DOES fail here is real. The
      // swallow existed only because append re-added the constraint to a shared table.
      const constraintName = `tmc_year_${damaView.view_id}_constraint`;
      await dataDb.query(`
        ALTER TABLE
          ${table_schema}.${metricsTable}
        ADD CONSTRAINT ${constraintName} UNIQUE(tmc, year)
      `);

      // ── 2d. Per-TMC / per-metric processing ───────────────────────────────
      const yearRawViewIds = Object.keys(npmrdsRawByYear).filter(
        (rViewId) => String(npmrdsRawByYear[rViewId]) === yearStr
      );
      rawViewIdsUsed.push(...yearRawViewIds);

      // The view's tiles are unusable without this (see ensureMetaGeometryIndex).
      if (dataDb.type === 'postgres') {
        const idxName = await ensureMetaGeometryIndex(dataDb, metaLayer);
        console.log(`[pm3] meta geometry index ensured: ${metaLayer.table_schema}.${idxName}`);
      }

      const tmcResp = await getListTmcId({
        chDb,
        dataTableName: `${NPMRDS_CH_SCHEMA_NAME}.${dataTableName}`,
        year,
      });
      const allTmcIds = (tmcResp?.data || []).map((r) => r.tmc);
      const numTmcToProcess = Math.floor((allTmcIds.length * percentTmc) / 100);
      const everyN = Math.max(1, Math.floor(numTmcToProcess / 25));

      await dispatchEvent('pm3:start', `year=${year} tmcs=${numTmcToProcess}/${allTmcIds.length}`, {
        etl_context_id: task.task_id,
        damaSourceId: source_id,
        damaViewId: damaView.view_id,
        npmrds_prod_source_id: npmrdsSourceId,
        year,
      });

      // ── Column creation, hoisted out of the per-TMC loop ──────────────────
      // Every metric column is enumerable from the registry, so create them all
      // once instead of issuing an `ADD COLUMN IF NOT EXISTS` per metric per TMC
      // (~570k statements for a full year). This is not just a saving: ALTER
      // TABLE takes an ACCESS EXCLUSIVE lock, so under concurrency the per-TMC
      // ALTERs would serialize the whole pool behind a lock convoy.
      //
      // It creates the DECLARED set, not the computed one, so the table's column list is the same
      // for every year of every run — the physical half of the identical-columns invariant.
      if (dataDb.type === 'postgres') {
        await dataDb.query(`
          ALTER TABLE ${table_schema}.${metricsTable}
          ${declaredMetricColumns.map((c) => `ADD COLUMN IF NOT EXISTS "${c}" NUMERIC`).join(',')}
        `);
        console.log(`[pm3] pre-created ${declaredMetricColumns.length} metric columns`);
      }

      let processed = 0;
      let skipped = 0;

      // One TMC's full per-metric pass. `allowAlter` is true only for the serial
      // warm-up TMC: it keeps the legacy per-metric ADD COLUMN path as a safety
      // net so a calculator key that the registry does NOT enumerate still gets
      // a column before the concurrent phase starts (where ALTERs are unsafe).
      // Such a column is written but NOT exposed by the view — see 2f.
      const processTmc = async (curTmcId, { allowAlter = false } = {}) => {
        const tmcMetaQuery = generateTmcIdMetaQuery({
          metaTName: `${metaLayer.table_schema}.${metaLayer.table_name}`,
          dataKeys: TMC_META_DATA_KEYS,
          tmc: curTmcId,
        });
        const { rows: tmcMetaRows } = await dataDb.query(tmcMetaQuery);
        const tmcMeta = tmcMetaRows[0];

        if (!checkMeta({ tmcMeta })) {
          console.log(`[pm3] no meta row for tmc ${curTmcId}, skipping`);
          skipped++;
          return;
        }

        // Seed the join-key row so the per-metric upserts have something to
        // conflict against. The 23 attribute columns this used to copy (and the
        // geometry) now come from the view — `tmcMeta` is still read in full
        // because the CALCULATORS need avg_speedlimit / AADT / AVO /
        // functionalclass / congestion_level / directionality / nhs_pct.
        await dataDb.query(
          `INSERT INTO ${table_schema}.${metricsTable} (tmc, year) VALUES ($1, $2)
           ON CONFLICT ON CONSTRAINT ${constraintName} DO NOTHING`,
          [curTmcId, tmcMeta.year]
        );

        // R2 perf — one p15 derivation per (TMC, reference window) instead of one per metric.
        //
        // calcFreeflowBaseThresholdSpeed hardcodes ALL_VEHICLES for the percentile regardless of
        // which stream the MEASURE reads, so all four metrics sharing a thresholdSpeedVersion
        // compute the identical value — including the truck ones. That was already 4 duplicate
        // queries per TMC before R2; adding the anchored variants took it to 8 queries for 2
        // distinct values. Across 52,127 TMCs that is 417,016 full-year single-TMC scans per
        // publish where 104,254 suffice.
        //
        // Scoped per TMC deliberately rather than module-level: it is bounded by construction (at
        // most one entry per reference window), needs no eviction, and cannot leak across TMCs,
        // years or runs.
        const freeflowP15Cache = new Map();

        // PERF — one binned-data fetch per (stream, bin) triple per TMC instead of one per metric.
        // Measured 64 fetches per TMC against 29 distinct triples: 55% redundant, because the delay
        // variants differ only in threshold, tttr/tttr_p80 are identical fetches, and coverage re-reads
        // what the measures already pulled. Same per-TMC scoping as freeflowP15Cache above, so it is
        // bounded and cannot leak between TMCs. Rows are shared, so callers MUST treat them as
        // immutable — see the note in getBinnedYearNpmrdsDataForTmc.
        const binnedDataCache = new Map();

        const commonMetricConfig = {
          db: dataDb, chDb, pgEnv,
          freeflowP15Cache,
          binnedDataCache,
          curTmcId,
          damaSourceId: source_id,
          viewId: damaView.view_id,
          year,
          dates: formattedDates,
          user_id, email,
          table_name: metricsTable, table_schema,
          dataTableName,
          etl_context_id: task.task_id,
          tmcMeta,
          // legacy flags carried for any code path that reads them
          pm3Config: { METRIC_WRITES_DB: true, WRITE_TO_CSV: false, COMPARE_AGAINST_HISTORIC: false, ANALYSIS: false, LOWER_CASE_COLUMNS: true },
          dataTableConstraint: `ON CONSTRAINT ${constraintName}`,
        };

        for (const metricName of metricNames) {
          const result = await metricConfigs[metricName].calculator({
            ...commonMetricConfig,
            ...metricConfigs[metricName],
            metricName,
          });
          if (!result) continue; // calcPhed returns undefined on missing meta fields

          // Per-metric write (METRIC_WRITES_DB=true): lowercase, prefix, upsert.
          const dbRow = toMetricDbRow(result);
          if (allowAlter) {
            await dataDb.query(generateUpdateColumnsSql({
              tmcRow: { ...dbRow, year },
              metricName, table_schema, table_name: metricsTable,
            }));
          }
          try {
            await dataDb.query(getDataRowInsertSql({
              result: { ...dbRow, year },
              table_schema, table_name: metricsTable,
              prefix: metricName,
              constraint: `ON CONSTRAINT ${constraintName}`,
            }));
          } catch (e) {
            console.error(`[pm3] ${metricName} insert failed tmc=${curTmcId}: ${e.message}`);
          }
        }
        processed++;
      };

      const reportProgress = async (doneCount) => {
        const pct = Math.floor((doneCount / numTmcToProcess) * 100);
        await dispatchEvent('pm3:progress', `year=${year} ${pct}%`, {
          etl_context_id: task.task_id,
          damaSourceId: source_id,
          damaViewId: damaView.view_id,
          data: { progress: pct, year },
        });
        const yearProgress = (yi + (doneCount / numTmcToProcess)) / sortedYears.length;
        await updateProgress(0.05 + 0.85 * yearProgress);
      };

      const tmcIds = allTmcIds.slice(0, numTmcToProcess);
      if (tmcIds.length) {
        // Serial warm-up: proves the metric-column set is complete before any
        // concurrency starts.
        await processTmc(tmcIds[0], { allowAlter: true });
        await reportProgress(1);

        // The remainder in a bounded pool. Each TMC's queries are independent
        // (its own upserts against UNIQUE(tmc, year)), so the only shared state
        // is the connection pool — hence the cap. `pg` defaults to max 10
        // connections per pool, so keep concurrency below that.
        await runPool(tmcIds.slice(1), effectiveConcurrency, async (tmcId, idx) => {
          await processTmc(tmcId);
          const doneCount = idx + 2;
          if (doneCount % everyN === 0) await reportProgress(doneCount);
        });
      }
      await reportProgress(numTmcToProcess);
      console.log(
        `[pm3] year=${year} processed ${processed} TMCs, skipped ${skipped} ` +
        `(of ${numTmcToProcess} requested / ${allTmcIds.length} total), concurrency=${effectiveConcurrency}, ` +
        `ch_queries=${chStats.queries} (${processed ? (chStats.queries / processed).toFixed(1) : 0}/TMC), ` +
        `ch_wait=${(chStats.ms / 1000).toFixed(0)}s, ch_retries=${chStats.retries}`
      );

      // ── 2e. Sanity: the metrics table must carry every declared column ────
      // The view is built over the DECLARED list, so a declared column that does not physically
      // exist would make the CREATE VIEW fail with a bare "column does not exist" after hours of
      // compute. Check it here, name the columns, and say why.
      //
      // information_schema is read for VERIFICATION ONLY — never to derive the view's column order.
      // Deriving it from the table would also pick up whatever the warm-up TMC's safety-net ALTER
      // happened to add for a calculator key the registry does not enumerate, which would appear on
      // one year's view and not another's. That is precisely the drift the source-level
      // metadata.columns cannot survive.
      if (dataDb.type === 'postgres') {
        const present = new Set(await readMetricColumns(dataDb, table_schema, metricsTable));
        const missing = declaredMetricColumns.filter((c) => !present.has(c));
        if (missing.length) {
          throw new Error(
            `pm3: ${table_schema}.${metricsTable} is missing ${missing.length} of ${declaredMetricColumns.length} ` +
            `declared metric columns (e.g. ${missing.slice(0, 5).join(', ')}) — the bulk pre-create did not run, ` +
            `and building the view over columns that do not exist would fail with a bare Postgres error`
          );
        }
        const declaredSet = new Set(declaredMetricColumns);
        const undeclared = [...present].filter((c) => !declaredSet.has(c));
        if (undeclared.length) {
          // Not fatal: the column is stored, just not exposed. Exposing it would break the
          // identical-columns invariant, since the next year's warm-up TMC may not produce it.
          console.log(
            `[pm3] ${undeclared.length} column(s) on ${metricsTable} are not in the metric registry ` +
            `and are NOT exposed by the view: ${undeclared.join(', ')}`
          );
        }
      }

      // ── 2f. The metrics ⋈ geometry view registered as views.table_name ────
      // One year, so ONE branch — the UNION-per-year machinery in buildPm3ViewSql is still used
      // (unchanged, and the union view in § 4 needs it to stay that way) but it is handed a
      // single-entry map. DROP then CREATE rather than CREATE OR REPLACE: the relation is new here,
      // and a republish of the same view would change the column list if the registry has grown.
      //
      // Anything that resolves the view through views.table_name — tiles, colorDomain, the UDA
      // table/filters, gis-dataset/create-download, the macroview plugin — sees the same relation
      // shape it always did.
      if (dataDb.type === 'postgres') {
        await dataDb.query(`DROP VIEW IF EXISTS ${table_schema}.${table_name}`);
        await dataDb.query(buildPm3ViewSql({
          viewName: `${table_schema}.${table_name}`,
          metricsTable: `${table_schema}.${metricsTable}`,
          metaTableByYear: { [year]: metaTable },
          metricColumns: declaredMetricColumns,
        }));
        await dispatchEvent('pm3:VIEW_BUILT',
          `built ${table_schema}.${table_name} over ${declaredMetricColumns.length} metric columns`,
          { view_id: damaView.view_id, year, metricColumns: declaredMetricColumns.length });
      }

      // ── 2g. Tiles metadata + provenance, on THIS year's view ──────────────
      const layerName = `s${source_id}_v${damaView.view_id}`;
      const timestamp = new Date().getTime();
      const tilesetName = `${pgEnv}_${layerName}_${year}_${timestamp}`;
      const tiles = {
        sources: [
          {
            id: tilesetName,
            source: {
              tiles: [
                `${PROD_URL}/dama-admin/${pgEnv}/tiles/${damaView.view_id}/{z}/{x}/{y}/t.pbf?cols=tmc&filter=year=${year}`,
              ],
              format: 'pbf',
              type: 'vector',
            },
          },
        ],
        layers: [
          {
            id: `s${source_id}_v${damaView.view_id}_tMultiLineString`,
            type: 'line',
            paint: { 'line-color': 'black', 'line-width': 1 },
            source: tilesetName,
            'source-layer': `view_${damaView.view_id}`,
          },
        ],
      };

      // No GIST index here any more — the geometry lives on the npmrds_meta
      // table, and its index is ensured per year in the loop above.
      await mergeJsonColumn(db, viewsTable, 'view_id', damaView.view_id, 'metadata', {
        tiles,
        rawViewIdsUsed: yearRawViewIds,
        // Provenance for the view's join, and what a rebuild reads. Single-entry maps, because a
        // view is one year. The shape is kept as a map rather than a scalar so buildPm3ViewSql and
        // every reader of `npmrds_meta_layer_table` keep working unchanged — and because the union
        // view legitimately spans years. Nothing MERGES into these any more, which is what removed
        // the append path's silent-truncation bug.
        npmrds_meta_layer_view_id: { [year]: metaLayerViewId },
        npmrds_meta_layer_table: { [year]: metaTable },
        pm3_metrics_table: `${table_schema}.${metricsTable}`,
      });

      perYearViews.push({
        year,
        view_id: damaView.view_id,
        version: yearStr,
        table: `${table_schema}.${table_name}`,
        metrics_table: `${table_schema}.${metricsTable}`,
      });
    }
    await updateProgress(0.92);

    // ── 3. Source metadata.columns (lowercase pm3 descriptors) ──────────────
    // Guarded: keeps a hand-edited column list (see data-types/CLAUDE.md). Written once for the
    // source, never per view — that is the whole reason every view must expose the same columns.
    const { rows: srcMetaRows } = await db.query(
      `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`, [source_id]
    );
    const existingSrcMeta = parseJson(srcMetaRows[0] && srcMetaRows[0].metadata);
    if (!Array.isArray(existingSrcMeta.columns) || existingSrcMeta.columns.length === 0) {
      await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
        columns: PM3_SOURCE_COLUMNS,
        schema: 'pm3_v1',
      });
    }

    // ── 4. `all_years` union view — OPT-IN ──────────────────────────────────
    // `SELECT * FROM <each per-year view> UNION ALL …`, registered as its own view on the source with
    // `version = 'all_years'`. It is what a cross-year trend reads; its members are snapshots.
    //
    // Opt-in rather than automatic, because the one thing a runner cannot derive is MEMBERSHIP.
    // Per-year views make republishing a year normal, so "which 2025?" becomes a real question, and
    // the wrong answer silently repoints a published trend series onto an experimental view. That is
    // a decision, so it takes an explicit `rebuildUnionView: true` in the descriptor.
    //
    // What the flag does NOT do is leave the union to drift once taken: it rebuilds from scratch over
    // the CURRENT set of per-year views, so adding 2026 to the source updates the trend relation in
    // the same run that publishes it, and it REUSES the existing `all_years` view row so the union's
    // view_id is stable and nothing downstream has to be repointed.
    //
    // No tiles metadata on the union, deliberately: nine years of the same TMC would draw nine
    // stacked lines, and the map is per-year by construction (each per-year view's tile URL carries
    // its own `filter=year=`). The union is for tabular and trend reads.
    let unionViewId = null;
    if (rebuildUnionView) {
      unionViewId = await rebuildUnionViewForSource({
        db, dataDb, deps, pgEnv, viewsTable, source_id, dispatchEvent,
        declaredColumns: pm3ViewColumnNames({ metricColumns: declaredMetricColumns }),
        user_id, task,
      });
    }

    // ── 5. Legacy source-metadata stored proc (new sources only) ────────────
    // Run once, against the first year's view — the proc reads one view to describe the source.
    if (isNewSourceCreate && perYearViews.length) {
      const firstViewId = perYearViews[0].view_id;
      try {
        await db.query(
          `CALL _data_manager_admin.initialize_dama_src_metadata_using_view($1)`,
          [firstViewId]
        );
        await dispatchEvent('pm3:CREATE_META', 'Source metadata initialized', { view_id: firstViewId });
      } catch (e) {
        // Legacy swallowed this — keep that so missing proc deployments don't
        // fail the publish.
        console.error(`[pm3] initialize_dama_src_metadata_using_view failed: ${e.message}`);
      }
    }

    await updateProgress(1);

    const result = {
      source_id,
      // `views` is the real answer now. `view_id`/`table`/`metrics_table` name the FIRST (earliest)
      // year's view so the single-year publish — the common case, and the only one the client's
      // Create page issues — returns exactly the shape it always did.
      view_id: perYearViews[0] && perYearViews[0].view_id,
      table: perYearViews[0] && perYearViews[0].table,
      metrics_table: perYearViews[0] && perYearViews[0].metrics_table,
      views: perYearViews,
      view_ids: perYearViews.map((v) => v.view_id),
      union_view_id: unionViewId,
      years: sortedYears,
    };
    await dispatchEvent('pm3:FINAL',
      `pm3 done — ${perYearViews.length} view(s), one per year: ` +
      `${perYearViews.map((v) => `${v.year}=${v.view_id}`).join(' ')} — ` +
      `${chStats.queries} ClickHouse queries, ${(chStats.ms / 1000).toFixed(0)}s in query wait, ${chStats.retries} transient retries`, {
      chQueries: chStats.queries,
      chQueryWaitSeconds: Math.round(chStats.ms / 1000),
      chTransientRetries: chStats.retries,
      etl_context_id: task.task_id,
      damaSourceId: source_id,
      damaViewId: perYearViews[0] && perYearViews[0].view_id,
      ...result,
    });
    return result;
  };
}

// ── The `all_years` union view ───────────────────────────────────────────────
// Declared after makeWorker (hoisted, so order does not matter at run time) because the per-year
// publish is the main story and this is the cross-year aggregate built on top of it.

/**
 * Read a relation's columns in ordinal order.
 *
 * Used to PROVE that the union view's members are column-identical before a positional UNION ALL is
 * built over them. Distinct from readMetricColumns, which strips the join key and the meta columns
 * because it is describing a metrics TABLE; this describes a whole published relation.
 */
async function readRelationColumns(dataDb, table_schema, table_name) {
  const { rows } = await dataDb.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [table_schema, table_name]
  );
  return rows.map((r) => r.column_name);
}

/**
 * Membership for the `all_years` union view: one view per year — the NEWEST (highest view_id) of the
 * views whose `version` is a bare 4-digit year — in ascending year order.
 *
 * Pure and exported so the rule is testable without a database. Two properties carry the weight:
 *   - the 4-digit filter is what excludes non-year views AUTOMATICALLY: the union view itself
 *     (`all_years`), and the legacy multi-year views whose version is empty (view 3731 on source
 *     2135, redundant since the 2026-08-24 split). Nothing has to be listed by hand.
 *   - "highest view_id wins" is what makes a republished year supersede its predecessor, which is
 *     what an operator wants immediately after a republish. It is recorded as `union_of_view_ids` on
 *     the union view so the choice is auditable rather than implied.
 */
function pickUnionMemberViews(viewRows) {
  const byYear = new Map();
  for (const v of viewRows || []) {
    if (!/^\d{4}$/.test(String(v.version == null ? '' : v.version))) continue;
    const year = Number(v.version);
    const prev = byYear.get(year);
    if (!prev || Number(v.view_id) > Number(prev.view_id)) byYear.set(year, v);
  }
  return [...byYear.keys()].sort((a, b) => a - b).map((y) => byYear.get(y));
}

/**
 * Rebuild the source's `all_years` union view over the current set of per-year views.
 *
 * Rebuilt, not incrementally patched: the union's column list changes whenever the registry grows and
 * its branch list changes whenever a year is added or republished, so DROP + CREATE is the only
 * correct move. The view ROW is REUSED when one already exists, which is the point — the union's
 * view_id is what pages and symbologies bind to, so it must survive every rebuild.
 */
async function rebuildUnionViewForSource({
  db, dataDb, deps, pgEnv, viewsTable, source_id, dispatchEvent, declaredColumns, user_id, task,
}) {
  const { rows: allViews } = await db.query(
    `SELECT view_id, version, table_schema, table_name FROM ${viewsTable} WHERE source_id = $1`,
    [source_id]
  );
  const members = pickUnionMemberViews(allViews);
  if (!members.length) {
    await dispatchEvent('pm3:WARN',
      `rebuildUnionView: source ${source_id} has no per-year views — nothing to union`, {});
    return null;
  }

  // Column identity, PROVEN not assumed — see buildPm3UnionViewSql for why Postgres cannot catch a
  // same-types-different-order union. A member that disagrees with the declared list means the SOURCE
  // already violates the one-schema invariant, and the fix for that is a new source, not a looser
  // union (data-types/CLAUDE.md § "ALL VIEWS OF A SOURCE MUST HAVE EXACTLY THE SAME COLUMNS").
  if (dataDb.type === 'postgres') {
    for (const m of members) {
      const cols = await readRelationColumns(dataDb, m.table_schema, m.table_name);
      const at = cols.length === declaredColumns.length
        ? cols.findIndex((c, i) => c !== declaredColumns[i])
        : Math.min(cols.length, declaredColumns.length);
      if (cols.length !== declaredColumns.length || at !== -1) {
        throw new Error(
          `pm3: refusing to build the union view — view ${m.view_id} (${m.table_schema}.${m.table_name}, ` +
          `version ${m.version}) exposes ${cols.length} columns against the source's declared ` +
          `${declaredColumns.length}, first difference at position ${at} ` +
          `(has "${cols[at]}", expected "${declaredColumns[at]}"). All views of a source must have ` +
          `exactly the same columns; a changed column set needs a NEW SOURCE, not a new view.`
        );
      }
    }
  }

  // Reuse the existing `all_years` row so the union's view_id is stable across rebuilds.
  let unionView = (allViews || []).find((v) => String(v.version == null ? '' : v.version) === UNION_VERSION);
  if (!unionView) {
    const created = await deps.createDamaView({
      source_id,
      user_id,
      metadata: { task_id: task.task_id },
    }, pgEnv);
    await deps.ensureSchema(dataDb, 'pm3');
    const table_name = unionTableName(created.table_name);
    await db.query(
      `UPDATE ${viewsTable} SET version = $1, table_schema = $2, table_name = $3, data_table = $4
       WHERE view_id = $5`,
      [UNION_VERSION, 'pm3', table_name, `pm3.${table_name}`, created.view_id]
    );
    unionView = { view_id: created.view_id, version: UNION_VERSION, table_schema: 'pm3', table_name };
  }

  const target = `${unionView.table_schema}.${unionView.table_name}`;
  if (dataDb.type === 'postgres') {
    await dataDb.query(`DROP VIEW IF EXISTS ${target}`);
    await dataDb.query(buildPm3UnionViewSql({
      viewName: target,
      memberTables: members.map((m) => `${m.table_schema}.${m.table_name}`),
    }));
  }

  await mergeJsonColumn(db, viewsTable, 'view_id', unionView.view_id, 'metadata', {
    year: members.map((m) => Number(m.version)),
    union_of_view_ids: members.map((m) => m.view_id),
    rebuilt_by_task_id: task.task_id,
    note: 'Union of one view per year on this source, for cross-year analysis. Same columns as its '
      + 'members (required — all views of a source share one metadata.columns). Rows span years, '
      + 'unlike its members: read it for trends, not as a snapshot. Rebuilt by the pm3 runner when a '
      + 'publish passes rebuildUnionView; membership is the newest view per year.',
  });

  await dispatchEvent('pm3:UNION_VIEW_BUILT',
    `rebuilt ${target} over ${members.length} per-year view(s): ${members.map((m) => `${m.version}=${m.view_id}`).join(' ')}`,
    { view_id: unionView.view_id, union_of_view_ids: members.map((m) => m.view_id) });

  return unionView.view_id;
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
module.exports.checkMeta = checkMeta;
module.exports.buildMetricConfigs = buildMetricConfigs;
module.exports.METRIC_NAMES = METRIC_NAMES;
module.exports.PM3_SOURCE_COLUMNS = PM3_SOURCE_COLUMNS;
module.exports.buildPm3SourceColumns = buildPm3SourceColumns;
module.exports.metricColumnDescriptors = metricColumnDescriptors;
module.exports.metricsTableName = metricsTableName;
module.exports.pm3MetricColumnNames = pm3MetricColumnNames;
module.exports.yearTableName = yearTableName;
module.exports.unionTableName = unionTableName;
module.exports.pickUnionMemberViews = pickUnionMemberViews;
module.exports.UNION_VERSION = UNION_VERSION;
module.exports.runPool = runPool;
module.exports.DEFAULT_CONCURRENCY = DEFAULT_CONCURRENCY;
module.exports.MAX_CONCURRENCY = MAX_CONCURRENCY;
module.exports.TMC_META_DATA_KEYS = TMC_META_DATA_KEYS;
