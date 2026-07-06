import ReportRouteList from "./ReportRouteList";

const buildControls = (theme) => ({
  data: [
    { type: "toggle", label: "Allow Edit", key: "allowEditInView" },
    { type: "toggle", label: "Allow Add New", key: "allowAdddNew" },
    {
      type: "select",
      label: "Add New Behaviour",
      key: "addNewBehaviour",
      displayCdn: ({ display }) => display.allowAdddNew,
      options: [
        { label: "Please select", value: "" },
        { label: "Append Entry", value: "append" },
        { label: "Clear Form", value: "clear" },
        { label: "Navigate", value: "navigate" },
      ],
    },
    {
      type: "input",
      inputType: "text",
      label: "Navigate to",
      key: "navigateUrlOnAdd",
      displayCdn: ({ display }) => display.allowAdddNew && display.addNewBehaviour === "navigate",
    },
    { type: "toggle", label: "Show Total", key: "showTotal" },
    {
      type: "select",
      label: "Data Fetch Mode",
      key: "fetchMode",
      options: [
        { label: "Cache (use preloaded data)", value: "cache" },
        { label: "Smart (fetch on change)", value: "smart" },
        { label: "Force (always re-fetch)", value: "force" },
      ],
    },
  ],
});

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
  controls: buildControls,
  defaultState: {
    filters: { op: "AND", groups: [] },
    display: { usePagination: true, pageSize: 5, hideExternalToggle: true },
    columns: [],
    data: [],
    externalSource: { columns: [] },
  },
};
