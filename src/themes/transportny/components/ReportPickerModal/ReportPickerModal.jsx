import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { CMSContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { MountContext } from '../../../../dms/packages/dms/src/ui/mountContext';
import { resolveMountPath } from '../../../../dms/packages/dms/src/utils/mountPath';
import { reportPickerModalTheme } from './ReportPickerModal.theme';
import { useReportSearch } from './useReportSearch';
import { buildReportCatalogSource } from './reportCatalogSource';
import { reportScore, isMine, looksIncomplete, isRebuilt } from './reportScore';
import { rankByScore, isAvailUser, buildVisibilityAllowListFilterGroup } from '../PickerModal/pickerScoring';
import { PickerSearchInput, PickerFacetChips, PickerCountBar } from '../PickerModal/PickerModalParts';
import { TAG_CATEGORIES, DYNAMIC_REPORT_TEMPLATE_TAG, parseTags, tagToLabel } from '../RouteTagBrowserModal/tagCategories';

// "Choose a report" — net new (npmrds-picker-modals.html, 2026-08-25). A superset of the
// /reports homepage's AVAIL-curated Card grid (converted_reports/reports, page 2208581): the
// homepage stays exactly what it is (a curated showcase — do not change what it shows, per
// Ryan's explicit correction this session); this modal searches everything the current user is
// auth'd for THAT HAS A REAL DMS PAGE, drawn from the same `reports_snap_2` catalog. Same
// interaction model as the route picker (RouteTagBrowserModal): prominence-weighted default
// sort, a working "mine" facet, and badges — see reportScore.js/PickerModal/ for the shared
// scoring shape and chrome. Unlike the route picker, choosing a report NAVIGATES to it (there is
// nothing to "confirm" — a report is opened, not added to a collection), so this modal has no
// multi-select state at all.
//
// 2026-08-31 user correction (old-reports-conversion.md, "Round 83"): this modal originally also
// surfaced legacy `admin2.reports` catalog rows that were never rebuilt into a real page (shown
// disabled/greyed, "Legacy — not yet rebuilt") as part of being a genuine "search everything"
// superset. Ryan explicitly rejected that: legacy rows are unopenable noise, not a useful browse
// surface, and a converter bug (same round, see the task doc) was ALSO making every real
// converted report indistinguishable from one of these — both problems compounding to make a
// just-converted, just-tagged report invisible/unopenable in its own picker. `useReportSearch.js`
// now filters `page_path notempty` unconditionally, so only rebuilt reports ever reach this
// component — `isRebuilt`/the "Legacy" Pill branch below is now a defensive no-op, not a live
// path, kept in case a future row somehow slips through with no page_path.
//
// Round 82 (old-reports-conversion.md, "Round B", 2026-08-31) added the category→value tag
// drill-down — mirrors RouteTagBrowserModal's `view: root/category/value/other` state machine
// directly, reusing the SAME shared `TAG_CATEGORIES` vocabulary (Ryan's explicit call: routes and
// reports use one agency/county/region taxonomy, not two). Only the converter currently
// auto-populates `agency:` tags (the other two axes have no real report signal yet — see the task
// doc's nesting-finding writeup — but stay in the browse tree since it's the same shared list an
// author could still hand-tag a report with a county/region value).
//
// Client-side only, same v1 scope call as the route picker's "mine" facet: the CMSContext user
// id drives ranking/filtering with no server-side check that it matches the real auth token.
//
// `initialSearchTerm` (2026-09-02, npmrds-reports-page-rev3.md Phase 3, ADDITIVE — defaults to
// '' so every existing caller is byte-identical): the root view's search box opens pre-filled
// with it. The header trigger (ChooseReportButton) passes the page's live `?search=` variable,
// so "N matches · show results" on the closed trigger opens onto those results rather than an
// empty box. Read at open time only — a later change to the prop does not disturb a dialog the
// user is already typing in.
export default function ReportPickerModal({ open, setOpen, initialSearchTerm = '' }) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon, Modal, Pill } = UI || {};
  const { user, app, falcor } = useContext(CMSContext) || {};
  const { apiLoad } = useContext(PageContext) || {};
  const { baseUrl: mountBaseUrl, siteRootPaths } = useContext(MountContext) || {};
  const navigate = useNavigate();
  const currentUserId = user?.id;
  const t = { ...reportPickerModalTheme, ...getComponentTheme(themeFromContext, 'reportPickerModal') };

  // view: 'root' | 'category' | 'value' | 'other' — same shape as RouteTagBrowserModal.jsx.
  const [view, setView] = useState('root');
  const [activeCategoryKey, setActiveCategoryKey] = useState(null);
  const [activeValue, setActiveValue] = useState(null); // { value, label }
  const [categoryFilterTerm, setCategoryFilterTerm] = useState(''); // client-side, narrows the fixed value list
  const [rootSearchTerm, setRootSearchTerm] = useState('');
  const [withinSearchTerm, setWithinSearchTerm] = useState('');
  const [otherTagTerm, setOtherTagTerm] = useState('');
  const [facets, setFacets] = useState({ mine: false, hideIncomplete: false });
  // Default picker visibility (routes-reports-users-mesh.md, Workstream D item 5): an allow-list
  // applied server-side unless toggled off. Defaults to OFF (already showing everyone's) for an
  // AVAIL user, ON (restricted) for everyone else — see isAvailUser.
  const [showEverything, setShowEverything] = useState(() => isAvailUser(user));

  useEffect(() => {
    if (!open) return;
    setView('root');
    setActiveCategoryKey(null);
    setActiveValue(null);
    setCategoryFilterTerm('');
    setRootSearchTerm(initialSearchTerm || '');
    setWithinSearchTerm('');
    setOtherTagTerm('');
    setFacets({ mine: false, hideIncomplete: false });
    setShowEverything(isAvailUser(user));
  }, [open]);

  const activeCategory = TAG_CATEGORIES.find((c) => c.key === activeCategoryKey) || null;
  const searchTerm = view === 'root' ? rootSearchTerm : (view === 'value' ? withinSearchTerm : '');
  const tagValue = view === 'value' ? activeValue?.value : null;
  const tagLikeTerm = view === 'other' ? otherTagTerm.trim() : null;

  const reportSourceInfo = useMemo(() => buildReportCatalogSource(app), [app]);

  const extraFilterGroups = useMemo(() => {
    const groups = [];
    if (facets.mine && currentUserId) groups.push({ col: 'created_by', op: 'filter', value: [String(currentUserId)] });
    if (!showEverything) {
      const allowList = buildVisibilityAllowListFilterGroup(user, DYNAMIC_REPORT_TEMPLATE_TAG);
      if (allowList) groups.push(allowList);
    }
    return groups;
  }, [facets.mine, currentUserId, showEverything, user]);

  const { results, loading, error } = useReportSearch({
    apiLoad,
    falcor,
    app,
    reportSourceInfo,
    enabled: open && view !== 'category',
    searchTerm,
    tagValue,
    tagLikeTerm: tagLikeTerm || null,
    extraFilterGroups,
  });

  const visibleCategoryValues = useMemo(() => {
    if (!activeCategory) return [];
    const q = categoryFilterTerm.trim().toLowerCase();
    if (!q) return activeCategory.values;
    return activeCategory.values.filter((v) => v.label.toLowerCase().includes(q));
  }, [activeCategory, categoryFilterTerm]);

  const goRoot = () => { setView('root'); setActiveCategoryKey(null); setActiveValue(null); setCategoryFilterTerm(''); };
  const goCategory = (key) => { setView('category'); setActiveCategoryKey(key); setActiveValue(null); setCategoryFilterTerm(''); };
  const goValue = (v) => { setView('value'); setActiveValue(v); setWithinSearchTerm(''); };
  const goOther = () => { setView('other'); setOtherTagTerm(''); };

  const rankedResults = useMemo(() => {
    const withIds = results.filter((r) => r.report_id != null || r.id != null);
    return rankByScore(withIds, (r) => reportScore(r, { currentUserId }));
  }, [results, currentUserId]);

  const visibleResults = useMemo(
    () => (facets.hideIncomplete ? rankedResults.filter((r) => !looksIncomplete(r)) : rankedResults),
    [rankedResults, facets.hideIncomplete]
  );

  const toggleFacet = (key) => {
    if (key === 'showEverything') { setShowEverything((v) => !v); return; }
    setFacets((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const clearFacets = () => setFacets({ mine: false, hideIncomplete: false });
  const facetChips = [
    { key: 'mine', label: 'Mine', active: facets.mine },
    { key: 'hideIncomplete', label: 'Hide incomplete-looking', active: facets.hideIncomplete },
    // Kept OUT of clearFacets/facets — a "widen the default" switch, not a manual narrowing facet
    // (routes-reports-users-mesh.md, Workstream D).
    { key: 'showEverything', label: "Show everyone's", active: showEverything },
  ];

  const openReport = (row) => {
    if (!row.page_path) return; // legacy row, nothing to navigate to yet
    setOpen?.(false);
    // row.page_path is a site-absolute authored path (e.g. /converted_reports/nyc_test) — resolve
    // it against the current mount's baseUrl (e.g. /npmrds) the same way Card/TableCell/ButtonNode
    // do, so the modal works on whichever mount it's opened from.
    navigate(resolveMountPath(row.page_path, mountBaseUrl, siteRootPaths));
  };

  const badgesFor = (row) => (
    <span className={t.reportBadgeRow}>
      {isMine(row, currentUserId) ? <Pill text="Mine" activeStyle="blue" /> : null}
      {isRebuilt(row) ? <Pill text="Rebuilt" activeStyle="green" /> : <Pill text="Legacy — not yet rebuilt" activeStyle="zinc" />}
      {looksIncomplete(row) ? <Pill text="Possible draft" activeStyle="amber" /> : null}
    </span>
  );

  const renderReportRow = (r) => {
    const key = r.report_id ?? r.id;
    const clickable = Boolean(r.page_path);
    const tags = parseTags(r.tags);
    return (
      <button
        key={key}
        type="button"
        className={clickable ? t.reportItem : t.reportItemDisabled}
        disabled={!clickable}
        onClick={() => openReport(r)}
      >
        <span className={t.reportItemBody}>
          <span className={t.reportItemTopLine}>
            <span className={t.reportName}>{r.name}</span>
            {r.updated_at ? <span className={t.reportUpdated}>{String(r.updated_at).slice(0, 10)}</span> : null}
          </span>
          {badgesFor(r)}
          {r.description ? (
            <span className={t.reportDescription}>{r.description}</span>
          ) : (
            <span className={t.reportDescriptionEmpty}>Nothing was written down — matched on the title alone.</span>
          )}
          {tags.length > 0 && (
            <span className={t.reportTagChips}>
              {tags.map((tag) => <span key={tag} className={t.reportTagChip}>{tagToLabel(tag)}</span>)}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderReportList = () => {
    if (loading) return <div className={t.loading}>Loading…</div>;
    if (error) return <div className={t.error}>{error}</div>;
    if (!visibleResults.length) return <div className={t.empty}>No reports found.</div>;
    return <div className={t.reportList}>{visibleResults.map(renderReportRow)}</div>;
  };

  const breadcrumb = (
    <div className={t.breadcrumb}>
      <span className={view === 'root' ? t.breadcrumbStepCurrent : t.breadcrumbStep} onClick={goRoot}>All Reports</span>
      {activeCategory ? (
        <>
          <span className={t.breadcrumbSep}>/</span>
          <span className={view === 'category' ? t.breadcrumbStepCurrent : t.breadcrumbStep} onClick={() => goCategory(activeCategory.key)}>
            {activeCategory.label}
          </span>
        </>
      ) : null}
      {view === 'other' ? (
        <>
          <span className={t.breadcrumbSep}>/</span>
          <span className={t.breadcrumbStepCurrent}>Other tags</span>
        </>
      ) : null}
      {view === 'value' && activeValue ? (
        <>
          <span className={t.breadcrumbSep}>/</span>
          <span className={t.breadcrumbStepCurrent}>{activeValue.label}</span>
        </>
      ) : null}
    </div>
  );

  const showFacetsAndCount = view === 'root' || view === 'value' || (view === 'other' && tagLikeTerm);

  return (
    <Modal open={open} setOpen={setOpen} activeStyle="wide">
      <div className={t.wrapper}>
        <div className={t.header}>Choose a report</div>
        <p className={t.headerSub}>Searches everything you're authorized for — a superset of the curated /reports homepage.</p>
        {breadcrumb}

        {view === 'root' ? (
          <PickerSearchInput t={t} Input={Input} Icon={Icon} value={rootSearchTerm}
            onChange={(e) => setRootSearchTerm(e.target.value)} placeholder="Search by name or description…" autoFocus />
        ) : null}
        {view === 'category' ? (
          <PickerSearchInput t={t} Input={Input} Icon={Icon} value={categoryFilterTerm}
            onChange={(e) => setCategoryFilterTerm(e.target.value)} placeholder={`Filter ${activeCategory?.label.toLowerCase()}…`} />
        ) : null}
        {view === 'value' ? (
          <PickerSearchInput t={t} Input={Input} Icon={Icon} value={withinSearchTerm}
            onChange={(e) => setWithinSearchTerm(e.target.value)} placeholder="Search within this tag…" />
        ) : null}
        {view === 'other' ? (
          <PickerSearchInput t={t} Input={Input} Icon={Icon} value={otherTagTerm}
            onChange={(e) => setOtherTagTerm(e.target.value)} placeholder="Type a tag (e.g. a project number)…" />
        ) : null}

        {showFacetsAndCount ? (
          <PickerFacetChips t={t} Pill={Pill} facets={facetChips} onToggle={toggleFacet} onClearAll={clearFacets} />
        ) : null}
        {showFacetsAndCount && !loading && !error ? (
          <PickerCountBar t={t} countLabel={`${visibleResults.length} report${visibleResults.length === 1 ? '' : 's'}`} />
        ) : null}

        <div className={t.body}>
          {view === 'root' ? (
            <>
              <div className={t.sectionLabel}>Browse by tag</div>
              <div className={t.categoryPillRow}>
                {TAG_CATEGORIES.map((c) => (
                  <button key={c.key} type="button" className={t.categoryPill} onClick={() => goCategory(c.key)}>
                    {c.label}
                    <span className={t.categoryPillHint}>{c.values.length}</span>
                  </button>
                ))}
              </div>
              <div className={t.categoryLinkRow}>
                <button type="button" className={t.categoryLink} onClick={goOther}>Other tags</button>
              </div>
              {renderReportList()}
            </>
          ) : null}

          {view === 'category' ? (
            <div className={t.valueList}>
              {visibleCategoryValues.map((v) => (
                <button key={v.value} type="button" className={t.valueItem} onClick={() => goValue(v)}>
                  {v.label}
                </button>
              ))}
            </div>
          ) : null}

          {view === 'value' ? renderReportList() : null}
          {view === 'other' ? (otherTagTerm.trim() ? renderReportList() : <div className={t.empty}>Type a tag to search.</div>) : null}
        </div>

        <div className={t.footer}>
          <div className={t.footerCount}>sorted: yours → rebuilt → described → recency</div>
          <div className={t.footerButtons}>
            <Button themeOptions={{ size: 'sm', color: 'transparent' }} onClick={() => setOpen?.(false)}>Close</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
