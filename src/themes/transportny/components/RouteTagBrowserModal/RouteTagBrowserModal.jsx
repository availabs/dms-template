import { useContext, useEffect, useMemo, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { CMSContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { routeTagBrowserModalTheme } from './RouteTagBrowserModal.theme';
import { useTagBrowser } from './useTagBrowser';
import { TAG_CATEGORIES, AUTO_GENERATED_TAG, parseTags, tagToLabel } from './tagCategories';
import { parseTmcArray } from '../ReportRouteList/utils';
import { routeScore, isFragment, EXCLUDE_FRAGMENTS_FILTER } from './routeScore';
import { sortRows, SORT_MODE_OPTIONS, isOwnedByCurrentUser, isAvailUser, buildVisibilityAllowListFilterGroup } from '../PickerModal/pickerScoring';
import { PickerSearchInput, PickerFacetChips, PickerCountBar } from '../PickerModal/PickerModalParts';

// Shared route-picker modal — mirrors the old tool's folder-browser *organizing effect* (drill
// into a category, see routes, select) without real folders in the data model; tags stand in for
// folders. Used by ReportRouteList's add-route flow (`selectionMode: 'any'`) and Dynamic Reports'
// route-slot entry gate (`selectionMode: 'exact'` + `requiredCount` + `initialSelectedRoutes`,
// the last added so a slot/URL-count mismatch pre-populates already-resolved groups instead of
// discarding them) — see planning/transportny/tasks/current/dynamic-reports-and-route-tags.md.
//
// 2026-08-25 (npmrds-picker-modals redesign): default sort is now prominence-weighted
// (routeScore.js) instead of pure recency; a "mine" facet works against the real `created_by`
// column; every row carries a mine/auto-generated/curated badge (UI.Pill) instead of the merge
// living only in the tag-browse tree; single-TMC "fragment" routes collapse behind an explicit
// "show N short segments" toggle in any unscoped (non-search) view. The search-input/facet-chip/
// count-bar chrome is shared with ReportPickerModal via `../PickerModal/` — see that folder's
// own comments for why (Ryan: the two pickers should share code/styling, not drift).
export default function RouteTagBrowserModal({
  open,
  setOpen,
  apiLoad,
  routeSourceInfo,
  selectionMode = 'any', // 'any' | 'exact'
  requiredCount = 0,
  excludeRouteIds,
  // Pre-seeds `selected` at open — used by Dynamic Reports' entry gate so a slot/URL-count
  // mismatch (some groups already resolved from the URL, one or more still missing) doesn't
  // discard what already resolved; the author only has to pick the still-missing slot(s). Empty/
  // omitted reproduces the plain "start from nothing" behavior every other caller already gets.
  initialSelectedRoutes,
  onConfirm,
  // False for a blocking entry gate (Dynamic Reports' no-route-selected-yet case, see
  // ReportRouteList.jsx) where `setOpen` is a deliberate no-op and there's nothing to cancel
  // back to. Only affects Cancel's disabled styling here — the caller's own no-op `setOpen`
  // already makes backdrop-click/Escape (see Modal.jsx/useModalOverlay.js) inert either way.
  dismissible = true,
  // "Relative dates relative to today" follow-up (dynamic-reports-and-route-tags.md item 3):
  // ReportRouteList.jsx's blocking entry gate is the one place a Dynamic Report viewer can
  // override the "Today (view time)" anchor a route's date might derive from — Ryan's call was to
  // fold this into the existing route-picking gate rather than a separate always-visible control.
  // `asOfDateValue` seeds the internal buffer below (same convention as `initialSelectedRoutes`);
  // the picked value is handed back as onConfirm's second argument. Both props are no-ops for
  // every other caller (the plain "Add Route" flow never sets `showAsOfDate`).
  showAsOfDate = false,
  asOfDateValue,
}) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon, Modal, Pill } = UI || {};
  const { user } = useContext(CMSContext) || {};
  const currentUserId = user?.id;
  const t = { ...routeTagBrowserModalTheme, ...getComponentTheme(themeFromContext, 'routeTagBrowserModal') };

  // view: 'root' | 'category' | 'value' | 'other'
  const [view, setView] = useState('root');
  const [activeCategoryKey, setActiveCategoryKey] = useState(null);
  const [activeValue, setActiveValue] = useState(null); // { value, label }
  const [categoryFilterTerm, setCategoryFilterTerm] = useState(''); // client-side, narrows the fixed value list
  const [rootSearchTerm, setRootSearchTerm] = useState('');
  const [withinSearchTerm, setWithinSearchTerm] = useState('');
  const [otherTagTerm, setOtherTagTerm] = useState('');
  const [selected, setSelected] = useState(new Map()); // id -> route row
  const [asOfDate, setAsOfDate] = useState(asOfDateValue || '');
  // "mine"/"curated"/"auto-generated" narrow-by facets (independent toggles, persist across
  // view navigation within one open — see the module comment). Client-side only: the "mine"
  // value comes from CMSContext's signed-in user, never server-verified against an auth token
  // (Ryan's own explicit v1 scope call — not an oversight to harden later).
  const [routeFacets, setRouteFacets] = useState({ mine: false, curated: false, autogen: false });
  // Default picker visibility (routes-reports-users-mesh.md, Workstream D item 5): an allow-list
  // applied server-side unless toggled off. Defaults to OFF (i.e. already showing everyone's) for
  // an AVAIL user — see isAvailUser — and ON (restricted) for everyone else.
  const [showEverything, setShowEverything] = useState(() => isAvailUser(user));
  // Single-TMC "fragment" routes collapse behind this toggle in any unscoped (non-search) view;
  // reset at each navigation point below so a stale expansion doesn't survive into a new list.
  const [fragmentsExpanded, setFragmentsExpanded] = useState(false);
  // 2026-09-03 (Ryan's correction): same fix as ReportPickerModal.jsx — the footer's "sort: Best
  // match" label used to be static, not a real control. See SORT_MODE_OPTIONS (pickerScoring.js).
  const [sortMode, setSortMode] = useState('best');

  // Reset all transient state on open — a stale drill-down/selection from a previous open would
  // otherwise persist across unrelated add-route sessions. `selected` seeds from
  // `initialSelectedRoutes` (read at the open transition, not tracked as its own dep — a parent
  // re-render producing a new-by-reference-but-same-content array must not wipe an in-progress
  // selection while this stays open).
  useEffect(() => {
    if (!open) return;
    setView('root');
    setActiveCategoryKey(null);
    setActiveValue(null);
    setCategoryFilterTerm('');
    setRootSearchTerm('');
    setWithinSearchTerm('');
    setOtherTagTerm('');
    setSelected(new Map((initialSelectedRoutes || []).filter((r) => r?.id != null).map((r) => [r.id, r])));
    setAsOfDate(asOfDateValue || '');
    setRouteFacets({ mine: false, curated: false, autogen: false });
    setShowEverything(isAvailUser(user));
    setFragmentsExpanded(false);
    setSortMode('best');
  }, [open]);

  const activeCategory = TAG_CATEGORIES.find((c) => c.key === activeCategoryKey) || null;

  const searchTerm = view === 'root' ? rootSearchTerm : (view === 'value' ? withinSearchTerm : '');
  const tagValue = view === 'value' ? activeValue?.value : null;
  const tagLikeTerm = view === 'other' ? otherTagTerm.trim() : null;

  // Collapse single-TMC "fragment" routes out of any UNSCOPED (non-search) view, behind an
  // explicit "show short segments too" reveal — a plain tag-folder/root browse can otherwise be
  // dominated by near-point segments (confirmed live: 72% of the whole catalog is single-TMC,
  // and the most-recently-created rows are a fragments-only batch — see
  // routeScore.js's EXCLUDE_FRAGMENTS_FILTER comment for why this has to be a SERVER-side
  // exclusion, not just a client-side re-sort). Any typed search (name search, or the "Other
  // tags" free-text search which requires a query to show anything at all) is a direct match, so
  // fragments it surfaces stay inline, badge and all — never collapsed.
  const collapseFragments = view !== 'other' && !searchTerm.trim();

  const extraFilterGroups = useMemo(() => {
    const groups = [];
    if (routeFacets.mine && currentUserId) groups.push({ col: 'created_by', op: 'filter', value: [String(currentUserId)] });
    if (routeFacets.curated) groups.push({ col: 'tags', op: 'exclude', value: [AUTO_GENERATED_TAG] });
    if (routeFacets.autogen) groups.push({ col: 'tags', op: 'filter', value: [AUTO_GENERATED_TAG] });
    if (!showEverything) {
      const allowList = buildVisibilityAllowListFilterGroup(user, AUTO_GENERATED_TAG);
      if (allowList) groups.push(allowList);
    }
    if (collapseFragments && !fragmentsExpanded) groups.push(EXCLUDE_FRAGMENTS_FILTER);
    return groups;
  }, [routeFacets, currentUserId, showEverything, user, collapseFragments, fragmentsExpanded]);

  const { results, loading, error } = useTagBrowser({
    apiLoad,
    routeSourceInfo,
    enabled: open && view !== 'category',
    searchTerm,
    tagValue,
    tagLikeTerm: tagLikeTerm || null,
    extraFilterGroups,
  });

  // Stringified: callers may pass a mix of `id` and legacy `route_id` values (see
  // ReportRouteList.jsx's `sameRoute`), and result rows' `id` can arrive as a number.
  const excludeSet = useMemo(
    () => new Set(Array.from(excludeRouteIds || []).map(String)),
    [excludeRouteIds]
  );
  // Already-added routes are only hidden from the unscoped "recent" default list (root view,
  // no search term) — that's a suggestion list, and re-adding the same catalog route with a
  // different date/time window is a legitimate, common case (see the old AddRouteSearch.jsx's
  // own comment on this). Any deliberate, targeted view — a name search, a tag-browsed folder,
  // free-text tag search — still surfaces them, just flagged via `alreadyAdded` so the list stays
  // informative without blocking a real re-add.
  const isUnscopedRecentView = view === 'root' && !rootSearchTerm.trim();
  // Prominence-ranked, ready-to-render results (2026-08-25): score+sort always applies — this
  // is the "Best match" default sort replacing plain created_at/name ordering everywhere a route
  // list renders, not just the root view.
  const visibleResults = useMemo(() => {
    const withIds = results.filter((r) => r.id != null);
    const scoped = isUnscopedRecentView
      ? withIds.filter((r) => !excludeSet.has(String(r.id)))
      : withIds.map((r) => ({ ...r, alreadyAdded: excludeSet.has(String(r.id)) }));
    return sortRows(scoped, sortMode, { scoreFn: (r) => routeScore(r, { currentUserId }), dateField: 'created_at' });
  }, [results, excludeSet, isUnscopedRecentView, currentUserId, sortMode]);

  const visibleCategoryValues = useMemo(() => {
    if (!activeCategory) return [];
    const q = categoryFilterTerm.trim().toLowerCase();
    if (!q) return activeCategory.values;
    return activeCategory.values.filter((v) => v.label.toLowerCase().includes(q));
  }, [activeCategory, categoryFilterTerm]);

  const toggleSelect = (row) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  };

  const goRoot = () => { setView('root'); setActiveCategoryKey(null); setActiveValue(null); setCategoryFilterTerm(''); setFragmentsExpanded(false); };
  const goCategory = (key) => { setView('category'); setActiveCategoryKey(key); setActiveValue(null); setCategoryFilterTerm(''); };
  const goValue = (v) => { setView('value'); setActiveValue(v); setWithinSearchTerm(''); setFragmentsExpanded(false); };
  const goOther = () => { setView('other'); setOtherTagTerm(''); setFragmentsExpanded(false); };
  const goAutoGenerated = () => { setView('value'); setActiveValue({ value: AUTO_GENERATED_TAG, label: 'Auto-generated' }); setWithinSearchTerm(''); setFragmentsExpanded(false); };

  const toggleFacet = (key) => {
    if (key === 'showEverything') { setShowEverything((v) => !v); return; }
    setRouteFacets((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const clearFacets = () => setRouteFacets({ mine: false, curated: false, autogen: false });
  const facetChips = [
    { key: 'mine', label: 'Mine', active: routeFacets.mine },
    { key: 'curated', label: 'Curated', active: routeFacets.curated },
    { key: 'autogen', label: 'Auto-generated', active: routeFacets.autogen },
    // Default visibility toggle (routes-reports-users-mesh.md, Workstream D) — deliberately kept
    // OUT of clearFacets/routeFacets: it's a "widen the default" switch, not a manual narrowing
    // facet grouped with the three above, and "Clear all" shouldn't silently drop the restriction.
    { key: 'showEverything', label: "Show everyone's", active: showEverything },
  ];

  const selectedCount = selected.size;
  const isExact = selectionMode === 'exact';
  const canConfirm = (isExact ? selectedCount === requiredCount : selectedCount >= 1) && (!showAsOfDate || !!asOfDate);
  const countMessage = isExact
    ? (selectedCount < requiredCount
        ? `Select ${requiredCount - selectedCount} more (${selectedCount}/${requiredCount})`
        : selectedCount > requiredCount
          ? `Deselect ${selectedCount - requiredCount} (${selectedCount}/${requiredCount})`
          : `${selectedCount}/${requiredCount} selected`)
    : `${selectedCount} selected`;

  const handleConfirm = () => {
    onConfirm?.(Array.from(selected.values()), showAsOfDate ? asOfDate : undefined);
    setOpen?.(false);
  };

  // Mine / auto-generated / curated badge for one row — a merged classification instead of the
  // separate browse-tree distinction the modal used to rely on entirely.
  const ownershipBadge = (r) => {
    if (isOwnedByCurrentUser(r.created_by, currentUserId)) return <Pill text="Mine" activeStyle="blue" />;
    if (parseTags(r.tags).includes(AUTO_GENERATED_TAG)) return <Pill text="Auto-generated" activeStyle="zinc" />;
    return <Pill text="Curated" activeStyle="green" />;
  };

  const renderRouteRow = (r) => {
    const tmcCount = parseTmcArray(r.tmc_array).length;
    const isSelected = selected.has(r.id);
    const tags = parseTags(r.tags);
    return (
      <button
        key={r.id}
        type="button"
        className={isSelected ? t.routeItemSelected : t.routeItem}
        onClick={() => toggleSelect(r)}
      >
        <input type="checkbox" className={t.routeCheckbox} checked={isSelected} readOnly />
        <span className={t.routeItemBody}>
          <span className={t.routeItemTopLine}>
            <span className={t.routeName}>{r.name}</span>
            <span className={t.routeMeta}>{tmcCount} TMC{tmcCount === 1 ? '' : 's'}</span>
          </span>
          <span className={t.routeBadgeRow}>
            {ownershipBadge(r)}
            {tmcCount === 1 ? <Pill text="Fragment" activeStyle="amber" /> : null}
            {r.alreadyAdded ? <span className={t.alreadyAddedBadge}>Already on report</span> : null}
          </span>
          {tags.length > 0 && (
            <span className={t.routeTagChips}>
              {tags.map((tag) => <span key={tag} className={t.routeTagChip}>{tagToLabel(tag, currentUserId)}</span>)}
            </span>
          )}
        </span>
      </button>
    );
  };

  // `showFragmentsToggle`: this view is currently excluding fragments server-side (
  // collapseFragments) and hasn't been expanded yet — offer the reveal regardless of whether
  // the current (already-filtered) list is empty, since we don't fetch a count of what's
  // excluded (that would need a second round-trip) — the label is deliberately count-free.
  const showFragmentsToggle = collapseFragments && !fragmentsExpanded;

  const renderRouteList = (list) => {
    if (loading) return <div className={t.loading}>Loading…</div>;
    if (error) return <div className={t.error}>{error}</div>;
    if (!list.length && !showFragmentsToggle) return <div className={t.empty}>No routes found.</div>;
    return (
      <div className={t.routeList}>
        {list.map(renderRouteRow)}
        {showFragmentsToggle ? (
          <button type="button" className={t.fragmentsToggle} onClick={() => setFragmentsExpanded(true)}>
            Show short segments too
          </button>
        ) : null}
      </div>
    );
  };

  const breadcrumb = (
    <div className={t.breadcrumb}>
      <span className={view === 'root' ? t.breadcrumbStepCurrent : t.breadcrumbStep} onClick={goRoot}>All Routes</span>
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
        <div className={t.header}>Add Routes</div>
        {breadcrumb}

        {selected.size > 0 ? (
          <div className={t.selectedChips}>
            {Array.from(selected.values()).map((r) => (
              <span key={r.id} className={t.selectedChip}>
                <span className={t.selectedChipLabel}>{r.name}</span>
                <button type="button" className={t.selectedChipRemove} onClick={() => toggleSelect(r)}>
                  <Icon icon="XMark" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {view === 'root' ? (
          <PickerSearchInput t={t} Input={Input} Icon={Icon} value={rootSearchTerm}
            onChange={(e) => setRootSearchTerm(e.target.value)} placeholder="Search routes by name…" />
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
          <PickerCountBar t={t}
            countLabel={`${visibleResults.length} route${visibleResults.length === 1 ? '' : 's'}${showFragmentsToggle ? ' (short segments hidden)' : ''}`}
            sortValue={sortMode} sortOptions={SORT_MODE_OPTIONS} onSortChange={setSortMode}
          />
        ) : null}

        <div className={t.body}>
          {view === 'root' ? (
            <>
              {/* report-authoring-ux-overhaul.md Tier 5 (2026-08-20): moved above the default
                  route list per Ryan's live feedback — a novice author has no reason to think
                  the tag browser exists below a route list that already looks complete on its
                  own, so it would never get scrolled to. */}
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
                <button type="button" className={t.categoryLink} onClick={goAutoGenerated}>Auto-generated</button>
                <span className={t.categoryLinkSep}>·</span>
                <button type="button" className={t.categoryLink} onClick={goOther}>Other tags</button>
              </div>
              {renderRouteList(visibleResults)}
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

          {view === 'value' ? renderRouteList(visibleResults) : null}
          {view === 'other' ? (otherTagTerm.trim() ? renderRouteList(visibleResults) : <div className={t.empty}>Type a tag to search.</div>) : null}
        </div>

        {showAsOfDate ? (
          <div className={t.asOfDateRow}>
            <label className={t.asOfDateLabel} htmlFor="route-tag-browser-as-of-date">Viewing as of</label>
            <input
              id="route-tag-browser-as-of-date"
              type="date"
              className={t.asOfDateInput}
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
        ) : null}

        <div className={t.footer}>
          <div className={t.footerCount}>{countMessage}</div>
          <div className={t.footerButtons}>
            <Button themeOptions={{ size: 'sm', color: 'transparent' }} disabled={!dismissible} onClick={() => setOpen?.(false)}>Cancel</Button>
            <Button themeOptions={{ size: 'sm', color: 'primary' }} disabled={!canConfirm} onClick={handleConfirm}>
              Add {selectedCount || ''} Route{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
