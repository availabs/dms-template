import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { routecreationTheme } from "../routecreation.theme";
import { CREATION_MODES } from "../constants";

// Panel 4 · MODE HINT (bottom-center, docked), from npmrds-route-creation.html
// (routes-reports-users-mesh.md, Workstream E). The old tool's InfoBox printed this under the
// mode toggle (RouteCreationInfoBox.jsx) - the port dropped it, and Markers mode is unguessable
// without it. Copy is the old tool's own wording verbatim, not invented; the "switching mode
// clears" caveat is real (comp.jsx's setCreationMode unconditionally clears both tmc_array and
// markers on every mode switch). Docked to the CANVAS (not a corner panel) since the
// instruction is about the map, not about panel content.
const HINTS = {
  [CREATION_MODES.TMC_CLICKS]: "Click TMCs to define a route.",
  [CREATION_MODES.MARKERS]: "Click map to place markers to define a route.",
};

export const ModeHintPill = ({ creationMode }) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...routecreationTheme, ...getComponentTheme(themeFromContext, "routecreation") };

  return (
    <div className={t.posBottomCenter}>
      <div className={t.hintPill}>
        <svg className={t.hintIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m9 9 10.5 4-4.5 1.5L13.5 19 9 9Z" />
          <path d="M4 4v2m0 6v2m-2-6H4m8-2V4M6 6 4.5 4.5M6 12l-1.5 1.5" />
        </svg>
        <span>{HINTS[creationMode] || HINTS[CREATION_MODES.TMC_CLICKS]}</span>
        <span className={t.hintSep}>·</span>
        <span className={t.hintCaveat}>switching mode clears the selection</span>
      </div>
    </div>
  );
};
