import React, { useSyncExternalStore } from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { streamPlayerTheme } from "./streamPlayer.theme"
import icons from "../icons"

// WCDB stream_player column type — the round "Listen live" button, which
// plays / pauses the station's live webstream. Every other piece of the
// now-playing card (art, title, artist, on-air pill) is its own Card cell.
//
// The <audio> element is NOT rendered by this component. Card.jsx keys each
// record card by row id, so when the playlist rolls over to the next track
// the whole card — this cell included — remounts, and an element owned by the
// cell would be torn down mid-listen. One element at module scope outlives
// that; the hook below is the React face of it.

const audio = typeof window !== "undefined" ? new window.Audio() : null
if (audio) audio.preload = "none"

// "idle" | "loading" | "playing" | "error"
let status = "idle"
const listeners = new Set()
const setStatus = (next) => { status = next; listeners.forEach((fn) => fn()) }
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

if (audio) {
    audio.addEventListener("playing", () => setStatus("playing"))
    audio.addEventListener("waiting", () => setStatus("loading"))
    audio.addEventListener("pause", () => setStatus("idle"))
    audio.addEventListener("error", () => { if (audio.src) setStatus("error") })
}

// A live stream has no timeline: "pause" unloads it (so the browser drops the
// connection and its buffer) and "play" reconnects fresh, or the listener
// hears minutes-old audio when they come back.
const useStreamPlayer = (url) => {
    const state = useSyncExternalStore(subscribe, () => status, () => "idle")
    const isOn = state === "playing" || state === "loading"
    const toggle = () => {
        if (!audio) return
        if (isOn) {
            audio.pause()
            audio.removeAttribute("src")
            audio.load()
            // Set explicitly: load() discards the `pause` event pause() queued.
            setStatus("idle")
            return
        }
        setStatus("loading")
        audio.src = url
        audio.play().catch(() => setStatus("error"))
    }
    return { state, isOn, toggle }
}

export const StreamPlayerView = ({ streamUrl }) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...streamPlayerTheme, ...getComponentTheme(themeFromContext, "streamPlayer") }
    // The column's own `streamUrl` (a Card control) beats the theme default.
    const { state, isOn, toggle } = useStreamPlayer(streamUrl || t.streamUrl)
    const Icon = isOn ? icons.Pause : icons.Play

    return (
        <div data-stream-player="1" className={t.wrapper}>
            <button
                type="button"
                aria-label={t.labels[state]}
                aria-pressed={isOn}
                title={t.labels[state]}
                onClick={toggle}
                className={`${t.button} ${t[`button_${state}`] || ""}`}
            >
                <Icon aria-hidden="true" fill="currentColor" stroke="none" className={isOn ? t.icon : t.iconPlay} />
            </button>
        </div>
    )
}

export const StreamPlayerEdit = (props) => <StreamPlayerView {...props} />
