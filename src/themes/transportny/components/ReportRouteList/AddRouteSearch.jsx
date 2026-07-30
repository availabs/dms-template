import { parseTmcArray } from './utils';

// Inline "Add a route" box at the top of the panel — replaces the old
// catalog-Spreadsheet + click_publish + confirm-banner round trip entirely.
// An empty input shows the catalog's most recently created routes (most users
// already know the route they just made, and it's near the top); typing >= 2
// characters searches by name instead. Clicking a result adds it immediately —
// no confirm step, since a mis-click is one `removeRoute` away.
export default function AddRouteSearch({
  theme: t,
  Input,
  Icon,
  searchTerm,
  onSearchTermChange,
  isSearching,
  results,
  loading,
  error,
  onAdd,
  justAddedName,
}) {
  return (
    <div className={t.addRouteWrapper}>
      <div className={t.addRouteInputWrapper}>
        <Icon icon="Search" className={t.addRouteSearchIcon} />
        <Input
          placeholder="Add a route…"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>
      {justAddedName ? <div className={t.addRouteJustAdded}>Added “{justAddedName}”</div> : null}
      {error ? <div className={t.error}>{error}</div> : null}
      {!isSearching ? <div className={t.addRouteResultsLabel}>Recently created</div> : null}
      {loading ? (
        <div className={t.loading}>Loading…</div>
      ) : (
        <div className={t.addRouteResults}>
          {results.map((r) => {
            const tmcCount = parseTmcArray(r.tmc_array).length;
            return (
              <button key={r.id} type="button" className={t.addRouteResultItem} onClick={() => onAdd(r)}>
                <span className={t.addRouteResultName}>{r.name}</span>
                <span className={t.addRouteResultMeta}>
                  {tmcCount} TMC{tmcCount === 1 ? '' : 's'}
                </span>
                <Icon icon="Plus" className={t.addRouteResultIcon} />
              </button>
            );
          })}
          {!loading && results.length === 0 ? (
            <div className={t.empty}>
              {isSearching ? `No routes match "${searchTerm}".` : 'No routes in the catalog yet.'}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
