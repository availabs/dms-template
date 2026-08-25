import { useContext, useMemo, useState } from 'react';
import { CMSContext, PageContext } from '../../../../dms/packages/dms/src/patterns/page/context';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { buildPageTemplateType } from '../../../../dms/packages/dms/src/patterns/utils';
import { newPage } from '../../../../dms/packages/dms/src/patterns/page/pages/edit/editFunctions';
import { createReportButtonTheme } from './CreateReportButton.theme';

// The Report Page template's own DMS row id (npmrds_sub|page_template, "Report Page") — named
// here rather than inlined so relocating it later is a one-line change, mirroring the existing
// scripts/npmrds-reports/report_build.mjs's own DEFAULT_PARENT_SLUG precedent
// (report-authoring-ux-overhaul.md item 6).
const REPORT_PAGE_TEMPLATE_ID = '2187021';

// Skips PageTemplatePicker's generic template-picker modal entirely — this button only ever
// creates one thing, the Report Page template, so there's nothing for an author to choose. Fetch
// shape mirrors PageTemplatePicker.jsx's own loadDbTemplates() exactly, filtered to this one id.
export default function CreateReportButton() {
  const { item, dataItems, apiLoad, apiUpdate, format } = useContext(PageContext) || {};
  const { user } = useContext(CMSContext) || {};
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Icon } = UI || {};
  const t = { ...createReportButtonTheme, ...getComponentTheme(themeFromContext, 'createReportButton') };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const templateType = useMemo(() => buildPageTemplateType(format), [format]);

  const handleClick = async () => {
    if (!apiLoad || !templateType || !format?.app || loading) return;
    setLoading(true);
    setError('');
    try {
      const rows = await apiLoad({
        format: { app: format.app, type: templateType, attributes: ['id', 'app', 'type', 'data'] },
        children: [{ type: () => {}, action: 'list', path: '/' }],
      });
      const template = (rows || []).find((r) => String(r?.id) === REPORT_PAGE_TEMPLATE_ID);
      if (!template) {
        setError('Report Page template not found.');
        return;
      }
      // newPage() derives the new page's own parent from `item.parent` and takes no parent
      // override (editFunctions.jsx: `const newParent = item?.parent`), so on a page that IS
      // the folder — `converted_reports` (2188366) has `parent: ''` — a new report would be
      // filed at the PATTERN ROOT instead of inside the folder. Hence the fallback: "if the
      // page I'm on has no parent, I am the folder, so create the report under me."
      //
      // BC by construction: newPage() reads `item` ONLY as `item?.parent`, so wherever
      // `item.parent` is already set (2208581, `parent: 2188366`, and every other host page)
      // `item?.parent || item?.id` is `item.parent` and the resulting `newParent` — and with
      // it the sibling-index scan and getUrlSlug's parent prefix — is byte-identical.
      //
      // 1A's newPath redirect takes over from here, navigating into the new report's own
      // /edit/... route once apiUpdate resolves.
      await newPage({ ...item, parent: item?.parent || item?.id }, dataItems, user, apiUpdate, template);
    } catch (e) {
      console.error('<CreateReportButton>', e);
      setError('Could not create report.');
    } finally {
      setLoading(false);
    }
  };

  if (!Button) return null;
  return (
    <div className={t.wrapper}>
      <Button activeStyle="default" onClick={handleClick} disabled={loading}>
        <Icon icon="Plus" className={t.icon} /><span className={t.label}>{loading ? 'Creating…' : 'Create Report'}</span>
      </Button>
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
