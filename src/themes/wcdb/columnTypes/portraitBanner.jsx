import React from "react"

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
    const resolved = resolveValue(value)
    const numericHue = typeof resolved === "number" && Number.isFinite(resolved) ? resolved : null
    const hueOverride = typeof staticHue === "number" && Number.isFinite(staticHue) ? staticHue : null
    const hue = hueOverride !== null ? hueOverride
        : numericHue !== null ? Math.max(0, Math.min(1, numericHue))
        : hashStringToUnit(resolved)

    const c1 = `oklch(0.30 0.04 ${hue * 360})`
    const c2 = `oklch(0.55 0.08 ${(hue * 360 + 60) % 360})`

    const initials = computeInitials(rest?.initialsLabel ?? (numericHue === null ? resolved : ""))
    const height = rest?.bannerHeight || rest?.height || 200

    return (
        <div
            className="w-full h-full flex items-end p-[22px] relative"
            style={{
                height: `${height}px`,
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
            }}
        >
            {initials ? (
                <span
                    className="leading-[0.9]"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontStyle: "italic",
                        fontSize: 88,
                        letterSpacing: "-0.04em",
                        color: "rgba(255,255,255,0.92)",
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
