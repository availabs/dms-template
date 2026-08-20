import {get, set} from "lodash-es";
import { useRef, useEffect } from "react";
import { REGION_CODE_TO_NAME, UA_CODE_TO_NAME, GEOM_FAMILIES } from "./constants";

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

// Words that stay lower-case inside a name (English + the French/Ontario border
// municipalities the NPMRDS network reaches into). Checked against the REAL distinct
// county list on view 3425, not guessed: the awkward ones are
//   NIAGARA-ON-THE-LAKE · LEEDS AND THE THOUSAND ISLANDS · ST-BERNARD-DE-LACOLLE ·
//   ST-PAUL-DE-L'ÎLE-AUX-NOIX · EDWARDSBURGH/CARDINAL · ST LAWRENCE · NEW YORK
// and each one lands on its official spelling with this list.
const GEO_NAME_SMALL_WORDS = new Set([
  "and", "the", "of", "on", "in", "at", "de", "du", "des", "la", "le", "les", "aux",
  "au", "l", "d",
]);

// County values arrive UPPER-CASE from the source ("ALBANY", "ST LAWRENCE"), and were
// being displayed as `da.toLowerCase() + " County"` — i.e. "albany County". Title-case
// them for DISPLAY only; `value` (the filter key) is never touched.
//
// The split keeps its delimiters, so spaces, hyphens, slashes and apostrophes all
// survive in place: "ST-PAUL-DE-L'ÎLE-AUX-NOIX" → "St-Paul-de-l'Île-aux-Noix",
// "EDWARDSBURGH/CARDINAL" → "Edwardsburgh/Cardinal". No punctuation is INVENTED —
// the data has "ST LAWRENCE" with no period, so the label is "St Lawrence County".
function titleCaseGeoName(raw) {
  const parts = String(raw ?? "").split(/([\s\-/'’])/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (!part || /^[\s\-/'’]$/.test(part)) return part;
      const lower = part.toLocaleLowerCase();
      const isFirstWord = wordIndex === 0;
      wordIndex += 1;
      if (!isFirstWord && GEO_NAME_SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join("");
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
      // 99998 / 99999 are sentinel urban codes with an EMPTY ua_name in the data
      // (verified on view 3425: 1,212 and 2,973 rows, both with ua_name = "") and no
      // entry in UA_CODE_TO_NAME, so they used to render as "undefined UA". They were
      // invisible while the list was capped at 60 county rows; now that every family
      // is reachable they need an honest label, and the code is all the data gives.
      name: UA_CODE_TO_NAME[da] ? `${UA_CODE_TO_NAME[da]} UA` : `Urban code ${da}`,
      label: UA_CODE_TO_NAME[da] ? `${UA_CODE_TO_NAME[da]} UA` : `Urban code ${da}`,
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
    // NUMERIC, not by name: NYSDOT regions are numbered, and a name sort put them in
    // "Region 1 · Region 10 · Region 11 · Region 2 …" order. Nobody saw it before,
    // because the region family never made it into the rendered list at all.
    .sort((a, b) => +a.value - +b.value);
  geoms.mpo_name = geoms.mpo_name
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      // 6 of the 21 MPO names on this view already END in "MPO" ("Berkshire MPO",
      // "Erie MPO", "Oahu MPO", "South Western MPO", "Housatonic Valley MPO",
      // "Northeastern Pennsylvania Planning Alliance MPO"), so the unconditional suffix
      // read "Berkshire MPO MPO". Invisible while the option list was capped at 60
      // counties and no MPO could ever be seen.
      name: /\bMPO$/.test(da) ? da : `${da} MPO`,
      label: /\bMPO$/.test(da) ? da : `${da} MPO`,
      value: da,
      type: "mpo_name",
    }))
    .sort(nameSort);
  geoms.county = geoms.county
    .filter(onlyUnique)
    .filter(objectFilter)
    .filter(truthyFilter)
    .map((da) => ({
      name: titleCaseGeoName(da) + " County",
      label: titleCaseGeoName(da) + " County",
      value: da,
      type: "county",
    }))
    .sort(nameSort);

  // Order by FAMILY, smallest first (GEOM_FAMILIES), not counties-first: the controls
  // panel renders this list grouped under family headers, and the order here is the
  // order the groups appear in. Still ONE flat array of `{name,label,value,type}` —
  // the shape that is written into pluginData.geomControlOptions and that the
  // `geography` chips store — so nothing downstream has to change.
  return GEOM_FAMILIES.flatMap((family) => geoms[family.type] || []);
}


// The PM3 layer's `dynamic-filters` as a pure function of the geography chips — the
// array the TILES honour (`reference_dms_map_filtering`) and the array
// `buildLayerUdaFilterOptions` merges for every panel side-query.
//
// It is a named helper because TWO effects in comp.jsx write it: the geography effect
// (when the chips change) and the repair effect (when core's own `dataPageFilters` sync
// blanks the values — it resets `filter.values` for every dynamic-filter that has no
// matching page variable, which is every one of these, on ANY page-filter change). Two
// hand-rolled copies of this shape would drift, and the drift would be invisible: the
// map would just quietly show the whole state again.
const buildGeographyDynamicFilters = (geography) => {
  const byType = (geography || []).reduce((acc, curr) => {
    if (!curr?.type) return acc;
    if (!acc[curr.type]) acc[curr.type] = [];
    acc[curr.type].push(curr.value);
    return acc;
  }, {});
  return Object.keys(byType).map((column_name) => ({
    display_name: column_name,
    column_name,
    values: byType[column_name],
    zoomToFilterBounds: true,
  }));
};

export {
  setGeometryBorderFilter,
  buildGeographyDynamicFilters,
  resetGeometryBorderFilter,
  setInitialGeomStyle,
  onlyUnique,
  buildGeomControlOptions,
  getAttributes,
  usePrevious,
};
