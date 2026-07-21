// Both the already-added route rows (RouteRow) and the pending-add preview
// (AddRouteBanner) need to read a route/catalog-entry's TMC list — `tmc_array`
// arrives as a JSON string from most sources but can already be a real array
// depending on the query path it came through.
export function parseTmcArray(tmcArray) {
  if (!tmcArray) return [];
  if (Array.isArray(tmcArray)) return tmcArray;
  try {
    return JSON.parse(tmcArray);
  } catch (e) {
    console.error('Failed to parse tmc_array', e);
    return [];
  }
}
