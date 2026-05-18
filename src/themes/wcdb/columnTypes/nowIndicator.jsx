import React, { useEffect, useState } from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { nowIndicatorTheme } from "./nowIndicator.theme"

// WCDB now_indicator column type — renders the editorial "on-air" eyebrow:
// a pulsing red "On Air" pill followed by a mono `NOW · HH:MM am/pm` strip
// showing the current wall-clock time (the viewer's local time, since the
// editorial intent is "right now, your time").
//
// This is chrome (no underlying column value to render), so the cell sits as
// `origin: 'static'` on the Card grid alongside the data cells. The clock
// re-renders every minute via a self-scheduling timeout aligned to the next
// minute boundary — no row data needed, no skew.
//
// The pulse animation reuses the `@keyframes wcdb-pulse-dot` already shipped
// in `src/themes/wcdb/tokens.css` so the dot stays in lockstep with the rest
// of the editorial system.

function formatClock(date) {
    // toLocaleTimeString gives "2:14 PM"; lowercase the meridiem to match
    // the WCDB editorial convention (matches formatTime in utils.jsx).
    const formatted = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
    return formatted.replace(/\s?(AM|PM)$/i, (_, p) => ` ${p.toLowerCase()}`)
}

export const NowIndicatorView = () => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...nowIndicatorTheme, ...getComponentTheme(themeFromContext, "nowIndicator") }

    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        // Re-render at the start of each minute so the displayed HH:MM rolls
        // over cleanly. setTimeout (not setInterval) aligned to the next
        // minute boundary keeps drift from accumulating.
        let timeoutId
        const schedule = () => {
            const msUntilNextMinute = 60_000 - (Date.now() % 60_000)
            timeoutId = setTimeout(() => {
                setNow(new Date())
                schedule()
            }, msUntilNextMinute + 50) // 50ms slack so we land just inside the new minute
        }
        schedule()
        return () => clearTimeout(timeoutId)
    }, [])

    const meta = `${t.metaPrefix} ${formatClock(now)}`

    return (
        <div data-now-indicator="1" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: t.pillFontSize,
                    letterSpacing: "0.06em",
                    padding: t.pillPadding,
                    borderRadius: 999,
                    background: "var(--on-air-soft)",
                    color: "var(--on-air)",
                    border: "1px solid rgba(255,59,47,0.3)",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--on-air)",
                        animation: "wcdb-pulse-dot 1.4s ease-in-out infinite",
                    }}
                />
                {t.pillLabel}
            </span>
            <span
                style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: t.metaFontSize,
                    letterSpacing: "0.10em",
                    color: "var(--ink-3)",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                }}
            >
                {meta}
            </span>
        </div>
    )
}

export const NowIndicatorEdit = (props) => <NowIndicatorView {...props} />
