import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import vocabulary from '../MeasurePicker/vocabulary.json';

// The TMC identification source (source 455 / view 3464, "NPMRDS TMC Identification V5/V6" —
// see MeasurePicker/README.md's TMC_IDENTIFICATION_JOIN entry) carries a `miles` column per TMC
// code. This is the same source composeMeasureConfig.js already reads for speed-from-travel-time
// math, reused here as a plain lookup rather than wired into a graph's join.
const TMC_SOURCE_INFO = vocabulary.joins.TMC_IDENTIFICATION_JOIN.sourceInfo;

// One batched query for the UNION of TMCs across every route in a report, not one query per
// route — routes commonly share TMCs (e.g. a "before"/"after" pair over the same segments), and
// query cost scales with distinct TMCs, not routes. Returns Map<tmc, milesNumber>; a TMC missing
// from the source (shouldn't happen, but the catalog is hand-maintained) is simply absent from
// the map rather than defaulting to 0 here — callers decide how to treat a miss.
export async function fetchTmcMiles({ apiLoad, tmcs }) {
  if (!tmcs?.length) return new Map();

  const columns = TMC_SOURCE_INFO.columns
    .filter((c) => c.name === 'tmc' || c.name === 'miles')
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
          fromIndex: 0,
          toIndex: Math.max(0, tmcs.length - 1),
          options: JSON.stringify(udaConfig.options),
          attributes: udaConfig.attributes,
        },
        params: {},
      },
    ],
  };

  const data = await apiLoad(config, '/');
  const milesByTmc = new Map();
  (data || []).forEach((rawRow) => {
    const row = udaConfig.columnsToFetch.reduce((acc, col) => {
      const v = rawRow[col.reqName];
      acc[col.name] = v && typeof v === 'object' && '$type' in v ? v.value : v;
      return acc;
    }, {});
    if (row.tmc != null) milesByTmc.set(row.tmc, parseFloat(row.miles) || 0);
  });
  return milesByTmc;
}
