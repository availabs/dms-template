/**
 * Bootstrap entry point for app-owned DMS datatypes.
 *
 * dms-server loads this file at boot via the DMS_EXTRA_DATATYPES env var
 * and calls the exported function with { registerDatatype }. Each line
 * below adds one datatype plugin from data-types/ into the server.
 */
module.exports = function registerExtra({ registerDatatype }) {
  registerDatatype('map21', require('../data-types/map21'));
  registerDatatype('now_playing', require('../data-types/now_playing'));
  // registerDatatype('enhance-nfip-claims', require('../data-types/enhance-nfip-claims'));
};
