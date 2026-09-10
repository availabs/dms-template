import { ROUTE_CATALOG_PARAM_KEY } from './useGraphPublish';
import { resolvedRouteLabel, substituteTokens } from './relativeDateResolution';

// dynamic-reports-authoring-gaps.md — "Static graph text vs. live route resolution": a report
// graph's own section `title` (bi_directional's 14 hardcoded "Northbound"/"Southbound" strings)
// and a difference graph's `state.display.description` caption ("Base: X · Comparison: Y") used
// to be baked as static strings once at build time (report_build.mjs) and never re-resolve —
// wrong for a Dynamic Report, where a route slot's own `name` can be a `%n`/`%y` template that
// only resolves once a real route is picked at view time.
//
// This is the ONE place that live-resolves both, reusing the SAME broadcast route catalog
// (ROUTE_CATALOG_PARAM_KEY) the header pill, chart legend, and RRL's own row label already read
// through `resolvedRouteLabel` — so all of them agree. It's exported as a plain function (not a
// component) specifically so DMS-core (section.jsx / graph_new/index.jsx) can call it through a
// theme-supplied hook without importing this theme-layer file directly — see src/dms/CLAUDE.md's
// core/theme boundary. Core is expected to call this UNCONDITIONALLY on whatever raw display text
// it has in hand (including non-report sections' Lexical rich-text titles on this same site, and
// on every OTHER site's theme, which never defines this hook at all) — safe because:
//   - a site without this hook never calls it (theme.resolveReportDisplayText is undefined there);
//   - substituteTokens no-ops on anything that isn't a `%n`/`%y`-bearing string (a normal title,
//     a Lexical object, anything already-resolved) and returns the original value unchanged.
//
// `rawText` is the section's own stored `title`, or a difference graph's stored
// `state.display.description` — both plain strings when they're a report page's own graph text.
// `isAutoDiffCaption` (set by report_build.mjs only for a difference graph with no author-supplied
// `caption`) tells this function to IGNORE rawText and rebuild the "Base: X · Comparison: Y"
// phrase live instead — a near-verbatim port of report_build.mjs's own build-time expression
// (see its comment on `g._invert`/`g._assigned`), just resolved against the live catalog instead
// of baked once. `routeIds` is a graph's own `state.display._measurePick.routeIds` (ordered,
// index 0 = anchor unless `invert`); `pageState` is whatever the caller's own PageContext exposes.
export function resolveReportDisplayText(rawText, { routeIds, invert, isAutoDiffCaption, pageState } = {}) {
  const catalog = pageState?.filters?.find(f => f.searchKey === ROUTE_CATALOG_PARAM_KEY && f.type === 'action')?.values;
  // No catalog yet (RRL hasn't broadcast on this render pass) — a transient, self-correcting
  // state (the next broadcast re-renders this), not an error. An auto-caption has no stored
  // fallback text to fall back to (report_build.mjs never bakes one for this case), so it
  // renders nothing rather than a broken partial string; a title/explicit-caption still has its
  // original stored text to show as-is, same as before this mechanism existed.
  if (!Array.isArray(catalog) || !catalog.length) return isAutoDiffCaption ? null : rawText;
  const byCompId = new Map(catalog.map(r => [r.route_comp_id, r]));
  const ids = Array.isArray(routeIds) ? routeIds : [];

  if (isAutoDiffCaption) {
    if (ids.length < 2) return null;
    // Mirrors report_build.mjs's own `g._invert ? g._assigned[1] : g._assigned[0]` (anchor) /
    // `g._invert ? [g._assigned[0]] : g._assigned.slice(1)` (compare) exactly, index-for-index —
    // `_measurePick.routeIds` is built from `g._assigned.map(...)` in the same order.
    const anchor = byCompId.get(invert ? ids[1] : ids[0]);
    const compares = (invert ? [ids[0]] : ids.slice(1)).map(id => byCompId.get(id)).filter(Boolean);
    if (!anchor || !compares.length) return null;
    return `Base: ${resolvedRouteLabel(anchor)} · Comparison: ${compares.map(resolvedRouteLabel).join(', ')}`;
  }

  const route = byCompId.get(ids[0]);
  if (!route) return rawText;
  return substituteTokens(rawText, route) ?? rawText;
}
