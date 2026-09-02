import React from "react";
import { get } from "lodash-es";
import { MapEditorContext } from "../../../../dms/packages/dms/src/patterns/mapeditor/context";
import { ThemeContext, getComponentTheme } from "../../../../dms/packages/dms/src/ui/useTheme";
import { EDGES_LAYER_KEY, BLANK_OPTION } from "./constants";
import { internalPanelTheme } from "./internalPanel.theme";

// Columns this plugin's segment-picking/backend calls actually rely on - `ogc_fid` (read as
// `feature.id`, see useEdgeLayer.js) plus the graph-topology columns the backend join on. A layer
// missing these isn't the `_edges` table, regardless of how plausible its name looks.
const REQUIRED_COLUMNS = ["ogc_fid", "from_node", "to_node", "highway"];

// Base network layer picker (2026-08-31) - the author picks which already-added DMS layer
// (source 2097 "Temp OSM Conflation Edges" or equivalent) both of this plugin's modes pick
// segments from, instead of the plugin fetching its own data - mirrors
// ../routecreation/internalPanel.jsx exactly. Must be the `_edges` table (ogc_fid matches
// excluded_edge_ids/resolveDetourEndpoints), not the main conflation match table - see the task
// file's "Base layer" section for why that distinction matters.
//
// Column validation (2026-08-31): nothing previously stopped an author from picking ANY layer -
// a wrong pick could fail visibly (no ogc_fid at all) or, worse, silently return wrong routes if
// its feature ids happen to also exist in the backend's graph for an unrelated segment. Fetches
// the picked layer's real source metadata (same falcor "uda"/sources/byId/<id>/metadata path
// used throughout MapEditor's own LayerEditor - see Controls.jsx et al.) and checks the declared
// columns include what this plugin actually needs, surfacing a clear warning if not.
//
// Closure coverage / density analysis mode switch (2026-08-20) - same plugin, same segment-picking
// flow, just a second "view" toggled on here rather than a separate plugin (user: "plugin will be
// same just add the switch to enable and disable that view/tab"). Rendered below the
// InternalPluginPanel's own "Display default legend" toggle. comp.jsx reads this same
// `state.symbology.pluginData.detour['density-mode']` path and branches between the single-trip
// detour flow and the closure-density heatmap flow.
const InternalPanel = ({ state }) => {
  const { falcor, falcorCache, pgEnv } = React.useContext(MapEditorContext) || {};
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...internalPanelTheme, ...getComponentTheme(themeFromContext, "internalPanel") };

  const { pluginDataPath, symbologyLayerPath } = state.symbologies
    ? (() => {
        const symbName = Object.keys(state.symbologies)[0];
        const pathBase = `symbologies['${symbName}']`;
        return { pluginDataPath: `${pathBase}.symbology.pluginData.detour`, symbologyLayerPath: `${pathBase}.symbology.layers` };
      })()
    : { pluginDataPath: "symbology.pluginData.detour", symbologyLayerPath: "symbology.layers" };

  const edgesLayerId = get(state, `${pluginDataPath}['active-layers'][${EDGES_LAYER_KEY}]`);
  const sourceId = edgesLayerId ? get(state, `${symbologyLayerPath}['${edgesLayerId}'].source_id`) : null;

  React.useEffect(() => {
    if (sourceId && falcor && pgEnv) {
      falcor.get(["uda", pgEnv, "sources", "byId", sourceId, "metadata"]);
    }
  }, [sourceId, falcor, pgEnv]);

  const missingColumns = React.useMemo(() => {
    if (!sourceId) return [];
    let columns = get(falcorCache, ["uda", pgEnv, "sources", "byId", sourceId, "metadata", "value", "columns"], []);
    if (columns.length === 0) {
      columns = get(falcorCache, ["uda", pgEnv, "sources", "byId", sourceId, "metadata", "value"], []);
    }
    if (!Array.isArray(columns) || columns.length === 0) return null; // not loaded yet - distinct from "loaded and missing"
    const columnNames = new Set(columns.map((c) => c.name));
    return REQUIRED_COLUMNS.filter((name) => !columnNames.has(name));
  }, [sourceId, falcorCache, pgEnv]);

  const baseLayerLabel = (
    <div>
      <div>Base network layer</div>
      {edgesLayerId && missingColumns === null && (
        <div className={t.checkingText}>Checking layer…</div>
      )}
      {edgesLayerId && Array.isArray(missingColumns) && missingColumns.length > 0 && (
        <div className={t.warningText}>
          Not a conflation edges layer - missing column{missingColumns.length > 1 ? "s" : ""}: {missingColumns.join(", ")}
        </div>
      )}
    </div>
  );

  return [
    {
      label: baseLayerLabel,
      controls: [
        {
          type: "select",
          params: {
            // TODO -- may need to more creatively filter out layers already claimed by other plugins.
            options: [
              BLANK_OPTION,
              ...Object.keys(state.symbology.layers).map((layerKey) => ({
                value: layerKey,
                name: state.symbology.layers[layerKey].name,
              })),
            ],
            default: "",
          },
          // the layer the plugin controls MUST use the `'active-layers'` path/field
          path: `['active-layers'][${EDGES_LAYER_KEY}]`,
        },
      ],
    },
    {
      label: "Closure density mode",
      controls: [
        {
          type: "toggle",
          path: `['density-mode']`,
          params: { default: false },
        },
      ],
    },
    // Small on/off switch for the BFS candidate start/end points (2026-08-21: "i want to know which
    // can be the start and end points that you pick") - independent of density mode itself, so it
    // can stay off by default without hiding the toggle only after switching modes on.
    {
      label: "Show candidate points",
      controls: [
        {
          type: "toggle",
          path: `['show-candidates']`,
          params: { default: false },
        },
      ],
    },
    // Testing-only pair picker (2026-08-21): pick any start + any end candidate point, highlight
    // the actual route between them. Only takes effect in comp.jsx when "Show candidate points" is
    // ALSO on - the points have to be visible/clickable for this to do anything, per the user's own
    // framing ("it is depended on the point switch it must be on").
    {
      label: "Pick point pair",
      controls: [
        {
          type: "toggle",
          path: `['pick-pair-testing']`,
          params: { default: false },
        },
      ],
    },
  ];
};

export { InternalPanel };
