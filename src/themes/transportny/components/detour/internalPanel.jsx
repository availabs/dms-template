// Closure coverage / density analysis mode switch (2026-08-20) - same plugin, same segment-picking
// flow, just a second "view" toggled on here rather than a separate plugin (user: "plugin will be
// same just add the switch to enable and disable that view/tab"). Rendered below the
// InternalPluginPanel's own "Display default legend" toggle. comp.jsx reads this same
// `state.symbology.pluginData.detour['density-mode']` path and branches between the single-trip
// detour flow and the closure-density heatmap flow.
const InternalPanel = () => [
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
    label: "Pick point pair (beta)",
    controls: [
      {
        type: "toggle",
        path: `['pick-pair-testing']`,
        params: { default: false },
      },
    ],
  },
];

export { InternalPanel };
