import React from "react"
import {get, set} from "lodash-es";
import { filters, updateSubMeasures, getMeasure } from "./updateFilters"
import { InternalPanel } from "./internalPanel"
import { ExternalPanel } from "./externalPanel"
import { DataUpdate } from "./dataUpdate"
import { Comp } from "./comp";

const MAP_CLICK = () => console.log("map was clicked");
export const MacroviewPlugin = {
    id: "macroview",
    type: "plugin",
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
    },
  }
