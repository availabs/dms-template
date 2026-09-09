/**
 * work_zone classification — which TRANSCOM events are work zones at all.
 *
 * 23 CFR 630 Subpart J covers "construction, maintenance, or utility work
 * activities". Deciding which TRANSCOM events those are is the first thing the
 * spine does, and it is not as simple as the legacy filter suggests.
 *
 * ── Why not just filter nysdot_sub_category ─────────────────────────────────
 * The TSMO dashboards use `nysdot_sub_category IN ('Construction','Maintenance',
 * 'Emergency Operations')`. Those sub-categories come from AVAIL's own mapping
 * table (`datasets.s479_v835_nysdot_transcom_event_classification`, keyed on the
 * source's `event_type`), and **sub_category is not unique across general
 * categories**:
 *
 *   Construction / Construction          real work zones
 *   Construction / Maintenance           real work zones
 *   Condition    / Maintenance           roving repairs, sweeping, plowing…
 *   Incident     / Maintenance           emergency maintenance, sign repairs
 *   Incident     / Emergency Operations  police activity, vehicle fires, EMS…
 *
 * So that filter sweeps in 3,109 incident-response events for NY 2024 (police
 * activity, vehicle fires, debris spills) which are not work zones in any
 * sense, while its recall is otherwise fine — a keyword sweep of everything it
 * excludes finds only 'Downed tree' and 'Gas main break' that plausibly belong.
 *
 * ── What this module does instead ───────────────────────────────────────────
 * Classifies on `event_type`, the field the mapping table itself keys on, into
 * one of five work-activity classes, and derives scope from the class. The map
 * is explicit and exhaustive over the 44 event types observed in NY since 2023;
 * an unrecognised type is classified `unclassified` and reported, never guessed
 * into or out of scope — TRANSCOM adds event types over time and a silent
 * default would move the measure population without anyone noticing.
 *
 * `matchesLegacyFamily()` keeps the old filter available, because the published
 * TSMO numbers (93,112 NY events in 2024) reconcile to it and not to scope.
 *
 * Pure module: no DB, no network.
 */

/**
 * event_type → work-activity class. Counts in comments are NY events since
 * 2023-01-01, for weight, and the (general/sub) category the mapping table
 * assigns is noted where it disagrees with the class.
 */
const WORK_ACTIVITY_BY_EVENT_TYPE = {
  // ── construction: planned roadway construction ──
  'Construction': 'construction',                 // 298,371 · Construction/Construction
  'Roadwork': 'construction',                     //  30,250 · Construction/Construction
  'Emergency construction': 'construction',       //     363 · Construction/Maintenance

  // ── maintenance: roadway maintenance work activities ──
  'Roving repairs': 'maintenance',                //   3,808 · Condition/Maintenance
  'Road sweeping': 'maintenance',                 //   3,491 · Condition/Maintenance — a mobile work zone
  'Pothole repairs': 'maintenance',               //   1,034 · Condition/Maintenance
  'Operational Activity': 'maintenance',          //     848 · Condition/Maintenance
  'Electrical Repairs': 'maintenance',            //       9 · Condition/Maintenance
  'Emergency maintenance': 'maintenance',         //     103 · Incident/Maintenance
  'Overhead Sign Repairs': 'maintenance',         //      43 · Incident/Maintenance
  'Icicle removal': 'maintenance',                //     105 · Incident/Maintenance

  // ── utility: utility work activities, explicitly in the rule's scope ──
  'Utility work': 'utility',                      //      13 · Construction/Maintenance
  'Watermain break': 'utility',                   //     324 · Incident/Emergency Operations
  'Downed wires': 'utility',                      //     432 · Incident/Emergency Operations
  'Downed pole': 'utility',                       //     325 · Incident/Emergency Operations
  'Utility Pole Down': 'utility',                 //      11 · Incident/Emergency Operations
  'Sewer main break': 'utility',                  //       3 · Incident/Emergency Operations
  'Gas main break': 'utility',                    //      29 · Incident/Road Hazard — excluded by the legacy filter
  'Traffic Signal Down': 'utility',               //      12 · Incident/Emergency Operations
  // Utility-infrastructure hazards: the road is occupied by a utility crew
  // repairing them, so the work is in scope even though the event names the defect.
  'Missing Sewer Grate': 'utility',               //      40
  'Missing Manhole Cover': 'utility',             //       8
  'Collapsed Manhole': 'utility',                 //       6

  // ── winter operations: lane occupancy, but not a work zone under the rule ──
  'Plowing and salting': 'winter_operations',     //   3,147 · Condition/Maintenance
  'Snow removal': 'winter_operations',            //      20 · Condition/Maintenance

  // ── other operations ──
  'Drawbridge open': 'operations',                //      99 · Condition/Maintenance

  // ── incident response: not work zones ──
  'Police department activity': 'incident_response', // 2,877
  'Vehicle fire': 'incident_response',               // 2,531
  'Debris spill': 'incident_response',               // 2,064
  'Fire department activity': 'incident_response',   // 1,001
  'EMS activity': 'incident_response',               //   392
  'Downed tree': 'incident_response',                // 3,491 · Incident/Road Hazard
  'Building fire': 'incident_response',              //   196
  'Brush fire': 'incident_response',                 //   166
  'Roadway non-hazmat spill': 'incident_response',   //    70
  'Tractor trailer fire': 'incident_response',       //    59
  'Truck fire': 'incident_response',                 //    56
  'Bus fire': 'incident_response',                   //     8
  'Cargo spill': 'incident_response',                //     4
  'Split tractor trailer': 'incident_response',      //     1
  // Structural failures: the event is the hazard; the repair that follows is a
  // separate event when TRANSCOM reports one.
  'Sinkhole': 'incident_response',                   //    16
  'Road Collapse': 'incident_response',              //    14
  'Landslide': 'incident_response',                  //     3
  'Shifted Plates': 'incident_response',             //     7
  'Collapsed Scaffolding': 'incident_response',      //     2
};

/** Every class the map can produce, plus the fallback. */
const WORK_ACTIVITY_CLASSES = [
  'construction', 'maintenance', 'utility', 'winter_operations', 'operations',
  'incident_response', 'unclassified',
];

/**
 * The classes that count as a Subpart J work zone. A descriptor parameter, not
 * a constant: whether sweeping or winter operations belong is a program
 * decision NYSDOT has not made, and the pipeline should not bake in an answer.
 */
const DEFAULT_SCOPE_CLASSES = ['construction', 'maintenance', 'utility'];

/** The legacy TSMO sub-categories — kept for reconciliation, not for scope. */
const LEGACY_FAMILY_SUB_CATEGORIES = ['Construction', 'Maintenance', 'Emergency Operations'];

/** Utility/permit work, for the permitting split the report asks for. */
const UTILITY_OR_PERMIT_PATTERN =
  /\b(UTILIT(?:Y|IES)|WATERMAIN|WATER MAIN|GAS MAIN|SEWER|MANHOLE|CONDUIT|NATIONAL GRID|CON ?ED(?:ISON)?|VERIZON|SPECTRUM|PERMIT|POLE (?:REPLACE|WORK)|ELECTRIC(?:AL)? (?:WORK|REPAIR))\b/i;

const text = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * New York only. TRANSCOM covers NJ and CT too, and both `state` ('NY') and
 * `state_code` (36) appear — either is accepted, and a row carrying neither is
 * not assumed to be NY.
 */
function isNewYork(row) {
  const state = text(row.state).trim().toUpperCase();
  if (state) return state === 'NY' || state === 'NEW YORK';
  const code = row.state_code;
  if (code !== null && code !== undefined && text(code) !== '') return Number(code) === 36;
  return false;
}

/** True when the row is in the legacy TSMO work-zone family (reconciliation). */
function matchesLegacyFamily(row) {
  return LEGACY_FAMILY_SUB_CATEGORIES.includes(text(row.nysdot_sub_category).trim());
}

/** event_type → class, exact then case-insensitive; 'unclassified' if unknown. */
function workActivityClass(eventType) {
  const raw = text(eventType).trim();
  if (!raw) return 'unclassified';
  if (WORK_ACTIVITY_BY_EVENT_TYPE[raw]) return WORK_ACTIVITY_BY_EVENT_TYPE[raw];
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(WORK_ACTIVITY_BY_EVENT_TYPE)) {
    if (k.toLowerCase() === lower) return v;
  }
  return 'unclassified';
}

/**
 * Classify one event row.
 *
 * @param {object} row  a view-1947 row
 * @param {object} [opts]
 * @param {string[]} [opts.scopeClasses]  classes counted as a work zone
 * @returns {{
 *   is_new_york: boolean, work_activity_class: string, in_scope: boolean,
 *   is_legacy_family: boolean, is_utility_or_permit: boolean,
 *   general_category: string|null, sub_category: string|null, event_type: string|null,
 * }}
 */
function classifyEvent(row, opts = {}) {
  const scopeClasses = opts.scopeClasses || DEFAULT_SCOPE_CLASSES;
  const cls = workActivityClass(row.event_type);
  const description = `${text(row.description)} ${text(row.summary_description)}`;
  return {
    is_new_york: isNewYork(row),
    work_activity_class: cls,
    in_scope: isNewYork(row) && scopeClasses.includes(cls),
    is_legacy_family: matchesLegacyFamily(row),
    // The class already identifies utility *events*; this also catches utility
    // or permit work described inside a plain 'Construction' event.
    is_utility_or_permit: cls === 'utility' || UTILITY_OR_PERMIT_PATTERN.test(description),
    general_category: text(row.nysdot_general_category).trim() || null,
    sub_category: text(row.nysdot_sub_category).trim() || null,
    event_type: text(row.event_type).trim() || null,
  };
}

/**
 * Classify a batch and surface anything the map does not know about.
 *
 * A worker calls this and dispatches the unknown types as an event: a new
 * TRANSCOM event_type must be a visible decision, not a silent exclusion.
 */
function classifyBatch(rows, opts = {}) {
  const classified = rows.map((r) => ({ row: r, ...classifyEvent(r, opts) }));
  const unknown = new Map();
  for (const c of classified) {
    if (c.work_activity_class === 'unclassified' && c.is_new_york) {
      unknown.set(c.event_type, (unknown.get(c.event_type) || 0) + 1);
    }
  }
  return {
    classified,
    inScope: classified.filter((c) => c.in_scope),
    unknownEventTypes: [...unknown.entries()]
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

module.exports = {
  WORK_ACTIVITY_BY_EVENT_TYPE,
  WORK_ACTIVITY_CLASSES,
  DEFAULT_SCOPE_CLASSES,
  LEGACY_FAMILY_SUB_CATEGORIES,
  isNewYork,
  matchesLegacyFamily,
  workActivityClass,
  classifyEvent,
  classifyBatch,
};
