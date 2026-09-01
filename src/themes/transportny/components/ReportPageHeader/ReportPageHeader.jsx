import { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CMSContext, ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { publish } from '../../../../dms/packages/dms/src/patterns/page/pages/edit/editFunctions';
import { reportPageHeaderTheme } from './ReportPageHeader.theme';
import { ROUTE_CATALOG_PARAM_KEY } from '../ReportRouteList/useGraphPublish';
import { resolvedRouteLabel } from '../ReportRouteList/relativeDateResolution';
import { useReportTags } from './useReportTags';
import TagsEditor from '../TagsEditor/TagsEditor';

// The report canvas's page-header card (npmrds-report.html): kicker+meta → h1+purpose
// → action stack → freshness footline. h1 and the published/draft pill read the page's
// own `title`/`published` fields directly (real page data, not duplicated into this
// section's state); everything else (kicker label, meta line, purpose, freshness, the
// tag editor, the optional Data link) is this component's own authored state, edited
// inline in place, gated on `editPageMode` ALONE — same "no extra click" convention
// ReportRouteList already uses (2026-09-01 correction, Workstream D: an author on
// /edit/... shouldn't have to separately click this section into its own edit mode
// before any of its fields become editable, same reasoning RRL's own comment gives).
export default function ReportPageHeader() {
  const { item, editPageMode, pageState, apiLoad, apiUpdate } = useContext(PageContext) || {};
  const { user, app } = useContext(CMSContext) || {};
  // Inline tag editor next to Done (routes-reports-users-mesh.md, Workstream D) — reads/writes
  // the SAME `reports_snap_2` row ReportRouteList/useReportRow.js owns `routes` on, via its own
  // small hook (see useReportTags.js for why this is a separate fetch, not shared state).
  const { tags: reportTags, persistTags: persistReportTags } = useReportTags({ apiLoad, apiUpdate, app, itemId: item?.id });
  const { state, setState } = useContext(ComponentContext) || {};
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Icon } = UI || {};
  const t = { ...reportPageHeaderTheme, ...getComponentTheme(themeFromContext, 'reportPageHeader') };
  const navigate = useNavigate();
  const [shareCopied, setShareCopied] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(true);

  // Same catalog (id/name/colour/TMCs/date-span), same pageState key, RRL already broadcasts for
  // every graph's own QuickControls Routes pill (ROUTE_CATALOG_PARAM_KEY, useGraphPublish.js) —
  // published unconditionally, not gated on edit mode, so it's available here in view mode too.
  // This is the one place a viewer sees the report's routes without opening edit mode at all
  // (RRL itself is edit-mode-only) — see report-route-ui-parity-gaps.md.
  const routeCatalog = useMemo(() => {
    const values = pageState?.filters?.find((f) => f.searchKey === ROUTE_CATALOG_PARAM_KEY && f.type === 'action')?.values;
    return Array.isArray(values) ? values : [];
  }, [pageState?.filters]);

  // Grouped by `groupKey` (useDynamicReportRoutes.js's routeSlotGroupKey) — several catalog
  // entries are really just date/settings VIEWS of ONE physical route a viewer picked once
  // (weekly_average's "Current Year"/"1 Year Ago"/"2 Years Ago" all share one group). Each
  // group gets ONE header naming the real route (`baseRouteName`, the resolved catalog row's
  // own name — falls back to the group's first member's own name when that's all there is,
  // e.g. a route this report never resolved through the Dynamic Report catalog at all), with
  // that group's variants as pills underneath — otherwise a multi-route report (bi_directional's
  // separate NB/SB groups) would show every variant's date label with no way to tell which
  // physical road each cluster of pills even belongs to.
  const routeGroups = useMemo(() => {
    const byKey = new Map();
    routeCatalog.forEach((r) => {
      const key = r.groupKey ?? r.route_comp_id;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(r);
    });
    return Array.from(byKey.values());
  }, [routeCatalog]);

  const canEdit = Boolean(editPageMode);
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

  // Leaving edit mode also publishes — an author closing out a report shouldn't need a
  // separate manual Publish click first (report-authoring-ux-overhaul.md item 8). Only on the
  // click that LEAVES edit mode (editPageMode true → false); entering edit mode is a plain
  // navigate, same as before.
  const handleEditToggle = async () => {
    if (editPageMode) {
      await publish(user, item, apiUpdate);
      navigate(publicPath);
    } else {
      navigate(editPath);
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
              <Button activeStyle="default" onClick={handleEditToggle}>
                <Icon icon="PencilEditSquare" /><span className={t.actionLabel}>{editPageMode ? 'Done' : 'Edit'}</span>
              </Button>
            ) : null}
          </div>
          {canEdit ? (
            <div className={t.tagsRow}>
              <TagsEditor tags={reportTags} onChange={persistReportTags} user={user} Icon={Icon} theme={t} inline />
            </div>
          ) : null}
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

      {routeGroups.length > 0 ? (
        <div className={t.routesWrapper}>
          <button type="button" className={t.routesToggle} onClick={() => setRoutesOpen((open) => !open)}>
            <Icon icon={routesOpen ? 'ChevronDown' : 'ChevronRight'} className={t.routesToggleIcon} />
            <span>{routeGroups.length} route{routeGroups.length === 1 ? '' : 's'} in this report</span>
          </button>
          {routesOpen ? (
            <div className={t.routesGroupList}>
              {routeGroups.map((group) => {
                // A header only earns its keep when it says something the pill(s) below it
                // don't already say — a lone, non-relative route (the ordinary single-route
                // report, no Dynamic Report catalog resolution) would otherwise show its own
                // name twice.
                const baseName = group.find((r) => r.baseRouteName)?.baseRouteName || null;
                const showGroupName = baseName || group.length > 1;
                return (
                  <div key={group[0].groupKey ?? group[0].route_comp_id} className={t.routeGroup}>
                    {showGroupName ? <div className={t.routeGroupName}>{baseName || group[0].name}</div> : null}
                    <div className={t.routesList}>
                      {group.map((r) => (
                        <span key={r.route_comp_id} className={t.routePill}>
                          <span className={t.routeDot} style={{ backgroundColor: r.color || '#94a3b8' }} />
                          {resolvedRouteLabel(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
