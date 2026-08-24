import React from "react";
import { ThemeContext } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { ROUTE_COLOR, ROUTE_SECONDARY_COLOR } from "../constants";

const formatDuration = (seconds) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
};
const fmtSigned = (n, digits) => (n >= 0 ? "+" : "") + n.toFixed(digits);

const VARIANT_LABELS = { shortest: "Shortest", fastest: "Fastest" };

// One direction's open (baseline, no exclusion) vs closed (detour, segment excluded) comparison,
// stacked - the original reviewed-and-picked design (2026-08-20), restored after a simplification
// attempt went the wrong way ("keep the first one").
const ImpactBlock = ({ label, color, dashed, openRoute, closedRoute }) => {
  const swatchStyle = dashed
    ? { background: "none", borderTop: `2px dashed ${color}`, height: 0 }
    : { background: color };

  if (!closedRoute) {
    return (
      <div className="border rounded p-2 text-xs text-gray-400 border-dashed mb-2">
        <div className="flex items-center gap-1.5 font-semibold mb-0.5">
          <span className="inline-block w-4" style={swatchStyle} />
          {label}
        </div>
        No route this direction
      </div>
    );
  }

  const closed = closedRoute.feature.properties;
  const open = openRoute?.feature?.properties;

  return (
    <div className="border rounded p-2 mb-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
        <span className="inline-block w-4" style={swatchStyle} />
        {label}
      </div>

      {open ? (
        <>
          <div className="flex justify-between text-xs py-0.5">
            <span className="text-gray-500">Open</span>
            <span className="font-mono">{open.length.toFixed(1)} mi &middot; {formatDuration(open.duration_s)} &middot; {open.edge_count} edges</span>
          </div>
          <div className="flex justify-between text-xs py-0.5">
            <span className="text-gray-500">Closed</span>
            <span className="font-mono">{closed.length.toFixed(1)} mi &middot; {formatDuration(closed.duration_s)} &middot; {closed.edge_count} edges</span>
          </div>
          <div className="flex justify-between text-xs py-0.5 border-t mt-0.5 pt-1 font-semibold" style={{ color: closed.length > open.length ? "#b45309" : "#374151" }}>
            <span>Δ</span>
            <span className="font-mono">
              {fmtSigned(closed.length - open.length, 1)} mi &middot; {fmtSigned((closed.duration_s - open.duration_s) / 60, 0)} min
              {open.length > 0 && ` (${fmtSigned(((closed.length - open.length) / open.length) * 100, 0)}%)`}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-gray-500">Closed: {closed.length.toFixed(1)} mi &middot; {formatDuration(closed.duration_s)} &middot; {closed.edge_count} edges</div>
          <div className="text-xs text-gray-400 italic mt-0.5">Open (baseline) route unavailable for comparison</div>
        </>
      )}
    </div>
  );
};

const DetourDetailsPanel = ({
  selectedSegment,
  canGetDetour,
  loading,
  error,
  resolveError,
  routes,
  baselineRoutes,
  selectedVariant,
  onSelectVariant,
  onGetDetour,
  onReset,
  startEnd,
}) => {
  const { UI } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};

  const hasResult = Boolean(routes) || Boolean(error);
  const AtoB = routes?.AtoB?.[selectedVariant];
  const BtoA = routes?.BtoA?.[selectedVariant];
  const openAtoB = baselineRoutes?.AtoB?.[selectedVariant];
  const openBtoA = baselineRoutes?.BtoA?.[selectedVariant];
  // Whichever direction is rendered bold on the map (primary) - see comp.jsx: AtoB if it exists,
  // otherwise BtoA. Used only to pick which one's segment list to show below.
  const primary = AtoB ? { label: "Start → End", route: AtoB } : { label: "End → Start", route: BtoA };

  // 2026-08-20: start/end normally continue the SAME road as the closed segment (see
  // findSameRoadNode.js) - if either point had to fall back to a plain nearest-node search, that
  // means this endpoint is genuinely disconnected from any continuing road (a dead-end/isolated
  // case), worth surfacing rather than presenting it as an ordinary pick.
  const anyFallback = startEnd?.start?.usedFallback || startEnd?.end?.usedFallback;

  const asymmetric = routes?.AtoB && routes?.BtoA &&
    routes.AtoB.shortest.feature.properties.edge_count !== routes.BtoA.shortest.feature.properties.edge_count;

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-10 w-auto sm:w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto">
      <div className="font-bold mb-1">Segment closure impact</div>

      {!selectedSegment && !loading && (
        <div className="text-gray-600 mb-2">
          Click a road segment on the map to see what trips through it would have to do if it were closed.
        </div>
      )}

      {selectedSegment && !hasResult && !resolveError && (
        <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-red-700">
            Segment {selectedSegment.ogcFid} selected. {canGetDetour ? "Click \"Get detour\" below." : "Finding nearby start/end points…"}
          </span>
        </div>
      )}

      {selectedSegment && resolveError && (
        <div className="mb-2 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5">
          <span className="text-red-700">{resolveError}</span>
        </div>
      )}

      {selectedSegment && anyFallback && (
        <div className="mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
          One end of this segment has no continuing road nearby (a dead end or disconnected point) -
          using the nearest node instead.
        </div>
      )}

      {loading && <div className="text-gray-600 mb-2">Computing detour (both directions)…</div>}

      {error && (
        <div className="text-red-600 mb-2">
          No detour possible for this segment in either direction: {error}
        </div>
      )}

      {routes && !loading && !error && (
        <>
          {asymmetric && (
            <div className="mb-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1">
              The two directions take different routes around this closure.
            </div>
          )}

          <div className="flex gap-2 mb-2">
            {["shortest", "fastest"].map((variant) => {
              const isSelected = variant === selectedVariant;
              return (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  className="flex-1 text-left border rounded p-2"
                  style={{ borderColor: isSelected ? ROUTE_COLOR : "#d1d5db", background: isSelected ? "#fff7ed" : "white" }}
                >
                  <div className="text-xs font-semibold text-gray-700">{VARIANT_LABELS[variant]}</div>
                </button>
              );
            })}
          </div>

          <ImpactBlock label="Start → End" color={ROUTE_COLOR} openRoute={openAtoB} closedRoute={AtoB} />
          <ImpactBlock label="End → Start" color={ROUTE_SECONDARY_COLOR} dashed openRoute={openBtoA} closedRoute={BtoA} />

          {primary.route?.segments?.length > 0 && (
            <div className="mt-1">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                {primary.label} segments ({primary.route.segments.length})
              </div>
              <div className="max-h-64 overflow-y-auto border rounded divide-y">
                {primary.route.segments.map((seg, i) => (
                  <div key={seg.edge_id} className="flex justify-between px-2 py-1 text-xs">
                    <span className="text-gray-500">
                      {i + 1}. {seg.highway || "unknown"}
                    </span>
                    <span className="font-mono">{Math.round(seg.length_m)} m</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {Button && canGetDetour && !loading && (
        <Button className="mt-3 w-full" onClick={onGetDetour}>
          Get detour
        </Button>
      )}

      {Button && (selectedSegment || hasResult) && (
        <Button className="mt-2 w-full" onClick={onReset}>
          {hasResult ? "Clear detour" : "Clear selection"}
        </Button>
      )}
    </div>
  );
};

export { DetourDetailsPanel };
