import React from "react"
import {get, set} from "lodash-es";
import { InternalPanel } from "./internalPanel"
import { DataUpdate } from "./dataUpdate"
import { Comp } from "./comp";
import {
  SHAPEFILE_LAYER_KEY,
  CLICK_TOLERANCE_PX,
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
          // Every click here already has a meaning (select/deselect a TMC, or drop a
          // marker) via useMapTmcHandler/useMapMarkerHandler, so the shared map
          // framework's global click-to-pin listener (avl-map.jsx `pinHoverComp`) fires
          // on the SAME click - left fully on (the default), every segment/marker click
          // would leave behind a permanent popup, stacking indefinitely ("old tooltip
          // never goes away" reported 2026-09-03). Pinning itself is still wanted
          // (2026-09-03 follow-up: "i kinda still want them to be pinnable, just only 1
          // open at a time") - `pinExclusive` makes each new pin replace the last
          // instead of disabling pinning outright (isPinnable stays at its true
          // default).
          set(
            draft,
            `${symbologyLayerPath}['${shapefileLayerId}']['pinExclusive']`,
            true
          );
          // Keeps the generic hover-popup hit test (avl-layer.jsx) in sync with the
          // widened click/highlight hit test below (useMapTmcHandler/
          // useMapHoverHandler) - same CLICK_TOLERANCE_PX box on both sides, so a
          // segment that's close enough to click is also close enough to show its
          // tooltip. Without this the two hit tests silently drifted apart once the
          // click side was widened - "you could click to add a tmc but never see a
          // popover" reported 2026-09-03.
          set(
            draft,
            `${symbologyLayerPath}['${shapefileLayerId}']['hoverTolerance']`,
            CLICK_TOLERANCE_PX
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
