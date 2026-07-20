import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { parcelPlateTheme } from "./parcelPlate.theme"

// ACLB parcel_plate column type — draws a property's recorded lot geometry
// (parcel_width_ft × parcel_length_ft) as the hatched survey diagram from the
// design system ("vacant lots don't photograph well; their survey tells the
// story"). The bound column supplies the width; the length (and an optional
// status column for the hatch variant) are read off sibling row fields, so
// those columns must be fetched on the card (show:true hidden loaders).
//
// Column attributes:
//   lengthColumn : sibling row column holding the lot length in feet
//                  (default 'parcel_length_ft').
//   statusColumn : sibling row column whose value picks the lot hatch variant
//                  via theme.parcelPlate.lotVariantByValue (default
//                  'property_status'; ACLB Project → sky hatch).
//   plateHeight  : key into theme.parcelPlate.heights ('default'|'tall'|'short').
//   showCornerTag: render the "parcel survey" corner tag (default off).

const num = (x) => {
    const n = parseFloat(String(x?.value ?? x ?? "").replace(/,/g, ""))
    return Number.isFinite(n) && n > 0 ? n : null
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export const ParcelPlateView = ({
    value, row,
    lengthColumn = "parcel_length_ft",
    statusColumn = "property_status",
    plateHeight,
    showCornerTag,
}) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...parcelPlateTheme, ...getComponentTheme(themeFromContext, "parcelPlate") }

    const w = num(value)
    const l = num(row?.[lengthColumn])
    const heightClass = (t.heights || {})[plateHeight] || t.heights?.default || "h-36"

    const status = row?.[statusColumn]?.value ?? row?.[statusColumn]
    const variant = (t.lotVariantByValue || {})[status] || "default"
    const lotClass = (t.lots || {})[variant] || t.lots?.default || "lb-lot"

    if (!w || !l) {
        return (
            <div className={`${t.plate} ${heightClass}`}>
                <span className={t.emptyLabel}>survey pending</span>
            </div>
        )
    }

    // Percent-fit heuristic matching the design mockups' hand-tuned plates:
    // long narrow city lots read tall-and-thin, squat lots read wide-and-low.
    const hPct = clamp(Math.round(l * 0.66), 24, 74)
    const wPct = clamp(Math.round(w * 0.95), 8, 52)

    return (
        <div className={`${t.plate} ${heightClass}`}>
            <div className={lotClass} style={{ width: `${wPct}%`, height: `${hPct}%` }} />
            <span
                className={t.dimLabel}
                style={{ left: "50%", top: `${50 + hPct / 2 + 3}%`, transform: "translate(-50%, -50%)" }}>
                {w}′
            </span>
            <span
                className={t.dimLabel}
                style={{ left: `${50 + wPct / 2 + 3}%`, top: "50%", transform: "translateY(-50%)" }}>
                {l}′
            </span>
            {showCornerTag ? <span className={t.cornerTag}>Parcel survey</span> : null}
        </div>
    )
}

export const ParcelPlateEdit = (props) => <ParcelPlateView {...props} />
