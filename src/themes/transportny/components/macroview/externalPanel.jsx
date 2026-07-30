import { get } from "lodash-es";
import { filters } from "./updateFilters";

// Pure descriptor function — no hooks. It's invoked as a plain function call
// (not rendered as JSX) by the shared ExternalPluginPanel, once per candidate
// tab plus once more for the active tab, so it must never call React hooks
// (see Comp's "PLUGIN-CONTROL SIDE EFFECTS" block for where the actual
// data-fetching/side-effecting logic that feeds this now lives).
const ExternalPanel = ({ state, setState, pathBase = "" }) => {
  const pluginDataPath = `${pathBase}`;

  const pluginData = get(state, pluginDataPath, {});

  const views = get(pluginData, ['views'], []);
  const viewId = get(pluginData, ['viewId'], null);
  const geography = get(pluginData, ['geography'], null);
  const measureFilters = get(pluginData, ['measureFilters'], filters);
  const geomControlOptions = get(pluginData, ['geomControlOptions'], []);

  //transform from filters into plugin inputs
  const measureControls = Object.keys(measureFilters)
    .filter((mFilterKey) => measureFilters[mFilterKey].active)
    .sort((keyA, keyB) => {
      const { order: orderA } = measureFilters[keyA];
      const { order: orderB } = measureFilters[keyB];
      if (!orderA && !orderB) {
        return 0;
      } else if (!orderA) {
        return -1;
      } else if (!orderB) {
        return 1;
      } else {
        return orderA - orderB;
      }
    })
    .map((mFilterKey) => {
      const mFilter = measureFilters[mFilterKey];

      return {
        label: mFilter.name,
        controls: [
          {
            type: mFilter.multi ? "multiselect" : mFilter.type,
            params: {
              options: mFilter.domain,
            },
            path: `['measureFilters']['${mFilterKey}'].value`,
          },
        ],
      };
    });

  const controls = [
    {
      label: "Geography",
      controls: [
        {
          type: "multiselect",
          params: {
            options: geomControlOptions,
            default: "",
            searchable: true,
          },
          path: `['geography']`,
        },
      ],
    },
    {
      label: "Year",
      controls: [
        {
          type: "select",
          params: {
            options: [...views],
            default: views[0],
          },
          path: `['viewId']`,
        },
      ],
    },
    ...measureControls,
  ];

  return controls;
};

export { ExternalPanel };
