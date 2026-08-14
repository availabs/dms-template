import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { iconTextTheme } from "./iconText.theme"

// ACLB icon_text column type — renders a column's value preceded by a glyph from
// the theme's icon registry. Card cells can style a value but can't put anything
// in front of it, so every "⚠ <sentence>" line in the design set had to be faked
// with a literal character in the data (which inherits the text color and sits on
// the wrong baseline). This is the chrome-only sibling of a plain text cell: one
// visual element, reading only its own value, laid out by the Card grid.
//
// Column attributes:
//   iconName  : a name in theme.Icons (e.g. "TriangleAlert"). Unset → no glyph,
//               so the cell degrades to a plain value rather than a broken icon.
//   iconColor : a key in the theme's `iconColors` (brand names — "amberdeep",
//               "field", …). Unset → inherits the cell's text color.
//   iconSize  : a key in `iconSizes` (xs/sm/md/lg/xl). Unset → sm (the design
//               set's size beside 12px prose).

export const IconTextView = ({ value, iconName, iconColor, iconSize }) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...iconTextTheme, ...getComponentTheme(themeFromContext, "iconText") }

    const v = (value?.value ?? value ?? "").toString()
    // An unregistered name renders nothing rather than a fallback glyph — a wrong
    // icon reads as intent, a missing one reads as a typo (icons skill).
    const Icon = iconName ? themeFromContext?.Icons?.[iconName] : null

    if (!v && !Icon) return null

    return (
        <span className={t.wrapper}>
            {Icon ? (
                <Icon className={`${t.icon} ${(t.iconSizes || {})[iconSize] || t.iconSizeDefault} ${(t.iconColors || {})[iconColor] || t.iconColorDefault}`} />
            ) : null}
            <span className={t.label}>{v}</span>
        </span>
    )
}

// The glyph is chrome, not data — keep the view rendering in edit mode so the
// card looks identical in both, the same contract status_dot follows.
export const IconTextEdit = (props) => <IconTextView {...props} />
