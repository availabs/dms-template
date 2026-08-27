import { InternalPanel } from "./internalPanel";
import { Comp } from "./comp";
import {
  ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID,
  ROUTE_SECONDARY_SOURCE_ID, ROUTE_SECONDARY_LAYER_ID,
  EDGES_SOURCE_ID, EDGES_LAYER_ID,
  SELECTED_SEGMENT_SOURCE_ID, SELECTED_SEGMENT_LAYER_ID,
  HOVER_SEGMENT_SOURCE_ID, HOVER_SEGMENT_LAYER_ID,
  START_END_SOURCE_ID, START_END_LAYER_ID,
  DENSITY_SOURCE_ID, DENSITY_LAYER_ID, DENSITY_LABEL_LAYER_ID,
  DENSITY_CANDIDATES_SOURCE_ID, DENSITY_CANDIDATES_LAYER_ID,
} from "./constants";

// Detour/avoid-segment routing plugin - a SEPARATE plugin from ../routing/routing.plugin.jsx.
// Corrected flow (2026-08-19): user clicks one segment; start/end are derived automatically from
// that segment's own endpoints - no point-picking. See planning/transportny/tasks/current/
// detour-avoid-segment-routing-plugin.md.
export const DetourPlugin = {
  id: "detour",
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
    if (map.getLayer(EDGES_LAYER_ID)) map.removeLayer(EDGES_LAYER_ID);
    if (map.getSource(EDGES_SOURCE_ID)) map.removeSource(EDGES_SOURCE_ID);
    if (map.getLayer(SELECTED_SEGMENT_LAYER_ID)) map.removeLayer(SELECTED_SEGMENT_LAYER_ID);
    if (map.getSource(SELECTED_SEGMENT_SOURCE_ID)) map.removeSource(SELECTED_SEGMENT_SOURCE_ID);
    if (map.getLayer(HOVER_SEGMENT_LAYER_ID)) map.removeLayer(HOVER_SEGMENT_LAYER_ID);
    if (map.getSource(HOVER_SEGMENT_SOURCE_ID)) map.removeSource(HOVER_SEGMENT_SOURCE_ID);
    if (map.getLayer(START_END_LAYER_ID)) map.removeLayer(START_END_LAYER_ID);
    if (map.getSource(START_END_SOURCE_ID)) map.removeSource(START_END_SOURCE_ID);
    if (map.getLayer(DENSITY_LABEL_LAYER_ID)) map.removeLayer(DENSITY_LABEL_LAYER_ID);
    if (map.getLayer(DENSITY_LAYER_ID)) map.removeLayer(DENSITY_LAYER_ID);
    if (map.getSource(DENSITY_SOURCE_ID)) map.removeSource(DENSITY_SOURCE_ID);
    if (map.getLayer(DENSITY_CANDIDATES_LAYER_ID)) map.removeLayer(DENSITY_CANDIDATES_LAYER_ID);
    if (map.getSource(DENSITY_CANDIDATES_SOURCE_ID)) map.removeSource(DENSITY_CANDIDATES_SOURCE_ID);
  },
};
