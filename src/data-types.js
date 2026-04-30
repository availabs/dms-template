import enhanceNfipClaimsV2 from '../data-types/mny/enhance_nfip_claims_v2/pages/index.jsx';
import map21 from '../data-types/map21/pages/index.jsx';

const dataTypesByApp = {
  'mitigat-ny-prod' : {
    fima_nfip_claims_v2_enhanced: enhanceNfipClaimsV2,
  },
  'npmrdsv5': {
    map21
  }
}

export default function getDataTypes(app) {
  return dataTypesByApp[app] || {}
};
