# Creating a map in MapEditor (author's UI guide)

Author-facing, click-by-click reference for building a map from scratch through the live UI. The
existing skills that cover this area (`src/dms/skills/creating-a-map-section.md`,
`src/dms/skills/editing-map-symbologies.md`) are written from a **headless/build-script** angle
(JSON payloads, CLI writes) - this doc fills the gap for someone doing it by hand in the browser.
Read those two skills first if you're scripting a map instead of clicking through it; read this
one if you're not.

## Two places a map lives, and which one you want

There are two different UI entry points that both open the SAME underlying editor
(`MapEditor/index.jsx`), but they serve different purposes:

1. **The mapeditor pattern** (`/mapeditor/edit/:id`) - a **standalone symbology catalog editor**.
   What you build here is a reusable symbology (a named set of layers + styling + plugins) saved
   to the catalog, NOT a page. Use this to build/style a map once and reuse it across multiple
   pages, or to iterate on styling without touching a live page.
2. **A page's `Map` section** - the actual "put a map on a page" path. Add a `Map` section to a
   page like any other section (Card, etc.) via the normal "Add Section" flow. Its edit panel
   embeds the SAME Layers/Legend/Plugins UI as the standalone editor, operating on the section's
   own embedded symbology data.

You can either build a symbology from scratch inside a page's `Map` section, or pull one in from
the mapeditor catalog. **Important**: once pulled in, a page section's copy is independent of the
catalog row - edits to one do not automatically appear in the other. The section's Map settings
has a "Refresh" action that re-merges the catalog version back in while preserving your own
per-section config (filters, plugin settings, etc.) - use that if you want to pick up catalog
changes, don't assume they show up automatically. See `editing-map-symbologies.md` §1 ("TWO
homes") for the full data-model reasoning.

There is only one map section type to pick today - "Map: Dama Map" (the old multi-symbology Layer
Library browser) has been folded into `Map` and no longer appears as a separate option in the
section picker.

## Adding a data layer

Whichever editor you're in (standalone or a page's `Map` section), the Layers tab works the same:

1. Click the **+** next to the Legend/Layers/Plugins tabs.
2. Pick a data **Source**, then a **View** of that source (e.g. "Temp OSM Conflation Edges 2025").
3. The layer is added with a default style. Click into it to open the Layer Editor and set:
   - **Paint** - categories, choropleth, or a fixed color/style, depending on the geometry type
     (fill/line/circle/heatmap each have their own controls).
   - **Legend** - the swatch rows shown in the Legend tab (only rendered for `categories`/
     `choropleth` layer types).
   - **Filter** - a static or dynamic (page-variable-bound) filter on which rows render.
   - **Join** - link this layer's data to another source/view.
4. Reorder layers by dragging, toggle a layer's visibility, or set which layer is "active"
   (the one whose style controls show by default).
5. Save. In the standalone editor this writes the catalog symbology row directly. In a page's
   `Map` section, this updates the section's own embedded copy - publish the page normally to make
   it live.

For the full anatomy of what a layer object actually contains (the MapLibre paint spec, the
`_case` sub-layer convention for line-type layers, style recipes for common patterns like
choropleth-by-measure), see `editing-map-symbologies.md` §2-4.

## Adding a map plugin

A "plugin" is extra interactive behavior layered on top of the base map - point-to-point routing
(`routing`), avoid-segment detour analysis (`detour`), route creation, etc. Attaching one to a map
is an authoring action (pick it from a dropdown); building a NEW plugin is a developer task.

**As an author**: open the **Plugins** tab, pick a plugin from the dropdown (only plugins the
current theme has registered appear here - see below), and it's added to the map. Each plugin
gets its own settings panel (rendered inline in the Plugins tab) - for the `detour` plugin's own
settings, see
[`planning/transportny/skills/detour-and-routing-plugins.md`](../planning/transportny/skills/detour-and-routing-plugins.md).
Remove a plugin via the "x" next to its entry in the Plugins tab.

**As a developer, to make a NEW plugin available**: a plugin is a plain object -

```js
export const SomePlugin = {
  id: "myplugin",                       // key used everywhere - the theme registration key, the
                                         // symbology.plugins key, the PluginLibrary key
  type: "plugin",
  mapRegister: (map, state, ...) => {}, // wire up maplibre sources/layers/listeners on mount
  dataUpdate: (...) => {},              // react to plugin state/data changes
  internalPanel: InternalPanel,         // rendered inside the Plugins tab's settings area
  externalPanel: () => {},              // rendered outside the tab (or a no-op)
  comp: Comp,                           // rendered on the map canvas itself (via AvlMap's overlay)
  cleanup: (map, state) => {},          // MUST remove every source/layer mapRegister added
};
```

Register it in the theme's `mapPlugins` map, keyed by its `id`:

```js
// src/themes/<theme>/theme.js
mapPlugins: {
  routing: RoutingPlugin,
  detour: DetourPlugin,
  myplugin: SomePlugin,
},
```

That's the only registration step needed - both the standalone mapeditor pattern and the page
pattern's `Map` section auto-register every entry in `theme.mapPlugins` into a shared
`PluginLibrary`, which is what populates the Plugins tab's dropdown. No other wiring is required
for a plugin to become attachable everywhere that theme is active.

## One state-shape gotcha worth knowing (mostly for developers/debugging)

The two editor contexts store the map's state at different nesting depths:

- **Standalone mapeditor** (and its own test harness): `state.symbology = { activeLayer, layers,
  plugins, pluginData }` - flat, single symbology.
- **A page's `Map` section**: `state.symbologies = { [symbologyId]: { name, symbology: {
  activeLayer, layers, plugins, pluginData } } }` - the same shape as above, nested one level
  deeper under a symbology id, because a section can (in principle) hold more than one.

If you're inspecting state via devtools or writing a plugin, check which context you're in before
assuming a path. Plugins that need to work in both write a small resolver (see `detour.plugin.jsx`'s
`resolvePluginPaths`) that branches on `state.symbologies` being present, rather than hardcoding
`state.symbology....` directly.
