// Pure descriptor function — no hooks. It is invoked as a plain function call (not
// rendered as JSX) by the shared ExternalPluginPanel, once per candidate tab plus once
// more for the active tab, so it must never call React hooks.
//
// IT RETURNS AN EMPTY LIST ON PURPOSE (2026-08-12).
//
// The macroview viewer controls used to be declared here as descriptors —
// Geography → Year → the active measureFilters — and drawn by core
// `mapeditor/MapEditor/components/ExternalPluginPanel`. That surface hard-codes its own
// chrome (`bg-white/95 w-[340px] rounded-lg drop-shadow-lg`, no header bar) and renders
// each row through `PluginControlWrappers`' `SimpleControlWrapper` (a `w-24` grey label
// plus a `StyledControl` pill). None of the converged design
// (dms_design_system_v2/pages/npmrds-macro.html) can be expressed through it: the 320px
// `panelInner`, the white `header` with the year `headerCount` pill, the tinted MEASURE
// GROUP that binds the measure select to its dependent controls, the segmented View
// control, the geography chips.
//
// The plugin's `comp` IS mounted as real JSX, so the whole panel moved there
// (controlsPanel.jsx) where it can consume the Map component's own theme keys. Returning
// [] here makes ExternalPluginPanel drop the macroview tab entirely — its `tabs` list is
// filtered by `externalPanel(...)?.length` — leaving a zero-height container that paints
// nothing. That is why no core DMS change was required.
//
// Restoring descriptor controls here would render a SECOND, duplicate control panel over
// the map; add controls to controlsPanel.jsx instead.
const ExternalPanel = () => [];

export { ExternalPanel };
