import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { statusDotTheme } from "./statusDot.theme"

// ACLB status_dot column type — renders a column's value as a small colored dot
// followed by the label, which is how the design system draws a chart legend
// (admin-dashboard.html's composition legend) as opposed to a state badge. The
// core `status_pill` type fills a pill behind the text; this is its unfilled
// sibling and reads only its own value (no sibling-row lookups).
//
// Column attributes:
//   dotColors : optional per-column { "<value>": "<bg-… class>" } map, same shape
//               as status_pill's `pillColors`. Falls back to the theme's
//               `dotColorByValue`, then to `dotDefault`.
//   hideLabel : dot only (for a tight legend column beside its own label cell).

export const StatusDotView = ({ value, dotColors, hideLabel }) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...statusDotTheme, ...getComponentTheme(themeFromContext, "statusDot") }

    const v = (value?.value ?? value ?? "").toString().trim()
    if (!v) return null

    const dotClass =
        (dotColors && dotColors[v]) ||
        (t.dotColorByValue || {})[v] ||
        t.dotDefault

    return (
        <span className={t.wrapper}>
            <span className={`${t.dot} ${dotClass}`} />
            {hideLabel ? null : <span className={`${t.label} ${t.labelColor}`}>{v}</span>}
        </span>
    )
}

// Editing a legend label is not a thing an author does inline — keep the view
// rendering in edit mode so the card looks identical in both, matching how the
// pill type keeps its pill look.
export const StatusDotEdit = (props) => <StatusDotView {...props} />
