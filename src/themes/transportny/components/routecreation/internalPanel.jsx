import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import React, { useState, useEffect, useMemo, createContext, useRef } from "react"
import {get, set } from "lodash-es";

import {
  SHAPEFILE_LAYER_KEY,
  BLANK_OPTION
} from "./constants";
import {
  setInitialGeomStyle,
} from "./utils";


const InternalPanel = ({ state, setState }) => {
  const { falcor, falcorCache, pgEnv, baseUrl } = React.useContext(MapEditorContext);
  // console.log("internal panel state::", state)
  //if a layer is selected, use the source_id to get all the associated views
  let symbologyLayerPath = "";
  if (state.symbologies) {
    const symbName = Object.keys(state.symbologies)[0];
    const pathBase = `symbologies['${symbName}']`;
    symbologyLayerPath = `${pathBase}.symbology.layers`;
  } else {
    symbologyLayerPath = `symbology.layers`;
  }

  const {
    shapefileLayerId,
  } = useMemo(() => {
    const pluginDataPath = `symbology.pluginData.routecreation`;
    return {
      pluginDataPath,
      shapefileLayerId: get(
        state,
        `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`
      ),
    }
  }, [state]);


  const controls = [
    {
      label: "Shapefile Layer",
      controls: [
        {
          type: "select",
          params: {
            //TODO -- may need to more creatively filter out layers that are already being used by this/other plugin
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers)
                .map((layerKey, i) => ({
                  value: layerKey,
                  name: state.symbology.layers[layerKey].name,
                })),
            ],
            default: "",
          },
          //the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${SHAPEFILE_LAYER_KEY}]`,
        },
      ],
    },
  ];

  return controls;
}

export {
  InternalPanel
}
