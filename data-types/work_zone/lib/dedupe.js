/**
 * work_zone chain collapse — many TRANSCOM events, one work zone.
 *
 * TRANSCOM reports a recurring work zone as one event per occurrence: a nightly
 * lane closure for three months is ~60 events with the same facility,
 * direction, county and description. Counting those as 60 work zones overstates
 * the program badly, so the spine collapses each chain into one `wz_event` with
 * the union of its active windows.
 *
 * ── What we can key on ─────────────────────────────────────────────────────
 * The task plan assumed a `related_road_events` field. **It does not exist**,
 * and every other association field in view 1947 is effectively empty — for NY
 * 2024's 93,112 work-zone events: `secondary_event_ids` on 3,
 * `associated_impact_ids` on 0, `with_in_work_zone_associated_event_id` on 448,
 * `secondary_event` true on 1. So chains have to be inferred.
 *
 * Measured on NY 2024 construction events, an exact match on
 * (facility, direction, county, description) puts 61.9% of events into repeat
 * groups, mean 7.0 events per group, largest 262. Stripping embedded dates and
 * clock times from the description first — which 22% and 47% of descriptions
 * respectively contain — moves that only to 62.4%, so **stemming is off by
 * default**: it adds 0.5pp and costs a normalisation nobody can audit.
 *
 * ── Splitting on gaps ──────────────────────────────────────────────────────
 * A key match alone would merge January and October campaigns into one work
 * zone. Within-chain day gaps for NY 2024 construction: 37,758 links are
 * next-day, 7,485 within a week, 1,077 at 8-14 days, 898 at 15-30, 1,413 over
 * 30. So daily recurrence is the norm and a fortnight's silence means a new
 * mobilisation — `maxGapDays` defaults to 14 and is a descriptor parameter.
 *
 * Pure module: no DB, no network.
 */

const DEFAULT_MAX_GAP_DAYS = 14;

const text = (v) => (v === null || v === undefined ? '' : String(v));
const norm = (v) => text(v).trim().toUpperCase().replace(/\s+/g, ' ');

/**
 * Remove embedded dates and clock times from a description.
 *
 * Deliberately NOT digit-stripping: exit numbers, mileposts and route numbers
 * are what distinguish two work zones on the same facility, so removing all
 * digits would merge them. Off by default (see the module note).
 */
function stemDescription(description) {
  return norm(description)
    .replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s*\d{0,2}(,?\s*\d{4})?/g, '')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(AM|PM)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The chain identity of one event.
 *
 * `work_activity_class` leads the key deliberately. TRANSCOM descriptions are
 * templated, so a plowing run and a construction closure on the same segment
 * can share a description verbatim; without the class they would collapse into
 * one work zone of whichever activity happened to be first. The worker attaches
 * the class from lib/classify.js before calling in.
 */
function chainKey(row, opts = {}) {
  const description = opts.stemDescription
    ? stemDescription(row.description)
    : norm(row.description);
  return [
    norm(row.work_activity_class),
    norm(row.facility),
    norm(row.direction || row.primary_direction),
    norm(row.county_name),
    description,
  ].join('|');
}

/**
 * TRANSCOM timestamps are naive local times — `timestamp without time zone`.
 *
 * The node-postgres driver hands those back as JS Dates interpreted in the
 * PROCESS's timezone, so `.toISOString()` then renders them shifted by the
 * local offset: a work zone starting 2024-12-31 23:39 was being stored as
 * 2025-01-01 04:39. Every timestamp in the spine was 4–5 hours late, which is
 * survivable for a year total but not for the hour-of-day work phase 3 does.
 *
 * So the spine reads these columns as TEXT and this module keeps them in the
 * source's own clock: parsed as UTC for arithmetic, emitted unchanged as
 * `YYYY-MM-DD HH:MM:SS`. No wall-clock time is ever reinterpreted.
 */
const NAIVE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/;

function toDate(v) {
  if (v instanceof Date) return v;
  const m = NAIVE.exec(String(v ?? ''));
  // A naive string is read as UTC so day arithmetic is offset-free; anything
  // else (already-parsed Date, ISO with a zone) is left to the Date parser.
  if (m) return new Date(`${m[1]}T${m[2]}Z`);
  return new Date(v);
}

/** The source's own wall clock, as text — never shifted. */
function naiveString(v) {
  if (v === null || v === undefined) return null;
  const m = NAIVE.exec(String(v));
  if (m) return `${m[1]} ${m[2]}`;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;
}

const dayNumber = (d) => Math.floor(toDate(d).getTime() / 86400000);

/**
 * Longest run of consecutive calendar days in a set of day numbers.
 * The significance rule is "≥3 consecutive days with lanes affected", so this
 * is computed over whichever days the caller passes in.
 */
function longestConsecutiveRun(dayNumbers) {
  const days = [...new Set(dayNumbers)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/**
 * Collapse events into work zones.
 *
 * Events must already be filtered to what belongs in the population (see
 * lib/classify.js) — this function does not judge scope.
 *
 * @param {object[]} rows  view-1947 rows
 * @param {object} [opts]
 * @param {number} [opts.maxGapDays=14]  a longer silence starts a new work zone
 * @param {boolean} [opts.stemDescription=false]
 * @returns {object[]} one record per work zone
 */
function collapseChains(rows, opts = {}) {
  const maxGapDays = opts.maxGapDays ?? DEFAULT_MAX_GAP_DAYS;

  const chains = new Map();
  for (const row of rows) {
    const key = chainKey(row, opts);
    if (!chains.has(key)) chains.set(key, []);
    chains.get(key).push(row);
  }

  const out = [];
  for (const [key, members] of chains) {
    members.sort((a, b) => toDate(a.start_date_time) - toDate(b.start_date_time)
      || text(a.event_id).localeCompare(text(b.event_id)));

    // Split the chain wherever it goes quiet for longer than maxGapDays.
    let group = [];
    let prevDay = null;
    const flush = () => { if (group.length) out.push(summarise(key, group)); group = []; };
    for (const row of members) {
      const day = dayNumber(row.start_date_time);
      if (prevDay !== null && day - prevDay > maxGapDays) flush();
      group.push(row);
      prevDay = day;
    }
    flush();
  }
  return out.sort((a, b) => toDate(a.first_start) - toDate(b.first_start)
    || text(a.wz_event_id).localeCompare(text(b.wz_event_id)));
}

/** One work zone from one contiguous run of chain members. */
function summarise(key, members) {
  const [, facility, direction, county_name] = key.split('|');
  const starts = members.map((m) => toDate(m.start_date_time));
  const ends = members
    .map((m) => (m.close_date ? toDate(m.close_date) : null))
    .filter(Boolean);

  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const lanesAffected = members.map((m) => num(m.lanes_affected_count)).filter((v) => v !== null);
  const lanesTotal = members.map((m) => num(m.lanes_total_count)).filter((v) => v !== null);
  const durations = members.map((m) => num(m.estimated_duration_mins)).filter((v) => v !== null);

  const activeDays = new Set(members.map((m) => dayNumber(m.start_date_time)));
  // Only days that actually closed a lane count toward significance.
  const closureDays = members
    .filter((m) => (num(m.lanes_affected_count) || 0) > 0)
    .map((m) => dayNumber(m.start_date_time));

  return {
    // The earliest member's id: stable, and traceable back to TRANSCOM.
    wz_event_id: text(members[0].event_id),
    member_event_ids: members.map((m) => text(m.event_id)),
    n_occurrences: members.length,
    chain_key: key,

    facility: facility || null,
    direction: direction || null,
    county_name: county_name || null,
    region_name: text(members[0].region_name).trim() || null,
    description: text(members[0].description) || null,

    // Emitted in the source's own clock; see the note on toDate above.
    first_start: naiveString(new Date(Math.min(...starts))),
    last_end: ends.length ? naiveString(new Date(Math.max(...ends))) : null,
    active_days: activeDays.size,
    // Sum of the members' own estimated durations. Occurrences of one chain do
    // not overlap in practice (one per night), but this is a sum, not a union —
    // phase 2 refines it when it needs true exposure hours.
    active_hours: durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / 60) * 100) / 100
      : null,

    lanes_total: lanesTotal.length ? Math.max(...lanesTotal) : null,
    lanes_affected: lanesAffected.length ? Math.max(...lanesAffected) : null,
    // NULL, not 0, when no member reported a lane count — only 40% of events do,
    // and treating unknown as zero would silently shrink the closure population.
    lanes_affected_known: lanesAffected.length > 0,

    consecutive_closure_days: longestConsecutiveRun(closureDays),
    consecutive_active_days: longestConsecutiveRun([...activeDays]),
  };
}

module.exports = {
  DEFAULT_MAX_GAP_DAYS,
  toDate,
  naiveString,
  stemDescription,
  chainKey,
  longestConsecutiveRun,
  collapseChains,
};
