import { useEffect, useRef, useState } from 'react';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { buildReportCatalogSource } from '../ReportPickerModal/reportCatalogSource';
import { parseTags } from '../RouteTagBrowserModal/tagCategories';

// Reads/writes the report canvas HEADER's own view onto a report's ONE `reports_snap_2` storage
// row — the same row `ReportRouteList/useReportRow.js` owns `routes`/`name`/`page_path` on
// (routes-reports-users-mesh.md, Workstream D: the inline header tag editor, next to Done; later
// extended for the header's own inline title editor). A separate hook/fetch, not lifted shared
// state, because ReportPageHeader and ReportRouteList are independent page sections with no shared
// React context for section-owned data — safe because every write here is a JSONB merge (the same
// `dms.data.edit` mechanism useReportRow.js's own persistTags/persistRoutes already rely on):
// `persistTags` touches only `tags`, `syncTitle` touches only `name`/`page_path`, neither ever
// clobbers a field it doesn't explicitly send.
//
// Builds its OWN `externalSource` from `buildReportCatalogSource(app)` (the same manually-declared
// reports_snap_2 shape ReportPickerModal's search already uses) rather than requiring the CMS
// admin-configured Dataset binding RRL's own section carries — this section has no such binding
// today, and there's no reason to require one just to read/write a couple of JSON columns.
//
// Mirrors useReportRow.js's load-correctness fixes exactly, not reinvented: `id` pushed as its own
// systemCol column (needed to update the right row, not create a duplicate), an id-less extraction
// treated as "no row yet" (a UDA query with 0 matching rows still returns one all-undefined
// placeholder, not an empty array), and a `forItemId` guard so a slow fetch can't clobber state
// after a newer report navigation has already moved on.
export function useReportCatalogRow({ apiLoad, apiUpdate, app, itemId }) {
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
      console.error('<ReportPageHeader:useReportCatalogRow>', e);
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

  // Syncs the catalog's `name`/`page_path` right when a report is renamed from the header's own
  // inline title editor (ReportPageHeader.jsx) — `updateTitle` (the core DMS page-title mechanism
  // in editFunctions.jsx, shared verbatim with the Bottom toolbar's Page Name field) only ever
  // writes the DMS page row's own `title`/`url_slug`; it has no idea `reports_snap_2` exists.
  // Without this, a rename would leave the catalog stale until the report's NEXT route/tag edit
  // (persistRoutes'/persistTags' own "self-healing" re-send in useReportRow.js) — which may never
  // happen for a report nobody touches again after the rename. Same currentId/no-row-yet-creates-
  // one shape as `persistTags` above; tags are never re-sent (JSONB merge leaves them untouched).
  const syncTitle = async (nextName, nextPagePath) => {
    if (!apiUpdate || !itemId || !state || !app) return;
    const externalSource = buildReportCatalogSource(app);
    const storageDataFormat = { ...externalSource, type: `${externalSource.type}|${externalSource.view_id}:data` };
    const currentId = rowIdRef.current;
    const payload = { report_id: String(itemId), name: nextName, page_path: nextPagePath };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    rowIdRef.current = nextId;
    setState((prev) => ({ id: nextId, tags: prev?.tags || [], forItemId: itemId }));
  };

  const tags = state?.forItemId === (itemId ?? null) ? state.tags : [];
  return { tags, persistTags, syncTitle, loaded: Boolean(state) };
}
