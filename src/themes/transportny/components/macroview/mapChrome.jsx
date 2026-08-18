import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../dms/packages/dms/src/ui/useTheme";
import { macroviewTheme } from "./macroview.theme";

// ── PANELS 3 + 4 · the bottom band ─────────────────────────────────────────────
// FRESHNESS strip + the DOWNLOAD DOCK PILL, one bottom-LEFT bar, collapsed at rest —
// the canvas is the point of this page, so the builder only opens on demand.
//
// The mockup drew the pill in the bottom-RIGHT corner. It cannot live there: that corner
// is core's map-actions column (layers / zoom / compass, `avl-map.jsx`), and its basemap
// menu opens UPWARD 240px × 144px into exactly the space a bottom-right pill occupies —
// measured overlapping the pill by 72 × 12px even BEFORE the full-width-overlay change
// (scratchpad/npmrdsv5-dev2/macroview_pass2/before_1600_basemap.png). Since
// `fullWidthOverlay` now lets the plugin's panels reach the map edge, the pill would land
// on top of the controls themselves. It therefore joins the freshness strip in one bar:
// both state facts about the data behind the map (what's loaded → export it).
// NEEDS BACKPORT into npmrds-macro.html § the map chrome (logged in the task doc).
//
// The mockup also drew a Light/Dark/Satellite basemap segment and zoom / full-screen
// buttons here. They are NOT built, and the mockup was backported (2026-08-12) rather
// than shipping dead controls:
//   · AvlMap already renders its own basemap picker + zoom + compass in the map's own
//     navigation controls, so a second set would be duplicate chrome.
//   · A plugin cannot drive the basemap anyway: `styleIndex` is read once at mount
//     (ui/components/map/avl-map.jsx — deliberately kept out of the effect's deps so a
//     basemap change doesn't tear the map down), and live switching goes through
//     `MapActions.setMapStyle`, which is not handed to plugin components.
// The freshness dates are the VIEW's own `metadata.dates`, not a hard-coded range.

export const MapChrome = ({ freshFrom, freshTo, yearLabel, rowCount, fmtCount, onOpenDownload }) => {
  const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const { Icon } = UI || {};
  const t = { ...macroviewTheme, ...getComponentTheme(themeFromContext, "macroview") };

  return (
    <>
      <div className={`${t.posBottomLeft} ${t.chromeBar}`}>
        <div className={t.freshness}>
          <span className={t.freshnessLive}>
            <span className={t.freshnessDot} />
            NPMRDS
          </span>
          {freshFrom && freshTo ? (
            <>
              <span className={t.freshnessSep}>·</span>
              <span>
                {freshFrom} &rarr; {freshTo}
              </span>
            </>
          ) : null}
          <span className={t.freshnessSep}>·</span>
          <span>
            PM3 year <span className={t.freshnessNum}>{yearLabel || "—"}</span>
          </span>
        </div>
        <button type="button" className={t.dockPill} onClick={onOpenDownload}>
          <Icon icon="Download" className={t.dockPillIcon} />
          Download{" "}
          <span className={t.dockPillCount}>{rowCount != null ? fmtCount(rowCount) : "—"}</span> rows
        </button>
      </div>
    </>
  );
};
