import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { PageContext } from "../../../dms/packages/dms/src/patterns/page/context"
import { filterPillTheme } from "./filterPill.theme"

// WCDB filter_pill column type — one segment of a "default-is-the-design"
// segmented control: a label, the count of rows behind it, and a click that
// sets a page variable.
//
// The admin design turns on defaults being visible and switchable in one
// gesture: the playlist opens on `Needs review · 2` beside `All · 412`, the DJ
// roster on `Current · 84` beside `Alumni · 807`, events on upcoming vs past.
// A `Filter` control renders a dropdown, which states neither the count nor the
// alternative — so the count IS the cell value (a `count(*) FILTER (…)`
// aggregate the Card already knows how to select) and the pill is the control.
//
// Chrome + behaviour in one small cell; the Card grid still lays the segments
// out with the ordinary cellSpan knobs, and an author adds a fourth segment by
// adding a column.
//
// Per-column config:
//   paramKey    the page variable to write (must be registered in page.filters,
//               or the write is silently dropped — creating-interactive-pages.md)
//   paramValue  what to write when clicked
//   pillLabel   the segment's label; falls back to customName
//   activeWhenUnset  true → this segment reads as active while the variable
//               has no value (the "All" / reset segment)

const readParam = (pageState, key) =>
  (pageState?.filters || []).find(f => f.searchKey === key)?.values

export const FilterPillView = ({
  value,
  paramKey,
  paramValue,
  pillLabel,
  customName,
  activeWhenUnset = false,
  className,
}) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
  const t = { ...filterPillTheme, ...getComponentTheme(themeFromContext, "filterPill") }
  const { pageState, updatePageStateFilters } = React.useContext(PageContext) || {}

  const current = readParam(pageState, paramKey)
  // pageState values arrive as a scalar or a one-element array depending on the
  // control that wrote them; compare as strings so '60' and 60 agree.
  const currentStr = Array.isArray(current) ? current[0] : current
  const isActive = currentStr === undefined || currentStr === "" || currentStr === null
    ? activeWhenUnset
    : String(currentStr) === String(paramValue)

  const count = value?.value ?? value
  const label = pillLabel || customName || ""

  // The page owns the URL. A section component that reaches for
  // useSearchParams/navigate ping-pongs into a reload loop under the React
  // compiler — writes go through PageContext, always.
  const onClick = () => {
    if (!paramKey || !updatePageStateFilters) return
    updatePageStateFilters([{ searchKey: paramKey, values: [String(paramValue ?? "")] }])
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${isActive ? t.pillActive : t.pill} ${className || ""}`}
    >
      <span className={t.label}>{label}</span>
      {count === undefined || count === null || count === "" ? null : (
        <span className={isActive ? t.countActive : t.count}>{count}</span>
      )}
    </button>
  )
}

// Nothing to edit: the segment's text is its column config, and its number is
// the query's. Edit mode renders the same pill so an author sees the real thing
// while arranging the row.
export const FilterPillEdit = FilterPillView
