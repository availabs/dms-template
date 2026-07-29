import React, { useMemo } from "react";
import { ThemeContext } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { CREATION_MODES } from "../constants";

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
  setModalOpen,
  creationMode,
  setCreationMode,
  markerCount,
  removeLastMarker,
  clearAllMarkers,
  isEditingRoute,
}) => {
  const { UI } = React.useContext(ThemeContext) || {};
  const { Button } = UI;
  const isMarkerMode = creationMode === CREATION_MODES.MARKERS;
  const tmcRows = useMemo(() => {
    if (tmc_array?.length > 0) {
      return tmc_array.map((tmc) => {
        const tData = tmcData.find((td) => td.tmc === tmc) || {
          tmc,
          miles: 0,
          intersection: "",
        };
        return (
          <div
            key={`tmc_${tData.tmc}`}
            className="border-b hover:bg-gray-200 px-1 "
          >
            <div className="flex items-center">
              <div className="font-bold text-sm flex-1">{tData.tmc}</div>
              <div className="text-xs">{tData.miles.toFixed(3)} miles</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs">{tData.intersection}</div>
              <div
                className="text-xs text-red-500 cursor-pointer hover:bg-gray-300 rounded p-1"
                onClick={() => removeTmc(tData.tmc)}
              >
                Remove
              </div>
            </div>
          </div>
        );
      });
    } else {
      return null;
    }
  }, [tmcData, tmc_array, removeTmc]);

  const totalMiles = tmcData.reduce((acc, curr) => acc + curr.miles, 0);

  return (
    <div
      className="flex flex-col gap-2 p-1 pointer-events-auto drop-shadow-lg p-4 bg-white/90 overflow-hidden"
      style={{
        position: "absolute",
        top: "25px",
        // transportNY's original offset (-168px) assumes a narrower map container
        // with room to spill into on the right - dms-template's Map section container
        // is wider, so that value clips the panel off-screen. Flush right instead.
        right: "8px",
        color: "black",
        width: "318px",
        // 350px looked reasonable empty, but everything ABOVE the list (mode
        // toggle, count/Remove-Last/Clear-All row, TMC Search, list header) eats
        // ~250px of that on its own, leaving the list itself only ~1 row of real
        // space before scrolling - raised so the list gets a usable viewport
        // (~5-6 rows) instead of just technically not spilling into the map.
        maxHeight: "520px",
      }}
    >
      <div className="flex gap-1 shrink-0">
        <Button
          themeOptions={{ color: isMarkerMode ? "transparent" : "primary" }}
          onClick={() => setCreationMode(CREATION_MODES.TMC_CLICKS)}
          style={{ flex: 1 }}
        >
          TMC Click
        </Button>
        <Button
          themeOptions={{ color: isMarkerMode ? "primary" : "transparent" }}
          onClick={() => setCreationMode(CREATION_MODES.MARKERS)}
          style={{ flex: 1 }}
        >
          Markers
        </Button>
      </div>
      {/* Same "count + Remove Last/Clear All" row in both modes (only the count label
          and the handlers underneath differ) so toggling modes doesn't jump the panel's
          layout - TMC Click mode just adds the search box below this shared row. */}
      <div className="flex items-center justify-between shrink-0">
        <div className="text-sm font-bold">
          {isMarkerMode ? `Markers: ${markerCount}` : `TMCs: ${tmc_array?.length || 0}`}
        </div>
        <div className="flex gap-2">
          <div
            className="text-xs cursor-pointer hover:bg-gray-300 rounded p-1"
            onClick={isMarkerMode ? removeLastMarker : removeLastTmc}
          >
            Remove Last
          </div>
          <div
            className="text-xs text-red-500 cursor-pointer hover:bg-gray-300 rounded p-1"
            onClick={isMarkerMode ? clearAllMarkers : clearAllTmc}
          >
            Clear All
          </div>
        </div>
      </div>
      {!isMarkerMode && (
        <div className="shrink-0">
          <div className="font-bold">TMC Search</div>
          <div className="flex w-full gap-1">
            <label className="flex flex-1">
              <input
                className="w-full p-2 bg-white/40 rounded"
                value={searchInputTmc}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTmcFromSearch();
                }}
              />
            </label>
            <Button
              themeOptions={{ color: "primary" }}
              disabled={searchInputTmc?.length !== 9 || !searchTmcValid}
              onClick={addTmcFromSearch}
            >
              {tmc_array?.includes(searchInputTmc) ? "Remove" : "Add"}
            </Button>
          </div>
          {searchInputTmc?.length === 9 && !searchTmcValid && (
            <div className="text-xs text-red-500">TMC not found</div>
          )}
        </div>
      )}
      <div className="border-b-2 border-current mb-1 flex items-center shrink-0">
        <div className="font-bold text-lg flex-1">TMC List</div>
        <div className="text-sm">Total Miles: {totalMiles.toFixed(3)}</div>
      </div>
      <div className="overflow-auto scrollbar-sm flex-1 min-h-0">
        {tmcRows}
      </div>
      {tmc_array?.length > 0 && (
        <div className="mb-1 flex items-center shrink-0">
          <Button
            themeOptions={{ color: "transparent" }}
            onClick={() => setModalOpen(true)}
            style={{ width: "100%", marginTop: "10px" }}
          >
            {isEditingRoute ? "Update Route" : "Save Route"}
          </Button>
        </div>
      )}
    </div>
  );
};
