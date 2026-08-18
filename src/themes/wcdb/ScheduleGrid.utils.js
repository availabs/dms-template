// Pure helpers for the ScheduleGrid section. A `.js` sibling, not part of the
// `.jsx`, because a file that exports anything other than components is not a
// Fast-Refresh boundary — the whole page full-reloads on every edit
// (packages/dms/CLAUDE.md). Being pure, they are also the part worth testing
// directly: hour parsing and the overnight clamp are where a schedule grid
// silently lies.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export const HOURS = Array.from({ length: 24 }, (_, h) => h)

// The data stores days 0–6. Which weekday 0 IS is a per-dataset decision, so it
// is config, not a constant: `display.weekStartsOn` names the label for day 0.
export const dayLabels = (weekStartsOn = "Mon") => {
  const start = Math.max(0, DAYS.indexOf(weekStartsOn))
  return DAYS.slice(start).concat(DAYS.slice(0, start))
}

export const two = (n) => String(n).padStart(2, "0")
export const hourLabel = (h) => `${two(h % 24)}:00`

/** "14:00" | "14:00:00" | "2:00 PM" → 14. Returns null for anything unparseable
 *  rather than guessing, so a bad row is visibly absent instead of silently
 *  landing on midnight. */
export function parseHour(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  let m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    const h = Number(m[1])
    return h >= 0 && h <= 24 ? h : null
  }
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (m[3].toLowerCase() === "p") h += 12
    return h
  }
  return null
}

/** Field lookup with the joined-source alias fallbacks. A joined column comes
 *  back under its alias (`shows.name`) or its bare name depending on how the
 *  binding was authored, and a cell should not care which. */
const field = (row, name) => {
  if (!row || !name) return undefined
  const direct = row[name]
  const v = direct !== undefined ? direct : Object.entries(row).find(([k]) => k.split(".").pop() === name)?.[1]
  return v?.value !== undefined ? v.value : v
}

/**
 * Turn the bound rows into placed blocks.
 *
 * An airing whose end is <= its start runs past midnight. It is CLAMPED at
 * midnight for drawing (a grid cell cannot span into the next column) but keeps
 * its true label — `20:00–02:00 +1d` — because the truth is the label's job,
 * not the rectangle's.
 */
export function toBlocks(rows, cols) {
  const blocks = []
  for (const row of rows || []) {
    const day = Number(field(row, cols.day))
    const start = parseHour(field(row, cols.start))
    const end = parseHour(field(row, cols.end))
    if (!Number.isInteger(day) || day < 0 || day > 6 || start === null) continue

    const overnight = end !== null && end <= start
    const drawnEnd = end === null ? start + 1 : overnight ? 24 : end
    blocks.push({
      id: field(row, cols.id),
      day,
      start,
      end,
      span: Math.max(1, drawnEnd - start),
      overnight,
      title: field(row, cols.title),
      icon: field(row, cols.icon),
      dj: field(row, cols.dj),
      label: end === null
        ? `${hourLabel(start)}–?`
        : `${hourLabel(start)}–${hourLabel(end)}${overnight ? " +1d" : ""}`,
      row,
    })
  }
  return blocks
}
