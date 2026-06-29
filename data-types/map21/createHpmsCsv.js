/**
 * HPMS Travel Time Metric submittal writer (2023 draft spec).
 *
 * Replaces the legacy 2018-spec createPm3Output.createFhwaCsvRows. Reads the
 * worker's in-memory `results` object ({ tmcId: { meta, lottr, tttr, phed } })
 * and emits a pipe-delimited CSV that conforms to HEADERS in
 * hpms-spec-2023.js. Validation is a separate step (validate.js) — this
 * writer does not validate.
 */

const { HEADERS, DELIMITER } = require('./hpms-spec-2023.js');

// Internal worker key → HPMS 2023 column name. Internal keys come from the
// metric calculator results (LOTTR/TTTR per bin) and tmcMeta.
const INTERNAL_TO_HPMS = {
  // Meta-derived
  active_start_date:     'datayear',          // overridden below — we use the year explicitly
  state_code:            'stateid',
  tmc:                   'traveltimecode',
  f_system:              'fsystem',
  urban_code:            'urbanid',
  faciltype:             'facilitytype',
  nhs:                   'nhs',
  miles:                 'segmentlength',
  direction:             'directionality',
  directionalaadt:       'diraadt',
  avg_vehicle_occupancy: 'occfac',

  // LOTTR
  AMP_lottr:             'lottramp',
  AMP_lottr_50_PCT:      'ttamp50pct',
  AMP_lottr_80_PCT:      'ttamp80pct',
  MIDD_lottr:            'lottrmidd',
  MIDD_lottr_50_PCT:     'ttmidd50pct',
  MIDD_lottr_80_PCT:     'ttmidd80pct',
  PMP_lottr:             'lottrpmp',
  PMP_lottr_50_PCT:      'ttpmp50pct',
  PMP_lottr_80_PCT:      'ttpmp80pct',
  WE_lottr:              'lottrwe',
  WE_lottr_50_PCT:       'ttwe50pct',
  WE_lottr_80_PCT:       'ttwe80pct',

  // TTTR — internal keys keep WE-then-OVN alpha order, but HEADERS in
  // hpms-spec-2023 dictate the on-disk column order (OVN before WE)
  AMP_tttr:              'tttramp',
  AMP_tttr_50_PCT:       'tttamp50pct',
  AMP_tttr_95_PCT:       'tttamp95pct',
  MIDD_tttr:             'tttrmidd',
  MIDD_tttr_50_PCT:      'tttmidd50pct',
  MIDD_tttr_95_PCT:      'tttmidd95pct',
  PMP_tttr:              'tttrpmp',
  PMP_tttr_50_PCT:       'tttpmp50pct',
  PMP_tttr_95_PCT:       'tttpmp95pct',
  OVN_tttr:              'tttrovn',
  OVN_tttr_50_PCT:       'tttovn50pct',
  OVN_tttr_95_PCT:       'tttovn95pct',
  WE_tttr:               'tttrwe',
  WE_tttr_50_PCT:        'tttwe50pct',
  WE_tttr_95_PCT:        'tttwe95pct',

  // PHED
  all_xdelay_phrs:       'phed',
};

function precisionRound(n, p = 0) {
  if (n === null || !Number.isFinite(+n)) return null;
  const f = 10 ** p;
  return Math.round(+n * f) / f;
}

const FORMATTERS = {
  diraadt:        (v) => precisionRound(v, 0),
  occfac:         (v) => precisionRound(v, 1),
  segmentlength:  (v) => precisionRound(v, 3),
  phed:           (v) => precisionRound(v, 3),
  // 2023 spec: integer 1–5; legacy emit converted N/S/E/W → 1..4 letter codes
  directionality: (v) => {
    if (v == null || v === '') return null;
    const m = { N: 1, S: 2, E: 3, W: 4 };
    if (typeof v === 'string' && m[v] != null) return m[v];
    if (typeof v === 'number' && [1, 2, 3, 4, 5].includes(v)) return v;
    return 5;
  },
};

function formatCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return '';
    return Number.isInteger(val) ? String(val) : String(val);
  }
  const s = String(val);
  // Spec uses pipe delimiter — escape only if a row's value happens to contain one
  return s.includes(DELIMITER) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build one HPMS row from a single TMC's calculator result.
 *
 * `result` shape: { meta: { ...tmcMeta }, lottr: {...}, tttr: {...}, phed: {...} }
 */
function buildRow({ result, datayear, metricsource = 1 }) {
  const out = { datayear, metricsource };
  for (const subKey of ['meta', 'lottr', 'tttr', 'phed']) {
    const sub = result[subKey];
    if (!sub) continue;
    for (const [intKey, val] of Object.entries(sub)) {
      const hpmsKey = INTERNAL_TO_HPMS[intKey];
      if (!hpmsKey) continue;
      const formatted = FORMATTERS[hpmsKey] ? FORMATTERS[hpmsKey](val) : val;
      // Only set if not already present (so meta values don't clobber metric values)
      if (out[hpmsKey] == null) out[hpmsKey] = formatted;
    }
  }
  return out;
}

/**
 * Write the HPMS submittal CSV.
 *
 * @param {Object}  args
 * @param {Object}  args.results       — { tmcId: { meta, lottr, tttr, phed } }
 * @param {number}  args.datayear      — calendar year for `datayear` column
 * @param {Object}  args.storage       — dama storage adapter (.write)
 * @param {string}  args.relativePath  — path under storage root, e.g. 'map21/foo.csv'
 * @param {number}  [args.metricsource=1]
 * @returns {Promise<{ relativePath, rowCount, csv }>}
 */
async function writeHpmsCsv({ results, datayear, storage, relativePath, metricsource = 1 }) {
  if (!datayear) throw new Error('writeHpmsCsv: datayear is required');
  if (!storage)  throw new Error('writeHpmsCsv: storage is required');
  if (!relativePath) throw new Error('writeHpmsCsv: relativePath is required');

  const lines = [HEADERS.join(DELIMITER)];
  let rowCount = 0;
  for (const tmcId of Object.keys(results)) {
    const row = buildRow({ result: results[tmcId], datayear, metricsource });
    lines.push(HEADERS.map((h) => formatCell(row[h])).join(DELIMITER));
    rowCount++;
  }
  const csv = lines.join('\n') + '\n';
  await storage.write(relativePath, Buffer.from(csv, 'utf8'));
  return { relativePath, rowCount, csv };
}

module.exports = { writeHpmsCsv, buildRow, INTERNAL_TO_HPMS };
