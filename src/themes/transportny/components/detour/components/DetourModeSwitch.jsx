import React from "react";
import { ThemeContext, getComponentTheme } from "../../../../../dms/packages/dms/src/ui/useTheme";
import { detourDetailsPanelTheme } from "./DetourDetailsPanel.theme";

// DMS-page-only Simple/Multi control (Comp gates rendering to non-MapEditor contexts). Explicit
// labeled options rather than a bare on/off switch - a visitor has no prior context for what "on"
// would mean.
const DetourModeSwitch = ({ mode, onChange }) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = { ...detourDetailsPanelTheme, ...getComponentTheme(themeFromContext, "detourDetailsPanel") };

  return (
    <div className={t.modeSwitchWrapper}>
      <button
        type="button"
        className={mode === "simple" ? t.modeSwitchOptionActive : t.modeSwitchOption}
        onClick={() => onChange("simple")}
      >
        Simple
      </button>
      <button
        type="button"
        className={mode === "multi" ? t.modeSwitchOptionActive : t.modeSwitchOption}
        onClick={() => onChange("multi")}
      >
        Multi-point coverage
      </button>
    </div>
  );
};

export { DetourModeSwitch };
