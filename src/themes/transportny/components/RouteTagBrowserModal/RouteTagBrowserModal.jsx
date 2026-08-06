import { useContext, useEffect, useMemo, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { routeTagBrowserModalTheme } from './RouteTagBrowserModal.theme';
import { useTagBrowser } from './useTagBrowser';
import { TAG_CATEGORIES, AUTO_GENERATED_TAG, parseTags, tagToLabel } from './tagCategories';
import { parseTmcArray } from '../ReportRouteList/utils';

// Shared route-picker modal — mirrors the old tool's folder-browser *organizing effect* (drill
// into a category, see routes, select) without real folders in the data model; tags stand in for
// folders. Used by ReportRouteList's add-route flow (`selectionMode: 'any'`) and Dynamic Reports'
// route-slot entry gate (`selectionMode: 'exact'` + `requiredCount` + `initialSelectedRoutes`,
// the last added so a slot/URL-count mismatch pre-populates already-resolved groups instead of
// discarding them) — see planning/transportny/tasks/current/dynamic-reports-and-route-tags.md.
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
}) {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon, Modal } = UI || {};
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
  }, [open]);

  const activeCategory = TAG_CATEGORIES.find((c) => c.key === activeCategoryKey) || null;

  const searchTerm = view === 'root' ? rootSearchTerm : (view === 'value' ? withinSearchTerm : '');
  const tagValue = view === 'value' ? activeValue?.value : null;
  const tagLikeTerm = view === 'other' ? otherTagTerm.trim() : null;

  const { results, loading, error } = useTagBrowser({
    apiLoad,
    routeSourceInfo,
    enabled: open && view !== 'category',
    searchTerm,
    tagValue,
    tagLikeTerm: tagLikeTerm || null,
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
  const visibleResults = useMemo(() => {
    const withIds = results.filter((r) => r.id != null);
    return isUnscopedRecentView
      ? withIds.filter((r) => !excludeSet.has(String(r.id)))
      : withIds.map((r) => ({ ...r, alreadyAdded: excludeSet.has(String(r.id)) }));
  }, [results, excludeSet, isUnscopedRecentView]);

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

  const goRoot = () => { setView('root'); setActiveCategoryKey(null); setActiveValue(null); setCategoryFilterTerm(''); };
  const goCategory = (key) => { setView('category'); setActiveCategoryKey(key); setActiveValue(null); setCategoryFilterTerm(''); };
  const goValue = (v) => { setView('value'); setActiveValue(v); setWithinSearchTerm(''); };
  const goOther = () => { setView('other'); setOtherTagTerm(''); };
  const goAutoGenerated = () => { setView('value'); setActiveValue({ value: AUTO_GENERATED_TAG, label: 'Auto-generated' }); setWithinSearchTerm(''); };

  const selectedCount = selected.size;
  const isExact = selectionMode === 'exact';
  const canConfirm = isExact ? selectedCount === requiredCount : selectedCount >= 1;
  const countMessage = isExact
    ? (selectedCount < requiredCount
        ? `Select ${requiredCount - selectedCount} more (${selectedCount}/${requiredCount})`
        : selectedCount > requiredCount
          ? `Deselect ${selectedCount - requiredCount} (${selectedCount}/${requiredCount})`
          : `${selectedCount}/${requiredCount} selected`)
    : `${selectedCount} selected`;

  const handleConfirm = () => {
    onConfirm?.(Array.from(selected.values()));
    setOpen?.(false);
  };

  const renderRouteList = (list) => {
    if (loading) return <div className={t.loading}>Loading…</div>;
    if (error) return <div className={t.error}>{error}</div>;
    if (!list.length) return <div className={t.empty}>No routes found.</div>;
    return (
      <div className={t.routeList}>
        {list.map((r) => {
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
                  {r.alreadyAdded ? <span className={t.alreadyAddedBadge}>Already on report</span> : null}
                  <span className={t.routeMeta}>{tmcCount} TMC{tmcCount === 1 ? '' : 's'}</span>
                </span>
                {tags.length > 0 && (
                  <span className={t.routeTagChips}>
                    {tags.map((tag) => <span key={tag} className={t.routeTagChip}>{tagToLabel(tag)}</span>)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
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
          <div className={t.searchWrapper}>
            <Icon icon="Search" className={t.searchIcon} />
            <Input placeholder="Search routes by name…" value={rootSearchTerm} onChange={(e) => setRootSearchTerm(e.target.value)} />
          </div>
        ) : null}

        {view === 'category' ? (
          <div className={t.searchWrapper}>
            <Icon icon="Search" className={t.searchIcon} />
            <Input placeholder={`Filter ${activeCategory?.label.toLowerCase()}…`} value={categoryFilterTerm} onChange={(e) => setCategoryFilterTerm(e.target.value)} />
          </div>
        ) : null}

        {view === 'value' ? (
          <div className={t.searchWrapper}>
            <Icon icon="Search" className={t.searchIcon} />
            <Input placeholder="Search within this tag…" value={withinSearchTerm} onChange={(e) => setWithinSearchTerm(e.target.value)} />
          </div>
        ) : null}

        {view === 'other' ? (
          <div className={t.searchWrapper}>
            <Icon icon="Search" className={t.searchIcon} />
            <Input placeholder="Type a tag (e.g. a project number)…" value={otherTagTerm} onChange={(e) => setOtherTagTerm(e.target.value)} />
          </div>
        ) : null}

        <div className={t.body}>
          {view === 'root' ? (
            <>
              {renderRouteList(visibleResults)}
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
