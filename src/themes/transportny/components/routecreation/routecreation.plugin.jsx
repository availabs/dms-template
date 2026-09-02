import React from "react"
import {get, set} from "lodash-es";
import { InternalPanel } from "./internalPanel"
import { DataUpdate } from "./dataUpdate"
import { Comp } from "./comp";
import {
  SHAPEFILE_LAYER_KEY,
  BLANK_OPTION
} from "./constants";
import { npmrdsPaint } from "./paint";
export const RoutecreationPlugin = {
    id: "routecreation",
    type: "plugin",
    // This plugin renders its OWN floating panels pinned to the map's edges (comp.jsx →
    // RouteIdentityPanel top-left, RouteEditor's editorWrapper top-right, ModeHintPill
    // bottom-center), so it asks core for the full-width overlay: without this the
    // map-actions column reserves ~176px and editorWrapper (pinned `right-2`) stops short
    // of the map's right edge. Same precedent as macroview.plugin.jsx — read by
    // ComponentRegistry/map/index.jsx → AvlMap's `floatMapActions` (opt-in, default off).
    fullWidthOverlay: true,
    mapRegister: (map, state, setState) => {
      let pluginDataPath = '';
      let symbologyLayerPath = "";
      let symbPath = "";
      //state.symbologies indicates that the map context is DMS
      if (state.symbologies) {
        const symbName = Object.keys(state.symbologies)[0];
        const pathBase = `symbologies['${symbName}']`;
        pluginDataPath = `${pathBase}.symbology.pluginData.routecreation`;
        symbologyLayerPath = `${pathBase}.symbology.layers`;
        symbPath = `${pathBase}.symbology`;
      } else {
        pluginDataPath = `symbology.pluginData.routecreation`;
        symbologyLayerPath = `symbology.layers`;
        symbPath = `symbology`;
      }

      const shapefileLayerId = get(
        state,
        `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`
      )

      if(shapefileLayerId) {
        setState((draft) => {
          set(
            draft,
            `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']`,
            { ...npmrdsPaint }
          ); //Mapbox paint
          // SymbologyViewLayer's getLayerTileUrl only appends `?cols=` when a layer
          // sets data-column/filter/filter-group/dynamic-filters; otherwise PostGIS's
          // ST_AsMVT excludes every property but geom/ogc_fid, so click hit-testing
          // gets back an empty `properties`. This layer has no real filter/color
          // binding to a column - piggyback on that machinery purely to get `tmc`
          // included in tile properties.
          set(
            draft,
            `${symbologyLayerPath}['${shapefileLayerId}']['data-column']`,
            'tmc'
          );
        });
      }
    },
    dataUpdate: DataUpdate,
    internalPanel: InternalPanel,
    externalPanel: () => {},
    comp: Comp,
    cleanup: (map, state, setState) => {
      //map.off("click", MAP_CLICK);
    },
  }
