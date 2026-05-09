import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { portraitBannerTheme } from "./portraitBanner.theme"

const hashStringToUnit = (str) => {
    if (str === undefined || str === null) return 0.5
    const s = String(str)
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return (h % 1000) / 1000
}

const computeInitials = (label) => {
    if (label === undefined || label === null) return ""
    const parts = String(label).trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return ""
    const letters = parts.length === 1
        ? parts[0].slice(0, 2)
        : parts.map(p => p[0]).slice(0, 3).join("")
    return letters.toUpperCase()
}

const resolveValue = (raw) => {
    if (raw && typeof raw === "object") {
        if (Object.prototype.hasOwnProperty.call(raw, "value")) return raw.value
        if (Object.prototype.hasOwnProperty.call(raw, "originalValue")) return raw.originalValue
    }
    return raw
}

export const PortraitBannerView = ({ value, staticHue, ...rest }) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...portraitBannerTheme, ...getComponentTheme(themeFromContext, "portraitBanner") }

    const resolved = resolveValue(value)
    const numericHue = typeof resolved === "number" && Number.isFinite(resolved) ? resolved : null
    const hueOverride = typeof staticHue === "number" && Number.isFinite(staticHue) ? staticHue : null
    const hue = hueOverride !== null ? hueOverride
        : numericHue !== null ? Math.max(0, Math.min(1, numericHue))
        : hashStringToUnit(resolved)

    const c1 = `oklch(0.30 0.04 ${hue * 360})`
    const c2 = `oklch(0.55 0.08 ${(hue * 360 + 60) % 360})`

    const initials = computeInitials(rest?.initialsLabel ?? (numericHue === null ? resolved : ""))

    // Resolve `bannerHeight` against theme presets:
    //   - per-column override beats theme default
    //   - the value (whether from column or theme) may be a preset key
    //     (`fill`/`full`/`tall`/`medium`/`small`) or a literal CSS value.
    //     Keys not in the preset map are passed through verbatim.
    //   - `fill` is a sentinel meaning "expand to fill the parent flex
    //     context" — the view switches to flex sizing instead of an
    //     explicit height.
    const heights = t.bannerHeights || {}
    const requestedHeight = rest?.bannerHeight || t.defaultHeight || 'medium'
    const resolvedHeight = heights[requestedHeight] ?? requestedHeight
    const isFill = resolvedHeight === 'fill'
    const minHeight = rest?.bannerMinHeight || t.bannerMinHeight

    const sizingStyle = isFill
        ? { flex: '1 1 auto', minHeight, height: '100%', width: '100%' }
        : { height: resolvedHeight, minHeight, width: '100%' }

    return (
        <div
            className="flex items-end relative overflow-hidden"
            style={{
                ...sizingStyle,
                padding: t.contentPadding,
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
            }}
        >
            {/* Radial highlights — adds depth to the otherwise-flat linear gradient.
                Mirrors the wc-art::before treatment in the WCDB design system. */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: t.radialOverlay,
                    mixBlendMode: t.radialBlendMode,
                }}
            />
            {/* Scan-line texture — a subtle horizontal banding that gives the
                background a tactile feel (echoes the design's CRT-screen
                aesthetic). */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `repeating-linear-gradient(0deg, ${t.scanlineColor} 0 1px, transparent 1px ${t.scanlineSpacing})`,
                    mixBlendMode: 'multiply',
                }}
            />
            {initials ? (
                <span
                    className="leading-[0.9] relative"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: t.initialsFontSize,
                        letterSpacing: t.initialsLetterSpacing,
                        color: t.initialsColor,
                        userSelect: 'none',
                    }}
                >
                    {initials}
                </span>
            ) : null}
        </div>
    )
}

export const PortraitBannerEdit = ({ value, onChange, className, placeholder, ...rest }) => {
    const editable = resolveValue(value)
    return (
        <div className="w-full">
            <PortraitBannerView value={value} {...rest} />
            <input
                type="text"
                className={`mt-1 px-2 py-1 w-full text-sm font-light border rounded-md bg-white focus:border-blue-300 focus:outline-none transition ease-in ${className || ""}`}
                value={editable === undefined || editable === null ? "" : editable}
                placeholder={placeholder || "value (number = hue 0..1, text = hashed)"}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    )
}
