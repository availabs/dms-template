/**
 * Metadata enrichment row mapping for the temp CH meta table.
 *
 * Ported from the legacy metadata.worker.mjs batch loop. Coverage gotcha
 * (preserved): countyFipsToRegion only covers NY (36), CT (09), NJ (34) —
 * every other state gets county_code/region_code null.
 */
const { countyFipsToRegion } = require('./lookups/county_fips_to_region.js');
const { uaCodeToUaName } = require('./lookups/ua_code_to_ua_name.js');
const { fipsCodeToState } = require('./lookups/fips_code_to_state.js');

/**
 * @param {Object} row  from ch-sql.tmcIdEnrichmentSelectSQL:
 *                      { tmc, year, state_name, county_name, ua_code }
 * @param {Object} directionalityByTmc  { tmc → { directionality, congestionLevel } }
 */
function enrichTmcIdRow(row, directionalityByTmc = {}) {
  const stateFips = Object.keys(fipsCodeToState)
    .find((fipsCode) => fipsCodeToState[fipsCode] === row.state_name);

  // 2-digit state fips narrows the county lookup; county matched by name.
  const county_code = Object.keys(countyFipsToRegion)
    .filter((countyFips) => countyFips.startsWith(stateFips))
    .find((countyFips) => countyFipsToRegion[countyFips].county_name === row.county_name);

  return {
    tmc: row.tmc || null,
    year: Number(row.year) || null,
    state_name: row.state_name || null,
    county_name: row.county_name || null,
    ua_code: row.ua_code || null,
    county_code: county_code || null,
    state_code: stateFips,
    region_code: countyFipsToRegion[county_code]?.region || null,
    congestion_level: directionalityByTmc[row.tmc]?.congestionLevel || null,
    directionality: directionalityByTmc[row.tmc]?.directionality || null,
    ua_name: uaCodeToUaName[row.ua_code] || null,
    mpo_code: null,
  };
}

module.exports = { enrichTmcIdRow };
