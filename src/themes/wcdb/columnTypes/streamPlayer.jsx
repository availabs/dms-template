import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { streamPlayerTheme } from "./streamPlayer.theme"

// WCDB stream_player column type — renders the round "Listen live" play
// button and nothing else. Every other piece of the now-playing card
// (album art, title, artist, album, on-air pill, progress strip) lives
// in its own Card cell or its own static column. Keeping this column
// narrow lets `cellsGridSize` do real layout work in the section.

export const StreamPlayerView = (props) => {
    const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
    const t = { ...streamPlayerTheme, ...getComponentTheme(themeFromContext, "streamPlayer") }

    return (
        <div
            data-stream-player="1"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <button
                type="button"
                aria-label="Listen live"
                style={{
                    width: t.playButtonSize,
                    height: t.playButtonSize,
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    background: "var(--ink-1)",
                    color: "var(--bg-1)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingLeft: 3,
                    fontSize: 16,
                }}
            >
                ▶
            </button>
        </div>
    )
}

export const StreamPlayerEdit = (props) => <StreamPlayerView {...props} />
