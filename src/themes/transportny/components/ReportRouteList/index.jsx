import ReportRouteList from "./ReportRouteList";

export default {
  name: "ReportRouteList",
  type: "ReportRouteList",
  EditComp: ReportRouteList,
  ViewComp: ReportRouteList,
  useDataSource: true,
  useDataWrapper: true,
  usesItemMutationProps: true,
  keepOriginalValues: true,
  useGetDataOnPageChange: true,
  useInfiniteScroll: true,
  showPagination: true,
  defaultState: {
    filters: { op: "AND", groups: [] },
    display: { usePagination: true, pageSize: 5, hideExternalToggle: true },
    columns: [],
    data: [],
    externalSource: { columns: [] },
  },
};
