import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { rowActionTheme } from "./rowAction.theme"

// WCDB row_action column type — the per-row affordance at the end of a list row
// (`Edit` on a matched spin, `+ Add` on a gap, `Edit` on an event).
//
// It exists because of a specific mismatch. A Card's `click_publish` provider
// publishes the value of the cell that was clicked, so opening an edit modal on
// a row means publishing that ROW'S ID — but a cell bound to `id` renders the
// number, and the design shows a word. This type is bound to `id` (so the click
// publishes an id the modal can filter on) while rendering the label from its
// own config. One small cell, one concern.
//
// Per-column config: `actionLabel`, `actionIcon`, `actionStyle`
// ('quiet' — appears on row hover, the default; 'outlined' — always visible,
// for the row that is asking to be acted on).

export const RowActionView = ({ actionLabel = "Edit", actionIcon = "EditPage", actionStyle = "quiet", className }) => {
  const { theme: themeFromContext = {}, UI } = React.useContext(ThemeContext) || {}
  const t = { ...rowActionTheme, ...getComponentTheme(themeFromContext, "rowAction") }
  const Icon = UI?.Icon
  return (
    <span className={`${actionStyle === "outlined" ? t.outlined : t.quiet} ${className || ""}`}>
      {Icon && actionIcon ? <Icon icon={actionIcon} className={t.icon} /> : null}
      {actionLabel}
    </span>
  )
}

// The cell is an affordance, never an input.
export const RowActionEdit = RowActionView
