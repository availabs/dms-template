import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';

// The one canonical "fetch rows from a DMS catalog source via UDA" helper — originally private
// to RouteTagBrowserModal/useTagBrowser.js, extracted there so useDynamicReportRoutes.js
// (Dynamic Reports' view-time route resolution) could reuse it instead of growing a third
// near-duplicate copy, then promoted here (2026-08-25, the npmrds-picker-modals work) so
// ReportPickerModal/useReportSearch.js can reuse it a fourth time — this function was never
// route-specific (the `routeSourceInfo` param name is a naming leftover, not a constraint; any
// `externalSource`-shaped catalog works, e.g. reports_snap_2).
//
// Generalized over arbitrary AND-composed filterGroups, since callers need very different
// queries: RouteTagBrowserModal's views (recent/search/tag-browse/tag-browse+search) filter on
// name/tags/created_at/created_by; useDynamicReportRoutes.js filters on `id` (resolving specific
// route ids supplied via a page's URL param); ReportPickerModal filters on name/description.
// `extraColumns` (2026-08-25): additional column definitions appended verbatim — e.g. a
// `selectOnly`/`calculated` sort-only column (the routes picker's fragment-rank ordering, see
// routeScore.js's FRAGMENT_RANK_SORT_COLUMN) that doesn't correspond to any real column on
// `routeSourceInfo` and wouldn't survive being merged into the snapshot-based list below.
export async function fetchCatalogRows({ apiLoad, routeSourceInfo, filterGroups, sort, limit, extraColumns = [] }) {
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
    ...extraColumns,
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
