// Theme for the WCDB stream_player column type — the now-playing play button.
// Registered in wcdb_theme.js under `theme.streamPlayer`; StreamPlayerView
// reads it via getComponentTheme.
export const streamPlayerTheme = {
    // The station's live webstream. A column-level `streamUrl` (Card control)
    // overrides this for a one-off page; this is the site default.
    streamUrl: "https://streams.wcdb.fm/stream",
    labels: {
        idle: "Listen live",
        loading: "Connecting…",
        playing: "Pause",
        error: "Stream unavailable — tap to retry",
    },
    wrapper: "w-full h-full flex items-center justify-center",
    // 60px is the design's disc (`home.html`, `size-[60px]`). Below `md` the
    // rail is the phone's full width and the track title is what the block is
    // for, so the disc steps down to 40 — the smallest that still clears a 44px
    // touch target once the cell gutter is counted. `shrink-0` keeps it round
    // when the cell is narrower than the disc.
    button:
        "size-[60px] max-md:size-[40px] shrink-0 rounded-full border-0 p-0 cursor-pointer " +
        "inline-flex items-center justify-center bg-[var(--ink-1)] text-[color:var(--bg-1)] " +
        "transition-transform hover:scale-[1.04] active:scale-[0.96] " +
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ink-1)]",
    button_loading: "animate-pulse",
    button_error: "bg-[var(--on-air)]",
    // The glyph is 24-grid art at ~45% of the disc, whatever the disc's size.
    icon: "size-[45%]",
    // The play triangle's optical centre sits left of its box; nudge it right.
    iconPlay: "size-[45%] translate-x-[6%]",
};

export default streamPlayerTheme;
