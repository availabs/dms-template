// Shared presentational pieces behind BOTH picker modals (RouteTagBrowserModal,
// ReportPickerModal) — the "search-input-with-icon header, facet-chip row, sort control,
// footer count/hint bar" Ryan asked to be genuinely shared rather than hand-duplicated per
// modal. Each caller supplies its own theme object (which itself spreads the shared
// `pickerModalTheme` — see PickerModal.theme.js) so both modals render these identically
// styled unless a caller deliberately overrides a key. Kept as plain presentational
// components (no data fetching, no picker-specific state) — the multi-view drill-down
// RouteTagBrowserModal needs and the flat single-view ReportPickerModal needs stay owned by
// each modal, only the chrome around them is shared.

// Search box: icon + text input + a clear (×) button that only appears once something is
// typed. `t` is the caller's merged theme (spreads pickerModalTheme).
export const PickerSearchInput = ({ t, Input, Icon, value, onChange, placeholder, autoFocus }) => (
  <div className={t.searchWrapper}>
    <Icon icon="Search" className={t.searchIcon} />
    <Input placeholder={placeholder} value={value} onChange={onChange} autoFocus={autoFocus} />
    {value ? (
      <button type="button" className={t.searchClear} onClick={() => onChange({ target: { value: '' } })} aria-label="Clear search">
        <Icon icon="XMark" />
      </button>
    ) : null}
  </div>
);

// "Narrow by" facet-chip row — each facet is `{ key, label, active }`; clicking a chip calls
// `onToggle(key)`. Chips are rendered with the shared themed `Pill` primitive (not a bespoke
// chip component) — `activeStyle` flips between a highlighted and a neutral named pill style
// so a site theme re-skinning `theme.pill` re-skins every facet chip in both modals at once.
export const PickerFacetChips = ({ t, Pill, facets, onToggle, onClearAll, label = 'narrow by', activeColor = 'blue', inactiveColor = 'default' }) => {
  if (!facets?.length) return null;
  const anyActive = facets.some((f) => f.active);
  return (
    <div className={t.facetRow}>
      <span className={t.facetLabel}>{label}</span>
      {facets.map((f) => (
        <Pill
          key={f.key}
          text={f.label}
          activeStyle={f.active ? activeColor : inactiveColor}
          onClick={() => onToggle(f.key)}
        />
      ))}
      {anyActive && onClearAll ? (
        <button type="button" className={t.facetClearAll} onClick={onClearAll}>clear</button>
      ) : null}
    </div>
  );
};

// Result-count + sort-mode bar, sitting just above the scrollable result list — same shape in
// both modals. 2026-09-03 (Ryan's correction): this used to render "sort: Best match" as a
// static label — looked like a chooseable control but wasn't one. Now a real native <select>
// bound to `sortValue`/`onSortChange`; `sortOptions` defaults to the shared SORT_MODE_OPTIONS
// (pickerScoring.js) so both modals get the same three modes unless a caller has a reason to
// override. A bare `<select>` (not UI.Select/MultiSelect) on purpose — same "small utility
// control, native element, styled via the modal's own theme" convention this file's sibling
// RouteTagBrowserModal.jsx already uses for its `asOfDate` date input, not a reason to pull in
// MultiSelect's much heavier search/chip UI for a 3-item dropdown.
export const PickerCountBar = ({ t, countLabel, sortValue, sortOptions, onSortChange }) => (
  <div className={t.countBar}>
    <span className={t.countLabel}>{countLabel}</span>
    <label className={t.sortPill}>
      sort
      <select
        className={t.sortSelect}
        value={sortValue}
        onChange={(e) => onSortChange?.(e.target.value)}
      >
        {(sortOptions || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  </div>
);

// Small note bar under the result list / above the footer buttons — left = a one-line
// explanation of the active sort/ranking, right = optional extra hint (e.g. "esc to close").
export const PickerFooterNoteBar = ({ t, note, hint }) => (
  <div className={t.footerNoteBar}>
    <span>{note}</span>
    {hint ? <span>{hint}</span> : null}
  </div>
);
