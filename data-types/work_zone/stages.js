/**
 * work_zone stage registry — the pipeline, declared.
 *
 * The plugin is one POST /publish route with a `stage` selector rather than
 * fourteen routes, because every stage takes the same shape of request (a
 * window, a set of upstream source ids, a threshold set) and the pipeline is
 * built one stage per phase. This table is the single place that knows:
 *
 *   - which stages exist, and which build phase each belongs to
 *   - the worker each queues, and the DAMA source type it produces
 *   - which upstream source ids its descriptor needs
 *   - whether it is windowed (start_date/end_date) or file-driven
 *
 * The route reads it to validate a request; GET /stages serves it to the
 * Create page so the form is generated from it; the README documents it.
 *
 * A stage becomes runnable when its worker lands in index.js's `workers` map —
 * `workerPath` here is a declaration, the map is the truth. Until then
 * POST /publish 400s with the phase that will deliver it, instead of queueing
 * a task no worker can pick up.
 *
 * Pure data: no DB, no requires.
 */

/**
 * `inputs` name descriptor fields that must resolve to an existing DAMA
 * source. Per the design rules, upstream data is addressed by source id
 * passed in the descriptor (with a resolver that walks to the right view at
 * run time) — never by a hardcoded view id.
 */
const STAGES = {
  spine: {
    phase: 1,
    label: 'Work-zone spine (TRANSCOM events → wz_event + wz_event_tmc)',
    workerPath: 'work_zone/spine',
    sourceType: 'wz_event',
    alsoProduces: ['wz_event_tmc'],
    requiresWindow: true,
    writesMeasures: [],
    inputs: ['transcom_source_id', 'npmrds_meta_source_id'],
    optionalInputs: ['transcom_event_tmc_source_id'],
    desc: 'Filters TRANSCOM to the NY work-zone family, collapses recurring chains, resolves each event to a TMC extent, and tags significant candidates.',
  },
  exposure: {
    phase: 2,
    label: 'Exposure (E1–E3: lane-mile-hours, VMT through zone)',
    workerPath: 'work_zone/exposure',
    sourceType: 'wz_exposure',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['E1', 'E2', 'E3'],
    // No map21_source_id: the plan assumed the hourly volume profiles were a
    // DAMA source, but they are static files in the repo
    // (map21/static/CATTLabTrafficDistributionProfiles.js and the day-of-week /
    // month adjustment factors), required directly by lib/exposure.js. The
    // npmrds_meta source supplies AADT, length and the attributes that select
    // a profile. The wz_event_tmc source is normally read from the wz_event
    // source's metadata and only needs passing when that link is absent.
    inputs: ['wz_event_source_id', 'npmrds_meta_source_id'],
    optionalInputs: ['wz_event_tmc_source_id'],
    desc: 'Turns AADT plus the MAP-21 hourly volume profiles into vehicles and VMT through each zone — the denominator for crash and delay rates. Anchor TMCs only.',
  },
  speed: {
    phase: 3,
    label: 'Speeds + baseline (M1 speed-threshold exceedance)',
    workerPath: 'work_zone/speed',
    sourceType: 'wz_speed',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M1'],
    // pm3 supplies the reference speed (`speed_pctl_85`) — see lib/baseline.js;
    // event_tmc_table is the view-2799 table whose epoch bounds define the
    // active window. npmrds_meta comes from the spine view's own metadata.
    inputs: ['wz_event_source_id', 'npmrds_source_id', 'pm3_source_id', 'event_tmc_table'],
    optionalInputs: ['wz_event_tmc_source_id', 'baseline_months', 'min_epochs', 'min_epochs_per_hour'],
    desc: 'Reads NPMRDS 5-minute speeds from ClickHouse over each zone\'s active window. Publishes M1 — the share of active work-zone HOURS whose ZONE-AVERAGE speed (total distance / total travel time) fell below the threshold — onto the view as metadata.m1 and metadata.m1_by_tier, and the per-(zone x segment x hour-of-day) epoch evidence into wz_speed. Four thresholds on every row: posted limit minus posted_speed_drop_mph floored at 20 (the reported measure), an absolute mph, a percentage of the PM3 85th-percentile reference, and FHWA/PHED.',
  },
  delay: {
    phase: 4,
    label: 'Delay (M2: veh-hrs, per-vehicle, share of total)',
    workerPath: 'work_zone/delay',
    // Its own source, not phase 10's rollup: wz_delay is one row per work zone,
    // the wz_exposure shape.
    sourceType: 'wz_delay',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M2'],
    inputs: ['wz_event_source_id', 'event_tmc_table'],
    optionalInputs: ['wz_event_tmc_source_id', 'wz_exposure_source_id', 'excessive_delay_source_id'],
    desc: 'Sums TRANSCOM view 2799 delay over each zone\'s member events for work-zone vehicle-hours, divides by phase 2\'s vehicle count for delay per vehicle, and reports the share of all delay from the excessive-delay series. ⚠ Unlike exposure and speed, this stage includes IMPACT TMCs as well as anchors — delay is the queue, and 91% of it accrues downstream of the work extent.',
  },
  queue: {
    phase: 5,
    label: 'Queues (M3: length, duration, presence)',
    workerPath: 'work_zone/queue',
    sourceType: 'wz_queue',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M3'],
    inputs: ['wz_event_source_id', 'npmrds_source_id', 'npmrds_meta_source_id'],
    optionalInputs: [],
    desc: 'Walks contiguous upstream TMCs below the queue speed, per 5-minute epoch, to a queue length and a presence flag.',
  },
  differential: {
    phase: 6,
    label: 'Speed differential (M4: approach vs zone, during vs baseline)',
    workerPath: 'work_zone/differential',
    sourceType: 'wz_speed',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M4'],
    inputs: ['wz_event_source_id', 'wz_speed_source_id'],
    optionalInputs: [],
    desc: 'Fills the differential columns on wz_speed from approach-TMC speeds over the same epochs. Adds no columns — wz_speed is created with them in phase 3 (see README).',
  },
  crashes_open: {
    phase: 7,
    label: 'NYS open crash data (statewide work-zone-coded series)',
    workerPath: 'work_zone/crashes_open',
    sourceType: 'nys_crashes_open',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M5'],
    inputs: [],
    optionalInputs: ['ref_marker_source_id', 'file_upload_view_id'],
    desc: 'Loads the Socrata case + individual crash tables (saved as file_upload views first, so tests replay them), flags work-zone crashes from traffic_control_device, and geocodes DOT reference markers.',
  },
  crashes_clear: {
    phase: 7,
    label: 'NYSDOT CLEAR crash extract (adapter)',
    workerPath: 'work_zone/crashes_clear',
    sourceType: 'nys_crashes_clear',
    alsoProduces: [],
    requiresWindow: false,
    writesMeasures: ['M5'],
    inputs: ['file_upload_view_id'],
    optionalInputs: ['ref_marker_source_id'],
    desc: 'Same target schema as nys_crashes_open, loaded from a NYSDOT CLEAR extract. Handles both lat/long and reference-marker-only deliveries.',
  },
  crash_join: {
    phase: 7,
    label: 'Crash ∩ work zone (M5 rates)',
    workerPath: 'work_zone/crash_join',
    sourceType: 'wz_crash',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M5'],
    inputs: ['wz_event_source_id', 'crash_source_id'],
    optionalInputs: ['wz_exposure_source_id', 'wz_queue_source_id'],
    desc: 'Spatial-temporal join of crashes to event×TMC extents and their upstream queue TMCs, then crash rates per 100M VMT through work zones.',
  },
  intrusions: {
    phase: 8,
    label: 'Intrusions / worker injuries (M6)',
    workerPath: 'work_zone/intrusions',
    sourceType: 'wz_intrusions',
    alsoProduces: [],
    requiresWindow: false,
    writesMeasures: ['M6'],
    inputs: ['file_upload_view_id'],
    optionalInputs: [],
    desc: 'Loader for the NYSDOT intrusion / worker-injury extract. Schema designed ahead of delivery; no-ops until a file exists.',
  },
  qa_ratings: {
    phase: 8,
    label: 'WZTC QA field ratings (F1)',
    workerPath: 'work_zone/qa_ratings',
    sourceType: 'wz_qa_ratings',
    alsoProduces: [],
    requiresWindow: false,
    writesMeasures: ['F1'],
    inputs: ['file_upload_view_id'],
    optionalInputs: [],
    desc: 'Loader for work-zone traffic-control QA field observations. Schema designed ahead of delivery; no-ops until a file exists.',
  },
  stip: {
    phase: 1,
    phaseLabel: '1a',
    label: 'NYSDOT capital program (STIP → PIN × phase × fund year)',
    workerPath: 'work_zone/stip',
    sourceType: 'nysdot_stip',
    alsoProduces: [],
    requiresWindow: false,
    writesMeasures: [],
    inputs: ['file_upload_view_id'],
    optionalInputs: [],
    desc: 'Parses every NYSDOT Region STIP workbook (R1–R11 + SW) to PIN × phase × fund year, Region derived from the PIN and cross-checked against the Region column. The project identity layer behind significance.',
  },
  sample: {
    phase: 9,
    label: 'Significant-project sample frame (2030 review)',
    workerPath: 'work_zone/sample',
    sourceType: 'wz_significant_sample',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: [],
    inputs: ['wz_event_source_id', 'nysdot_stip_source_id'],
    optionalInputs: [],
    desc: 'Enriches significant candidates with a matched STIP PIN and records the match method — the frame for the programmatic review sample.',
  },
  measures: {
    phase: 10,
    label: 'Measures rollup (Region × facility class × period × measure)',
    workerPath: 'work_zone/measures',
    sourceType: 'work_zone_measures',
    alsoProduces: [],
    requiresWindow: true,
    writesMeasures: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'E1', 'E2', 'E3', 'F1'],
    inputs: ['wz_event_source_id'],
    optionalInputs: [
      'wz_exposure_source_id', 'wz_speed_source_id', 'wz_queue_source_id',
      'wz_crash_source_id', 'wz_intrusions_source_id', 'wz_qa_ratings_source_id',
    ],
    desc: 'The single long-format source the DMS pages bind: one row per Region × facility class × period × measure, carrying thresholds and counts.',
  },
};

const STAGE_NAMES = Object.keys(STAGES);

/** Human label for a stage's phase — `phaseLabel` where a phase is lettered (1a). */
const phaseOf = (stage) => STAGES[stage].phaseLabel || String(STAGES[stage].phase);

/**
 * Stage names in build order. Lettered phases sort after the bare phase they
 * hang off ('' < '1a'), so `spine` (phase 1) precedes `stip` (phase 1a).
 */
const STAGES_BY_PHASE = STAGE_NAMES.slice().sort((a, b) =>
  STAGES[a].phase - STAGES[b].phase
  || (STAGES[a].phaseLabel || '').localeCompare(STAGES[b].phaseLabel || '')
  || a.localeCompare(b)
);

module.exports = { STAGES, STAGE_NAMES, STAGES_BY_PHASE, phaseOf };
