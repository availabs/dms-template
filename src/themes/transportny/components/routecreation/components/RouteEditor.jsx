import React, { useMemo } from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { damaMapTheme } from "../../../../../dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/map.theme";
import { routecreationTheme } from "../routecreation.theme";
import { CREATION_MODES } from "../constants";

// Panel 2 · ROUTE EDITOR, from npmrds-route-creation.html (routes-reports-users-mesh.md,
// Workstream E). Themed onto `routecreation.theme.js` + the Map component's own
// `damaMap.layerLibrary` panel shell (header/title/count badge), same composition
// `macroview.theme.js`'s panels already use — see that file's own header comment. Position/
// width stay the component's own bespoke values (`editorWrapper`), not the shared panel's `p-4`
// positioning wrapper — the mockup's own note confirms these were checked against it and kept.
export const RouteEditor = ({
  tmc_array,
  tmcData,
  searchInputTmc,
  setSearchInput,
  searchTmcValid,
  addTmcFromSearch,
  removeTmc,
  removeLastTmc,
  clearAllTmc,
  hoveredTmc,
  setHoveredTmc,
  setModalOpen,
  creationMode,
  setCreationMode,
  markerCount,
  removeLastMarker,
  clearAllMarkers,
  isEditingRoute,
  totalMiles,
}) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...routecreationTheme, ...getComponentTheme(themeFromContext, "routecreation") };
  const mapT = {
    ...damaMapTheme.layerLibrary,
    ...getComponentTheme(themeFromContext, "damaMap.layerLibrary"),
  };
  const isMarkerMode = creationMode === CREATION_MODES.MARKERS;

  // Row <-> map two-way highlight (routes-reports-users-mesh.md, Workstream E): hovering a row
  // lights its segment (via setHoveredTmc, read back by dataUpdate.jsx's paint expression);
  // hovering a segment on the map lights its row (hoveredTmc, set by useMapHoverHandler).
  const tmcRows = useMemo(() => {
    if (!(tmc_array?.length > 0)) return null;
    return tmc_array.map((tmc) => {
      const tData = tmcData.find((td) => td.tmc === tmc) || {
        tmc,
        miles: 0,
        intersection: "",
      };
      const isHighlighted = hoveredTmc === tData.tmc;
      return (
        <div
          key={`tmc_${tData.tmc}`}
          className={isHighlighted ? t.rowHighlighted : t.row}
          onMouseEnter={() => setHoveredTmc?.(tData.tmc)}
          onMouseLeave={() => setHoveredTmc?.(null)}
        >
          <div className={t.rowTop}>
            <div className={t.rowTmc}>{tData.tmc}</div>
            <div className={t.rowMiles}>{tData.miles.toFixed(3)} mi</div>
          </div>
          <div className={t.rowBottom}>
            <div className={t.rowIntersection} title={tData.intersection}>{tData.intersection}</div>
            <div className={t.rowRemove} onClick={() => removeTmc(tData.tmc)}>
              Remove
            </div>
          </div>
        </div>
      );
    });
  }, [tmcData, tmc_array, removeTmc, hoveredTmc, setHoveredTmc, t]);

  return (
    <div className={t.editorWrapper}>
      <div className={mapT.header}>
        <svg className="size-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16.86 4.49a2.12 2.12 0 1 1 3 3L8.5 18.85 4 20l1.15-4.5L16.86 4.49Z" />
        </svg>
        <span className={mapT.headerTitle}>Route editor</span>
        <span className={mapT.headerCount}>{isMarkerMode ? markerCount : (tmc_array?.length || 0)}</span>
      </div>
      <div className={t.editorBody}>
        <div className={t.segment2}>
          <button
            className={`${t.segmentBtnFirst} ${isMarkerMode ? t.segmentInactive : t.segmentActive}`}
            onClick={() => setCreationMode(CREATION_MODES.TMC_CLICKS)}
          >
            TMC Click
          </button>
          <button
            className={`${t.segmentBtn} ${isMarkerMode ? t.segmentActive : t.segmentInactive}`}
            onClick={() => setCreationMode(CREATION_MODES.MARKERS)}
          >
            Markers
          </button>
        </div>
        {/* Same "count + Remove Last/Clear All" row in both modes (only the count label
            and the handlers underneath differ) so toggling modes doesn't jump the panel's
            layout - TMC Click mode just adds the search box below this shared row. */}
        <div className={t.countRow}>
          <div className={t.countLabel}>
            {isMarkerMode ? `Markers: ${markerCount}` : `TMCs: ${tmc_array?.length || 0}`}
          </div>
          <div className={t.countActions}>
            <div className={t.countActionBtn} onClick={isMarkerMode ? removeLastMarker : removeLastTmc}>
              Remove last
            </div>
            <div className={t.countActionBtnDestructive} onClick={isMarkerMode ? clearAllMarkers : clearAllTmc}>
              Clear all
            </div>
          </div>
        </div>
        {!isMarkerMode && (
          <div className={t.searchBlock}>
            <div className={t.searchLabel}>TMC search</div>
            <div className={t.searchRow}>
              <input
                className={t.searchInput}
                value={searchInputTmc}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTmcFromSearch();
                }}
              />
              <button
                className={t.searchBtn}
                disabled={searchInputTmc?.length !== 9 || !searchTmcValid}
                onClick={addTmcFromSearch}
              >
                {tmc_array?.includes(searchInputTmc) ? "Remove" : "Add"}
              </button>
            </div>
            {searchInputTmc?.length === 9 && !searchTmcValid && (
              <div className={t.searchError}>TMC not found</div>
            )}
          </div>
        )}
        <div className={t.listHeader}>
          <span className={t.listHeaderLabel}>TMC list</span>
          <span className={t.listHeaderTotal}>{totalMiles.toFixed(3)} mi total</span>
        </div>
        <div className={t.list}>{tmcRows}</div>
      </div>
      {tmc_array?.length > 0 && (
        <div className={t.footer}>
          <button className={t.saveBtn} onClick={() => setModalOpen(true)}>
            {isEditingRoute ? "Update route" : "Save route"}
          </button>
        </div>
      )}
    </div>
  );
};
