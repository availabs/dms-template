/**
 * Internal-key → data-table-column-name map.
 *
 * The internal keys (left side) come from the metric calculator results
 * (`AMP_lottr`, `AMP_lottr_50_PCT`, `all_xdelay_phrs`, ...). The right side
 * is the column name used in the per-view data table written by helpers.js.
 *
 * These names ALSO happen to match the lowercase 2018 FHWA CSV column names,
 * but the actual HPMS 2023 submittal CSV is emitted by createHpmsCsv.js,
 * which has its own column ordering + its own internal-to-hpms map (OVN
 * before WE for trucks, no `comments`, etc.). This module is only used for
 * building the data table — keep it stable so existing downstream consumers
 * don't break.
 */
const columnToCsvHeaderMapCapitalized = {
  active_start_date: 'BeginDate',
  state_code: 'StateCode',
  tmc: 'TravelTimeCode',
  f_system: 'FSystem',
  urban_code: 'UrbanCode',
  faciltype: 'FacilityType',
  nhs: 'NHS',
  miles: 'SegmentLength',
  direction: 'Directionality',
  directionalaadt: 'DIRAADT',
  avg_vehicle_occupancy: 'OCCFAC',
  AMP_lottr: 'LOTTRAMP',
  AMP_lottr_50_PCT: 'TTAMP50PCT',
  AMP_lottr_80_PCT: 'TTAMP80PCT',
  MIDD_lottr: 'LOTTRMIDD',
  MIDD_lottr_50_PCT: 'TTMIDD50PCT',
  MIDD_lottr_80_PCT: 'TTMIDD80PCT',
  PMP_lottr: 'LOTTRPMP',
  PMP_lottr_50_PCT: 'TTPMP50PCT',
  PMP_lottr_80_PCT: 'TTPMP80PCT',
  WE_lottr: 'LOTTRWE',
  WE_lottr_50_PCT: 'TTWE50PCT',
  WE_lottr_80_PCT: 'TTWE80PCT',
  AMP_tttr: 'TTTRAMP',
  AMP_tttr_50_PCT: 'TTTAMP50PCT',
  AMP_tttr_95_PCT: 'TTTAMP95PCT',
  MIDD_tttr: 'TTTRMIDD',
  MIDD_tttr_50_PCT: 'TTTMIDD50PCT',
  MIDD_tttr_95_PCT: 'TTTMIDD95PCT',
  PMP_tttr: 'TTTRPMP',
  PMP_tttr_50_PCT: 'TTTPMP50PCT',
  PMP_tttr_95_PCT: 'TTTPMP95PCT',
  WE_tttr: 'TTTRWE',
  WE_tttr_50_PCT: 'TTTWE50PCT',
  WE_tttr_95_PCT: 'TTTWE95PCT',
  OVN_tttr: 'TTTROVN',
  OVN_tttr_50_PCT: 'TTTOVN50PCT',
  OVN_tttr_95_PCT: 'TTTOVN95PCT',
  all_xdelay_phrs: 'PHED',
  METRIC_SOURCE: 'MetricSource',
  COMMENTS: 'COMMENTS',
};

const columnToCsvHeaderMap = Object.keys(columnToCsvHeaderMapCapitalized).reduce((acc, k) => {
  acc[k] = columnToCsvHeaderMapCapitalized[k].toLowerCase();
  return acc;
}, {});

module.exports = { columnToCsvHeaderMap };
