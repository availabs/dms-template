import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneDeep } from 'lodash-es';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { getUrlSlug } from '../../../../dms/packages/dms/src/patterns/page/pages/_utils';
import { resolveMountPath } from '../../../../dms/packages/dms/src/utils/mountPath';
import { buildReportCatalogSource } from '../ReportPickerModal/reportCatalogSource';
import {
  parseTags, makeUserTag, isUserTag, isTagAllowedForUser,
  AUTO_GENERATED_TAG, DYNAMIC_REPORT_TEMPLATE_TAG,
} from '../RouteTagBrowserModal/tagCategories';
import {
  routesToSlots, slotsToStaticRoutes, catalogFromResolvedRoutes,
  freezeSectionDisplayText, dynamicReportFilters, staticReportFilters,
} from '../ReportRouteList/reportKindConversion';

// "Save as…" — duplicate the report being viewed into a NEW page, optionally converting it between
// static and dynamic on the way (report-save-as-copy.md). The source report is never mutated.
//
// Deliberately NOT built on the core `{pattern}|page_template` mechanism (settingsPane.jsx's "Save
// as Template" → PageTemplatePicker): that stores only sections/sectionGroups/sidebar and drops
// `filters`, so it cannot represent a Dynamic Report at all, and it lands in a picker nobody
// browsing NPMRDS reports ever opens. This writes a real report page instead.

// Which section arrays are actually hydrated depends on the route that rendered the header, and
// they differ (siteConfig.jsx): the VIEW route declares an explicit 15-attribute list carrying
// `sections`/`section_groups` but NOT the draft pair, while the EDIT route declares no
// `filter.attributes` at all — so createRequest.js falls back to `['data']` and it gets the whole
// row. Either way exactly one array is hydrated and authoritative for what the author is looking
// at right now, so we pick that one and project it onto BOTH arrays of the copy. That's the same
// move `publish()`/`discardChanges()` already make, and it's what keeps a copy made from VIEW mode
// from rendering blank — view renders `item.sections` only (`_utils/index.js:258`), so a copy
// carrying only `draft_sections` (what core's newPage/template path writes) would show nothing.
function pickHydrated(draftArr, publishedArr) {
  return (draftArr?.length ? draftArr : publishedArr) || [];
}

// Fresh identity per section. `id`/`ref`/`draft_id`/`is_draft` are stripped so the API mints brand
// new component rows rather than aliasing the source report's (the same sanitization
// `sanitizeSectionsForTemplate` does, kept local so this doesn't depend on a core export whose
// contract is about templates). `trackingId` is regenerated — sharing the source's would collide on
// the `$self` stable-id mechanism — but the draft and published copies of the SAME section
// deliberately SHARE one trackingId, exactly as `publish()` produces (it copies draft objects
// verbatim, trackingId included, into `sections`).
function cloneSections(sections, trackingIds) {
  return (sections || []).map((s, i) => {
    const clean = cloneDeep(s);
    delete clean.id;
    delete clean.ref;
    delete clean.draft_id;
    delete clean.is_draft;
    return { ...clean, trackingId: trackingIds[i] };
  });
}

// `"<title> Copy"`, then `"<title> Copy 2"`, `"Copy 3"`… — the repo's existing duplicate idiom
// (`controls_utils.js`'s column duplication: `${label} Copy ${n}`).
//
// Deduped against sibling TITLES here rather than leaning on `getUrlSlug`'s own collision handling,
// because the slug is derived from the title (`toSnakeCase`) and getUrlSlug's fallback appends the
// page's `index` (`foo_copy_37`) — technically unique but meaningless to read and unstable if the
// index changes. Doing it title-side keeps the slug clean and predictable (`foo_copy`,
// `foo_copy_2`). An existing "Copy"/"Copy N" suffix is stripped first, so copying a copy gives
// "Foo Copy 2", not "Foo Copy Copy".
export function nextCopyTitle(sourceTitle, siblings) {
  const base = (sourceTitle || 'Report').trim().replace(/\s+Copy(\s+\d+)?$/i, '').trim() || 'Report';
  const taken = new Set((siblings || []).map((d) => (d.title || '').trim()));
  if (!taken.has(`${base} Copy`)) return `${base} Copy`;
  let n = 2;
  while (taken.has(`${base} Copy ${n}`)) n += 1;
  return `${base} Copy ${n}`;
}

// The copier's own tag set, derived from the source report's.
//
// `isTagAllowedForUser` already encodes exactly the rule asked for (Ryan, 2026-09-15: "copy all
// tags that the user could actually have"): it passes county/region/category/difficulty and every
// free-form tag straight through (those describe the CONTENT, not who may hold them), and passes an
// `agency:` tag only when the copier is genuinely in that login group. The source author's `user:`
// tag is replaced with the copier's own.
//
// The two curated provenance markers are dropped: they mean "AVAIL-curated, shown to everyone
// regardless of ownership" (tagCategories.js), so a personal copy of one of the 12 Dynamic Report
// templates must not inherit them and advertise itself as one of the originals.
const CURATED_ONLY_TAGS = new Set([AUTO_GENERATED_TAG, DYNAMIC_REPORT_TEMPLATE_TAG]);

export function tagsForCopy(sourceTags, user) {
  const carried = (sourceTags || []).filter(
    (t) => !isUserTag(t) && !CURATED_ONLY_TAGS.has(t) && isTagAllowedForUser(t, user)
  );
  return user?.id ? [makeUserTag(user.id), ...carried] : carried;
}

export function useSaveAsReport({
  item, dataItems, apiLoad, apiUpdate, user, app,
  mountBaseUrl, siteRootPaths, isDynamicReport,
}) {
  const [source, setSource] = useState(null); // { rowId, routes, tags, graphCount, countsLabel }
  const [loadingSource, setLoadingSource] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadTargetIdRef = useRef(null);

  // The source report's OWN catalog row — its raw stored `routes` (not the resolved broadcast
  // catalog) plus its tags. Fetched on demand when the modal opens rather than on every header
  // render: `buildReportCatalogSource` deliberately omits `routes` because it's a large JSON blob
  // no list view needs, and every report page in the site renders this header.
  const loadSource = useCallback(async () => {
    if (!apiLoad || !item?.id || !app) return;
    loadTargetIdRef.current = item.id;
    setLoadingSource(true);
    setError('');
    try {
      const externalSource = buildReportCatalogSource(app);
      const udaConfig = buildUdaConfig({
        externalSource,
        // `routes`/`tags`/`counts_label` are force-declared the same way useReportRow.js does —
        // they're real columns on the source that this shared `buildReportCatalogSource` shape
        // omits, so a caller that needs them adds them rather than widening it for everyone.
        columns: [
          ...externalSource.columns.filter((c) => c.name !== 'id').map((c) => ({ ...c, show: true })),
          { name: 'routes', type: 'text', show: true },
          { name: 'tags', type: 'multiselect', options: null, show: true },
          { name: 'counts_label', type: 'text', show: true },
          { name: 'id', systemCol: true, show: true, sort: 'desc' },
        ],
        filters: { op: 'AND', groups: [{ col: "data->>'report_id'", op: 'filter', value: String(item.id) }] },
      });
      const data = await apiLoad({
        format: { ...externalSource },
        children: [{ action: 'uda', path: '/', filter: { options: JSON.stringify(udaConfig.options), attributes: udaConfig.attributes }, params: {} }],
      }, '/');
      if (loadTargetIdRef.current !== item.id) return; // superseded by a newer report navigation
      const rawRow = data?.[0];
      // A UDA query with 0 matching rows still returns one all-undefined placeholder rather than an
      // empty array (same gotcha useReportRow/useReportCatalogRow both guard) — an id-less
      // extraction means "no catalog row yet", a normal state for a report nobody has added a route
      // to, not an error.
      const extracted = rawRow
        ? udaConfig.columnsToFetch.reduce((acc, col) => {
            const v = rawRow[col.reqName];
            acc[col.name] = (v && typeof v === 'object' && '$type' in v) ? v.value : v;
            return acc;
          }, {})
        : null;
      const row = extracted && extracted.id != null ? extracted : null;
      let routes = [];
      try { routes = JSON.parse(row?.routes || '[]') || []; } catch (e) { routes = []; }
      setSource({
        rowId: row?.id ?? null,
        routes,
        tags: parseTags(row?.tags),
        graphCount: row?.graph_count ?? null,
        countsLabel: row?.counts_label ?? null,
      });
    } catch (e) {
      if (loadTargetIdRef.current !== item.id) return;
      console.error('<ReportPageHeader:useSaveAsReport:loadSource>', e);
      setSource({ rowId: null, routes: [], tags: [], graphCount: null, countsLabel: null });
    } finally {
      setLoadingSource(false);
    }
  }, [apiLoad, item?.id, app]);

  // Drop a previous report's catalog data the moment the page changes, so a modal opened right
  // after navigating can never show the old report's routes/tags.
  useEffect(() => { setSource(null); setError(''); }, [item?.id]);

  // `kind` is 'static' | 'dynamic' — the kind the COPY should be, independent of the source's.
  // `resolvedRoutes` is passed in per call rather than held as a hook input: resolving a Dynamic
  // Report's slots needs this hook's OWN `source.routes` as its input (ReportPageHeader feeds them
  // through `useDynamicReportRoutes`), so taking them as config would be circular.
  const saveAs = useCallback(async ({ title, kind, editMode, resolvedRoutes }) => {
    if (!apiUpdate || !item?.id || saving) return null;
    setSaving(true);
    setError('');
    try {
      const wantDynamic = kind === 'dynamic';
      const sourceRoutes = source?.routes || [];

      // ---- routes + page filters, per the target kind -------------------------------------
      // Both transforms are the SAME ones ReportRouteList's in-place Dynamic Report Switch uses
      // (reportKindConversion.js) — the only difference is that they're applied to a page that
      // doesn't exist yet instead of to `item`.
      let nextRoutes;
      if (wantDynamic === Boolean(isDynamicReport)) {
        nextRoutes = sourceRoutes;                       // same kind — verbatim copy
      } else if (wantDynamic) {
        nextRoutes = routesToSlots(sourceRoutes);        // static → dynamic
      } else {
        nextRoutes = slotsToStaticRoutes(resolvedRoutes || []); // dynamic → static
      }

      // `item.filters` can arrive as the raw JSON string the DB stores rather than a real array on
      // a fresh load — same gotcha RRL guards with `parseIfJSON`. Inlined here (rather than
      // importing the core helper) only because this file has no other use for it.
      let currentFilters = item?.filters;
      if (typeof currentFilters === 'string') {
        try { currentFilters = JSON.parse(currentFilters); } catch (e) { currentFilters = []; }
      }
      if (!Array.isArray(currentFilters)) currentFilters = [];
      const nextFilters = wantDynamic ? dynamicReportFilters(currentFilters) : staticReportFilters(currentFilters);

      // ---- sections ------------------------------------------------------------------------
      const srcSections = pickHydrated(item?.draft_sections, item?.sections);
      const srcGroups = pickHydrated(item?.draft_section_groups, item?.section_groups);
      const trackingIds = srcSections.map(() => crypto.randomUUID());
      let draftSections = cloneSections(srcSections, trackingIds);
      let publishedSections = cloneSections(srcSections, trackingIds);

      // Converting to static also has to freeze any live `%n`/`%y` substitution baked into a graph
      // SECTION's title/caption, not just into routes[] — otherwise every templated title goes
      // permanently blank (found live 2026-09-09 on `bi_directional`). RRL can only do this to
      // `draft_sections`, because overwriting an existing published row in place is a silent no-op;
      // a COPY mints brand-new published rows, so here both arrays can and must be frozen.
      if (!wantDynamic && isDynamicReport) {
        const catalog = catalogFromResolvedRoutes(resolvedRoutes || []);
        draftSections = freezeSectionDisplayText(draftSections, catalog).sections;
        publishedSections = freezeSectionDisplayText(publishedSections, catalog).sections;
      }

      // ---- the new page row ------------------------------------------------------------------
      // Sibling of the source (Ryan, 2026-09-15). Index/slug follow newPage()'s own conventions so
      // a copy is indistinguishable from any other page created in this folder.
      const parent = item?.parent || '';
      const siblings = (dataItems || []).filter((d) => (d.parent || null) === (parent || null));
      const highestIndex = siblings.reduce((out, d) => Math.max(isNaN(d.index) ? 0 : d.index, out), 0);
      const finalTitle = (title || '').trim() || nextCopyTitle(item?.title, siblings);

      const newItem = {
        title: finalTitle,
        parent,
        index: highestIndex + 1,
        // Created CLEAN, not 'draft': the copy is a faithful duplicate of something already
        // finished, and `published: 'draft'` would leave a view-mode copier looking at a page
        // flagged as having unpublished changes they never made.
        published: '',
        filters: nextFilters,
        draft_sections: draftSections,
        sections: publishedSections,
        draft_section_groups: cloneDeep(srcGroups),
        section_groups: cloneDeep(srcGroups),
      };
      // Copied only when present — `dataSources`/`draft_dataSources` are not among the view route's
      // declared attributes, so a copy made from view mode simply doesn't carry them (report pages
      // bind data per-section, not at page level, so this is inert in practice).
      if (item?.sidebar !== undefined) newItem.sidebar = item.sidebar;
      if (item?.sidebarHideInView !== undefined) newItem.sidebarHideInView = item.sidebarHideInView;
      if (item?.theme !== undefined) newItem.theme = item.theme;
      if (item?.dataSources !== undefined) newItem.dataSources = cloneDeep(item.dataSources);
      if (item?.draft_dataSources !== undefined) newItem.draft_dataSources = cloneDeep(item.draft_dataSources);
      newItem.url_slug = getUrlSlug(newItem, dataItems || []);

      // No `newPath` — apiUpdate navigates only when given one, and we need to stay put long enough
      // to write the catalog row under the id this create returns (`wrapper.jsx`: a create, i.e. a
      // payload with no `id`, returns the new row).
      const created = await apiUpdate({ data: newItem });
      const newId = created?.id;
      if (!newId) throw new Error('page create returned no id');

      // ---- the new report's own reports_snap_2 catalog row -------------------------------------
      // Written here rather than left to RRL's lazy create, because a copy arrives with routes
      // ALREADY set — without this the copy would open with an empty route list and be invisible to
      // the reports catalog/picker until someone edited it.
      const externalSource = buildReportCatalogSource(app);
      const storageDataFormat = { ...externalSource, type: `${externalSource.type}|${externalSource.view_id}:data` };
      await apiUpdate({
        data: {
          report_id: String(newId),
          routes: JSON.stringify(nextRoutes),
          tags: JSON.stringify(tagsForCopy(source?.tags, user)),
          name: finalTitle,
          page_path: `/${newItem.url_slug}`,
          ...(source?.graphCount != null ? { graph_count: source.graphCount } : {}),
          ...(source?.countsLabel != null ? { counts_label: source.countsLabel } : {}),
        },
        config: { format: storageDataFormat },
      });

      // Land in the same mode the author started in (Ryan, 2026-09-15).
      const path = editMode ? `/edit/${newItem.url_slug}` : `/${newItem.url_slug}`;
      return { id: newId, url_slug: newItem.url_slug, path: resolveMountPath(path, mountBaseUrl, siteRootPaths) };
    } catch (e) {
      console.error('<ReportPageHeader:useSaveAsReport:saveAs>', e);
      setError('Could not save a copy of this report.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [apiUpdate, item, dataItems, source, user, app, saving, isDynamicReport, mountBaseUrl, siteRootPaths]);

  return { loadSource, source, loadingSource, saveAs, saving, error };
}
