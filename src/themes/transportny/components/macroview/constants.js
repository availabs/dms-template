import { uaCodeToUaName as UA_CODE_TO_NAME} from "./ua_code_to_name";
const REGION_CODE_TO_NAME = {
  1: "Region 1 - Capital District",
  2: "Region 2 - Mohawk Valley",
  3: "Region 3 - Central New York",
  4: "Region 4 - Genesee Valley",
  5: "Region 5 - Western New York",
  6: "Region 6 - Southern Tier/Central New York",
  7: "Region 7 - North Country",
  8: "Region 8 - Hudson Valley",
  9: "Region 9 - Southern Tier",
  10: "Region 10 - Long Island",
  11: "Region 11 - New York City",
};

const PM3_LAYER_KEY = "pm3";
const MPO_LAYER_KEY = "mpo";
const COUNTY_LAYER_KEY = "county";
const REGION_LAYER_KEY = 'region'
const UA_LAYER_KEY = 'ua'

const BLANK_OPTION = { value: "", name: "" };

export {
  REGION_CODE_TO_NAME,
  UA_CODE_TO_NAME,
  PM3_LAYER_KEY,
  MPO_LAYER_KEY,
  COUNTY_LAYER_KEY,
  REGION_LAYER_KEY,
  UA_LAYER_KEY,
  BLANK_OPTION
};
