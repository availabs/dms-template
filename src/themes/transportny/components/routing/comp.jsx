import React from "react";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { CMSContext } from "../../../../dms/packages/dms/src";

import { usePointPicker } from "./hooks/usePointPicker";
import { useTrspRoute } from "./hooks/useTrspRoute";
import { useRouteLayer } from "./hooks/useRouteLayer";
import { DEFAULT_CONFLATION_VIEW_ID } from "./constants";
import { RouteDetailsPanel } from "./components/RouteDetailsPanel";

const Comp = ({ state, setState, map }) => {
  // routecreation's comp.jsx branches the same way - state.symbologies means the map
  // context is DMS/MapEditor, otherwise it's a published page.
  const mctx = React.useContext(MapEditorContext);
  const cctx = React.useContext(CMSContext);
  const ctx = mctx?.falcor ? mctx : cctx;
  const { pgEnv } = ctx || {};

  const { source, destination, reset: resetSelection } = usePointPicker(map, true);

  const {
    routes, selectedVariant, setSelectedVariant, loading, error, getRoute, reset: resetRoute,
  } = useTrspRoute(DEFAULT_CONFLATION_VIEW_ID, pgEnv);

  const otherVariant = selectedVariant === "shortest" ? "fastest" : "shortest";
  useRouteLayer(map, routes?.[selectedVariant]?.feature, routes?.[otherVariant]?.feature);

  const handleGetRoute = () => {
    if (!source || !destination) return;
    getRoute({ lon: source.lng, lat: source.lat }, { lon: destination.lng, lat: destination.lat });
  };

  const handleReset = () => {
    resetSelection();
    resetRoute();
  };

  return (
    <RouteDetailsPanel
      hasSource={Boolean(source)}
      hasDestination={Boolean(destination)}
      canGetRoute={Boolean(source && destination)}
      loading={loading}
      error={error}
      routes={routes}
      selectedVariant={selectedVariant}
      onSelectVariant={setSelectedVariant}
      onGetRoute={handleGetRoute}
      onReset={handleReset}
    />
  );
};

export { Comp };
