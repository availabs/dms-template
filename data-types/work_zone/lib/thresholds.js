/**
 * work_zone thresholds — the parametric knobs behind every measure.
 *
 * The Subpart J rule lets each state pick its own thresholds, and NYSDOT has
 * not picked them yet (task doc open question 1). So NOTHING in this pipeline
 * hardcodes a number: every stage takes its thresholds from the task
 * descriptor, falls back to the defaults below (the values recommended in
 * reports/workzone_safety/05_recommendation_report.md), and stamps the
 * resolved set onto the output view's metadata — so a report can always say
 * which thresholds produced which numbers.
 *
 * Pure module: no DB, no CH, no network.
 */

/**
 * One spec per threshold. `min`/`max` are sanity rails, not policy — they
 * exist to catch a form typo (350 instead of 35) before a 40-minute run.
 */
const THRESHOLD_SPECS = [
  {
    name: 'speed_threshold_mph',
    default: 35,
    min: 1,
    max: 85,
    unit: 'mph',
    measure: 'M1',
    desc: 'Absolute speed threshold: an epoch counts as an exceedance when the observed speed is below this.',
  },
  {
    name: 'reference_speed_pct',
    default: 60,
    min: 1,
    max: 100,
    unit: '%',
    measure: 'M1',
    desc: 'Relative speed threshold: an epoch counts as an exceedance when the observed speed is below this percent of the TMC reference speed. Reported alongside the absolute threshold, not instead of it.',
  },
  {
    name: 'queue_speed_mph',
    default: 35,
    min: 1,
    max: 85,
    unit: 'mph',
    measure: 'M3',
    desc: 'A TMC is "in queue" for an epoch when its speed is below this. Queue length walks contiguous upstream TMCs that satisfy it.',
  },
  {
    name: 'queue_threshold_mi',
    default: 0.75,
    min: 0.05,
    max: 50,
    unit: 'mi',
    measure: 'M3',
    desc: 'A work zone is flagged for queueing when its queue length exceeds this.',
  },
  {
    name: 'delay_per_veh_min',
    default: 10,
    min: 0.5,
    max: 1440,
    unit: 'min/veh',
    measure: 'M2',
    desc: 'A work zone is flagged for delay when delay per vehicle through the zone exceeds this.',
  },
  {
    name: 'differential_mph',
    default: 15,
    min: 1,
    max: 85,
    unit: 'mph',
    measure: 'M4',
    desc: 'A work zone is flagged for speed differential when the approach-to-zone (or baseline-to-during) speed drop exceeds this.',
  },
];

const THRESHOLD_NAMES = THRESHOLD_SPECS.map((s) => s.name);

const DEFAULT_THRESHOLDS = THRESHOLD_SPECS.reduce((acc, s) => {
  acc[s.name] = s.default;
  return acc;
}, {});

/**
 * Merge a partial override set over the defaults, validating as we go.
 *
 * Overrides arrive from an HTTP body or a schedule descriptor, so numeric
 * strings ('35', '0.75') are accepted and coerced. Unknown keys are a hard
 * error rather than a silent ignore: a misspelled threshold that silently
 * kept its default would publish a view whose metadata claims a threshold
 * that never applied.
 *
 * Every problem is reported at once — one round trip per form submit, not six.
 *
 * @param {object|null} overrides
 * @returns {object} the full, frozen threshold set
 */
function resolveThresholds(overrides) {
  if (overrides === null || overrides === undefined) return Object.freeze({ ...DEFAULT_THRESHOLDS });
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new Error('work_zone thresholds: expected an object of threshold overrides');
  }

  const errors = [];

  for (const key of Object.keys(overrides)) {
    if (!THRESHOLD_NAMES.includes(key)) {
      errors.push(`unknown threshold '${key}' (known: ${THRESHOLD_NAMES.join(', ')})`);
    }
  }

  const resolved = { ...DEFAULT_THRESHOLDS };
  for (const spec of THRESHOLD_SPECS) {
    const raw = overrides[spec.name];
    if (raw === undefined || raw === null || raw === '') continue;

    const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${spec.name} must be a finite number (got ${JSON.stringify(raw)})`);
      continue;
    }
    if (value < spec.min || value > spec.max) {
      errors.push(`${spec.name} must be between ${spec.min} and ${spec.max} ${spec.unit} (got ${value})`);
      continue;
    }
    resolved[spec.name] = value;
  }

  if (errors.length) {
    throw new Error(`work_zone thresholds: ${errors.join('; ')}`);
  }
  return Object.freeze(resolved);
}

/** True when the resolved set is entirely defaults — recorded on view metadata. */
function isDefaultThresholds(thresholds) {
  return THRESHOLD_SPECS.every((s) => thresholds[s.name] === s.default);
}

module.exports = {
  THRESHOLD_SPECS,
  THRESHOLD_NAMES,
  DEFAULT_THRESHOLDS,
  resolveThresholds,
  isDefaultThresholds,
};
