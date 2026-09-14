import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { detourDetailsPanelTheme } from "./DetourDetailsPanel.theme";

const formatDuration = (seconds) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
};
const fmtSigned = (n, digits) => (n >= 0 ? "+" : "") + n.toFixed(digits);

const VARIANT_LABELS = { shortest: "Shortest", fastest: "Fastest" };

// One direction's open (baseline, no exclusion) vs closed (detour, segment excluded) comparison,
// stacked - keep this layout; a prior simplification attempt regressed it and was reverted.
const ImpactBlock = ({ t, label, color, dashed, openRoute, closedRoute }) => {
  const swatchStyle = dashed
    ? { background: "none", borderTop: `2px dashed ${color}`, height: 0 }
    : { background: color };

  if (!closedRoute) {
    return (
      <div className={t.impactNoRouteBlock}>
        <div className={t.impactNoRouteHeader}>
          <span className={t.impactSwatch} style={swatchStyle} />
          {label}
        </div>
        No route this direction
      </div>
    );
  }

  const closed = closedRoute.feature.properties;
  const open = openRoute?.feature?.properties;

  return (
    <div className={t.impactBlock}>
      <div className={t.impactBlockHeader}>
        <span className={t.impactSwatch} style={swatchStyle} />
        {label}
      </div>

      {open ? (
        <>
          <div className={t.impactStatRow}>
            <span className={t.impactStatLabel}>Open</span>
            <span className={t.impactStatValue}>{open.length.toFixed(1)} mi &middot; {formatDuration(open.duration_s)} &middot; {open.edge_count} edges</span>
          </div>
          <div className={t.impactStatRow}>
            <span className={t.impactStatLabel}>Closed</span>
            <span className={t.impactStatValue}>{closed.length.toFixed(1)} mi &middot; {formatDuration(closed.duration_s)} &middot; {closed.edge_count} edges</span>
          </div>
          <div className={t.impactDeltaRow} style={{ color: closed.length > open.length ? "#b45309" : "#374151" }}>
            <span>Δ</span>
            <span className={t.impactStatValue}>
              {fmtSigned(closed.length - open.length, 1)} mi &middot; {fmtSigned((closed.duration_s - open.duration_s) / 60, 0)} min
              {open.length > 0 && ` (${fmtSigned(((closed.length - open.length) / open.length) * 100, 0)}%)`}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className={t.impactClosedOnlyText}>Closed: {closed.length.toFixed(1)} mi &middot; {formatDuration(closed.duration_s)} &middot; {closed.edge_count} edges</div>
          <div className={t.impactUnavailableText}>Open (baseline) route unavailable for comparison</div>
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
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Button } = UI || {};
  const t = { ...detourDetailsPanelTheme, ...getComponentTheme(themeFromContext, "detourDetailsPanel") };

  const hasResult = Boolean(routes) || Boolean(error);
  const AtoB = routes?.AtoB?.[selectedVariant];
  const BtoA = routes?.BtoA?.[selectedVariant];
  const openAtoB = baselineRoutes?.AtoB?.[selectedVariant];
  const openBtoA = baselineRoutes?.BtoA?.[selectedVariant];
  // Whichever direction is rendered bold on the map (primary) - see comp.jsx: AtoB if it exists,
  // otherwise BtoA. Used only to pick which one's segment list to show below.
  const primary = AtoB ? { label: "Start → End", route: AtoB } : { label: "End → Start", route: BtoA };

  // start/end normally continue the SAME road as the closed segment (see findSameRoadNode.js) -
  // if either point had to fall back to a plain nearest-node search, that means this endpoint is
  // genuinely disconnected from any continuing road (a dead-end/isolated case), worth surfacing
  // rather than presenting it as an ordinary pick.
  const anyFallback = startEnd?.start?.usedFallback || startEnd?.end?.usedFallback;

  // Some segments (a long highway with no nearby cross-road) genuinely have no real intersection
  // within a reasonable distance - the endpoint picker gives up after 10mi rather than walking
  // forever, and flags it here so that's visible instead of looking like an ordinary pick.
  const anyDistanceCap = startEnd?.start?.hitDistanceCap || startEnd?.end?.hitDistanceCap;

  const asymmetric = routes?.AtoB && routes?.BtoA &&
    routes.AtoB.shortest.feature.properties.edge_count !== routes.BtoA.shortest.feature.properties.edge_count;

  return (
    <div className={t.panel}>
      <div className={t.title}>Segment closure impact</div>

      {!selectedSegment && !loading && (
        <div className={t.instructionText}>
          Click a road segment on the map to see what trips through it would have to do if it were closed.
        </div>
      )}

      {selectedSegment && !hasResult && !resolveError && (
        <div className={t.selectedBanner}>
          <span className={t.selectedBannerText}>
            Segment {selectedSegment.ogcFid} selected. {canGetDetour ? "Click \"Get detour\" below." : "Finding nearby start/end points…"}
          </span>
        </div>
      )}

      {selectedSegment && resolveError && (
        <div className={t.selectedBanner}>
          <span className={t.selectedBannerText}>{resolveError}</span>
        </div>
      )}

      {selectedSegment && anyDistanceCap && (
        <div className={t.warningBanner}>
          One end of this segment had no real intersection within 10 miles (common for a long
          highway stretch) - using the farthest point reached instead.
        </div>
      )}

      {selectedSegment && anyFallback && (
        <div className={t.warningBanner}>
          One end of this segment has no continuing road nearby (a dead end or disconnected point) -
          using the nearest node instead.
        </div>
      )}

      {loading && <div className={t.loadingText}>Computing detour (both directions)…</div>}

      {error && (
        <div className={t.errorText}>
          No detour possible for this segment in either direction: {error}
        </div>
      )}

      {routes && !loading && !error && (
        <>
          {asymmetric && (
            <div className={t.warningBanner}>
              The two directions take different routes around this closure.
            </div>
          )}

          <div className={t.variantRow}>
            {["shortest", "fastest"].map((variant) => {
              const isSelected = variant === selectedVariant;
              return (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  className={t.variantButton}
                  style={{ borderColor: isSelected ? t.colors.primary : "#d1d5db", background: isSelected ? "#fff7ed" : "white" }}
                >
                  <div className={t.variantButtonLabel}>{VARIANT_LABELS[variant]}</div>
                </button>
              );
            })}
          </div>

          <ImpactBlock t={t} label="Start → End" color={t.colors.primary} openRoute={openAtoB} closedRoute={AtoB} />
          <ImpactBlock t={t} label="End → Start" color={t.colors.secondary} dashed openRoute={openBtoA} closedRoute={BtoA} />

          {primary.route?.segments?.length > 0 && (
            <div className={t.segmentsWrapper}>
              <div className={t.segmentsHeader}>
                {primary.label} segments ({primary.route.segments.length})
              </div>
              <div className={t.segmentsList}>
                {primary.route.segments.map((seg, i) => (
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

      {Button && canGetDetour && !loading && (
        <Button className={t.getDetourButton} onClick={onGetDetour}>
          Get detour
        </Button>
      )}

      {Button && (selectedSegment || hasResult) && (
        <Button className={t.clearButton} onClick={onReset}>
          {hasResult ? "Clear detour" : "Clear selection"}
        </Button>
      )}
    </div>
  );
};

export { DetourDetailsPanel };
