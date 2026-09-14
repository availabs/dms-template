import enhanceNfipClaimsV2 from '../data-types/mny/enhance_nfip_claims_v2/pages/index.jsx';
import map21 from '../data-types/map21/pages/index.jsx';
import npmrdsRaw from '../data-types/npmrds_raw/pages/index.jsx';
import npmrds from '../data-types/npmrds/pages/index.jsx';
import transcom from '../data-types/transcom/pages/index.jsx';
import excessiveDelay from '../data-types/excessive_delay/pages/index.jsx';
import pm3 from '../data-types/pm3/pages/index.jsx';
import nowPlaying from '../data-types/now_playing/pages/index.jsx';
import actions_location from "../data-types/mny/actions_location/pages/index.js"
import actions_cleaned from "../data-types/mny/actions_cleaned/pages/index.js"

import TMASvolume from "../data-types/traffic_counts/TMAS/volume/pages/index.js"
import TMASstations from "../data-types/traffic_counts/TMAS/stations/pages/index.js"

import osm from '../data-types/osm/pages/index.jsx';
import workZone from '../data-types/work_zone/pages/index.jsx';

const dataTypesByApp = {
  'mitigat-ny-prod' : {
    fima_nfip_claims_v2_enhanced: enhanceNfipClaimsV2,
    actions_location,
    actions_cleaned,
    tmas_volume_uploader: TMASvolume,
    tmas_stations_uploader: TMASstations
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
    // work_zone — one plugin, one output source per pipeline stage. Every
    // stage-output type gets the plugin's stage-selector Create page (it
    // preselects the stage that produces the type being created); wz_event_tmc
    // is a side output of the spine stage, so it is table-only.
    wz_event: workZone,
    wz_event_tmc: { defaultPages: ['table'] },
    wz_exposure: workZone,
    wz_speed: workZone,
    wz_queue: workZone,
    nys_crashes_open: workZone,
    nys_crashes_clear: workZone,
    wz_crash: workZone,
    wz_intrusions: workZone,
    wz_qa_ratings: workZone,
    nysdot_stip: workZone,
    wz_significant_sample: workZone,
    work_zone_measures: workZone,
    pm3,
    tmas_volume_uploader: TMASvolume,
    tmas_stations_uploader: TMASstations,
    OSM: osm,
  },
  'wcdb': {
    now_playing_stream: nowPlaying,
  }
}

export default function getDataTypes(app) {
  return dataTypesByApp[app] || {}
};
