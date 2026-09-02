import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { damaMapTheme } from "../../../../../dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/map.theme";
import { routecreationTheme } from "../routecreation.theme";

// Panel 1 · THE ROUTE (top-left), from npmrds-route-creation.html
// (routes-reports-users-mesh.md, Workstream E). The port previously showed a route's name only
// inside the save modal, so someone who arrived on ?route_id=... couldn't see what they were
// editing - this panel reads state comp.jsx already resolves (modalState, tmc_array, tmcData,
// the routeIdFilterValue-derived "editing" flag) and adds no new data fetch of its own. Themed
// via the same damaMap.layerLibrary panel shell + routecreation.theme.js RouteEditor uses.
export const RouteIdentityPanel = ({
  name,
  tags,
  tmcCount,
  totalMiles,
  routeId,
  isEditingRoute,
  networkYear,
}) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...routecreationTheme, ...getComponentTheme(themeFromContext, "routecreation") };
  const mapT = {
    ...damaMapTheme.layerLibrary,
    ...getComponentTheme(themeFromContext, "damaMap.layerLibrary"),
  };
  const displayName = name || (isEditingRoute ? `Route ${routeId}` : "New route (unsaved)");

  return (
    <div className={`${t.posTopLeft} ${mapT.panel}`}>
      <div className={mapT.panelInner}>
        <div className={mapT.header}>
          <svg className="size-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 20 8 4m12 16L16 4M12 5v2m0 4v2m0 4v2" />
          </svg>
          <span className={mapT.headerTitle}>Route</span>
          {isEditingRoute && <span className={t.identityEditingBadge}>editing</span>}
        </div>
        <div className={`${mapT.body} ${t.identityBody}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={t.identityDot} />
              <span className={t.identityName} title={displayName}>{displayName}</span>
            </div>
            <div className={t.identityMeta}>
              {tmcCount} tmc · {totalMiles.toFixed(2)} mi{isEditingRoute ? ` · route ${routeId}` : ""}
            </div>
          </div>
          {tags?.length > 0 && (
            <div className={t.tagRow}>
              {tags.map((tag) => (
                <span key={tag} className={t.tag}>{tag}</span>
              ))}
            </div>
          )}
          {/* Network vintage - a static chip, not a select. Phase 3 (routecreation-marker-
              placement-autorouting.md) is blocked on re-verifying which years the routing
              service actually matches - a live test found only 2020-2022 resolving. */}
          <div className={t.vintageBlock}>
            <div className={t.vintageLabel}>Network vintage</div>
            <div className={t.vintageChip}>
              <span className={t.vintageYear}>{networkYear}</span>
              <span
                className={t.vintagePinned}
                title="A year selector is Phase 3 and is blocked on re-verifying which years the routing service can actually match - only 2020-2022 resolved in a direct test."
              >
                pinned
              </span>
            </div>
          </div>
          <a href="/converted_reports#routes" className={t.backLink}>
            <svg className={t.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
            All routes
          </a>
        </div>
      </div>
    </div>
  );
};
