/**
 * Single source of truth for the FHWA HPMS Travel Time Metric submittal spec
 * (2023 draft, Chapter 8 / Table 20). Both createHpmsCsv.js (writer) and
 * validate.js (post-publish validator) import from here so the two can never
 * drift.
 *
 * Lifted verbatim from references/hpms/dama/validate-hpms-ttm-2023.cjs.
 * Source: references/hpms/FHWA-2023-0014-0003_attachment_1.pdf
 *
 * Spec deltas vs. 2018 (baked in here):
 *   - All-lowercase column names, no internal underscores
 *   - Truck metric ordering: AMP, MIDD, PMP, OVN, WE  (OVN before WE)
 *   - `comments` column removed
 *   - lottr* percentile size tightened from Numeric(5) → Numeric(4)
 *   - phed required to be > 0 if present (still optional)
 *   - facilitytype expanded to 1–6 (2018 was 1, 2, 6)
 *   - nhs codes 1–9 (no -1)
 *   - metricsource restricted to {1, 2}
 *   - Field separator: pipe `|`
 */

// --- Rule factories ---------------------------------------------------------

function numeric(maxDigits, { min, max, integer = false, exclusiveMin = false } = {}) {
  return (v) => {
    const s = String(v).trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return `not a number: "${v}"`;
    const n = Number(s);
    if (integer && !Number.isInteger(n)) return `must be integer: ${n}`;
    const digitsOnly = s.replace(/[^\d]/g, '');
    if (digitsOnly.length > maxDigits) return `exceeds Numeric(${maxDigits}): ${s} has ${digitsOnly.length} digits`;
    if (exclusiveMin && min !== undefined && !(n > min)) return `must be > ${min}: ${n}`;
    if (!exclusiveMin && min !== undefined && n < min) return `must be >= ${min}: ${n}`;
    if (max !== undefined && n > max) return `must be <= ${max}: ${n}`;
    return null;
  };
}

function decimal(totalDigits, fractionDigits, { min, max, exclusiveMin = false } = {}) {
  const intDigits = totalDigits - fractionDigits;
  return (v) => {
    const s = String(v).trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return `not a number: "${v}"`;
    const n = Number(s);
    const [whole, frac = ''] = s.replace(/^-/, '').split('.');
    if (whole.length > intDigits) return `Decimal(${totalDigits},${fractionDigits}): integer part exceeds ${intDigits} digits: ${s}`;
    if (frac.length > fractionDigits) return `Decimal(${totalDigits},${fractionDigits}): fractional part exceeds ${fractionDigits} digits: ${s}`;
    if (exclusiveMin && min !== undefined && !(n > min)) return `must be > ${min}: ${n}`;
    if (!exclusiveMin && min !== undefined && n < min) return `must be >= ${min}: ${n}`;
    if (max !== undefined && n > max) return `must be <= ${max}: ${n}`;
    return null;
  };
}

function enumNumeric(allowed) {
  const set = new Set(allowed.map(String));
  return (v) => {
    const s = String(v).trim();
    if (!set.has(s)) return `must be one of {${allowed.join(', ')}}: got "${v}"`;
    return null;
  };
}

function varchar(maxLen) {
  return (v) => {
    const s = String(v);
    if (s.length > maxLen) return `VarChar(${maxLen}) exceeded: length ${s.length}`;
    return null;
  };
}

// --- Spec — Table 20 (Travel Time Metrics Dataset, 2023 draft) -------------

const SPEC = [
  { name: 'datayear',       required: true,            rule: numeric(4, { min: 1900, max: 2100, integer: true }) },
  { name: 'stateid',        required: true,            rule: numeric(2, { min: 1, max: 99, integer: true }) },
  { name: 'traveltimecode', required: true,            rule: varchar(50) },
  { name: 'fsystem',        required: true,            rule: enumNumeric([1, 2, 3, 4, 5, 6, 7]) },
  { name: 'urbanid',        required: true,            rule: numeric(5, { min: 0, integer: true }) },
  { name: 'facilitytype',   required: true,            rule: enumNumeric([1, 2, 3, 4, 5, 6]) },
  { name: 'nhs',            required: true,            rule: enumNumeric([1, 2, 3, 4, 5, 6, 7, 8, 9]) },
  { name: 'segmentlength',  required: true,            rule: decimal(8, 3, { min: 0, exclusiveMin: true }) },
  { name: 'directionality', required: true,            rule: enumNumeric([1, 2, 3, 4, 5]) },
  { name: 'diraadt',        required: true,            rule: numeric(6, { min: 0, exclusiveMin: true, integer: true }) },

  { name: 'lottramp',       required: true,            rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'ttamp50pct',     required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'ttamp80pct',     required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'lottrmidd',      required: true,            rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'ttmidd50pct',    required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'ttmidd80pct',    required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'lottrpmp',       required: true,            rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'ttpmp50pct',     required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'ttpmp80pct',     required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'lottrwe',        required: true,            rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'ttwe50pct',      required: true,            rule: numeric(4, { min: 0, integer: true }) },
  { name: 'ttwe80pct',      required: true,            rule: numeric(4, { min: 0, integer: true }) },

  // Truck metrics — Interstate System only; 2023 ordering is OVN before WE
  { name: 'tttramp',        interstateOnly: true,      rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'tttamp50pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttamp95pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttrmidd',       interstateOnly: true,      rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'tttmidd50pct',   interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttmidd95pct',   interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttrpmp',        interstateOnly: true,      rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'tttpmp50pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttpmp95pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttrovn',        interstateOnly: true,      rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'tttovn50pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttovn95pct',    interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttrwe',         interstateOnly: true,      rule: decimal(4, 2, { min: 1.0 }) },
  { name: 'tttwe50pct',     interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },
  { name: 'tttwe95pct',     interstateOnly: true,      rule: numeric(4, { min: 0, integer: true }) },

  { name: 'phed',           required: false,           rule: decimal(13, 3, { min: 0, exclusiveMin: true }) },
  { name: 'occfac',         required: false,           rule: decimal(3, 1, { min: 1.0 }) },
  { name: 'metricsource',   required: true,            rule: enumNumeric([1, 2]) },
];

const HEADERS = SPEC.map((f) => f.name);
const DELIMITER = '|';

function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/[_\s]+/g, '');
}

module.exports = {
  SPEC,
  HEADERS,
  DELIMITER,
  normalizeHeader,
  numeric, decimal, enumNumeric, varchar,
};
