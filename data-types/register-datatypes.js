/**
 * Bootstrap entry point for app-owned DMS datatypes.
 *
 * dms-server loads this file at boot via the DMS_EXTRA_DATATYPES env var
 * and calls the exported function with { registerDatatype }. Each line
 * below adds one datatype plugin from this directory into the server.
 *
 * Each plugin is required and registered INDEPENDENTLY. dms-server wraps this
 * whole function in a single try/catch (see dms-server/src/index.js), so a
 * plugin whose top-level `require` throws — a missing optional dependency is
 * the usual cause — used to abort the bootstrap and silently take every
 * LATER plugin down with it. Registration order is not a dependency order,
 * so one broken plugin must not cost the others their routes.
 */
const PLUGINS = [
  ['map21', './map21'],
  ['npmrds_raw', './npmrds_raw'],
  ['npmrds', './npmrds'],
  ['transcom', './transcom'],
  ['excessive_delay', './excessive_delay'],
  ['pm3', './pm3'],
  ['osm', './osm'],
  ['now_playing', './now_playing'],
  ['enhance_nfip_claims_v2', './mny/enhance_nfip_claims_v2'],
  ['actions_location', './mny/actions_location'],
  ['actions_cleaned', './mny/actions_cleaned'],
  ['TMAS_volume_uploader', './traffic_counts/TMAS/volume'],
  ['TMAS_station_uploader', './traffic_counts/TMAS/stations'],
  ['routing', './routing']
];

module.exports = function registerExtra({ registerDatatype }) {
  const failed = [];
  for (const [name, modulePath] of PLUGINS) {
    try {
      registerDatatype(name, require(modulePath));
    } catch (e) {
      failed.push(name);
      console.error(`[datatypes] SKIPPED ${name} (${modulePath}): ${e.message}`);
    }
  }
  if (failed.length) {
    console.error(
      `[datatypes] ${failed.length} of ${PLUGINS.length} app datatypes did not register: ` +
      `${failed.join(', ')}. Their /dama-admin/:pgEnv/<name>/* routes will 404.`
    );
  }
};
