import { SHAPEFILE_LAYER_KEY, NETWORK_COLOR, ROUTE_COLOR, HIGHLIGHT_COLOR } from "./constants";
import { get, set } from "lodash-es";

const DataUpdate = (map, state, setState) => {
  let pluginDataPath = "";
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
  const tmc_array = get(state, `${pluginDataPath}['tmc_array']`, null);
  const hoveredTmc = get(state, `${pluginDataPath}['hovered_tmc']`, null);
  const shapefileLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`,
  );
  if (shapefileLayerId) {
    setState((draft) => {
      // Three paint states (npmrds-route-creation.html, routes-reports-users-mesh.md
      // Workstream E): network grey · route blue · highlighted amber. The highlighted TMC
      // always wins over "in route" - hovering a route segment (or its list row) should
      // always show as highlighted, whether or not it's also selected.
      let lineColor;
      if (tmc_array && tmc_array.length > 0) {
        lineColor = [
          "case",
          ["==", ["get", "tmc"], hoveredTmc || ""],
          HIGHLIGHT_COLOR,
          ["match", ["get", "tmc"], tmc_array, ROUTE_COLOR, NETWORK_COLOR],
        ];
      } else if (hoveredTmc) {
        lineColor = [
          "case",
          ["==", ["get", "tmc"], hoveredTmc],
          HIGHLIGHT_COLOR,
          NETWORK_COLOR,
        ];
      } else {
        lineColor = NETWORK_COLOR;
      }
      set(
        draft,
        `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']['line-color']`,
        lineColor,
      ); //Mapbox paint
    });
  }
};

export { DataUpdate };
