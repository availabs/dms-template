import { useEffect, useRef, useState } from 'react';
import { fetchTmcMiles } from './fetchTmcMiles';
import { parseTmcArray } from './utils';

// A TMC's segment length genuinely differs by year (see fetchTmcMiles.js's own comment) — pick
// the year that matches THIS route's own date, so a route dated "3 Years Ago" shows its own
// year's length, not whatever year another route in the same report happens to be using.
// `route.startDate` is only a literal value for a resolved/fixed-date route; a Dynamic Report
// slot with a `dateFormula` has no literal date until view time (the live RouteRow preview
// resolves one for DISPLAY, but that resolution doesn't flow into this hook's plain `routes`
// list) — for those, and for any TMC missing the exact year, fall back to the most recent year
// on file rather than showing nothing.
function milesForRouteTmc(milesByTmcYear, tmc, year) {
  const byYear = milesByTmcYear.get(tmc);
  if (!byYear || !byYear.size) return 0;
  if (year != null && byYear.has(year)) return byYear.get(year);
  const mostRecentYear = Math.max(...byYear.keys());
  return byYear.get(mostRecentYear);
}

function routeYear(route) {
  if (!route.startDate) return null;
  const year = new Date(route.startDate).getFullYear();
  return Number.isFinite(year) ? year : null;
}

// Each route already carries its own tmc_array — enough to derive its real segment length
// without an author entering anything. One request-id-guarded effect (same pattern as
// useDynamicReportRoutes.js) fetches the distinct TMC set's per-year miles once per report and
// this hook sums each route's own TMCs against that lookup for THAT route's own year, rather
// than a per-route query.
export function useRouteMileage({ apiLoad, routes }) {
  const [milesByTmcYear, setMilesByTmcYear] = useState(new Map());
  const requestIdRef = useRef(0);

  const allTmcs = Array.from(new Set((routes || []).flatMap((r) => parseTmcArray(r.tmc_array)))).sort();
  const tmcsKey = allTmcs.join(',');

  useEffect(() => {
    if (!apiLoad || !allTmcs.length) {
      setMilesByTmcYear(new Map());
      return;
    }
    const requestId = ++requestIdRef.current;
    fetchTmcMiles({ apiLoad, tmcs: allTmcs })
      .then((m) => {
        if (requestIdRef.current !== requestId) return; // superseded by a newer route set
        setMilesByTmcYear(m);
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        console.error('<ReportRouteList:useRouteMileage>', e);
        setMilesByTmcYear(new Map());
      });
    // allTmcs itself isn't a dep — only its stable string identity (tmcsKey) should retrigger this.
  }, [apiLoad, tmcsKey]);

  const mileageByRouteCompId = new Map(
    (routes || []).map((r) => {
      const year = routeYear(r);
      return [
        r.route_comp_id,
        parseTmcArray(r.tmc_array).reduce((sum, tmc) => sum + milesForRouteTmc(milesByTmcYear, tmc, year), 0),
      ];
    })
  );

  return { mileageByRouteCompId };
}
