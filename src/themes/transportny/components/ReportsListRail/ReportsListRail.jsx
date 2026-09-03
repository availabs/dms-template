import { useContext, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { CMSContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { reportsListRailTheme } from './ReportsListRail.theme';
import { TAG_CATEGORIES, DYNAMIC_REPORT_TEMPLATE_TAG, tagToLabel } from '../RouteTagBrowserModal/tagCategories';

// The "All reports" list page's filter rail (npmrds-reports-list.html, npmrds-all-reports-list-
// page.md — the FINAL Architecture decision). Pure UI: it owns NONE of the data fetching — the
// results table is a native `table` section on the same page, reacting to the URL page-filters
// this component reads and writes. That's why this component takes no data-source props at all
// and needs no ComponentContext: it only touches `pageState.filters` (read) and the URL (write),
// the same mechanism `ReportPageHeader.jsx`'s "Viewing as of" control already uses.
//
// Page-filter keys this component owns (see the task file's registry table):
//   tag                — a category/value pick, exact `tags` array_contains match
//   tag_like           — the "Other tags" free-text box, substring `tags` match
//   mine               — "Mine" toggle; carries the VIEWER'S OWN id when on
//   restricted_owner / restricted_curated — "Show everyone's" toggle (OFF only); written and
//     cleared TOGETHER, never independently — see Architecture decision item 2 for why this
//     pair replaces the modal's `agency:<group>` OR-branch (dropped, no native equivalent).
//
// Deliberately NOT reused from ReportPickerModal: the view-state machine (root/category/value/
// other, one view at a time) — this page's rail is a STANDING panel (npmrds-reports-list.html's
// own note: "flattened from a one-view-at-a-time state machine into a standing rail"), so category
// expand/collapse is local UI state, not a page-level `view`.
export default function ReportsListRail() {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Pill, Icon } = UI || {};
  const { user } = useContext(CMSContext) || {};
  const { pageState } = useContext(PageContext) || {};
  const navigate = useNavigate();
  const location = useLocation();
  const t = { ...reportsListRailTheme, ...getComponentTheme(themeFromContext, 'reportsListRail') };
  const currentUserId = user?.id;

  // Local, ephemeral UI state — which category's value panel is open, its own narrowing text,
  // and the "Other tags" free-text draft before it's committed to the URL. None of this is
  // URL-bound; only the RESOLVED tag/mine/restricted values below are.
  const [expandedCategoryKey, setExpandedCategoryKey] = useState(null);
  const [categoryFilterTerm, setCategoryFilterTerm] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');

  // Read a page filter's current value(s) off `pageState.filters` by searchKey — same
  // normalization ReportPageHeader.jsx's baseDate read uses (values arrives as a bare string or
  // an array depending on how the URL merge represents it).
  const filterValue = (searchKey) => {
    const f = pageState?.filters?.find((f) => f.searchKey === searchKey);
    const arr = Array.isArray(f?.values) ? f.values : [f?.values];
    return arr.filter((v) => v != null && String(v).length)[0] || null;
  };

  const tagValue = filterValue('tag');
  const tagLikeValue = filterValue('tag_like');
  const mineValue = filterValue('mine');
  const isMine = mineValue != null && String(mineValue) === String(currentUserId);
  const isRestricted = filterValue('restricted_owner') != null;

  // Write/clear one or more URL params together and navigate — `replace: true` so typing/
  // toggling doesn't spam browser history the way `ReportPageHeader`'s date control does not
  // need to (that one's a single deliberate commit; this one can fire per click or per blur).
  const setParams = (entries) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of entries) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
  };

  const setTag = (value) => setParams([['tag', value], ['tag_like', null]]);
  const setTagLike = (value) => setParams([['tag_like', value], ['tag', null]]);
  const toggleMine = () => setParams([['mine', isMine ? null : currentUserId]]);
  const toggleRestricted = () => setParams(
    isRestricted
      ? [['restricted_owner', null], ['restricted_curated', null]]
      : [['restricted_owner', currentUserId], ['restricted_curated', DYNAMIC_REPORT_TEMPLATE_TAG]]
  );
  const clearAll = () => {
    setParams([['tag', null], ['tag_like', null], ['mine', null], ['restricted_owner', null], ['restricted_curated', null]]);
    setExpandedCategoryKey(null);
    setCategoryFilterTerm('');
    setOtherOpen(false);
    setOtherDraft('');
  };

  // Which category (if any) the active `tag` value belongs to, for the breadcrumb + value-list
  // highlight — a plain scan of the fixed vocabulary, same shape as `canonicalizeTag`'s lookup.
  const activeCategory = useMemo(() => {
    if (!tagValue) return null;
    return TAG_CATEGORIES.find((c) => c.values.some((v) => v.value === tagValue)) || null;
  }, [tagValue]);
  const activeValueLabel = useMemo(() => {
    if (!tagValue) return null;
    for (const c of TAG_CATEGORIES) {
      const v = c.values.find((v) => v.value === tagValue);
      if (v) return v.label;
    }
    return tagToLabel(tagValue, currentUserId);
  }, [tagValue, currentUserId]);

  const visibleCategoryValues = useMemo(() => {
    const cat = TAG_CATEGORIES.find((c) => c.key === expandedCategoryKey);
    if (!cat) return [];
    const q = categoryFilterTerm.trim().toLowerCase();
    if (!q) return cat.values;
    return cat.values.filter((v) => v.label.toLowerCase().includes(q));
  }, [expandedCategoryKey, categoryFilterTerm]);

  const goCategory = (key) => {
    setExpandedCategoryKey((prev) => (prev === key ? null : key));
    setCategoryFilterTerm('');
  };
  const pickValue = (v) => {
    setTag(v.value);
    setExpandedCategoryKey(null);
    setCategoryFilterTerm('');
  };
  const commitOther = () => {
    const val = otherDraft.trim();
    setTagLike(val || null);
  };

  const anyActive = Boolean(tagValue || tagLikeValue || isMine || isRestricted);

  return (
    <div className={t.wrapper}>
      {(tagValue || tagLikeValue || isMine) ? (
        <div className={t.card}>
          <div className={t.breadcrumb}>
            <span className={t.breadcrumbStep} onClick={() => { setTag(null); setTagLike(null); }}>All Reports</span>
            {activeCategory ? (<><span className={t.breadcrumbSep}>/</span><span className={t.breadcrumbStepCurrent}>{activeCategory.label}</span></>) : null}
            {tagValue && activeValueLabel ? (<><span className={t.breadcrumbSep}>/</span><span className={t.breadcrumbStepCurrent}>{activeValueLabel}</span></>) : null}
            {tagLikeValue ? (<><span className={t.breadcrumbSep}>/</span><span className={t.breadcrumbStepCurrent}>&ldquo;{tagLikeValue}&rdquo;</span></>) : null}
          </div>
          <div className={t.activeChips}>
            {tagValue ? (
              <span className={t.activeChip}>
                <span className={t.activeChipLabel}>{activeValueLabel}</span>
                <button type="button" className={t.activeChipRemove} onClick={() => setTag(null)}><Icon icon="XMark" /></button>
              </span>
            ) : null}
            {tagLikeValue ? (
              <span className={t.activeChip}>
                <span className={t.activeChipLabel}>&ldquo;{tagLikeValue}&rdquo;</span>
                <button type="button" className={t.activeChipRemove} onClick={() => setTagLike(null)}><Icon icon="XMark" /></button>
              </span>
            ) : null}
            {isMine ? (
              <span className={t.activeChip}>
                <span className={t.activeChipLabel}>Mine</span>
                <button type="button" className={t.activeChipRemove} onClick={toggleMine}><Icon icon="XMark" /></button>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={t.card}>
        <div className={t.cardHeadRow}>
          <span className={t.cardLabel}>narrow by</span>
          {anyActive ? <button type="button" className={t.clearAll} onClick={clearAll}>clear all</button> : null}
        </div>
        <div className={t.facetRow}>
          <Pill text="Mine" activeStyle={isMine ? 'blue' : 'default'} onClick={toggleMine} />
          <Pill text="Show everyone's" activeStyle={!isRestricted ? 'blue' : 'default'} onClick={toggleRestricted} />
        </div>
        <p className={t.facetNote}>
          <span className="font-mono">Show everyone's</span> ships ON here — listing the library is
          this page's whole job. Turned off, only your own reports and the dynamic-report templates
          are shown (the live picker's default for anyone outside the AVAIL group).
        </p>
      </div>

      <div className={t.card}>
        <div className={t.cardLabel} style={{ marginBottom: '10px' }}>Browse by tag</div>
        <div className={t.categoryPillRow}>
          {TAG_CATEGORIES.map((c) => (
            <button
              key={c.key} type="button"
              className={expandedCategoryKey === c.key ? t.categoryPillActive : t.categoryPill}
              onClick={() => goCategory(c.key)}
            >
              {c.label}
              <span className={expandedCategoryKey === c.key ? t.categoryPillHintActive : t.categoryPillHint}>{c.values.length}</span>
            </button>
          ))}
        </div>
        {expandedCategoryKey ? (
          <div className={t.categoryPanel}>
            <input
              type="text" className={t.categoryFilterInput}
              placeholder={`Filter ${TAG_CATEGORIES.find((c) => c.key === expandedCategoryKey)?.label.toLowerCase()}…`}
              value={categoryFilterTerm} onChange={(e) => setCategoryFilterTerm(e.target.value)}
            />
            <div className={t.valueList}>
              {visibleCategoryValues.map((v) => (
                <button
                  key={v.value} type="button"
                  className={v.value === tagValue ? t.valueItemActive : t.valueItem}
                  onClick={() => pickValue(v)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className={t.otherLinkRow}>
          <button type="button" className={t.otherLink} onClick={() => setOtherOpen((v) => !v)}>Other tags</button>
          {otherOpen ? (
            <div className={t.otherPanel}>
              <input
                type="text" className={t.otherInput}
                placeholder="Type a tag (e.g. a project number)…"
                value={otherDraft}
                onChange={(e) => setOtherDraft(e.target.value)}
                onBlur={commitOther}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitOther(); } }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
