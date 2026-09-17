// Pure helpers for the WCDB ShowBlockNav section. A `.js` sibling of the
// `.jsx` so the component file stays a Fast-Refresh boundary
// (packages/dms/CLAUDE.md), and because this is the part worth testing on its
// own: the schedule → block arithmetic is where a playlist would silently
// show the wrong hour.
//
// THE MODEL. The schedule is a recurring WEEK of airings — `day` (0 = Monday,
// the WCDB convention, same as ScheduleGrid), `start`/`end` as "HH:MM" text.
// Everything here is done in STATION wall-clock minutes since Monday 00:00
// ("week minutes", 0 … 10079). An instant is mapped into that frame through
// the station timezone, a block is found there, and the block's edges are
// mapped back to instants — via wall-clock, so a 4–5 pm show is 4–5 pm on the
// DST-change Sunday too.
//
// A BLOCK is either a show (the airing whose interval contains the instant)
// or, when nothing is scheduled, an AUTOMATION slice: the gap between the
// previous show's end and the next show's start, cut into `blockMinutes`
// pieces from the gap's start (the last piece is whatever is left). With no
// schedule at all the week itself is the gap, so slices align to the clock.

export const WEEK_MIN = 7 * 1440
export const DEFAULT_TZ = "America/New_York"
export const DEFAULT_BLOCK_MINUTES = 120

const JS_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const dtfCache = {}
const dtf = (tz) => {
  if (!dtfCache[tz]) {
    dtfCache[tz] = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  }
  return dtfCache[tz]
}

/** Wall-clock parts of an instant in `tz`. `dow` is 0 = Monday … 6 = Sunday. */
export function localParts(date, tz = DEFAULT_TZ) {
  const p = {}
  for (const part of dtf(tz).formatToParts(date)) p[part.type] = part.value
  const jsDow = JS_DOW.indexOf(p.weekday)
  return {
    y: +p.year, mo: +p.month, d: +p.day,
    h: (+p.hour) % 24, mi: +p.minute, s: +p.second,
    dow: (jsDow + 6) % 7,
  }
}

const tzOffsetMs = (date, tz) => {
  const p = localParts(date, tz)
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Station wall-clock → instant. Two passes so a DST edge resolves to the
 *  offset actually in force at the result, not at the guess. */
export function zonedToInstant(y, mo, d, h, mi, tz = DEFAULT_TZ) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const off1 = tzOffsetMs(new Date(guess), tz)
  let t = guess - off1
  const off2 = tzOffsetMs(new Date(t), tz)
  if (off2 !== off1) t = guess - off2
  return new Date(t)
}

/** Shift wall-clock parts by `deltaMin` minutes of WALL time (DST-agnostic). */
export function wallShift(parts, deltaMin) {
  const total = parts.h * 60 + parts.mi + deltaMin
  const dayShift = Math.floor(total / 1440)
  const rem = total - dayShift * 1440
  const dd = new Date(Date.UTC(parts.y, parts.mo - 1, parts.d + dayShift))
  return {
    y: dd.getUTCFullYear(), mo: dd.getUTCMonth() + 1, d: dd.getUTCDate(),
    h: Math.floor(rem / 60), mi: rem % 60,
  }
}

/** "14:00" | "14:00:00" | "2:30 pm" → minutes since midnight, or null. */
export function parseHM(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  let m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    const h = Number(m[1]), mi = Number(m[2])
    if (h < 0 || h > 24 || mi < 0 || mi > 59) return null
    return h * 60 + mi
  }
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === "p") h += 12
    return h * 60 + Number(m[2] || 0)
  }
  return null
}

/** Field lookup tolerant of join aliases (`shows.name` vs `name`) and of the
 *  `{value}` cell wrapper some bindings return. */
export const field = (row, name) => {
  if (!row || !name) return undefined
  const direct = row[name]
  const v = direct !== undefined
    ? direct
    : Object.entries(row).find(([k]) => k.split(".").pop() === name)?.[1]
  return v?.value !== undefined ? v.value : v
}

/**
 * Bound rows → airings in week minutes, sorted by start. An airing whose end
 * is at or before its start runs past midnight: its end gets +1 day, so a
 * Sunday 23:00–01:00 show ends at minute 10140 (> WEEK_MIN) and is matched
 * through the wrap logic in `blockAt`. Rows without a parsable day/start are
 * skipped — visibly absent beats silently landing on midnight.
 */
export function normalizeAirings(rows, cols) {
  const out = []
  for (const row of rows || []) {
    const day = Number(field(row, cols.day))
    const start = parseHM(field(row, cols.start))
    let end = parseHM(field(row, cols.end))
    if (!Number.isInteger(day) || day < 0 || day > 6 || start === null) continue
    if (end === null) end = start + 60
    if (end <= start) end += 1440
    out.push({
      id: field(row, cols.id),
      showId: field(row, cols.showId),
      day,
      startMin: day * 1440 + start,
      endMin: day * 1440 + end,
      title: field(row, cols.title),
      dj: field(row, cols.dj),
      department: field(row, cols.department),
      row,
    })
  }
  return out.sort((a, b) => a.startMin - b.startMin)
}

/**
 * The block containing week-minute `tMin`. Returned `startMin`/`endMin` are in
 * the SAME frame as `tMin` (they may be negative or exceed WEEK_MIN when the
 * block straddles the Monday-00:00 seam), which is what lets the caller turn
 * them into instants by wall-clock shifting from the reference instant.
 */
export function blockAt(airings, tMin, blockMinutes = DEFAULT_BLOCK_MINUTES) {
  const step = Math.max(15, Number(blockMinutes) || DEFAULT_BLOCK_MINUTES)
  for (const a of airings) {
    // The airing as it sits in this week, the week before (a Sunday-night show
    // still running early Monday) and the week after.
    for (const shift of [0, -WEEK_MIN, WEEK_MIN]) {
      const s = a.startMin + shift, e = a.endMin + shift
      if (s <= tMin && tMin < e) return { kind: "show", airing: a, startMin: s, endMin: e }
    }
  }
  // Nothing scheduled: find the gap around tMin.
  let prevEnd = -Infinity, nextStart = Infinity
  for (const a of airings) {
    for (const shift of [-WEEK_MIN, 0, WEEK_MIN]) {
      const s = a.startMin + shift, e = a.endMin + shift
      if (e <= tMin && e > prevEnd) prevEnd = e
      if (s > tMin && s < nextStart) nextStart = s
    }
  }
  // No schedule at all: slices align to the clock from Monday 00:00 (1440 is a
  // multiple of every sensible step, so that means "even hours" for 120).
  if (!Number.isFinite(prevEnd)) prevEnd = Math.floor(tMin / step) * step
  const k = Math.floor((tMin - prevEnd) / step)
  const startMin = prevEnd + k * step
  const endMin = Math.min(startMin + step, nextStart)
  return { kind: "automation", airing: null, startMin, endMin }
}

/**
 * The block containing instant `at`, with `start`/`end` as Date instants.
 * `at` is mapped into station wall-clock, the block found in week minutes,
 * and the edges shifted back by WALL minutes from `at` — so a block is always
 * a wall-clock interval, DST or not.
 */
export function resolveBlock(airings, at, { tz = DEFAULT_TZ, blockMinutes = DEFAULT_BLOCK_MINUTES } = {}) {
  const p = localParts(at, tz)
  const tMin = p.dow * 1440 + p.h * 60 + p.mi
  const b = blockAt(airings, tMin, blockMinutes)
  const s = wallShift(p, b.startMin - tMin)
  const e = wallShift(p, b.endMin - tMin)
  const start = zonedToInstant(s.y, s.mo, s.d, s.h, s.mi, tz)
  let end = zonedToInstant(e.y, e.mo, e.d, e.h, e.mi, tz)
  // A DST fall-back can make a wall-clock interval land end <= start for a
  // zero-length gap; never emit an empty or inverted block.
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60000)
  return { kind: b.kind, airing: b.airing, start, end }
}

export const prevBlock = (airings, block, opts) =>
  resolveBlock(airings, new Date(block.start.getTime() - 60000), opts)
export const nextBlock = (airings, block, opts) =>
  resolveBlock(airings, block.end, opts)

/** URL/page-variable token for an instant: second-precision ISO in UTC.
 *  Postgres reads it as a timestamptz literal unchanged. */
export const isoToken = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z")

/** Token (or anything Date can parse) → Date, else null. */
export function parseInstant(value) {
  const v = Array.isArray(value) ? value[0] : value
  if (!v || typeof v !== "string") return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// ── labels ──────────────────────────────────────────────────────────────────

const lowerMeridiem = (s) => s.replace(/\s?(AM|PM)$/i, (_, p) => ` ${p.toLowerCase()}`)

export function formatClock(date, tz = DEFAULT_TZ) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date)
  return lowerMeridiem(s)
}

export function formatDay(date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(date)
}

/** "Sat, Sep 12 · 4:00 pm – 5:00 pm", or with both days when the block
 *  crosses midnight. `end` is exclusive, so a block ending at 00:00 reads as
 *  the previous day's midnight rather than the next day. */
export function formatBlockRange(start, end, tz = DEFAULT_TZ) {
  const endShown = new Date(end.getTime() - 1)
  const sameDay = formatDay(start, tz) === formatDay(endShown, tz)
  const endLabel = formatClock(end, tz)
  if (sameDay) return `${formatDay(start, tz)} · ${formatClock(start, tz)} – ${endLabel}`
  return `${formatDay(start, tz)} ${formatClock(start, tz)} – ${formatDay(end, tz)} ${endLabel}`
}
