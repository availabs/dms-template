import { InternalPanel } from "./internalPanel";
import { Comp } from "./comp";
import {
  ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID,
  ROUTE_SECONDARY_SOURCE_ID, ROUTE_SECONDARY_LAYER_ID,
  POINTS_SOURCE_ID, POINTS_LAYER_ID, POINTS_LABEL_LAYER_ID,
} from "./constants";

// Same plugin object shape as routecreation.plugin.jsx. Unlike routecreation (which drives an
// existing symbology/tile layer via mapRegister + the shared 'active-layers' machinery), this
// plugin owns its own plain geojson source/layer directly (see hooks/useRouteLayer.js) - there's
// no author-configured layer to wire up in mapRegister, and dataUpdate has nothing to react to
// outside the React-managed feature state comp.jsx already owns.
export const RoutingPlugin = {
  id: "routing",
  type: "plugin",
  mapRegister: () => {},
  dataUpdate: () => {},
  internalPanel: InternalPanel,
  externalPanel: () => {},
  comp: Comp,
  cleanup: (map) => {
    if (!map) return;
    if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.removeLayer(ROUTE_GLOW_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    if (map.getLayer(ROUTE_SECONDARY_LAYER_ID)) map.removeLayer(ROUTE_SECONDARY_LAYER_ID);
    if (map.getSource(ROUTE_SECONDARY_SOURCE_ID)) map.removeSource(ROUTE_SECONDARY_SOURCE_ID);
    if (map.getLayer(POINTS_LABEL_LAYER_ID)) map.removeLayer(POINTS_LABEL_LAYER_ID);
    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
    if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID);
  },
};
