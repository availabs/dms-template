import { useContext, useState } from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import ReportPickerModal from '../ReportPickerModal/ReportPickerModal';
import { chooseReportButtonTheme } from './ChooseReportButton.theme';

// Trigger for the "Choose a report" modal (npmrds-picker-modals.html, 2026-08-25) — a plain
// registered section, same shape as CreateReportButton: a themed button that owns its own
// open/close state and mounts the (self-contained, UI.Modal-based) picker component, rather than
// going through the declarative isModal/modalParamKey section-group mechanism. This matches how
// the route picker already works (RouteTagBrowserModal is mounted directly by ReportRouteList,
// not via a section-group modal) — Ryan's ask was for the two pickers to share an architecture,
// and a self-contained React modal is the one the route picker already proved out live.
export default function ChooseReportButton() {
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Icon } = UI || {};
  const t = { ...chooseReportButtonTheme, ...getComponentTheme(themeFromContext, 'chooseReportButton') };
  const [open, setOpen] = useState(false);

  if (!Button) return null;
  return (
    <div className={t.wrapper}>
      <Button activeStyle="default" onClick={() => setOpen(true)}>
        <Icon icon="Search" className={t.icon} /><span className={t.label}>Choose a report</span>
      </Button>
      <ReportPickerModal open={open} setOpen={setOpen} />
    </div>
  );
}
