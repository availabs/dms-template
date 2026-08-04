import { cloneDeep } from 'lodash-es';
import { getRegisteredComponents } from '../../../../dms/packages/dms/src/patterns/page/components/sections/componentRegistry';
import { reconcileComparisonSeriesColumnOnState } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/useDataWrapperAPI';
import { applyMeasurePickToState } from '../MeasurePicker';
import { BASE_SOURCE } from '../MeasurePicker/composeMeasureConfig';

const AVL_GRAPH_ELEMENT_TYPE = 'AVL Graph';

// Which `group` a freshly composed graph section should join — the same group as this report's
// existing AVL Graph sections (Ryan's decision, 2026-08-03: append after existing graphs). Every
// SectionArray instance renders `value.filter(v => v.group === group.name || (!v.group &&
// group.name === 'default'))` in array order (sectionArray.jsx ~line 423) — pushing to the END of
// the full flat `draft_sections` array is therefore sufficient to render last within whichever
// group it's tagged with; no splice-index math needed. `undefined` (no existing AVL Graph section
// yet) falls through to that same 'default' bucket, matching a section that's never set `group`.
function findAvlGraphGroup(sectionList) {
  return (sectionList || []).find((s) => s?.element?.['element-type'] === AVL_GRAPH_ELEMENT_TYPE)?.group;
}

// Composes a brand-new "AVL Graph" section from an Add-Graph modal pick and pushes it into the
// page's own `draft_sections` — the same generic, already-in-production primitive "+ Add
// Component" and `dms section create` both use (splice an id-less inline object into
// `draft_sections`, `apiUpdate` -> `updateDMSAttrs.js` -> `dms.data.create`), not a new escape
// hatch. See dynamic-reports-and-route-tags.md's "Implementation plan, 2026-08-03" (Workstream 3)
// for the full design record.
export function useAddGraphSection({ item, apiUpdate, updateAttribute, isEdit }) {
  const addGraphSection = async (pick) => {
    if (!isEdit || !apiUpdate || !item?.id) return null;

    const RegisteredComponents = getRegisteredComponents();
    const graphComponent = RegisteredComponents[AVL_GRAPH_ELEMENT_TYPE];
    const state = cloneDeep(graphComponent.defaultState);
    // A brand-new section never has an existing Dataset to preserve — unlike
    // applyMeasurePickToState's own `if (!state.externalSource?.source_id)` guard, which exists
    // only for the already-configured-graph case (an author's own different Dataset pick).
    state.externalSource = { ...BASE_SOURCE.sourceInfo };

    const applied = applyMeasurePickToState(state, pick, {
      externalSourceColumns: BASE_SOURCE.sourceInfo.columns,
      defaultColors: graphComponent.defaultState?.display?.colors,
    });
    if (!applied) return null;
    reconcileComparisonSeriesColumnOnState(state);

    const trackingId = crypto.randomUUID();
    const sectionList = item.draft_sections || [];
    const newSection = {
      trackingId,
      group: findAvlGraphGroup(sectionList),
      is_draft: true,
      // Same shape sectionArray.jsx's own save() stamps onto every newly-created section.
      parent: JSON.stringify({ id: item.id, ref: `${item.app}+${item.type}` }),
      element: { 'element-type': AVL_GRAPH_ELEMENT_TYPE, 'element-data': JSON.stringify(state) },
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
