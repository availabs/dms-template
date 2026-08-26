import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { CMSContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { reportPickerModalTheme } from './ReportPickerModal.theme';
import { useReportSearch } from './useReportSearch';
import { buildReportCatalogSource } from './reportCatalogSource';
import { reportScore, isMine, looksIncomplete, isRebuilt } from './reportScore';
import { rankByScore } from '../PickerModal/pickerScoring';
import { PickerSearchInput, PickerFacetChips, PickerCountBar } from '../PickerModal/PickerModalParts';

// "Choose a report" — net new (npmrds-picker-modals.html, 2026-08-25). A superset of the
// /reports homepage's AVAIL-curated Card grid (converted_reports/reports, page 2208581): the
// homepage stays exactly what it is (a curated showcase — do not change what it shows, per
// Ryan's explicit correction this session); this modal searches EVERYTHING the current user is
// auth'd for, drawn from the same `reports_snap_2` catalog. Same interaction model as the route
// picker (RouteTagBrowserModal): prominence-weighted default sort, a working "mine" facet, and
// badges instead of a separate browse tree — see reportScore.js/PickerModal/ for the shared
// scoring shape and chrome. Unlike the route picker, choosing a report NAVIGATES to it (there is
// nothing to "confirm" — a report is opened, not added to a collection), so this modal has no
// multi-select state at all.
//
// Client-side only, same v1 scope call as the route picker's "mine" facet: the CMSContext user
// id drives ranking/filtering with no server-side check that it matches the real auth token.
export default function ReportPickerModal({ open, setOpen }) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon, Modal, Pill } = UI || {};
  const { user, app } = useContext(CMSContext) || {};
  const { apiLoad } = useContext(PageContext) || {};
  const navigate = useNavigate();
  const currentUserId = user?.id;
  const t = { ...reportPickerModalTheme, ...getComponentTheme(themeFromContext, 'reportPickerModal') };

  const [searchTerm, setSearchTerm] = useState('');
  const [facets, setFacets] = useState({ mine: false, hideIncomplete: false });

  useEffect(() => {
    if (!open) return;
    setSearchTerm('');
    setFacets({ mine: false, hideIncomplete: false });
  }, [open]);

  const reportSourceInfo = useMemo(() => buildReportCatalogSource(app), [app]);

  const extraFilterGroups = useMemo(() => {
    const groups = [];
    if (facets.mine && currentUserId) groups.push({ col: 'created_by', op: 'filter', value: [String(currentUserId)] });
    return groups;
  }, [facets.mine, currentUserId]);

  const { results, loading, error } = useReportSearch({
    apiLoad,
    reportSourceInfo,
    enabled: open,
    searchTerm,
    extraFilterGroups,
  });

  const rankedResults = useMemo(() => {
    const withIds = results.filter((r) => r.report_id != null || r.id != null);
    return rankByScore(withIds, (r) => reportScore(r, { currentUserId }));
  }, [results, currentUserId]);

  const visibleResults = useMemo(
    () => (facets.hideIncomplete ? rankedResults.filter((r) => !looksIncomplete(r)) : rankedResults),
    [rankedResults, facets.hideIncomplete]
  );

  const toggleFacet = (key) => setFacets((prev) => ({ ...prev, [key]: !prev[key] }));
  const clearFacets = () => setFacets({ mine: false, hideIncomplete: false });
  const facetChips = [
    { key: 'mine', label: 'Mine', active: facets.mine },
    { key: 'hideIncomplete', label: 'Hide incomplete-looking', active: facets.hideIncomplete },
  ];

  const openReport = (row) => {
    if (!row.page_path) return; // legacy row, nothing to navigate to yet
    setOpen?.(false);
    navigate(row.page_path);
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
        </span>
      </button>
    );
  };

  return (
    <Modal open={open} setOpen={setOpen} activeStyle="wide">
      <div className={t.wrapper}>
        <div className={t.header}>Choose a report</div>
        <p className={t.headerSub}>Searches everything you're authorized for — a superset of the curated /reports homepage.</p>

        <PickerSearchInput t={t} Input={Input} Icon={Icon} value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or description…" autoFocus />

        <PickerFacetChips t={t} Pill={Pill} facets={facetChips} onToggle={toggleFacet} onClearAll={clearFacets} />
        {!loading && !error ? (
          <PickerCountBar t={t} countLabel={`${visibleResults.length} report${visibleResults.length === 1 ? '' : 's'}`} />
        ) : null}

        <div className={t.body}>
          {loading ? <div className={t.loading}>Loading…</div> : null}
          {error ? <div className={t.error}>{error}</div> : null}
          {!loading && !error && !visibleResults.length ? <div className={t.empty}>No reports match.</div> : null}
          {!loading && !error && visibleResults.length ? (
            <div className={t.reportList}>{visibleResults.map(renderReportRow)}</div>
          ) : null}
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
