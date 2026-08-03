import {get, set } from "lodash-es";
import { filters, updateSubMeasures, getMeasure } from "./updateFilters"
import {
  PM3_LAYER_KEY,
} from "./constants";

const DataUpdate = (map, state, setState) => {
  //console.log("---data update-----")
  //9/4 9:02am looks like data update does not fire for DMS map
  //console.log("testing old filters and json code")

  //console.log({filters})
  //updateSubMeasures(this.filters.measure.value, this.filters, falcor);

  let pluginDataPath = "";
  let symbologyDataPath = "";
  if (state.symbologies) {
    const symbName = Object.keys(state.symbologies)[0];
    const pathBase = `symbologies['${symbName}']`;
    pluginDataPath = `${pathBase}.symbology.pluginData.macroview`;
    symbologyDataPath = `${pathBase}.symbology.layers`;
  } else {
    pluginDataPath = `symbology.pluginData.macroview`;
    symbologyDataPath = `symbology.layers`;
  }

  //console.log("plugin Data gets updated", { map, state, setState });
  const hover = get(state, `${pluginDataPath}['hover']`, "");
  const pm1 = get(state, `${pluginDataPath}['pm-1']`, null);
  const peak = get(state, `${pluginDataPath}['peak']`, null);
  const viewId = get(state, `${pluginDataPath}['viewId']`, null);
  const allPluginViews = get(state, `${pluginDataPath}['views']`, []);
  const geography = get(state, `${pluginDataPath}['geography']`, null);
  const pm3LayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${PM3_LAYER_KEY}]`,
    null
  );
  const measureFilters = get(
    state,
    `${pluginDataPath}['measureFilters']`,
    filters
  );
  const pm3MapLayers = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].layers`,
    null
  );
  const pm3MapSources = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].sources`,
    null
  );
  const layerViewId = get(
    state,
    `${symbologyDataPath}['${pm3LayerId}'].view_id`,
    null
  );

  if (pm3LayerId && viewId) {
    //Update map with new viewId
    setState((draft) => {
      //console.log("data update for plugin, draft::", JSON.parse(JSON.stringify(draft)));

      //9/4 9:36am TODO test that `pm3MapLayers[0]` still works in the mapEditor
      //tbh i am not totally sure how this worked in thefirst place. I prob just references the layers differently.
      const newLayer = JSON.parse(
        JSON.stringify(pm3MapLayers).replaceAll(layerViewId, viewId)
      );
      const newSources = JSON.parse(
        JSON.stringify(pm3MapSources).replaceAll(layerViewId, viewId)
      );
      const newDataColumn = getMeasure(measureFilters);
      set(draft, `${symbologyDataPath}['${pm3LayerId}']['layers']`, newLayer);
      set(
        draft,
        `${symbologyDataPath}['${pm3LayerId}']['sources']`,
        newSources
      );
      set(draft, `${symbologyDataPath}['${pm3LayerId}']['view_id']`, viewId);

      set(draft, `${symbologyDataPath}['${pm3LayerId}']['hover']`, hover);
      set(
        draft,
        `${symbologyDataPath}['${pm3LayerId}']['data-column']`,
        newDataColumn
      ); //must set data column, or else tiles will not have that data
    });
  } else if (pm3LayerId && !viewId && allPluginViews?.length > 0) {
    console.log("fallback no view selected")
    console.log({pluginDataPath, allPluginViews, pm3LayerId})
    //if no view is selected, but there is at least 1 element in views, select that 1 element
    setState((draft) => {
      set(draft, `${pluginDataPath}['viewId']`, allPluginViews[0].value);
    });
  }
};

export { DataUpdate };
