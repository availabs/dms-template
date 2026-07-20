import { RouteComparisonEdit, RouteComparisonView } from "./RouteComparison";

// ComponentRegistry entry for the RouteComparison builder-rail section (a custom
// transportnyv2 page-section type). Registered in themev2.js `pageComponents`.
// Modeled on components/ReportRouteList/index.jsx.
//
// Like ReportRouteList this is a `useDataSource`/`useDataWrapper` component, but
// `state.data` (the dataWrapper's own row binding) is unused: the component drives
// a SIBLING pivoted Spreadsheet via published page state (`routes` + `route_tmcs`
// URL vars, `rc_scope` action param), not its own rendered rows.
export default {
  name: "RouteComparison",
  type: "RouteComparison",
  EditComp: RouteComparisonEdit,
  ViewComp: RouteComparisonView,
  useDataSource: true,
  useDataWrapper: true,
  // Needed for the deferred saved-comparison storage (Task 3.6): gives the
  // component apiLoad/apiUpdate props to read/write its report row, the same way
  // ReportRouteList persists routes. Harmless while storage is still a stub.
  usesItemMutationProps: true,
  controls: {
    more: [
      { type: "toggle", label: "Attribution", key: "showAttribution" },
    ],
  },
  defaultState: {
    filters: { op: "AND", groups: [] },
    display: { hideExternalToggle: true },
    columns: [],
    data: [],
    // STORAGE binding (deferred, Task 3.6) — the sectionMenu "Dataset" pick; the
    // page build points this at a report-row dataset keyed by page id, exactly
    // like ReportRouteList's reports_snap_2 row.
    externalSource: { columns: [] },
    // ROUTE CATALOG binding — the sectionMenu "Add Join Source" slot, pre-shaped
    // for Routes Data 2107426 / view 2107427 (npmrds2). Left join-INCOMPLETE on
    // purpose: `joinColumns: []` keeps buildUdaConfig.isJoinComplete() false so
    // this never fires a real SQL join (see the component + README). The page
    // build (Task 4 Step 2) must fully populate `sourceInfo` (columns, srcEnv,
    // baseUrl, type, isDms) by binding the source through the sectionMenu flow
    // (onJoinSourceChange) — the source/view ids below are only a starting hint.
    join: {
      sources: {
        route_catalog: {
          source: "2107426",
          view: "2107427",
          sourceInfo: {},
          joinColumns: [],
          mergeStrategy: "join",
          type: "left",
        },
      },
    },
  },
};
