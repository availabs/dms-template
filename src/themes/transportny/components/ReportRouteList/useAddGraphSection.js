import { useContext } from 'react';
import { cloneDeep } from 'lodash-es';
import { getRegisteredComponents } from '../../../../dms/packages/dms/src/patterns/page/components/sections/componentRegistry';
import { reconcileComparisonSeriesColumnOnState } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/useDataWrapperAPI';
import { CMSContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { applyMeasurePickToState } from '../MeasurePicker';
import { BASE_SOURCE, applyDefaultLegendPosition } from '../MeasurePicker/composeMeasureConfig';
import { composeMapSectionConfig } from '../MeasurePicker/composeMapConfig';
import { DEFAULT_GRAPH_SECTION_BORDER } from './reportSectionDefaults';

const AVL_GRAPH_ELEMENT_TYPE = 'AVL Graph';
const SPREADSHEET_ELEMENT_TYPE = 'Spreadsheet';
const MAP_ELEMENT_TYPE = 'Map';

// Which registered component a pick's shape actually creates. Table rides the same
// applyMeasurePickToState entry point as every chart shape — Spreadsheet's defaultState has the
// identical filters/display/columns/data/externalSource shape AVL Graph's does — but, since Tier
// 5D (report-authoring-ux-overhaul.md, 2026-08-20), composes through its OWN
// `composeTableMeasuresConfig` (N measures -> N yAxis-target columns + one unioned join), not
// plain `composeMeasureConfig` — a table has no one-measure ceiling the way every chart type
// still does, so it needed real special-casing there after all, just inside
// `applyMeasurePickToState`'s own dispatch rather than here. Map is handled entirely separately
// below (composeMapSectionConfig) — it has no columns/join shape at all, so it never goes through
// applyMeasurePickToState/graphComponent.defaultState like every entry in this map does.
const ELEMENT_TYPE_BY_GRAPH_TYPE = {
  Table: SPREADSHEET_ELEMENT_TYPE,
};

// Which `group` a freshly composed section should join — the same group as this report's
// existing sections of the SAME element type (Ryan's decision, 2026-08-03: append after existing
// graphs — extended here to "existing sections of this new one's own type" now that a pick can
// create something other than an AVL Graph). Every SectionArray instance renders `value.filter(v
// => v.group === group.name || (!v.group && group.name === 'default'))` in array order
// (sectionArray.jsx ~line 423) — pushing to the END of the full flat `draft_sections` array is
// therefore sufficient to render last within whichever group it's tagged with; no splice-index
// math needed. `undefined` (no existing section of this type yet) falls through to that same
// 'default' bucket, matching a section that's never set `group`.
function findGroupForElementType(sectionList, elementType) {
  return (sectionList || []).find((s) => s?.element?.['element-type'] === elementType)?.group;
}

// Composes a brand-new "AVL Graph" section from an Add-Graph modal pick and pushes it into the
// page's own `draft_sections` — the same generic, already-in-production primitive "+ Add
// Component" and `dms section create` both use (splice an id-less inline object into
// `draft_sections`, `apiUpdate` -> `updateDMSAttrs.js` -> `dms.data.create`), not a new escape
// hatch. See dynamic-reports-and-route-tags.md's "Implementation plan, 2026-08-03" (Workstream 3)
// for the full design record.
export function useAddGraphSection({ item, apiUpdate, updateAttribute, isEdit, allRoutes }) {
  // Only Map's own compose branch below reads this (a choropleth layer's tile join needs the
  // join-capable host — see composeMapConfig.js's header); every chart/table path is unaffected.
  const { API_HOST, fileUploadInfo } = useContext(CMSContext) || {};
  const apiHost = fileUploadInfo?.DAMA_HOST || API_HOST;

  const addGraphSection = async (pick) => {
    if (!isEdit || !apiUpdate || !item?.id) return null;

    let elementType;
    let state;
    if (pick.graphType === 'Map') {
      // Tier 5C/5I (report-authoring-ux-overhaul.md, 2026-08-20): Map's compose shape is
      // genuinely different from every chart/table entry point below — no columns/join/
      // externalSource concept at all — so it never touches applyMeasurePickToState or a
      // registered component's defaultState (Map's registry entry has none). See
      // composeMapConfig.js's own header for what's in/out of scope. `pick.measure` here is
      // Map's OWN measure key ('none'/'speed'/...), from AddGraphModal's Map-specific Measure
      // field — never the AVL-Graph measure list.
      elementType = MAP_ELEMENT_TYPE;
      state = composeMapSectionConfig({ measureKey: pick.measure, apiHost });
      state.display._measurePick = pick;
    } else {
      elementType = ELEMENT_TYPE_BY_GRAPH_TYPE[pick.graphType] || AVL_GRAPH_ELEMENT_TYPE;
      const RegisteredComponents = getRegisteredComponents();
      const graphComponent = RegisteredComponents[elementType];
      state = cloneDeep(graphComponent.defaultState);
      // A brand-new section never has an existing Dataset to preserve — unlike
      // applyMeasurePickToState's own `if (!state.externalSource?.source_id)` guard, which exists
      // only for the already-configured-graph case (an author's own different Dataset pick).
      state.externalSource = { ...BASE_SOURCE.sourceInfo };
      // NPMRDS's own per-graph-type default legend position (composeMeasureConfig.js's
      // DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE) — seeded once, here, at real creation time only;
      // never reasserted by applyMeasurePickToState below, so a later manual override (Settings
      // drawer, or QuickControls' own Legend pill) survives every future re-pick on this section.
      applyDefaultLegendPosition(state, pick.graphType);

      const applied = applyMeasurePickToState(state, pick, {
        externalSourceColumns: BASE_SOURCE.sourceInfo.columns,
        defaultColors: graphComponent.defaultState?.display?.colors,
        // Gap #16 (2026-08-21): reliability's year resolution needs each route's REAL resolved
        // date range — `allRoutes` is ReportRouteList's own already-resolveRouteDates()'d
        // `effectiveRoutes`, passed straight through rather than re-resolving here.
        allRoutes,
      });
      if (!applied) return null;
      reconcileComparisonSeriesColumnOnState(state);
      const seriesCol = state.columns.find((c) => c.origin === 'comparison-series');
      if (seriesCol && !seriesCol.customName) seriesCol.customName = 'Route';
    }

    const trackingId = crypto.randomUUID();
    const sectionList = item.draft_sections || [];
    const newSection = {
      trackingId,
      group: findGroupForElementType(sectionList, elementType),
      is_draft: true,
      // Same shape sectionArray.jsx's own save() stamps onto every newly-created section.
      parent: JSON.stringify({ id: item.id, ref: `${item.app}+${item.type}` }),
      border: DEFAULT_GRAPH_SECTION_BORDER,
      // Inline title/legend row (2026-09-04, Ryan) — selects the `reportInlineTitle` avlGraph
      // style (transportny/themev2.js), which is what actually reads `theme.titleInlineWithLegend`
      // in GraphComponent.jsx. Only meaningful for the real chart component ('AVL Graph' — Map has
      // no avlGraph theme to select, and Table/Spreadsheet has no chart legend at all).
      ...(elementType === AVL_GRAPH_ELEMENT_TYPE ? { activeStyle: 'reportInlineTitle' } : {}),
      element: { 'element-type': elementType, 'element-data': JSON.stringify(state) },
    };
    const nextSections = [...sectionList, newSection];

    // Optimistic local patch (matches sectionGroup.jsx's updateSections()) so the new graph
    // renders immediately, then the real persist — same two-call pattern every other section
    // mutation (drag-reorder, +Add Component, remove) already uses.
    if (updateAttribute) {
      updateAttribute('', '', { has_changes: true, draft_sections: nextSections });
    }
    await apiUpdate({ data: { id: item.id, draft_sections: nextSections, has_changes: true }, skipNavigate: true });

    return trackingId;
  };

  return { addGraphSection };
}
