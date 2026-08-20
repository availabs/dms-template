import React from "react"
import {get, set} from "lodash-es";
import { filters, updateSubMeasures, getMeasure } from "./updateFilters"
import { InternalPanel } from "./internalPanel"
import { ExternalPanel } from "./externalPanel"
import { DataUpdate } from "./dataUpdate"
import { Comp } from "./comp";
import { removeWorstPoints } from "./worstPoints";

const MAP_CLICK = () => console.log("map was clicked");
export const MacroviewPlugin = {
    id: "macroview",
    type: "plugin",
    // This plugin renders its OWN floating panels pinned to the map's edges (comp.jsx →
    // controlsPanel top-left, contextPanel top-right, mapChrome bottom band), so it asks
    // core for the full-width overlay: without this the map-actions column reserves
    // ~176px and the right panel stops ~200px short of the map's right edge. Read by
    // ComponentRegistry/map/index.jsx → AvlMap's `floatMapActions` (opt-in, default off).
    // The bottom-right corner then belongs to core's nav controls — which is why the
    // download pill sits in the bottom-LEFT chrome bar (mapChrome.jsx).
    fullWidthOverlay: true,
    mapRegister: (map, state, setState) => {
      map.on("click", MAP_CLICK);
      let pluginDataPath = '';

      //state.symbologies indicates that the map context is DMS
      if(state.symbologies) {
        const symbName = Object.keys(state.symbologies)[0];
        const pathBase = `symbologies['${symbName}']`
        pluginDataPath = `${pathBase}.symbology.pluginData.macroview`
      } else {
        pluginDataPath = `symbology.pluginData.macroview`;
      }

      const newFilters = updateSubMeasures(filters);

      setState(draft => {
        set(draft, `${pluginDataPath}['measureFilters']`, newFilters);
      })
    },
    dataUpdate: DataUpdate,
    internalPanel: InternalPanel,
    externalPanel: ExternalPanel,
    comp: Comp,
    cleanup: (map, state, setState) => {
      //map.off("click", MAP_CLICK);
      // The worst-N point overlay is a maplibre source + layer this plugin adds DIRECTLY
      // to the map (comp.jsx → worstPoints.js), so core's AvlLayer teardown — which only
      // removes the layers it declared — knows nothing about it. Without this it outlives
      // the plugin on any style that survives the unmount.
      removeWorstPoints(map);
    },
  }
