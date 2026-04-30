/**
 * Bootstrap entry point for app-owned DMS datatypes.
 *
 * dms-server loads this file at boot via the DMS_EXTRA_DATATYPES env var
 * and calls the exported function with { registerDatatype }. Each line
 * below adds one datatype plugin from this directory into the server.
 */
module.exports = function registerExtra({ registerDatatype }) {
  registerDatatype('map21', require('./map21'));
  registerDatatype('now_playing', require('./now_playing'));
  registerDatatype('enhance_nfip_claims_v2', require('./mny/enhance_nfip_claims_v2'));
};
