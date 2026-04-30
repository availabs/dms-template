import enhanceNfipClaimsV2 from '../data-types/mny/enhance_nfip_claims_v2/pages/index.jsx';
import map21 from '../data-types/map21/pages/index.jsx';
import nowPlaying from '../data-types/now_playing/pages/index.jsx';

const dataTypesByApp = {
  'mitigat-ny-prod' : {
    fima_nfip_claims_v2_enhanced: enhanceNfipClaimsV2,
  },
  'npmrdsv5': {
    map21
  },
  'wcdb': {
    now_playing_stream: nowPlaying,
  }
}

export default function getDataTypes(app) {
  return dataTypesByApp[app] || {}
};
