import React from "react";
import { ThemeContext } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { ROUTE_VARIANT_COLORS } from "../constants";

const formatDuration = (seconds) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
};

const VARIANT_LABELS = { shortest: "Shortest", fastest: "Fastest" };

const RouteDetailsPanel = ({
  hasSource,
  hasDestination,
  canGetRoute,
  loading,
  error,
  routes,
  selectedVariant,
  onSelectVariant,
  onGetRoute,
  onReset,
}) => {
  const { UI } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};

  const step = !hasSource
    ? "Click a node on the map to set the source."
    : !hasDestination
    ? "Click a node on the map to set the destination."
    : !routes && !loading
    ? "Click \"Get route\" below."
    : null;

  const selected = routes?.[selectedVariant];

  return (
    <div className="absolute bottom-4 left-4 z-10 w-80 bg-white/95 border rounded-md shadow-md p-3 text-sm pointer-events-auto">
      <div className="font-bold mb-1">Point-to-point route</div>

      {step && <div className="text-gray-600 mb-2">{step}</div>}

      {loading && <div className="text-gray-600 mb-2">Computing route…</div>}

      {error && (
        <div className="text-red-600 mb-2">
          Couldn&apos;t find a route: {error}
        </div>
      )}

      {routes && !loading && !error && (
        <>
          <div className="flex gap-2 mb-2">
            {["shortest", "fastest"].map((variant) => {
              const r = routes[variant];
              const isSelected = variant === selectedVariant;
              return (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  className="flex-1 text-left border rounded p-2"
                  style={{
                    borderColor: isSelected ? ROUTE_VARIANT_COLORS.primary : "#d1d5db",
                    background: isSelected ? "#fff7ed" : "white",
                  }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: isSelected ? ROUTE_VARIANT_COLORS.primary : ROUTE_VARIANT_COLORS.secondary }}
                    />
                    {VARIANT_LABELS[variant]}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.feature.properties.length.toFixed(1)} mi &middot; {formatDuration(r.feature.properties.duration_s)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="divide-y">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Distance</span>
              <span className="font-mono">{selected.feature.properties.length.toFixed(1)} mi</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Est. time</span>
              <span className="font-mono">{formatDuration(selected.feature.properties.duration_s)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Path edges</span>
              <span className="font-mono">{selected.feature.properties.edge_count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Turn restrictions considered</span>
              <span className="font-mono">{selected.feature.properties.restrictions_considered.toLocaleString()}</span>
            </div>
          </div>

          {selected.segments?.length > 0 && (
            <div className="mt-2">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                Segments ({selected.segments.length})
              </div>
              <div className="max-h-40 overflow-y-auto border rounded divide-y">
                {selected.segments.map((seg, i) => (
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

      {Button && canGetRoute && !loading && (
        <Button className="mt-3 w-full" onClick={onGetRoute}>
          Get route
        </Button>
      )}

      {Button && (hasSource || hasDestination) && (
        <Button className="mt-2 w-full" onClick={onReset}>
          Clear points
        </Button>
      )}
    </div>
  );
};

export { RouteDetailsPanel };
