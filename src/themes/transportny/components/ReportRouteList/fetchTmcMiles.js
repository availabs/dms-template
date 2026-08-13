import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import vocabulary from '../MeasurePicker/vocabulary.json';

// The TMC metadata source (source 582 / view 983, "NPMRDS_V6_tmc_meta" — see
// MeasurePicker/README.md's META_JOIN entry) carries a `miles` column per
// (tmc, year) — the same source composeMeasureConfig.js's `speed`/`length`/
// `aadt` measures now read (2026-08-12: repointed off the old static,
// year-agnostic "TMC Identification" source, which this file used to read
// too — see dynamic-reports-and-route-tags.md's metadata-unification note.
// META_JOIN is a confirmed strict superset of that old source's columns, and
// Ryan's direction: one canonical metadata table, not two overlapping ones).
// Unlike a report's own dated queries, this lookup has no date context at
// all (used for route-length display while an author is still picking a
// route, before any date range exists) — reused here as a plain lookup
// rather than wired into a graph's join.
const TMC_SOURCE_INFO = vocabulary.joins.META_JOIN.sourceInfo;

// One batched query for the UNION of TMCs across every route in a report, not one query per
// route — routes commonly share TMCs (e.g. a "before"/"after" pair over the same segments), and
// query cost scales with distinct TMCs, not routes.
//
// Returns Map<tmc, Map<year, milesNumber>> — every year on file per TMC, NOT collapsed to a
// single value. META_JOIN is per-(tmc, year), and different routes in the SAME report commonly
// have different years (e.g. annual_average_study's Current Year vs. 3 Years Ago) — a TMC's
// segment length genuinely differs by year (confirmed live: ~96% of TMCs have `miles` that
// changes across years, real network-vintage changes, not rounding noise). Collapsing to one
// "most recent year" value here would silently show the WRONG year's length for any route not
// dated in that most-recent year. The caller (useRouteMileage), which actually knows each
// route's own date, picks the right year per route — see its own `milesForTmcYear` helper.
export async function fetchTmcMiles({ apiLoad, tmcs }) {
  if (!tmcs?.length) return new Map();

  const columns = TMC_SOURCE_INFO.columns
    .filter((c) => c.name === 'tmc' || c.name === 'miles' || c.name === 'year')
    .map((c) => ({ ...c, show: true }));

  const udaConfig = buildUdaConfig({
    externalSource: TMC_SOURCE_INFO,
    columns,
    filters: { op: 'AND', groups: [{ col: 'tmc', op: 'filter', value: tmcs }] },
  });

  const config = {
    format: { ...TMC_SOURCE_INFO },
    children: [
      {
        action: 'uda',
        path: '/',
        filter: {
          // META_JOIN is per-(tmc, year) — a bare tmc filter returns one row per
          // year (11 currently), not one. That's intentional here (see the
          // function-level comment) — every year is kept, not filtered down.
          fromIndex: 0,
          toIndex: Math.max(0, tmcs.length * 11 - 1),
          options: JSON.stringify(udaConfig.options),
          attributes: udaConfig.attributes,
        },
        params: {},
      },
    ],
  };

  const data = await apiLoad(config, '/');
  const milesByTmcYear = new Map();
  (data || []).forEach((rawRow) => {
    const row = udaConfig.columnsToFetch.reduce((acc, col) => {
      const v = rawRow[col.reqName];
      acc[col.name] = v && typeof v === 'object' && '$type' in v ? v.value : v;
      return acc;
    }, {});
    if (row.tmc == null) return;
    const year = parseInt(row.year, 10);
    if (!Number.isFinite(year)) return;
    if (!milesByTmcYear.has(row.tmc)) milesByTmcYear.set(row.tmc, new Map());
    milesByTmcYear.get(row.tmc).set(year, parseFloat(row.miles) || 0);
  });
  return milesByTmcYear;
}
