import { SHAPEFILE_LAYER_KEY, NETWORK_COLOR, ROUTE_COLOR, HIGHLIGHT_COLOR } from "./constants";
import { npmrdsLineWidth, buildLineWidth } from "./paint";
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
      // line-width mirrors line-color's case/match shape exactly (selected and
      // hovered segments get the wider expr, everything else keeps the normal
      // by-zoom/by-classification width) - a route/highlight that's only a color
      // change reads as too subtle against this dark basemap (user report,
      // 2026-09-03), so the two paint props move together.
      // lineWidth's "is this feature selected/hovered" condition mirrors lineColor's
      // exactly (same isSelectedExpr each branch) - width and color pop for the same
      // features. Built via paint.js's buildLineWidth, NOT a `case`/`*` wrapped around
      // npmrdsLineWidth (a zoom-based interpolate) - MapLibre allows only one zoom-
      // based step/interpolate per expression, and nesting a second one is invalid and
      // gets silently rejected ("Only one zoom-based step or interpolate subexpression
      // may be used in an expression", logged on every hover - found live 2026-09-03).
      let lineColor, lineWidth;
      if (tmc_array && tmc_array.length > 0) {
        const isSelectedExpr = [
          "any",
          ["==", ["get", "tmc"], hoveredTmc || ""],
          ["in", ["get", "tmc"], ["literal", tmc_array]],
        ];
        lineColor = [
          "case",
          ["==", ["get", "tmc"], hoveredTmc || ""],
          HIGHLIGHT_COLOR,
          ["match", ["get", "tmc"], tmc_array, ROUTE_COLOR, NETWORK_COLOR],
        ];
        lineWidth = buildLineWidth(isSelectedExpr);
      } else if (hoveredTmc) {
        const isSelectedExpr = ["==", ["get", "tmc"], hoveredTmc];
        lineColor = [
          "case",
          isSelectedExpr,
          HIGHLIGHT_COLOR,
          NETWORK_COLOR,
        ];
        lineWidth = buildLineWidth(isSelectedExpr);
      } else {
        lineColor = NETWORK_COLOR;
        lineWidth = npmrdsLineWidth;
      }
      set(
        draft,
        `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']['line-color']`,
        lineColor,
      ); //Mapbox paint
      set(
        draft,
        `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']['line-width']`,
        lineWidth,
      ); //Mapbox paint
    });
  }
};

export { DataUpdate };
