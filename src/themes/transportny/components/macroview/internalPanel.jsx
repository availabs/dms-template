import { get } from "lodash-es";

import {
  PM3_LAYER_KEY,
  MPO_LAYER_KEY,
  COUNTY_LAYER_KEY,
  REGION_LAYER_KEY,
  UA_LAYER_KEY,
  BLANK_OPTION
} from "./constants";

// Pure descriptor function — no hooks. It's invoked as a plain function call
// (not rendered as JSX) by the shared InternalPluginPanel, so it must never
// call React hooks (see Comp's "PLUGIN-CONTROL SIDE EFFECTS" block for where
// the data-fetching that feeds `_availablePm3Views` below actually lives).
const InternalPanel = ({ state, setState }) => {
  const pluginDataPath = `symbology.pluginData.macroview`;

  const pm3LayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${PM3_LAYER_KEY}]`
  );
  const mpoLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${MPO_LAYER_KEY}]`
  );
  const countyLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${COUNTY_LAYER_KEY}]`
  );
  const regionLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${REGION_LAYER_KEY}]`
  );
  const uaLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${UA_LAYER_KEY}]`
  );

  const views = get(state, `${pluginDataPath}['_availablePm3Views']`, []);

  const borderLayerIds = [mpoLayerId, countyLayerId, pm3LayerId, regionLayerId, uaLayerId];
  return [
    {
      label: "PM3 Layer",
      controls: [
        {
          type: "select",
          params: {
            //TODO -- may need to more creatively filter out layers that are already being used by this/other plugin
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .filter(
                  (layerKey) =>
                    !borderLayerIds.includes(layerKey) ||
                    layerKey === pm3LayerId
                )
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${PM3_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "MPO Layer",
      controls: [
        {
          type: "select",
          params: {
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .filter(
                  (layerKey) =>
                    !borderLayerIds.includes(layerKey) ||
                    layerKey === mpoLayerId
                )
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${MPO_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "County Layer",
      controls: [
        {
          type: "select",
          params: {
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .filter(
                  (layerKey) =>
                    !borderLayerIds.includes(layerKey) ||
                    layerKey === countyLayerId
                )
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${COUNTY_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "Region Layer",
      controls: [
        {
          type: "select",
          params: {
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .filter(
                  (layerKey) =>
                    !borderLayerIds.includes(layerKey) ||
                    layerKey === regionLayerId
                )
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${REGION_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "UA Layer",
      controls: [
        {
          type: "select",
          params: {
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .filter(
                  (layerKey) =>
                    !borderLayerIds.includes(layerKey) ||
                    layerKey === uaLayerId
                )
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${UA_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "Hover Popup",
      controls: [
        {
          type: "select",
          params: {
            options: [
              { value: "hover", name: "Enabled" },
              { value: "", name: "Disabled" },
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['hover']`,
        },
      ],
    },
    pm3LayerId && views.length
      ? {
          label: "Views",
          controls: [
            {
              type: "multiselect",
              params: {
                options: [
                  ...views.map((view) => ({
                    name: view.version || view.view_id,
                    label: view.version || view.view_id,
                    value: view.view_id,
                  })),
                ],
                default: [],
                placeholder: "Select views to include...",
              },
              //the layer the plugin controls MUST use the `'active-layers'` path/field
              path: `['views']`,
            },
          ],
        }
      : {},
  ];
};

export {
  InternalPanel
}
