import { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportPageHeaderTheme } from './ReportPageHeader.theme';

// The report canvas's page-header card (npmrds-report.html): kicker+meta → h1+purpose
// → action stack → freshness footline. h1 and the published/draft pill read the page's
// own `title`/`published` fields directly (real page data, not duplicated into this
// section's state); everything else (kicker label, meta line, purpose, freshness, the
// optional Data link) is this component's own authored state, edited inline in place —
// same two-gate convention as ReportRouteList (editPageMode AND this section's own pencil).
export default function ReportPageHeader({ isEdit: sectionEditorOpen }) {
  const { item, editPageMode } = useContext(PageContext) || {};
  const { state, setState } = useContext(ComponentContext) || {};
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Icon } = UI || {};
  const t = { ...reportPageHeaderTheme, ...getComponentTheme(themeFromContext, 'reportPageHeader') };
  const navigate = useNavigate();
  const [shareCopied, setShareCopied] = useState(false);

  const canEdit = Boolean(editPageMode) && Boolean(sectionEditorOpen);
  const d = state?.display || {};

  const set = (key, value) => setState?.(draft => {
    if (!draft.display) draft.display = {};
    draft.display[key] = value;
  });

  // item.published is a draft-status flag, not literally "published"/"" as the name
  // suggests: 'draft' means pending unpublished changes (set at page creation, and by
  // any edit that flips has_changes); '' means clean — set by publish() AND
  // discardChanges() in editFunctions.jsx. Matches the existing `hasChanges` idiom used
  // elsewhere in the app (editPane/index.jsx, pagesPane.jsx): `published === 'draft'`.
  const isPublished = item?.published !== 'draft';
  const editPath = item?.url_slug ? `/edit/${item.url_slug}` : null;
  const publicPath = item?.url_slug ? `/${item.url_slug}` : null;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    } catch (e) {
      // clipboard access denied (permissions/non-secure context) — nothing to recover into
    }
  };

  return (
    <div className={t.wrapper}>
      <div className={t.kickerRow}>
        {canEdit ? (
          <input
            className={`${t.kickerLabel} ${t.inlineInput}`}
            value={d.kickerLabel ?? ''}
            placeholder="kicker label"
            onChange={e => set('kickerLabel', e.target.value)}
          />
        ) : d.kickerLabel ? (
          <span className={t.kickerLabel}>{d.kickerLabel}</span>
        ) : null}
        <span className={t.kickerRule} />
        {canEdit ? (
          <input
            className={`${t.kickerMeta} ${t.inlineInput} flex-1 min-w-[200px]`}
            value={d.metaLine ?? ''}
            placeholder="region · county · agency"
            onChange={e => set('metaLine', e.target.value)}
          />
        ) : d.metaLine ? (
          <span className={t.kickerMeta}>{d.metaLine}</span>
        ) : null}
        {item?.published !== undefined ? (
          isPublished ? (
            <span className={t.statusPillPublished}><span className={t.statusDotPublished} />published</span>
          ) : (
            <span className={t.statusPillDraft}><span className={t.statusDotDraft} />draft</span>
          )
        ) : null}
      </div>

      <div className={t.titleRow}>
        <div className={t.titleCol}>
          <h1 className={t.h1}>{item?.title}<span className={t.h1Dot}>.</span></h1>
          {canEdit ? (
            <textarea
              className={`${t.purpose} ${t.inlineTextarea}`}
              rows={2}
              value={d.purpose ?? ''}
              placeholder="What this report answers, in one or two sentences."
              onChange={e => set('purpose', e.target.value)}
            />
          ) : d.purpose ? (
            <p className={t.purpose}>{d.purpose}</p>
          ) : null}
        </div>

        <div className={t.actionCol}>
          <div className={t.actionRow}>
            {(canEdit || d.dataHref) && Button ? (
              <Button activeStyle="compact" disabled={!d.dataHref} onClick={() => d.dataHref && window.open(d.dataHref, '_blank')}>
                <Icon icon="Download" className={t.actionIcon} /><span className={t.actionLabel}>Data</span>
              </Button>
            ) : null}
            {Button ? (
              <Button activeStyle="compact" onClick={handleShare}>
                <Icon icon="LinkSquare" className={t.actionIcon} /><span className={t.actionLabel}>{shareCopied ? 'Copied' : 'Share'}</span>
              </Button>
            ) : null}
            {Button ? (
              <Button activeStyle="compact" onClick={() => window.print()}>
                <Icon icon="Printer" className={t.actionIcon} /><span className={t.actionLabel}>Print</span>
              </Button>
            ) : null}
            {Button && editPath && publicPath ? (
              <Button activeStyle="default" onClick={() => navigate(editPageMode ? publicPath : editPath)}>
                <Icon icon="PencilEditSquare" /><span className={t.actionLabel}>{editPageMode ? 'Done' : 'Edit'}</span>
              </Button>
            ) : null}
          </div>
          {canEdit ? (
            <div className={t.dataHrefRow}>
              <span className={t.inlineFieldLabel}>Data link</span>
              <input
                className={`${t.inlineInput} text-[11px] flex-1 min-w-[160px]`}
                value={d.dataHref ?? ''}
                placeholder="https://…"
                onChange={e => set('dataHref', e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className={t.freshnessEditRow}>
          <span className={t.inlineFieldLabel}>Data source</span>
          <input className={`${t.inlineInput} text-[10.5px]`} value={d.freshnessLabel ?? ''} placeholder="npmrds speeds" onChange={e => set('freshnessLabel', e.target.value)} />
          <span className={t.inlineFieldLabel}>complete through</span>
          <input className={`${t.inlineInput} text-[10.5px]`} value={d.freshnessComplete ?? ''} placeholder="jun 2026" onChange={e => set('freshnessComplete', e.target.value)} />
          <span className={t.inlineFieldLabel}>partial</span>
          <input className={`${t.inlineInput} text-[10.5px]`} value={d.freshnessPartial ?? ''} placeholder="jul 2026 partial" onChange={e => set('freshnessPartial', e.target.value)} />
          <span className={t.inlineFieldLabel}>since</span>
          <input className={`${t.inlineInput} text-[10.5px]`} value={d.freshnessSince ?? ''} placeholder="since jan 2017" onChange={e => set('freshnessSince', e.target.value)} />
        </div>
      ) : (d.freshnessLabel || d.freshnessComplete || d.freshnessPartial || d.freshnessSince) ? (
        <div className={t.freshnessWrapper}>
          {d.freshnessLabel ? <span className={t.freshnessDotWrap}><span className={t.freshnessDot} />{d.freshnessLabel}</span> : null}
          {d.freshnessComplete ? <>{d.freshnessLabel ? <span className={t.freshnessSep}>·</span> : null}<span>complete through <span className={t.freshnessValue}>{d.freshnessComplete}</span></span></> : null}
          {d.freshnessPartial ? <><span className={t.freshnessSep}>·</span><span>{d.freshnessPartial}</span></> : null}
          {d.freshnessSince ? <><span className={t.freshnessSep}>·</span><span>{d.freshnessSince}</span></> : null}
        </div>
      ) : null}
    </div>
  );
}
