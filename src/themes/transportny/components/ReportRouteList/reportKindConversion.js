import { resolvedRouteLabel } from './relativeDateResolution';
import { resolveReportDisplayText } from './resolveReportDisplayText';
import { ROUTE_CATALOG_PARAM_KEY } from './useGraphPublish';

// The PURE half of "convert a report between static and dynamic," extracted from
// ReportRouteList.jsx (2026-09-15, report-save-as-copy.md) so there is exactly ONE definition of
// what each kind means. RRL's own Dynamic Report Switch applies these IN PLACE to the page being
// edited; ReportPageHeader's "Save as…" applies the identical transforms to a COPY, leaving the
// source report untouched. Nothing here reads React context, `item`, or fires a write — every
// function takes its inputs and returns new data, which is what makes the same code safe to point
// at a page that doesn't exist yet.
//
// Behavior is deliberately unchanged from the inlined originals; see each function's own note for
// the live bugs that shaped it, and ReportRouteList.jsx's call sites for the surrounding
// persistence/navigation choreography that stayed behind.

// A static route's catalog-snapshot fields, baked in at add time (`useReportRow.js`'s `addRoutes`,
// old-converter's `build_route_entry`) — stripped by `routesToSlots` below when turning a route
// into a slot, since a slot re-resolves them live from `?routes=` at view time instead of carrying
// a frozen copy (dynamic-reports-authoring-gaps.md sub-item 4). Deliberately does NOT include
// `route_comp_ids` (the converter-era comp-merge compatibility field) — that one must survive the
// conversion or an already-converted report's graphs bound to an absorbed comp id would stop
// resolving; see that sub-item's own "Correction" note for the confirmed-live repro.
export const CATALOG_SNAPSHOT_FIELDS = [
  'tmc_array', 'id', 'route_id', 'description', 'points', 'metadata',
  'conflation_array', 'conflation_version', 'created_at', 'created_by', 'updated_at',
  'isValid', 'graphIds',
];

// The two page-level filters that MAKE a report dynamic. `routeSlots` is the marker both
// ReportRouteList and ReportPageHeader test for (`isDynamicReport`); `baseDate` backs the
// "Viewing as of" control. Ids are fixed strings, matching what RRL has always written.
export const DYNAMIC_REPORT_FILTERS = [
  { id: 'dyn-report-routes', searchKey: 'routes', useSearchParams: true, values: '', type: 'routeSlots' },
  { id: 'dyn-report-asof', searchKey: 'asOf', useSearchParams: true, values: '', type: 'baseDate' },
];

// Strip any existing dynamic markers before re-adding, so converting twice can't accumulate
// duplicates. `existingFilters` may arrive as the raw JSON string the DB stores rather than a real
// array (found live 2026-09-09: `bi_directional`, freshly loaded, threw
// `(item.filters || []).filter is not a function`), so callers pass it through `parseIfJSON` first
// — these two take an already-parsed array and stay pure.
export function staticReportFilters(existingFilters = []) {
  return (existingFilters || []).filter((f) => f.type !== 'routeSlots' && f.type !== 'baseDate');
}

export function dynamicReportFilters(existingFilters = []) {
  return [...staticReportFilters(existingFilters), ...DYNAMIC_REPORT_FILTERS];
}

// Static → dynamic. Each route becomes a slot: catalog-snapshot fields dropped (a slot re-resolves
// them live), name reset to the `"%n (%y)"` template.
//
// The name reset REVERSES sub-item 4's original "leave a static route's name exactly as authored"
// decision, per Ryan's 2026-09-09 live bug report on a real converted route: a static route's
// literal name (e.g. "Ocean Pkwy," carried over from when it was picked via "+ Add Route") froze
// permanently into the new slot instead of templating, so it never re-resolved to whichever real
// route a viewer later picked, and showed that same stale literal name even fully unresolved.
// Every new slot now defaults to `"%n (%y)"`, identical to `handleAddRouteSlot`'s own default for a
// brand-new slot — converting a route into a slot behaves exactly like it was always an untouched,
// freshly-added slot, not a special "keep the old name frozen" case.
//
// Grouping by shared real catalog id applies ONLY to routes with no existing `route_slot_group`
// marker — an existing one is a deliberate signal (this report was already Dynamic once, converted
// to static, and is now converting back) that must be preserved verbatim, independent of whether
// the routes it names currently happen to share a real id. Found live 2026-09-09: the real
// `bi_directional` template's own NB (`$0`) and SB (`$1`) groups both temporarily referenced the
// same test route, and re-deriving grouping purely by shared id collapsed them into ONE group,
// silently discarding the NB/SB split (a viewer would then be asked to pick only ONE route and see
// identical data for both directions).
export function routesToSlots(routes) {
  const seenIdToGroupCompId = new Map();
  return (routes || []).map((r) => {
    const realId = r.id ?? r.route_id;
    const slot = { ...r, name: '%n (%y)' };
    CATALOG_SNAPSHOT_FIELDS.forEach((f) => delete slot[f]);
    if (r.route_slot_group == null && realId != null) {
      if (seenIdToGroupCompId.has(realId)) {
        slot.route_slot_group = seenIdToGroupCompId.get(realId);
      } else {
        seenIdToGroupCompId.set(realId, r.route_comp_id);
      }
    }
    return slot;
  });
}

// Dynamic → static. Takes the RESOLVED route list (`effectiveRoutes` — already run through
// `resolveRouteDates` against the current `?routes=`), never the raw slots.
//
// A slot's `name` may still carry unresolved `%n`/`%y` tokens (the default `"%n (%y)"` an author
// never customized) — freeze them into their CURRENTLY-resolved literal text now, since a static
// route has no live substitution mechanism to fill them in later. Found live 2026-09-09: leaving
// raw tokens baked into a permanent static name showed as a blank/broken label forever after (the
// header pill/chart legend read `" (2026)"` — `%n` silently substituted to empty, since
// `catalogRouteName` no longer exists once static). `resolvedRouteLabel` is a safe no-op for any
// name with no tokens. Must run BEFORE `catalogRouteName` is dropped — that's the field `%n`
// substitutes from.
export function slotsToStaticRoutes(resolvedList) {
  return (resolvedList || []).map((r) => {
    const { catalogRouteName, ...rest } = r;
    return { ...rest, name: resolvedRouteLabel(r) };
  });
}

// The field shape `useGraphPublish.js` broadcasts live as the route catalog, rebuilt here from a
// resolved route list. A build-time stand-in for that broadcast — not a new catalog shape — so
// `freezeSectionDisplayText` below can resolve `%n`/`%y` without a live page.
export function catalogFromResolvedRoutes(resolvedList) {
  return (resolvedList || []).map((r) => ({
    route_comp_id: r.route_comp_id, name: r.name, dateFormula: r.dateFormula,
    derivedFromRoute: r.derivedFromRoute, color: r.color, startDate: r.startDate,
    endDate: r.endDate, tmc_array: r.tmc_array, catalogRouteName: r.catalogRouteName,
  }));
}

// Freezes any live `%n`/`%y` substitution baked into a graph SECTION's own title/caption — a
// completely different data location from routes[] (a section row's `title` field and its
// `element['element-data']`-embedded `display.description`, not anything RRL's `routes` storage
// touches). Found live 2026-09-09 on the real `bi_directional` template: every one of its 14 graph
// titles ("Hours of Delay - %n") went permanently blank after "- " once converted to static — same
// root cause as the route-name bug (the broadcast catalog's `catalogRouteName` no longer exists
// once static, so `%n` substituted to empty).
//
// Defers to `resolveReportDisplayText` for every substitution rule rather than re-implementing any
// logic of its own. A safe no-op for any section with no `%n`/`%y` token (every non-report section,
// and any already-literal title/caption) by construction. Operates on whichever
// `draft_sections`/`sections` array is handed in; the two can carry genuinely different content
// (see `reference_draft_vs_published_sections_different_ids.md`), so both must be checked
// independently rather than assumed in sync.
export function freezeSectionDisplayText(sectionList, catalog) {
  const fakePageState = { filters: [{ searchKey: ROUTE_CATALOG_PARAM_KEY, type: 'action', values: catalog }] };
  let changed = false;
  const next = (sectionList || []).map((section) => {
    const elementData = section?.element?.['element-data'];
    if (typeof elementData !== 'string') return section;
    let state;
    try {
      state = JSON.parse(elementData);
    } catch (e) {
      return section;
    }
    const display = state?.display;
    const routeIds = display?._measurePick?.routeIds;
    const invert = display?.comparisonSeries?.combine?.invert;
    const isAutoDiffCaption = Boolean(display?._autoDiffCaption);
    const newTitle = resolveReportDisplayText(section.title, { routeIds, invert, pageState: fakePageState });
    const newDescription = isAutoDiffCaption
      ? resolveReportDisplayText(undefined, { routeIds, invert, isAutoDiffCaption: true, pageState: fakePageState })
      : resolveReportDisplayText(display?.description, { routeIds, invert, pageState: fakePageState });
    const titleChanged = newTitle !== section.title;
    // Auto-diff-caption: only freeze if it actually resolved (real anchor + compares found) —
    // `null` means "can't resolve yet," and leaving `_autoDiffCaption`/no `description` alone in
    // that case reproduces today's own "renders nothing" transient state rather than risking
    // wiping a caption based on an incomplete catalog.
    const descriptionChanged = isAutoDiffCaption ? newDescription != null : newDescription !== display?.description;
    if (!titleChanged && !descriptionChanged) return section;
    changed = true;
    const nextState = {
      ...state,
      display: {
        ...display,
        ...(descriptionChanged ? { description: newDescription, _autoDiffCaption: false } : {}),
      },
    };
    return {
      ...section,
      ...(titleChanged ? { title: newTitle } : {}),
      element: { ...section.element, 'element-data': JSON.stringify(nextState) },
    };
  });
  return { changed, sections: next };
}
