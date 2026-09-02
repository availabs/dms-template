import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { routeDetailsPanelTheme } from "./RouteDetailsPanel.theme";

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
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};
  const t = { ...routeDetailsPanelTheme, ...getComponentTheme(themeFromContext, "routeDetailsPanel") };

  const step = !hasSource
    ? "Click a node on the map to set the source."
    : !hasDestination
    ? "Click a node on the map to set the destination."
    : !routes && !loading
    ? "Click \"Get route\" below."
    : null;

  const selected = routes?.[selectedVariant];

  return (
    <div className={t.panel}>
      <div className={t.title}>Point-to-point route</div>

      {step && <div className={t.stepText}>{step}</div>}

      {loading && <div className={t.loadingText}>Computing route…</div>}

      {error && (
        <div className={t.errorText}>
          Couldn&apos;t find a route: {error}
        </div>
      )}

      {routes && !loading && !error && (
        <>
          <div className={t.variantRow}>
            {["shortest", "fastest"].map((variant) => {
              const r = routes[variant];
              const isSelected = variant === selectedVariant;
              return (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  className={t.variantButton}
                  style={{
                    borderColor: isSelected ? t.colors.primary : "#d1d5db",
                    background: isSelected ? "#fff7ed" : "white",
                  }}
                >
                  <div className={t.variantButtonHeader}>
                    <span
                      className={t.variantDot}
                      style={{ background: isSelected ? t.colors.primary : t.colors.secondary }}
                    />
                    {VARIANT_LABELS[variant]}
                  </div>
                  <div className={t.variantSubtext}>
                    {r.feature.properties.length.toFixed(1)} mi &middot; {formatDuration(r.feature.properties.duration_s)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className={t.statsList}>
            <div className={t.statRow}>
              <span className={t.statLabel}>Distance</span>
              <span className={t.statValue}>{selected.feature.properties.length.toFixed(1)} mi</span>
            </div>
            <div className={t.statRow}>
              <span className={t.statLabel}>Est. time</span>
              <span className={t.statValue}>{formatDuration(selected.feature.properties.duration_s)}</span>
            </div>
            <div className={t.statRow}>
              <span className={t.statLabel}>Path edges</span>
              <span className={t.statValue}>{selected.feature.properties.edge_count.toLocaleString()}</span>
            </div>
            <div className={t.statRow}>
              <span className={t.statLabel}>Turn restrictions considered</span>
              <span className={t.statValue}>{selected.feature.properties.restrictions_considered.toLocaleString()}</span>
            </div>
          </div>

          {selected.segments?.length > 0 && (
            <div className={t.segmentsWrapper}>
              <div className={t.segmentsHeader}>
                Segments ({selected.segments.length})
              </div>
              <div className={t.segmentsList}>
                {selected.segments.map((seg, i) => (
                  <div key={seg.edge_id} className={t.segmentRow}>
                    <span className={t.segmentLabel}>
                      {i + 1}. {seg.highway || "unknown"}
                    </span>
                    <span className={t.segmentValue}>{Math.round(seg.length_m)} m</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {Button && canGetRoute && !loading && (
        <Button className={t.getRouteButton} onClick={onGetRoute}>
          Get route
        </Button>
      )}

      {Button && (hasSource || hasDestination) && (
        <Button className={t.clearButton} onClick={onReset}>
          Clear points
        </Button>
      )}
    </div>
  );
};

export { RouteDetailsPanel };
