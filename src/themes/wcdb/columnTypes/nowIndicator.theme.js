// Theme for the WCDB now_indicator column type. Registered in
// `wcdb_theme.js` under `theme.nowIndicator` so NowIndicatorView can pull
// config via `getComponentTheme`.
//
// Tokens map to the editorial scale already defined in
// `src/themes/wcdb/tokens.css` — the pulsing red dot reuses
// `@keyframes wcdb-pulse-dot` from there.
export const nowIndicatorTheme = {
    pillLabel: "On Air",
    pillFontSize: 9,
    pillPadding: "2px 7px",
    metaFontSize: 10,
    metaPrefix: "NOW ·",
};

export default nowIndicatorTheme;
