/**
 * Bootstrap entry point for app-owned DMS datatypes.
 *
 * dms-server loads this file at boot via the DMS_EXTRA_DATATYPES env var
 * and calls the exported function with { registerDatatype }. Each line
 * below adds one datatype plugin from data-types/ into the server.
 */
module.exports = function registerExtra({ registerDatatype }) {
  registerDatatype('map21', require('../data-types/map21'));
  registerDatatype('enhance_nfip_claims_v2', require('../data-types/mny/enhance_nfip_claims_v2'));
};
