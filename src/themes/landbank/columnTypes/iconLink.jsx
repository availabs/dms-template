import React from "react"
import { Link } from "react-router"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { iconLinkTheme } from "./iconLink.theme"

// ACLB icon_link column type — an icon-only link to a per-row destination, for a
// table's row-action column (the design's View / Edit buttons at the end of every
// inventory row).
//
// Why a type and not the built-in link: the core `isLink` cell renders TEXT
// (`linkText || value`) and the core `actionType: 'url'` path renders an unthemed
// blue pill whose `icon` is accepted and then thrown away (`RenderActions.jsx`'s
// `getIcon` returns the name in a <span>). Neither can produce an icon button, and
// `isLink` short-circuits BEFORE the column-type lookup, so a column can be a link
// or a type but never both. This is the small chrome-only type that closes the gap
// — one visual element, laid out by the table's own cell.
//
// Column attributes:
//   iconName        : a name in theme.Icons (e.g. "Eye", "Edit"). Required — with no
//                     glyph there is nothing to click.
//   iconTitle       : tooltip + accessible name ("View"). Falls back to customName.
//   location        : the destination, INCLUDING the query key and '=' —
//                     "/admin/property-view?id=". The row's param is appended.
//   linkParamColumn : sibling row column supplying the param. Unset → the row's own
//                     `id` (which the server aliases from the table's PK). Fetch the
//                     sibling as a `selectOnly` column so it loads without rendering.
//   iconColor       : a key in the theme's `buttonColors`. Unset → the neutral chrome.
//   external        : render an <a target="_blank"> instead of a router <Link>.
//
// A row whose param resolves empty renders the glyph disabled rather than a link to
// nowhere — a dead link that looks live is worse than one that looks dead.

export const IconLinkView = ({
    row, iconName, iconTitle, customName, location, linkParamColumn, iconColor, external, className,
    linkText, linkVariant,
}) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...iconLinkTheme, ...getComponentTheme(themeFromContext, "iconLink") }

    const Icon = iconName ? themeFromContext?.Icons?.[iconName] : null
    // With a label the cell is a button, so it stands on its own without a glyph;
    // without one, the glyph IS the control and a missing icon means nothing to click.
    if (!Icon && !linkText) return null

    // The host passes the cell's own classes in `className` — for a table cell that
    // string carries `cellInner` AND the column's `justify` (TableCell composes them
    // into `compClassName`). Dropping it, as a type that renders only its own root
    // does, silently discards the author's alignment: a `justify: 'right'` action
    // column rendered hard left. So the button goes INSIDE a wrapper that keeps the
    // host's classes, and the theme token styles the button alone.
    const wrap = (el) => <span className={className}>{el}</span>

    // Same unwrapping convention as parcel_plate's sibling reads: a fetched cell may
    // arrive as a raw value or as { value, originalValue }.
    const cell = linkParamColumn ? row?.[linkParamColumn] : row?.id
    const param = (cell && typeof cell === "object" ? (cell.originalValue ?? cell.value) : cell) ?? ""
    const label = iconTitle || customName || ""

    // Labelled = a real button (the design's "Edit record" / "Public listing"); bare
    // = the 28px hit target of a table's action column.
    const isLabelled = !!linkText
    const buttonClass = isLabelled
        ? ((t.labelled || {})[linkVariant] || (t.labelled || {})[t.labelledDefault] || "")
        : `${t.button} ${(t.buttonColors || {})[iconColor] || ""}`.trim()
    const glyphClass = isLabelled ? t.labelledIcon : t.icon
    const body = (
        <>
            {Icon ? <Icon className={glyphClass} /> : null}
            {isLabelled ? <span className={t.labelText}>{linkText}</span> : null}
        </>
    )

    if (param === "" || !location) {
        // A labelled button with nothing to point at would read as live but do
        // nothing; render it disabled rather than as a link to nowhere.
        return wrap(
            <span className={isLabelled ? `${buttonClass} opacity-40` : t.buttonDisabled}
                  title={label ? `${label} (unavailable)` : undefined}>
                {body}
            </span>
        )
    }

    const url = `${location}${encodeURIComponent(param)}`

    return wrap(external ? (
        <a className={buttonClass} href={url} title={label} aria-label={label || linkText} target="_blank" rel="noopener noreferrer">
            {body}
        </a>
    ) : (
        <Link className={buttonClass} to={url} title={label} aria-label={label || linkText}>
            {body}
        </Link>
    ))
}

// An action button is chrome, not data — it renders identically in edit mode, the
// same contract status_dot and icon_text follow.
export const IconLinkEdit = (props) => <IconLinkView {...props} />
