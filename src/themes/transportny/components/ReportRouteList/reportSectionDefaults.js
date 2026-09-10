// Shared default section-chrome for a brand-new graph/map/info-box section. Two different code
// paths mint one of these: the UI's "+ Add Graph" flow (useAddGraphSection.js, runs in-browser)
// and the CLI spec-driven builder (report_build.mjs, runs in Node — loads this file via Vite's
// `server.ssrLoadModule` since it's outside the browser bundle, the same bridge it already uses
// for composeMeasureConfig.js). One shared value instead of two hardcoded literals, so a report's
// cards can't end up inconsistently rounded/square depending on which path added them.
//
// 'full' resolves via the theme's own `pages.sectionArray.styles[0].border.full` preset
// (rounded-[8px] + white bg + shadow — see themev2.js) — this is a default VALUE, not new
// mechanism; an author can still override any section's border from the section-menu Border
// control (2026-09-04, Ryan).
export const DEFAULT_GRAPH_SECTION_BORDER = 'full';
