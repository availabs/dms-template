import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

// The one canonical routes-catalog fetch — originally private to useTagBrowser.js, extracted so
// useDynamicReportRoutes.js (Dynamic Reports' view-time route resolution) can reuse it instead of
// growing a third near-duplicate copy (a second one, ReportRouteList/useRouteSearch.js, was
// already deleted as superseded by this one — see useTagBrowser.js's own history).
//
// Generalized over arbitrary AND-composed filterGroups, since callers need very different
// queries: useTagBrowser.js's four views (recent/search/tag-browse/tag-browse+search) filter on
// name/tags/created_at; useDynamicReportRoutes.js filters on `id` (resolving specific route ids
// supplied via a page's URL param).
export async function fetchCatalogRows({ apiLoad, routeSourceInfo, filterGroups, sort, limit }) {
  const columns = [
    // The routes catalog join-source binding (`routeSourceInfo`, see ReportRouteList.jsx's
    // comment on it) snapshots its column list at author-configure time and never refreshes —
    // the Report Page template (and every report already created from it) was last configured
    // before the `tags` column existed on the source, so `routeSourceInfo.columns` doesn't
    // include it even though the live source does (confirmed live: a stale 11-column snapshot
    // vs. the source's real 12). Force the correct definition in explicitly rather than trusting
    // the snapshot, so tag filtering works on every report regardless of when its join was last
    // configured — dropping any stale/absent `tags` entry from the snapshot first.
    ...routeSourceInfo.columns
      .filter((c) => c.name !== 'tags')
      .map((c) => (sort && c.name === sort.col ? { ...c, show: true, sort: sort.dir } : { ...c, show: true })),
    { name: 'tags', type: 'multiselect', options: null, show: true },
    { name: 'id', systemCol: true, show: true },
  ];

  const udaConfig = buildUdaConfig({
    externalSource: routeSourceInfo,
    columns,
    filters: { op: 'AND', groups: filterGroups },
  });

  const config = {
    format: { ...routeSourceInfo },
    children: [
      {
        action: 'uda',
        path: '/',
        filter: {
          fromIndex: 0,
          toIndex: Math.max(0, limit - 1),
          options: JSON.stringify(udaConfig.options),
          attributes: udaConfig.attributes,
        },
        params: {},
      },
    ],
  };

  const data = await apiLoad(config, '/');
  return (data || [])
    .map((rawRow) =>
      udaConfig.columnsToFetch.reduce((acc, col) => {
        const v = rawRow[col.reqName];
        acc[col.name] = v && typeof v === 'object' && '$type' in v ? v.value : v;
        return acc;
      }, {})
    )
    .filter((row) => row.id != null);
}
