/**
 * work_zone active windows — WHEN a work zone was active, on the epoch grid.
 *
 * Shared by the `speed` (phase 3) and `queue` (phase 5) stages: both measure
 * NPMRDS speeds "while the zone was active", and both need the same answer to
 * the question of which (date, epoch range) that is. The SQL lived inline in
 * workers/speed.js through phase 4; it moved here when phase 5 needed it, so
 * that the three bugs it already pins stay fixed in one place.
 *
 * ── What it returns ───────────────────────────────────────────────────────
 * One row per (work zone × anchor TMC × active day):
 *   wz_event_id, tmc, date 'YYYY-MM-DD', epoch_from, epoch_to, window_source
 * with `[epoch_from, epoch_to)` half-open on the 288-slot five-minute grid.
 *
 * ── Two window sources ────────────────────────────────────────────────────
 * View 2799 (the TRANSCOM event→TMC conflation) gives each (event, tmc) an
 * epoch-bounded span, and where it exists it is the window. It has holes — no
 * rows at all for 2019 and 2020, ~10% of zones missing in a good year — so
 * where it has no row the window is recovered from the anchor row's own
 * `first_start`/`last_end`, floored/ceiled onto the epoch grid. That reproduces
 * 2799's bounds exactly where both exist (04:25–09:45 gives 53–117 either way)
 * and is labelled `window_source = 'event'` so it can be filtered out. Its
 * weakness is real: the anchor row's span is the CHAIN's span, so a recurring
 * chain can claim days it was not working; MAX_SPAN_DAYS bounds the damage.
 *
 * ── Three things about the expansion that are load-bearing ────────────────
 * Each was found by measuring, not reading, on CY2024:
 *  1. A 2799 row is a SPAN (`bound_start_date/time` → `bound_end_date/time`),
 *     not a day. 12.8% of rows span several days (up to 27). Keying on the
 *     start date measured only the first day and applied to it an epoch range
 *     whose end belonged to a later day — usually an empty range.
 *  2. A same-day row whose end epoch precedes its start (0.8%) is a night shift
 *     that crossed midnight; the end is rolled to the next day. Read literally
 *     it is empty, the shift disappears, and M1 is biased upward because night
 *     is when a work zone's speed impact is cheapest.
 *  3. Epoch bounds are half-open: `bound_end_time` reaches 288, one past the
 *     last epoch of the day, so a whole active day is [0, 288).
 *
 * Pure: builds a string, runs nothing.
 */

const EPOCHS_PER_DAY = 288;

/**
 * Longest span a single (event, tmc) row may claim as active, in days.
 * Matches phase 2's duration cap: the never-closed records that made the
 * reported duration unusable there would otherwise claim a month of active
 * time here.
 */
const MAX_SPAN_DAYS = 30;

/**
 * The active-window expansion, as SQL with two positional parameters:
 * $1 = window start date, $2 = window end date (both 'YYYY-MM-DD').
 *
 * @param {object} args
 * @param {string} args.spineTable      the wz_event table (qualified)
 * @param {string} args.tmcTable        the wz_event_tmc table (qualified)
 * @param {string} args.eventTmcTable   the view-2799 table (qualified)
 * @param {number} [args.maxSpanDays]
 * @param {number} [args.epochsPerDay]
 */
function activeWindowsSQL({ spineTable, tmcTable, eventTmcTable, maxSpanDays = MAX_SPAN_DAYS, epochsPerDay = EPOCHS_PER_DAY }) {
  if (!spineTable || !tmcTable || !eventTmcTable) {
    throw new Error('activeWindowsSQL: spineTable, tmcTable and eventTmcTable are required');
  }
  return `WITH zone_members AS (
         SELECT wz_event_id, unnest(string_to_array(member_event_ids, ' ')) AS event_id
           FROM ${spineTable}
          WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')),
       anchors AS (
         SELECT DISTINCT wz_event_id, tmc FROM ${tmcTable} WHERE tmc_role = 'anchor'),
       spans AS (
         SELECT DISTINCT zm.wz_event_id, a.tmc,
                et.bound_start_date AS d0, et.bound_start_time AS t0,
                CASE WHEN et.bound_end_date = et.bound_start_date
                          AND et.bound_end_time <= et.bound_start_time
                     THEN et.bound_start_date + 1
                     ELSE et.bound_end_date END AS d1,
                et.bound_end_time AS t1
           FROM zone_members zm
           JOIN anchors a ON a.wz_event_id = zm.wz_event_id
           JOIN ${eventTmcTable} et ON et.event_id = zm.event_id AND et.tmc = a.tmc
          WHERE et.bound_start_time IS NOT NULL AND et.bound_end_time IS NOT NULL),
       -- Anchor rows with no 2799 span: recover the window from the anchor's own
       -- clock times. floor() for the start and ceil() for the end reproduce
       -- 2799's half-open epoch bounds.
       derived AS (
         SELECT t.wz_event_id, t.tmc,
                t.first_start::date AS d0,
                FLOOR((EXTRACT(HOUR FROM t.first_start) * 60
                     + EXTRACT(MINUTE FROM t.first_start)) / 5.0)::int AS t0,
                t.last_end::date AS d1,
                LEAST(${epochsPerDay}, CEIL((EXTRACT(HOUR FROM t.last_end) * 60
                     + EXTRACT(MINUTE FROM t.last_end)
                     + EXTRACT(SECOND FROM t.last_end) / 60.0) / 5.0))::int AS t1
           FROM ${tmcTable} t
           JOIN ${spineTable} e ON e.wz_event_id = t.wz_event_id
          WHERE t.tmc_role = 'anchor'
            AND e.first_start >= $1::date AND e.first_start < ($2::date + INTERVAL '1 day')
            AND t.first_start IS NOT NULL AND t.last_end IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM spans s
                             WHERE s.wz_event_id = t.wz_event_id AND s.tmc = t.tmc)),
       capped AS (
         SELECT wz_event_id, tmc, d0, t0, t1, LEAST(d1, d0 + ${maxSpanDays}) AS d1,
                '2799' AS window_source
           FROM spans WHERE d1 >= d0
          UNION ALL
         SELECT wz_event_id, tmc, d0, t0, t1, LEAST(d1, d0 + ${maxSpanDays}) AS d1,
                'event' AS window_source
           FROM derived WHERE d1 >= d0)
       SELECT wz_event_id, tmc, to_char(g.day::date, 'YYYY-MM-DD') AS date, window_source,
              CASE WHEN g.day::date = d0 THEN t0 ELSE 0 END AS epoch_from,
              CASE WHEN g.day::date = d1 THEN t1 ELSE ${epochsPerDay} END AS epoch_to
         FROM capped
         CROSS JOIN generate_series(GREATEST(d0, $1::date)::timestamp,
                                    LEAST(d1, $2::date)::timestamp,
                                    INTERVAL '1 day') AS g(day)
        WHERE (CASE WHEN g.day::date = d0 THEN t0 ELSE 0 END)
            < (CASE WHEN g.day::date = d1 THEN t1 ELSE ${epochsPerDay} END)`;
}

module.exports = {
  EPOCHS_PER_DAY,
  MAX_SPAN_DAYS,
  activeWindowsSQL,
};
