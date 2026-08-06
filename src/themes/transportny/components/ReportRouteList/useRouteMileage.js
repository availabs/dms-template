import { useEffect, useRef, useState } from 'react';
import { fetchTmcMiles } from './fetchTmcMiles';
import { parseTmcArray } from './utils';

// Each route already carries its own tmc_array — enough to derive its real segment length
// without an author entering anything. One request-id-guarded effect (same pattern as
// useDynamicReportRoutes.js) fetches the distinct TMC set's miles once per report and this hook
// sums each route's own TMCs against that lookup, rather than a per-route query.
export function useRouteMileage({ apiLoad, routes }) {
  const [milesByTmc, setMilesByTmc] = useState(new Map());
  const requestIdRef = useRef(0);

  const allTmcs = Array.from(new Set((routes || []).flatMap((r) => parseTmcArray(r.tmc_array)))).sort();
  const tmcsKey = allTmcs.join(',');

  useEffect(() => {
    if (!apiLoad || !allTmcs.length) {
      setMilesByTmc(new Map());
      return;
    }
    const requestId = ++requestIdRef.current;
    fetchTmcMiles({ apiLoad, tmcs: allTmcs })
      .then((m) => {
        if (requestIdRef.current !== requestId) return; // superseded by a newer route set
        setMilesByTmc(m);
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        console.error('<ReportRouteList:useRouteMileage>', e);
        setMilesByTmc(new Map());
      });
    // allTmcs itself isn't a dep — only its stable string identity (tmcsKey) should retrigger this.
  }, [apiLoad, tmcsKey]);

  const mileageByRouteCompId = new Map(
    (routes || []).map((r) => [
      r.route_comp_id,
      parseTmcArray(r.tmc_array).reduce((sum, tmc) => sum + (milesByTmc.get(tmc) || 0), 0),
    ])
  );

  return { mileageByRouteCompId };
}
