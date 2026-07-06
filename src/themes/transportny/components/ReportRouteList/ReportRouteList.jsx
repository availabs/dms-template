import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cloneDeep, isEqual } from 'lodash-es';
import { ComponentContext, PageContext } from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme'
import { reportRouteListTheme } from './ReportRouteList.theme';
import { buildUdaConfig } from '../../../../dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig';
import { nameToSlug } from '../../../../dms/packages/dms/src/utils/type-utils';

function roundToFiveMinutes(dateStr) {
  if (!dateStr || !dateStr.includes('T')) return dateStr;

  const [datePart, timePart] = dateStr.split('T');
  if (!timePart) return dateStr;

  const [hours, minutes] = timePart.split(':').map(Number);
  const roundedMinutes = Math.round(minutes / 5) * 5;

  let finalHours = hours;
  let finalMinutes = roundedMinutes;
  if (finalMinutes >= 60) {
    finalMinutes = 0;
    finalHours = (hours + 1) % 24;
  }

  return `${datePart}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
}

// Stable reference for "no routes yet" — `reportRow?.routes || []` would otherwise
// produce a brand-new array every render, which would re-trigger the publish effect
// below on every render (it depends on `routes`) and loop forever.
const EMPTY_ROUTES = [];

// The report's routes live in exactly one row of a `reports_snap_2`-shaped dataset —
// one row per report page, keyed by `report_id` = the page's own id. This is a
// genuine DMS `:data` row (the same split-table storage Card/Spreadsheet write
// through via `updateItem`/`addItem`), which is the only truly schema-free
// persistence layer in this system: page/component rows go through a declared
// attribute schema (`page.format.js`/`cmsSection`) that a client-side allowlist can
// silently strip unknown keys from (this is exactly what happened when routes lived
// in this section's own `element-data` — dataWrapper's save effect round-trips
// `element-data` through a fixed set of known fields whenever it fires, dropping
// anything else). A `:data` row has no such allowlist.
//
// Which dataset this is is an author decision, not a hardcoded one: `externalSource`
// is this section's normal sectionMenu "Dataset" binding (the one every
// `useDataWrapper` component gets). The Report Page template pre-wires it to
// `reports_snap_2`, but nothing in this file hardcodes that source/view id anymore.

export default function ReportRouteList() {
  const { apiLoad, apiUpdate, pageState, clearActionParam, item, editPageMode } = useContext(PageContext) || {};
  const { state:{join, externalSource} } = useContext(ComponentContext) || {};
  // NOT `props.isEdit` — that's dataWrapper's per-section "is THIS component's own
  // settings editor open" flag (almost always false in normal interactive use, since
  // this panel renders via SectionView even on an /edit/... page). `editPageMode`
  // (from PageContext, set only on the /edit/... route) is page-level: whether this
  // report is currently open for editing, independent of any single section's own
  // settings-editor state. Every mutating handler and control below gates on this,
  // not on props.isEdit.
  const isEdit = Boolean(editPageMode);
  const { UI, theme: themeFromContext = {} } = useContext(ThemeContext) || {};
  const { Button, Input, Icon } = UI || {};
  const t = { ...reportRouteListTheme, ...getComponentTheme(themeFromContext, 'reportRouteList') };
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingRoute, setPendingRoute] = useState(null);
  const [expandedRoutes, setExpandedRoutes] = useState({});
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [editingRouteNameIndex, setEditingRouteNameIndex] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingRouteDatesIndex, setEditingRouteDatesIndex] = useState(null);
  const [editStartDateValue, setEditStartDateValue] = useState('');
  const [editEndDateValue, setEditEndDateValue] = useState('');
  // The route CATALOG binding — read-only, used only to resolve `add_route_id` into
  // a route to copy from. Bound via the sectionMenu's "Add Join Source" slot rather
  // than `externalSource` (which is this component's STORAGE binding, see below):
  // an author picks a join source + view and stops there (never configures join
  // columns), which leaves `isJoinComplete()` false and keeps this from ever being
  // sent to the query engine as a real SQL join (`buildUdaConfig.js`'s per-alias
  // `isJoinComplete` filter) — while still populating full `sourceInfo` the moment
  // the source is picked (`useDataSource.js`'s `onJoinSourceChange`). Read the first
  // (only) join source rather than hardcoding an alias name — there's only ever one
  // for this component, so no ambiguity, and it's robust to whatever alias ends up
  // assigned.
  const routeSourceInfo = Object.values(join?.sources || {})[0]?.sourceInfo;
  // The report STORAGE binding — this section's normal sectionMenu "Dataset" pick.
  // The Report Page template pre-wires this to `reports_snap_2`, but nothing here
  // hardcodes that source/view id; an author could point it anywhere with the same
  // shape (a `report_id` + `routes` column).
  const sourceType = externalSource?.type || (externalSource?.name ? nameToSlug(externalSource.name) : undefined);
  const storageDataFormat = externalSource?.view_id && sourceType
    ? { ...externalSource, type: `${sourceType}|${externalSource.view_id}:data` }
    : externalSource;
  // `reportRow` is this report's one dedicated row in the storage dataset — `null`
  // while loading, `{id: null, routes: []}` once loaded if no row exists yet (first
  // route add creates it), `{id, routes}` once one exists. Loaded/persisted directly
  // via apiLoad/apiUpdate below — independent of this section's own `element-data`
  // and of the page's routes/draft_routes (removed; see the README's "Storage"
  // section for why).
  const [reportRow, setReportRow] = useState(null);
  // Synchronous mirror of reportRow.id — persistRoutes reads/writes this
  // instead of the closed-over `reportRow` state so a create's id is never
  // lost to a stale closure (e.g. two persistRoutes calls overlapping before
  // a re-render lands). React state updates are async and batched; a ref is
  // not, so it can't go stale between "row created" and "next edit persisted".
  const reportRowIdRef = useRef(null);
  const routes = reportRow?.routes || EMPTY_ROUTES;

  const getDateValue = (val) => (val || '').split('T')[0];
  const getTimeValue = (val) => (val || '').split('T')[1] || '';
  const onDateChange = (e, currentValue, setter) => {
    const time = currentValue?.split('T')[1] || '';
    setter(time ? `${e.target.value}T${time}` : e.target.value);
  };
  const onTimeChange = (e, currentValue, setter) => {
    const date = currentValue?.split('T')[0] || '';
    setter(e.target.value ? `${date}T${e.target.value}` : date);
  };

  const toggleRoute = (index) => {
    setExpandedRoutes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const addRouteId = pageState?.filters?.find(f => f.searchKey === 'add_route_id' && f.type === 'action')?.values?.[0];

  const getTmcArray = (tmcArray) => {
    if (!tmcArray) return [];
    if (Array.isArray(tmcArray)) return tmcArray;
    try {
      return JSON.parse(tmcArray);
    } catch (e) {
      console.error('Failed to parse tmc_array', e);
      return [];
    }
  };

  const fetchDynamicRoute = async () => {
    if (!isEdit || !addRouteId || !apiLoad || !routeSourceInfo) return;
    setLoading(true);

    const udaConfig = buildUdaConfig({
      externalSource: routeSourceInfo,
      columns: routeSourceInfo.columns.map(c => ({...c, show: true})),
      filters: { op: "AND", groups: [{ col: "data->>'route_id'", op: "filter", value: addRouteId.value }] }
    });

    const config = {
      format: { ...routeSourceInfo },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options) }, params: {} }]
    };

    try {
      const data = await apiLoad(config, "/");
      if (data && data[0]) setPendingRoute(data[0].data.value);
    } catch (e) {
      console.error('<ReportRouteList:fetchDynamic>', e);
      setError('Could not fetch route details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(isEdit && addRouteId) {
      fetchDynamicRoute();
    }
  },[isEdit, addRouteId]);

  // Load this report's one row from the storage dataset (`externalSource`), keyed by
  // `report_id` = the page's own id (a real column filter, same `data->>'col'` UDA
  // query shape fetchDynamicRoute uses above — just against a different dataset). No
  // row yet is a normal, expected state for a freshly created report page, not an
  // error.
  const loadReportRow = async () => {
    if (!apiLoad || !item?.id || !externalSource?.columns) return;
    const udaConfig = buildUdaConfig({
      externalSource,
      columns: externalSource.columns.map(c => ({ ...c, show: true })),
      filters: { op: "AND", groups: [{ col: "data->>'report_id'", op: "filter", value: String(item.id) }] }
    });
    const config = {
      format: { ...externalSource },
      children: [{ action: "uda", path: "/", filter: { options: JSON.stringify(udaConfig.options) }, params: {} }]
    };
    try {
      const data = await apiLoad(config, "/");
      const row = data?.[0]?.data?.value;
      if (row) {
        let parsedRoutes = [];
        try {
          parsedRoutes = JSON.parse(row.routes || '[]') || [];
        } catch (e) {
          parsedRoutes = [];
        }
        reportRowIdRef.current = row.id;
        setReportRow({ id: row.id, routes: parsedRoutes });
      } else {
        reportRowIdRef.current = null;
        setReportRow({ id: null, routes: [] });
      }
    } catch (e) {
      console.error('<ReportRouteList:loadReportRow>', e);
      reportRowIdRef.current = null;
      setReportRow({ id: null, routes: [] });
    }
  };

  useEffect(() => {
    loadReportRow();
  }, [item?.id, externalSource?.source_id, externalSource?.view_id]);

  // Persist a route mutation to this report's row in the storage dataset — creating
  // it on the first-ever route add (no row yet → `apiUpdate` with no `id` inserts
  // one, same as dataWrapper's own `addItem` elsewhere), updating it on every
  // mutation after. This is a genuine DMS data row (split-table, schema-free), not a
  // page attribute and not this section's own `element-data` — see the README's
  // "Storage" section for why those two were both dead ends.
  const persistRoutes = async (nextRoutes) => {
    // Page-level edit-mode gate: mirrors the convention every other dataWrapper
    // component follows (mutations only happen while the page is open on /edit/...).
    // This is a single choke point — every mutating handler below funnels through
    // here, so gating here is sufficient on its own to guarantee no write ever fires
    // while a report is merely being viewed.
    if (!isEdit || !apiUpdate || !item?.id || !reportRow || !storageDataFormat) return;
    const currentId = reportRowIdRef.current;
    const payload = { report_id: String(item.id), routes: JSON.stringify(nextRoutes) };
    if (currentId) payload.id = currentId;
    const res = await apiUpdate({ data: payload, config: { format: storageDataFormat } });
    const nextId = currentId || res?.id;
    reportRowIdRef.current = nextId;
    setReportRow({ id: nextId, routes: nextRoutes });
  };

  const addRoute = async () => {
    if (!apiUpdate || !item?.id || !pendingRoute || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      // Find max ID
      let maxId = -1;
      routes.forEach(r => {
        if (r.route_comp_id && r.route_comp_id.startsWith('comp-')) {
          const id = parseInt(r.route_comp_id.replace('comp-', ''), 10);
          if (!isNaN(id) && id > maxId) {
            maxId = id;
          }
        }
      });

      const newRoute = {
        ...pendingRoute,
        route_comp_id: `comp-${maxId + 1}`
      };

      await persistRoutes([...routes, newRoute]);

      setPendingRoute(null);
      clearActionParam('add_route_id');
    } catch (e) {
      console.error('<ReportRouteList:add>', e);
      setError('Could not add route.');
    } finally {
      setSaving(false);
    }
  };

  const removeRoute = async (indexToRemove) => {
    if (!apiUpdate || !item?.id || saving || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      await persistRoutes(routes.filter((_, i) => i !== indexToRemove));
    } catch (e) {
      console.error('<ReportRouteList:remove>', e);
      setError('Could not remove route.');
    } finally {
      setSaving(false);
    }
  };

  const reorderRoutes = async (index, direction) => {
    if (!apiUpdate || !item?.id || saving || !reportRow) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= routes.length) return;

    setSaving(true);
    setError('');
    try {
      const updatedRoutes = [...routes];
      const temp = updatedRoutes[index];
      updatedRoutes[index] = updatedRoutes[newIndex];
      updatedRoutes[newIndex] = temp;

      await persistRoutes(updatedRoutes);
    } catch (e) {
      console.error('<ReportRouteList:reorder>', e);
      setError('Could not reorder route.');
    } finally {
      setSaving(false);
    }
  };

  const updateRoute = async ({index, updates}) => {
    if (!apiUpdate || !item?.id || saving || !updates || !reportRow) return;
    setSaving(true);
    setError('');
    try {
      const newRoutes = cloneDeep(routes)
      Object.entries(updates).forEach(([field, value]) => {
          let finalValue = value;
          if ((field === 'startDate' || field === 'endDate') && typeof finalValue === 'string' && finalValue.includes('T')) {
            finalValue = roundToFiveMinutes(finalValue);
          }
          newRoutes[index][field] = finalValue;
      });
      await persistRoutes(newRoutes);
    } catch (e) {
      console.error('<ReportRouteList:update>', e);
      setError('Could not update route.');
    } finally {
      setSaving(false);
    }
  };

  const cancelAdd = () => {
    setPendingRoute(null);
    clearActionParam('add_route_id');
  };
  return (
    <div className={t.wrapper}>
      <div className={t.title}>{item?.title}</div>
      <div className={t.titleWrapper}>
        <div>Routes</div>
        <Button themeOptions={{ size: "xs", color:"transparent" }} onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}>
          {isRoutesExpanded ? <Icon icon="ChevronUp" /> : <Icon icon="ChevronDown" />}
        </Button>
      </div>
      {isRoutesExpanded && (
        <>
          {(loading || !reportRow) ? <div className={t.loading}>Loading…</div> : null}
          <div className={t.list}>
            {routes.map((r, i) => {
              const tmcArray = getTmcArray(r.tmc_array);
              const isExpanded = expandedRoutes[i];
              return (
                <div key={`${r.id}-${i}`} className={t.row}>
                  <div className={t.rowContainer}>
                    <div className={t.rowHeader}>
                      <div className={t.iconContainer}>
                        <Icon icon={'Drag'} />
                        <Button disabled={editingRouteNameIndex === i} themeOptions={{ size: "xs" }} onClick={() => toggleRoute(i)}>
                          {isExpanded ? '-' : '+'}
                        </Button>
                        {editingRouteNameIndex === i ? (
                          <div className={t.editContainer}>
                            <div className={t.editInputWrapper}>
                              <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} />
                            </div>
                            <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                              updateRoute({ index: i, updates: { name: editNameValue } });
                              setEditingRouteNameIndex(null);
                            }}>
                              <Icon icon={"FloppyDisk"} />
                            </Button>
                            <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteNameIndex(null)}>
                              <Icon icon={"CancelCircle"} />
                            </Button>
                          </div>

                        ) : (
                          <div className={t.editContainer}>
                            <div className={t.routeTitle}>{r.name}</div>
                            {isEdit && isExpanded && (
                              <Button themeOptions={{ size: "xs" }} title="Edit Name" onClick={() => {
                                setEditingRouteNameIndex(i);
                                setEditNameValue(r.name);
                              }}>
                                <Icon icon={'PencilSquare'} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {isEdit && (
                        <div className={t.reorderButtons}>
                          <Button themeOptions={{ size: "xs" }} disabled={i === 0 || saving} onClick={() => reorderRoutes(i, 'up')}>
                            <Icon icon={'ChevronUp'} />
                          </Button>
                          <Button themeOptions={{ size: "xs" }} disabled={i === routes.length - 1 || saving} onClick={() => reorderRoutes(i, 'down')}>
                            <Icon icon={'ChevronDown'} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isExpanded && (
                      <div className={t.expandedContainer}>
                        {tmcArray.length > 0 && (
                          <div className={t.tmcWrapper}>
                            <div className={t.tmcLabel}>TMCs:</div>
                            <div className={t.tmcList}>
                              {tmcArray.join(", ")}
                            </div>
                          </div>
                        )}
                        <div className={t.dateInputsContainer}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className={t.dateRangeLabel}>Date Range</div>
                            {editingRouteDatesIndex === i ? (
                              <div className={t.editContainer}>
                                <Button themeOptions={{ size: "xs" }} title="save" onClick={() => {
                                  updateRoute({ index: i, updates: { startDate: editStartDateValue, endDate: editEndDateValue } });
                                  setEditingRouteDatesIndex(null);
                                }}>
                                  <Icon icon={"FloppyDisk"} />
                                </Button>
                                <Button themeOptions={{ size: "xs", color: "danger" }} title="cancel" onClick={() => setEditingRouteDatesIndex(null)}>
                                  <Icon icon={"CancelCircle"} />
                                </Button>
                              </div>
                            ) : isEdit ? (
                              <Button themeOptions={{ size: "xs" }} title="Edit Dates" onClick={() => {
                                setEditingRouteDatesIndex(i);
                                setEditStartDateValue(r.startDate);
                                setEditEndDateValue(r.endDate);
                              }}>
                                <Icon icon={'PencilSquare'} />
                              </Button>
                            ) : null}
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>Start Date:</label>
                            <div className={t.dateInputFlex}>
                              <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                              <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editStartDateValue : r.startDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editStartDateValue : r.startDate || '', setEditStartDateValue)} />
                            </div>
                          </div>
                          <div className={t.dateInputWrapper}>
                            <label className={t.dateLabel}>End Date:</label>
                            <div className={t.dateInputFlex}>
                              <Input type="date" value={getDateValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onDateChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                              <Input type="time" value={getTimeValue(editingRouteDatesIndex === i ? editEndDateValue : r.endDate)} disabled={editingRouteDatesIndex !== i} onChange={(e) => onTimeChange(e, editingRouteDatesIndex === i ? editEndDateValue : r.endDate || '', setEditEndDateValue)} />
                            </div>
                          </div>
                        </div>
                        {isEdit && (
                          <div className={t.removeButtonWrapper}>
                            <Button
                              themeOptions={{ size: "xs", color: "danger" }}
                              disabled={saving}
                              onClick={() => removeRoute(i)}
                              className="bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              <Icon icon="Trash" /> Remove Route from Report
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && reportRow && routes.length === 0 ? <div className={t.empty}>No routes added.</div> : null}
          </div>
          {isEdit && pendingRoute && (
            <div className={t.addForm}>
              <div>Add “{pendingRoute.name}”?</div>
              <Button disabled={saving} onClick={addRoute}>
                {saving ? "Adding…" : "Confirm"}
              </Button>
              <Button disabled={saving} onClick={cancelAdd}>
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
      {error ? <div className={t.error}>{error}</div> : null}
    </div>
  );
}
