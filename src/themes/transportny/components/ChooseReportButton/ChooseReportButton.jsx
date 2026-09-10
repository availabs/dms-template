import { useContext, useMemo, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { CMSContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import ReportPickerModal from '../ReportPickerModal/ReportPickerModal';
import { buildReportCatalogSource } from '../ReportPickerModal/reportCatalogSource';
import { isAvailUser, buildVisibilityAllowListFilterGroup } from '../PickerModal/pickerScoring';
import { DYNAMIC_REPORT_TEMPLATE_TAG } from '../RouteTagBrowserModal/tagCategories';
import { useReportCatalogCount } from './useReportCatalogCount';
import { chooseReportButtonTheme } from './ChooseReportButton.theme';

// The page variable the reports page registers in its `filters` array
// (build_npmrds_reports.mjs PAGE_FILTERS) — the key the mockup's dialog writes as `?search=`.
const SEARCH_KEY = 'search';
const fmt = (n) => Number(n).toLocaleString('en-US');

// Trigger for the "Choose a report" modal (npmrds-picker-modals.html, 2026-08-25) — a plain
// registered section, same shape as CreateReportButton: a themed control that owns its own
// open/close state and mounts the (self-contained, UI.Modal-based) picker component, rather than
// going through the declarative isModal/modalParamKey section-group mechanism. This matches how
// the route picker already works (RouteTagBrowserModal is mounted directly by ReportRouteList,
// not via a section-group modal) — Ryan's ask was for the two pickers to share an architecture,
// and a self-contained React modal is the one the route picker already proved out live.
//
// npmrds-reports.html REVISION 3 (2026-09-02): the trigger reads as the header's SEARCH BAR
// (`#findTrigger`), not a button — see ChooseReportButton.theme.js for the drawn classes. Two
// bound figures, neither typed (the mockup's literal 869 is the legacy admin2.reports library,
// not this catalog): the resting prompt's "search N" is the count of reports the picker can open,
// and when the page URL carries `?search=…` the control shows the query and "N matches · show
// results" — the role the mockup's `syncTrigger` gives it, inherited from the old header count
// Card (action params never reach the URL, so a shared link arrives with the query live and the
// dialog shut; the closed trigger is what reports it).
export default function ChooseReportButton() {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Icon } = UI || {};
  const { pageState, apiLoad } = useContext(PageContext) || {};
  const { user, app } = useContext(CMSContext) || {};
  const t = { ...chooseReportButtonTheme, ...getComponentTheme(themeFromContext, 'chooseReportButton') };
  const [open, setOpen] = useState(false);

  // The page owns the URL (creating-page-section-components.md): the query is read off
  // `pageState.filters`, never `useSearchParams`. `values` arrives as a string or a one-element
  // array depending on which writer last set it (page registry vs. a Filter control / the URL).
  const rawQuery = (pageState?.filters || []).find((f) => f.searchKey === SEARCH_KEY)?.values;
  const query = String((Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? '').trim();
  const hasQuery = query.length > 0;

  const sourceInfo = useMemo(() => buildReportCatalogSource(app), [app]);
  // Exactly the picker's root-view tree (useReportSearch.js buildQuery + ReportPickerModal's
  // default facet state): openable rows only (`name` + `page_path` notempty), the OR-of-likes
  // over name/description while a query is live, and the default visibility allow-list for a
  // non-AVAIL viewer — so the figure is the count the dialog opens on. (The dialog additionally
  // drops rows whose page has since been deleted — useReportSearch's live check — so on a
  // catalog with orphans the dialog can show a few fewer; the catalog count is the honest
  // upper figure for a resting prompt.)
  const filterGroups = useMemo(() => {
    const groups = [{ col: 'name', op: 'notempty' }, { col: 'page_path', op: 'notempty' }];
    if (hasQuery) {
      groups.push({ op: 'OR', groups: [
        { col: 'name', op: 'like', value: query },
        { col: 'description', op: 'like', value: query },
      ] });
    }
    if (!isAvailUser(user)) {
      const allow = buildVisibilityAllowListFilterGroup(user, DYNAMIC_REPORT_TEMPLATE_TAG);
      if (allow) groups.push(allow);
    }
    return groups;
  }, [hasQuery, query, user]);
  const count = useReportCatalogCount({ apiLoad, sourceInfo, filterGroups });

  const resting = count == null
    ? 'Find a report — search by name, road, route or description…'
    : `Find a report — search ${fmt(count)} by name, road, route or description…`;

  return (
    <div className={t.wrapper}>
      <button
        type="button"
        className={hasQuery ? t.triggerActive : t.trigger}
        onClick={() => setOpen(true)}
        aria-label={hasQuery ? `Search reports for “${query}”` : 'Find a report'}
      >
        {Icon ? <Icon icon="Search" className={t.triggerIcon} /> : null}
        <span className={hasQuery ? t.triggerQuery : t.triggerLabel}>{hasQuery ? query : resting}</span>
        {hasQuery && count != null ? (
          <span className={t.triggerMeta}>{fmt(count)} {count === 1 ? 'match' : 'matches'} · show results</span>
        ) : null}
      </button>
      <ReportPickerModal open={open} setOpen={setOpen} initialSearchTerm={query} />
    </div>
  );
}
