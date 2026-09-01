import { useEffect, useRef, useState } from 'react';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { buildReportCatalogSource } from '../ReportPickerModal/reportCatalogSource';
import { parseTags } from '../RouteTagBrowserModal/tagCategories';

// Reads/writes JUST the `tags` field of a report's ONE `reports_snap_2` storage row — the report
// canvas HEADER's own view onto the same row `ReportRouteList/useReportRow.js` owns
// `routes`/`name`/`page_path` on (routes-reports-users-mesh.md, Workstream D: the inline header
// tag editor, next to Done). A separate hook/fetch, not lifted shared state, because
// ReportPageHeader and ReportRouteList are independent page sections with no shared React context
// for section-owned data — safe because every write here is a JSONB merge (the same `dms.data.edit`
// mechanism useReportRow.js's own persistTags already relies on) touching only the `tags` key,
// never `routes`/`name`/`page_path`.
//
// Builds its OWN `externalSource` from `buildReportCatalogSource(app)` (the same manually-declared
// reports_snap_2 shape ReportPickerModal's search already uses) rather than requiring the CMS
// admin-configured Dataset binding RRL's own section carries — this section has no such binding
// today, and there's no reason to require one just to read/write one JSON column.
//
// Mirrors useReportRow.js's load-correctness fixes exactly, not reinvented: `id` pushed as its own
// systemCol column (needed to update the right row, not create a duplicate), an id-less extraction
// treated as "no row yet" (a UDA query with 0 matching rows still returns one all-undefined
// placeholder, not an empty array), and a `forItemId` guard so a slow fetch can't clobber state
// after a newer report navigation has already moved on.
export function useReportTags({ apiLoad, apiUpdate, app, itemId }) {
  const [state, setState] = useState(null); // { id, tags, forItemId } | null
  const rowIdRef = useRef(null);
  const loadTargetIdRef = useRef(null);

  useEffect(() => {
    loadTargetIdRef.current = itemId ?? null;
    rowIdRef.current = null;
    setState(null);
    if (!apiLoad || !itemId || !app) return;

    const externalSource = buildReportCatalogSource(app);
    const udaConfig = buildUdaConfig({
      externalSource,
      columns: [
        ...externalSource.columns.filter((c) => c.name !== 'tags' && c.name !== 'id').map((c) => ({ ...c, show: true })),
        { name: 'tags', type: 'multiselect', options: null, show: true },
        { name: 'id', systemCol: true, show: true, sort: 'desc' },
      ],
      filters: { op: 'AND', groups: [{ col: "data->>'report_id'", op: 'filter', value: String(itemId) }] },
    });
    const config = {
      format: { ...externalSource },
      children: [{ action: 'uda', path: '/', filter: { options: JSON.stringify(udaConfig.options), attributes: udaConfig.attributes }, params: {} }],
    };

    apiLoad(config, '/').then((data) => {
      if (loadTargetIdRef.current !== itemId) return; // superseded by a newer report navigation
      const rawRow = data?.[0];
      const extracted = rawRow
        ? udaConfig.columnsToFetch.reduce((acc, col) => {
            const v = rawRow[col.reqName];
            acc[col.name] = (v && typeof v === 'object' && '$type' in v) ? v.value : v;
            return acc;
          }, {})
        : null;
      const row = extracted && extracted.id != null ? extracted : null; // id-less = no row
      rowIdRef.current = row ? row.id : null;
      setState({ id: row ? row.id : null, tags: row ? parseTags(row.tags) : [], forItemId: itemId });
    }).catch((e) => {
      if (loadTargetIdRef.current !== itemId) return;
      console.error('<ReportPageHeader:useReportTags>', e);
      rowIdRef.current = null;
      setState({ id: null, tags: [], forItemId: itemId });
    });
  }, [apiLoad, app, itemId]);

  const persistTags = async (nextTags) => {
    if (!apiUpdate || !itemId || !state || !app) return;
    const externalSource = buildReportCatalogSource(app);
    const storageDataFormat = { ...externalSource, type: `${externalSource.type}|${externalSource.view_id}:data` };
    const currentId = rowIdRef.current;
    const payload = { report_id: String(itemId), tags: JSON.stringify(nextTags) };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    rowIdRef.current = nextId;
    setState({ id: nextId, tags: nextTags, forItemId: itemId });
  };

  const tags = state?.forItemId === (itemId ?? null) ? state.tags : [];
  return { tags, persistTags, loaded: Boolean(state) };
}
