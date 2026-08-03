import { SHAPEFILE_LAYER_KEY } from "./constants";
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
  const shapefileLayerId = get(
    state,
    `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`,
  );
  if (shapefileLayerId) {
    setState((draft) => {
      let lineColor = "#CCCCCC"; // The fallback color if it DOES NOT match (e.g., Gray)
      if (tmc_array && tmc_array.length > 0) {
        set(
          draft,
          `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']['line-color']`,
          [
            "match",
            ["get", "tmc"], // The property to check
            tmc_array, // Your list of TMCs
            "#FF0000", // The color if it matches (e.g., Red)
            lineColor,
          ],
        ); //Mapbox paint
      } else {
        set(
          draft,
          `${symbologyLayerPath}['${shapefileLayerId}']['layers'][1]['paint']['line-color']`,
          lineColor,
        ); //Mapbox paint
      }
    });
  }
};

export { DataUpdate };
