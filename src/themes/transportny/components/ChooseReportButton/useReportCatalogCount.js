import { useEffect, useRef, useState } from 'react';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

// How many `reports_snap_2` rows a filter tree matches — the header trigger's "search N" figure
// and its "N matches" meta line (npmrds-reports.html rev 3, `syncTrigger`). A LENGTH request, not
// a row fetch: `udaLength` is the falcor path the dataWrapper's own `getLength()`
// (dataWrapper/getData.js) uses for pagination, so the figure obeys exactly the filter tree the
// picker would run and never pulls a row over the wire. Re-fires only when the (stringified) tree
// or the source identity changes; a superseded request's answer is dropped — the same requestId
// idiom as PickerModal/useCatalogFetch.js.
//
// The column list mirrors PickerModal/fetchCatalogRows.js: the source's declared columns plus
// the force-injected `tags` and `id`, so a filter leaf on `tags` (the visibility allow-list) or
// `created_by` (systemCol) resolves the same way it does for the picker's row fetch. A length
// request ignores the SELECT list itself.
export function useReportCatalogCount({ apiLoad, sourceInfo, filterGroups, enabled = true }) {
  const [count, setCount] = useState(null);
  const requestIdRef = useRef(0);
  const filterKey = JSON.stringify(filterGroups || []);
  const sourceId = sourceInfo?.source_id;
  const viewId = sourceInfo?.view_id;

  useEffect(() => {
    if (!enabled || !apiLoad || !sourceInfo?.columns) return;
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    (async () => {
      try {
        const columns = [
          ...sourceInfo.columns.filter((c) => c.name !== 'tags').map((c) => ({ ...c, show: true })),
          { name: 'tags', type: 'multiselect', options: null, show: true },
          { name: 'id', systemCol: true, show: true },
        ];
        const { options } = buildUdaConfig({
          externalSource: sourceInfo,
          columns,
          filters: { op: 'AND', groups: JSON.parse(filterKey) },
        });
        // getLength() strips the same two — neither affects a count.
        // eslint-disable-next-line no-unused-vars
        const { orderBy, meta, ...optionsForLen } = options;
        const raw = await apiLoad({
          format: { ...sourceInfo },
          children: [{ type: () => {}, action: 'udaLength', path: '/', filter: { options: JSON.stringify(optionsForLen) } }],
        });
        if (cancelled || requestIdRef.current !== requestId) return;
        const n = raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
        setCount(Number.isFinite(Number(n)) ? Number(n) : null);
      } catch (e) {
        if (cancelled || requestIdRef.current !== requestId) return;
        console.error('<ChooseReportButton:useReportCatalogCount>', e);
        setCount(null);
      }
    })();
    return () => { cancelled = true; };
    // sourceInfo is read fresh via closure; only its identity (source/view id) and the filter
    // tree retrigger the effect — the useCatalogFetch.js convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiLoad, sourceId, viewId, filterKey]);

  return count;
}
