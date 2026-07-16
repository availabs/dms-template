import enhanceNfipClaimsV2 from '../data-types/mny/enhance_nfip_claims_v2/pages/index.jsx';
import map21 from '../data-types/map21/pages/index.jsx';
import npmrdsRaw from '../data-types/npmrds_raw/pages/index.jsx';
import npmrds from '../data-types/npmrds/pages/index.jsx';
import transcom from '../data-types/transcom/pages/index.jsx';
import excessiveDelay from '../data-types/excessive_delay/pages/index.jsx';
import pm3 from '../data-types/pm3/pages/index.jsx';
import nowPlaying from '../data-types/now_playing/pages/index.jsx';
import actions_location from "../data-types/mny/actions_location/pages/index.js"
import TMAS from "../data-types/traffic_counts/TMAS/pages/index.js"

const dataTypesByApp = {
  'mitigat-ny-prod' : {
    fima_nfip_claims_v2_enhanced: enhanceNfipClaimsV2,
    actions_location,
    tmas_uploader: TMAS
  },
  'npmrdsv5': {
    map21,
    npmrds_raw: npmrdsRaw,
    npmrds_raw_tmc_identification: npmrdsRaw,
    npmrds,
    npmrds_meta: npmrds,
    transcom,
    transcom_event_tmc: { defaultPages: ['table'] },
    transcom_congestion: { defaultPages: ['table'] },
    excessive_delay: excessiveDelay,
    pm3,
  },
  'wcdb': {
    now_playing_stream: nowPlaying,
  }
}

export default function getDataTypes(app) {
  return dataTypesByApp[app] || {}
};
