import { parseTmcArray } from './utils';

// The pending-route confirm/cancel UI shown after a catalog click (see
// `ReportRouteList.jsx`'s `fetchDynamicRoute`/`pendingRoute`). Rendered at the TOP of
// the panel (above the route list) so it's visible immediately regardless of scroll
// position or how many routes are already in the report — the catalog click and this
// confirmation happen in two different page sections (main content vs. sidebar), so
// being easy to spot matters more here than in a typical inline confirm.
// `isDuplicate` is a plain boolean computed by the parent (does `pendingRoute.route_id`
// already appear in `routes`) — informational only, never blocks Confirm, since
// re-adding the same route with a different date range is a legitimate use case.
export default function AddRouteBanner({ theme: t, Button, pendingRoute, saving, isDuplicate, onConfirm, onCancel }) {
  if (!pendingRoute) return null;
  const tmcCount = parseTmcArray(pendingRoute.tmc_array).length;
  return (
    <div className={t.addRouteBanner}>
      <div className={t.addRouteBannerTitle}>Add “{pendingRoute.name}”?</div>
      {(tmcCount > 0 || pendingRoute.description) && (
        <div className={t.addRoutePreview}>
          {tmcCount > 0 ? `${tmcCount} TMC${tmcCount === 1 ? '' : 's'}` : null}
          {tmcCount > 0 && pendingRoute.description ? ' · ' : null}
          {pendingRoute.description || null}
        </div>
      )}
      {isDuplicate && (
        <div className={t.addRouteDuplicateNotice}>
          Already in this report — adding again will create a second entry.
        </div>
      )}
      <div className={t.addRouteButtons}>
        <Button disabled={saving} onClick={onConfirm}>
          {saving ? "Adding…" : "Confirm"}
        </Button>
        <Button disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
