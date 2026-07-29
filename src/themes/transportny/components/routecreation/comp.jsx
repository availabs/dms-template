import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { get, set } from "lodash-es";
import mapboxgl from "maplibre-gl";

import { CMSContext } from "../../../../dms/packages/dms/src";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { fetchBoundsForFilter } from "../../../../dms/packages/dms/src/patterns/mapeditor/MapEditor/stateUtils";
import { nameToSlug } from "../../../../dms/packages/dms/src/utils/type-utils";
import { convertToUrlParams } from "../../../../dms/packages/dms/src/patterns/page/pages/_utils";

import {
  srcAttr,
  SHAPEFILE_LAYER_KEY,
  INTERNAL_ROUTES_VIEW_ID,
  INTERNAL_ROUTES_TYPE,
  PAGE_FILTER_KEY,
  INTERNAL_ROUTES_SOURCE_ID,
  CREATION_MODES,
  DEFAULT_CREATION_MODE,
  DEFAULT_ROUTING_YEAR,
} from "./constants";
import { useMapTmcHandler } from "./hooks/useMapTmcHandler";
import { useMapMarkerHandler } from "./hooks/useMapMarkerHandler";
import { useRouteData } from "./hooks/useRouteData";
import { RouteEditor } from "./components/RouteEditor";
import { SaveRouteModal } from "./components/SaveRouteModal";

const INITIAL_MODAL_STATE = {
  open: false,
  name: "",
  description: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  id: null,
};

const Comp = ({ state, setState, map }) => {
  const navigate = useNavigate();
  const [routesSource, setRoutesSource] = useState({});
  const [modalState, setModalState] = useState(INITIAL_MODAL_STATE);
  const mctx = React.useContext(MapEditorContext);
  const cctx = React.useContext(CMSContext);
  const pContext = React.useContext(PageContext) || {};
  const { apiUpdate, pageState: { app, filters: pageFilters } } = pContext;
  const ctx = mctx?.falcor ? mctx : cctx;
  const { falcor, pgEnv } = ctx;

  const INTERNAL_DATASETS_KEY = `${app}+datasets`;

  const { pluginDataPath, symbologyLayerPath, symbPath, pathBase } = useMemo(() => {
    if (state.symbologies) {
      const symbName = Object.keys(state.symbologies)[0];
      const pBase = `symbologies['${symbName}']`;
      return {
        pathBase: pBase,
        pluginDataPath: `${pBase}.symbology.pluginData.routecreation`,
        symbologyLayerPath: `${pBase}.symbology.layers`,
        symbPath: `${pBase}.symbology`,
      };
    }
    return {
      pathBase: "",
      pluginDataPath: `symbology.pluginData.routecreation`,
      symbologyLayerPath: `symbology.layers`,
      symbPath: `symbology`,
    };
  }, [state.symbologies]);

  const { tmc_array, view_id, searchInputTmc } = useMemo(() => {
    const shapefileLayerId = get(state, `${pluginDataPath}['active-layers'][${SHAPEFILE_LAYER_KEY}]`);
    return {
      tmc_array: get(state, `${pluginDataPath}['tmc_array']`, []),
      view_id: get(state, `${symbologyLayerPath}['${shapefileLayerId}']['view_id']`, null),
      searchInputTmc: get(state, `${pluginDataPath}['search_input_tmc']`, "")
    };
  }, [pluginDataPath, symbologyLayerPath, state]);
  const { tmcData } = useRouteData(state, pluginDataPath, view_id, tmc_array, pgEnv);

  const [creationMode, setCreationModeState] = useState(DEFAULT_CREATION_MODE);
  const isMarkerMode = creationMode === CREATION_MODES.MARKERS;

  const { markerCount, removeLastMarker, clearAllMarkers } = useMapMarkerHandler(
    map, setState, pluginDataPath, isMarkerMode, DEFAULT_ROUTING_YEAR
  );
  const { toggleTmc, removeLastTmc, clearAllTmc } = useMapTmcHandler(
    map, state, setState, pluginDataPath, symbPath, !isMarkerMode
  );

  // Tracks whether the currently-typed 9-char searchInputTmc resolved to a real
  // geometry (see the searchInputTmc effect below) - gates the search box's "Add"
  // action so typos/nonexistent TMCs can't be added the way a map click never could.
  const [searchTmcValid, setSearchTmcValid] = useState(false);

  const setCreationMode = useCallback((mode) => {
    if (mode === creationMode) return;
    // Switching modes clears both in-progress selections, matching the old tool's
    // setCreationMode (RouteCreationLayer.jsx:63-87) - no stale bleed-over between modes.
    // (State updater functions must stay pure - side effects belong here, in the event
    // handler, not nested inside setCreationModeState's callback.)
    clearAllMarkers();
    setState((draft) => set(draft, `${pluginDataPath}['tmc_array']`, []));
    setCreationModeState(mode);
  }, [creationMode, clearAllMarkers, setState, pluginDataPath]);

  const removeTmc = useCallback((tmc) => {
    setState((draft) => {
      const currentTmcArray = get(draft, `${pluginDataPath}['tmc_array']`, []);
      set(draft, `${pluginDataPath}['tmc_array']`, currentTmcArray.filter((d) => d !== tmc));
    });
  }, [pluginDataPath, setState]);

  const setGeoBounds = async (filter) => {
    const newExtent = await fetchBoundsForFilter(
      get(state, pathBase, state),
      falcor,
      pgEnv,
      filter
    );
    const parsedExtent = typeof newExtent === "string" ? JSON.parse(newExtent) : newExtent;
    const coordinates = parsedExtent?.coordinates[0];
    if (coordinates) {
      const mapGeom = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );
      setState((draft) => {
        set(draft, `${symbPath}.zoomToFilterBounds`, [mapGeom["_sw"], mapGeom["_ne"]]);
      });
    }
    return Boolean(coordinates);
  };

  useEffect(() => {
    let cancelled = false;
    if (searchInputTmc?.length === 9) {
      setGeoBounds([{ display_name: "tmc", column_name: "tmc", values: [searchInputTmc], zoomToFilterBounds: true }])
        .then((found) => {
          if (!cancelled) setSearchTmcValid(found);
        });
    } else {
      setSearchTmcValid(false);
      setState((draft) => set(draft, `${symbPath}.zoomToFilterBounds`, []));
    }
    return () => { cancelled = true; };
  }, [searchInputTmc]);

  const addTmcFromSearch = useCallback(() => {
    if (searchInputTmc?.length !== 9 || !searchTmcValid) return;
    toggleTmc(searchInputTmc);
    setState((draft) => set(draft, `${pluginDataPath}['search_input_tmc']`, ""));
  }, [searchInputTmc, searchTmcValid, toggleTmc, setState, pluginDataPath]);

  const addItem = async () => {
    const { open, startDate, startTime, endDate, endTime, ...rest } = modalState;
    const sourceType = routesSource.type || (routesSource.name ? nameToSlug(routesSource.name) : undefined);

    const now = new Date();
    const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')} ${now.toString().match(/([+-]\d{4})/)?.[1] || "+0000"}`;

    const payload = {
      ...rest,
      metadata: JSON.stringify({
        ...(startDate && endDate ? { dates: [`${startDate}T${startTime || "00:00:00"}`, `${endDate}T${endTime || "23:59:59"}`] } : {})
      }),
      tmc_array: JSON.stringify(tmc_array || []),
      updated_at: formattedTimestamp,
      ...(!modalState.id && { created_at: formattedTimestamp }),
    };

    const res = await apiUpdate({
      data: payload,
      config: { format: { ...routesSource, type: `${sourceType}|${INTERNAL_ROUTES_VIEW_ID}:data` } },
    });
    if (res) {
      const routeFilter = { ...pageFilters.find(({ searchKey }) => searchKey === PAGE_FILTER_KEY) };
      routeFilter.values = [res.id];
      const url = `?${convertToUrlParams({ [routeFilter.searchKey]: [res.id] })}`;
      setModalState((prev) => ({ ...prev, open: false }))
      navigate(url);
    } else {
      setModalState((prev) => ({ ...prev, open: false }))
    }
  };

  useEffect(() => {
    const sourcePath = ["uda", INTERNAL_DATASETS_KEY, "sources", "byId", [INTERNAL_ROUTES_SOURCE_ID], srcAttr];
    falcor.get(sourcePath).then((r) => {
      const valueGetter = (attr) => get(r, ["json", "uda", INTERNAL_DATASETS_KEY, "sources", "byId", INTERNAL_ROUTES_SOURCE_ID, attr]);
      const appName = valueGetter("app");
      const name = valueGetter("name");
      const routeSource = {
        ...srcAttr.reduce((acc, attr) => ({ ...acc, [attr]: valueGetter(attr) }), {}),
        env: name ? `${appName}+${nameToSlug(name)}` : INTERNAL_DATASETS_KEY,
        isDms: true,
      };
      setRoutesSource(routeSource);
    });
  }, []);

  const routeIdFilterValue = useMemo(() => {
    return pageFilters?.find((pFilter) => pFilter.searchKey === PAGE_FILTER_KEY)?.values?.[0];
  }, [pageFilters]);

  useEffect(() => {
    if (routeIdFilterValue) {
      const NAME_COL = "data->>'name' as name";
      const DESC_COL = "data->>'description' as description";
      const TMC_COL = "data->>'tmc_array' as tmc_array";
      const METADATA_COL = "data->>'metadata' as metadata";
      const loadRouteDataPath = [
        "uda",
        `${app}+${INTERNAL_ROUTES_TYPE}`,
        "viewsById",
        INTERNAL_ROUTES_VIEW_ID,
        "dataById",
        [routeIdFilterValue],
        [NAME_COL, DESC_COL, TMC_COL, METADATA_COL],
      ];

      falcor.get(loadRouteDataPath).then((res) => {
        const curRouteFromApi = get(res, ["json", ...loadRouteDataPath.slice(0, -1)]);
        if (!curRouteFromApi) return;
        const curRouteTmcArray = JSON.parse(curRouteFromApi[TMC_COL]);
        const curRouteMetadata = JSON.parse(curRouteFromApi[METADATA_COL]);

        let startDate = "", endDate = "", startTime = "", endTime = "";
        if (curRouteMetadata?.dates?.length >= 2) {
          const start = new Date(curRouteMetadata.dates[0]);
          const end = new Date(curRouteMetadata.dates[1]);
          if (!isNaN(start)) {
            startDate = start.toISOString().split('T')[0];
            startTime = start.toTimeString().split(':').slice(0, 2).join(':');
          }
          if (!isNaN(end)) {
            endDate = end.toISOString().split('T')[0];
            endTime = end.toTimeString().split(':').slice(0, 2).join(':');
          }
        }

        setState((draft) => set(draft, `${pluginDataPath}['tmc_array']`, curRouteTmcArray));
        setModalState((prev) => ({
          ...prev,
          name: curRouteFromApi[NAME_COL],
          description: curRouteFromApi[DESC_COL],
          id: routeIdFilterValue,
          startDate,
          endDate,
          startTime,
          endTime,
        }));
        const geographyFilter = [{ display_name: "tmc", column_name: "tmc", values: curRouteTmcArray, zoomToFilterBounds: true }];
        setGeoBounds(geographyFilter);
      });
    }
  }, [routeIdFilterValue]);

  return (
    <>
      <RouteEditor
        tmc_array={tmc_array}
        tmcData={tmcData}
        searchInputTmc={searchInputTmc}
        setSearchInput={(val) => setState((draft) => set(draft, `${pluginDataPath}['search_input_tmc']`, val))}
        searchTmcValid={searchTmcValid}
        addTmcFromSearch={addTmcFromSearch}
        removeTmc={removeTmc}
        removeLastTmc={removeLastTmc}
        clearAllTmc={clearAllTmc}
        setModalOpen={(val) => setModalState((prev) => ({ ...prev, open: val }))}
        creationMode={creationMode}
        setCreationMode={setCreationMode}
        markerCount={markerCount}
        removeLastMarker={removeLastMarker}
        clearAllMarkers={clearAllMarkers}
        isEditingRoute={Boolean(routeIdFilterValue)}
      />
      <SaveRouteModal
        isEditingRoute={Boolean(routeIdFilterValue)}
        modalStyle={{
          display: modalState.open ? "block" : "none",
          position: "fixed",
          top: "10%",
          left: "25vw",
          width: "50vw",
          height: "60vh",
          padding: "20px",
          borderRadius: "5px",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
          zIndex: 1001,
          opacity: ".9",
        }}
        setModalOpen={(val) => setModalState((prev) => ({ ...prev, open: val }))}
        modalState={modalState}
        setRouteMeta={(meta) => setModalState({ ...modalState, ...meta })}
        addItem={addItem}
      />
    </>
  );
};

export { Comp };
