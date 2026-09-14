import ReportPageHeader from "./ReportPageHeader";

export default {
  name: "ReportPageHeader",
  type: "ReportPageHeader",
  EditComp: ReportPageHeader,
  ViewComp: ReportPageHeader,
  useDataSource: true,
  useDataWrapper: true,
  useGetDataOnPageChange: false,
  useInfiniteScroll: false,
  showPagination: false,
  defaultState: {
    filters: { op: "AND", groups: [] },
    display: {
      kickerLabel: "",
      metaLine: "",
      purpose: "",
    },
    columns: [],
    data: [],
    externalSource: { columns: [] },
  },
};
