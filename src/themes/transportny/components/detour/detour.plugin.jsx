import { get } from "lodash-es";
import { InternalPanel } from "./internalPanel";
import { Comp } from "./comp";
import {
  ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID,
  ROUTE_SECONDARY_SOURCE_ID, ROUTE_SECONDARY_LAYER_ID,
  EDGES_LAYER_KEY,
  SELECTED_SEGMENT_SOURCE_ID, SELECTED_SEGMENT_LAYER_ID,
  HOVER_SEGMENT_SOURCE_ID, HOVER_SEGMENT_LAYER_ID,
  START_END_SOURCE_ID, START_END_LAYER_ID,
  DENSITY_SOURCE_ID, DENSITY_LAYER_ID, DENSITY_LABEL_LAYER_ID,
  DENSITY_CANDIDATES_SOURCE_ID, DENSITY_CANDIDATES_LAYER_ID,
} from "./constants";

const resolvePluginPaths = (state) => {
  if (state.symbologies) {
    const symbName = Object.keys(state.symbologies)[0];
    const pathBase = `symbologies['${symbName}']`;
    return { pluginDataPath: `${pathBase}.symbology.pluginData.detour`, symbologyLayerPath: `${pathBase}.symbology.layers` };
  }
  return { pluginDataPath: "symbology.pluginData.detour", symbologyLayerPath: "symbology.layers" };
};

// Detour/avoid-segment routing plugin - a SEPARATE plugin from ../routing/routing.plugin.jsx.
// User clicks one segment; start/end are derived automatically from that segment's own
// endpoints - no point-picking. See planning/transportny/tasks/current/
// detour-avoid-segment-routing-plugin.md.
//
// Base network layer: the pickable network is an author-selected DMS layer (internalPanel.jsx),
// not a layer this plugin owns - see the task file's "Base layer" section.
//
// mapRegister does NOT force-set `hover: false` on the chosen layer to suppress MapEditor's
// generic hover/pin-marker popup - that was tried and reverted. `props.hover` only gates
// HoverComp's own inner content div; the mousemove hover detection, the click-to-pin marker, and
// its X close button are all driven by a SEPARATE, hardcoded-on-every-ViewLayer mechanism
// (avl-layer.jsx's onHover gate, avl-map.jsx's global click-to-pin listener) that never reads
// `props.hover` at all, so the mutation only emptied the popup's content (an empty pin) without
// fixing the actual interference. Shared map code (avl-map.jsx/avl-layer.jsx/
// SymbologyViewLayer.jsx) is off-limits to edit, so there is currently no plugin-side lever that
// cleanly suppresses this - see the task file's note on this for the real options.
export const DetourPlugin = {
  id: "detour",
  type: "plugin",
  mapRegister: () => {},
  dataUpdate: () => {},
  internalPanel: InternalPanel,
  externalPanel: () => {},
  comp: Comp,
  cleanup: (map, state) => {
    // `.loaded()`, not just truthiness - see useEdgeLayer.js's cleanup for why (a live DMS page's
    // Map component can tear down the underlying maplibre instance before this runs; `map` stays
    // a truthy reference but getLayer()/setLayoutProperty() throw internally once its style is
    // gone).
    if (!map || !map.loaded()) return;
    // Restore the author-selected base layer's visibility - useEdgeLayer.js may have hidden it
    // (isActive toggling once a result was showing) and the plugin no longer owns it to remove.
    if (state) {
      const { pluginDataPath } = resolvePluginPaths(state);
      const edgesLayerId = get(state, `${pluginDataPath}['active-layers'][${EDGES_LAYER_KEY}]`);
      if (edgesLayerId && map.getLayer(edgesLayerId)) {
        map.setLayoutProperty(edgesLayerId, "visibility", "visible");
      }
    }
    if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.removeLayer(ROUTE_GLOW_LAYER_ID);
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    if (map.getLayer(ROUTE_SECONDARY_LAYER_ID)) map.removeLayer(ROUTE_SECONDARY_LAYER_ID);
    if (map.getSource(ROUTE_SECONDARY_SOURCE_ID)) map.removeSource(ROUTE_SECONDARY_SOURCE_ID);
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
