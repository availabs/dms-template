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

// The `pages.section` style a report graph/map/info-box section renders its header band with
// (themev2.js `pages.section` styles → name 'reportCard'): the graph-card contract's one-line
// header, title left, quick-control pills right, kebab last — instead of the generic 50px band.
// Stamped onto `value.activeStyle`, the field section.jsx already resolves BOTH the section style
// and the component style against; every component theme falls back to its own styles[0] on a
// name it doesn't define, so this is a no-op for the avlGraph/table/dataCard scopes.
//
// Replaces the older 'reportInlineTitle' value, which selected an avlGraph style whose only job
// was to inline the graph-native title with the legend — there is no graph-native title on a
// report card any more. Sections still carrying that value resolve to `pages.section` styles[0]
// (the historical band) and to the avlGraph 'reportInlineTitle' style, i.e. they keep exactly the
// look they have today until they're regenerated. That is the whole no-backfill story; see
// planning/transportny/tasks/current/report-graph-card-header-and-titles.md.
export const DEFAULT_GRAPH_SECTION_STYLE = 'reportCard';
