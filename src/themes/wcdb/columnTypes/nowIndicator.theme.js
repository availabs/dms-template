// Theme for the WCDB now_indicator column type. Registered in
// `wcdb_theme.js` under `theme.nowIndicator` so NowIndicatorView can pull
// config via `getComponentTheme`.
//
// Tokens map to the editorial scale already defined in
// `src/themes/wcdb/tokens.css` — the pulsing red dot reuses
// `@keyframes wcdb-pulse-dot` from there.
export const nowIndicatorTheme = {
    pillLabel: "On Air",
    // One step up from 9/10 (2026-08-16): on the rail this sits alone on the
    // now-playing block's label row with vertical room to spare, and at the old
    // size it read as fine print rather than as the block's own heading.
    pillFontSize: 10,
    pillPadding: "3px 9px",
    metaFontSize: 11,
    metaPrefix: "NOW ·",
};

export default nowIndicatorTheme;
