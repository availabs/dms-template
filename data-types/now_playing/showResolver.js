/**
 * Which show was on air when a track played.
 *
 * The station's schedule (a DAMA source of its own) stores a recurring week:
 * `day` INTEGER, `start`/`end` TEXT 'HH:MM'. A detection carries an absolute
 * `timestamp_utc`. Resolving one to the other is three conversions, each of which
 * has bitten this codebase before:
 *
 *  - **Timezone.** The schedule is in STATION-LOCAL time. A UTC hour is the wrong
 *    hour for five of every twenty-four, and wrong by a different amount either side
 *    of a DST boundary — which is why the conversion is `AT TIME ZONE` in Postgres
 *    rather than arithmetic on a JS Date.
 *  - **Day numbering.** This dataset numbers days 0 = MONDAY. Postgres `DOW` is
 *    0 = Sunday, so the correct source is `ISODOW` (1 = Monday) minus one. Using
 *    `DOW` shows Sunday's schedule on Monday, a bug this project has already shipped
 *    and fixed once.
 *  - **Midnight.** An airing that runs to the end of the day stores `end = '00:00'`,
 *    which compares as the START of the day. It has to be read as 24:00 or every
 *    late-night airing matches nothing.
 *
 * Comparing 'HH:MM' as TEXT is deliberate and safe: the values are zero-padded, so
 * lexicographic and chronological order coincide ('09:00' < '10:00'). No cast needed.
 *
 * OVERLAPS. Nothing stops two airings covering the same hour — the station's original
 * schedule has four such pairs, including a slot nested inside a longer one
 * ("Revolution 909" 17:00–18:00 inside "DJ Shmit's …" 16:00–18:00). A join would then
 * return two rows and duplicate the track. The narrower airing wins: a one-hour slot
 * inside a two-hour block is the more specific statement about that hour. Ties break
 * on the lower `airing_id` so the answer is at least deterministic.
 */

const DEFAULT_TZ = 'America/New_York';

/** `end` read as an exclusive bound, with '00:00' meaning midnight-END. */
const endExpr = (alias) => `CASE WHEN ${alias}."end" = '00:00' THEN '24:00' ELSE ${alias}."end" END`;

/** Minutes a 'HH:MM' string represents — used only to rank overlapping airings. */
const widthExpr = (alias) =>
  `((split_part(${endExpr(alias)}, ':', 1)::int * 60 + split_part(${endExpr(alias)}, ':', 2)::int)
    - (split_part(${alias}.start, ':', 1)::int * 60 + split_part(${alias}.start, ':', 2)::int))`;

/**
 * SQL selecting one show_id for a single timestamp. `$1` is the timestamp.
 * Exported separately so the backfill can inline it as a LATERAL join instead of
 * issuing one query per row.
 */
function buildResolveSQL(scheduleTable, tz = DEFAULT_TZ) {
  return `
    SELECT a.show_id
    FROM ${scheduleTable} a
    WHERE a.show_id IS NOT NULL
      AND a.day = (EXTRACT(ISODOW FROM $1::timestamptz AT TIME ZONE '${tz}')::int - 1)
      AND TO_CHAR($1::timestamptz AT TIME ZONE '${tz}', 'HH24:MI') >= a.start
      AND TO_CHAR($1::timestamptz AT TIME ZONE '${tz}', 'HH24:MI') <  ${endExpr('a')}
    ORDER BY ${widthExpr('a')} ASC, a.airing_id ASC
    LIMIT 1`;
}

/**
 * Set-based variant: for every row of `trackTable` matching `whereClause`, the
 * show that was on air. Used by the backfill — 37k one-row queries would be 37k
 * round trips.
 */
function buildBackfillSQL(trackTable, scheduleTable, tz = DEFAULT_TZ, whereClause = 'TRUE') {
  return `
    UPDATE ${trackTable} t
    SET show_id = m.show_id
    FROM (
      SELECT p.id, a.show_id
      FROM ${trackTable} p
      CROSS JOIN LATERAL (
        SELECT a.show_id, a.airing_id, ${widthExpr('a')} AS width
        FROM ${scheduleTable} a
        WHERE a.show_id IS NOT NULL
          AND a.day = (EXTRACT(ISODOW FROM p.timestamp_utc AT TIME ZONE '${tz}')::int - 1)
          AND TO_CHAR(p.timestamp_utc AT TIME ZONE '${tz}', 'HH24:MI') >= a.start
          AND TO_CHAR(p.timestamp_utc AT TIME ZONE '${tz}', 'HH24:MI') <  ${endExpr('a')}
        ORDER BY width ASC, a.airing_id ASC
        LIMIT 1
      ) a
      WHERE p.timestamp_utc IS NOT NULL AND (${whereClause})
    ) m
    WHERE t.id = m.id AND t.show_id IS DISTINCT FROM m.show_id`;
}

/**
 * Resolve one timestamp. Returns null when nothing is on air — the normal case for
 * most of the week — and also when the lookup fails, because a detection that cannot
 * be attributed must still be recorded. Never throws: tagging is an enrichment, and
 * losing the track would be a worse outcome than losing the tag.
 */
async function resolveShowId(db, { scheduleTable, timestampUtc, tz = DEFAULT_TZ }) {
  if (!db || !scheduleTable || !timestampUtc) return null;
  try {
    const { rows } = await db.query(buildResolveSQL(scheduleTable, tz), [timestampUtc]);
    return rows[0]?.show_id ?? null;
  } catch (err) {
    console.error(`[now_playing] show lookup failed for ${timestampUtc}: ${err.message}`);
    return null;
  }
}

module.exports = { resolveShowId, buildResolveSQL, buildBackfillSQL, DEFAULT_TZ };
