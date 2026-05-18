// Theme for the WCDB stream_player column type — slim now-playing play
// button. Registered in wcdb_theme.js under `theme.streamPlayer` so
// StreamPlayerView can pull config via getComponentTheme.
//
// Tokens map to css custom properties in src/themes/wcdb/tokens.css so
// the button honours light/dark.
export const streamPlayerTheme = {
    playButtonSize: 52,
};

export default streamPlayerTheme;
