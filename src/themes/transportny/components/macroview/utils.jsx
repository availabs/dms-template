import {get, set} from "lodash-es";
import { useRef, useEffect } from "react";
import { REGION_CODE_TO_NAME, UA_CODE_TO_NAME } from "./constants";

// Generic falcor-cache-shape unwrapper: {key: {value: X}} -> {key: X}.
// Inlined here since transportNY's original (~/pages/DataManager/MapEditor/attributes)
// is bespoke DataManager code that doesn't exist in this repo - this version is
// verbatim identical logic, just relocated (it never depended on anything DataManager-specific).
const getAttributes = (data) => {
  return Object.entries(data || {}).reduce((out, attr) => {
    const [k, v] = attr;
    typeof v.value !== "undefined" ? (out[k] = v.value) : (out[k] = v);
    return out;
  }, {});
};

// Standard React "value from the previous render" hook. Inlined for the same
// reason as getAttributes above - transportNY's original lives in bespoke
// DataManager code this repo doesn't have.
const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

const setGeometryBorderFilter = ({
  setState,
  layerId,
  geomDataKey,
  values,
  layerBasePath,
}) => {
  setState((draft) => {
    set(draft, `${layerBasePath}['${layerId}']['isVisible']`, true);

    const draftLayers = get(draft, `${layerBasePath}['${layerId}'].layers`);
    draftLayers.forEach((d, i) => {
      d.layout = { visibility: "visible" };
    });
    const geographyFilter = {
      columnName: geomDataKey,
      value: values,
      operator: "==",
    };
    set(
      draft,
      `${layerBasePath}['${layerId}']['filter']['${geomDataKey}']`,
      geographyFilter
    );
  });
};

const resetGeometryBorderFilter = ({ setState, layerId, layerBasePath }) => {
  setState((draft) => {
    set(draft, `${layerBasePath}['${layerId}']['isVisible']`, false);

    const draftLayers = get(draft, `${layerBasePath}['${layerId}'].layers`);
    draftLayers?.forEach((d, i) => {
      d.layout = { visibility: "none" };
    });
  });
};

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

function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

// Transforms the raw urban_code/region_code/mpo_name/county rows fetched for
// a view's geometry into the Geography multiselect's option list. Pure —
// no falcor/hooks — so it can be called both from Comp (which owns the fetch)
// and, if ever needed, from a plain descriptor function.
function buildGeomControlOptions(geomData) {
  if (!geomData) return [];

  const geoms = {
    urban_code: [],
    region_code: [],
    mpo_name: [],
    county: [],
    state: "NY",
  };

  Object.values(geomData).forEach((da) => {
    geoms.urban_code.push(da.urban_code);
    geoms.region_code.push(da.region_code);
    geoms.mpo_name.push(da.mpo_name);
    geoms.county.push(da.county);
  });

  const nameSort = (a, b) => (a.name < b.name ? -1 : 1);
  const objectFilter = (da) => typeof da !== "object";
  const truthyFilter = (val) => !!val;

  geoms.urban_code = geoms.urban_code
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      name: UA_CODE_TO_NAME[da] + " UA",
      label: UA_CODE_TO_NAME[da] + " UA",
      value: da,
      type: "urban_code",
    }))
    .sort(nameSort);
  geoms.region_code = geoms.region_code
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      name: REGION_CODE_TO_NAME[da],
      label: REGION_CODE_TO_NAME[da],
      value: da,
      type: "region_code",
    }))
    .sort(nameSort);
  geoms.mpo_name = geoms.mpo_name
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      name: da + " MPO",
      label: da + " MPO",
      value: da,
      type: "mpo_name",
    }))
    .sort(nameSort);
  geoms.county = geoms.county
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      name: da.toLowerCase() + " County",
      label: da.toLowerCase() + " County",
      value: da,
      type: "county",
    }))
    .sort(nameSort);

  return [
    ...geoms.county,
    ...geoms.mpo_name,
    ...geoms.urban_code,
    ...geoms.region_code,
  ];
}

export {
  setGeometryBorderFilter,
  resetGeometryBorderFilter,
  setInitialGeomStyle,
  onlyUnique,
  buildGeomControlOptions,
  getAttributes,
  usePrevious,
};
