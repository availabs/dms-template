// WCDB-flavoured section theme. Overrides the dms default sectionTheme
// shipped at packages/dms/src/patterns/page/components/sections/section.theme.jsx.
// Mirrors that shape (options.activeStyle + styles[]) and is registered
// in wcdb_theme.js under `pages.section`.
//
// Tokens are merged through `getComponentTheme(theme, 'pages.section')` —
// any key absent here falls back to the dms default style for the same
// `name` slot.

export const wcdbSectionTheme = {
    options: { activeStyle: 0 },
    styles: [
        {
            name: 'default',

            // Named height presets selectable per-section via the section
            // menu's Layout > Height control (see section-height-setting
            // task). `auto` preserves content-sized behaviour. `fill` is the
            // sentinel that triggers `flex: 1 1 auto` on the section wrapper
            // — only meaningful when the surrounding sectionGroup is itself
            // a flex/grid context that allocates remaining space (the WCDB
            // home `header` sectionGroup is one).
            //
            // `hero` is tuned to the WCDB topnav: the topnav is ~64px and
            // the page content has a small breathing gap above it, so
            // `100vh - 80px` leaves a single visible viewport without
            // overflow. Adjust per topnav redesigns.
            heights: {
                auto: 'auto',
                fill: 'fill',
                hero: 'calc(100vh - 160px)',
                tall: '640px',
                medium: '400px',
                small: '240px',
            },

            // Edit-mode floor so an empty section (no data, empty filter,
            // empty draft) still reserves enough room for its settings
            // handle to be reachable. View mode is unaffected — see
            // section.jsx (SectionView branch) for the gate.
            editMinHeight: '40px',
        },
    ],
};

export default wcdbSectionTheme;
