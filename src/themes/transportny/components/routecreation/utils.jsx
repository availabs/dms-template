import { get, set } from "lodash-es";

const setInitialGeomStyle = ({ setState, layerId, layerBasePath }) => {
  setState((draft) => {
    const draftLayers = get(draft, `${layerBasePath}['${layerId}'].layers`);
    const borderLayer = draftLayers.find(
      (mapLayer) => mapLayer.type === "line"
    );
    if (borderLayer) {
      borderLayer.paint = { "line-color": "#fff", "line-width": 1 };
    }
    const fillLayer = draftLayers.find((mapLayer) => mapLayer.type === "fill");
    if (fillLayer) {
      fillLayer.paint = { "fill-opacity": 0, "fill-color": "#fff" };
    }
    draftLayers.forEach((d, i) => {
      d.layout = { visibility: "none" };
    });
  });
};

export {
  setInitialGeomStyle,
};
