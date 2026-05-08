// Theme for the WCDB portrait_banner column type. Registered in wcdb_theme.js
// under `theme.portraitBanner` so PortraitBannerView can pull config via
// getComponentTheme without needing every column instance to repeat it.
//
// Per project convention (src/dms/packages/dms/CLAUDE.md), authorship-relevant
// styling lives in theme files, not in the markup.
export const portraitBannerTheme = {
    // Named height presets. The column metadata picks one via
    // `bannerHeight: '<key>'` (or a literal CSS value, which is taken as-is).
    //
    //   fill   — flex: 1 + height: 100% so the banner expands to fill its
    //            container. Requires the wrapping section/cell to be a flex
    //            or grid context that allocates remaining space (set up at
    //            the section-group level for the home-page hero).
    //   full   — calc(100vh - 220px); leaves room for the topnav + bottom
    //            caption strip + page padding. Good when the banner stands
    //            alone and the section isn't height-constrained.
    //   tall   — 640px; for a prominent but not viewport-filling card.
    //   medium — 400px; default-ish for an internal page card.
    //   small  — 240px; the legacy compact size (matches the old fixed 200).
    bannerHeights: {
        fill: 'fill',                    // sentinel — view applies flex sizing
        full: 'calc(100vh - 320px)',
        tall: '640px',
        medium: '400px',
        small: '240px',
    },

    // Default if `bannerHeight` is unset on the column. Cards on viewport-
    // sized section groups should pick `fill` explicitly.
    defaultHeight: 'medium',

    // Min height — keeps the banner from collapsing on short viewports when
    // a flex container fails to allocate space.
    bannerMinHeight: '240px',

    // Initials glyph font-size. clamp(min, ideal, max) scales with viewport.
    initialsFontSize: 'clamp(140px, 18vw, 280px)',
    initialsColor: 'rgba(255,255,255,0.14)',
    initialsLetterSpacing: '-0.06em',

    // Padding around the initials within the banner.
    contentPadding: '0 0 0 24px',

    // Scan-line texture intensity. Increase the alpha to make it more visible.
    scanlineColor: 'rgba(0,0,0,0.06)',
    scanlineSpacing: '3px',

    // Radial highlights baked into the gradient — gives the flat linear-gradient
    // a sense of depth (mirrors the wc-art::before treatment in the design
    // system's home_blocks.jsx).
    radialOverlay: `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(0,0,0,0.35), transparent 60%)`,
    radialBlendMode: 'overlay',
};
